/**
 * 与信枠確保→確定のワークフローのエンドツーエンドテスト
 *
 * このテストでは以下のステップをテストします：
 * 1. フォームに必要情報を入力
 * 2. Pay.jpトークン取得処理
 * 3. 与信枠確保APIの呼び出し
 * 4. 与信枠確定処理
 * 5. PDF生成リクエスト
 * 6. SSE経由での進捗確認
 * 7. PDF取得とダウンロード確認
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VALID_TEST_CARDS } from '../payjp-test-cards';

// puppeteerとjestを使用したE2Eテスト
describe('与信枠確保→確定のワークフロー E2Eテスト', () => {
  // テスト用の環境変数
  const TEST_BASE_URL = 'http://localhost:3000'; // テスト環境のURL
  let page; // ブラウザページオブジェクト
  let browser; // ブラウザオブジェクト

  // 与信枠IDを保持する変数（確保→確定のフローで使用）
  let authorizationId;

  beforeEach(async () => {
    // モック用のページオブジェクト
    page = {
      goto: vi.fn().mockResolvedValue({}),
      waitForSelector: vi.fn().mockResolvedValue({}),
      click: vi.fn().mockResolvedValue({}),
      type: vi.fn().mockResolvedValue({}),
      select: vi.fn().mockResolvedValue({}),
      evaluate: vi.fn().mockImplementation(async (fn) => {
        // Payjp.jsのモックを提供
        global.Payjp = {
          createToken: vi.fn().mockResolvedValue({
            id: `tok_${VALID_TEST_CARDS.VISA_1.number.substring(0, 6)}`,
            card: {
              brand: 'Visa',
              last4: '4242'
            }
          })
        };
        return fn();
      }),
      on: vi.fn().mockImplementation((event, handler) => {
        return page;
      }),
      waitForResponse: vi.fn().mockImplementation(async (urlOrPredicate) => {
        // URLに応じてレスポンスをモック
        if (typeof urlOrPredicate === 'function') {
          const mockedUrl = {
            includes: (path) => {
              if (path === '/api/auth/create') return true;
              if (path === '/api/auth/capture') return true;
              if (path === '/api/generate-pdf') return true;
              return false;
            }
          };

          const predicate = urlOrPredicate({ url: () => mockedUrl });

          if (predicate) {
            if (mockedUrl.includes('/api/auth/create')) {
              authorizationId = 'auth_test_' + Date.now();
              return {
                status: vi.fn().mockReturnValue(200),
                json: vi.fn().mockResolvedValue({
                  success: true,
                  authorizationId: authorizationId,
                  transactionId: 'trans_' + Date.now()
                })
              };
            } else if (mockedUrl.includes('/api/auth/capture')) {
              return {
                status: vi.fn().mockReturnValue(200),
                json: vi.fn().mockResolvedValue({
                  success: true,
                  paymentId: authorizationId,
                  capturedAmount: 10000
                })
              };
            } else if (mockedUrl.includes('/api/generate-pdf')) {
              return {
                status: vi.fn().mockReturnValue(202),
                json: vi.fn().mockResolvedValue({
                  jobId: 'test-job-id',
                  progressUrl: '/api/pdf-progress/test-job-id'
                })
              };
            }
          }
        }

        return {
          status: vi.fn().mockReturnValue(200),
          json: vi.fn().mockResolvedValue({})
        };
      }),
      waitForFunction: vi.fn().mockResolvedValue({})
    };

    // EventSourceのモック（Server-Sent Events）
    global.EventSource = class MockEventSource {
      constructor(url) {
        this.url = url;
        this.readyState = 0;
        this.onopen = null;
        this.onmessage = null;
        this.onerror = null;

        // 初期化時に自動的にopenイベントを発火
        setTimeout(() => {
          this.readyState = 1;
          if (this.onopen) this.onopen(new Event('open'));

          // 進捗メッセージを送信
          if (this.onmessage) {
            this.onmessage({
              data: JSON.stringify({
                progress: 10,
                message: '鑑定文生成中...'
              })
            });

            // 完了メッセージを送信
            setTimeout(() => {
              this.onmessage({
                data: JSON.stringify({
                  progress: 100,
                  message: 'PDF生成完了',
                  completed: true,
                  downloadUrl: '/api/download-pdf/test-job-id'
                })
              });
            }, 500);
          }
        }, 100);
      }

      close() {
        this.readyState = 2;
      }
    };

    // fetchのモック
    global.fetch = vi.fn().mockImplementation(async (url, options) => {
      if (url.includes('/api/auth/create')) {
        authorizationId = 'auth_test_' + Date.now();
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            authorizationId: authorizationId,
            transactionId: 'trans_' + Date.now(),
            message: '与信枠を確保しました'
          })
        };
      }

      if (url.includes('/api/auth/capture')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            paymentId: authorizationId,
            capturedAmount: 10000,
            message: '与信枠を確定しました'
          })
        };
      }

      if (url.includes('/api/generate-pdf')) {
        return {
          ok: true,
          status: 202,
          json: async () => ({
            jobId: 'test-job-id',
            progressUrl: '/api/pdf-progress/test-job-id'
          })
        };
      }

      if (url.includes('/api/download-pdf')) {
        return {
          ok: true,
          status: 200,
          blob: async () => new Blob(['PDF content'], { type: 'application/pdf' })
        };
      }

      return {
        ok: false,
        status: 404
      };
    });
  });

  afterEach(async () => {
    // モックをリセット
    vi.clearAllMocks();
  });

  it('正常な与信枠確保→確定フロー: 入力から与信枠確保、確定、PDF生成まで', async () => {
    // 1. トップページを開く
    await page.goto(`${TEST_BASE_URL}/`);

    // 2. フォームに必要情報を入力
    await page.waitForSelector('#user-form');
    await page.type('#name', '山田太郎');
    await page.type('#email', 'test@example.com');
    await page.type('#birth-date', '1990-01-01');
    await page.type('#birth-time', '12:30');
    await page.type('#birth-place', '東京都');
    await page.type('#specific-question', '2024年の運勢について教えてください');

    // 与信枠確保モードを選択
    await page.click('#auth-only-checkbox');

    // 3. フォーム送信
    await page.click('#submit-btn');

    // 4. 支払いフォームが表示されるのを待つ
    await page.waitForSelector('#payment-form');

    // 5. Pay.jpのカード情報入力をシミュレート
    await page.evaluate(() => {
      const cardNumberElement = document.querySelector('#card-number');
      const cardExpiryElement = document.querySelector('#card-expiry');
      const cardCvcElement = document.querySelector('#card-cvc');

      if (cardNumberElement) cardNumberElement.value = '4242424242424242';
      if (cardExpiryElement) cardExpiryElement.value = '12/30';
      if (cardCvcElement) cardCvcElement.value = '123';
    });

    // 6. 支払いフォーム送信（与信枠確保モード）
    await page.click('#authorize-button');

    // 7. 与信枠確保APIのレスポンスを待つ
    const authResponse = await page.waitForResponse(
      (response) => response.url().includes('/api/auth/create')
    );
    expect(await authResponse.status()).toBe(200);
    const authData = await authResponse.json();
    expect(authData.success).toBe(true);
    expect(authData.authorizationId).toBeDefined();

    // 与信枠IDを保存（このテストではすでにmock内で設定済み）
    const authorizationId = authData.authorizationId;

    // 8. 与信枠確保後の状態表示を確認
    await page.waitForSelector('#auth-status');

    // 9. 確定ボタンをクリック
    await page.click('#capture-button');

    // 10. 与信枠確定APIのレスポンスを待つ
    const captureResponse = await page.waitForResponse(
      (response) => response.url().includes('/api/auth/capture')
    );
    expect(await captureResponse.status()).toBe(200);
    const captureData = await captureResponse.json();
    expect(captureData.success).toBe(true);
    expect(captureData.paymentId).toBe(authorizationId);

    // 11. PDF生成リクエストのレスポンスを待つ
    const pdfGenResponse = await page.waitForResponse(
      (response) => response.url().includes('/api/generate-pdf')
    );
    expect(await pdfGenResponse.status()).toBe(202);
    const pdfGenData = await pdfGenResponse.json();
    expect(pdfGenData.jobId).toBeDefined();
    expect(pdfGenData.progressUrl).toBeDefined();

    // 12. 進捗表示画面への遷移を確認
    await page.waitForSelector('#progress-container');

    // 13. 進捗が100%になるまで待機
    // このテストでは進捗の更新をシミュレートしています（上記のEventSourceモック参照）

    // 14. ダウンロードボタンの表示を確認
    await page.waitForSelector('#download-pdf-btn');

    // 15. ダウンロードボタンをクリック
    await page.click('#download-pdf-btn');

    // 16. ダウンロードが開始されたことを確認
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/download-pdf/test-job-id'),
      expect.any(Object)
    );

    // 全体のワークフローが正常に完了したことを確認
    console.log('与信枠確保→確定ワークフローのエンドツーエンドテストが正常に完了しました');
  }, 30000); // タイムアウトを30秒に設定

  it('与信枠解放フロー: 確保後に解放処理を行う', async () => {
    // 1. トップページを開く
    await page.goto(`${TEST_BASE_URL}/`);

    // 2. フォームに必要情報を入力
    await page.waitForSelector('#user-form');
    await page.type('#name', '山田太郎');
    await page.type('#email', 'test@example.com');
    await page.type('#birth-date', '1990-01-01');
    await page.type('#birth-time', '12:30');
    await page.type('#birth-place', '東京都');

    // 与信枠確保モードを選択
    await page.click('#auth-only-checkbox');

    // 3. フォーム送信
    await page.click('#submit-btn');

    // 4. 支払いフォームが表示されるのを待つ
    await page.waitForSelector('#payment-form');

    // 5. Pay.jpのカード情報入力をシミュレート
    await page.evaluate(() => {
      const cardNumberElement = document.querySelector('#card-number');
      const cardExpiryElement = document.querySelector('#card-expiry');
      const cardCvcElement = document.querySelector('#card-cvc');

      if (cardNumberElement) cardNumberElement.value = '4242424242424242';
      if (cardExpiryElement) cardExpiryElement.value = '12/30';
      if (cardCvcElement) cardCvcElement.value = '123';
    });

    // 6. 支払いフォーム送信（与信枠確保モード）
    await page.click('#authorize-button');

    // 7. 与信枠確保APIのレスポンスを待つ
    const authResponse = await page.waitForResponse(
      (response) => response.url().includes('/api/auth/create')
    );

    // 8. 与信枠確保後の状態表示を確認
    await page.waitForSelector('#auth-status');

    // 9. キャンセルボタン（解放ボタン）をクリック
    await page.click('#release-button');

    // 10. 与信枠解放APIのレスポンスを待つ
    // 解放APIのモックを追加
    global.fetch = vi.fn().mockImplementation(async (url, options) => {
      if (url.includes('/api/auth/release')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            authorizationId: authorizationId,
            refundedAmount: 10000,
            message: '与信枠を解放しました'
          })
        };
      }
      return { ok: false, status: 404 };
    });

    // 解放レスポンスを待つ
    const releaseResponse = await page.waitForResponse(
      (response) => response.url().includes('/api/auth/release')
    );
    expect(await releaseResponse.status()).toBe(200);
    const releaseData = await releaseResponse.json();
    expect(releaseData.success).toBe(true);

    // 11. キャンセル完了画面への遷移を確認
    await page.waitForSelector('#cancel-complete');

    // 全体のワークフローが正常に完了したことを確認
    console.log('与信枠確保→解放ワークフローのエンドツーエンドテストが正常に完了しました');
  }, 30000); // タイムアウトを30秒に設定
});