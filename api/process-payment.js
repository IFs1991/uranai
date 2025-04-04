// src/api/process-payment.js
import { createCharge } from '../lib/payjp-api';
import { generatePdfForUser } from '../api/generate-pdf';

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

    // 必須項目の検証
    if (!token) {
      return res.status(400).json({
        success: false,
        error: '決済トークンが見つかりません'
      });
    }

    if (!userData || !userData.name || !userData.email || !userData.birthDate) {
      return res.status(400).json({
        success: false,
        error: 'ユーザー情報が不完全です'
      });
    }

    // 固定金額の設定（10,000円）
    const amount = 10000;
    const currency = 'jpy';
    const description = 'ライフサイクル・ポテンシャル占術 詳細鑑定PDF';

    // 決済処理をタイムアウトと競争
    const chargeResult = await Promise.race([
      createCharge({
        token,
        amount,
        currency,
        description,
        metadata: {
          customer_name: userData.name,
          customer_email: userData.email
        }
      }),
      timeoutPromise
    ]);

    // 決済成功時
    if (chargeResult && chargeResult.paid) {
      // トランザクションID生成
      const transactionId = `TRX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // PDF生成をバックグラウンドで開始
      // 注: 実際の実装ではメッセージキューなどを使用することが推奨されます
      try {
        // PDF生成を非同期で開始（結果を待たない）
        generatePdfForUser({
          userData,
          transactionId,
          chargeId: chargeResult.id
        }).catch(error => {
          console.error('PDF生成処理でエラーが発生しました:', error);
          // ここではエラーをスローしないでログのみ
        });

        return res.status(200).json({
          success: true,
          message: '決済が完了しました。詳細鑑定PDFを生成しています。',
          transactionId,
          chargeId: chargeResult.id
        });
      } catch (pdfError) {
        // PDF生成開始時のエラー（通常は起こりづらい）
        console.error('PDF生成の開始に失敗しました:', pdfError);
        return res.status(200).json({
          success: true,
          message: '決済は完了しましたが、PDF生成の開始に問題が発生しました。サポートにお問い合わせください。',
          transactionId,
          chargeId: chargeResult.id,
          pdfError: true
        });
      }
    } else {
      // 決済が未完了またはエラー
      return res.status(400).json({
        success: false,
        error: '決済処理に失敗しました',
        details: chargeResult
      });
    }
  } catch (error) {
    // エラーの種類に応じたハンドリング
    if (error.message === 'Request timeout') {
      return res.status(408).json({
        success: false,
        error: '決済処理がタイムアウトしました。ネットワーク状況をご確認ください。'
      });
    }

    // Pay.jpからのエラー応答
    if (error.response && error.response.data) {
      const errorData = error.response.data;
      return res.status(400).json({
        success: false,
        error: '決済サービスからエラーが返されました',
        details: {
          code: errorData.error.code,
          message: errorData.error.message
        }
      });
    }

    // その他の予期せぬエラー
    console.error('決済処理中に予期せぬエラーが発生しました:', error);
    return res.status(500).json({
      success: false,
      error: '決済処理中にサーバーエラーが発生しました',
      message: process.env.NODE_ENV === 'development' ? error.message : '内部サーバーエラー'
    });
  }
}