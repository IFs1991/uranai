// lib/storage.js - Vercel Blob Storageを使用したPDF保存機能

import { put } from '@vercel/blob';
import { randomUUID } from 'crypto';

/**
 * PDFファイルをVercel Blobに保存する
 * 30日間の有効期限付きでアップロードされます
 *
 * @param {Buffer|ReadableStream} fileContent - PDFファイルの内容
 * @param {string} fileName - PDFのファイル名
 * @param {Object} metadata - ファイルに関連するメタデータ（任意）
 * @returns {Promise<Object>} アップロード結果（URL, pathname等）
 */
export async function savePdfToBlob(fileContent, fileName, metadata = {}) {
  try {
    // UUID生成をファイル名に含めて一意性を確保
    const uniqueFileName = `${Date.now()}-${randomUUID()}-${fileName}`;

    // Blobにアップロード（30日後に自動削除）
    const blob = await put(uniqueFileName, fileContent, {
      access: 'public',
      addRandomSuffix: false, // すでにUUIDを含めているため不要
      contentType: 'application/pdf',
      metadata,
      // Vercel Blobはデフォルトで30日間の有効期限があるためexpiresAtは指定不要
    });

    console.log(`PDF saved to Blob: ${blob.url}`);
    return blob;
  } catch (error) {
    console.error('Error saving PDF to Blob:', error);
    throw new Error('PDFのストレージへの保存に失敗しました');
  }
}

/**
 * Vercel Blobからの完全なURLを生成
 *
 * @param {string} pathname - Blobのパス名
 * @returns {string} 完全なURL
 */
export function getBlobUrl(pathname) {
  const baseUrl = process.env.VERCEL_BLOB_STORE_URL || 'https://blob-store.example.com';
  return `${baseUrl}${pathname}`;
}