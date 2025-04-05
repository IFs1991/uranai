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