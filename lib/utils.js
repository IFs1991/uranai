/**
 * 共通ユーティリティ関数
 */

import { format } from 'date-fns';
import crypto from 'crypto';

/**
 * 一意の取引IDを生成する
 * @returns {string} 生成されたトランザクションID
 */
export function generateTransactionId() {
  const timestamp = Date.now().toString();
  const randomStr = crypto.randomBytes(8).toString('hex');
  return `txn_${timestamp}_${randomStr}`;
}

/**
 * 日付をフォーマットする
 * @param {Date|string} date - フォーマットする日付
 * @param {string} formatStr - 日付フォーマット (デフォルト: 'yyyy-MM-dd')
 * @returns {string} フォーマットされた日付文字列
 */
export function formatDate(date, formatStr = 'yyyy-MM-dd') {
  const dateObj = date instanceof Date ? date : new Date(date);
  return format(dateObj, formatStr);
}

/**
 * 必須パラメータがあるかチェックする
 * @param {Object} params - チェックするパラメータオブジェクト
 * @param {string[]} required - 必須パラメータのキー配列
 * @returns {boolean} 全ての必須パラメータが存在する場合はtrue
 * @throws {Error} 必須パラメータが欠けている場合はエラーをスロー
 */
export function validateRequiredParams(params, required) {
  const missing = required.filter(key => {
    // ネストされたキーをサポート (例: 'user.name')
    if (key.includes('.')) {
      const parts = key.split('.');
      let current = params;
      for (const part of parts) {
        if (!current || current[part] === undefined) {
          return true; // 欠けている
        }
        current = current[part];
      }
      return false; // 存在する
    }

    return params[key] === undefined;
  });

  if (missing.length > 0) {
    throw new Error(`必須パラメータがありません: ${missing.join(', ')}`);
  }

  return true;
}

/**
 * エラーハンドリングユーティリティ
 * @param {Error} error - 処理するエラー
 * @param {Object} options - エラー処理オプション
 * @returns {Object} フォーマットされたエラーオブジェクト
 */
export function handleError(error, options = {}) {
  const { defaultMessage = 'エラーが発生しました', logError = true } = options;

  if (logError) {
    console.error('[ERROR]', error);
  }

  return {
    success: false,
    error: error.message || defaultMessage,
    code: error.code || 'UNKNOWN_ERROR'
  };
}

/**
 * 安全にJSONをパースする
 * @param {string} str - パースする文字列
 * @param {*} defaultValue - エラー時のデフォルト値
 * @returns {*} パース結果またはデフォルト値
 */
export function safeJsonParse(str, defaultValue = null) {
  try {
    return str ? JSON.parse(str) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}