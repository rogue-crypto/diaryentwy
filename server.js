const express = require('express');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

// Initialize express app
const app = express();
const port = process.env.PORT || 3000;

// Initialize Google AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "fonts.gstatic.com", "cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'"],
        },
    },
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});

// Middleware
app.use(cors());
app.use(compression());
app.use(morgan('dev')); // Logging
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/', limiter);

// Error handling middleware
const errorHandler = (err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Something went wrong!',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
};

// Input validation middleware
const validateJournalInput = (req, res, next) => {
    const { text } = req.body;
    if (!text || typeof text !== 'string' || text.length > 5000) {
        return res.status(400).json({
            error: 'Invalid input',
            message: 'Journal entry must be a string between 1 and 5000 characters'
        });
    }
    next();
};

// Analyze journal entry
app.post('/api/analyze', validateJournalInput, async (req, res) => {
    try {
        const { text } = req.body;

        // Structured prompt for consistent analysis
        const prompt = `
        Analyze this journal entry as a professional therapist and provide structured insights. 
        Break down your analysis into these specific sections:

        1. Mental State (respond with just one of these options: Excellent, Good, Fair, Needs Attention, Concerning)
        2. Healthy Thinking Score (provide just a number from 0-100)
        3. Emotional Analysis (2-3 sentences about their emotional state)
        4. Thought Patterns (2-3 sentences about their thinking patterns)
        5. Therapist Insights (2-3 key recommendations)

        Journal Entry: "${text}"

        Format your response exactly like this:
        MENTAL_STATE: [state]
        HEALTHY_THINKING_SCORE: [score]
        EMOTIONAL_ANALYSIS: [analysis]
        THOUGHT_PATTERNS: [patterns]
        THERAPIST_INSIGHTS: [insights]`;

        const result = await model.generateContent(prompt);
        const response = await result.response.text();

        // Parse the response using regex
        const analysis = {
            mentalState: response.match(/MENTAL_STATE: (.*)/)?.[1]?.trim() || 'N/A',
            healthyThinkingScore: parseInt(response.match(/HEALTHY_THINKING_SCORE: (\d+)/)?.[1]) || 0,
            emotionalAnalysis: response.match(/EMOTIONAL_ANALYSIS: (.*)/)?.[1]?.trim() || 'N/A',
            thoughtPatterns: response.match(/THOUGHT_PATTERNS: (.*)/)?.[1]?.trim() || 'N/A',
            therapistInsights: response.match(/THERAPIST_INSIGHTS: (.*)/)?.[1]?.trim() || 'N/A'
        };

        // Validate the analysis results
        for (const [key, value] of Object.entries(analysis)) {
            if (value === 'N/A' && key !== 'mentalState') {
                throw new Error(`Failed to extract ${key} from AI response`);
            }
        }

        // Cache the result for 1 hour (optional)
        res.set('Cache-Control', 'private, max-age=3600');
        
        res.json(analysis);

    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({
            error: 'Failed to analyze entry',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve the main application
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use(errorHandler);

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port} in ${process.env.NODE_ENV || 'development'} mode`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received. Closing server...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
