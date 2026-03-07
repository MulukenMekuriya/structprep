-- Migration: Update sp_ncees_topic enum from 9 old topics to 5 NCEES categories
-- Per NCEES PE Civil: Structural CBT Exam Specifications, Effective April 2024

-- 1. Delete existing seed questions (they reference old enum values)
DELETE FROM sp_questions;

-- 2. Delete any related data that depends on sp_questions
DELETE FROM sp_question_explanations WHERE TRUE;
DELETE FROM sp_question_attempts WHERE TRUE;
DELETE FROM sp_spaced_repetition_queue WHERE TRUE;

-- 3. Drop columns that use the old enum, drop the enum, recreate
ALTER TABLE sp_questions ALTER COLUMN topic TYPE text;

DROP TYPE IF EXISTS sp_ncees_topic;

CREATE TYPE sp_ncees_topic AS ENUM (
  'loads_and_load_applications',
  'forces_and_load_effects',
  'temporary_structures_and_other',
  'materials_and_properties',
  'component_design_and_detailing'
);

ALTER TABLE sp_questions ALTER COLUMN topic TYPE sp_ncees_topic USING topic::sp_ncees_topic;
