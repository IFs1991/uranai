import { vi } from 'vitest';

// モック関数を作成
export const mockSet = vi.fn().mockResolvedValue('OK');
export const mockGet = vi.fn().mockResolvedValue('test-value');
export const mockDel = vi.fn().mockResolvedValue(1);
export const mockExpire = vi.fn().mockResolvedValue(1);
export const mockHset = vi.fn().mockResolvedValue(1);
export const mockHget = vi.fn().mockResolvedValue('test-hash-value');
export const mockHgetall = vi.fn().mockResolvedValue({ key1: 'value1', key2: 'value2' });
export const mockKeys = vi.fn().mockResolvedValue(['user:1', 'user:2']);

// kvオブジェクトをエクスポート
export const kv = {
  set: mockSet,
  get: mockGet,
  del: mockDel,
  expire: mockExpire,
  hset: mockHset,
  hget: mockHget,
  hgetall: mockHgetall,
  keys: mockKeys,
};

// デフォルトエクスポートとしてkvを設定
export default { kv };