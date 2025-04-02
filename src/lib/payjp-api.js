// pay.jp API連携ライブラリ (サーバーサイド用)

const PayjpApi = (() => {
  const PAYJP_SECRET_KEY = process.env.PAYJP_SECRET_KEY; // 環境変数から取得
  const PAYJP_API_BASE = 'https://api.pay.jp/v1';

  // APIキーが設定されていない場合のチェック
  if (!PAYJP_SECRET_KEY) {
    console.error('エラー: 環境変数 PAYJP_SECRET_KEY が設定されていません。');
    // 実行環境に応じて処理を停止するか、エラーを示す値を返すなどの対策が必要
    // throw new Error('PAYJP_SECRET_KEY is not set.');
  }

  // APIリクエスト共通処理
  const request = async (endpoint, method = 'GET', data = null) => {
    // APIキーが未設定ならリクエストを送らない
    if (!PAYJP_SECRET_KEY) {
        throw new Error('Pay.jp Secret Key is not configured.');
    }
    const url = `${PAYJP_API_BASE}${endpoint}`;
    const headers = {
      'Authorization': `Basic ${Buffer.from(PAYJP_SECRET_KEY + ':').toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    const options = {
      method: method,
      headers: headers,
    };

    if (data && (method === 'POST' || method === 'PUT')) {
        // pay.jpは form-urlencoded を要求する
        options.body = new URLSearchParams(data).toString();
    }

    try {
      const response = await fetch(url, options);
      const responseData = await response.json();

      if (!response.ok) {
        console.error('Pay.jp API Error:', responseData);
        throw new Error(responseData.error?.message || `Pay.jp API request failed with status ${response.status}`);
      }

      return responseData;
    } catch (error) {
      console.error(`Error during Pay.jp API call to ${endpoint}:`, error);
      throw error;
    }
  };

  // トークン検証 (顧客情報と紐付けるなど)
  const retrieveToken = async (tokenId) => {
    // トークン自体はクライアントサイドで生成されるため、サーバーでは通常使わない
    // 必要であれば顧客情報取得などで使う
    // return await request(`/tokens/${tokenId}`);
    console.warn('retrieveToken is generally not used server-side with charges.');
    return { id: tokenId }; // ダミー応答
  };

  // 支払い処理 (Charge作成)
  const createCharge = async (amount, currency, cardToken, description = '占いサービス利用料') => {
    const chargeData = {
      amount: amount,
      currency: currency,
      card: cardToken, // クライアントから送られてきたトークンID
      description: description,
      capture: 'true' // 即時売上確定
    };
    console.log('Creating Pay.jp charge with data:', { amount, currency, description });
    return await request('/charges', 'POST', chargeData);
  };

  // 支払い結果確認 (通常はcreateChargeの応答で十分)
  const retrieveCharge = async (chargeId) => {
    return await request(`/charges/${chargeId}`);
  };

  // 公開API
  return {
    createCharge,
    retrieveCharge,
    // retrieveToken // 通常サーバーサイドでは不要
  };

})();

// Node.js環境でのエクスポート (Vercel Functionsなどで使う場合)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PayjpApi;
}