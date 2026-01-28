import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function POST(request: Request) {
    // Handle Pre-flight / OPTIONS checks inside POST if needed, but the separate OPTIONS export handles it.
    // We strictly need to return CORS headers with the POST response too.

    const supabase = await createClient();

    let formData;
    try {
        formData = await request.formData();
    } catch (e) {
        return NextResponse.json(
            { error: "Invalid form data" },
            { status: 400, headers: corsHeaders }
        );
    }

    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const company = formData.get('company') as string;
    const summary = formData.get('summary') as string;
    const detailsStr = formData.get('details') as string;

    // Convert details string back to JSON
    let details = {};
    try {
        details = JSON.parse(detailsStr);
    } catch (e) {
        console.error("Failed to parse details", e);
    }

    // Handle File Uploads
    const files = formData.getAll('files') as File[];
    const filePaths: string[] = [];

    // Upload user files to Storage
    for (const file of files) {
        if (file && file.size > 0) {
            const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('leads-attachments')
                .upload(fileName, file);

            if (!uploadError && uploadData) {
                filePaths.push(uploadData.path);
            } else {
                console.error("Upload error", uploadError);
            }
        }
    }

    // 1. Insert into DB
    const { data, error } = await supabase
        .from('leads')
        .insert({
            name,
            email,
            company,
            summary,
            details,
            file_paths: filePaths,
            status: 'new'
        })
        .select()
        .single();

    if (error) {
        console.error("DB Insert Error", error);
        return NextResponse.json(
            { error: error.message },
            { status: 500, headers: corsHeaders }
        );
    }

    // 2. Trigger Webhook
    try {
        await fetch('https://n8n.maxwellwarren.dev/webhook-test/76e4d8b0-e9eb-4dad-85e7-115c1d453a99', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                email,
                company,
                summary,
                details,
                lead_id: data.id,
                file_paths: filePaths
            })
        });
    } catch (webhookError) {
        console.error("Webhook trigger failed", webhookError);
        // We don't fail the request if webhook fails, just log it
    }

    return NextResponse.json({ success: true, lead: data }, { headers: corsHeaders });
}

export async function OPTIONS(request: Request) {
    return new NextResponse(null, {
        status: 200,
        headers: corsHeaders,
    });
}
