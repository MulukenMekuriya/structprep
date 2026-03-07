-- Allow authenticated users to insert and update reference materials and chunks

CREATE POLICY "SP: Authenticated users can insert references"
ON sp_reference_materials FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "SP: Authenticated users can update references"
ON sp_reference_materials FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "SP: Authenticated users can insert chunks"
ON sp_document_chunks FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "SP: Authenticated users can update chunks"
ON sp_document_chunks FOR UPDATE
TO authenticated
USING (true);
