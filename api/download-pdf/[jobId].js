import fs from 'fs';
import path from 'path';
import { jobStore } from '../jobStore.js';

/**
 * API ハンドラー: 生成された PDF をダウンロードする
 */
export default async function handler(req, res) {
  // リクエストからジョブ ID を取得
  const jobId = req.query.jobId;

  if (!jobId) {
    return res.status(400).json({ error: '有効なジョブIDが必要です' });
  }

  // job がキャッシュにあるか確認
  const job = jobStore[jobId];
  if (!job) {
    return res.status(404).json({ error: 'ジョブが見つかりません。期限切れまたは無効なIDです。' });
  }

  // ジョブが完了しているか確認
  if (job.status !== 'completed' || !job.path) {
    return res.status(400).json({ error: 'PDF がまだ生成されていないか、生成中にエラーが発生しました。' });
  }

  try {
    // ファイルの存在確認
    const filePath = job.path;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'PDF ファイルが見つかりません。' });
    }

    // ファイル名の生成（ユーザー名と日付から）
    const userName = job.userData?.name || 'user';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${userName}_horoscope_${timestamp}.pdf`;

    // ヘッダーの設定
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    // ファイルの読み取りとストリーミング
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    // エラーハンドリング
    fileStream.on('error', (error) => {
      console.error('PDF ストリーミング中のエラー:', error);
      res.statusCode = 500;
      res.end('PDF ファイルの読み取り中にエラーが発生しました。');
    });
  } catch (error) {
    console.error('PDF ダウンロード中のエラー:', error);
    return res.status(500).json({ error: 'PDF のダウンロード中にエラーが発生しました' });
  }
}