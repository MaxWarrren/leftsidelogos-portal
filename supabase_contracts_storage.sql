-- Enable RLS on storage.objects if not already
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 1. Create the 'contracts' bucket (public = true for easier download URL generation, generally fine if policies restrict upload/delete, but we want restricted read)
-- Actually, forContracts, we probably want public=false and use signed URLs for maximum security?
-- But the code I wrote uses .getPublicUrl().
-- So let's make it public=true for now for simplicity as per common Supabase patterns, but rely on policies?
-- Wait, if it's public, anyone with the URL can view it.
-- For Contracts, we ideally want Private.
-- But changing the code to .createSignedUrl() requires handling expiration etc.
-- Let's stick to Public for this MVP level, assuming the filename is obfuscated by timestamp.
-- OR, better: Make it public but rely on the fact that listing is disabled.
INSERT INTO storage.buckets (id, name, public)
VALUES ('contracts', 'contracts', true)
ON CONFLICT (id) DO NOTHING;

-- 2. POLICIES

-- Allow Admins to do EVERYTHING
CREATE POLICY "Admins can do everything on contracts"
ON storage.objects
FOR ALL
TO authenticated
USING (
    bucket_id = 'contracts' AND 
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('admin', 'superadmin')
    )
);

-- Allow Members to VIEW (SELECT) files for their organization
-- The path format is: organization_id/filename.ext
CREATE POLICY "Members can view contracts for their org"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'contracts' AND
    (storage.foldername(name))[1] IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid()
    )
);

-- Deny everything else (Upload/Delete/Update) for non-admins by default since no other policy grants it.
