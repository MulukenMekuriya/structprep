import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  decimal,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ===== ENUMS (sp_ prefixed for shared DB isolation) =====

export const subscriptionTierEnum = pgEnum("sp_subscription_tier", [
  "free",
  "pro",
  "enterprise",
]);

export const difficultyEnum = pgEnum("sp_difficulty", [
  "easy",
  "medium",
  "hard",
]);

export const sessionTypeEnum = pgEnum("sp_session_type", [
  "practice",
  "mock_exam",
  "review",
]);

export const questionSourceEnum = pgEnum("sp_question_source", [
  "manual",
  "ai_generated",
  "import",
]);

export const generationStatusEnum = pgEnum("sp_generation_status", [
  "draft",
  "review",
  "approved",
]);

export const chunkTypeEnum = pgEnum("sp_chunk_type", [
  "section",
  "table",
  "equation",
  "commentary",
]);

export const materialCategoryEnum = pgEnum("sp_material_category", [
  "code",
  "handbook",
  "formula",
  "study_guide",
]);

export const processingStatusEnum = pgEnum("sp_processing_status", [
  "pending",
  "processing",
  "ready",
  "error",
]);

export const chatRoleEnum = pgEnum("sp_chat_role", ["user", "assistant"]);

export const nceesTopicEnum = pgEnum("sp_ncees_topic", [
  "loads_and_load_applications",
  "forces_and_load_effects",
  "temporary_structures_and_other",
  "materials_and_properties",
  "component_design_and_detailing",
]);

// ===== 1. PROFILES =====

export const profiles = pgTable("sp_profiles", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  fullName: text("full_name").notNull().default(""),
  examDate: timestamp("exam_date", { mode: "date" }),
  subscriptionTier: subscriptionTierEnum("subscription_tier")
    .notNull()
    .default("free"),
  studyStreak: integer("study_streak").notNull().default(0),
  totalStudyMinutes: integer("total_study_minutes").notNull().default(0),
  dailyAiQueries: integer("daily_ai_queries").notNull().default(0),
  dailyAiResetAt: timestamp("daily_ai_reset_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ===== 2. QUESTIONS =====

export const questions = pgTable(
  "sp_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    topic: nceesTopicEnum("topic").notNull(),
    subtopic: text("subtopic").notNull(),
    difficulty: difficultyEnum("difficulty").notNull(),
    questionText: text("question_text").notNull(),
    questionImageUrl: text("question_image_url"),
    options: jsonb("options").notNull().$type<
      { id: string; text: string; image_url?: string }[]
    >(),
    correctOptionId: text("correct_option_id").notNull(),
    solutionText: text("solution_text").notNull(),
    codeReferences: text("code_references")
      .array()
      .notNull()
      .default([]),
    hint: text("hint"),
    source: questionSourceEnum("source").notNull().default("manual"),
    generationStatus: generationStatusEnum("generation_status")
      .notNull()
      .default("approved"),
    timeEstimateSec: integer("time_estimate_sec").notNull().default(300),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("sp_idx_questions_topic").on(table.topic),
    index("sp_idx_questions_difficulty").on(table.difficulty),
    index("sp_idx_questions_status").on(table.generationStatus),
  ]
);

// ===== 3. QUESTION EXPLANATIONS (Cache) =====

export const questionExplanations = pgTable("sp_question_explanations", {
  id: uuid("id").primaryKey().defaultRandom(),
  questionId: uuid("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" })
    .unique(),
  explanationText: text("explanation_text").notNull(),
  retrievedChunks: jsonb("retrieved_chunks"),
  generatedAt: timestamp("generated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ===== 4. QUESTION ATTEMPTS =====

export const questionAttempts = pgTable(
  "sp_question_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    selectedOptionId: text("selected_option_id").notNull(),
    isCorrect: boolean("is_correct").notNull(),
    timeSpentSec: integer("time_spent_sec").notNull().default(0),
    flagged: boolean("flagged").notNull().default(false),
    hintsUsed: integer("hints_used").notNull().default(0),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => studySessions.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("sp_idx_attempts_user").on(table.userId),
    index("sp_idx_attempts_session").on(table.sessionId),
    index("sp_idx_attempts_question").on(table.questionId),
  ]
);

// ===== 5. STUDY SESSIONS =====

export const studySessions = pgTable(
  "sp_study_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    type: sessionTypeEnum("type").notNull(),
    topicFilter: text("topic_filter"),
    totalQuestions: integer("total_questions").notNull().default(0),
    correctCount: integer("correct_count").notNull().default(0),
    scorePct: decimal("score_pct", { precision: 5, scale: 2 })
      .notNull()
      .default("0"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    durationSec: integer("duration_sec").notNull().default(0),
  },
  (table) => [index("sp_idx_sessions_user").on(table.userId)]
);

// ===== 6. SPACED REPETITION QUEUE =====

export const spacedRepetitionQueue = pgTable(
  "sp_spaced_repetition_queue",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    easeFactor: decimal("ease_factor", { precision: 4, scale: 2 })
      .notNull()
      .default("2.5"),
    intervalDays: integer("interval_days").notNull().default(1),
    repetitions: integer("repetitions").notNull().default(0),
    nextReviewAt: timestamp("next_review_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("sp_idx_sr_user_next").on(table.userId, table.nextReviewAt),
    uniqueIndex("sp_idx_sr_user_question").on(table.userId, table.questionId),
  ]
);

// ===== 7. DOCUMENT CHUNKS (RAG) =====

export const documentChunks = pgTable(
  "sp_document_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => referenceMaterials.id, { onDelete: "cascade" }),
    chunkText: text("chunk_text").notNull(),
    chunkType: chunkTypeEnum("chunk_type").notNull().default("section"),
    sectionRef: text("section_ref").notNull().default(""),
    chapter: text("chapter").notNull().default(""),
    pageNumber: integer("page_number").notNull().default(0),
    tokenCount: integer("token_count").notNull().default(0),
    // embedding stored as text — we use raw SQL for pgvector operations
    // because Drizzle doesn't natively support VECTOR type
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("sp_idx_chunks_document").on(table.documentId),
    index("sp_idx_chunks_section").on(table.documentId, table.sectionRef),
  ]
);

// ===== 8. REFERENCE MATERIALS =====

export const referenceMaterials = pgTable("sp_reference_materials", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  category: materialCategoryEnum("category").notNull(),
  fileUrl: text("file_url").notNull(),
  totalChunks: integer("total_chunks").notNull().default(0),
  processingStatus: processingStatusEnum("processing_status")
    .notNull()
    .default("pending"),
  sectionsToc: jsonb("sections_toc"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ===== 9. TUTOR CHAT SESSIONS =====

export const tutorSessions = pgTable(
  "sp_tutor_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New Chat"),
    contextQuestionId: uuid("context_question_id").references(
      () => questions.id
    ),
    messageCount: integer("message_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("sp_idx_tutor_sessions_user").on(table.userId)]
);

// ===== 10. TUTOR CHAT MESSAGES =====

export const tutorMessages = pgTable(
  "sp_tutor_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => tutorSessions.id, { onDelete: "cascade" }),
    role: chatRoleEnum("role").notNull(),
    content: text("content").notNull(),
    retrievedChunks: jsonb("retrieved_chunks"),
    tokensUsed: integer("tokens_used").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("sp_idx_tutor_messages_session").on(table.sessionId)]
);
