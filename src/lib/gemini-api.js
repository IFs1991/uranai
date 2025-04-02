// Google Gemini API連携ライブラリ

const GeminiApi = (() => {
  const API_KEY = process.env.GEMINI_API_KEY; // 環境変数から取得
  const API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent'; // 例

  // APIキーが設定されていない場合のチェック
  if (!API_KEY) {
    console.error('エラー: 環境変数 GEMINI_API_KEY が設定されていません。');
    // 実行環境に応じて処理を停止するか、エラーを示す値を返すなどの対策が必要
    // throw new Error('GEMINI_API_KEY is not set.');
  }

  // APIリクエスト送信
  const sendRequest = async (prompt) => {
    console.log('Sending request to Gemini API...');
    try {
      // APIキーが未設定ならリクエストを送らない
      if (!API_KEY) return 'エラー: Gemini APIキーが設定されていません。';

      const response = await fetch(`${API_ENDPOINT}?key=${API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt }
            ]
          }]
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Gemini API request failed with status ${response.status}: ${errorBody}`);
      }

      const data = await response.json();
      console.log('Received response from Gemini API.');
      return parseResponse(data);

    } catch (error) {
      console.error('Error calling Gemini API:', error);
      throw error; // エラーを再スローして呼び出し元で処理
    }
  };

  // プロンプトテンプレート生成 (例)
  const createHoroscopePrompt = (userData) => {
    // userDataから必要な情報を抽出し、プロンプトを構築
    const prompt = `
      以下のユーザー情報に基づいて、西洋占星術と四柱推命を組み合わせた基本的な性格と才能に関する短い占いを作成してください。
      名前: ${userData.name || '未入力'}
      生年月日: ${userData.birthdate}
      出生時間: ${userData.birthtime || '不明'}
      出生地: ${userData.birthplace || '未入力'}
      ${userData.question ? `\n特に聞きたいこと: ${userData.question}` : ''}

      形式:
      - 簡潔に150文字程度で
      - ポジティブな視点で
      - 核となるエネルギー、潜在的な才能、簡単なアドバイスを含む
    `;
    return prompt;
  };

  // 365日占い生成用プロンプト (バッチ処理用)
  const createDailyFortunePrompt = (date, baseData) => {
    // 特定の日付と基本データに基づいて日別占いのプロンプトを生成
    return `
      ${baseData.name}さん (${baseData.birthdate}生まれ) の ${date} の運勢を占ってください。
      今日のテーマ、ラッキーカラー、簡単なアドバイスを含めて50文字程度でお願いします。
    `;
  };

  // レスポンス解析
  const parseResponse = (data) => {
    // Gemini APIのレスポンス構造に合わせて内容を抽出
    // 例: data.candidates[0].content.parts[0].text
    try {
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
            console.warn('Could not extract text from Gemini response:', data);
            return '占い結果の取得に失敗しました。';
        }
        return text.trim();
    } catch (error) {
        console.error('Error parsing Gemini response:', error, data);
        return '占い結果の解析中にエラーが発生しました。';
    }
  };

  // エラーハンドリングとリトライ (簡易版)
  const sendRequestWithRetry = async (prompt, retries = 3, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
      try {
        return await sendRequest(prompt);
      } catch (error) {
        if (i === retries - 1) throw error; // 最終リトライでも失敗したらエラー
        console.log(`Retrying Gemini API request (${i + 1}/${retries})...`);
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i))); // Exponential backoff
      }
    }
  };

  // 公開API
  return {
    generateBasicHoroscope: async (userData) => {
      const prompt = createHoroscopePrompt(userData);
      return await sendRequestWithRetry(prompt);
    },
    generateDailyFortune: async (date, baseData) => {
      const prompt = createDailyFortunePrompt(date, baseData);
      // 365日分はより高度なバッチ処理やエラーハンドリングが必要
      return await sendRequest(prompt); // ここでは簡易的に個別リクエスト
    },
    // 必要に応じて他のメソッドを追加
  };

})();