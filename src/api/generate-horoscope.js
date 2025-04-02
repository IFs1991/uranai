// Vercel Serverless Function for horoscope generation
import { generateGeminiResponse, retryWithBackoff } from '../lib/gemini-api';
import { calculateWesternAstrology } from '../lib/astrology';
import { calculateFourPillars } from '../lib/four-pillars';

// In-memory cache for similar requests
const responseCache = new Map();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, birthDate, birthTime, birthPlace, specificQuestion } = req.body;

    if (!name || !birthDate || !birthTime || !birthPlace) {
      return res.status(400).json({ 
        error: '必須項目が不足しています。名前、生年月日、出生時刻、出生地をご入力ください。' 
      });
    }

    // Create cache key from request data
    const cacheKey = `${name}-${birthDate}-${birthTime}-${birthPlace}-${specificQuestion || ''}`;
    
    // Check cache first
    if (responseCache.has(cacheKey)) {
      const { data, timestamp } = responseCache.get(cacheKey);
      // Verify cache is still valid
      if (Date.now() - timestamp < CACHE_TTL) {
        return res.status(200).json(data);
      }
      // Cache expired, remove it
      responseCache.delete(cacheKey);
    }

    // Run calculations in parallel
    const [westernData, fourPillarsData] = await Promise.all([
      calculateWesternAstrology(birthDate, birthTime, birthPlace),
      calculateFourPillars(birthDate, birthTime)
    ]);

    // Prepare data for Gemini API
    const horoscopeData = {
      name,
      birthInfo: { date: birthDate, time: birthTime, place: birthPlace },
      western: westernData,
      fourPillars: fourPillarsData,
      specificQuestion: specificQuestion || null
    };

    // Generate base horoscope response
    const basePrompt = createBasePrompt(horoscopeData);
    const baseResponse = await retryWithBackoff(() => 
      generateGeminiResponse(basePrompt), 3);
    
    // Process specific question if provided (parallelize with base response)
    let questionResponse = null;
    if (specificQuestion) {
      const questionPrompt = createSpecificQuestionPrompt(
        specificQuestion, 
        westernData, 
        fourPillarsData
      );
      questionResponse = await retryWithBackoff(() => 
        generateGeminiResponse(questionPrompt), 3);
    }

    // Combine and structure the final response
    const response = {
      summary: {
        name,
        birthDate,
        birthTime,
        birthPlace
      },
      westernAstrology: {
        sunSign: westernData.sunSign,
        moonSign: westernData.moonSign,
        ascendant: westernData.ascendant,
        keyPlanets: westernData.keyPlanets
      },
      fourPillars: {
        dayMaster: fourPillarsData.dayMaster,
        pillars: fourPillarsData.pillars,
        elementBalance: fourPillarsData.elementBalance
      },
      baseReading: structureBaseReading(baseResponse),
      specificReading: questionResponse ? structureSpecificReading(questionResponse) : null,
      timestamp: new Date().toISOString()
    };

    // Cache the result
    responseCache.set(cacheKey, {
      data: response,
      timestamp: Date.now()
    });

    // Manage cache size (simple LRU-like implementation)
    if (responseCache.size > 100) {
      const oldestKey = [...responseCache.keys()][0];
      responseCache.delete(oldestKey);
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error('Horoscope generation error:', error);
    return res.status(500).json({ 
      error: '占い結果の生成中にエラーが発生しました。しばらく経ってからもう一度お試しください。',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// Helper functions to create optimized prompts
function createBasePrompt({ name, birthInfo, western, fourPillars }) {
  return `
生年月日時: ${birthInfo.date} ${birthInfo.time}
出生地: ${birthInfo.place}
名前: ${name}

西洋占星術データ:
- 太陽星座: ${western.sunSign}
- 月星座: ${western.moonSign}
- アセンダント: ${western.ascendant}
- 主要な惑星配置: ${western.keyPlanets.join(', ')}

四柱推命データ:
- 日主: ${fourPillars.dayMaster}
- 命式: ${fourPillars.pillars.join(' ')}
- 五行バランス: ${Object.entries(fourPillars.elementBalance).map(([k, v]) => `${k}: ${v}`).join(', ')}

上記の情報を基に、以下の観点から鑑定結果を生成してください:
1. 基本的な性格と特徴 (300字以内)
2. 潜在的な才能と適性 (300字以内)
3. 対人関係と相性の傾向 (300字以内)
4. 今後半年間の全体運 (300字以内)

西洋占星術と四柱推命の両方の知見を融合させた鑑定結果を出力してください。
専門用語の多用は避け、一般の方にも理解しやすい表現を心がけてください。
`;
}

function createSpecificQuestionPrompt(question, western, fourPillars) {
  return `
以下の西洋占星術と四柱推命のデータを基に、特定の質問に答えてください。

西洋占星術データ:
- 太陽星座: ${western.sunSign}
- 月星座: ${western.moonSign}
- アセンダント: ${western.ascendant}

四柱推命データ:
- 日主: ${fourPillars.dayMaster}
- 命式の五行バランス: ${Object.entries(fourPillars.elementBalance).map(([k, v]) => `${k}: ${v}`).join(', ')}

質問: ${question}

上記の質問に対して、500字以内で具体的に回答してください。西洋占星術と四柱推命の両方の視点から、
実用的なアドバイスを含めて回答してください。
`;
}

// Helper functions to structure API responses
function structureBaseReading(apiResponse) {
  // Parse and structure the base reading response
  try {
    const sections = apiResponse.split(/\d\.\s/).filter(Boolean);
    return {
      personality: sections[0]?.trim() || "データ取得エラー",
      talents: sections[1]?.trim() || "データ取得エラー",
      relationships: sections[2]?.trim() || "データ取得エラー",
      forecast: sections[3]?.trim() || "データ取得エラー"
    };
  } catch (error) {
    console.error("Error structuring base reading:", error);
    return {
      personality: "データの構造化中にエラーが発生しました。",
      talents: "データの構造化中にエラーが発生しました。",
      relationships: "データの構造化中にエラーが発生しました。",
      forecast: "データの構造化中にエラーが発生しました。"
    };
  }
}

function structureSpecificReading(apiResponse) {
  // Structure the specific question response
  return {
    question: "ご質問への回答",
    answer: apiResponse.trim()
  };
}