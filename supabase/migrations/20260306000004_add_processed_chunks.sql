-- Add processed_chunks column for tracking upload progress
ALTER TABLE sp_reference_materials
  ADD COLUMN IF NOT EXISTS processed_chunks integer NOT NULL DEFAULT 0;
