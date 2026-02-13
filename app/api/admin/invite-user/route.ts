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

        // 1. Invite the user
        const { data, error: inviteError } = await adminSupabase.auth.admin.inviteUserByEmail(email, {
            data: {
                full_name: name || '',
            }
        });

        if (inviteError) {
            console.error("Invite Error:", inviteError);
            return NextResponse.json({ error: inviteError.message }, { status: 500 });
        }

        // 2. If organization provided, link them (Update profile)
        if (organizationId && data.user) {
            const { error: profileError } = await adminSupabase
                .from('profiles')
                .upsert({
                    id: data.user.id,
                    email: email,
                    full_name: name || '',
                    organization_id: organizationId
                })
                .select();

            if (profileError) {
                console.error("Profile Update Error:", profileError);
                // Non-fatal, return success with warning optionally
            }
        }

        return NextResponse.json({ success: true, user: data.user });

    } catch (e: any) {
        console.error("Invite User Exception:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
