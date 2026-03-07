-- Helper function: increment tutor session message count
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

-- Helper function: update user study time
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

-- Trigger to auto-create profile
DROP TRIGGER IF EXISTS on_auth_user_created_sp ON auth.users;
CREATE TRIGGER on_auth_user_created_sp
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION sp_handle_new_user();

-- Row Level Security Policies
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

-- Profiles: users can read/update own profile
DROP POLICY IF EXISTS "SP: Users can view own profile" ON sp_profiles;
CREATE POLICY "SP: Users can view own profile" ON sp_profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "SP: Users can update own profile" ON sp_profiles;
CREATE POLICY "SP: Users can update own profile" ON sp_profiles FOR UPDATE USING (auth.uid() = id);

-- Questions: all authenticated users can read approved questions
DROP POLICY IF EXISTS "SP: Anyone can read approved questions" ON sp_questions;
CREATE POLICY "SP: Anyone can read approved questions" ON sp_questions FOR SELECT USING (generation_status = 'approved');

-- Question attempts: users can read/write own attempts
DROP POLICY IF EXISTS "SP: Users can read own attempts" ON sp_question_attempts;
CREATE POLICY "SP: Users can read own attempts" ON sp_question_attempts FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "SP: Users can create own attempts" ON sp_question_attempts;
CREATE POLICY "SP: Users can create own attempts" ON sp_question_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Study sessions: users can read/write own sessions
DROP POLICY IF EXISTS "SP: Users can read own sessions" ON sp_study_sessions;
CREATE POLICY "SP: Users can read own sessions" ON sp_study_sessions FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "SP: Users can create own sessions" ON sp_study_sessions;
CREATE POLICY "SP: Users can create own sessions" ON sp_study_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "SP: Users can update own sessions" ON sp_study_sessions;
CREATE POLICY "SP: Users can update own sessions" ON sp_study_sessions FOR UPDATE USING (auth.uid() = user_id);

-- Spaced repetition: users can read/write own queue
DROP POLICY IF EXISTS "SP: Users can read own SR queue" ON sp_spaced_repetition_queue;
CREATE POLICY "SP: Users can read own SR queue" ON sp_spaced_repetition_queue FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "SP: Users can manage own SR queue" ON sp_spaced_repetition_queue;
CREATE POLICY "SP: Users can manage own SR queue" ON sp_spaced_repetition_queue FOR ALL USING (auth.uid() = user_id);

-- Tutor sessions: users can manage own chat sessions
DROP POLICY IF EXISTS "SP: Users can read own tutor sessions" ON sp_tutor_sessions;
CREATE POLICY "SP: Users can read own tutor sessions" ON sp_tutor_sessions FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "SP: Users can create tutor sessions" ON sp_tutor_sessions;
CREATE POLICY "SP: Users can create tutor sessions" ON sp_tutor_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Tutor messages: users can read messages from own sessions
DROP POLICY IF EXISTS "SP: Users can read own tutor messages" ON sp_tutor_messages;
CREATE POLICY "SP: Users can read own tutor messages" ON sp_tutor_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM sp_tutor_sessions WHERE sp_tutor_sessions.id = sp_tutor_messages.session_id AND sp_tutor_sessions.user_id = auth.uid()));
DROP POLICY IF EXISTS "SP: Users can create tutor messages" ON sp_tutor_messages;
CREATE POLICY "SP: Users can create tutor messages" ON sp_tutor_messages FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM sp_tutor_sessions WHERE sp_tutor_sessions.id = sp_tutor_messages.session_id AND sp_tutor_sessions.user_id = auth.uid()));

-- Question explanations: all authenticated users can read
DROP POLICY IF EXISTS "SP: Anyone can read explanations" ON sp_question_explanations;
CREATE POLICY "SP: Anyone can read explanations" ON sp_question_explanations FOR SELECT USING (true);

-- Reference materials: all authenticated users can read
DROP POLICY IF EXISTS "SP: Anyone can read references" ON sp_reference_materials;
CREATE POLICY "SP: Anyone can read references" ON sp_reference_materials FOR SELECT USING (true);

-- Document chunks: all authenticated users can read
DROP POLICY IF EXISTS "SP: Anyone can read chunks" ON sp_document_chunks;
CREATE POLICY "SP: Anyone can read chunks" ON sp_document_chunks FOR SELECT USING (true);
