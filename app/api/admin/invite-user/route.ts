import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: NextRequest) {
    const supabase = await createClient();

    // Check if the current user is authorized (Admin check)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { email, organizationId, name } = await req.json();

        if (!email) {
            return NextResponse.json({ error: 'Missing Email' }, { status: 400 });
        }

        const adminSupabase = createAdminClient();

        // 1. Fetch Organization Access Code
        let accessCode = '';
        if (organizationId) {
            const { data: orgData, error: orgError } = await adminSupabase
                .from('organizations')
                .select('access_code')
                .eq('id', organizationId)
                .single();

            if (orgData) {
                accessCode = orgData.access_code;
            }
        }

        // 2. Invite the user
        const { data, error: inviteError } = await adminSupabase.auth.admin.inviteUserByEmail(email, {
            data: {
                full_name: name || '',
                access_code: accessCode,
                organization_id: organizationId // Helpful metadata
            }
        });

        if (inviteError) {
            console.error("Invite Error:", inviteError);
            return NextResponse.json({ error: inviteError.message }, { status: 500 });
        }

        // 3. Link them (Update profile) - Set status to 'invited'
        if (data.user) {
            const { error: profileError } = await adminSupabase
                .from('profiles')
                .upsert({
                    id: data.user.id,
                    email: email,
                    full_name: name || '',
                    organization_id: organizationId || null,
                    status: 'invited' // Explicitly set to invited
                })
                .select();

            if (profileError) {
                console.error("Profile Update Error:", profileError);
            }

            // 4. Update Leads if exists
            // Check if lead exists with this email
            const { error: leadError } = await adminSupabase
                .from('leads')
                .update({
                    contact_type: 'invited',
                    status: 'contacted', // Ensure validation
                    organization_id: organizationId || null,
                    converted_profile_id: data.user.id
                })
                .eq('email', email);

            if (leadError) {
                console.error("Lead Update Error:", leadError);
            }
        }

        return NextResponse.json({ success: true, user: data.user });

    } catch (e: any) {
        console.error("Invite User Exception:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
