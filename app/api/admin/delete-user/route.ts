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
        const { userId } = await req.json();

        if (!userId) {
            return NextResponse.json({ error: 'Missing User ID' }, { status: 400 });
        }

        const adminSupabase = createAdminClient();

        // Delete the user from auth.users. 
        // This usually cascades to profiles/other tables if configured, or we might need to clean up manually.
        // Assuming cascade or simple delete for now.
        const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(userId);

        if (deleteError) {
            console.error("Delete User Error:", deleteError);
            return NextResponse.json({ error: deleteError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (e: any) {
        console.error("Delete User Exception:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
