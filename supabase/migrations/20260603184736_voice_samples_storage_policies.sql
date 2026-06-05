-- Allow authenticated women to upload their own voice sample
CREATE POLICY "voice_samples_owner_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'voice-samples'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated women to read their own voice sample
CREATE POLICY "voice_samples_owner_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'voice-samples'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated women to delete their own voice sample
CREATE POLICY "voice_samples_owner_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'voice-samples'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow service_role (edge functions) full access for cloning pipeline
CREATE POLICY "voice_samples_service_role_all"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'voice-samples')
WITH CHECK (bucket_id = 'voice-samples');;
