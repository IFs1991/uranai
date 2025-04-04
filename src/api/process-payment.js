// src/api/process-payment.js
import { createCharge } from '../lib/payjp-api';
import { generatePdfForUser } from '../api/generate-pdf';

// PDF生成はハンドラ内で直接呼び出すのではなく、キューイングシステムなどを介すのが理想
// import { queuePdfGenerationTask } from '../lib/queue-service'; // 例: キューサービス

// *** セキュリティと信頼性に関する考慮事項 ***
// 1. レートリミット: 不正な大量リクエストを防ぐため、Vercelの組み込み機能や外部サービス(Cloudflareなど)で
//    IPアドレスやユーザー単位のレートリミットを適用することを強く推奨します。
// 2. 入力検証: より厳密な入力検証を行うことで、不正なデータによるエラーや攻撃を防ぎます。
// 3. 冪等性: ネットワークエラーによるリトライで二重決済が発生しないよう、冪等キーを用いた処理を実装します。
// 4. 非同期処理: PDF生成のような時間のかかる処理は、リクエスト/レスポンスサイクルから切り離し、
//    メッセージキューとバックグラウンドワーカー（例: Vercel Cron Jobs + Background Functions, SQS+Lambda）で
//    実行し、リトライやエラー通知の仕組みを設けるのがベストプラクティスです。
//    ここではインメモリでの冪等性チェックと、キューイング推奨コメントに留めます。

// タイムアウト設定（15秒）-> Pay.jp API自体のタイムアウトも考慮
const TIMEOUT_DURATION = 15000;

// 冪等性キーと処理結果を保持する（インメモリ、有効期限付き）
// 注意: サーバーレス環境ではインスタンスが破棄されるため、インメモリ保持は限定的。
// 本番環境ではRedisなどの外部ストアの使用を推奨。
const processedRequests = new Map();
const IDEMPOTENCY_KEY_TTL = 1000 * 60 * 60 * 24; // 24時間

/**
 * メールアドレスの形式を検証するシンプルな正規表現
 * @param {string} email
 * @returns {boolean}
 */
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

/**
 * YYYY-MM-DD形式の日付文字列を検証し、Dateオブジェクトを返す
 * @param {string} dateString
 * @returns {Date|null} 有効な場合はDateオブジェクト、無効な場合はnull
 */
const parseAndValidateDate = (dateString) => {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(dateString)) return null;
  const date = new Date(dateString);
  const [year, month, day] = dateString.split('-').map(Number);
  // Dateオブジェクトの月は0-11
  if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
    // 未来の日付でないかチェック (今日まで許可)
    if (date <= new Date()) {
        return date;
    }
  }
  return null;
};

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

  // --- レートリミットに関するコメント ---
  // ここにレートリミットのチェックロジックが入ることを想定（外部サービス等を利用）

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout')), TIMEOUT_DURATION);
  });

  try {
    // リクエストボディから取得 + 冪等キー
    const { token, userData, idempotencyKey } = req.body;

    // --- 入力検証強化 ---
    if (!token || typeof token !== 'string' || !token.startsWith('tok_')) {
      return res.status(400).json({ success: false, error: '無効な決済トークンです' });
    }
    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
        return res.status(400).json({ success: false, error: '冪等キーが必要です' });
    }
    if (!userData || typeof userData !== 'object') {
        return res.status(400).json({ success: false, error: 'ユーザー情報が必要です' });
    }
    if (!userData.name || typeof userData.name !== 'string' || userData.name.trim() === '') {
        return res.status(400).json({ success: false, error: '名前は必須です' });
    }
    if (!userData.email || !isValidEmail(userData.email)) {
        return res.status(400).json({ success: false, error: '無効なメールアドレス形式です' });
    }
    if (!userData.birthDate || !parseAndValidateDate(userData.birthDate)) {
        return res.status(400).json({ success: false, error: '無効な生年月日形式または未来の日付です (YYYY-MM-DD)' });
    }
    // 他のuserDataフィールドも必要に応じて検証

    // --- 冪等性チェック ---
    const now = Date.now();
    if (processedRequests.has(idempotencyKey)) {
        const { timestamp, result } = processedRequests.get(idempotencyKey);
        if (now - timestamp < IDEMPOTENCY_KEY_TTL) {
            console.log(`Idempotency key ${idempotencyKey} already processed. Returning cached result.`);
            // 注意: resultをそのまま返すと、PDF生成が再度トリガーされる可能性がある。
            // 決済成功済みを示すレスポンスのみを返すのが安全。
            if (result.success) {
                 return res.status(200).json({
                    ...result, // chargeIdなどを含む可能性がある
                    message: 'このリクエストは既に処理されています（決済成功）。',
                    isIdempotentResponse: true
                 });
            } else {
                 return res.status(result.statusCode || 400).json({
                    ...result,
                     message: 'このリクエストは既に処理されています（決済失敗）。',
                     isIdempotentResponse: true
                 });
            }
        } else {
            // TTL切れのキーは削除
            processedRequests.delete(idempotencyKey);
        }
    }

    // 固定金額の設定（2,000円）
    const amount = 2000;
    const currency = 'jpy';
    const description = 'ライフサイクル・ポテンシャル占術 詳細鑑定PDF';

    let chargeResult;
    try {
        // 決済処理をタイムアウトと競争
        // createCharge に冪等キーを渡す (payjp-api.js側の対応も必要になる場合あり)
        chargeResult = await Promise.race([
          createCharge({
            token,
            amount,
            currency,
            description,
            metadata: { // メタデータにユーザー情報を含める
              customer_name: userData.name,
              customer_email: userData.email,
              birth_date: userData.birthDate // 必要に応じて
            },
            // idempotency_key: idempotencyKey // payjp-api.jsが対応していれば渡す
          }),
          timeoutPromise
        ]);

    } catch (paymentError) {
        // 決済API呼び出し自体が失敗した場合 (ネットワークエラーなど含む)
        const errorResponse = {
            success: false,
            error: '決済処理中にエラーが発生しました',
            details: paymentError.message,
            statusCode: 500 // デフォルトは内部エラーとする
        };
         // Pay.jpからのエラー応答を解析
         if (paymentError.response?.data?.error) {
            errorResponse.error = '決済サービスからエラーが返されました';
            errorResponse.details = {
                code: paymentError.response.data.error.code,
                message: paymentError.response.data.error.message
            };
            errorResponse.statusCode = 400; // Pay.jpエラーはクライアント起因が多い
         } else if (paymentError.message === 'Request timeout') {
            errorResponse.error = '決済処理がタイムアウトしました';
            errorResponse.statusCode = 408;
         }
        // 冪等性ストアに失敗結果を保存
        processedRequests.set(idempotencyKey, { timestamp: Date.now(), result: errorResponse });
        // TTLが切れた古いエントリを削除（簡易的なクリーンアップ）
        processedRequests.forEach((value, key) => {
            if (Date.now() - value.timestamp >= IDEMPOTENCY_KEY_TTL) {
                processedRequests.delete(key);
            }
        });
        return res.status(errorResponse.statusCode).json(errorResponse);
    }

    // 決済成功時
    if (chargeResult && chargeResult.paid) {
      const transactionId = `TRX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const successResponse = {
        success: true,
        message: '決済が完了しました。詳細鑑定PDFを生成しています。',
        transactionId,
        chargeId: chargeResult.id
      };
      // 冪等性ストアに成功結果を保存
      processedRequests.set(idempotencyKey, { timestamp: Date.now(), result: successResponse });

      // --- 非同期PDF生成プロセス開始 ---
      // ☆☆☆ ベストプラクティス ☆☆☆
      // ここで直接 generatePdfForUser を呼ぶ代わりに、メッセージキューにタスクを登録する。
      // 例: await queuePdfGenerationTask({ userData, transactionId, chargeId: chargeResult.id });
      // これにより、このAPIはPDF生成完了を待たずに素早くレスポンスを返せる。
      // PDF生成はバックグラウンドワーカーがキューからタスクを取得して実行する。
      // 失敗時のリトライ、完了/失敗通知などもキューイングシステム側で管理できる。

      // ☆☆☆ 現在の実装（暫定）☆☆☆
      // PDF生成を非同期で開始（結果を待たず、エラーはログのみ）
      // 注意: Vercelのサーバーレス関数はリクエスト完了後にすぐ終了するため、
      //       バックグラウンド処理が完了する保証はない。長時間処理は非推奨。
      console.log(`[${transactionId}] Starting PDF generation (async)...`);
      generatePdfForUser({ // generatePdfForUser が Promise を返すことを想定
          userData,
          transactionId,
          chargeId: chargeResult.id
      }).then(() => {
          console.log(`[${transactionId}] PDF generation task started successfully.`);
      }).catch(error => {
          // このエラーはクライアントには返せない（既にレスポンス済みのため）
          console.error(`[${transactionId}] Background PDF generation failed:`, error);
          // ★別途、モニタリングシステムやエラー通知の仕組みが必要
      });
      // --- 非同期PDF生成プロセスここまで ---

      return res.status(200).json(successResponse);

    } else {
      // 決済が未完了またはエラー（chargeResult自体は取得できたがpaid=falseなど）
      const failureResponse = {
        success: false,
        error: '決済処理に失敗しました',
        details: chargeResult // Pay.jpからの応答を含める
      };
       // 冪等性ストアに失敗結果を保存
      processedRequests.set(idempotencyKey, { timestamp: Date.now(), result: failureResponse });
      return res.status(400).json(failureResponse);
    }
  } catch (error) {
    // 予期せぬ全体エラー
    console.error('決済処理中に予期せぬエラーが発生しました:', error);
    // 冪等キーが取得できていれば、失敗として記録しておくことも検討
    if (req.body?.idempotencyKey) {
         const unexpectedErrorResponse = { success: false, error: '内部サーバーエラー', details: error.message, statusCode: 500 };
         processedRequests.set(req.body.idempotencyKey, { timestamp: Date.now(), result: unexpectedErrorResponse });
    }
    return res.status(500).json({
      success: false,
      error: '決済処理中に予期せぬサーバーエラーが発生しました',
      message: process.env.NODE_ENV === 'development' ? error.message : '内部サーバーエラー'
    });
  } finally {
      // TTLが切れた古いエントリを削除（定期的なクリーンアップ）
      const now = Date.now();
      processedRequests.forEach((value, key) => {
          if (now - value.timestamp >= IDEMPOTENCY_KEY_TTL) {
              processedRequests.delete(key);
          }
      });
  }
}

// PDF生成関数（スタブ） - generate-pdf.jsへの依存をシミュレート
// 実際には generate-pdf.js のハンドラを呼び出すか、キュー経由で実行
async function generatePdfForUser(data) {
    console.log('Simulating PDF generation for:', data.userData.name, data.transactionId);
    // ここで実際のPDF生成ロジックが非同期で動く
    await new Promise(resolve => setTimeout(resolve, 5000)); // 5秒待機をシミュレート
    console.log('PDF generation simulation complete for:', data.transactionId);
    // 実際の generate-pdf.js はファイル保存や通知を行う
}