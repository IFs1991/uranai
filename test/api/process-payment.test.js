/**
 * 決済処理APIのテスト
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { processPayment, processAuthorization, capturePayment, releaseAuthorization } from '../../api/process-payment';

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
vi.mock('../../lib/utils', () => ({
  generateTransactionId: vi.fn().mockReturnValue('test-transaction-id-12345'),
  validateRequiredParams: vi.fn().mockImplementation((params, required) => {
    const missing = required.filter(key => !params[key]);
    if (missing.length > 0) {
      throw new Error(`必須パラメータがありません: ${missing.join(', ')}`);
    }
    return true;
  })
}));

import { createCharge, createAuthorization, capturePayment as capturePaymentApi, releaseAuthorization as releaseAuthorizationApi } from '../../lib/payjp-api';
import { setValue, getValue, deleteKey } from '../../lib/kv-store';
import { generateTransactionId, validateRequiredParams } from '../../lib/utils';

describe('process-payment.js - 決済処理API', () => {
  // モックリクエスト/レスポンスオブジェクト
  let mockReq;
  let mockRes;

  beforeEach(() => {
    // リクエスト/レスポンスのモック初期化
    mockReq = {
      body: {},
      query: {},
      params: {}
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn()
    };

    // モックのリセット
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('processPayment - 標準決済処理', () => {
    it('正常系: 有効なトークンと顧客情報で決済処理が成功する', async () => {
      // モックの設定
      const chargeId = 'ch_test_12345';
      const amount = 10000;

      // 成功レスポンスのモック
      createCharge.mockResolvedValue({
        id: chargeId,
        amount: amount,
        currency: 'jpy',
        paid: true,
        captured: true,
        customer: null,
        metadata: {
          transactionId: 'test-transaction-id-12345'
        }
      });

      // リクエストボディの設定
      mockReq.body = {
        token: 'tok_test_12345',
        amount: amount,
        userData: {
          name: '山田太郎',
          email: 'test@example.com',
          birthDate: '1990-01-01',
          birthPlace: '東京'
        }
      };

      // テスト対象の関数を実行
      await processPayment(mockReq, mockRes);

      // レスポンスのアサーション
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          paymentId: chargeId,
          amount: amount,
          transactionId: 'test-transaction-id-12345'
        })
      );

      // createCharge関数が適切なパラメータで呼び出されたことを検証
      expect(createCharge).toHaveBeenCalledWith(
        'tok_test_12345',
        amount,
        expect.objectContaining({
          metadata: expect.objectContaining({
            customerName: '山田太郎',
            customerEmail: 'test@example.com',
            transactionId: 'test-transaction-id-12345'
          })
        })
      );

      // KVストアに決済情報が保存されたことを検証
      expect(setValue).toHaveBeenCalledWith(
        expect.stringContaining(chargeId),
        expect.objectContaining({
          paymentId: chargeId,
          amount: amount,
          userData: mockReq.body.userData,
          transactionId: 'test-transaction-id-12345',
          status: 'completed'
        }),
        expect.any(Object) // TTLオプション
      );
    });

    it('エラー処理: 必須パラメータが欠けている場合は400エラーを返す', async () => {
      // 必須パラメータがないリクエスト
      mockReq.body = {
        // tokenがない
        amount: 10000,
        userData: {
          name: '山田太郎',
          // emailがない
          birthDate: '1990-01-01'
        }
      };

      // validateRequiredParamsがエラーをスローするようにモック
      validateRequiredParams.mockImplementationOnce(() => {
        throw new Error('必須パラメータがありません: token, userData.email');
      });

      // テスト対象の関数を実行
      await processPayment(mockReq, mockRes);

      // エラーレスポンスのアサーション
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('必須パラメータがありません')
        })
      );

      // Pay.jp API呼び出しはされていないことを検証
      expect(createCharge).not.toHaveBeenCalled();
    });

    it('エラー処理: Pay.jp APIエラーの場合は適切にハンドリングする', async () => {
      // リクエストボディの設定
      mockReq.body = {
        token: 'tok_test_invalid',
        amount: 10000,
        userData: {
          name: '山田太郎',
          email: 'test@example.com',
          birthDate: '1990-01-01'
        }
      };

      // Pay.jp APIエラーのモック
      createCharge.mockRejectedValue(new Error('カード情報が無効です'));

      // テスト対象の関数を実行
      await processPayment(mockReq, mockRes);

      // エラーレスポンスのアサーション
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('カード情報が無効です')
        })
      );
    });
  });

  describe('processAuthorization - 与信枠確保処理', () => {
    it('正常系: 与信枠確保が成功する', async () => {
      // モックの設定
      const authId = 'ch_test_auth_12345';
      const amount = 10000;

      // 成功レスポンスのモック
      createAuthorization.mockResolvedValue({
        id: authId,
        amount: amount,
        currency: 'jpy',
        paid: true,
        captured: false,
        metadata: {
          transactionId: 'test-transaction-id-12345'
        }
      });

      // リクエストボディの設定
      mockReq.body = {
        token: 'tok_test_12345',
        amount: amount,
        userData: {
          name: '山田太郎',
          email: 'test@example.com',
          birthDate: '1990-01-01'
        },
        expiryDays: 7
      };

      // テスト対象の関数を実行
      await processAuthorization(mockReq, mockRes);

      // レスポンスのアサーション
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          authorizationId: authId,
          amount: amount,
          transactionId: 'test-transaction-id-12345'
        })
      );

      // createAuthorization関数が適切なパラメータで呼び出されたことを検証
      expect(createAuthorization).toHaveBeenCalledWith(
        'tok_test_12345',
        amount,
        expect.objectContaining({
          expiryDays: 7,
          metadata: expect.objectContaining({
            customerName: '山田太郎',
            customerEmail: 'test@example.com',
            transactionId: 'test-transaction-id-12345'
          })
        })
      );

      // KVストアに与信枠情報が保存されたことを検証
      expect(setValue).toHaveBeenCalledWith(
        expect.stringContaining(authId),
        expect.objectContaining({
          authorizationId: authId,
          amount: amount,
          userData: mockReq.body.userData,
          transactionId: 'test-transaction-id-12345',
          status: 'authorized'
        }),
        expect.any(Object)
      );
    });

    it('エラー処理: 与信枠確保中のエラーは適切にハンドリングする', async () => {
      // リクエストボディの設定
      mockReq.body = {
        token: 'tok_test_12345',
        amount: 10000,
        userData: {
          name: '山田太郎',
          email: 'test@example.com'
        }
      };

      // 与信枠確保エラーのモック
      createAuthorization.mockRejectedValue(new Error('与信限度額を超えています'));

      // テスト対象の関数を実行
      await processAuthorization(mockReq, mockRes);

      // エラーレスポンスのアサーション
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('与信限度額を超えています')
        })
      );
    });
  });

  describe('capturePayment - 与信枠確定処理', () => {
    it('正常系: 与信枠確定が成功する', async () => {
      // モックの設定
      const authId = 'ch_test_auth_12345';
      const captureAmount = 10000;

      // KVストアの与信枠情報のモック
      getValue.mockResolvedValue({
        authorizationId: authId,
        amount: captureAmount,
        userData: {
          name: '山田太郎',
          email: 'test@example.com',
          birthDate: '1990-01-01'
        },
        transactionId: 'test-transaction-id-12345',
        status: 'authorized'
      });

      // 与信枠確定成功レスポンスのモック
      capturePaymentApi.mockResolvedValue({
        id: authId,
        amount: captureAmount,
        amount_refunded: 0,
        currency: 'jpy',
        paid: true,
        captured: true
      });

      // リクエストパラメータの設定
      mockReq.params = { authId: authId };
      mockReq.body = {
        amount: captureAmount // 全額確定
      };

      // テスト対象の関数を実行
      await capturePayment(mockReq, mockRes);

      // レスポンスのアサーション
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          paymentId: authId,
          capturedAmount: captureAmount
        })
      );

      // capturePaymentApi関数が適切なパラメータで呼び出されたことを検証
      expect(capturePaymentApi).toHaveBeenCalledWith(
        authId,
        captureAmount
      );

      // KVストアの与信枠情報が更新されたことを検証
      expect(setValue).toHaveBeenCalledWith(
        expect.stringContaining(authId),
        expect.objectContaining({
          paymentId: authId,
          amount: captureAmount,
          status: 'captured'
        }),
        expect.any(Object)
      );
    });

    it('エラー処理: 存在しない与信枠IDの場合は404エラーを返す', async () => {
      // 存在しない与信枠ID
      const nonExistentAuthId = 'ch_test_non_existent';

      // KVストアから値が取得できないようにモック
      getValue.mockResolvedValue(null);

      // リクエストパラメータの設定
      mockReq.params = { authId: nonExistentAuthId };

      // テスト対象の関数を実行
      await capturePayment(mockReq, mockRes);

      // エラーレスポンスのアサーション
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('与信枠情報が見つかりません')
        })
      );

      // capturePaymentApi関数は呼び出されていないことを検証
      expect(capturePaymentApi).not.toHaveBeenCalled();
    });

    it('エラー処理: すでに確定済みの与信枠の場合は400エラーを返す', async () => {
      // 既に確定済みの与信枠ID
      const capturedAuthId = 'ch_test_captured';

      // 確定済みの与信枠情報をモック
      getValue.mockResolvedValue({
        paymentId: capturedAuthId,
        amount: 10000,
        status: 'captured'
      });

      // リクエストパラメータの設定
      mockReq.params = { authId: capturedAuthId };

      // テスト対象の関数を実行
      await capturePayment(mockReq, mockRes);

      // エラーレスポンスのアサーション
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('すでに確定済みの与信枠です')
        })
      );

      // capturePaymentApi関数は呼び出されていないことを検証
      expect(capturePaymentApi).not.toHaveBeenCalled();
    });
  });

  describe('releaseAuthorization - 与信枠解放処理', () => {
    it('正常系: 与信枠解放が成功する', async () => {
      // モックの設定
      const authId = 'ch_test_auth_12345';
      const releaseAmount = 10000;

      // KVストアの与信枠情報のモック
      getValue.mockResolvedValue({
        authorizationId: authId,
        amount: releaseAmount,
        userData: {
          name: '山田太郎',
          email: 'test@example.com'
        },
        transactionId: 'test-transaction-id-12345',
        status: 'authorized'
      });

      // 与信枠解放成功レスポンスのモック
      releaseAuthorizationApi.mockResolvedValue({
        id: authId,
        amount: releaseAmount,
        amount_refunded: releaseAmount,
        currency: 'jpy',
        refunded: true
      });

      // リクエストパラメータの設定
      mockReq.params = { authId: authId };

      // テスト対象の関数を実行
      await releaseAuthorization(mockReq, mockRes);

      // レスポンスのアサーション
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          authorizationId: authId,
          refundedAmount: releaseAmount
        })
      );

      // releaseAuthorizationApi関数が適切なパラメータで呼び出されたことを検証
      expect(releaseAuthorizationApi).toHaveBeenCalledWith(
        authId,
        releaseAmount
      );

      // KVストアの与信枠情報が更新されたことを検証
      expect(setValue).toHaveBeenCalledWith(
        expect.stringContaining(authId),
        expect.objectContaining({
          authorizationId: authId,
          status: 'released'
        }),
        expect.any(Object)
      );
    });

    it('エラー処理: 与信枠解放中のエラーは適切にハンドリングする', async () => {
      // モックの設定
      const authId = 'ch_test_auth_error';

      // KVストアの与信枠情報のモック
      getValue.mockResolvedValue({
        authorizationId: authId,
        amount: 10000,
        status: 'authorized'
      });

      // 与信枠解放エラーのモック
      releaseAuthorizationApi.mockRejectedValue(new Error('与信枠解放エラー'));

      // リクエストパラメータの設定
      mockReq.params = { authId: authId };

      // テスト対象の関数を実行
      await releaseAuthorization(mockReq, mockRes);

      // エラーレスポンスのアサーション
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('与信枠解放エラー')
        })
      );
    });
  });
});