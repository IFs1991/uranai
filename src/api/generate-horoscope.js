// Vercel Serverless Function for horoscope generation
import { generateGeminiResponse, retryWithBackoff } from '../lib/gemini-api.js';
import { generateHoroscopeChart } from '../lib/astrology.js';
import FourPillars from '../lib/four-pillars.js';

// *** セキュリティと信頼性に関する考慮事項 ***
// 1. レートリミット: 不正な大量リクエストを防ぐため、Vercelの組み込み機能や外部サービス(Cloudflareなど)で
//    IPアドレスやユーザー単位のレートリミットを適用することを強く推奨します。
// 2. 入力検証: より厳密な入力検証を行うことで、不正なデータによるエラーや攻撃を防ぎます。
// 3. 冪等性: ネットワークエラーによるリトライで意図せず複数回のリクエストが処理されないよう、冪等キーを用いた処理を実装します。
// 4. APIキー管理: gemini-api.js で環境変数を使用していることを確認。

// 冪等性キーと処理結果を保持する（インメモリ、有効期限付き）
// 注意: サーバーレス環境ではインメモリ保持は限定的。本番環境ではRedisなどの外部ストア推奨。
const processedHoroscopeRequests = new Map();
const IDEMPOTENCY_KEY_TTL = 1000 * 60 * 60; // 1時間 (キャッシュTTLと同じ)

/**
 * YYYY-MM-DD形式の日付文字列を検証し、Dateオブジェクトを返す (UTC基準)
 * @param {string} dateString
 * @returns {Date|null} 有効な場合はDateオブジェクト、無効な場合はnull
 */
const parseAndValidateDate = (dateString) => {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(dateString)) return null;
  const [year, month, day] = dateString.split('-').map(Number);
  // UTCでDateオブジェクトを作成し、入力と一致するか確認
  const date = new Date(Date.UTC(year, month - 1, day)); // 月は0-11
  if (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  ) {
    // 未来の日付でないかチェック (今日まで許可)
    const today = new Date();
    const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    if (date <= todayUTC) {
      return date; // Dateオブジェクトには時刻情報が含まれない（00:00:00 UTC）
    }
  }
  return null;
};

/**
 * HH:MM形式の時刻文字列を検証する
 * @param {string} timeString
 * @returns {boolean} 有効な場合はtrue, 無効な場合はfalse
 */
const isValidTime = (timeString) => {
  if (!/^\\d{2}:\\d{2}$/.test(timeString)) return false;
  const [hour, minute] = timeString.split(':').map(Number);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // --- レートリミットに関するコメント ---
  // ここにレートリミットのチェックロジックが入ることを想定（外部サービス等を利用）

  let idempotencyKey = null; // スコープをtry/catchの外に

  try {
    const { name, birthDate, birthTime, birthPlace, specificQuestion, idempotencyKey: reqIdempotencyKey } = req.body;
    idempotencyKey = reqIdempotencyKey; // finallyブロックで使えるように

    // --- 冪等性キー検証 ---
    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
      return res.status(400).json({ error: '冪等キーが必要です' });
    }

    // --- 冪等性チェック ---
    const now = Date.now();
    if (processedHoroscopeRequests.has(idempotencyKey)) {
        const { timestamp, result, statusCode } = processedHoroscopeRequests.get(idempotencyKey);
        if (now - timestamp < IDEMPOTENCY_KEY_TTL) {
            console.log(`Idempotency key ${idempotencyKey} already processed. Returning cached result.`);
            return res.status(statusCode).json({
                ...result,
                isIdempotentResponse: true,
                message: statusCode === 200 ? 'このリクエストは既に処理されています。' : 'このリクエストは既にエラーとして処理されています。'
            });
        } else {
            // TTL切れのキーは削除
            processedHoroscopeRequests.delete(idempotencyKey);
        }
    }

    // --- 入力検証強化 ---
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: '名前は必須です' });
    }
    const parsedBirthDate = parseAndValidateDate(birthDate);
    if (!parsedBirthDate) {
        return res.status(400).json({ error: '無効な生年月日形式または未来の日付です (YYYY-MM-DD)' });
    }
    if (!birthTime || !isValidTime(birthTime)) {
        return res.status(400).json({ error: '無効な出生時刻形式です (HH:MM)' });
    }
    if (!birthPlace || typeof birthPlace !== 'string' || birthPlace.trim() === '') {
        return res.status(400).json({ error: '出生地は必須です' });
    }
    if (specificQuestion !== undefined && specificQuestion !== null && (typeof specificQuestion !== 'string' || specificQuestion.trim() === '')) {
        return res.status(400).json({ error: '具体的な質問は空でない文字列である必要があります' });
    }

    // --- Input Parsing and Data Calculation ---
    // Ensure birthDate and birthTime are correctly parsed into a Date object
    // Assuming birthDate is YYYY-MM-DD and birthTime is HH:MM
    const [hour, minute] = birthTime.split(':').map(Number);
    // Dateオブジェクトに時刻をUTCで設定
    const birthDateTime = new Date(parsedBirthDate.getTime()); // 日付のみのDateをコピー
    birthDateTime.setUTCHours(hour, minute, 0, 0); // 時刻を設定

    // Placeholder for latitude/longitude - In a real app, get this from birthPlace
    // This might involve a Geocoding API call
    const latitude = 35.6895; // Example: Tokyo Latitude
    const longitude = 139.6917; // Example: Tokyo Longitude

    // Run calculations in parallel
    console.log("Calculating Astrology and Four Pillars data...");
    const [westernData, fourPillarsInstance] = await Promise.all([
      // Use the correct function from astrology.js
      generateHoroscopeChart(birthDateTime, latitude, longitude),
      // Instantiate the FourPillars class
      new FourPillars(birthDateTime) // Pass the Date object
    ]);
    // Get the full chart data from the FourPillars instance
    const fourPillarsData = fourPillarsInstance.getFullChart();
    console.log("Calculation complete.");

    // Prepare data for Gemini API (adjust based on actual structures)
    const horoscopeDataForPrompt = {
        name,
        birthInfo: { date: birthDate, time: birthTime, place: birthPlace },
        // Extract relevant data for the prompt - adjust based on generateHoroscopeChart and getFullChart results
        western: {
            sunSign: westernData.sunSign?.name, // Use optional chaining
            moonSign: westernData.moonSign?.name,
            ascendant: westernData.ascendant?.name,
            keyPlanets: westernData.planetPositions?.slice(0, 5).map(p => `${p.planet.name} in ${p.sign.name}`) || [], // Example: Top 5 planets
            // Add more relevant western data if needed for the prompt
        },
        fourPillars: {
            dayMaster: fourPillarsData.dayMaster,
            pillars: [ // Combine stem and branch for each pillar
                fourPillarsData.yearPillar.stem + fourPillarsData.yearPillar.branch,
                fourPillarsData.monthPillar.stem + fourPillarsData.monthPillar.branch,
                fourPillarsData.dayPillar.stem + fourPillarsData.dayPillar.branch,
                fourPillarsData.hourPillar.stem + fourPillarsData.hourPillar.branch,
            ],
            elementBalance: fourPillarsData.fiveElementsBalance, // Use the balance from the instance
            // Add more relevant four pillars data if needed
        },
        specificQuestion: specificQuestion || null
    };

    // Generate base horoscope response using retryWithBackoff
    console.log("Generating base horoscope reading via Gemini...");
    const basePrompt = createBasePrompt(horoscopeDataForPrompt);
    const baseResponse = await retryWithBackoff(() =>
      generateGeminiResponse(basePrompt), 3);
    console.log("Base reading generated.");

    // Process specific question if provided
    let questionResponse = null;
    if (specificQuestion) {
      console.log("Generating specific question response via Gemini...");
      const questionPrompt = createSpecificQuestionPrompt(
        specificQuestion,
        horoscopeDataForPrompt.western, // Pass the prepared data
        horoscopeDataForPrompt.fourPillars // Pass the prepared data
      );
      questionResponse = await retryWithBackoff(() =>
        generateGeminiResponse(questionPrompt), 3);
       console.log("Specific question response generated.");
    }

    // --- Combine and structure the final response ---
    const finalResponse = {
      summary: {
        name,
        birthDate,
        birthTime,
        birthPlace
      },
      // Include more detailed, structured data from the calculations
      westernAstrology: {
        sunSign: westernData.sunSign, // Keep the full object
        moonSign: westernData.moonSign, // Keep the full object
        ascendant: westernData.ascendant, // Keep the full object
        // Consider including planet positions, houses, aspects if needed by the frontend
        planetPositions: westernData.planetPositions,
        houses: westernData.houses,
        aspects: westernData.aspects
      },
      fourPillars: {
        dayMaster: fourPillarsData.dayMaster,
        dayMasterElement: fourPillarsData.dayMasterElement,
        pillars: { // More structured pillar data
            year: fourPillarsData.yearPillar,
            month: fourPillarsData.monthPillar,
            day: fourPillarsData.dayPillar,
            hour: fourPillarsData.hourPillar
        },
        elementBalance: fourPillarsData.fiveElementsBalance,
        transformations: fourPillarsData.transformations, // Include transformations
        majorFortunes: fourPillarsData.majorFortunes // Include major fortunes
      },
      // Readings from Gemini
      baseReading: structureBaseReading(baseResponse),
      specificReading: questionResponse ? structureSpecificReading(questionResponse, specificQuestion) : null,
      timestamp: new Date().toISOString()
    };

    // Cache the result using idempotency key
    processedHoroscopeRequests.set(idempotencyKey, {
      result: finalResponse,
      timestamp: Date.now(),
      statusCode: 200
    });
    console.log(`Response cached for idempotency key: ${idempotencyKey}`);

    // Manage cache size (simple FIFO-like removal)
    if (processedHoroscopeRequests.size > 100) { // Limit cache size
      const oldestKey = [...processedHoroscopeRequests.keys()][0];
      processedHoroscopeRequests.delete(oldestKey);
       console.log(`Removed oldest cache entry by key: ${oldestKey}`);
    }

    return res.status(200).json(finalResponse);

  } catch (error) {
    console.error('Horoscope generation error:', error);
    console.error(error.stack);

    const errorResponse = {
      error: '占い結果の生成中にエラーが発生しました。しばらく経ってからもう一度お試しください。',
      details: process.env.NODE_ENV === 'development' ? error.message + (error.stack ? `\nStack: ${error.stack}` : '') : undefined
    };

    // Cache the error result using idempotency key if available
    if (idempotencyKey) {
        processedHoroscopeRequests.set(idempotencyKey, {
            result: errorResponse,
            timestamp: Date.now(),
            statusCode: 500
        });
        console.log(`Error response cached for idempotency key: ${idempotencyKey}`);
    }

    return res.status(500).json(errorResponse);
  } finally {
      // TTLが切れた古いエントリを削除（定期的なクリーンアップ）
      const now = Date.now();
      processedHoroscopeRequests.forEach((value, key) => {
          if (now - value.timestamp >= IDEMPOTENCY_KEY_TTL) {
              processedHoroscopeRequests.delete(key);
          }
      });
  }
}

// --- Helper functions ---

// Adjusted to use the structure from horoscopeDataForPrompt
function createBasePrompt({ name, birthInfo, western, fourPillars }) {
  // Basic validation in case data is missing
  const westernStr = `太陽星座: ${western.sunSign || '不明'}, 月星座: ${western.moonSign || '不明'}, アセンダント: ${western.ascendant || '不明'}, 主要惑星: ${western.keyPlanets?.join(', ') || '不明'}`;
  const fourPillarsStr = `日主: ${fourPillars.dayMaster || '不明'}, 命式: ${fourPillars.pillars?.join(' ') || '不明'}, 五行バランス: ${fourPillars.elementBalance ? Object.entries(fourPillars.elementBalance).map(([k, v]) => `${k}: ${v}`).join(', ') : '不明'}`;

  return `
ユーザー情報:
- 名前: ${name}
- 生年月日時: ${birthInfo.date} ${birthInfo.time}
- 出生地: ${birthInfo.place}

占術データ:
- 西洋占星術: ${westernStr}
- 四柱推命: ${fourPillarsStr}

上記の詳細な占術データを基に、${name}さんの鑑定結果を以下の形式で生成してください。各項目は日本語で300字程度で記述し、専門用語を避け平易な言葉で説明してください。西洋占星術と四柱推命の両方の観点を統合的に考慮し、単なるデータの列挙ではなく、深い洞察を提供してください。

1.  **基本的な性格と本質:** 内面的な性質、行動パターン、強みと弱みなど。
2.  **潜在的な才能と適性:** 隠れた能力、向いている職業や活動分野、成功しやすい環境など。
3.  **対人関係とコミュニケーション:** 他者との関わり方、相性の良いタイプ、注意すべき点など。
4.  **今後半年間の運勢:** 全体的な運気の流れ、注力すべきこと、気をつけるべきことなど。

出力は上記の4つのセクションのみを、番号付きリスト形式で返してください。
例:
1. (基本的な性格と本質の内容)
2. (潜在的な才能と適性の内容)
...
`;
}

// Adjusted to use the structure from horoscopeDataForPrompt
function createSpecificQuestionPrompt(question, western, fourPillars) {
    const westernStr = `太陽星座: ${western.sunSign || '不明'}, 月星座: ${western.moonSign || '不明'}, アセンダント: ${western.ascendant || '不明'}`;
    const fourPillarsStr = `日主: ${fourPillars.dayMaster || '不明'}, 五行バランス: ${fourPillars.elementBalance ? Object.entries(fourPillars.elementBalance).map(([k, v]) => `${k}: ${v}`).join(', ') : '不明'}`;

  return `
以下の占術データとユーザーからの質問に基づき、回答を生成してください。

占術データ概要:
- 西洋占星術: ${westernStr}
- 四柱推命: ${fourPillarsStr}

ユーザーからの質問: 「${question}」

上記の質問に対して、占術データ（西洋占星術と四柱推命の両方）を深く分析し、日本語で500字以内で具体的かつ実用的なアドバイスを含めて回答してください。単なる一般論ではなく、提供されたデータに基づいたパーソナルな回答を心がけてください。
`;
}

function structureBaseReading(apiResponse) {
  try {
    // Improved parsing: Split by newline then find lines starting with number+dot+space
    const lines = apiResponse.split('\n').map(line => line.trim()).filter(Boolean);
    const sections = {};
    const keys = ['personality', 'talents', 'relationships', 'forecast'];
    let currentKeyIndex = -1;

    for (const line of lines) {
        if (/^\d\.\s/.test(line)) {
            currentKeyIndex++;
            if (currentKeyIndex < keys.length) {
                sections[keys[currentKeyIndex]] = line.substring(line.indexOf(' ') + 1).trim();
            }
        } else if (currentKeyIndex >= 0 && currentKeyIndex < keys.length) {
            // Append subsequent lines to the current section
            sections[keys[currentKeyIndex]] += `\n${line}`;
        }
    }

    // Ensure all keys exist, even if parsing failed
    keys.forEach(key => {
        if (!sections[key]) {
            console.warn(`Failed to parse section '${key}' from base reading.`);
            sections[key] = "データ取得または解析エラー";
        }
    });

    return sections;
  } catch (error) {
    console.error("Error structuring base reading:", error);
    console.error("Original API response:", apiResponse); // Log the response that failed
    // Return error structure
    return {
      personality: "データの構造化中にエラーが発生しました。",
      talents: "データの構造化中にエラーが発生しました。",
      relationships: "データの構造化中にエラーが発生しました。",
      forecast: "データの構造化中にエラーが発生しました。"
    };
  }
}

function structureSpecificReading(apiResponse, originalQuestion) {
  // Simple structure, assuming the API returns the answer directly
  return {
    question: originalQuestion, // Include the original question for context
    answer: apiResponse.trim() || "回答の取得または解析エラー"
  };
}