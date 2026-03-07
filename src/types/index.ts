// ===== ENUMS =====

export type SubscriptionTier = "free" | "pro" | "enterprise";
export type Difficulty = "easy" | "medium" | "hard";
export type SessionType = "practice" | "mock_exam" | "review";
export type QuestionSource = "manual" | "ai_generated" | "import";
export type GenerationStatus = "draft" | "review" | "approved";
export type ChunkType = "section" | "table" | "equation" | "commentary";
export type MaterialCategory = "code" | "handbook" | "formula" | "study_guide";
export type ProcessingStatus = "pending" | "processing" | "ready" | "error";
export type ChatRole = "user" | "assistant";

// ===== NCEES PE CIVIL: STRUCTURAL — 5 EXAM CATEGORIES =====
// Per NCEES CBT Exam Specifications, Effective April 2024
// 80 questions, 9 hours (includes tutorial + optional break)

export const NCEES_TOPICS = [
  "loads_and_load_applications",
  "forces_and_load_effects",
  "temporary_structures_and_other",
  "materials_and_properties",
  "component_design_and_detailing",
] as const;

export type NCEESTopic = (typeof NCEES_TOPICS)[number];

// Weights based on midpoint of NCEES question ranges, normalized to 80
export const TOPIC_WEIGHTS: Record<NCEESTopic, number> = {
  loads_and_load_applications: 0.17,       // 12–18 questions
  forces_and_load_effects: 0.244,          // 17–26 questions
  temporary_structures_and_other: 0.074,   // 5–8 questions
  materials_and_properties: 0.142,         // 10–15 questions
  component_design_and_detailing: 0.37,    // 26–39 questions
};

// Question count ranges per NCEES spec
export const TOPIC_QUESTION_RANGES: Record<NCEESTopic, { min: number; max: number }> = {
  loads_and_load_applications: { min: 12, max: 18 },
  forces_and_load_effects: { min: 17, max: 26 },
  temporary_structures_and_other: { min: 5, max: 8 },
  materials_and_properties: { min: 10, max: 15 },
  component_design_and_detailing: { min: 26, max: 39 },
};

export const TOPIC_LABELS: Record<NCEESTopic, string> = {
  loads_and_load_applications: "Analysis of Structures — Loads & Load Applications",
  forces_and_load_effects: "Analysis of Structures — Forces & Load Effects",
  temporary_structures_and_other: "Temporary Structures & Other Topics",
  materials_and_properties: "Design & Details — Materials & Material Properties",
  component_design_and_detailing: "Design & Details — Component Design & Detailing",
};

// Short labels for compact UI (badges, etc.)
export const TOPIC_SHORT_LABELS: Record<NCEESTopic, string> = {
  loads_and_load_applications: "Loads",
  forces_and_load_effects: "Forces & Effects",
  temporary_structures_and_other: "Temp Structures",
  materials_and_properties: "Materials",
  component_design_and_detailing: "Component Design",
};

// ===== SUBTOPICS PER NCEES SPEC =====

export const TOPIC_SUBTOPICS: Record<NCEESTopic, string[]> = {
  loads_and_load_applications: [
    "Dead loads",
    "Live loads",
    "Construction loads",
    "Wind loads",
    "Seismic loads",
    "Moving loads (vehicular, cranes)",
    "Snow, rain, and ice",
    "Impact loads",
    "Earth pressure and surcharge loads",
    "Tributary areas and load paths",
    "Load combinations",
  ],
  forces_and_load_effects: [
    "Diagrams (shear and moment)",
    "Axial (tension and compression)",
    "Shear",
    "Flexure",
    "Combined stresses",
    "Deflection",
    "Special topics (torsion, buckling, fatigue, progressive collapse, thermal deformation, bearing)",
  ],
  temporary_structures_and_other: [
    "Special inspections",
    "Submittals",
    "Formwork, falsework, scaffolding, shoring/reshoring, bracing, anchorage",
    "Impact of construction on adjacent facilities",
    "Safety (construction, roadside, work zone)",
  ],
  materials_and_properties: [
    "Soil classification and soil properties",
    "Concrete (unreinforced, reinforced, cast-in-place, precast, pre/post-tensioned)",
    "Steel (structural, cold-formed)",
    "Timber",
    "Masonry (brick veneer, CMU)",
    "Material test methods and specification conformance",
  ],
  component_design_and_detailing: [
    "Horizontal members (beams, slabs, diaphragms, struts)",
    "Vertical members (columns, bearing walls, shear walls)",
    "Systems (trusses, braces, frames, composite construction)",
    "Connections (bolted, welded, bearing, embedded, anchored, post-installed)",
    "Shallow foundations (footings, combined footings, slabs, mats)",
    "Deep foundations (piers, piles, caissons, drilled shafts)",
    "Retaining walls",
  ],
};

// ===== DESIGN STANDARDS (per NCEES April 2024 spec) =====

export const DESIGN_STANDARDS = [
  { abbr: "AASHTO", title: "AASHTO LRFD Bridge Design Specifications, 8th edition, 2017" },
  { abbr: "IBC", title: "International Building Code, 2018 edition" },
  { abbr: "ASCE 7-16", title: "Minimum Design Loads for Buildings and Other Structures, 2017" },
  { abbr: "ACI 318", title: "Building Code Requirements for Structural Concrete, 2014" },
  { abbr: "AISC", title: "Steel Construction Manual, 15th edition, 2017" },
  { abbr: "AWC NDS", title: "National Design Specification for Wood Construction, 2018 (ASD only)" },
  { abbr: "CFR Title 29", title: "OSHA Standards: Parts 1910 & 1926, July 2020" },
  { abbr: "PCI", title: "PCI Design Handbook, 7th edition, 2010" },
  { abbr: "TMS 402/602", title: "Building Code Requirements for Masonry Structures, 2016" },
] as const;

// ===== EXAM CONSTANTS =====

export const EXAM_TOTAL_QUESTIONS = 80;
export const EXAM_DURATION_HOURS = 9; // includes tutorial + optional break

// ===== QUESTION TYPES =====

export interface QuestionOption {
  id: string;
  text: string;
  image_url?: string;
}

export interface Question {
  id: string;
  topic: NCEESTopic;
  subtopic: string;
  difficulty: Difficulty;
  question_text: string;
  question_image_url: string | null;
  options: QuestionOption[];
  correct_option_id: string;
  solution_text: string;
  code_references: string[];
  hint: string | null;
  source: QuestionSource;
  generation_status: GenerationStatus;
  time_estimate_sec: number;
  created_at: string;
}

// ===== SESSION TYPES =====

export interface StudySession {
  id: string;
  user_id: string;
  type: SessionType;
  topic_filter: string | null;
  total_questions: number;
  correct_count: number;
  score_pct: number;
  started_at: string;
  completed_at: string | null;
  duration_sec: number;
}

export interface QuestionAttempt {
  id: string;
  user_id: string;
  question_id: string;
  selected_option_id: string;
  is_correct: boolean;
  time_spent_sec: number;
  flagged: boolean;
  hints_used: number;
  session_id: string;
}

// ===== DASHBOARD TYPES =====

export interface DashboardStats {
  study_streak: number;
  total_study_minutes: number;
  total_questions_attempted: number;
  overall_accuracy: number;
  topic_accuracy: Record<NCEESTopic, { correct: number; total: number; accuracy: number }>;
  recent_sessions: StudySession[];
  readiness_score: number;
}

export interface WeakArea {
  topic: NCEESTopic;
  accuracy: number;
  total_attempted: number;
  recommendation: string;
}

// ===== RAG TYPES =====

export interface DocumentChunk {
  id: string;
  document_id: string;
  chunk_text: string;
  chunk_type: ChunkType;
  section_ref: string;
  chapter: string;
  page_number: number;
  token_count: number;
  metadata: Record<string, unknown>;
}

export interface RetrievedContext {
  chunk: DocumentChunk;
  score: number;
  source_title: string;
}

// ===== CHAT TYPES =====

export interface TutorMessage {
  id: string;
  session_id: string;
  role: ChatRole;
  content: string;
  retrieved_chunks: DocumentChunk[] | null;
  tokens_used: number;
  created_at: string;
}
