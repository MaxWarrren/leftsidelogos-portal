import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { lookupProduct, SsaApiError, type SsaIdentifierKind } from "@/lib/ssactivewear";

const VALID_KINDS: SsaIdentifierKind[] = ["style", "sku", "partNumber", "styleId"];

export async function POST(req: NextRequest) {
    // Admin-only.
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const adminSupabase = createAdminClient();
    const { data: profile } = await adminSupabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
    if (profile?.role !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: { identifier?: string; kind?: SsaIdentifierKind; mock?: boolean };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const identifier = (body.identifier ?? "").trim();
    const kind: SsaIdentifierKind = VALID_KINDS.includes(body.kind!) ? body.kind! : "style";
    const mock = body.mock === true;

    if (!identifier) {
        return NextResponse.json({ error: "Identifier is required" }, { status: 400 });
    }

    try {
        const summary = await lookupProduct(identifier, kind, { mock });
        return NextResponse.json({ success: true, product: summary, mock });
    } catch (e) {
        if (e instanceof SsaApiError) {
            return NextResponse.json(
                { error: e.message, status: e.status },
                { status: e.status === 404 ? 404 : 502 }
            );
        }
        const message = e instanceof Error ? e.message : "Unknown error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
