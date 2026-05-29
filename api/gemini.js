export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { examTarget, subject, chapter } = req.body;
        const API_KEY = process.env.GEMINI_API_KEY;

        // Check 1: Kya Vercel me API Key daali gai hai?
        if (!API_KEY) {
            console.error("Error: GEMINI_API_KEY is missing in Vercel Environment Variables!");
            return res.status(500).json({ error: 'Server configuration missing API Key.' });
        }

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

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();

        // Check 2: Kya Gemini ne error bheja hai? (Jaise invalid API key)
        if (data.error) {
            console.error("Gemini API Error Detected:", data.error.message);
            return res.status(500).json({ error: 'Gemini API rejected the request', details: data.error.message });
        }

        // Check 3: Kya response ka structure waisa hi hai jaisa humein chahiye?
        if (!data.candidates || !data.candidates[0].content) {
            console.error("Unexpected Gemini response structure:", data);
            return res.status(500).json({ error: 'Invalid response from Gemini', details: data });
        }
        
        let rawText = data.candidates[0].content.parts[0].text;
        rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const questionData = JSON.parse(rawText);
        res.status(200).json(questionData);

    } catch (error) {
        // TypeError ya JSON Parse error aayega toh yahan pakda jayega
        console.error('Catch Block Error:', error.message);
        res.status(500).json({ error: 'Failed to generate question.', details: error.message });
    }
}