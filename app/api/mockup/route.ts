import { NextResponse } from 'next/server';
import { GoogleGenAI } from "@google/genai";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function POST(request: Request) {
    try {
        const { prompt, imageBase64, aspectRatio, mimeType } = await request.json();

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json(
                { error: "Server Configuration Error: Missing API Key" },
                { status: 500, headers: corsHeaders }
            );
        }

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp', // Using the experimental model for better image generation capabilities if available, or fallback to standard
            contents: [
                {
                    parts: [
                        { text: prompt },
                        {
                            inlineData: {
                                mimeType: mimeType || 'image/png',
                                data: imageBase64
                            }
                        }
                    ]
                }
            ],
            config: {
                // @ts-ignore - imageConfig is valid for some models but might not be in the strict types yet
                imageConfig: {
                    aspectRatio: aspectRatio || '1:1'
                }
            }
        });

        let generatedImage = null;
        if (response.candidates && response.candidates[0].content.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    generatedImage = `data:image/png;base64,${part.inlineData.data}`;
                    break;
                }
            }
        }

        if (!generatedImage) {
            return NextResponse.json(
                { error: "Failed to generate image" },
                { status: 500, headers: corsHeaders }
            );
        }

        return NextResponse.json({ success: true, image: generatedImage }, { headers: corsHeaders });

    } catch (e: any) {
        console.error("Mockup Generation Error:", e);
        return NextResponse.json(
            { error: e.message || "Internal Server Error" },
            { status: 500, headers: corsHeaders }
        );
    }
}

export async function OPTIONS(request: Request) {
    return new NextResponse(null, {
        status: 200,
        headers: corsHeaders,
    });
}
