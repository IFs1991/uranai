// lib/kv-store.js - Vercel KV連携ライブラリ

import { kv as vercelKV } from '@vercel/kv';

/**
 * Vercel KVクライアントのインスタンス
 * 環境変数 KV_REST_API_URL および KV_REST_API_TOKEN を使用して接続
 */
export const kv = vercelKV;

/**
 * 値を保存する（ラッパー関数）
 *
 * @param {string} key - キー
 * @param {any} value - 値
 * @param {object} [options] - オプション（ex: TTL設定等）
 * @returns {Promise<string>} - "OK" または例外
 */
export const setValue = async (key, value, options = {}) => {
  return await kv.set(key, value, options);
};

/**
 * 値を取得する（ラッパー関数）
 *
 * @param {string} key - キー
 * @returns {Promise<any>} - 保存された値またはnull
 */
export const getValue = async (key) => {
  return await kv.get(key);
};

/**
 * キーを削除する（ラッパー関数）
 *
 * @param {string} key - 削除するキー
 * @returns {Promise<number>} - 削除されたキーの数
 */
export const deleteKey = async (key) => {
  return await kv.del(key);
};

/**
 * ハッシュ型のフィールドを設定（ラッパー関数）
 *
 * @param {string} key - ハッシュのキー
 * @param {string} field - フィールド名
 * @param {any} value - フィールドの値
 * @returns {Promise<number>} - 設定された新しいフィールドの数
 */
export const setHashField = async (key, field, value) => {
  return await kv.hset(key, { [field]: value });
};

/**
 * ハッシュ型のフィールドを取得（ラッパー関数）
 *
 * @param {string} key - ハッシュのキー
 * @param {string} field - フィールド名
 * @returns {Promise<any>} - フィールドの値またはnull
 */
export const getHashField = async (key, field) => {
  return await kv.hget(key, field);
};

/**
 * ハッシュ型全体を取得（ラッパー関数）
 *
 * @param {string} key - ハッシュのキー
 * @returns {Promise<object>} - ハッシュ全体またはnull
 */
export const getHashAll = async (key) => {
  return await kv.hgetall(key);
};

/**
 * パターンでキーを検索（ラッパー関数）
 *
 * @param {string} pattern - 検索パターン（例: "user:*"）
 * @returns {Promise<string[]>} - マッチしたキーの配列
 */
export const scanKeys = async (pattern) => {
  return await kv.keys(pattern);
};

/**
 * キーの有効期限を設定（ラッパー関数）
 *
 * @param {string} key - キー
 * @param {number} seconds - 有効期限（秒）
 * @returns {Promise<number>} - 1: 成功、0: キーが存在しない
 */
export const setExpiry = async (key, seconds) => {
  return await kv.expire(key, seconds);
};

/**
 * エラーハンドリング付きでKV操作を実行
 *
 * @param {Function} operation - KV操作を行う関数
 * @param {any} defaultValue - エラー時のデフォルト値
 * @returns {Promise<any>} - 操作結果またはデフォルト値
 */
export const safeKVOperation = async (operation, defaultValue = null) => {
  try {
    return await operation();
  } catch (error) {
    console.error('KVストア操作エラー:', error);
    return defaultValue;
  }
};

// デフォルトエクスポート
export default {
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
};