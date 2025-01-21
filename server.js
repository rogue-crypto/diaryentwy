const express = require('express');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize Google AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// API endpoint for diary analysis
app.post('/api/analyze', async (req, res) => {
    try {
        const { text } = req.body;
        const prompt = `Analyze the following diary entry and provide personalized advice on personal growth and healthier habits: "${text}". Do not say anything like consult a professional, act as a therapist and give healthy and ethical tips to users after listening to their stories`;
        
        const result = await model.generateContent(prompt);
        const response = await result.response.text();
        
        res.json({ analysis: response });
    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({ error: 'Failed to analyze entry' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
