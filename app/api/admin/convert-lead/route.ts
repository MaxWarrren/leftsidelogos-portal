import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: NextRequest) {
    const supabase = await createClient();

    // Check if the current user is authorized (Admin check)
    // For now, we just check if they are logged in, effectively. 
    // Ideally we check for a specific role.
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { leadId, email, name, organizationId } = await req.json();

        if (!leadId || !email) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const adminSupabase = createAdminClient();

        // 1. Invite the user
        const { data: inviteData, error: inviteError } = await adminSupabase.auth.admin.inviteUserByEmail(email, {
            data: {
                full_name: name,
                // We can pass metadata here that the trigger might use, 
                // but we will update explicitly to be safe.
            }
        });

        if (inviteError) {
            console.error("Invite Error:", inviteError);
            return NextResponse.json({ error: inviteError.message }, { status: 500 });
        }

        const newUserId = inviteData.user.id;

        // 2. Update the Profile with the Organization ID
        // The trigger should have created the profile, so we update it.
        // We use adminSupabase to bypass RLS if needed, or normal supabase if the user has permission.
        // Ideally leads conversion is an admin task.
        if (organizationId) {
            const { error: profileError } = await adminSupabase
                .from('profiles')
                .update({ organization_id: organizationId })
                .eq('id', newUserId);

            if (profileError) {
                console.error("Profile Update Error:", profileError);
                // Continue though, as the user is invited.
            }
        }

        // 3. Update the Lead
        const { error: leadError } = await adminSupabase
            .from('leads')
            .update({
                converted_profile_id: newUserId,
                status: 'closed'
            })
            .eq('id', leadId);

        if (leadError) {
            console.error("Lead Update Error:", leadError);
            return NextResponse.json({ error: "User invited but failed to update lead record" }, { status: 500 });
        }

        return NextResponse.json({ success: true, userId: newUserId });

    } catch (e: any) {
        console.error("Conversion Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
