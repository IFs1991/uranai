// lib/payjp-api.js - Pay.jp API wrapper

/**
 * Pay.jp APIを使用して決済（Charge）を作成します。
 *
 * @param {object} params - 決済パラメータ
 * @param {string} params.token - Pay.jpトークン
 * @param {number} params.amount - 金額
 * @param {string} [params.currency='jpy'] - 通貨 (デフォルト: jpy)
 * @param {string} [params.description=''] - 説明 (デフォルト: '')
 * @param {object} [params.metadata] - メタデータ
 * @returns {Promise<object>} Pay.jpのChargeオブジェクト
 * @throws {Error} APIリクエストまたは決済処理に失敗した場合
 */
export const createCharge = async ({ token, amount, currency = 'jpy', description = '', metadata }) => {
  // 環境変数から秘密鍵を取得
  const secretKey = process.env.PAYJP_SECRET_KEY;
  if (!secretKey) {
    console.error('エラー: PAYJP_SECRET_KEY 環境変数が設定されていません。');
    throw new Error('サーバー設定エラーが発生しました。');
  }

  // Basic認証ヘッダー用の文字列を生成
  const authHeader = `Basic ${Buffer.from(secretKey + ':').toString('base64')}`;

  // Pay.jp APIエンドポイント
  const apiUrl = 'https://api.pay.jp/v1/charges';

  // リクエストボディの準備
  const bodyParams = new URLSearchParams({
    card: token,
    amount: amount.toString(), // 金額は文字列として送信
    currency: currency,
  });
  if (description) {
    bodyParams.set('description', description);
  }
  if (metadata) {
    // メタデータはJSON文字列として送信
    bodyParams.set('metadata', JSON.stringify(metadata));
  }

  try {
    // Node.jsのfetchを使用してAPIリクエスト
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: bodyParams.toString() // URLエンコードされた文字列を送信
    });

    const responseData = await response.json();

    if (!response.ok) {
      // Pay.jpからのエラーレスポンス
      const errorMessage = responseData.error?.message || `Pay.jp APIエラー (ステータス: ${response.status})`;
      console.error('Pay.jp APIエラー:', responseData.error);
      throw new Error(errorMessage);
    }

    // 成功した場合はChargeオブジェクトを返す
    return responseData;

  } catch (error) {
    console.error('Pay.jp APIリクエスト中にエラーが発生しました:', error);
    // エラーの種類に応じてメッセージを変更することも可能
    if (error instanceof Error && error.message.startsWith('Pay.jp APIエラー')) {
      throw error; // Pay.jpからのエラーはそのままスロー
    }
    throw new Error('決済サービスへの接続中にエラーが発生しました。');
  }
};

/**
 * Pay.jp APIを使用して与信枠のみを確保します（支払いを確定しない）
 *
 * @param {object} params - 与信枠確保パラメータ
 * @param {string} params.token - Pay.jpトークン
 * @param {number} params.amount - 金額
 * @param {string} [params.currency='jpy'] - 通貨 (デフォルト: jpy)
 * @param {string} [params.description=''] - 説明 (デフォルト: '')
 * @param {object} [params.metadata] - メタデータ
 * @param {number} [params.expiryDays=7] - 与信枠の有効期限（日数、1〜60）
 * @returns {Promise<object>} Pay.jpのChargeオブジェクト (captured: false)
 * @throws {Error} APIリクエストまたは与信枠確保に失敗した場合
 */
export const createAuthorization = async ({
  token,
  amount,
  currency = 'jpy',
  description = '',
  metadata,
  expiryDays = 7
}) => {
  // 環境変数から秘密鍵を取得
  const secretKey = process.env.PAYJP_SECRET_KEY;
  if (!secretKey) {
    console.error('エラー: PAYJP_SECRET_KEY 環境変数が設定されていません。');
    throw new Error('サーバー設定エラーが発生しました。');
  }

  // Basic認証ヘッダー用の文字列を生成
  const authHeader = `Basic ${Buffer.from(secretKey + ':').toString('base64')}`;

  // Pay.jp APIエンドポイント
  const apiUrl = 'https://api.pay.jp/v1/charges';

  // 有効期限の検証（1〜60日の範囲内）
  const validExpiryDays = Math.max(1, Math.min(60, expiryDays));

  // リクエストボディの準備
  const bodyParams = new URLSearchParams({
    card: token,
    amount: amount.toString(), // 金額は文字列として送信
    currency: currency,
    capture: 'false', // 与信枠のみを確保（支払いを確定しない）
    expiry_days: validExpiryDays.toString() // 与信枠の有効期限
  });

  if (description) {
    bodyParams.set('description', description);
  }
  if (metadata) {
    // メタデータはJSON文字列として送信
    bodyParams.set('metadata', JSON.stringify(metadata));
  }

  try {
    // Node.jsのfetchを使用してAPIリクエスト
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: bodyParams.toString() // URLエンコードされた文字列を送信
    });

    const responseData = await response.json();

    if (!response.ok) {
      // Pay.jpからのエラーレスポンス
      const errorMessage = responseData.error?.message || `Pay.jp APIエラー (ステータス: ${response.status})`;
      console.error('Pay.jp 与信枠確保エラー:', responseData.error);
      throw new Error(errorMessage);
    }

    // 成功した場合はChargeオブジェクトを返す（captured: false, paid: trueであるべき）
    if (responseData.paid !== true || responseData.captured !== false) {
      console.warn('予期しない与信枠確保レスポンス:', responseData);
    }

    return responseData;

  } catch (error) {
    console.error('Pay.jp 与信枠確保リクエスト中にエラーが発生しました:', error);
    // エラーの種類に応じてメッセージを変更することも可能
    if (error instanceof Error && error.message.startsWith('Pay.jp APIエラー')) {
      throw error; // Pay.jpからのエラーはそのままスロー
    }
    throw new Error('与信枠確保中にエラーが発生しました。');
  }
};

/**
 * 与信枠が確保された支払いを確定します
 *
 * @param {string} chargeId - 与信枠が確保された支払いID
 * @param {number} [amount] - 支払いを確定する金額（与信枠確保時の金額以下）
 * @returns {Promise<object>} 確定された支払い情報
 * @throws {Error} APIリクエストまたは支払い確定に失敗した場合
 */
export const capturePayment = async (chargeId, amount = null) => {
  // 環境変数から秘密鍵を取得
  const secretKey = process.env.PAYJP_SECRET_KEY;
  if (!secretKey) {
    console.error('エラー: PAYJP_SECRET_KEY 環境変数が設定されていません。');
    throw new Error('サーバー設定エラーが発生しました。');
  }

  // Basic認証ヘッダー用の文字列を生成
  const authHeader = `Basic ${Buffer.from(secretKey + ':').toString('base64')}`;

  // Pay.jp APIエンドポイント（capture）
  const apiUrl = `https://api.pay.jp/v1/charges/${chargeId}/capture`;

  // リクエストボディの準備
  const bodyParams = new URLSearchParams();
  if (amount !== null) {
    bodyParams.set('amount', amount.toString());
  }

  try {
    // Node.jsのfetchを使用してAPIリクエスト
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: bodyParams.toString() || undefined // 空の場合はundefinedを渡す
    });

    const responseData = await response.json();

    if (!response.ok) {
      // Pay.jpからのエラーレスポンス
      const errorMessage = responseData.error?.message || `Pay.jp APIエラー (ステータス: ${response.status})`;
      console.error('Pay.jp 支払い確定エラー:', responseData.error);
      throw new Error(errorMessage);
    }

    // 成功した場合はChargeオブジェクトを返す（captured: trueであるべき）
    if (responseData.captured !== true) {
      console.warn('予期しない支払い確定レスポンス:', responseData);
    }

    return responseData;

  } catch (error) {
    console.error('Pay.jp 支払い確定リクエスト中にエラーが発生しました:', error);
    // エラーの種類に応じてメッセージを変更することも可能
    if (error instanceof Error && error.message.startsWith('Pay.jp APIエラー')) {
      throw error; // Pay.jpからのエラーはそのままスロー
    }
    throw new Error('支払い確定中にエラーが発生しました。');
  }
};

/**
 * 確保された与信枠を解放します
 *
 * @param {string} chargeId - 与信枠が確保された支払いID
 * @returns {Promise<object>} 解放された支払い情報
 * @throws {Error} APIリクエストまたは与信枠解放に失敗した場合
 */
export const releaseAuthorization = async (chargeId) => {
  // 環境変数から秘密鍵を取得
  const secretKey = process.env.PAYJP_SECRET_KEY;
  if (!secretKey) {
    console.error('エラー: PAYJP_SECRET_KEY 環境変数が設定されていません。');
    throw new Error('サーバー設定エラーが発生しました。');
  }

  // Basic認証ヘッダー用の文字列を生成
  const authHeader = `Basic ${Buffer.from(secretKey + ':').toString('base64')}`;

  // Pay.jp APIエンドポイント（refund）
  const apiUrl = `https://api.pay.jp/v1/charges/${chargeId}/refund`;

  try {
    // Node.jsのfetchを使用してAPIリクエスト
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const responseData = await response.json();

    if (!response.ok) {
      // Pay.jpからのエラーレスポンス
      const errorMessage = responseData.error?.message || `Pay.jp APIエラー (ステータス: ${response.status})`;
      console.error('Pay.jp 与信枠解放エラー:', responseData.error);
      throw new Error(errorMessage);
    }

    // 成功した場合はChargeオブジェクトを返す（refunded: trueであるべき）
    if (responseData.refunded !== true) {
      console.warn('予期しない与信枠解放レスポンス:', responseData);
    }

    return responseData;

  } catch (error) {
    console.error('Pay.jp 与信枠解放リクエスト中にエラーが発生しました:', error);
    // エラーの種類に応じてメッセージを変更することも可能
    if (error instanceof Error && error.message.startsWith('Pay.jp APIエラー')) {
      throw error; // Pay.jpからのエラーはそのままスロー
    }
    throw new Error('与信枠解放中にエラーが発生しました。');
  }
};