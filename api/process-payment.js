// src/api/process-payment.js
import { createCharge, createAuthorization, capturePayment, releaseAuthorization } from '../lib/payjp-api';
import { kv } from '../lib/kv-store'; // KVストアクライアントをインポート

// タイムアウト設定（15秒）
const TIMEOUT_DURATION = 15000;

/**
 * 決済処理を行うサーバーレス関数
 *
 * 機能：
 * 1. 通常の決済処理 (capture=true, デフォルト): パラメータに authOnly=false または指定なし
 * 2. 与信枠確保のみ (capture=false): パラメータに authOnly=true
 * 3. 確保された与信枠の確定: パスに /capture/{chargeId} が含まれる
 * 4. 確保された与信枠の解放: パスに /release/{chargeId} が含まれる
 *
 * @param {Object} req - リクエストオブジェクト
 * @param {Object} res - レスポンスオブジェクト
 */
export default async function handler(req, res) {
  // パスからアクションを特定
  const { url } = req;

  // キャプチャ（確定）または解放リクエストの処理
  if (url) {
    // キャプチャリクエスト
    const captureMatch = url.match(/\/capture\/([^\/]+)$/);
    if (captureMatch && captureMatch[1]) {
      return await handleCaptureRequest(req, res, captureMatch[1]);
    }

    // 解放リクエスト
    const releaseMatch = url.match(/\/release\/([^\/]+)$/);
    if (releaseMatch && releaseMatch[1]) {
      return await handleReleaseRequest(req, res, releaseMatch[1]);
    }
  }

  // 通常の決済リクエストまたは与信枠確保リクエスト
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed'
    });
  }

  // リクエストボディから与信枠確保のみか判定
  const { authOnly } = req.body;

  if (authOnly === true) {
    // 与信枠確保のみのリクエスト
    return await handleAuthorizationRequest(req, res);
  } else {
    // 通常の決済リクエスト
    return await handlePaymentRequest(req, res);
  }
}

/**
 * 通常の決済リクエストを処理（キャプチャ込み）
 */
async function handlePaymentRequest(req, res) {
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
          customer_email: userData.email,
          birthDate: userData.birthDate,
          // 必要であれば他のuserData情報も追加可能
          birthplace: userData.birthplace || '不明'
        }
      }),
      timeoutPromise
    ]);

    // 決済成功時のレスポンス (chargeResult全体ではなく、paidフラグで確認)
    if (chargeResult && chargeResult.paid) {
      // トランザクションID生成 (念のため簡略化)
      const transactionId = `TRX-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

      // 決済情報をKVストアに保存 (TTL 30日)
      try {
        await kv.set(`payment:${chargeResult.id}`, {
          id: chargeResult.id,
          amount,
          status: 'success',
          userData,
          timestamp: new Date().toISOString(),
          transactionId
        }, { ex: 60 * 60 * 24 * 30 }); // 30日間有効

        console.log(`決済情報をKVストアに保存しました: ${chargeResult.id}`);
      } catch (kvError) {
        console.error('KVストアへの保存に失敗しました:', kvError);
        // KVへの保存失敗は決済処理自体の失敗とはしない
      }

      // PDF生成リクエストを送信
      try {
        // サーバー内でPDF生成APIを呼び出し
        const pdfResponse = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || ''}/api/generate-pdf`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userData,
            paymentId: chargeResult.id,
            transactionId,
            email: userData.email // メール送信のためにメールアドレスを明示的に含める
          })
        });

        const pdfResult = await pdfResponse.json();

        if (!pdfResult.success) {
          console.error('PDF生成リクエストエラー:', pdfResult);
          // PDF生成エラーはログに残すが、決済自体は成功として扱う
        } else {
          console.log('PDF生成リクエスト成功:', pdfResult.jobId);
        }
      } catch (pdfError) {
        console.error('PDF生成リクエスト中にエラーが発生しました:', pdfError);
        // PDF生成リクエストエラーは決済成功とは別に処理
      }

      // 成功レスポンス
      return res.status(200).json({
        success: true,
        message: '決済が完了しました。PDF生成を開始します。',
        paymentId: chargeResult.id,
        transactionId: transactionId
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

/**
 * 与信枠確保のみのリクエストを処理（キャプチャなし）
 */
async function handleAuthorizationRequest(req, res) {
  // タイムアウト処理の設定
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout')), TIMEOUT_DURATION);
  });

  try {
    // リクエストボディからトークンとユーザー情報を取得
    const { token, userData, expiryDays } = req.body;

    // 必須項目の検証
    if (!token) {
      return res.status(400).json({
        success: false,
        error: '決済トークンが見つかりません'
      });
    }

    // userData の検証
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

    // 固定金額と通貨
    const amount = 10000;
    const currency = 'jpy';
    const description = 'ライフサイクル・ポテンシャル占術 詳細鑑定PDF（与信枠確保）';

    // 与信枠確保処理をタイムアウトと競争
    const authResult = await Promise.race([
      createAuthorization({
        token,
        amount,
        currency,
        description,
        metadata: {
          customer_name: userData.name,
          customer_email: userData.email,
          birthDate: userData.birthDate,
          birthplace: userData.birthplace || '不明'
        },
        expiryDays: expiryDays || 7 // デフォルトは7日間
      }),
      timeoutPromise
    ]);

    // 与信枠確保成功時のレスポンス
    if (authResult && authResult.paid && !authResult.captured) {
      // トランザクションID生成
      const transactionId = `AUTH-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

      // 与信枠確保情報をKVストアに保存
      try {
        await kv.set(`auth:${authResult.id}`, {
          id: authResult.id,
          amount,
          status: 'authorized',
          userData,
          timestamp: new Date().toISOString(),
          transactionId,
          expiryDate: new Date(Date.now() + ((expiryDays || 7) * 24 * 60 * 60 * 1000)).toISOString()
        }, { ex: 60 * 60 * 24 * 60 }); // 最大60日間有効

        console.log(`与信枠確保情報をKVストアに保存しました: ${authResult.id}`);
      } catch (kvError) {
        console.error('KVストアへの保存に失敗しました:', kvError);
      }

      // 成功レスポンス
      return res.status(200).json({
        success: true,
        message: '与信枠の確保が完了しました。',
        authorizationId: authResult.id,
        transactionId: transactionId,
        expiryDays: expiryDays || 7
      });
    } else {
      // 与信枠確保が失敗した場合
      console.error('与信枠確保失敗:', authResult);
      const errorMessage = authResult?.failure_message || authResult?.error?.message || '与信枠確保に失敗しました';
      return res.status(400).json({
        success: false,
        error: errorMessage,
        details: authResult
      });
    }
  } catch (error) {
    console.error('与信枠確保中にエラーが発生しました:', error);

    // タイムアウトエラー
    if (error.message === 'Request timeout') {
      return res.status(408).json({
        success: false,
        error: '与信枠確保がタイムアウトしました。ネットワーク状況を確認して再試行してください。'
      });
    }

    // Pay.jp APIからの特定のエラー
    if (error.message.startsWith('Pay.jp APIエラー') || error.message === '与信枠確保中にエラーが発生しました。' || error.message === 'サーバー設定エラーが発生しました。') {
       return res.status(400).json({
        success: false,
        error: '決済サービスでエラーが発生しました。',
        details: error.message
      });
    }

    // その他の予期せぬサーバーエラー
    return res.status(500).json({
      success: false,
      error: '与信枠確保中にサーバー内部エラーが発生しました。',
      message: process.env.NODE_ENV === 'development' ? error.message : '内部サーバーエラー'
    });
  }
}

/**
 * 確保された与信枠を確定するリクエストを処理
 */
async function handleCaptureRequest(req, res, chargeId) {
  // POSTメソッド以外は許可しない
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed'
    });
  }

  try {
    // リクエストボディから確定金額を取得（任意）
    const { amount } = req.body;

    // KVストアから与信枠情報を取得（確認用）
    let authInfo = null;
    try {
      authInfo = await kv.get(`auth:${chargeId}`);
    } catch (kvError) {
      console.warn('KVストアからの与信枠情報取得に失敗しました:', kvError);
      // KVからの取得失敗は処理を続行
    }

    // 与信枠が存在するか確認（KVにない場合もAPI呼び出しは実行）
    if (!authInfo) {
      console.warn(`与信枠情報がKVストアに見つかりません: ${chargeId}`);
    }

    // 支払い確定処理
    const captureResult = await capturePayment(chargeId, amount || null);

    if (captureResult && captureResult.captured) {
      // KVストアの情報を更新
      if (authInfo) {
        try {
          // 与信枠情報を更新
          await kv.set(`auth:${chargeId}`, {
            ...authInfo,
            status: 'captured',
            capturedAmount: captureResult.amount,
            captureTimestamp: new Date().toISOString()
          }, { ex: 60 * 60 * 24 * 30 }); // 30日間有効

          // 通常の決済情報としても保存
          await kv.set(`payment:${chargeId}`, {
            id: chargeId,
            amount: captureResult.amount,
            status: 'success',
            userData: authInfo.userData,
            timestamp: new Date().toISOString(),
            transactionId: authInfo.transactionId || `CAP-${Date.now()}`
          }, { ex: 60 * 60 * 24 * 30 }); // 30日間有効

          console.log(`支払い確定情報をKVストアに保存しました: ${chargeId}`);
        } catch (kvError) {
          console.error('KVストアへの保存に失敗しました:', kvError);
        }
      }

      // PDF生成リクエストを送信（userData情報がある場合のみ）
      if (authInfo && authInfo.userData) {
        try {
          const pdfResponse = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || ''}/api/generate-pdf`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              userData: authInfo.userData,
              paymentId: chargeId,
              transactionId: authInfo.transactionId || `CAP-${Date.now()}`,
              email: authInfo.userData.email
            })
          });

          const pdfResult = await pdfResponse.json();

          if (!pdfResult.success) {
            console.error('PDF生成リクエストエラー:', pdfResult);
          } else {
            console.log('PDF生成リクエスト成功:', pdfResult.jobId);
          }
        } catch (pdfError) {
          console.error('PDF生成リクエスト中にエラーが発生しました:', pdfError);
        }
      }

      // 成功レスポンス
      return res.status(200).json({
        success: true,
        message: '支払いが確定されました。',
        paymentId: chargeId,
        amount: captureResult.amount,
        capturedAmount: captureResult.amount_captured || captureResult.amount,
        refundedAmount: captureResult.amount_refunded || 0
      });
    } else {
      // 確定に失敗した場合
      console.error('支払い確定失敗:', captureResult);
      const errorMessage = captureResult?.failure_message || captureResult?.error?.message || '支払い確定に失敗しました';
      return res.status(400).json({
        success: false,
        error: errorMessage,
        details: captureResult
      });
    }
  } catch (error) {
    console.error('支払い確定中にエラーが発生しました:', error);

    // Pay.jp APIからの特定のエラー
    if (error.message.startsWith('Pay.jp APIエラー') || error.message === '支払い確定中にエラーが発生しました。' || error.message === 'サーバー設定エラーが発生しました。') {
      return res.status(400).json({
        success: false,
        error: '決済サービスでエラーが発生しました。',
        details: error.message
      });
    }

    // その他の予期せぬサーバーエラー
    return res.status(500).json({
      success: false,
      error: '支払い確定中にサーバー内部エラーが発生しました。',
      message: process.env.NODE_ENV === 'development' ? error.message : '内部サーバーエラー'
    });
  }
}

/**
 * 確保された与信枠を解放するリクエストを処理
 */
async function handleReleaseRequest(req, res, chargeId) {
  // POSTメソッド以外は許可しない
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed'
    });
  }

  try {
    // KVストアから与信枠情報を取得（確認用）
    let authInfo = null;
    try {
      authInfo = await kv.get(`auth:${chargeId}`);
    } catch (kvError) {
      console.warn('KVストアからの与信枠情報取得に失敗しました:', kvError);
    }

    // 与信枠が存在するか確認（KVにない場合もAPI呼び出しは実行）
    if (!authInfo) {
      console.warn(`与信枠情報がKVストアに見つかりません: ${chargeId}`);
    }

    // 与信枠解放処理
    const releaseResult = await releaseAuthorization(chargeId);

    if (releaseResult && releaseResult.refunded) {
      // KVストアの情報を更新
      if (authInfo) {
        try {
          await kv.set(`auth:${chargeId}`, {
            ...authInfo,
            status: 'released',
            releasedAmount: releaseResult.amount_refunded,
            releaseTimestamp: new Date().toISOString()
          }, { ex: 60 * 60 * 24 * 7 }); // 7日間だけ保持

          console.log(`与信枠解放情報をKVストアに保存しました: ${chargeId}`);
        } catch (kvError) {
          console.error('KVストアへの保存に失敗しました:', kvError);
        }
      }

      // 成功レスポンス
      return res.status(200).json({
        success: true,
        message: '与信枠が解放されました。',
        chargeId: chargeId,
        refundedAmount: releaseResult.amount_refunded
      });
    } else {
      // 解放に失敗した場合
      console.error('与信枠解放失敗:', releaseResult);
      const errorMessage = releaseResult?.failure_message || releaseResult?.error?.message || '与信枠解放に失敗しました';
      return res.status(400).json({
        success: false,
        error: errorMessage,
        details: releaseResult
      });
    }
  } catch (error) {
    console.error('与信枠解放中にエラーが発生しました:', error);

    // Pay.jp APIからの特定のエラー
    if (error.message.startsWith('Pay.jp APIエラー') || error.message === '与信枠解放中にエラーが発生しました。' || error.message === 'サーバー設定エラーが発生しました。') {
      return res.status(400).json({
        success: false,
        error: '決済サービスでエラーが発生しました。',
        details: error.message
      });
    }

    // その他の予期せぬサーバーエラー
    return res.status(500).json({
      success: false,
      error: '与信枠解放中にサーバー内部エラーが発生しました。',
      message: process.env.NODE_ENV === 'development' ? error.message : '内部サーバーエラー'
    });
  }
}