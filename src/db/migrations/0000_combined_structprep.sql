-- ============================================================
-- StructPrep Combined Migration
-- All tables prefixed with sp_ for shared DB isolation
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ===== ENUMS =====

CREATE TYPE sp_subscription_tier AS ENUM ('free', 'pro', 'enterprise');
CREATE TYPE sp_difficulty AS ENUM ('easy', 'medium', 'hard');
CREATE TYPE sp_session_type AS ENUM ('practice', 'mock_exam', 'review');
CREATE TYPE sp_question_source AS ENUM ('manual', 'ai_generated', 'import');
CREATE TYPE sp_generation_status AS ENUM ('draft', 'review', 'approved');
CREATE TYPE sp_chunk_type AS ENUM ('section', 'table', 'equation', 'commentary');
CREATE TYPE sp_material_category AS ENUM ('code', 'handbook', 'formula', 'study_guide');
CREATE TYPE sp_processing_status AS ENUM ('pending', 'processing', 'ready', 'error');
CREATE TYPE sp_chat_role AS ENUM ('user', 'assistant');
CREATE TYPE sp_ncees_topic AS ENUM (
  'analysis_of_structures',
  'design_and_details',
  'codes_and_construction',
  'loadings',
  'materials',
  'seismic_design',
  'design_of_foundations',
  'design_of_temporary_structures',
  'other_topics'
);

-- ===== 1. PROFILES =====

CREATE TABLE sp_profiles (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  exam_date timestamptz,
  subscription_tier sp_subscription_tier NOT NULL DEFAULT 'free',
  study_streak integer NOT NULL DEFAULT 0,
  total_study_minutes integer NOT NULL DEFAULT 0,
  daily_ai_queries integer NOT NULL DEFAULT 0,
  daily_ai_reset_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ===== 2. QUESTIONS =====

CREATE TABLE sp_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic sp_ncees_topic NOT NULL,
  subtopic text NOT NULL,
  difficulty sp_difficulty NOT NULL,
  question_text text NOT NULL,
  question_image_url text,
  options jsonb NOT NULL,
  correct_option_id text NOT NULL,
  solution_text text NOT NULL,
  code_references text[] NOT NULL DEFAULT '{}',
  hint text,
  source sp_question_source NOT NULL DEFAULT 'manual',
  generation_status sp_generation_status NOT NULL DEFAULT 'approved',
  time_estimate_sec integer NOT NULL DEFAULT 300,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sp_idx_questions_topic ON sp_questions(topic);
CREATE INDEX sp_idx_questions_difficulty ON sp_questions(difficulty);
CREATE INDEX sp_idx_questions_status ON sp_questions(generation_status);

-- ===== 3. QUESTION EXPLANATIONS =====

CREATE TABLE sp_question_explanations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL UNIQUE REFERENCES sp_questions(id) ON DELETE CASCADE,
  explanation_text text NOT NULL,
  retrieved_chunks jsonb,
  generated_at timestamptz NOT NULL DEFAULT now()
);

-- ===== 4. STUDY SESSIONS (before attempts, since attempts references it) =====

CREATE TABLE sp_study_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES sp_profiles(id) ON DELETE CASCADE,
  type sp_session_type NOT NULL,
  topic_filter text,
  total_questions integer NOT NULL DEFAULT 0,
  correct_count integer NOT NULL DEFAULT 0,
  score_pct decimal(5,2) NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_sec integer NOT NULL DEFAULT 0
);

CREATE INDEX sp_idx_sessions_user ON sp_study_sessions(user_id);

-- ===== 5. QUESTION ATTEMPTS =====

CREATE TABLE sp_question_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES sp_profiles(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES sp_questions(id) ON DELETE CASCADE,
  selected_option_id text NOT NULL,
  is_correct boolean NOT NULL,
  time_spent_sec integer NOT NULL DEFAULT 0,
  flagged boolean NOT NULL DEFAULT false,
  hints_used integer NOT NULL DEFAULT 0,
  session_id uuid NOT NULL REFERENCES sp_study_sessions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sp_idx_attempts_user ON sp_question_attempts(user_id);
CREATE INDEX sp_idx_attempts_session ON sp_question_attempts(session_id);
CREATE INDEX sp_idx_attempts_question ON sp_question_attempts(question_id);

-- ===== 6. SPACED REPETITION QUEUE =====

CREATE TABLE sp_spaced_repetition_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES sp_profiles(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES sp_questions(id) ON DELETE CASCADE,
  ease_factor decimal(4,2) NOT NULL DEFAULT 2.5,
  interval_days integer NOT NULL DEFAULT 1,
  repetitions integer NOT NULL DEFAULT 0,
  next_review_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sp_idx_sr_user_next ON sp_spaced_repetition_queue(user_id, next_review_at);
CREATE UNIQUE INDEX sp_idx_sr_user_question ON sp_spaced_repetition_queue(user_id, question_id);

-- ===== 7. REFERENCE MATERIALS (before chunks, since chunks references it) =====

CREATE TABLE sp_reference_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category sp_material_category NOT NULL,
  file_url text NOT NULL,
  total_chunks integer NOT NULL DEFAULT 0,
  processing_status sp_processing_status NOT NULL DEFAULT 'pending',
  sections_toc jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ===== 8. DOCUMENT CHUNKS (RAG) =====

CREATE TABLE sp_document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES sp_reference_materials(id) ON DELETE CASCADE,
  chunk_text text NOT NULL,
  chunk_type sp_chunk_type NOT NULL DEFAULT 'section',
  section_ref text NOT NULL DEFAULT '',
  chapter text NOT NULL DEFAULT '',
  page_number integer NOT NULL DEFAULT 0,
  token_count integer NOT NULL DEFAULT 0,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- pgvector embedding column
  embedding vector(1024)
);

-- Add tsvector column for full-text search
ALTER TABLE sp_document_chunks ADD COLUMN tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', chunk_text)) STORED;

CREATE INDEX sp_idx_chunks_document ON sp_document_chunks(document_id);
CREATE INDEX sp_idx_chunks_section ON sp_document_chunks(document_id, section_ref);

-- HNSW index for fast vector similarity search
CREATE INDEX sp_idx_chunks_embedding
  ON sp_document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- GIN index for full-text search
CREATE INDEX sp_idx_chunks_tsv
  ON sp_document_chunks
  USING gin (tsv);

-- ===== 9. TUTOR SESSIONS =====

CREATE TABLE sp_tutor_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES sp_profiles(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New Chat',
  context_question_id uuid REFERENCES sp_questions(id),
  message_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sp_idx_tutor_sessions_user ON sp_tutor_sessions(user_id);

-- ===== 10. TUTOR MESSAGES =====

CREATE TABLE sp_tutor_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sp_tutor_sessions(id) ON DELETE CASCADE,
  role sp_chat_role NOT NULL,
  content text NOT NULL,
  retrieved_chunks jsonb,
  tokens_used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sp_idx_tutor_messages_session ON sp_tutor_messages(session_id);

-- ============================================================
-- RPC FUNCTIONS
-- ============================================================

-- Vector similarity search
CREATE OR REPLACE FUNCTION sp_match_document_chunks(
  query_embedding vector(1024),
  match_threshold float DEFAULT 0.3,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  chunk_text text,
  chunk_type text,
  section_ref text,
  chapter text,
  page_number int,
  token_count int,
  metadata jsonb,
  similarity float,
  doc_title text
)
LANGUAGE sql STABLE
AS $$
  SELECT
    dc.id,
    dc.document_id,
    dc.chunk_text,
    dc.chunk_type::text,
    dc.section_ref,
    dc.chapter,
    dc.page_number,
    dc.token_count,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) AS similarity,
    rm.title AS doc_title
  FROM sp_document_chunks dc
  JOIN sp_reference_materials rm ON rm.id = dc.document_id
  WHERE dc.embedding IS NOT NULL
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Full-text keyword search
CREATE OR REPLACE FUNCTION sp_keyword_search_chunks(
  search_query text,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  chunk_text text,
  chunk_type text,
  section_ref text,
  chapter text,
  page_number int,
  token_count int,
  metadata jsonb,
  rank float,
  doc_title text
)
LANGUAGE sql STABLE
AS $$
  SELECT
    dc.id,
    dc.document_id,
    dc.chunk_text,
    dc.chunk_type::text,
    dc.section_ref,
    dc.chapter,
    dc.page_number,
    dc.token_count,
    dc.metadata,
    ts_rank(dc.tsv, websearch_to_tsquery('english', search_query)) AS rank,
    rm.title AS doc_title
  FROM sp_document_chunks dc
  JOIN sp_reference_materials rm ON rm.id = dc.document_id
  WHERE dc.tsv @@ websearch_to_tsquery('english', search_query)
  ORDER BY rank DESC
  LIMIT match_count;
$$;

-- Increment tutor session message count
CREATE OR REPLACE FUNCTION sp_increment_message_count(session_id_param uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE sp_tutor_sessions
  SET message_count = message_count + 1,
      updated_at = now()
  WHERE id = session_id_param;
END;
$$;

-- Update user study time
CREATE OR REPLACE FUNCTION sp_update_study_time(user_id_param uuid, minutes_to_add int)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE sp_profiles
  SET total_study_minutes = total_study_minutes + minutes_to_add,
      updated_at = now()
  WHERE id = user_id_param;
END;
$$;

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION sp_handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.sp_profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data ->> 'full_name', '')
  );
  RETURN new;
END;
$$;

-- Trigger to auto-create profile (sp-specific trigger name to avoid collision)
DROP TRIGGER IF EXISTS on_auth_user_created_sp ON auth.users;
CREATE TRIGGER on_auth_user_created_sp
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION sp_handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE sp_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sp_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sp_question_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sp_study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sp_spaced_repetition_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE sp_tutor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sp_tutor_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sp_question_explanations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sp_reference_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE sp_document_chunks ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "SP: Users can view own profile" ON sp_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "SP: Users can update own profile" ON sp_profiles FOR UPDATE USING (auth.uid() = id);

-- Questions
CREATE POLICY "SP: Anyone can read approved questions" ON sp_questions FOR SELECT USING (generation_status = 'approved');

-- Question attempts
CREATE POLICY "SP: Users can read own attempts" ON sp_question_attempts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "SP: Users can create own attempts" ON sp_question_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Study sessions
CREATE POLICY "SP: Users can read own sessions" ON sp_study_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "SP: Users can create own sessions" ON sp_study_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "SP: Users can update own sessions" ON sp_study_sessions FOR UPDATE USING (auth.uid() = user_id);

-- Spaced repetition
CREATE POLICY "SP: Users can read own SR queue" ON sp_spaced_repetition_queue FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "SP: Users can manage own SR queue" ON sp_spaced_repetition_queue FOR ALL USING (auth.uid() = user_id);

-- Tutor sessions
CREATE POLICY "SP: Users can read own tutor sessions" ON sp_tutor_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "SP: Users can create tutor sessions" ON sp_tutor_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Tutor messages
CREATE POLICY "SP: Users can read own tutor messages" ON sp_tutor_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM sp_tutor_sessions WHERE sp_tutor_sessions.id = sp_tutor_messages.session_id AND sp_tutor_sessions.user_id = auth.uid()));
CREATE POLICY "SP: Users can create tutor messages" ON sp_tutor_messages FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM sp_tutor_sessions WHERE sp_tutor_sessions.id = sp_tutor_messages.session_id AND sp_tutor_sessions.user_id = auth.uid()));

-- Question explanations
CREATE POLICY "SP: Anyone can read explanations" ON sp_question_explanations FOR SELECT USING (true);

-- Reference materials
CREATE POLICY "SP: Anyone can read references" ON sp_reference_materials FOR SELECT USING (true);

-- Document chunks
CREATE POLICY "SP: Anyone can read chunks" ON sp_document_chunks FOR SELECT USING (true);
