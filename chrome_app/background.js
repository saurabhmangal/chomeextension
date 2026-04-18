const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE";
const MODEL_NAME = "gemini-2.5-flash";

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "summarizeWithGemini") {
        summarizeContent(request.text)
            .then(summary => sendResponse({ summary }))
            .catch(error => sendResponse({ error: error.message }));
        return true; // Keep channel open for async response
    }
});

async function summarizeContent(text) {
    // Use v1 instead of v1beta for better stability
    const url = `https://generativelanguage.googleapis.com/v1/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;
    
    console.log("Calling Gemini API with model:", MODEL_NAME);

    const prompt = `Summarize the following web page content in a concise way. 
    Focus on the main value proposition. 
    Keep it under 150 words. 
    
    Content:
    ${text.substring(0, 5000)}`; // Truncate to avoid too large payload

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Gemini API Error:", errorData);
            throw new Error(`API Error ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        
        if (!data.candidates || data.candidates.length === 0) {
            throw new Error("No response candidates returned from Gemini.");
        }

        return data.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error("Fetch Error:", error);
        throw error;
    }
}
