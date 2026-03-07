/**
 * AI Module
 * Handles direct REST API calls to Google's Gemini 2.5 Flash model
 */

class AIManager {
    constructor() {
        this.endpoint = '/api/gemini';
    }

    isReady() {
        // Now running through Vercel serverless function
        return true;
    }

    async generateContent(prompt, context) {
        const fullPrompt = `${prompt}\n\nContext:\n${context}`;

        const response = await fetch(this.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: fullPrompt }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 1024,
                }
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || 'Failed to generate content');
        }

        const data = await response.json();
        if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
            return data.candidates[0].content.parts[0].text;
        }

        throw new Error('Unexpected response format from Gemini');
    }
}

// Global instance
window.aiManager = new AIManager();
