import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: NextRequest) {
    const supabase = await createClient();

    // 1. Authenticate the caller.
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Authorize: caller must be an admin. We use the admin (service-role)
    //    client for this lookup so RLS can't mask the row, and we read the
    //    role straight from `profiles.role`.
    const adminSupabase = createAdminClient();
    const { data: callerProfile, error: profileError } = await adminSupabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profileError) {
        console.error('Delete User — profile lookup failed:', profileError);
        return NextResponse.json(
            { error: profileError.message },
            { status: 500 }
        );
    }
    if (!callerProfile || callerProfile.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }

    try {
        const { userId } = await req.json();

        if (!userId) {
            return NextResponse.json({ error: 'Missing User ID' }, { status: 400 });
        }

        // 3. Delete the auth.users row. With the `tighten_org_user_cascades`
        //    migration in place, `profiles` cascades and `orders.submitted_by`
        //    is nulled — so this no longer trips over FK constraints.
        const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(userId);

        if (deleteError) {
            console.error('Delete User Error:', deleteError);
            // Surface the actual Supabase error + status so the admin UI can
            // tell the user *why* the delete failed (instead of a generic 500).
            const status = (deleteError as { status?: number }).status ?? 500;
            return NextResponse.json({ error: deleteError.message }, { status });
        }

        return NextResponse.json({ success: true });

    } catch (e: any) {
        console.error('Delete User Exception:', e);
        return NextResponse.json({ error: e?.message ?? 'Unknown error' }, { status: 500 });
    }
}
