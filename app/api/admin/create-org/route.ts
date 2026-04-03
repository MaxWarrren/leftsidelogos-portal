import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';

// ---------------------------------------------------------------------------
// Access code generation — format: XXXX-YYYY
// XXXX: 4-letter abbreviation derived from the org name
// YYYY: 4 random digits
// ---------------------------------------------------------------------------

const NOISE_WORDS = new Set([
    'and', 'the', 'of', 'a', 'an', 'in', 'on', 'at', 'to', 'for',
    'llc', 'inc', 'ltd', 'co', 'corp', 'group', 'holdings', 'ventures',
]);

function deriveLetterCode(name: string): string {
    // Strip non-alphanumeric (except spaces), split into words, filter noise
    const words = name
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .trim()
        .split(/\s+/)
        .filter(w => w.length > 0 && !NOISE_WORDS.has(w.toLowerCase()));

    let code: string;

    if (words.length >= 2) {
        // Take first 2 letters from the first two meaningful words
        code = (words[0].substring(0, 2) + words[1].substring(0, 2)).toUpperCase();
    } else if (words.length === 1) {
        // Take first 4 letters (or pad with X if short)
        code = words[0].substring(0, 4).toUpperCase().padEnd(4, 'X');
    } else {
        // Fallback: first 4 chars of cleaned name
        code = name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase().padEnd(4, 'X');
    }

    return code;
}

function randomDigits(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

async function generateUniqueAccessCode(
    adminSupabase: ReturnType<typeof createAdminClient>,
    name: string
): Promise<string> {
    const letterCode = deriveLetterCode(name);

    // Try up to 10 times to avoid collisions (extremely rare in practice)
    for (let i = 0; i < 10; i++) {
        const candidate = `${letterCode}-${randomDigits()}`;

        const { count } = await adminSupabase
            .from('organizations')
            .select('id', { count: 'exact', head: true })
            .eq('access_code', candidate);

        if ((count ?? 0) === 0) return candidate;
    }

    // Last resort: use a timestamp-based suffix
    return `${letterCode}-${Date.now().toString().slice(-4)}`;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
    // 1. Auth — must be a logged-in user (admin portal is session-gated)
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { name } = await req.json();

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return NextResponse.json({ error: 'Organization name is required' }, { status: 400 });
        }

        const adminSupabase = createAdminClient();

        // 2. Generate a unique access code
        const accessCode = await generateUniqueAccessCode(adminSupabase, name.trim());

        // 3. Insert into organizations
        const { data: org, error: insertError } = await adminSupabase
            .from('organizations')
            .insert({ name: name.trim(), access_code: accessCode })
            .select('id, name, access_code, created_at')
            .single();

        if (insertError) {
            console.error('Create Org Error:', insertError);
            return NextResponse.json(
                { error: 'Failed to create organization', details: insertError.message },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, organization: org });

    } catch (e: any) {
        console.error('Create Org Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
