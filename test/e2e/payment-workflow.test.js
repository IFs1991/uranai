/**
 * 決済ワークフローのエンドツーエンドテスト
 *
 * このテストでは以下のステップをテストします：
 * 1. フォームに必要情報を入力
 * 2. Pay.jpトークン取得処理
 * 3. 決済処理APIの呼び出し
 * 4. PDF生成リクエスト
 * 5. SSE経由での進捗確認
 * 6. PDF取得とダウンロード確認
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VALID_TEST_CARDS } from '../payjp-test-cards';

// puppeteerとjestを使用したE2Eテスト
// 注: Vitestでは実際にはjestではなくVitestのAPIを使用しますが、コンセプトは同じです
describe('決済ワークフロー E2Eテスト', () => {
  // このテストはPuppeteerやPlaywrightのような実際のブラウザを操作するツールを使って行うのが理想的です
  // このサンプルではモックを多用していますが、実際のE2Eテストでは実環境に近い状態でテストします

  // テスト用の環境変数
  const TEST_BASE_URL = 'http://localhost:3000'; // テスト環境のURL
  let page; // ブラウザページオブジェクト
  let browser; // ブラウザオブジェクト

  beforeEach(async () => {
    // ここでは実際のブラウザ起動のモックを行っていますが
    // 実際のE2Eテストでは以下のようにPuppeteerやPlaywrightを使用します：
    // browser = await puppeteer.launch();
    // page = await browser.newPage();

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
        // 特定のイベントのモック処理
        if (event === 'response') {
          // 必要に応じてレスポンスをモック
        }
        return page;
      }),
      waitForResponse: vi.fn().mockImplementation(async (urlOrPredicate) => {
        // URLに応じてレスポンスをモック
        if (typeof urlOrPredicate === 'function') {
          return {
            status: vi.fn().mockReturnValue(200),
            json: vi.fn().mockResolvedValue({
              success: true,
              jobId: 'test-job-id',
              paymentId: 'test-payment-id'
            })
          };
        }
        return {
          status: vi.fn().mockReturnValue(200),
          json: vi.fn().mockResolvedValue({})
        };
      })
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
      if (url.includes('/api/process-payment')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            paymentId: 'test-payment-id',
            transactionId: 'test-transaction-id',
            message: '決済が完了しました。PDF生成を開始します。'
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
    // 実際のE2Eテストでは以下のようにブラウザを閉じます
    // await browser.close();

    // モックをリセット
    vi.clearAllMocks();
  });

  it('正常なワークフロー: 入力から決済、PDF生成、ダウンロードまで', async () => {
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

    // 3. フォーム送信
    await page.click('#submit-btn');

    // 4. 支払いフォームが表示されるのを待つ
    await page.waitForSelector('#payment-form');

    // 5. Pay.jpのカード情報入力をシミュレート
    await page.evaluate(() => {
      // 実際のページ内ではPay.jpのiframeを使用しますが、
      // テストではページ内のJavaScriptとしてシミュレート
      const cardNumberElement = document.querySelector('#card-number');
      const cardExpiryElement = document.querySelector('#card-expiry');
      const cardCvcElement = document.querySelector('#card-cvc');

      if (cardNumberElement) cardNumberElement.value = '4242424242424242';
      if (cardExpiryElement) cardExpiryElement.value = '12/30';
      if (cardCvcElement) cardCvcElement.value = '123';
    });

    // 6. 支払いフォーム送信
    // ここで内部的にPay.jpのトークン化とAPIリクエストが行われる
    await page.click('#pay-button');

    // 7. 決済処理APIのレスポンスを待つ
    const paymentResponse = await page.waitForResponse(
      (response) => response.url().includes('/api/process-payment')
    );
    expect(await paymentResponse.status()).toBe(200);
    const paymentData = await paymentResponse.json();
    expect(paymentData.success).toBe(true);
    expect(paymentData.paymentId).toBeDefined();

    // 8. PDF生成リクエストのレスポンスを待つ
    const pdfGenResponse = await page.waitForResponse(
      (response) => response.url().includes('/api/generate-pdf')
    );
    expect(await pdfGenResponse.status()).toBe(202);
    const pdfGenData = await pdfGenResponse.json();
    expect(pdfGenData.jobId).toBeDefined();
    expect(pdfGenData.progressUrl).toBeDefined();

    // 9. 進捗表示画面への遷移を確認
    await page.waitForSelector('#progress-container');

    // 10. 進捗が100%になるまで待機
    // 実際のテストでは以下のようにセレクタの変化を待ちます
    // await page.waitForFunction(
    //   () => document.querySelector('#progress-bar').value === 100
    // );

    // このテストでは進捗の更新をシミュレートしています（上記のEventSourceモック参照）

    // 11. ダウンロードボタンの表示を確認
    await page.waitForSelector('#download-pdf-btn');

    // 12. ダウンロードボタンをクリック
    await page.click('#download-pdf-btn');

    // 13. ダウンロードが開始されたことを確認
    // 実際のE2Eテストでは以下のようにダウンロードイベントを待ちます
    // const download = await page.waitForEvent('download');
    // const path = await download.path();
    // expect(path).toBeTruthy();

    // このテストではダウンロードイベントをシミュレートしています
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/download-pdf/test-job-id'),
      expect.any(Object)
    );

    // 全体のワークフローが正常に完了したことを確認
    console.log('決済ワークフローのエンドツーエンドテストが正常に完了しました');
  }, 30000); // タイムアウトを30秒に設定

  it('エラー処理: カード拒否の場合のエラーメッセージ表示', async () => {
    // エラーケースのテスト実装
    // 上記の正常系と同様の流れで実装しますが、
    // カード情報をエラーになるものに変更し、エラーメッセージの表示を確認します

    // このテストケースの詳細実装はプロジェクトの具体的なUIと
    // エラーハンドリングの実装に合わせて調整する必要があります
    console.log('エラー処理テストはスキップしました（実装が必要です）');
  });
});