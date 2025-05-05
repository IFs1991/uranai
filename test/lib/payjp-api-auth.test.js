/**
 * Pay.jp API 与信枠確保・確定・解放関連の単体テスト
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAuthorization, capturePayment, releaseAuthorization } from '../../lib/payjp-api';
import {
  VALID_TEST_CARDS,
  PAYMENT_ERROR_CARDS,
  generateRandomFutureExpiry
} from '../payjp-test-cards';

// 環境変数のモック
vi.mock('../../config/env', () => ({
  default: {
    PAYJP_SECRET_KEY: 'sk_test_dummy_secret_key_for_testing',
  }
}));

// グローバルfetchのモック
global.fetch = vi.fn();

// Buffer.fromのモック
global.Buffer = {
  from: vi.fn().mockReturnValue({
    toString: vi.fn().mockReturnValue('dummy_base64_encoded_string')
  })
};

// URLSearchParamsのモック
global.URLSearchParams = vi.fn().mockImplementation((params) => ({
  toString: vi.fn().mockReturnValue('mocked-params-string'),
  get: vi.fn().mockImplementation((key) => params[key])
}));

describe('payjp-api 与信枠関連', () => {
  beforeEach(() => {
    fetch.mockClear();
    Buffer.from.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createAuthorization（与信枠確保）', () => {
    it('正常系：与信枠確保リクエストが成功すること', async () => {
      // モックレスポンスのセットアップ
      const mockResponse = {
        id: 'ch_test_auth123',
        amount: 10000,
        currency: 'jpy',
        paid: true,
        captured: false, // 与信枠確保なのでfalse
        status: 'pending'
      };

      // fetchのモック実装
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      // テスト対象のパラメータ - 有効なテストカード情報を使用
      const validCard = VALID_TEST_CARDS.VISA_1;
      const params = {
        token: `tok_${validCard.number.substring(0, 6)}`,
        amount: 10000,
        currency: 'jpy',
        description: 'テスト与信枠確保',
        expiry_days: 7 // 7日間の与信枠確保
      };

      // 関数を実行
      const result = await createAuthorization(params);

      // 期待する結果の検証
      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith('https://api.pay.jp/v1/charges', {
        method: 'POST',
        headers: {
          'Authorization': 'Basic dummy_base64_encoded_string',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: expect.any(String)
      });

      // URLSearchParamsの検証
      const callArgs = fetch.mock.calls[0];
      const bodyString = callArgs[1].body;
      const params2 = new URLSearchParams(bodyString);
      expect(params2.get('card')).toBe(params.token);
      expect(params2.get('amount')).toBe(params.amount.toString());
      expect(params2.get('currency')).toBe(params.currency);
      expect(params2.get('description')).toBe(params.description);
      expect(params2.get('capture')).toBe('false'); // 与信枠確保の重要なパラメータ
      expect(params2.get('expiry_days')).toBe('7'); // 有効期限
    });

    it('有効期限を省略した場合はデフォルト値が設定されること', async () => {
      // モックレスポンスのセットアップ
      const mockResponse = {
        id: 'ch_test_auth456',
        amount: 5000,
        currency: 'jpy',
        paid: true,
        captured: false,
        status: 'pending'
      };

      // fetchのモック実装
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      // テスト対象のパラメータ - 有効期限を省略
      const validCard = VALID_TEST_CARDS.MASTERCARD_1;
      const params = {
        token: `tok_${validCard.number.substring(0, 6)}`,
        amount: 5000,
        currency: 'jpy',
        description: 'テスト与信枠確保（有効期限省略）'
        // expiry_days省略
      };

      // 関数を実行
      await createAuthorization(params);

      // URLSearchParamsの検証
      const callArgs = fetch.mock.calls[0];
      const bodyString = callArgs[1].body;
      const params2 = new URLSearchParams(bodyString);
      expect(params2.get('capture')).toBe('false');
      expect(params2.get('expiry_days')).toBe('7'); // デフォルト7日
    });

    it('与信枠確保時のエラーが適切に処理されること', async () => {
      // 与信枠超過テストカード
      const limitCard = PAYMENT_ERROR_CARDS.LIMIT_EXCEEDED;

      // エラーレスポンスのモック
      const errorResponse = {
        error: {
          code: limitCard.error_code,
          message: '与信枠を超過しています',
          type: 'card_error'
        }
      };

      // fetchのモック実装
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 402,
        json: async () => errorResponse
      });

      // 閾値を超えた金額でテスト
      const exceededAmount = limitCard.threshold + 1;
      const params = {
        token: `tok_${limitCard.number.substring(0, 6)}`,
        amount: exceededAmount,
        description: 'テスト与信枠確保（エラー）'
      };

      // エラーがスローされることを検証
      await expect(createAuthorization(params)).rejects.toThrow('与信枠を超過しています');
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('capturePayment（与信枠確定）', () => {
    it('正常系：与信枠確定リクエストが成功すること', async () => {
      // モックレスポンスのセットアップ
      const mockResponse = {
        id: 'ch_test_capture123',
        amount: 10000,
        currency: 'jpy',
        paid: true,
        captured: true, // 確定済みなのでtrue
        status: 'succeeded'
      };

      // fetchのモック実装
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      // テスト対象のパラメータ
      const chargeId = 'ch_test_auth789';
      const amount = 10000; // 全額確定

      // 関数を実行
      const result = await capturePayment(chargeId, amount);

      // 期待する結果の検証
      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(`https://api.pay.jp/v1/charges/${chargeId}/capture`, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic dummy_base64_encoded_string',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: expect.any(String)
      });

      // URLSearchParamsの検証
      const callArgs = fetch.mock.calls[0];
      const bodyString = callArgs[1].body;
      const params = new URLSearchParams(bodyString);
      expect(params.get('amount')).toBe(amount.toString());
    });

    it('一部金額のみの確定リクエストが成功すること', async () => {
      // モックレスポンスのセットアップ
      const mockResponse = {
        id: 'ch_test_capture456',
        amount: 10000, // 元の金額
        amount_refunded: 5000, // 返金相当額
        currency: 'jpy',
        paid: true,
        captured: true,
        status: 'succeeded'
      };

      // fetchのモック実装
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      // テスト対象のパラメータ - 一部金額のみ確定
      const chargeId = 'ch_test_auth012';
      const amount = 5000; // 半額のみ確定

      // 関数を実行
      const result = await capturePayment(chargeId, amount);

      // 期待する結果の検証
      expect(result).toEqual(mockResponse);

      // URLSearchParamsの検証
      const callArgs = fetch.mock.calls[0];
      const bodyString = callArgs[1].body;
      const params = new URLSearchParams(bodyString);
      expect(params.get('amount')).toBe('5000'); // 5000円のみ確定
    });

    it('確定時のエラーが適切に処理されること', async () => {
      // エラーレスポンスのモック
      const errorResponse = {
        error: {
          code: 'already_captured',
          message: '既に確定済みの決済です',
          type: 'processing_error'
        }
      };

      // fetchのモック実装
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => errorResponse
      });

      // テスト対象のパラメータ
      const chargeId = 'ch_test_already_captured';
      const amount = 10000;

      // エラーがスローされることを検証
      await expect(capturePayment(chargeId, amount)).rejects.toThrow('既に確定済みの決済です');
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('金額を省略した場合は全額確定となること', async () => {
      // モックレスポンスのセットアップ
      const mockResponse = {
        id: 'ch_test_capture789',
        amount: 15000,
        currency: 'jpy',
        paid: true,
        captured: true,
        status: 'succeeded'
      };

      // fetchのモック実装
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      // テスト対象のパラメータ - 金額省略
      const chargeId = 'ch_test_auth345';
      // amountは省略

      // 関数を実行
      await capturePayment(chargeId);

      // URLSearchParamsの検証
      const callArgs = fetch.mock.calls[0];
      const bodyString = callArgs[1].body;
      const params = new URLSearchParams(bodyString);
      expect(params.has('amount')).toBe(false); // 金額パラメータが送信されていないことを確認
    });
  });

  describe('releaseAuthorization（与信枠解放）', () => {
    it('正常系：与信枠解放リクエストが成功すること', async () => {
      // モックレスポンスのセットアップ
      const mockResponse = {
        id: 'ch_test_release123',
        amount: 10000,
        amount_refunded: 10000, // 全額解放
        currency: 'jpy',
        refunded: true,
        status: 'refunded'
      };

      // fetchのモック実装
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      // テスト対象のパラメータ
      const chargeId = 'ch_test_auth678';

      // 関数を実行
      const result = await releaseAuthorization(chargeId);

      // 期待する結果の検証
      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(`https://api.pay.jp/v1/charges/${chargeId}/refund`, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic dummy_base64_encoded_string',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: expect.any(String)
      });

      // URLSearchParamsの検証 (refundにはamountが不要なことを確認)
      const callArgs = fetch.mock.calls[0];
      const bodyString = callArgs[1].body;
      const params = new URLSearchParams(bodyString);
      expect(params.has('amount')).toBe(false); // 金額パラメータが送信されていないことを確認
    });

    it('一部金額のみの解放リクエストが成功すること', async () => {
      // モックレスポンスのセットアップ
      const mockResponse = {
        id: 'ch_test_release456',
        amount: 10000, // 元の金額
        amount_refunded: 2000, // 解放金額
        currency: 'jpy',
        refunded: false, // 一部解放なので完全解放フラグはfalse
        status: 'partially_refunded'
      };

      // fetchのモック実装
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      // テスト対象のパラメータ - 一部金額のみ解放
      const chargeId = 'ch_test_auth901';
      const amount = 2000; // 一部のみ解放

      // 関数を実行
      const result = await releaseAuthorization(chargeId, amount);

      // 期待する結果の検証
      expect(result).toEqual(mockResponse);

      // URLSearchParamsの検証
      const callArgs = fetch.mock.calls[0];
      const bodyString = callArgs[1].body;
      const params = new URLSearchParams(bodyString);
      expect(params.get('amount')).toBe('2000'); // 2000円のみ解放
    });

    it('解放時のエラーが適切に処理されること', async () => {
      // エラーレスポンスのモック
      const errorResponse = {
        error: {
          code: 'charge_already_refunded',
          message: '既に解放済みの決済です',
          type: 'processing_error'
        }
      };

      // fetchのモック実装
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => errorResponse
      });

      // テスト対象のパラメータ
      const chargeId = 'ch_test_already_refunded';

      // エラーがスローされることを検証
      await expect(releaseAuthorization(chargeId)).rejects.toThrow('既に解放済みの決済です');
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });
});