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

// Serve index.html for the root route
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
        Analyze this journal entry and provide insights in exactly this format:
        SEVERITY: [High/Medium/Low]
        HEALTH_SCORE: [0-100]
        PROBLEMS: [List 2-3 key issues identified, separated by semicolons]
        RECOMMENDATIONS: [2-3 practical steps to improve, separated by semicolons]

        Journal Entry: "${text}"`;

        const result = await model.generateContent(prompt);
        const response = await result.response.text();

        // Parse the response
        const analysis = {
            severity: response.match(/SEVERITY: (.*)/)?.[1]?.trim() || 'N/A',
            healthScore: parseInt(response.match(/HEALTH_SCORE: (\d+)/)?.[1]) || 0,
            problems: (response.match(/PROBLEMS: (.*)/)?.[1]?.trim() || '').split(';').map(p => p.trim()),
            recommendations: (response.match(/RECOMMENDATIONS: (.*)/)?.[1]?.trim() || '').split(';').map(r => r.trim())
        };

        res.json(analysis);

    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({ error: 'Failed to analyze entry' });
    }
});

// Handle 404 errors
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
