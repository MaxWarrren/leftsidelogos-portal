-- 1. Fix the check constraint on the contracts table
ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS contracts_status_check;

ALTER TABLE public.contracts ADD CONSTRAINT contracts_status_check 
CHECK (status IN ('pending', 'signed', 'rejected', 'unpaid', 'paid', 'overdue'));

-- 2. Ensure RLS is enabled and policies are correct for the contracts table
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can do everything
DROP POLICY IF EXISTS "Admins can do everything on contracts_table" ON public.contracts;
CREATE POLICY "Admins can do everything on contracts_table"
ON public.contracts
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('admin', 'superadmin')
    )
);

-- Policy: Members can view files for their organization
DROP POLICY IF EXISTS "Members can view their org contracts" ON public.contracts;
CREATE POLICY "Members can view their org contracts"
ON public.contracts
FOR SELECT
TO authenticated
USING (
    organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid()
    )
);

-- Note: We assume the storage bucket policies were already set up manually or via the previous script.
-- If storage policies are still failing, ensure the 'contracts' bucket RLS allows SELECT for members.
