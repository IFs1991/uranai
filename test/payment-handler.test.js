import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from '../api/process-payment';
import { createCharge } from '../lib/payjp-api';
import {
  VALID_TEST_CARDS,
  TOKEN_ERROR_CARDS,
  PAYMENT_ERROR_CARDS,
  SPECIAL_STATUS_CARDS,
  generateRandomFutureExpiry
} from './payjp-test-cards';

// createCharge関数のモック
vi.mock('../lib/payjp-api', () => ({
  createCharge: vi.fn(),
}));

describe('payment-handler', () => {
  let req, res;

  beforeEach(() => {
    // リクエスト・レスポンスオブジェクトのモック
    const validCard = VALID_TEST_CARDS.VISA_1;
    req = {
      method: 'POST',
      body: {
        token: `tok_${validCard.number.substring(0, 6)}`,
        userData: {
          name: 'テストユーザー',
          email: 'test@example.com',
          birthDate: '1990-01-01',
          birthplace: '東京都'
        }
      }
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    // モックのリセット
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('POSTメソッド以外のリクエストを拒否すること', async () => {
    req.method = 'GET';

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Method Not Allowed'
    });
  });

  it('tokenが無い場合はエラーを返すこと', async () => {
    req.body.token = null;

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: '決済トークンが見つかりません'
    });
  });

  it('ユーザーデータが不完全な場合はエラーを返すこと', async () => {
    // 必要なフィールドを省略
    req.body.userData = {
      name: 'テストユーザー',
      // email: 'test@example.com', // 意図的に省略
      birthDate: '1990-01-01'
    };

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.stringMatching(/ユーザー情報が不完全です/)
    }));
  });

  it('正常な決済リクエストが成功すること', async () => {
    // 有効なテストカードを使用
    const validCard = VALID_TEST_CARDS.MASTERCARD_1;
    req.body.token = `tok_${validCard.number.substring(0, 6)}`;

    // 正常な決済結果をモック
    const mockChargeResult = {
      id: 'ch_test_charge123',
      amount: 10000,
      currency: 'jpy',
      paid: true,
      captured: true,
      status: 'succeeded'
    };
    createCharge.mockResolvedValueOnce(mockChargeResult);

    await handler(req, res);

    // createChargeの呼び出しパラメータを検証
    expect(createCharge).toHaveBeenCalledWith({
      token: `tok_${validCard.number.substring(0, 6)}`,
      amount: 10000,
      currency: 'jpy',
      description: 'ライフサイクル・ポテンシャル占術 詳細鑑定PDF',
      metadata: {
        customer_name: 'テストユーザー',
        customer_email: 'test@example.com'
      }
    });

    // 成功レスポンスの検証
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      message: '決済が完了しました。PDF生成を開始します。',
      paymentId: 'ch_test_charge123',
      transactionId: expect.any(String)
    }));
  });

  it('決済時のカード拒否エラーが適切に処理されること', async () => {
    // 支払い時にカード拒否エラーが発生するテストカード
    const declinedCard = PAYMENT_ERROR_CARDS.CARD_DECLINED;
    req.body.token = `tok_${declinedCard.number.substring(0, 6)}`;

    // 失敗した決済結果をモック
    const mockFailedResult = {
      id: 'ch_test_charge_failed',
      amount: 10000,
      currency: 'jpy',
      paid: false,
      status: 'failed',
      failure_message: 'カードが拒否されました',
      failure_code: declinedCard.error_code
    };
    createCharge.mockResolvedValueOnce(mockFailedResult);

    await handler(req, res);

    // 失敗レスポンスの検証
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'カードが拒否されました',
      details: mockFailedResult
    });
  });

  it('与信枠超過エラーが適切に処理されること', async () => {
    // 与信枠超過エラーが発生するテストカード
    const limitCard = PAYMENT_ERROR_CARDS.LIMIT_EXCEEDED;
    req.body.token = `tok_${limitCard.number.substring(0, 6)}`;

    // 与信枠超過エラーをモック
    createCharge.mockRejectedValueOnce(new Error('Pay.jp APIエラー: 与信枠を超過しています'));

    await handler(req, res);

    // エラーレスポンスの検証
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: '決済サービスでエラーが発生しました。',
      details: 'Pay.jp APIエラー: 与信枠を超過しています'
    });
  });

  it('タイムアウトが発生した場合は適切なエラーを返すこと', async () => {
    // タイムアウトをシミュレート
    vi.useFakeTimers();
    createCharge.mockImplementationOnce(() => new Promise(resolve => {
      // 処理が長時間完了しない状態
      setTimeout(resolve, 20000);
    }));

    // ハンドラー実行
    const handlerPromise = handler(req, res);

    // タイムアウト時間を進める
    vi.advanceTimersByTime(16000); // 15秒+α

    // タイムアウトエラーが発生することを確認
    await handlerPromise;

    expect(res.status).toHaveBeenCalledWith(408);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: expect.stringContaining('タイムアウト')
    });

    vi.useRealTimers();
  });

  it('Pay.jp APIエラーが適切にハンドリングされること', async () => {
    // セキュリティコードエラーのテストカード
    const cvcCard = TOKEN_ERROR_CARDS.INVALID_CVC;
    req.body.token = `tok_${cvcCard.number.substring(0, 6)}`;

    // Pay.jp APIエラーをシミュレート
    createCharge.mockRejectedValueOnce(new Error('Pay.jp APIエラー: セキュリティコードが不正です'));

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: '決済サービスでエラーが発生しました。',
      details: 'Pay.jp APIエラー: セキュリティコードが不正です'
    });
  });

  it('予期せぬサーバーエラーが発生した場合は500エラーを返すこと', async () => {
    // 予期せぬエラーをシミュレート
    createCharge.mockImplementationOnce(() => {
      throw new Error('予期せぬエラー');
    });

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: '決済処理中にサーバー内部エラーが発生しました。'
    }));
  });
});