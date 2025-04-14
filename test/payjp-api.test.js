import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCharge } from '../lib/payjp-api';
import {
  VALID_TEST_CARDS,
  TOKEN_ERROR_CARDS,
  PAYMENT_ERROR_CARDS,
  SPECIAL_STATUS_CARDS
} from './payjp-test-cards';

// 環境変数とfetchのモック
vi.mock('process.env', () => ({
  PAYJP_SECRET_KEY: 'sk_test_dummy_secret_key_for_testing',
}));

// グローバルfetchのモック
global.fetch = vi.fn();
global.Buffer = {
  from: vi.fn().mockReturnValue({
    toString: vi.fn().mockReturnValue('dummy_base64_encoded_string')
  })
};

describe('payjp-api', () => {
  beforeEach(() => {
    fetch.mockClear();
    Buffer.from.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createCharge', () => {
    it('正常な決済リクエストが成功すること', async () => {
      // モックレスポンスのセットアップ
      const mockResponse = {
        id: 'ch_test_charge123',
        amount: 10000,
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

      // テスト対象のパラメータ - 有効なテストカード情報を使用
      const validCard = VALID_TEST_CARDS.VISA_1;
      const params = {
        token: `tok_${validCard.number.substring(0, 6)}`,
        amount: 10000,
        currency: 'jpy',
        description: 'テスト決済',
        metadata: { customer_name: 'テストユーザー' }
      };

      // 関数を実行
      const result = await createCharge(params);

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

      // URLSearchParamsの検証 (Stringにしてからパースする方法)
      const callArgs = fetch.mock.calls[0];
      const bodyString = callArgs[1].body;
      const params2 = new URLSearchParams(bodyString);
      expect(params2.get('card')).toBe(params.token);
      expect(params2.get('amount')).toBe(params.amount.toString());
      expect(params2.get('currency')).toBe(params.currency);
      expect(params2.get('description')).toBe(params.description);
      expect(params2.get('metadata')).toBe(JSON.stringify(params.metadata));
    });

    it('カード拒否エラーが適切に処理されること', async () => {
      // エラーレスポンスのモック
      const declinedCard = TOKEN_ERROR_CARDS.CARD_DECLINED;
      const errorResponse = {
        error: {
          code: declinedCard.error_code,
          message: 'カードが拒否されました',
          type: 'card_error'
        }
      };

      // fetchのモック実装
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 402,
        json: async () => errorResponse
      });

      // テスト対象のパラメータ - カード拒否エラーが発生するテストカード
      const params = {
        token: `tok_${declinedCard.number.substring(0, 6)}`,
        amount: 10000
      };

      // エラーがスローされることを検証
      await expect(createCharge(params)).rejects.toThrow('カードが拒否されました');
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('有効期限切れエラーが適切に処理されること', async () => {
      // エラーレスポンスのモック
      const expiredCard = TOKEN_ERROR_CARDS.EXPIRED_CARD;
      const errorResponse = {
        error: {
          code: expiredCard.error_code,
          message: 'カードの有効期限が切れています',
          type: 'card_error'
        }
      };

      // fetchのモック実装
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 402,
        json: async () => errorResponse
      });

      // テスト対象のパラメータ
      const params = {
        token: `tok_${expiredCard.number.substring(0, 6)}`,
        amount: 10000
      };

      // エラーがスローされることを検証
      await expect(createCharge(params)).rejects.toThrow('カードの有効期限が切れています');
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('与信枠超過エラーが適切に処理されること', async () => {
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
        amount: exceededAmount
      };

      // エラーがスローされることを検証
      await expect(createCharge(params)).rejects.toThrow('与信枠を超過しています');
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('fetchがエラーをスローした場合は適切にハンドリングされること', async () => {
      // ネットワークエラーのモック
      fetch.mockRejectedValueOnce(new Error('Network error'));

      // テスト対象のパラメータ
      const validCard = VALID_TEST_CARDS.MASTERCARD_1;
      const params = {
        token: `tok_${validCard.number.substring(0, 6)}`,
        amount: 10000
      };

      // エラーがスローされることを検証
      await expect(createCharge(params)).rejects.toThrow('決済サービスへの接続中にエラーが発生しました');
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('環境変数が設定されていない場合はエラーを返すこと', async () => {
      // PAYJP_SECRET_KEYをnullに設定
      const originalEnv = process.env.PAYJP_SECRET_KEY;
      process.env.PAYJP_SECRET_KEY = '';

      // テスト対象のパラメータ
      const validCard = VALID_TEST_CARDS.JCB_1;
      const params = {
        token: `tok_${validCard.number.substring(0, 6)}`,
        amount: 10000
      };

      // エラーがスローされることを検証
      await expect(createCharge(params)).rejects.toThrow('サーバー設定エラーが発生しました');
      expect(fetch).not.toHaveBeenCalled();

      // 環境変数を元に戻す
      process.env.PAYJP_SECRET_KEY = originalEnv;
    });
  });
});