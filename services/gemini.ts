import { GoogleGenerativeAI } from "@google/generative-ai";

export async function generateAIImage(prompt: string): Promise<string> {

    // Ambil API key user ONLY
    const apiKey = localStorage.getItem("user_gemini_api_key");

    if (!apiKey || apiKey.trim() === "") {
        throw new Error("API Key belum diatur. Silakan masukkan API Key Anda.");
    }

    // Gunakan API key user
    const genAI = new GoogleGenerativeAI(apiKey);

    try {
        // Model image-capable
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
        });

        const result = await model.generateContent(prompt);
        const response = result.response;

        // Cari base64 image
        for (const candidate of response.candidates || []) {
            for (const part of candidate.content.parts || []) {
                if (part.inlineData && part.inlineData.data) {
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
        }

        throw new Error("Gambar tidak ditemukan dari response.");
    } catch (err) {
        console.error("Gemini Error:", err);
        throw err;
    }
}
