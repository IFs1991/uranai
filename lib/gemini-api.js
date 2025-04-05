const { GoogleGenerativeAI } = require("@google/generative-ai");

let genAI;

/**
 * Initializes the Google Generative AI client.
 * Ensures only one instance is created (singleton pattern).
 */
function initializeGemini() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("Error: GEMINI_API_KEY environment variable is not set.");
      // Consider throwing an error or returning a specific status
      // depending on how you want to handle missing API keys
      return;
    }
    genAI = new GoogleGenerativeAI(apiKey);
    console.log("Gemini AI client initialized.");
  }
}

/**
 * Implements exponential backoff for retrying failed operations.
 *
 * @param {Function} fn The function to retry.
 * @param {number} maxRetries Maximum number of retries.
 * @param {number} delay Initial delay in milliseconds.
 * @returns {Promise<any>} The result of the function call.
 */
async function retryWithBackoff(fn, maxRetries = 3, delay = 1000) {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      console.warn(`Attempt ${attempt} failed. Retrying in ${delay}ms... Error: ${error.message}`);
      if (attempt >= maxRetries) {
        console.error("Max retries reached. Operation failed.");
        throw error; // Re-throw the error after max retries
      }
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
}

/**
 * Generates a response from the Gemini API using the specified model.
 * Includes error handling and basic response parsing.
 *
 * @param {string} prompt The prompt to send to the Gemini API.
 * @param {string} modelName The model name to use (defaults to gemini-2.0-flash-001).
 * @returns {Promise<string>} The generated text response.
 */
async function generateGeminiResponse(prompt, modelName = "gemini-2.0-flash-001") {
  initializeGemini(); // Ensure client is initialized
  if (!genAI) {
    throw new Error("Gemini client not initialized. Check API Key.");
  }

  try {
    console.log(`Generating response with model: ${modelName}`);
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    console.log("Gemini API response received.");
    // Basic parsing (assuming JSON might be embedded or just text)
    try {
        // Attempt to parse as JSON if it looks like it
        if (text.trim().startsWith('{') && text.trim().endsWith('}')) {
            return JSON.parse(text);
        }
    } catch (parseError) {
        console.warn("Response is not valid JSON, returning as text.", parseError.message);
    }
    return text; // Return raw text if not JSON or parsing fails
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw error; // Re-throw for retryWithBackoff or higher-level handling
  }
}


/**
 * Generates daily horoscopes for a given period.
 * (Placeholder - Requires specific prompt engineering)
 *
 * @param {object} astrologyData Data from astrology.js.
 * @param {object} fourPillarsData Data from four-pillars.js.
 * @param {number} days Number of days to generate for.
 * @returns {Promise<object[]>} Array of daily horoscope objects.
 */
async function generateDailyHoroscopes(astrologyData, fourPillarsData, days = 365) {
    // Placeholder: Needs detailed prompt construction based on input data
    console.log(`Generating ${days} daily horoscopes...`);
    const prompts = []; // Array to hold prompts for each day or batches
    // Example: Create prompts for each day (inefficient for 365 days)
    // Or create batched prompts (e.g., weekly or monthly)
    // for (let i = 0; i < days; i++) {
    //   const date = ... // Calculate date
    //   const prompt = `Generate a daily horoscope for ${date} based on: ${JSON.stringify(astrologyData)}, ${JSON.stringify(fourPillarsData)}`;
    //   prompts.push(generateGeminiResponse(prompt));
    // }
    // This is a simplified example. Real implementation would need
    // sophisticated prompt engineering and likely batching.
    const prompt = `Generate ${days} days of summarized daily horoscopes starting from today, based on this astrological data: ${JSON.stringify(astrologyData)} and Four Pillars data: ${JSON.stringify(fourPillarsData)}. Provide output as a JSON array of objects, each with 'date' and 'horoscope' keys.`;

    try {
        const results = await retryWithBackoff(() => generateGeminiResponse(prompt));
        // Assuming the API returns a parsable structure based on the prompt
        if (Array.isArray(results)) {
             console.log(`Generated ${results.length} daily horoscopes.`);
             return results;
        } else {
             console.error("Failed to parse daily horoscopes response.");
             // Attempt to generate fallback
             return generateFallbackHoroscopes(days);
        }

    } catch (error) {
      console.error("Error generating daily horoscopes:", error);
      return generateFallbackHoroscopes(days); // Generate fallback on error
    }
}


/**
 * Generates a comprehensive reading text for the PDF report.
 * (Placeholder - Requires specific prompt engineering)
 *
 * @param {object} astrologyData Data from astrology.js.
 * @param {object} fourPillarsData Data from four-pillars.js.
 * @param {string} specificQuestion User's specific question (optional).
 * @returns {Promise<string>} The comprehensive reading text.
 */
async function generateComprehensiveReading(astrologyData, fourPillarsData, specificQuestion = "") {
    // Placeholder: Needs detailed prompt construction
    console.log("Generating comprehensive reading...");
    let prompt = `
    Generate a comprehensive astrological and Four Pillars reading based on the following data:
    Astrology: ${JSON.stringify(astrologyData)}
    Four Pillars: ${JSON.stringify(fourPillarsData)}

    Structure the reading into these sections:
    I. Core Energy and Personality
    II. Talents and Life Themes
    III. Life Path Flow and Growth Timing
    `;

    if (specificQuestion) {
        prompt += `
IV. Answer to the Specific Question: "${specificQuestion}"`;
    }
    prompt += `
V. Advice and Summary`;

    prompt += `
 Ensure the language is insightful, supportive, and easy to understand. Format the output clearly.`;

    try {
        const reading = await retryWithBackoff(() => generateGeminiResponse(prompt));
        console.log("Comprehensive reading generated.");
        return reading; // Expecting a string response
    } catch (error) {
      console.error("Error generating comprehensive reading:", error);
      return "鑑定文の生成中にエラーが発生しました。しばらくしてから再試行してください。"; // Fallback text
    }
}

/**
 * Generates fallback generic horoscopes if the main generation fails.
 *
 * @param {number} days Number of days to generate fallback for.
 * @returns {Promise<object[]>} Array of generic daily horoscope objects.
 */
async function generateFallbackHoroscopes(days = 365) {
    console.warn("Generating fallback horoscopes...");
    // In a real scenario, you might call the API with a simpler, generic prompt
    // or return pre-defined generic messages.
    // This example returns static data.
    const fallbackData = [];
    const today = new Date();
    for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        fallbackData.push({
            date: date.toISOString().split('T')[0],
            horoscope: "今日は穏やかな一日でしょう。新しい発見があるかもしれません。" // Generic fallback message
        });
    }
     console.log(`Generated ${fallbackData.length} fallback daily entries.`);
    return fallbackData;
}


module.exports = {
  initializeGemini,
  retryWithBackoff,
  generateGeminiResponse,
  generateDailyHoroscopes,
  generateComprehensiveReading,
  generateFallbackHoroscopes,
};