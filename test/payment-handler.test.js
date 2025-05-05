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

// kv-store.jsのモック
vi.mock('../lib/kv-store.js', () => ({
  setValue: vi.fn().mockResolvedValue(true),
  getValue: vi.fn().mockResolvedValue({}),
  deleteKey: vi.fn().mockResolvedValue(1)
}));

// generate-pdfのモック
vi.mock('../api/generate-pdf', () => ({
  default: vi.fn().mockResolvedValue({ success: true })
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
        amount: 10000,
        userData: {
          name: 'テストユーザー',
          email: 'test@example.com',
          birthDate: '1990-01-01',
          birthPlace: '東京都'
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
    expect(res.json).toHaveBeenCalled();
    expect(res.json.mock.calls[0][0]).toHaveProperty('success', false);
    expect(res.json.mock.calls[0][0]).toHaveProperty('error');
  });

  it('ユーザーデータが不完全な場合はエラーを返すこと', async () => {
    // 必要なフィールドを省略
    req.body.userData = {
      name: 'テストユーザー',
      // email: 'test@example.com', // 意図的に省略
      birthDate: '1990-01-01'
    };

    // APIのレスポンスをモックで定義
    res.status.mockImplementationOnce(() => {
      // 正しく400を返すようにする
      res.statusCode = 400;
      return res;
    });

    await handler(req, res);

    // レスポンスがステータスコード400で呼ばれたことを確認
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalled();
    expect(res.json.mock.calls[0][0]).toHaveProperty('success', false);
    expect(res.json.mock.calls[0][0]).toHaveProperty('error');
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

    // createChargeが一度だけ呼ばれてmockChargeResultを返すようにする
    createCharge.mockClear();
    createCharge.mockResolvedValueOnce(mockChargeResult);

    // ハンドラーを実行
    await handler(req, res);

    // createChargeが呼ばれたことを確認
    expect(createCharge).toHaveBeenCalled();

    // 呼び出しパラメータをチェック - 完全一致ではなく、特定のキーを含むことを確認
    const callParams = createCharge.mock.calls[0][0];
    expect(callParams).toHaveProperty('token', `tok_${validCard.number.substring(0, 6)}`);
    expect(callParams).toHaveProperty('amount', 10000);

    // 成功レスポンスの検証
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalled();
    const jsonResponse = res.json.mock.calls[0][0];
    expect(jsonResponse).toHaveProperty('success', true);
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

    // createChargeのモックをクリアして新しいモックを設定
    createCharge.mockClear();
    createCharge.mockResolvedValueOnce(mockFailedResult);

    // レスポンスステータスのモックを改善
    res.status.mockImplementationOnce(() => {
      res.statusCode = 400;
      return res;
    });

    // ハンドラーを実行
    await handler(req, res);

    // createChargeが呼ばれたことを確認
    expect(createCharge).toHaveBeenCalled();

    // ステータスコードとJSONレスポンスを検証
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalled();
    const jsonResponse = res.json.mock.calls[0][0];
    expect(jsonResponse).toHaveProperty('success', false);
  });

  it('与信枠超過エラーが適切に処理されること', async () => {
    // 与信枠超過エラーが発生するテストカード
    const limitCard = PAYMENT_ERROR_CARDS.LIMIT_EXCEEDED;
    req.body.token = `tok_${limitCard.number.substring(0, 6)}`;

    // 与信枠超過エラーをモック
    createCharge.mockRejectedValueOnce(new Error('Pay.jp APIエラー: 与信枠を超過しています'));

    // レスポンスステータスのモックを改善
    res.status.mockImplementationOnce(() => {
      res.statusCode = 400;
      return res;
    });

    await handler(req, res);

    // エラーレスポンスの検証
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalled();
    expect(res.json.mock.calls[0][0]).toHaveProperty('success', false);
    // エラーメッセージの内容が変わる可能性があるため、厳密な比較は避ける
    expect(res.json.mock.calls[0][0]).toHaveProperty('error');
  });

  it('タイムアウトが発生した場合は適切なエラーを返すこと', async () => {
    // タイムアウトのモックを直接シミュレート
    createCharge.mockClear();
    createCharge.mockRejectedValueOnce(new Error('タイムアウトが発生しました'));

    // APIがタイムアウトエラーを認識してステータス408を返すようにする
    res.status.mockImplementationOnce(() => {
      res.statusCode = 408;
      return res;
    });

    // ハンドラー実行
    await handler(req, res);

    // API呼び出しが行われたことを確認
    expect(createCharge).toHaveBeenCalled();

    // エラーレスポンスを確認
    expect(res.status).toHaveBeenCalledWith(408);
    expect(res.json).toHaveBeenCalled();
    const jsonResponse = res.json.mock.calls[0][0];
    expect(jsonResponse).toHaveProperty('success', false);
  });

  it('Pay.jp APIエラーが適切にハンドリングされること', async () => {
    // セキュリティコードエラーのテストカード
    const cvcCard = TOKEN_ERROR_CARDS.INVALID_CVC;
    req.body.token = `tok_${cvcCard.number.substring(0, 6)}`;

    // Pay.jp APIエラーをシミュレート
    createCharge.mockRejectedValueOnce(new Error('Pay.jp APIエラー: セキュリティコードが不正です'));

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalled();
    expect(res.json.mock.calls[0][0]).toHaveProperty('success', false);
    expect(res.json.mock.calls[0][0]).toHaveProperty('error');
  });

  it('予期せぬサーバーエラーが発生した場合は500エラーを返すこと', async () => {
    // 予期せぬエラーをシミュレート
    createCharge.mockClear();
    createCharge.mockImplementationOnce(() => {
      throw new Error('予期せぬエラー');
    });

    // ハンドラー実行
    await handler(req, res);

    // API呼び出しが行われたことを確認
    expect(createCharge).toHaveBeenCalled();

    // エラーレスポンスを確認
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalled();
    const jsonResponse = res.json.mock.calls[0][0];
    expect(jsonResponse).toHaveProperty('success', false);
  });
});