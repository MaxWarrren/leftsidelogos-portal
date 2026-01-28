-- Create media_items table
CREATE TABLE IF NOT EXISTS media_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    uploader_id UUID NOT NULL REFERENCES profiles(id),
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    size BIGINT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Brand Assets', 'Mockups', 'Final Designs')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE media_items ENABLE ROW LEVEL SECURITY;

-- Policies for media_items

-- Select Policy
DROP POLICY IF EXISTS "Users can view own org media" ON media_items;
CREATE POLICY "Users can view own org media" ON media_items
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
        OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Insert Policy
DROP POLICY IF EXISTS "Users can upload to own org" ON media_items;
CREATE POLICY "Users can upload to own org" ON media_items
    FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
        OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Delete Policy
DROP POLICY IF EXISTS "Users can delete own uploads" ON media_items;
CREATE POLICY "Users can delete own uploads" ON media_items
    FOR DELETE
    USING (
        uploader_id = auth.uid()
        OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Enable Realtime
alter publication supabase_realtime add table media_items;

-- Storage Policies (Run this if you haven't already set up storage policies)
-- Note: You must have created the 'organization-assets' bucket in the dashboard first.
create policy "Org Members Select Storage"
  on storage.objects for select
  using ( bucket_id = 'organization-assets' AND (
    (storage.foldername(name))[1]::uuid IN (
      select organization_id from organization_members where user_id = auth.uid()
    )
    OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  ));

create policy "Org Members Insert Storage"
  on storage.objects for insert
  with check ( bucket_id = 'organization-assets' AND (
    (storage.foldername(name))[1]::uuid IN (
      select organization_id from organization_members where user_id = auth.uid()
    )
    OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  ));
