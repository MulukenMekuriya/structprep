-- Allow authenticated users to insert questions (for AI generation + import)
CREATE POLICY "SP: Authenticated users can insert questions"
  ON sp_questions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to read all questions (not just approved)
-- so admins can see drafts
DROP POLICY IF EXISTS "SP: Anyone can read approved questions" ON sp_questions;
CREATE POLICY "SP: Anyone can read questions"
  ON sp_questions FOR SELECT
  USING (true);

-- Allow authenticated users to update questions (approve drafts)
CREATE POLICY "SP: Authenticated users can update questions"
  ON sp_questions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
