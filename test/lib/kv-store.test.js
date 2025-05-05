// test/lib/kv-store.test.js

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ★★★ vi.unstable_mockModule を使用 ★★★
const { kv, mockSet, mockGet, mockDel, mockExpire, mockHset, mockHget, mockHgetall, mockKeys } = await vi.unstable_mockModule(
  '@vercel/kv', // モック対象のモジュール
  () => { // ファクトリ関数
    const mockSet = vi.fn();
    const mockGet = vi.fn();
    const mockDel = vi.fn();
    const mockExpire = vi.fn();
    const mockHset = vi.fn();
    const mockHget = vi.fn();
    const mockHgetall = vi.fn();
    const mockKeys = vi.fn();
    const kv = {
      set: mockSet,
      get: mockGet,
      del: mockDel,
      expire: mockExpire,
      hset: mockHset,
      hget: mockHget,
      hgetall: mockHgetall,
      keys: mockKeys,
    };
    return { kv, mockSet, mockGet, mockDel, mockExpire, mockHset, mockHget, mockHgetall, mockKeys };
  }
);

// --- テスト対象のモジュールをインポート ---
// ★★★ モック設定後にインポート ★★★
import {
  setValue,
  getValue,
  deleteKey,
  setHashField,
  getHashField,
  getHashAll,
  scanKeys,
  setExpiry,
  safeKVOperation
} from '../../lib/kv-store.js';

// --- describe 以下は変更ありません ---
describe('KVストア連携ライブラリ (kv-store.js)', () => {

  beforeEach(() => {
    // unstable_mockModule で取得したモック関数をリセット
    vi.resetAllMocks();
    // または個別にリセット
    // mockSet.mockClear();
    // ...など

    // デフォルトの戻り値を設定 (必要に応じて)
    mockSet.mockResolvedValue('OK');
    mockGet.mockResolvedValue('test-value');
    mockDel.mockResolvedValue(1);
    mockExpire.mockResolvedValue(1);
    mockHset.mockResolvedValue(1);
    mockHget.mockResolvedValue('test-hash-value');
    mockHgetall.mockResolvedValue({ key1: 'value1', key2: 'value2' });
    mockKeys.mockResolvedValue(['user:1', 'user:2']);
  });

  // --- setValue 関数のテストスイート ---
  describe('setValue 関数', () => {
    it('正常系：キー、値、オプションを指定して値が正しく設定される', async () => {
      const key = 'test-key-set';
      const value = { name: 'テストデータ', items: [10, 20] };
      const options = { ex: 60 * 60 };

      const result = await setValue(key, value, options);

      expect(result).toBe('OK');
      expect(mockSet).toHaveBeenCalledWith(key, value, options);
      expect(mockSet).toHaveBeenCalledTimes(1);
    });

    it('オプションなしでオブジェクト値が正しく設定される', async () => {
      const key = 'user-object-key';
      const value = { id: 123, active: true };

      await setValue(key, value);

      expect(mockSet).toHaveBeenCalledWith(key, value, {});
    });
  });

  // --- getValue 関数のテストスイート ---
  describe('getValue 関数', () => {
    it('正常系：指定したキーの値を取得できる', async () => {
      const key = 'get-this-key';
      const expectedValue = 'これが取得される値';
      mockGet.mockResolvedValueOnce(expectedValue);

      const result = await getValue(key);

      expect(mockGet).toHaveBeenCalledWith(key);
      expect(result).toBe(expectedValue);
    });

    it('存在しないキーの場合は null が返される (KVからの戻り値がnullの場合)', async () => {
      const key = 'non-existent-key';
      mockGet.mockResolvedValueOnce(null);

      const result = await getValue(key);

      expect(mockGet).toHaveBeenCalledWith(key);
      expect(result).toBeNull();
    });

    it('JSON形式のオブジェクト値が正しく取得できる', async () => {
      const key = 'json-data-key';
      const expectedObject = { user: 'Taro', score: 100, settings: { theme: 'dark' } };
      mockGet.mockResolvedValueOnce(expectedObject);

      const result = await getValue(key);

      expect(mockGet).toHaveBeenCalledWith(key);
      expect(result).toEqual(expectedObject);
    });
  });


  // --- deleteKey 関数のテストスイート ---
  describe('deleteKey 関数', () => {
    it('正常系：指定したキーが正しく削除される', async () => {
      const key = 'delete-me';
      mockDel.mockResolvedValueOnce(1);

      const result = await deleteKey(key);

      expect(mockDel).toHaveBeenCalledWith(key);
      expect(result).toBe(1);
    });
  });


  // --- setHashField 関数のテストスイート ---
  describe('setHashField 関数', () => {
    it('正常系：指定したハッシュキーのフィールドに値が正しく設定される', async () => {
      const key = 'my-hash';
      const field = 'username';
      const value = 'Alice';
      mockHset.mockResolvedValueOnce(1);

      const result = await setHashField(key, field, value);

      expect(mockHset).toHaveBeenCalledWith(key, { [field]: value });
      expect(result).toBe(1);
    });
  });


  // --- getHashField 関数のテストスイート ---
  describe('getHashField 関数', () => {
    it('正常系：指定したハッシュキーのフィールドの値を取得できる', async () => {
      const key = 'my-hash';
      const field = 'email';
      const expectedValue = 'alice@example.com';
      mockHget.mockResolvedValueOnce(expectedValue);

      const result = await getHashField(key, field);

      expect(mockHget).toHaveBeenCalledWith(key, field);
      expect(result).toBe(expectedValue);
    });

    it('存在しないフィールドの場合は null が返される (KVからの戻り値がnullの場合)', async () => {
      const key = 'my-hash';
      const field = 'non-existent-field';
      mockHget.mockResolvedValueOnce(null);

      const result = await getHashField(key, field);

      expect(mockHget).toHaveBeenCalledWith(key, field);
      expect(result).toBeNull();
    });
  });


  // --- getHashAll 関数のテストスイート ---
  describe('getHashAll 関数', () => {
    it('正常系：指定したハッシュキーの全てのフィールドと値を取得できる', async () => {
      const key = 'user-profile-hash';
      const expectedHash = { name: 'Bob', age: '25', city: 'Osaka' };
      mockHgetall.mockResolvedValueOnce(expectedHash);

      const result = await getHashAll(key);

      expect(mockHgetall).toHaveBeenCalledWith(key);
      expect(result).toEqual(expectedHash);
    });

    it('存在しないハッシュの場合は null が返される', async () => {
      const key = 'non-existent-hash';
      mockHgetall.mockResolvedValueOnce(null);

      const result = await getHashAll(key);

      expect(mockHgetall).toHaveBeenCalledWith(key);
      expect(result).toBeNull();
    });
  });


  // --- scanKeys 関数のテストスイート ---
  describe('scanKeys 関数', () => {
    it('正常系：指定したパターンに一致するキーのリストを取得できる', async () => {
      const pattern = 'product:*';
      const expectedKeys = ['product:123', 'product:456', 'product:abc'];
      mockKeys.mockResolvedValueOnce(expectedKeys);

      const result = await scanKeys(pattern);

      expect(mockKeys).toHaveBeenCalledWith(pattern);
      expect(result).toEqual(expectedKeys);
    });
  });


  // --- setExpiry 関数のテストスイート ---
  describe('setExpiry 関数', () => {
    it('正常系：指定したキーに有効期限を正しく設定できる', async () => {
      const key = 'session-key';
      const seconds = 30 * 60;
      mockExpire.mockResolvedValueOnce(1);

      const result = await setExpiry(key, seconds);

      expect(mockExpire).toHaveBeenCalledWith(key, seconds);
      expect(result).toBe(1);
    });
  });


  // --- safeKVOperation 関数のテストスイート ---
  describe('safeKVOperation 関数', () => {
    let errorSpy;

    beforeEach(() => {
      // console.errorのスパイを作成
      errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      // テスト後にスパイをリストア
      if (errorSpy) {
        errorSpy.mockRestore();
      }
    });

    it('正常系：渡された操作関数が成功した場合、その結果を返す', async () => {
      const operationResult = { data: '成功データ' };
      const successfulOperation = vi.fn().mockResolvedValue(operationResult);
      const defaultValue = 'デフォルト値';

      const result = await safeKVOperation(successfulOperation, defaultValue);

      expect(successfulOperation).toHaveBeenCalledTimes(1);
      expect(result).toEqual(operationResult);
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('異常系：渡された操作関数が失敗した場合、デフォルト値を返す', async () => {
      const operationError = new Error('KV接続エラー');
      const failedOperation = vi.fn().mockRejectedValue(operationError);
      const defaultValue = { error: true, fallback: 'デフォルトデータ' };

      const result = await safeKVOperation(failedOperation, defaultValue);

      expect(failedOperation).toHaveBeenCalledTimes(1);
      expect(result).toEqual(defaultValue);
      expect(errorSpy).toHaveBeenCalledWith('KVストア操作エラー:', operationError);
    });

    it('異常系：操作関数が失敗し、デフォルト値が指定されていない場合、null を返す', async () => {
      const operationError = new Error('タイムアウト');
      const failedOperation = vi.fn().mockRejectedValue(operationError);

      const result = await safeKVOperation(failedOperation);

      expect(failedOperation).toHaveBeenCalledTimes(1);
      expect(result).toBeNull();
      expect(errorSpy).toHaveBeenCalledWith('KVストア操作エラー:', operationError);
    });
  });

});