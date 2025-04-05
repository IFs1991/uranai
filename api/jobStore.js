/**
 * Enhanced in-memory job store for PDF generation progress tracking
 * With added support for email notifications and Vercel Blob storage
 */

// In-memory storage for jobs
export const jobStore = {};

/**
 * Generate a unique ID (simple uuid v4 alternative)
 * @returns {string} A random ID in format xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 * where x is random hex digit and y is random digit from 8, 9, a, or b
 */
export function generateJobId() {
  const pattern = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';

  return pattern.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8); // For 'y', use digits 8, 9, a, or b
    return v.toString(16);
  });
}

/**
 * Job completion handler - stores PDF to Blob and sends email notification
 * @param {string} jobId The job ID
 * @param {object} options Options for completion handling
 * @param {Buffer|ReadableStream} options.pdfContent PDF file content
 * @param {object} options.userData User data including email
 * @param {boolean} options.sendEmail Whether to send an email notification
 */
export async function handleJobCompletion(jobId, { pdfContent, userData, sendEmail = false }) {
  // Import dependencies lazily to avoid loading them unnecessarily
  const { savePdfToBlob } = await import('../lib/storage.js');
  const { saveUserPdfInfo } = await import('../lib/kv-store.js');
  const { emailService } = await import('../lib/email-service.js');

  try {
    if (!jobStore[jobId]) {
      console.warn(`Job ${jobId} not found when handling completion`);
      return;
    }

    // Generate filename
    const userName = userData?.name || 'user';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${userName}_horoscope_${timestamp}.pdf`;

    // Save PDF to Blob storage
    console.log(`Saving PDF for job ${jobId} to Blob storage...`);
    const blob = await savePdfToBlob(pdfContent, fileName, {
      userId: jobId,
      userName: userData?.name,
      userEmail: userData?.email
    });

    // Update job store with Blob URL
    jobStore[jobId] = {
      ...jobStore[jobId],
      status: 'completed',
      progress: 100,
      message: 'PDF生成が完了しました',
      blobUrl: blob.url,
      path: blob.url, // For backward compatibility
      completedAt: new Date().toISOString()
    };

    // If user has email and sendEmail is true, save to KV and send email
    if (userData?.email && sendEmail) {
      // Save PDF info to KV store
      const pdfInfo = {
        url: blob.url,
        fileName,
        email: userData.email,
        userData: {
          name: userData.name,
          birthDate: userData.birthDate,
          birthTime: userData.birthTime,
          birthPlace: userData.birthPlace
        }
      };

      await saveUserPdfInfo(jobId, pdfInfo);

      // Send email notification
      console.log(`Sending email notification to ${userData.email}...`);
      await emailService.sendPdfEmail({
        to: userData.email,
        subject: `${userData.name}様 ライフサイクル・ポテンシャル占術 鑑定結果`,
        text: `${userData.name}様

ライフサイクル・ポテンシャル占術の鑑定をご利用いただき、ありがとうございます。
あなた専用の詳細鑑定結果をPDFファイルとして添付いたしました。

【鑑定情報】
お名前: ${userData.name}
生年月日時: ${userData.birthDate} ${userData.birthTime}
出生地: ${userData.birthPlace}

添付のPDFファイルには、西洋占星術と四柱推命の両方の視点から分析した
あなたの才能、人生のテーマ、運気の流れなどの詳細な鑑定結果が含まれています。

なお、このPDFファイルと鑑定結果へのアクセスは30日間有効です。
必要に応じてダウンロードして保存してください。

ご不明な点やご質問がございましたら、お気軽にお問い合わせください。

-----------------------
ライフサイクル・ポテンシャル占術
[お問い合わせ先を入力]
-----------------------`,
        pdfInfo: {
          url: blob.url,
          fileName
        }
      });

      // Update job with email sent status
      jobStore[jobId].emailSent = true;
    }

    // Set cleanup timeout
    setTimeout(() => {
      if (jobStore[jobId] && jobStore[jobId].status === 'completed') {
        console.log(`Cleaning up job data for ${jobId}`);
        delete jobStore[jobId];
      }
    }, 10 * 60 * 1000); // 10分後にクリーンアップ

    return blob.url;
  } catch (error) {
    console.error(`Error in job completion handler for ${jobId}:`, error);

    // Update job store with error
    if (jobStore[jobId]) {
      jobStore[jobId] = {
        ...jobStore[jobId],
        status: 'error',
        message: `処理完了時にエラーが発生しました: ${error.message}`,
        error: error.message
      };
    }

    throw error;
  }
}

/**
 * Clean up expired jobs (older than maxAgeMinutes)
 * @param {number} maxAgeMinutes Maximum age in minutes to keep jobs
 */
export function cleanupExpiredJobs(maxAgeMinutes = 30) {
  const now = Date.now();
  const maxAge = maxAgeMinutes * 60 * 1000;

  Object.keys(jobStore).forEach(jobId => {
    const job = jobStore[jobId];
    // Delete if job has timestamp and is older than maxAge
    if (job.timestamp && (now - new Date(job.timestamp).getTime()) > maxAge) {
      delete jobStore[jobId];
    }
  });
}

// Set up a periodic cleanup every 10 minutes
if (typeof setInterval !== 'undefined') {
  // Only set up interval if we're in an environment that supports it
  // (not during static build/analysis)
  setInterval(() => cleanupExpiredJobs(30), 10 * 60 * 1000);
}