/**
 * KVストア連携ライブラリのテスト
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  kv,
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

// Vercel KVモジュールのモック
vi.mock('@vercel/kv', () => ({
  kv: {
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockImplementation(async (key) => {
      if (key === 'existing-key') return 'stored-value';
      if (key === 'json-key') return { foo: 'bar' };
      return null;
    }),
    del: vi.fn().mockResolvedValue(1),
    hset: vi.fn().mockResolvedValue(1),
    hget: vi.fn().mockImplementation(async (key, field) => {
      if (key === 'user-hash' && field === 'name') return '山田太郎';
      return null;
    }),
    hgetall: vi.fn().mockImplementation(async (key) => {
      if (key === 'user-hash') return { name: '山田太郎', email: 'test@example.com' };
      return null;
    }),
    keys: vi.fn().mockResolvedValue(['key1', 'key2', 'key3']),
    expire: vi.fn().mockResolvedValue(1)
  }
}));

describe('KVストア連携ライブラリ', () => {
  beforeEach(() => {
    // テスト前にモックリセット
    vi.clearAllMocks();
  });

  describe('setValue 関数', () => {
    it('正常系：値が正しく設定される', async () => {
      const result = await setValue('test-key', 'test-value');

      // Vercel KV の set 関数が正しい引数で呼び出されていることを確認
      expect(kv.set).toHaveBeenCalledWith('test-key', 'test-value', {});
      expect(result).toBe('OK');
    });

    it('オプション指定で値が設定される', async () => {
      const options = { ex: 3600 }; // 1時間の有効期限
      await setValue('test-key', 'test-value', options);

      // オプションが正しく渡されることを確認
      expect(kv.set).toHaveBeenCalledWith('test-key', 'test-value', options);
    });

    it('オブジェクト値が正しく設定される', async () => {
      const obj = { name: '山田太郎', age: 30 };
      await setValue('user-key', obj);

      // オブジェクトがそのまま渡されることを確認
      expect(kv.set).toHaveBeenCalledWith('user-key', obj, {});
    });
  });

  describe('getValue 関数', () => {
    it('正常系：保存されている値を取得できる', async () => {
      const value = await getValue('existing-key');

      // Vercel KV の get 関数が正しいキーで呼び出されていることを確認
      expect(kv.get).toHaveBeenCalledWith('existing-key');
      expect(value).toBe('stored-value');
    });

    it('存在しないキーの場合は null が返される', async () => {
      const value = await getValue('non-existing-key');

      expect(kv.get).toHaveBeenCalledWith('non-existing-key');
      expect(value).toBeNull();
    });

    it('JSON値が正しく取得できる', async () => {
      const value = await getValue('json-key');

      expect(kv.get).toHaveBeenCalledWith('json-key');
      expect(value).toEqual({ foo: 'bar' });
    });
  });

  describe('deleteKey 関数', () => {
    it('正常系：キーが正しく削除される', async () => {
      const result = await deleteKey('test-key');

      // Vercel KV の del 関数が正しいキーで呼び出されていることを確認
      expect(kv.del).toHaveBeenCalledWith('test-key');
      expect(result).toBe(1);
    });
  });

  describe('setHashField 関数', () => {
    it('正常系：ハッシュフィールドが正しく設定される', async () => {
      const result = await setHashField('user-hash', 'name', '山田太郎');

      // Vercel KV の hset 関数が正しく呼び出されていることを確認
      expect(kv.hset).toHaveBeenCalledWith('user-hash', { name: '山田太郎' });
      expect(result).toBe(1);
    });
  });

  describe('getHashField 関数', () => {
    it('正常系：ハッシュフィールドの値を取得できる', async () => {
      const value = await getHashField('user-hash', 'name');

      // Vercel KV の hget 関数が正しく呼び出されていることを確認
      expect(kv.hget).toHaveBeenCalledWith('user-hash', 'name');
      expect(value).toBe('山田太郎');
    });

    it('存在しないフィールドの場合は null が返される', async () => {
      const value = await getHashField('user-hash', 'non-existing');

      expect(kv.hget).toHaveBeenCalledWith('user-hash', 'non-existing');
      expect(value).toBeNull();
    });
  });

  describe('getHashAll 関数', () => {
    it('正常系：ハッシュ全体を取得できる', async () => {
      const hash = await getHashAll('user-hash');

      // Vercel KV の hgetall 関数が正しく呼び出されていることを確認
      expect(kv.hgetall).toHaveBeenCalledWith('user-hash');
      expect(hash).toEqual({ name: '山田太郎', email: 'test@example.com' });
    });

    it('存在しないハッシュの場合は null が返される', async () => {
      const hash = await getHashAll('non-existing-hash');

      expect(kv.hgetall).toHaveBeenCalledWith('non-existing-hash');
      expect(hash).toBeNull();
    });
  });

  describe('scanKeys 関数', () => {
    it('正常系：パターンに一致するキーを取得できる', async () => {
      const keys = await scanKeys('user:*');

      // Vercel KV の keys 関数が正しく呼び出されていることを確認
      expect(kv.keys).toHaveBeenCalledWith('user:*');
      expect(keys).toEqual(['key1', 'key2', 'key3']);
    });
  });

  describe('setExpiry 関数', () => {
    it('正常系：キーの有効期限を設定できる', async () => {
      const result = await setExpiry('test-key', 3600);

      // Vercel KV の expire 関数が正しく呼び出されていることを確認
      expect(kv.expire).toHaveBeenCalledWith('test-key', 3600);
      expect(result).toBe(1);
    });
  });

  describe('safeKVOperation 関数', () => {
    it('正常系：操作が成功した場合は結果を返す', async () => {
      const operation = async () => 'operation-result';
      const result = await safeKVOperation(operation);

      expect(result).toBe('operation-result');
    });

    it('操作が失敗した場合はデフォルト値を返す', async () => {
      // エラーをスローする操作
      const operation = async () => { throw new Error('Operation failed'); };
      // コンソールエラーをモック
      console.error = vi.fn();

      const result = await safeKVOperation(operation, 'default-value');

      // エラーがログ出力されることを確認
      expect(console.error).toHaveBeenCalled();
      // デフォルト値が返されることを確認
      expect(result).toBe('default-value');
    });

    it('デフォルト値を指定しない場合は null を返す', async () => {
      // エラーをスローする操作
      const operation = async () => { throw new Error('Operation failed'); };
      // コンソールエラーをモック
      console.error = vi.fn();

      const result = await safeKVOperation(operation);

      // デフォルト値が指定されていない場合は null が返されることを確認
      expect(result).toBeNull();
    });
  });
});