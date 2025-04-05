// src/api/process-payment.js
import { createCharge } from '../lib/payjp-api';

// タイムアウト設定（15秒）
const TIMEOUT_DURATION = 15000;

/**
 * 決済処理を行うサーバーレス関数
 *
 * @param {Object} req - リクエストオブジェクト
 * @param {Object} res - レスポンスオブジェクト
 */
export default async function handler(req, res) {
  // POSTメソッド以外は許可しない
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed'
    });
  }

  // タイムアウト処理の設定
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout')), TIMEOUT_DURATION);
  });

  try {
    // リクエストボディからトークンとユーザー情報を取得
    const { token, userData } = req.body;

    // 必須項目の検証 (pay_jp.yaml に合わせて厳密化)
    if (!token) {
      return res.status(400).json({
        success: false,
        error: '決済トークンが見つかりません'
      });
    }

    // userData の検証を強化
    if (!userData || typeof userData !== 'object') {
       return res.status(400).json({
        success: false,
        error: 'ユーザー情報が必要です'
      });
    }
    const requiredFields = ['name', 'email', 'birthDate'];
    const missingFields = requiredFields.filter(field => !(field in userData) || !userData[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `ユーザー情報が不完全です: 不足している項目 (${missingFields.join(', ')})`
      });
    }

    // 固定金額と通貨 (pay_jp.yaml から)
    const amount = 10000;
    const currency = 'jpy';
    const description = 'ライフサイクル・ポテンシャル占術 詳細鑑定PDF';

    // 決済処理をタイムアウトと競争
    // metadataのキーをyamlに合わせる (customer_name, customer_email)
    const chargeResult = await Promise.race([
      createCharge({
        token,
        amount,
        currency,
        description,
        metadata: {
          customer_name: userData.name,
          customer_email: userData.email
          // 必要であれば他のuserData情報も追加可能
          // birthDate: userData.birthDate,
          // birthplace: userData.birthplace,
        }
      }),
      timeoutPromise
    ]);

    // 決済成功時のレスポンス (chargeResult全体ではなく、paidフラグで確認)
    if (chargeResult && chargeResult.paid) {
      // トランザクションID生成 (念のため簡略化)
      const transactionId = `TRX-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

      // 成功レスポンス (クライアントはこれを受けてPDF生成に進む)
      return res.status(200).json({
        success: true,
        message: '決済が完了しました。PDF生成を開始します。',
        paymentId: chargeResult.id, // paymentIdとしてcharge.idを返す
        transactionId: transactionId // 念のためトランザクションIDも返す
      });
    } else {
      // 決済が失敗した場合 (chargeResultにエラー情報が含まれる場合がある)
      console.error('決済失敗:', chargeResult);
      // chargeResultが存在しない、またはpaidでない場合
      const errorMessage = chargeResult?.failure_message || chargeResult?.error?.message || '決済処理に失敗しました';
      return res.status(400).json({
        success: false,
        error: errorMessage,
        details: chargeResult // 詳細情報も返す
      });
    }
  } catch (error) {
    console.error('決済処理中にエラーが発生しました:', error);

    // タイムアウトエラー
    if (error.message === 'Request timeout') {
      return res.status(408).json({
        success: false,
        error: '決済処理がタイムアウトしました。ネットワーク状況を確認して再試行してください。'
      });
    }

    // Pay.jp APIからの特定のエラー (createCharge内でスローされたもの)
    if (error.message.startsWith('Pay.jp APIエラー') || error.message === '決済サービスへの接続中にエラーが発生しました。' || error.message === 'サーバー設定エラーが発生しました。') {
       return res.status(400).json({
        success: false,
        error: '決済サービスでエラーが発生しました。',
        details: error.message // エラー詳細を返す
      });
    }

    // その他の予期せぬサーバーエラー
    return res.status(500).json({
      success: false,
      error: '決済処理中にサーバー内部エラーが発生しました。',
      // 本番環境では詳細なエラーメッセージを隠蔽する
      message: process.env.NODE_ENV === 'development' ? error.message : '内部サーバーエラー'
    });
  }
}