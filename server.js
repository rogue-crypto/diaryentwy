const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize Google AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint for analysis
app.post('/api/analyze', async (req, res) => {
    try {
        const { text } = req.body;
        
        if (!text || typeof text !== 'string' || text.length > 5000) {
            return res.status(400).json({ error: 'Invalid input' });
        }

        const prompt = `
        Analyze this journal entry comprehensively and provide insights in exactly this format:

        SEVERITY: [High/Medium/Low]
        HEALTH_SCORE: [0-100]
        IDENTIFIED_PROBLEMS: [List all detected issues like anxiety, depression, stress, relationship issues, work stress, substance use, etc. Separate with semicolons]
        PROBLEM_TAGS: [Short 1-2 word tags for each problem, e.g., "Anxiety", "Work Stress", etc. Separate with semicolons]
        RECOMMENDATIONS: [List 4-5 specific, actionable self-help suggestions. Do not recommend professional help. Focus on practical steps, lifestyle changes, and self-improvement activities. Separate with semicolons]

        Journal Entry: "${text}"
        
        Important: Keep recommendations ethical and avoid suggesting professional consultation. Focus on practical self-help strategies.`;

        const result = await model.generateContent(prompt);
        const response = await result.response.text();

        // Parse the response with enhanced error handling
        const analysis = {
            severity: response.match(/SEVERITY: (.*)/)?.[1]?.trim() || 'Medium',
            healthScore: parseInt(response.match(/HEALTH_SCORE: (\d+)/)?.[1]) || 70,
            problems: (response.match(/IDENTIFIED_PROBLEMS: (.*)/)?.[1]?.trim() || '').split(';').map(p => p.trim()),
            problemTags: (response.match(/PROBLEM_TAGS: (.*)/)?.[1]?.trim() || '').split(';').map(t => t.trim()),
            recommendations: (response.match(/RECOMMENDATIONS: (.*)/)?.[1]?.trim() || '').split(';').map(r => r.trim())
        };

        res.json(analysis);

    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({ error: 'Failed to analyze entry' });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
