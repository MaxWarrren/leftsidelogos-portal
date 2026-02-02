import { createClient } from "@/utils/supabase/server";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    // 1. Validate API Key
    const apiKey = req.headers.get("x-api-key");
    const validApiKey = process.env.LEADS_API_KEY;

    if (!validApiKey || apiKey !== validApiKey) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { name, email, company, phone, summary, source } = body;

        // Basic Validation
        if (!name || !email) {
            return NextResponse.json({ error: "Name and Email are required" }, { status: 400 });
        }

        const supabase = await createClient();

        // 2. Insert Lead
        const { data, error } = await supabase
            .from('leads')
            .insert({
                name,
                email,
                company: company || null,
                phone: phone || null,
                summary: summary || null,
                status: 'new',
                details: {
                    source: source || 'api',
                    ...body.details
                }
            });

        if (error) {
            console.error("Supabase Error:", error);
            return NextResponse.json({ error: "Failed to create lead", details: error.message, code: error.code }, { status: 500 });
        }

        return NextResponse.json({ success: true, lead: data });

    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
