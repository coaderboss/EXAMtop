// src/app/api/gemini/route.js
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { examTarget, subject, chapter } = await req.json();

    // Tumhari Gemini API Key (isko hum environment variable me rakhenge)
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API key missing" },
        { status: 500 },
      );
    }

    // Strict prompt taaki Gemini hamesha JSON format me hi answer de aur MathJax ka dhyan rakhe
    const prompt = `Act as an elite test-setter for ${examTarget}. Generate ONE high-quality multiple-choice question for the subject ${subject}, specifically from the topic: "${chapter}".
        The difficulty MUST strictly match the ${examTarget} competitive exam level.
        You MUST return the response ONLY as a valid, raw JSON object. DO NOT wrap the response in markdown blocks (like \`\`\`json).
        Use standard MathJax/LaTeX formatting (wrap equations in $ or $$) for any mathematical or scientific formulas in both the question and options.
        Format:
        {
          "question": "Clear question text here (with $MathJax$ if needed)",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correct_index": 0,
          "solution": "Detailed, step-by-step solution explaining the underlying concept."
        }`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { response_mime_type: "application/json" },
        }),
      },
    );

    const data = await response.json();

    if (!response.ok || !data.candidates) {
      throw new Error("Failed to fetch from Google Gemini");
    }

    const rawText = data.candidates[0].content.parts[0].text;

    //  FIX: Safety net for AI's unpredictable JSON formatting
    try {
      // Agar Gemini ne markdown tags bhej diye, toh unko clean karna
      const cleanText = rawText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      const qData = JSON.parse(cleanText);
      return NextResponse.json(qData);
    } catch (parseError) {
      console.error(
        "Gemini JSON Parse Error:",
        parseError,
        "Raw Output:",
        rawText,
      );
      return NextResponse.json(
        { error: "AI generated invalid format. Please try again." },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Gemini API Error:", error);
    return NextResponse.json(
      { error: "High Traffic or API Error" },
      { status: 503 },
    );
  }
}
