// lib/kv-store.js - Vercel KVを使用したデータ保存機能

import { kv } from '@vercel/kv';

/**
 * ユーザーPDF情報をKVに保存
 *
 * @param {string} userId - ユーザー識別子（ジョブIDまたは変換されたメールアドレスなど）
 * @param {Object} pdfInfo - PDFに関する情報
 * @param {string} pdfInfo.url - PDFのURL
 * @param {string} pdfInfo.fileName - PDFのファイル名
 * @param {string} pdfInfo.email - ユーザーのメールアドレス
 * @param {Object} pdfInfo.userData - ユーザーデータ（名前、生年月日など）
 * @param {number} [expirationDays=30] - データの有効期限（日数）
 * @returns {Promise<string>} - 保存されたキー
 */
export async function saveUserPdfInfo(userId, pdfInfo, expirationDays = 30) {
  try {
    // キーを生成（user:email:timestamp など）
    const key = `user:${userId}:${Date.now()}`;

    // KVに保存（期限付き）
    const expirationSeconds = expirationDays * 24 * 60 * 60;
    await kv.set(key, {
      ...pdfInfo,
      createdAt: new Date().toISOString()
    }, { ex: expirationSeconds });

    // メールアドレスでの検索用に別のインデックスも保存
    if (pdfInfo.email) {
      const emailKey = `email:${pdfInfo.email}:${Date.now()}`;
      await kv.set(emailKey, key, { ex: expirationSeconds });

      // メールアドレスに関連するPDFリストを更新
      const userPdfsKey = `pdfs:${pdfInfo.email}`;
      await kv.lpush(userPdfsKey, key);
      await kv.expire(userPdfsKey, expirationSeconds);
    }

    console.log(`User PDF info saved to KV with key: ${key}`);
    return key;
  } catch (error) {
    console.error('Error saving to KV:', error);
    throw new Error('ユーザー情報の保存に失敗しました');
  }
}

/**
 * メールアドレスに関連するPDF情報をすべて取得
 *
 * @param {string} email - ユーザーのメールアドレス
 * @returns {Promise<Array>} - PDF情報の配列
 */
export async function getUserPdfsByEmail(email) {
  try {
    // メールアドレスに関連するキーリストを取得
    const userPdfsKey = `pdfs:${email}`;
    const keys = await kv.lrange(userPdfsKey, 0, -1);

    if (!keys || keys.length === 0) {
      return [];
    }

    // 各キーに対応するデータを取得
    const pdfs = await Promise.all(
      keys.map(async (key) => {
        const data = await kv.get(key);
        return data;
      })
    );

    // nullや無効なデータをフィルタリング
    return pdfs.filter(Boolean);
  } catch (error) {
    console.error('Error fetching user PDFs:', error);
    return [];
  }
}

/**
 * 特定のPDF情報を取得
 *
 * @param {string} key - KVのキー
 * @returns {Promise<Object>} - PDF情報
 */
export async function getPdfInfo(key) {
  try {
    return await kv.get(key);
  } catch (error) {
    console.error('Error fetching PDF info:', error);
    return null;
  }
}