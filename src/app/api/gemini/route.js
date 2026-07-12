// src/app/api/gemini/route.js
import { NextResponse } from 'next/server';

export async function POST(req) {
    try {
        const { examTarget, subject, chapter } = await req.json();

        // Tumhari Gemini API Key (isko hum environment variable me rakhenge)
        const apiKey = process.env.GEMINI_API_KEY; 

        if (!apiKey) {
            return NextResponse.json({ error: "Gemini API key missing" }, { status: 500 });
        }

        // Strict prompt taaki Gemini hamesha JSON format me hi answer de
        const prompt = `Act as an expert examiner for ${examTarget}. Generate ONE multiple-choice question for the subject ${subject}, specifically from the topic/chapter: "${chapter}". 
        The difficulty should match the ${examTarget} exam level.
        You MUST return the response ONLY as a raw JSON object. Do not use markdown blocks like \`\`\`json.
        Format:
        {
          "question": "Question text here (use MathJax $...$ for equations if needed)",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correct_index": 0,
          "solution": "Detailed step-by-step explanation here"
        }`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { response_mime_type: "application/json" }
            })
        });

        const data = await response.json();
        
        if (!response.ok || !data.candidates) {
            throw new Error("Failed to fetch from Google Gemini");
        }

        const rawText = data.candidates[0].content.parts[0].text;
        
        //  FIX: Safety net for AI's unpredictable JSON formatting
        try {
            // Agar Gemini ne markdown tags bhej diye, toh unko clean karna
            const cleanText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
            const qData = JSON.parse(cleanText);
            return NextResponse.json(qData);
        } catch (parseError) {
            console.error("Gemini JSON Parse Error:", parseError, "Raw Output:", rawText);
            return NextResponse.json({ error: "AI generated invalid format. Please try again." }, { status: 500 });
        }
        
    } catch (error) {
        console.error("Gemini API Error:", error);
        return NextResponse.json({ error: "High Traffic or API Error" }, { status: 503 });
    }
}