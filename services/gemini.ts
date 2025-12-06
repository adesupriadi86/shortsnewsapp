import { GoogleGenAI } from "@google/genai";

export async function generateAIImage(prompt: string): Promise<string> {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        throw new Error("API Key is not configured in environment variables.");
    }

    try {
        const ai = new GoogleGenAI({ apiKey });

        // Using generateContent with gemini-2.5-flash-image for standard generation
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { text: prompt }
                ]
            },
            config: {}
        });

        // Search for image part
        for (const candidate of response.candidates || []) {
            if (candidate.content && candidate.content.parts) {
                for (const part of candidate.content.parts) {
                    if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
                        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    }
                }
            }
        }
        
        throw new Error("No image generated.");
    } catch (error) {
        console.error("Gemini Image Gen Error:", error);
        throw error;
    }
}