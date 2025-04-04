import { createPdfDocument, generatePdfPages, addTableOfContents, addAstrologyChart, addFourPillarsChart, createCalendarPages } from '../lib/pdf-generator.js'; // PDF生成ヘルパー関数 (実際のパスに合わせてください)
import { calculateAstrologyData } from '../lib/astrology.js'; // 占星術データ計算 (実際のパスに合わせてください)
import { calculateFourPillarsData } from '../lib/four-pillars.js'; // 四柱推命データ計算 (実際のパスに合わせてください)
import { GoogleGenerativeAI } from "@google/generative-ai"; // Gemini API SDK

// --- グローバルな設定 ---
let genAIInstance;
let geminiModel;

function initializeGemini() {
  if (!process.env.GEMINI_API_KEY) {
      console.error("エラー: GEMINI_API_KEYが設定されていません。");
      // 環境変数がなければ初期化しない
      return false;
  }
  if (!genAIInstance) {
    genAIInstance = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // !!! 要確認: モデル名は適切なものを指定してください !!!
    geminiModel = genAIInstance.getGenerativeModel({ model: "gemini-pro" }); // 例: "gemini-1.5-flash", "gemini-1.0-pro"
    console.log("Gemini API クライアントを初期化しました。");
  }
  return true;
}

/**
 * Gemini APIを使用して、指定されたプロンプトに対する応答を生成する汎用関数
 * @param {string} prompt - Gemini APIに送信するプロンプト
 * @returns {Promise<string>} - Geminiからの応答テキスト
 * @throws {Error} - APIキー未設定、またはAPI呼び出しに失敗した場合
 */
async function generateGeminiResponse(prompt) {
  if (!initializeGemini()) {
    throw new Error("Gemini APIキーが設定されていないため、応答を生成できません。");
  }

  try {
    console.log(`Gemini API呼び出し中... プロンプト長: ${prompt.length}`);
    const result = await geminiModel.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // 応答テキストが ```json ... ``` のようなマークダウン形式の場合、JSON部分を抽出
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
        text = jsonMatch[1];
    }
    // JSON文字列のクリーニング (不要な文字や改行を除去する必要がある場合)
    text = text.trim();

    console.log("Gemini API呼び出し成功。");
    return text;

  } catch (error) {
    console.error("Gemini API 呼び出し中にエラーが発生しました:", error);
    console.error("失敗したプロンプト:\n", prompt); // エラー時のプロンプトをログ出力
    throw new Error(`Gemini API呼び出しに失敗しました: ${error.message}`);
  }
}


/**
 * 指数バックオフとジッターを使用して非同期関数をリトライする高階関数
 * @param {() => Promise<T>} asyncFn - リトライする非同期関数
 * @param {number} maxRetries - 最大リトライ回数
 * @param {number} initialDelay - 初期遅延時間 (ミリ秒)
 * @returns {Promise<T>} - 非同期関数の結果
 * @template T
 * @throws {Error} - 最大リトライ回数を超えても失敗した場合
 */
async function retryWithBackoff(asyncFn, maxRetries = 3, initialDelay = 1000) {
  let attempts = 0;
  while (attempts < maxRetries) {
    try {
      return await asyncFn();
    } catch (error) {
      attempts++;
      if (attempts >= maxRetries) {
        console.error(`最大リトライ回数(${maxRetries})に達しました。最終エラー:`, error);
        throw error; // Give up after max retries
      }
      const delay = initialDelay * Math.pow(2, attempts - 1);
      const jitter = delay * 0.5 * Math.random(); // Add jitter (0-50% of delay)
      const waitTime = Math.round(delay + jitter);
      console.warn(`試行 ${attempts} が失敗しました。エラー: ${error.message}. ${waitTime}ms 後にリトライします...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  // This line should theoretically not be reached, but satisfies TypeScript/linters
  throw new Error("リトライロジックの予期せぬエラー");
}


/**
 * Gemini APIを使用して、指定された月の柔軟な日別占いを生成する関数
 * （内部で generateGeminiResponse と retryWithBackoff を利用するように変更可能）
 * @param {string} name ユーザー名
 * @param {string} birthDate 生年月日
 * @param {object} astrologyData 占星術データ
 * @param {object} fourPillarsData 四柱推命データ
 * @param {number} month 対象月 (1-12)
 * @param {string} [specificQuestion=''] ユーザーからの特定の質問
 * @returns {Promise<Array>} 月の日数分の占い結果オブジェクトの配列
 */
async function generateDailyHoroscopes(name, birthDate, astrologyData, fourPillarsData, month, specificQuestion = '') {
  // APIキーチェックは generateGeminiResponse 内で行われる
  if (!initializeGemini()) {
      console.warn(`APIキー未設定または初期化失敗のため、${month}月はフォールバック占いを生成します。`);
      const year = new Date().getFullYear();
      const daysInMonth = new Date(year, month, 0).getDate();
      return generateFallbackHoroscopes(month, year, daysInMonth);
  }

  const year = new Date().getFullYear(); // または対象年を適切に決定
  const daysInMonth = new Date(year, month, 0).getDate();
  const dailyHoroscopes = [];

  console.log(`${year}年${month}月の日別占いをGemini APIで生成開始...`);

  for (let day = 1; day <= daysInMonth; day++) {
    const targetDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    // --- プロンプトの構築 (要調整) ---
    const simplifiedAstrologyData = JSON.stringify(astrologyData); // 例: 実際は必要な情報だけを抽出
    const simplifiedFourPillarsData = JSON.stringify(fourPillarsData); // 例: 実際は必要な情報だけを抽出

    let prompt = `
あなたは経験豊富なプロの占い師です。以下の情報に基づき、${name}さんの${targetDate}の運勢について、パーソナライズされた具体的な一言コメントを日本語で生成してください。併せて、その日のラッキー度(1から5の整数)、ラッキーカラー(色名)も提案してください。コメントは簡潔(50字程度)にお願いします。

# ユーザー情報
- 名前: ${name}
- 生年月日: ${birthDate}
- 西洋占星術データ(要約): ${simplifiedAstrologyData}
- 四柱推命データ(要約): ${simplifiedFourPillarsData}

# 今日の日付
${targetDate}

# 考慮事項
- ${targetDate}の天体の動きや干支、季節の流れなどを総合的に考慮してください。
`;

    if (specificQuestion) {
      prompt += `
# 特に考慮してほしい点
ユーザーは「${specificQuestion}」について特に関心を持っています。今日の運勢を踏まえ、この質問に関連するアドバイスや気づき、注意点などを一言コメントに含めてください。
`;
    }

    prompt += `
# 出力形式 (JSONオブジェクトのみを出力してください)
{
  "luckyLevel": 数値(1-5),
  "luckyColor": "色名",
  "shortMessage": "パーソナライズされた具体的な一言コメント(日本語、50字程度)"
}
`;
    // --- プロンプト構築ここまで ---

    try {
      console.log(`  ${targetDate} の占い生成中...`);
       // リトライ付きでAPI呼び出し
      const responseText = await retryWithBackoff(() => generateGeminiResponse(prompt), 3, 1500); // 3回リトライ、初期遅延1.5秒

      // JSONとしてパース
      const horoscopeData = JSON.parse(responseText);

      // バリデーション (期待したキーが存在するかなど)
      if (typeof horoscopeData.luckyLevel !== 'number' || typeof horoscopeData.luckyColor !== 'string' || typeof horoscopeData.shortMessage !== 'string') {
          throw new Error('API応答のJSON形式が不正です。');
      }

      dailyHoroscopes.push({
        date: targetDate,
        luckyLevel: horoscopeData.luckyLevel,
        luckyColor: horoscopeData.luckyColor,
        shortMessage: horoscopeData.shortMessage
      });

      // !!! 要調整: APIのレート制限を避けるための適切な待機時間 !!!
      // retryWithBackoff内で待機が入るため、ここでの待機は短くするか不要になる可能性あり
      // await new Promise(resolve => setTimeout(resolve, 500)); // 例: 0.5秒待機

    } catch (error) {
      console.error(`Error generating horoscope for ${targetDate} after retries:`, error);
      console.warn(`${targetDate} はフォールバック占いを適用します。`);
      // エラーが発生した日はフォールバックデータを生成
      const fallback = generateFallbackHoroscopes(month, year, 1)[0]; // 1日分だけ生成して利用
      dailyHoroscopes.push({
        date: targetDate,
        luckyLevel: fallback.luckyLevel,
        luckyColor: fallback.luckyColor,
        shortMessage: fallback.shortMessage // フォールバックの定型文を使う
      });
    }
  }

  console.log(`${year}年${month}月の占い生成完了。`);
  return dailyHoroscopes;
}

/**
 * エラー時または解析失敗時のフォールバック占い結果を生成
 * @param {number} month - 月 (1-12)
 * @param {number} year - 年
 * @param {number} daysInMonth - 月の日数
 * @returns {Array} 月の日数分の占い結果配列
 */
function generateFallbackHoroscopes(month, year, daysInMonth) {
  const messages = [
    '今日は新しい発見がありそう。周囲をよく観察して。',
    '直感を信じて行動すると良い結果に繋がりやすい日。',
    '計画に少し変更を加えると、よりスムーズに進むかも。',
    '身近な人に感謝の気持ちを伝えてみましょう。',
    '一人の時間を作ってリラックス。良いアイデアが浮かぶ予感。',
    '無理は禁物。体調管理を優先しましょう。',
    '予期せぬ幸運が舞い込むかも。ポジティブな気持ちで。',
    'コミュニケーションが鍵。積極的に人と関わってみて。',
    '日常の中の小さな変化に注目。新しい視点が得られそう。',
    '自分のペースを大切に。充実した一日を過ごせるでしょう。'
  ];

  const colors = ['レッド', 'ブルー', 'グリーン', 'イエロー', 'パープル', 'オレンジ', 'ピンク', 'ゴールド', 'シルバー', 'ホワイト', 'ブラウン', 'ブラック'];

  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    return {
      date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      luckyLevel: Math.floor(Math.random() * 3) + 2, // 2-4程度に
      luckyColor: colors[Math.floor(Math.random() * colors.length)],
      shortMessage: messages[Math.floor(Math.random() * messages.length)]
    };
  });
}

/**
 * Gemini APIで詳細な鑑定文を生成（generate-pdf.js で使用される想定）
 * ※この関数の実装は generate-horoscope.js のプロンプト生成ロジックなどを参考に別途必要
 * @param {string} name
 * @param {string} birthDate
 * @param {string} birthTime
 * @param {string} birthPlace
 * @param {object} astrologyData
 * @param {object} fourPillarsData
 * @param {string} specificQuestion
 * @returns {Promise<object>} 鑑定結果オブジェクト（例: { coreEnergy: "...", lifePurpose: "...", ... }）
 */
async function generateComprehensiveReading(name, birthDate, birthTime, birthPlace, astrologyData, fourPillarsData, specificQuestion) {
  console.log("詳細鑑定文生成中 (Gemini)...");

  // --- ここに詳細鑑定用のプロンプト生成ロジックを実装 ---
  // generate-horoscope.js の createBasePrompt や createSpecificQuestionPrompt を参考に、
  // PDFに必要なセクション（核となるエネルギー、才能と人生のテーマなど）を生成するプロンプトを作成

  const prompt = `
あなたは非常に経験豊富な占星術師であり、四柱推命鑑定士です。以下のユーザー情報、西洋占星術データ、四柱推命データに基づき、包括的な鑑定レポートを作成してください。レポートは以下のセクションを含み、それぞれ日本語で詳細かつ分かりやすく記述してください。

# ユーザー情報
- 名前: ${name}
- 生年月日: ${birthDate}
- 出生時刻: ${birthTime}
- 出生地: ${birthPlace}
${specificQuestion ? `- 特に聞きたいこと: ${specificQuestion}` : ''}

# 西洋占星術データ (要約)
${JSON.stringify(astrologyData, null, 2)}

# 四柱推命データ (要約)
${JSON.stringify(fourPillarsData, null, 2)}

# 生成するレポートセクション
1.  **核となるエネルギーと個性 (coreEnergy):** その人の本質、基本的な性格、行動原理などを記述してください (500字程度)。
2.  **才能と人生のテーマ (lifePurpose):** 潜在的な才能、適職の傾向、人生で追求すべきテーマなどを記述してください (500字程度)。
3.  **運気の流れと成長のタイミング (fortuneTimeline):** 人生の主要な転機や注意すべき時期、成長のためのアドバイスなどを記述してください (500字程度)。
${specificQuestion ? '4.  **特別質問への回答 (specificQuestionAnswer):** ユーザーの特定の質問に対し、占術的な観点から具体的かつ建設的なアドバイスを記述してください (500字程度)。' : ''}
5.  **総括とアドバイス (summary):** 鑑定全体のまとめと、今後の人生をより良く生きるための総合的なアドバイスを記述してください (300字程度)。

# 出力形式 (JSONオブジェクトのみを出力してください)
{
  "coreEnergy": "(セクション1の内容)",
  "lifePurpose": "(セクション2の内容)",
  "fortuneTimeline": "(セクション3の内容)",
  ${specificQuestion ? '"specificQuestionAnswer": "(セクション4の内容)",' : ''}
  "summary": "(セクション5の内容)"
}
`;
  // --- プロンプト生成ロジックここまで ---

  try {
    const responseText = await retryWithBackoff(() => generateGeminiResponse(prompt), 3, 2000);
    const readingResult = JSON.parse(responseText);
    console.log("詳細鑑定文生成完了。");
    // バリデーションを追加することが望ましい
    return readingResult;
  } catch (error) {
    console.error("詳細鑑定文の生成に失敗しました:", error);
    // エラー時はフォールバックや空のオブジェクトを返すなどの処理
    return {
      coreEnergy: "鑑定文の生成中にエラーが発生しました。",
      lifePurpose: "鑑定文の生成中にエラーが発生しました。",
      fortuneTimeline: "鑑定文の生成中にエラーが発生しました。",
      specificQuestionAnswer: specificQuestion ? "特別質問への回答生成中にエラーが発生しました。" : undefined,
      summary: "鑑定文の生成中にエラーが発生しました。"
    };
  }
}


// --- エクスポート ---
export {
  generateDailyHoroscopes,
  generateFallbackHoroscopes,
  generateGeminiResponse,
  retryWithBackoff,
  generateComprehensiveReading // generate-pdf.js用
};