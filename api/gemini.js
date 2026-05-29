// File: api/gemini.js

export default async function handler(req, res) {
    // 1. Sirf POST requests allow karenge
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // Frontend se jo exam, subject aur chapter aayega usko read karenge
        const { examTarget, subject, chapter } = req.body;

        // Vercel ke environment variables se tumhari chupi hui key nikalenge
        const API_KEY = process.env.GEMINI_API_KEY;

        // Ye wahi prompt hai jo tumne bheja tha
        const prompt = `
        You are an expert Indian examiner for JEE and NEET. 
        Generate 1 multiple-choice question for Exam: ${examTarget}, Subject: ${subject}, Topic: ${chapter}.
        Rule 1: There is an 80% chance the question should be heavily inspired by an actual Previous Year Question (PYQ), and a 20% chance it is a unique conceptual question.
        Rule 2: Provide a detailed, step-by-step explanation for the solution.
        Rule 3: You MUST respond ONLY with a valid JSON object in the exact format below, without any markdown formatting or extra text:

        {
          "question": "The text of the question here",
          "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
          "correct_index": 2, 
          "solution": "Step by step detailed explanation of why the answer is correct."
        }
        `;

        // Gemini API ko secure call
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();
        
        // Gemini ke response se JSON nikalna
        let rawText = data.candidates[0].content.parts[0].text;
        
        // Kabhi kabhi AI ```json ... ``` tags laga deta hai, usko hatane ka logic
        rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const questionData = JSON.parse(rawText);

        // Frontend ko safely data bhej do
        res.status(200).json(questionData);

    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Failed to generate question.' });
    }
}