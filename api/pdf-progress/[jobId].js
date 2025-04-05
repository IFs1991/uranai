// In memory store of job progress
// WARNING: In a production environment, consider using a persistent store like Redis,
// database, or Vercel KV for better reliability
import { jobStore } from '../jobStore.js';

export default async function handler(req, res) {
  // Get jobId from the URL parameter
  const jobId = req.query.jobId;

  if (!jobId) {
    return res.status(400).json({ error: '有効なジョブIDが必要です' });
  }

  // Check if the job exists
  if (!jobStore[jobId]) {
    return res.status(404).json({ error: 'ジョブが見つかりません' });
  }

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Prevents Nginx from buffering the response

  // Initial message to establish the connection
  res.write(`data: ${JSON.stringify({
    type: 'connected',
    message: 'SSE接続が確立されました',
    jobId
  })}\n\n`);

  // Send current status immediately
  const initialStatus = jobStore[jobId];
  res.write(`data: ${JSON.stringify({
    ...initialStatus,
    type: 'progress',
    timestamp: new Date().toISOString()
  })}\n\n`);

  // Keep track of the last progress value sent to avoid sending duplicates
  let lastProgress = initialStatus.progress || 0;
  let lastStatus = initialStatus.status || 'pending';

  // Set up interval to check for progress updates
  const interval = setInterval(() => {
    // Get current job status
    const currentJob = jobStore[jobId];

    // If job no longer exists or has an error status, end the stream
    if (!currentJob) {
      res.write(`data: ${JSON.stringify({
        type: 'error',
        message: 'ジョブが見つかりません',
        timestamp: new Date().toISOString()
      })}\n\n`);
      clearInterval(interval);
      return res.end();
    }

    // Check if there's a status change or progress change worth reporting
    const hasStatusChange = currentJob.status !== lastStatus;
    const hasProgressChange = Math.abs(currentJob.progress - lastProgress) >= 1; // Report only whole percentage changes

    if (hasStatusChange || hasProgressChange) {
      // Update last sent values
      lastStatus = currentJob.status;
      lastProgress = currentJob.progress;

      // Send the update
      res.write(`data: ${JSON.stringify({
        ...currentJob,
        type: 'progress',
        timestamp: new Date().toISOString()
      })}\n\n`);

      // If job is completed or has an error, end the connection
      if (currentJob.status === 'completed' || currentJob.status === 'error') {
        // Send one more message with download URL if completed
        if (currentJob.status === 'completed') {
          const downloadUrl = currentJob.blobUrl || `/api/download-pdf/${jobId}`;

          res.write(`data: ${JSON.stringify({
            type: 'completed',
            message: 'PDF生成が完了しました',
            downloadUrl: downloadUrl,
            blobUrl: currentJob.blobUrl, // Vercel Blob URL
            emailSent: !!currentJob.emailSent, // メール送信状態
            timestamp: new Date().toISOString()
          })}\n\n`);
        }

        clearInterval(interval);
        res.end();
      }
    }
  }, 1000); // Check every second

  // Handle client disconnect
  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
}