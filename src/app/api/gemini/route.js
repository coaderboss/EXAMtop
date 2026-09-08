import { NextResponse } from "next/server";
import { adminAuth } from "../../../lib/firebaseAdmin"; // Ensure admin Auth is imported

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    // 🛡️ SECURITY LAYER 1: Strictly Require Firebase Auth Token
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.warn("🚨 Blocked unauthorized AI request.");
      return NextResponse.json(
        { error: "Unauthorized access blocked" },
        { status: 401 },
      );
    }

    const idToken = authHeader.split("Bearer ")[1];
    try {
      // 🛡️ SECURITY LAYER 2: Verify Token Cryptographically
      await adminAuth.verifyIdToken(idToken);
    } catch (authError) {
      console.error("Token verification failed:", authError);
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 403 },
      );
    }

    const { examTarget, subject, chapter } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API key missing" },
        { status: 500 },
      );
    }

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

    try {
      const cleanText = rawText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      const qData = JSON.parse(cleanText);
      return NextResponse.json(qData);
    } catch (parseError) {
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
