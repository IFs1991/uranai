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
 * @param {boolean} [params.threeDSecure=false] - 3Dセキュアを有効にするかどうか
 * @returns {Promise<object>} Pay.jpのChargeオブジェクト
 * @throws {Error} APIリクエストまたは決済処理に失敗した場合
 */
export const createCharge = async ({ token, amount, currency = 'jpy', description = '', metadata, threeDSecure = false }) => {
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

  // 3Dセキュアを有効にする場合
  if (threeDSecure) {
    bodyParams.set('three_d_secure', 'true');
  }

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
 * @param {boolean} [params.threeDSecure=false] - 3Dセキュアを有効にするかどうか
 * @returns {Promise<object>} Pay.jpのChargeオブジェクト (captured: false)
 * @throws {Error} APIリクエストまたは与信枠確保に失敗した場合
 */
export const createAuthorization = async ({
  token,
  amount,
  currency = 'jpy',
  description = '',
  metadata,
  expiryDays = 7,
  threeDSecure = false
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

  // 3Dセキュアを有効にする場合
  if (threeDSecure) {
    bodyParams.set('three_d_secure', 'true');
  }

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

/**
 * 指定されたトークンの詳細情報を取得します
 * 3Dセキュアのステータス確認などに使用します
 *
 * @param {string} tokenId - Pay.jpトークンID
 * @returns {Promise<object>} トークンの詳細情報
 * @throws {Error} APIリクエストまたは取得に失敗した場合
 */
export const getTokenDetails = async (tokenId) => {
  // 環境変数から秘密鍵を取得
  const secretKey = process.env.PAYJP_SECRET_KEY;
  if (!secretKey) {
    console.error('エラー: PAYJP_SECRET_KEY 環境変数が設定されていません。');
    throw new Error('サーバー設定エラーが発生しました。');
  }

  // Basic認証ヘッダー用の文字列を生成
  const authHeader = `Basic ${Buffer.from(secretKey + ':').toString('base64')}`;

  // Pay.jp APIエンドポイント
  const apiUrl = `https://api.pay.jp/v1/tokens/${tokenId}`;

  try {
    // Node.jsのfetchを使用してAPIリクエスト
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader
      }
    });

    const responseData = await response.json();

    if (!response.ok) {
      // Pay.jpからのエラーレスポンス
      const errorMessage = responseData.error?.message || `Pay.jp APIエラー (ステータス: ${response.status})`;
      console.error('Pay.jp トークン取得エラー:', responseData.error);
      throw new Error(errorMessage);
    }

    return responseData;

  } catch (error) {
    console.error('Pay.jp トークン取得リクエスト中にエラーが発生しました:', error);
    if (error instanceof Error && error.message.startsWith('Pay.jp APIエラー')) {
      throw error; // Pay.jpからのエラーはそのままスロー
    }
    throw new Error('トークン情報の取得中にエラーが発生しました。');
  }
};

/**
 * トークンの3Dセキュア認証状態を確認する関数
 * @deprecated トークン作成時の3Dセキュアは非推奨です。代わりに支払い作成時の3Dセキュア（createChargeまたはcreateAuthorizationにthreeDSecure=trueを指定）を使用してください。
 * @param {string} tokenId - トークンID
 * @returns {Promise<string>} - 3Dセキュアステータス ('unverified', 'verified', 'failed'のいずれか)
 * @throws {Error} - API通信エラーまたはタイムアウト時にスロー
 */
export async function check3DSecureStatus(tokenId) {
  console.warn('トークン作成時の3Dセキュアは非推奨です。代わりに支払い作成時の3Dセキュア（createChargeまたはcreateAuthorizationにthreeDSecure=trueを指定）を使用してください。');
  try {
    // トークン詳細を取得
    const tokenData = await getTokenDetails(tokenId);

    // 3Dセキュアステータスを返す
    return tokenData.card.three_d_secure_status || 'none';
  } catch (error) {
    console.error('3Dセキュアステータス確認中にエラーが発生しました:', error);
    throw new Error('3Dセキュアステータスの確認中にエラーが発生しました。');
  }
}

/**
 * 3Dセキュア認証URLを生成する関数
 * @deprecated トークン作成時の3Dセキュアは非推奨です。代わりに支払い作成時の3Dセキュア（createChargeまたはcreateAuthorizationにthreeDSecure=trueを指定）を使用してください。
 * @param {Object} params - URLの生成に必要なパラメーター
 * @param {string} params.tokenId - トークンID
 * @param {string} params.returnUrl - 認証後のリダイレクト先URL
 * @returns {Promise<string>} - 3Dセキュア認証URL
 * @throws {Error} - API通信エラーまたはパラメーター不足時にスロー
 */
export async function generate3DSecureUrl({ tokenId, returnUrl }) {
  console.warn('トークン作成時の3Dセキュアは非推奨です。代わりに支払い作成時の3Dセキュア（createChargeまたはcreateAuthorizationにthreeDSecure=trueを指定）を使用してください。');
  // パラメーターのバリデーション
  if (!tokenId) {
    throw new Error('トークンIDは必須です。');
  }

  if (!returnUrl) {
    throw new Error('リダイレクト先URLは必須です。');
  }

  try {
    // Pay.jp APIのURL形式に変換
    return `https://api.pay.jp/v1/tokens/${tokenId}/three_d_secure?redirect_url=${encodeURIComponent(returnUrl)}`;
  } catch (error) {
    console.error('3Dセキュア認証URL生成中にエラーが発生しました:', error);
    throw new Error('3Dセキュア認証URLの生成中にエラーが発生しました。');
  }
}

/**
 * 3Dセキュア認証を完了する関数
 * @deprecated トークン作成時の3Dセキュアは非推奨です。代わりに支払い作成時の3Dセキュア（createChargeまたはcreateAuthorizationにthreeDSecure=trueを指定）を使用してください。
 * @param {string} tokenId - トークンID
 * @returns {Promise<Object>} - 更新されたトークン情報
 * @throws {Error} - API通信エラーまたはタイムアウト時にスロー
 */
export async function complete3DSecure(tokenId) {
  console.warn('トークン作成時の3Dセキュアは非推奨です。代わりに支払い作成時の3Dセキュア（createChargeまたはcreateAuthorizationにthreeDSecure=trueを指定）を使用してください。');
  try {
    // トークン詳細を取得して状態を確認
    const tokenData = await getTokenDetails(tokenId);

    // 3Dセキュアステータスを確認
    if (tokenData.card.three_d_secure_status !== 'verified') {
      throw new Error(`3Dセキュア認証が完了していません。現在のステータス: ${tokenData.card.three_d_secure_status || 'なし'}`);
    }

    return tokenData;
  } catch (error) {
    console.error('3Dセキュア完了処理中にエラーが発生しました:', error);

    // Pay.jp APIからのエラーの場合はそのまま返す
    if (error.message.startsWith('Pay.jp APIエラー')) {
      throw error;
    }

    throw new Error('3Dセキュア完了処理中にエラーが発生しました。');
  }
}

/**
 * 支払いの詳細情報を取得します
 *
 * @param {string} chargeId - 支払いID
 * @returns {Promise<object>} 支払いの詳細情報
 * @throws {Error} APIリクエストまたは取得に失敗した場合
 */
export const getChargeDetails = async (chargeId) => {
  // 環境変数から秘密鍵を取得
  const secretKey = process.env.PAYJP_SECRET_KEY;
  if (!secretKey) {
    console.error('エラー: PAYJP_SECRET_KEY 環境変数が設定されていません。');
    throw new Error('サーバー設定エラーが発生しました。');
  }

  // Basic認証ヘッダー用の文字列を生成
  const authHeader = `Basic ${Buffer.from(secretKey + ':').toString('base64')}`;

  // Pay.jp APIエンドポイント
  const apiUrl = `https://api.pay.jp/v1/charges/${chargeId}`;

  try {
    // Node.jsのfetchを使用してAPIリクエスト
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader
      }
    });

    const responseData = await response.json();

    if (!response.ok) {
      // Pay.jpからのエラーレスポンス
      const errorMessage = responseData.error?.message || `Pay.jp APIエラー (ステータス: ${response.status})`;
      console.error('Pay.jp 支払い取得エラー:', responseData.error);
      throw new Error(errorMessage);
    }

    return responseData;

  } catch (error) {
    console.error('Pay.jp 支払い取得リクエスト中にエラーが発生しました:', error);
    if (error instanceof Error && error.message.startsWith('Pay.jp APIエラー')) {
      throw error; // Pay.jpからのエラーはそのままスロー
    }
    throw new Error('支払い情報の取得中にエラーが発生しました。');
  }
};

/**
 * 支払いの3Dセキュアステータスを確認します
 *
 * @param {string} chargeId - 支払いID
 * @returns {Promise<object>} 3Dセキュアステータス情報
 * @throws {Error} APIリクエストまたは取得に失敗した場合
 */
export const checkCharge3DSecureStatus = async (chargeId) => {
  try {
    const chargeDetails = await getChargeDetails(chargeId);

    // 3Dセキュアステータスを確認
    const threeDSecureStatus = chargeDetails.three_d_secure_status || 'none';

    // 戻り値の準備
    const result = {
      chargeId: chargeId,
      status: threeDSecureStatus,
      needsAuth: threeDSecureStatus === 'unverified', // 認証が必要かどうか
      isComplete: ['verified', 'attempted'].includes(threeDSecureStatus), // 認証完了しているか
      hasError: threeDSecureStatus === 'error', // エラーがあるか
      isPaid: chargeDetails.paid === true, // 支払いが完了しているかどうか
      amount: chargeDetails.amount,
      currency: chargeDetails.currency,
      cardInfo: {
        brand: chargeDetails.card?.brand,
        last4: chargeDetails.card?.last4
      }
    };

    return result;
  } catch (error) {
    console.error('支払いの3Dセキュアステータス確認中にエラーが発生しました:', error);
    if (error instanceof Error && error.message.startsWith('Pay.jp APIエラー')) {
      throw error; // Pay.jpからのエラーはそのままスロー
    }
    throw new Error('支払いの3Dセキュアステータスの確認中にエラーが発生しました。');
  }
};

/**
 * 支払いの3Dセキュアサブウィンドウ認証用URLを取得します
 *
 * @param {string} chargeId - 支払いID
 * @returns {Promise<string>} 3Dセキュアサブウィンドウ認証用URL
 * @throws {Error} APIリクエストまたは取得に失敗した場合
 */
export const getCharge3DSecureSubWindowUrl = async (chargeId) => {
  // 環境変数から公開鍵を取得
  const publicKey = process.env.PAYJP_PUBLIC_KEY;
  if (!publicKey) {
    console.error('エラー: PAYJP_PUBLIC_KEY 環境変数が設定されていません。');
    throw new Error('サーバー設定エラーが発生しました。');
  }

  // 3Dセキュアサブウィンドウ認証用URLを作成
  const url = `https://js.pay.jp/v2/popups/3ds_auth.html?pk=${publicKey}&charge=${chargeId}`;
  return url;
};

/**
 * 支払いの3Dセキュア認証用のリダイレクトURLを生成します
 *
 * @param {object} params - パラメータ
 * @param {string} params.chargeId - 支払いID
 * @param {string} params.returnUrl - 認証後のリダイレクト先URL
 * @returns {Promise<string>} 3Dセキュア認証用のURL
 * @throws {Error} APIリクエストまたは処理に失敗した場合
 */
export const generateCharge3DSecureUrl = async ({ chargeId, returnUrl }) => {
  // 環境変数から秘密鍵を取得
  const secretKey = process.env.PAYJP_SECRET_KEY;
  if (!secretKey) {
    console.error('エラー: PAYJP_SECRET_KEY 環境変数が設定されていません。');
    throw new Error('サーバー設定エラーが発生しました。');
  }

  // Basic認証ヘッダー用の文字列を生成
  const authHeader = `Basic ${Buffer.from(secretKey + ':').toString('base64')}`;

  // Pay.jp APIエンドポイント
  const apiUrl = `https://api.pay.jp/v1/charges/${chargeId}/tds_authorize`;

  // リクエストボディの準備
  const bodyParams = new URLSearchParams({
    return_url: returnUrl
  });

  try {
    // Node.jsのfetchを使用してAPIリクエスト
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: bodyParams.toString()
    });

    const responseData = await response.json();

    if (!response.ok) {
      // Pay.jpからのエラーレスポンス
      const errorMessage = responseData.error?.message || `Pay.jp APIエラー (ステータス: ${response.status})`;
      console.error('Pay.jp 支払い3Dセキュア認証URL生成エラー:', responseData.error);
      throw new Error(errorMessage);
    }

    // 認証URLを返す
    return responseData.url;

  } catch (error) {
    console.error('Pay.jp 支払い3Dセキュア認証URL生成中にエラーが発生しました:', error);
    if (error instanceof Error && error.message.startsWith('Pay.jp APIエラー')) {
      throw error; // Pay.jpからのエラーはそのままスロー
    }
    throw new Error('支払いの3Dセキュア認証URLの生成中にエラーが発生しました。');
  }
};

/**
 * 支払いの3Dセキュア認証完了処理を行います
 *
 * @param {string} chargeId - 支払いID
 * @returns {Promise<object>} 完了後の支払い情報
 * @throws {Error} APIリクエストまたは処理に失敗した場合
 */
export const completeCharge3DSecure = async (chargeId) => {
  // 環境変数から秘密鍵を取得
  const secretKey = process.env.PAYJP_SECRET_KEY;
  if (!secretKey) {
    console.error('エラー: PAYJP_SECRET_KEY 環境変数が設定されていません。');
    throw new Error('サーバー設定エラーが発生しました。');
  }

  // Basic認証ヘッダー用の文字列を生成
  const authHeader = `Basic ${Buffer.from(secretKey + ':').toString('base64')}`;

  // Pay.jp APIエンドポイント
  const apiUrl = `https://api.pay.jp/v1/charges/${chargeId}/tds_finish`;

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
      console.error('Pay.jp 支払い3Dセキュア完了処理エラー:', responseData.error);
      throw new Error(errorMessage);
    }

    return responseData;

  } catch (error) {
    console.error('Pay.jp 支払い3Dセキュア完了処理中にエラーが発生しました:', error);
    if (error instanceof Error && error.message.startsWith('Pay.jp APIエラー')) {
      throw error; // Pay.jpからのエラーはそのままスロー
    }
    throw new Error('支払いの3Dセキュア完了処理中にエラーが発生しました。');
  }
};