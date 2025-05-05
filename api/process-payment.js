// src/api/process-payment.js
import { createCharge, createAuthorization, capturePayment, releaseAuthorization, check3DSecureStatus, generate3DSecureUrl, complete3DSecure, getChargeDetails, checkCharge3DSecureStatus, getCharge3DSecureSubWindowUrl, generateCharge3DSecureUrl, completeCharge3DSecure } from '../lib/payjp-api';
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
 * 5. 3Dセキュア確認: パスに /check-3d-secure/{tokenId} が含まれる
 * 6. 3Dセキュア完了: パスに /complete-3d-secure/{tokenId} が含まれる
 * 7. 支払いの3Dセキュア確認: パスに /check-charge-3d-secure/{chargeId} が含まれる
 * 8. 支払いの3Dセキュア完了: パスに /complete-charge-3d-secure/{chargeId} が含まれる
 * 9. 3Dセキュアサブウィンドウ設定取得: パスに /3d-secure-subwindow-config/{chargeId} が含まれる
 *
 * @param {Object} req - リクエストオブジェクト
 * @param {Object} res - レスポンスオブジェクト
 */
export default async function handler(req, res) {
  // パスからアクションを特定
  const { url } = req;

  // 3Dセキュアリクエストの処理
  if (url) {
    // 支払いの3Dセキュア関連
    // 支払いの3Dセキュアステータス確認リクエスト
    const checkCharge3DSecureMatch = url.match(/\/check-charge-3d-secure\/([^\/]+)$/);
    if (checkCharge3DSecureMatch && checkCharge3DSecureMatch[1]) {
      return await handleCheckCharge3DSecureRequest(req, res, checkCharge3DSecureMatch[1]);
    }

    // 支払いの3Dセキュア完了リクエスト
    const completeCharge3DSecureMatch = url.match(/\/complete-charge-3d-secure\/([^\/]+)$/);
    if (completeCharge3DSecureMatch && completeCharge3DSecureMatch[1]) {
      return await handleCompleteCharge3DSecureRequest(req, res, completeCharge3DSecureMatch[1]);
    }

    // 3Dセキュアサブウィンドウ設定取得リクエスト
    const subWindowConfigMatch = url.match(/\/3d-secure-subwindow-config\/([^\/]+)$/);
    if (subWindowConfigMatch && subWindowConfigMatch[1]) {
      return await handle3DSecureSubWindowConfigRequest(req, res, subWindowConfigMatch[1]);
    }

    // トークンの3Dセキュア関連
    // 3Dセキュアステータス確認リクエスト
    const check3DSecureMatch = url.match(/\/check-3d-secure\/([^\/]+)$/);
    if (check3DSecureMatch && check3DSecureMatch[1]) {
      return await handle3DSecureCheckRequest(req, res, check3DSecureMatch[1]);
    }

    // 3Dセキュア完了リクエスト
    const complete3DSecureMatch = url.match(/\/complete-3d-secure\/([^\/]+)$/);
    if (complete3DSecureMatch && complete3DSecureMatch[1]) {
      return await handle3DSecureCompleteRequest(req, res, complete3DSecureMatch[1]);
    }

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
 * 支払いの3Dセキュアステータスを確認するリクエストを処理
 */
async function handleCheckCharge3DSecureRequest(req, res, chargeId) {
  try {
    // 支払いの3Dセキュアステータス確認
    const status = await checkCharge3DSecureStatus(chargeId);

    // レスポンスを返す
    return res.status(200).json({
      success: true,
      chargeId: chargeId,
      threeDSecureStatus: status
    });
  } catch (error) {
    console.error('支払いの3Dセキュアステータス確認中にエラーが発生しました:', error);

    // Pay.jp APIからのエラー
    if (error.message.startsWith('Pay.jp APIエラー') || error.message === '支払いの3Dセキュアステータスの確認中にエラーが発生しました。') {
      return res.status(400).json({
        success: false,
        error: '支払いの3Dセキュアステータス確認中にエラーが発生しました。',
        details: error.message
      });
    }

    // その他のエラー
    return res.status(500).json({
      success: false,
      error: '支払いの3Dセキュアステータス確認中にサーバーエラーが発生しました。',
      message: process.env.NODE_ENV === 'development' ? error.message : '内部サーバーエラー'
    });
  }
}

/**
 * 支払いの3Dセキュア認証を開始するURLを生成するリクエストを処理
 */
async function handleGenerateCharge3DSecureUrlRequest(req, res) {
  try {
    // リクエストボディから支払いIDとリダイレクトURLを取得
    const { chargeId, returnUrl } = req.body;

    // 必須項目の検証
    if (!chargeId || !returnUrl) {
      return res.status(400).json({
        success: false,
        error: '支払いIDとリダイレクトURLが必要です'
      });
    }

    // 3Dセキュア認証URLの生成
    const authUrl = await generateCharge3DSecureUrl({ chargeId, returnUrl });

    // 認証URLを返す
    return res.status(200).json({
      success: true,
      chargeId: chargeId,
      authUrl: authUrl
    });
  } catch (error) {
    console.error('支払いの3Dセキュア認証URL生成中にエラーが発生しました:', error);

    // Pay.jp APIからのエラー
    if (error.message.startsWith('Pay.jp APIエラー') || error.message === '支払いの3Dセキュア認証URLの生成中にエラーが発生しました。') {
      return res.status(400).json({
        success: false,
        error: '支払いの3Dセキュア認証URL生成中にエラーが発生しました。',
        details: error.message
      });
    }

    // その他のエラー
    return res.status(500).json({
      success: false,
      error: '支払いの3Dセキュア認証URL生成中にサーバーエラーが発生しました。',
      message: process.env.NODE_ENV === 'development' ? error.message : '内部サーバーエラー'
    });
  }
}

/**
 * 支払いの3Dセキュア認証完了処理を行うリクエストを処理
 */
async function handleCompleteCharge3DSecureRequest(req, res, chargeId) {
  try {
    // 支払いの3Dセキュア完了処理
    const completedCharge = await completeCharge3DSecure(chargeId);

    // セッション情報があれば取得
    let sessionInfo = null;
    try {
      sessionInfo = await kv.get(`3dsession:charge:${chargeId}`);
    } catch (kvError) {
      console.warn('KVストアからの3Dセキュアセッション情報取得に失敗しました:', kvError);
      // KVからの取得失敗は処理を続行
    }

    // セッション情報があれば、追加の処理を行う
    if (sessionInfo) {
      try {
        // 成功情報をKVストアに保存 (TTL 30日)
        await kv.set(`payment:${chargeId}`, {
          id: chargeId,
          amount: completedCharge.amount,
          status: 'success',
          userData: sessionInfo.userData || {},
          timestamp: new Date().toISOString(),
          transactionId: sessionInfo.transactionId || `3DS-${Date.now()}`
        }, { ex: 60 * 60 * 24 * 30 }); // 30日間有効

        console.log(`3Dセキュア完了後の決済情報をKVストアに保存しました: ${chargeId}`);

        // PDF生成リクエストを送信
        if (sessionInfo.userData) {
          try {
            const pdfResponse = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || ''}/api/generate-pdf`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                userData: sessionInfo.userData,
                paymentId: chargeId,
                transactionId: sessionInfo.transactionId || `3DS-${Date.now()}`,
                email: sessionInfo.userData.email
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
      } catch (storeError) {
        console.error('3Dセキュア完了後の情報保存中にエラーが発生しました:', storeError);
      }
    }

    // 完了した支払い情報を返す
    return res.status(200).json({
      success: true,
      chargeId: chargeId,
      paid: completedCharge.paid,
      threeDSecureStatus: completedCharge.three_d_secure_status || 'unknown',
      completedCharge: completedCharge
    });
  } catch (error) {
    console.error('支払いの3Dセキュア完了処理中にエラーが発生しました:', error);

    // Pay.jp APIからのエラー
    if (error.message.startsWith('Pay.jp APIエラー') || error.message === '支払いの3Dセキュア完了処理中にエラーが発生しました。') {
      return res.status(400).json({
        success: false,
        error: '支払いの3Dセキュア完了処理中にエラーが発生しました。',
        details: error.message
      });
    }

    // その他のエラー
    return res.status(500).json({
      success: false,
      error: '支払いの3Dセキュア完了処理中にサーバーエラーが発生しました。',
      message: process.env.NODE_ENV === 'development' ? error.message : '内部サーバーエラー'
    });
  }
}

/**
 * 3Dセキュアサブウィンドウ設定を取得するリクエストを処理
 */
async function handle3DSecureSubWindowConfigRequest(req, res, chargeId) {
  try {
    // Pay.jp公開鍵の取得
    const publicKey = process.env.PAYJP_PUBLIC_KEY;
    if (!publicKey) {
      return res.status(500).json({
        success: false,
        error: 'Pay.jp公開鍵が設定されていません。'
      });
    }

    // 支払いの3Dセキュアステータス確認
    const status = await checkCharge3DSecureStatus(chargeId);

    // 3Dセキュアサブウィンドウ認証用URLを取得
    const subWindowUrl = await getCharge3DSecureSubWindowUrl(chargeId);

    // 設定情報を返す
    return res.status(200).json({
      success: true,
      chargeId: chargeId,
      publicKey: publicKey,
      threeDSecureStatus: status,
      subWindowUrl: subWindowUrl
    });
  } catch (error) {
    console.error('3Dセキュアサブウィンドウ設定取得中にエラーが発生しました:', error);

    // Pay.jp APIからのエラー
    if (error.message.startsWith('Pay.jp APIエラー')) {
      return res.status(400).json({
        success: false,
        error: '3Dセキュアサブウィンドウ設定取得中にエラーが発生しました。',
        details: error.message
      });
    }

    // その他のエラー
    return res.status(500).json({
      success: false,
      error: '3Dセキュアサブウィンドウ設定取得中にサーバーエラーが発生しました。',
      message: process.env.NODE_ENV === 'development' ? error.message : '内部サーバーエラー'
    });
  }
}

/**
 * トークンの3Dセキュアステータスを確認するリクエストを処理する関数
 * @deprecated トークン作成時の3Dセキュアは非推奨です。代わりに支払い作成時の3Dセキュアを使用してください。
 * @param {Object} req - リクエストオブジェクト
 * @param {Object} res - レスポンスオブジェクト
 * @param {string} tokenId - トークンID
 */
async function handle3DSecureCheckRequest(req, res, tokenId) {
  console.warn('トークン作成時の3Dセキュアは非推奨です。代わりに支払い作成時の3Dセキュアを使用してください。');
  try {
    const threeDSecureStatus = await check3DSecureStatus(tokenId);

    return res.status(200).json({
      success: true,
      tokenId: tokenId,
      threeDSecureStatus: threeDSecureStatus,
      message: '3Dセキュアステータスの確認が完了しました。'
    });
  } catch (error) {
    console.error('3Dセキュアステータス確認中にエラーが発生しました:', error);

    return res.status(400).json({
      success: false,
      error: '3Dセキュアステータスの確認中にエラーが発生しました。',
      details: error.message
    });
  }
}

/**
 * 3Dセキュア認証URLの生成リクエストを処理する関数
 * @deprecated トークン作成時の3Dセキュアは非推奨です。代わりに支払い作成時の3Dセキュアを使用してください。
 * @param {Object} req - リクエストオブジェクト
 * @param {Object} res - レスポンスオブジェクト
 */
async function handle3DSecureUrlGenerationRequest(req, res) {
  console.warn('トークン作成時の3Dセキュアは非推奨です。代わりに支払い作成時の3Dセキュアを使用してください。');
  try {
    const { tokenId, returnUrl } = req.body;

    // パラメーターのバリデーション
    if (!tokenId) {
      return res.status(400).json({
        success: false,
        error: 'トークンIDは必須です。'
      });
    }

    if (!returnUrl) {
      return res.status(400).json({
        success: false,
        error: 'リダイレクト先URLは必須です。'
      });
    }

    // 3Dセキュア認証URLを生成
    const authUrl = await generate3DSecureUrl({
      tokenId,
      returnUrl
    });

    return res.status(200).json({
      success: true,
      tokenId: tokenId,
      authUrl: authUrl
    });
  } catch (error) {
    console.error('3Dセキュア認証URL生成中にエラーが発生しました:', error);

    return res.status(400).json({
      success: false,
      error: '3Dセキュア認証URLの生成中にエラーが発生しました。',
      details: error.message
    });
  }
}

/**
 * 3Dセキュア認証完了リクエストを処理する関数
 * @deprecated トークン作成時の3Dセキュアは非推奨です。代わりに支払い作成時の3Dセキュアを使用してください。
 * @param {Object} req - リクエストオブジェクト
 * @param {Object} res - レスポンスオブジェクト
 * @param {string} tokenId - トークンID
 */
async function handle3DSecureCompleteRequest(req, res, tokenId) {
  console.warn('トークン作成時の3Dセキュアは非推奨です。代わりに支払い作成時の3Dセキュアを使用してください。');
  try {
    // 3Dセキュア認証完了処理
    const completedToken = await complete3DSecure(tokenId);

    // KVストアからセッション情報を取得
    let sessionData;
    try {
      sessionData = await kv.get(`3dsession:${tokenId}`);
    } catch (kvError) {
      console.warn('3Dセキュアセッション情報の取得に失敗しました:', kvError);
      // エラーは無視して続行（古いセッションの場合もあるため）
    }

    return res.status(200).json({
      success: true,
      tokenId: tokenId,
      completedToken: completedToken,
      sessionData: sessionData || null,
      message: '3Dセキュア認証が完了しました。'
    });
  } catch (error) {
    console.error('3Dセキュア完了処理中にエラーが発生しました:', error);

    return res.status(400).json({
      success: false,
      error: '3Dセキュア完了処理中にエラーが発生しました。',
      details: error.message
    });
  }
}

/**
 * 通常の決済リクエストを処理
 */
async function handlePaymentRequest(req, res) {
  try {
    // JSON形式でないリクエストを処理
    let requestBody = req.body;
    if (typeof requestBody === 'string') {
      try {
        requestBody = JSON.parse(requestBody);
      } catch (e) {
        // 解析失敗時はURLエンコード形式として処理
        const params = new URLSearchParams(requestBody);
        requestBody = {};
        for (const [key, value] of params) {
          requestBody[key] = value;
        }
      }
    }

    // リクエストボディから必要なパラメーターを抽出
    const {
      token,
      amount,
      currency = 'jpy',
      description = '',
      metadata = {},
      customer = null,
      threeDSecure = false  // 3Dセキュアの有効化フラグ
    } = requestBody;

    // パラメーターの検証
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'カードトークンは必須です。',
      });
    }

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        error: '有効な金額を指定してください。',
      });
    }

    // セッション情報をKVストアに保存（3Dセキュア用）
    if (threeDSecure && requestBody.userData) {
      try {
        const sessionKey = `3dsession:${token}`;
        await kv.set(sessionKey, {
          token,
          userData: requestBody.userData,
          amount,
          currency,
          description,
          metadata,
          customer,
          timestamp: new Date().toISOString(),
          transactionId: requestBody.transactionId || `TX-${Date.now()}`
        }, { ex: 3600 }); // 1時間有効
        console.log(`3Dセキュアセッション情報を保存しました: ${sessionKey}`);
      } catch (kvError) {
        console.warn('3Dセキュアセッション情報の保存に失敗しました:', kvError);
        // KVへの保存失敗は処理を続行
      }
    }

    // 決済処理の実行
    const charge = await createCharge({
      token,
      amount: Number(amount),
      currency,
      description,
      metadata,
      customer,
      threeDSecure // 3Dセキュアフラグを渡す
    });

    // 3Dセキュアが有効で、ステータスがunverifiedの場合
    if (threeDSecure && charge.three_d_secure_status === 'unverified') {
      // セッション情報を支払いIDで再保存
      if (requestBody.userData) {
        try {
          const chargeSessionKey = `3dsession:charge:${charge.id}`;
          await kv.set(chargeSessionKey, {
            chargeId: charge.id,
            userData: requestBody.userData,
            amount,
            currency,
            description,
            metadata,
            customer,
            timestamp: new Date().toISOString(),
            transactionId: requestBody.transactionId || `TX-${Date.now()}`
          }, { ex: 3600 }); // 1時間有効
          console.log(`3Dセキュア支払いセッション情報を保存しました: ${chargeSessionKey}`);
        } catch (kvError) {
          console.warn('3Dセキュア支払いセッション情報の保存に失敗しました:', kvError);
          // KVへの保存失敗は処理を続行
        }
      }

      // 3Dセキュア認証が必要なレスポンスを返す
      return res.status(200).json({
        success: true,
        charge: charge,
        requiresThreeDSecure: true,
        threeDSecureStatus: charge.three_d_secure_status,
        chargeId: charge.id,
        paid: charge.paid // ここではfalseのはず
      });
    }

    // 通常の決済成功レスポンス
    return res.status(200).json({
      success: true,
      charge: charge,
      chargeId: charge.id,
      paid: charge.paid // ここではtrueのはず
    });
  } catch (error) {
    console.error('決済処理中にエラーが発生しました:', error);

    // Pay.jp APIからのエラー
    if (error.message.startsWith('Pay.jp APIエラー')) {
      return res.status(400).json({
        success: false,
        error: '決済処理中にエラーが発生しました。',
        details: error.message
      });
    }

    // その他のエラー
    return res.status(500).json({
      success: false,
      error: '決済処理中にサーバーエラーが発生しました。',
      message: process.env.NODE_ENV === 'development' ? error.message : '内部サーバーエラー'
    });
  }
}

/**
 * 与信枠確保リクエストを処理
 */
async function handleAuthorizationRequest(req, res) {
  try {
    // JSON形式でないリクエストを処理
    let requestBody = req.body;
    if (typeof requestBody === 'string') {
      try {
        requestBody = JSON.parse(requestBody);
      } catch (e) {
        // 解析失敗時はURLエンコード形式として処理
        const params = new URLSearchParams(requestBody);
        requestBody = {};
        for (const [key, value] of params) {
          requestBody[key] = value;
        }
      }
    }

    // リクエストボディから必要なパラメーターを抽出
    const {
      token,
      amount,
      currency = 'jpy',
      description = '',
      metadata = {},
      customer = null,
      threeDSecure = false  // 3Dセキュアの有効化フラグ
    } = requestBody;

    // パラメーターの検証
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'カードトークンは必須です。',
      });
    }

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        error: '有効な金額を指定してください。',
      });
    }

    // セッション情報をKVストアに保存（3Dセキュア用）
    if (threeDSecure && requestBody.userData) {
      try {
        const sessionKey = `3dsession:auth:${token}`;
        await kv.set(sessionKey, {
          token,
          userData: requestBody.userData,
          amount,
          currency,
          description,
          metadata,
          customer,
          timestamp: new Date().toISOString(),
          transactionId: requestBody.transactionId || `AUTH-${Date.now()}`
        }, { ex: 3600 }); // 1時間有効
        console.log(`3Dセキュア認証セッション情報を保存しました: ${sessionKey}`);
      } catch (kvError) {
        console.warn('3Dセキュア認証セッション情報の保存に失敗しました:', kvError);
        // KVへの保存失敗は処理を続行
      }
    }

    // 与信枠確保処理の実行
    const charge = await createAuthorization({
      token,
      amount: Number(amount),
      currency,
      description,
      metadata,
      customer,
      threeDSecure // 3Dセキュアフラグを渡す
    });

    // 3Dセキュアが有効で、ステータスがunverifiedの場合
    if (threeDSecure && charge.three_d_secure_status === 'unverified') {
      // セッション情報を支払いIDで再保存
      if (requestBody.userData) {
        try {
          const chargeSessionKey = `3dsession:charge:${charge.id}`;
          await kv.set(chargeSessionKey, {
            chargeId: charge.id,
            userData: requestBody.userData,
            amount,
            currency,
            description,
            metadata,
            customer,
            timestamp: new Date().toISOString(),
            transactionId: requestBody.transactionId || `AUTH-${Date.now()}`
          }, { ex: 3600 }); // 1時間有効
          console.log(`3Dセキュア与信セッション情報を保存しました: ${chargeSessionKey}`);
        } catch (kvError) {
          console.warn('3Dセキュア与信セッション情報の保存に失敗しました:', kvError);
          // KVへの保存失敗は処理を続行
        }
      }

      // 3Dセキュア認証が必要なレスポンスを返す
      return res.status(200).json({
        success: true,
        charge: charge,
        requiresThreeDSecure: true,
        threeDSecureStatus: charge.three_d_secure_status,
        chargeId: charge.id,
        captured: charge.captured, // falseのはず
        paid: charge.paid // falseのはず
      });
    }

    // 通常の与信枠確保成功レスポンス
    return res.status(200).json({
      success: true,
      charge: charge,
      chargeId: charge.id,
      captured: charge.captured, // falseのはず
      paid: charge.paid // trueのはず
    });
  } catch (error) {
    console.error('与信枠確保中にエラーが発生しました:', error);

    // Pay.jp APIからのエラー
    if (error.message.startsWith('Pay.jp APIエラー')) {
      return res.status(400).json({
        success: false,
        error: '与信枠確保中にエラーが発生しました。',
        details: error.message
      });
    }

    // その他のエラー
    return res.status(500).json({
      success: false,
      error: '与信枠確保中にサーバーエラーが発生しました。',
      message: process.env.NODE_ENV === 'development' ? error.message : '内部サーバーエラー'
    });
  }
}

/**
 * キャプチャリクエストを処理
 */
async function handleCaptureRequest(req, res, chargeId) {
  try {
    // キャプチャ処理
    const capture = await capturePayment(chargeId);

    // レスポンスを返す
    return res.status(200).json({
      success: true,
      chargeId: chargeId,
      captured: capture.captured,
      paid: capture.paid
    });
  } catch (error) {
    console.error('キャプチャ処理中にエラーが発生しました:', error);

    // Pay.jp APIからのエラー
    if (error.message.startsWith('Pay.jp APIエラー')) {
      return res.status(400).json({
        success: false,
        error: 'キャプチャ処理中にエラーが発生しました。',
        details: error.message
      });
    }

    // その他のエラー
    return res.status(500).json({
      success: false,
      error: 'キャプチャ処理中にサーバーエラーが発生しました。',
      message: process.env.NODE_ENV === 'development' ? error.message : '内部サーバーエラー'
    });
  }
}

/**
 * 解放リクエストを処理
 */
async function handleReleaseRequest(req, res, chargeId) {
  try {
    // 解放処理
    const release = await releaseAuthorization(chargeId);

    // レスポンスを返す
    return res.status(200).json({
      success: true,
      chargeId: chargeId,
      refunded: release.refunded,
      amount_refunded: release.amount_refunded
    });
  } catch (error) {
    console.error('与信枠解放処理中にエラーが発生しました:', error);

    // Pay.jp APIからのエラー
    if (error.message.startsWith('Pay.jp APIエラー')) {
      return res.status(400).json({
        success: false,
        error: '与信枠解放処理中にエラーが発生しました。',
        details: error.message
      });
    }

    // その他のエラー
    return res.status(500).json({
      success: false,
      error: '与信枠解放処理中にサーバーエラーが発生しました。',
      message: process.env.NODE_ENV === 'development' ? error.message : '内部サーバーエラー'
    });
  }
}