/**
 * 決済処理API共通テスト設定
 */
import { vi } from 'vitest';

// Pay.jp APIクライアントのモック
vi.mock('../../lib/payjp-api', () => ({
  createCharge: vi.fn(),
  createAuthorization: vi.fn(),
  capturePayment: vi.fn(),
  releaseAuthorization: vi.fn()
}));

// KVストアのモック
vi.mock('../../lib/kv-store', () => ({
  setValue: vi.fn(),
  getValue: vi.fn(),
  deleteKey: vi.fn()
}));

// ユーティリティ関数のモック
vi.mock('../../lib/utils.js', () => ({
  generateTransactionId: vi.fn().mockReturnValue('test-transaction-id-12345'),
  validateRequiredParams: vi.fn().mockImplementation((params, required) => {
    const missing = required.filter(key => !params[key]);
    if (missing.length > 0) {
      throw new Error(`必須パラメータがありません: ${missing.join(', ')}`);
    }
    return true;
  })
}));

export const createMockRequest = () => ({
  body: {},
  query: {},
  params: {}
});

export const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn(),
  setHeader: vi.fn()
});

/**
 * テスト用のモックをリセットする
 */
export const resetMocks = () => {
  vi.clearAllMocks();
};

/**
 * 決済処理APIテスト
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { processPayment } from '../../api/process-payment';
import {
  createMockRequest,
  createMockResponse,
  resetMocks,
  createTestCharge
} from './test-utils';
import * as payjpApi from '../../lib/payjp-api';
import * as kvStore from '../../lib/kv-store';

describe('支払い処理API', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('正常に支払いを処理できること', async () => {
    // モックの設定
    const mockCharge = createTestCharge();
    payjpApi.createCharge.mockResolvedValue(mockCharge);

    // リクエスト・レスポンスの設定
    const req = createMockRequest();
    req.body = {
      amount: 3000,
      currency: 'jpy',
      cardToken: 'tok_test_12345',
      description: 'テスト支払い'
    };
    const res = createMockResponse();

    // テスト実行
    await processPayment(req, res);

    // 検証
    expect(payjpApi.createCharge).toHaveBeenCalledWith({
      amount: 3000,
      currency: 'jpy',
      card: 'tok_test_12345',
      description: 'テスト支払い',
      metadata: { transactionId: 'test-transaction-id-12345' }
    });
    expect(kvStore.setValue).toHaveBeenCalledWith(
      'payment:test-transaction-id-12345',
      expect.objectContaining({ chargeId: 'ch_test_12345' })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      transactionId: 'test-transaction-id-12345',
      chargeId: 'ch_test_12345'
    }));
  });

  it('必須パラメータが不足している場合はエラーを返すこと', async () => {
    // リクエスト・レスポンスの設定
    const req = createMockRequest();
    req.body = {
      // amountが不足
      currency: 'jpy',
      cardToken: 'tok_test_12345'
    };
    const res = createMockResponse();

    // テスト実行
    await processPayment(req, res);

    // 検証
    expect(payjpApi.createCharge).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.stringContaining('必須パラメータ')
    }));
  });

  it('支払い処理中にエラーが発生した場合は適切にエラーを返すこと', async () => {
    // モックの設定
    payjpApi.createCharge.mockRejectedValue(new Error('決済処理に失敗しました'));

    // リクエスト・レスポンスの設定
    const req = createMockRequest();
    req.body = {
      amount: 3000,
      currency: 'jpy',
      cardToken: 'tok_test_12345',
      description: 'テスト支払い'
    };
    const res = createMockResponse();

    // テスト実行
    await processPayment(req, res);

    // 検証
    expect(payjpApi.createCharge).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.stringContaining('決済処理に失敗')
    }));
  });
});