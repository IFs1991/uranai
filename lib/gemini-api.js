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
 * Generates daily horoscopes for a given period by fetching monthly batches in parallel.
 *
 * @param {object} astrologyData Data from astrology.js.
 * @param {object} fourPillarsData Data from four-pillars.js.
 * @param {number} days Number of days to generate for (approximate, generates full months).
 * @returns {Promise<object[]>} Array of daily horoscope objects.
 */
async function generateDailyHoroscopes(astrologyData, fourPillarsData, days = 365) {
    console.log(`Generating approximately ${days} daily horoscopes by fetching monthly batches...`);
    const today = new Date();
    const targetEndDate = new Date(today);
    targetEndDate.setDate(today.getDate() + days);

    const monthPromises = [];
    let currentDate = new Date(today);

    // Generate prompts for each month within the period
    while (currentDate <= targetEndDate) {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth(); // 0-indexed
        const monthName = currentDate.toLocaleString('ja-JP', { month: 'long' }); // 日本語の月名
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month, daysInMonth);

        // Construct a prompt for this specific month
        const prompt = `
以下の占星術データと四柱推命データに基づき、${year}年${monthName} (${startDate.toISOString().split('T')[0]} から ${endDate.toISOString().split('T')[0]} まで) の日別占いエントリを生成してください。
占星術データ: ${JSON.stringify(astrologyData)}
四柱推命データ: ${JSON.stringify(fourPillarsData)}
出力は、各オブジェクトが 'date' (YYYY-MM-DD形式)、'luckLevel' (0から100の数値)、'dailyFortune' (文字列)、および任意で 'monthSummary' (文字列、その月の全ての日で同じ内容) を持つJSON配列としてください。
日別エントリ例: {"date": "YYYY-MM-DD", "luckLevel": 75, "dailyFortune": "幸運な出来事がありそうです。", "monthSummary": "全体的に活動的な月です。"}
`;
        // Use retryWithBackoff for each monthly request
        monthPromises.push(
            retryWithBackoff(() => generateGeminiResponse(prompt))
                .then(result => {
                     // APIからの応答が期待通りの配列か確認し、そうでなければ空配列を返す
                     if (Array.isArray(result)) {
                         // 各エントリの日付形式を検証・修正 (もし必要なら)
                         return result.map(entry => ({
                             ...entry,
                             // 必要であれば日付形式のバリデーションを追加
                             date: entry.date && typeof entry.date === 'string' ? entry.date.split('T')[0] : new Date().toISOString().split('T')[0] // 不正な日付の場合のフォールバック
                         }));
                     } else {
                         console.warn(`Invalid response format for ${year}-${month + 1}. Expected array, got:`, typeof result);
                         return []; // 不正な形式の場合は空配列
                     }
                })
                .catch(error => {
                    // Handle individual month failure: log error and return an empty array
                    console.error(`Error generating horoscope for ${year}-${month + 1}: ${error.message}`);
                    // Return an empty array for this month to avoid breaking Promise.all
                    return [];
                })
        );

        // Move to the next month
        currentDate.setMonth(currentDate.getMonth() + 1);
        currentDate.setDate(1); // Start from the 1st of the next month
    }

    try {
        // Execute all monthly requests in parallel
        console.log(`Sending ${monthPromises.length} monthly horoscope requests in parallel...`);
        const monthlyResults = await Promise.all(monthPromises);
        console.log("Received responses for all monthly requests.");

        // Flatten the results (array of arrays) into a single array
        let allHoroscopes = monthlyResults.flat();

        // Filter out any potential null/undefined entries from failed requests returning non-arrays handled above
        allHoroscopes = allHoroscopes.filter(entry => entry && typeof entry === 'object' && entry.date);

        // Sort by date just in case the parallel execution messes up the order
        allHoroscopes.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Optionally truncate to the exact number of days if required, though often unnecessary
        // We aim to get at least `days` worth, starting from today.
        const finalHoroscopes = allHoroscopes.filter(entry => new Date(entry.date) >= today);
        // finalHoroscopes = finalHoroscopes.slice(0, days); // Uncomment if strict day count is needed


        console.log(`Successfully generated and processed ${finalHoroscopes.length} daily horoscope entries.`);

        // Handle case where all requests failed or returned empty
        if (finalHoroscopes.length === 0) {
            console.warn("All monthly horoscope generations failed or returned empty/invalid data. Generating fallback.");
            return generateFallbackHoroscopes(days);
        }

        return finalHoroscopes;

    } catch (error) { // Catch errors during Promise.all or processing
        console.error("Critical error during parallel horoscope generation or processing:", error);
        return generateFallbackHoroscopes(days); // Generate fallback on major error
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