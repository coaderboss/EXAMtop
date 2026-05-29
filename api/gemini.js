export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { examTarget, subject, chapter } = req.body;
        const API_KEY = process.env.GEMINI_API_KEY;

        if (!API_KEY) {
            console.error("Missing API Key");
            return res.status(500).json({ error: 'API Key missing in Vercel' });
        }

        const prompt = `
        You are an expert Indian examiner for JEE and NEET. 
        Generate 1 multiple-choice question for Exam: ${examTarget}, Subject: ${subject}, Topic: ${chapter}.
        Rule 1: Provide a detailed, step-by-step explanation for the solution.
        Rule 2: You MUST respond ONLY with a valid JSON object in the exact format below, without any markdown formatting:
        {
          "question": "The text of the question here",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correct_index": 2, 
          "solution": "Step by step detailed explanation"
        }
        `;

        // THE BULLETPROOF UNIVERSAL MODEL: gemini-pro
       const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
    })
});

        const data = await response.json();

        if (data.error) {
            console.error("Gemini API Error:", data.error.message);
            return res.status(500).json({ error: data.error.message });
        }

        let rawText = data.candidates[0].content.parts[0].text;
        rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const questionData = JSON.parse(rawText);
        res.status(200).json(questionData);

    } catch (error) {
        console.error('Catch Error:', error.message);
        res.status(500).json({ error: 'Failed to generate question.' });
    }
}