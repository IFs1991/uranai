// api/user-pdfs.js - ユーザーのPDF情報を取得するAPI

import { getUserPdfsByEmail } from '../lib/kv-store.js';

/**
 * ユーザーのメールアドレスに紐づくPDF情報を取得するAPI
 *
 * @param {Object} req - リクエストオブジェクト
 * @param {Object} res - レスポンスオブジェクト
 */
export default async function handler(req, res) {
  // POSTメソッドのみ許可
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.body;

    // メールアドレスの検証
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: '有効なメールアドレスが必要です' });
    }

    // メールアドレスに紐づくPDF情報を取得
    const pdfs = await getUserPdfsByEmail(email);

    // 結果を返す
    return res.status(200).json({
      success: true,
      count: pdfs.length,
      pdfs: pdfs.map(pdf => ({
        fileName: pdf.fileName,
        url: pdf.url,
        userData: {
          name: pdf.userData?.name,
          birthDate: pdf.userData?.birthDate
        },
        createdAt: pdf.createdAt
      }))
    });

  } catch (error) {
    console.error('Error fetching user PDFs:', error);
    return res.status(500).json({
      success: false,
      error: 'PDFリストの取得に失敗しました',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}