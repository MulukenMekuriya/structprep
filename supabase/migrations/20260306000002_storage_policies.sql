-- Storage policies for the 'references' bucket
-- Allows authenticated users to upload and anyone to read

-- Create bucket if it doesn't exist (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('references', 'references', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "SP: Authenticated users can upload references"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'references');

-- Allow anyone to read/download files
CREATE POLICY "SP: Anyone can read reference files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'references');

-- Allow authenticated users to update their uploads
CREATE POLICY "SP: Authenticated users can update references"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'references');

-- Allow authenticated users to delete their uploads
CREATE POLICY "SP: Authenticated users can delete references"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'references');
