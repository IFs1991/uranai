/**
 * Simple in-memory job store for PDF generation progress tracking
 * In a production environment, consider using a more robust solution like Redis, Vercel KV, or a database
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