// Use our custom jobId generator instead of uuid library
// import { v4 as uuidv4 } from 'uuid'; // Need to install uuid: npm install uuid
import { jobStore, generateJobId } from './jobStore.js';
import { generateComprehensiveReading, generateDailyHoroscopes } from '../lib/gemini-api.js';
import { calculateAstrologyData } from '../lib/astrology.js';
import { calculateFourPillarsData } from '../lib/four-pillars.js';
import pdfGenerator from '../lib/pdf-generator.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// In-memory store for job progress (replace with a more robust solution for production)
// const jobStore = {}; // Removed, now imported from jobStore.js

// Ensure temp directory exists (Vercel specific)
const ensureTmpDir = async () => {
  const tmpDir = path.join(os.tmpdir(), 'pdf_jobs');
  try {
    await fs.mkdir(tmpDir, { recursive: true });
    return tmpDir;
  } catch (err) {
    console.error('Failed to create temp directory:', err);
    throw new Error('Could not create temporary directory for PDF generation.');
  }
};

// Function to run PDF generation in the background (not truly background in serverless, just async)
async function generatePdfInBackground(jobId, userData, horoscopeReading, dailyHoroscopes) {
  const tmpDir = await ensureTmpDir();
  const outputPath = path.join(tmpDir, `${jobId}.pdf`);

  try {
    jobStore[jobId] = {
      status: 'processing',
      progress: 0,
      message: 'PDF生成を開始しました',
      timestamp: new Date().toISOString(),
      userData
    };

    const onProgress = (progressData) => {
      console.log(`Job ${jobId} Progress:`, progressData); // Log progress
      jobStore[jobId] = {
        ...jobStore[jobId], // Keep existing data like timestamp and userData
        status: progressData.error ? 'error' : (progressData.completed ? 'completed' : 'processing'),
        progress: progressData.progress || jobStore[jobId].progress,
        message: progressData.message,
        path: progressData.completed ? outputPath : undefined, // Store path only on completion
        error: progressData.error ? progressData.message : undefined,
      };
    };

    // Combine horoscope data for pdfGenerator
    const fullHoroscopeData = {
      coreEnergy: { // Structure might need adjustment based on actual data
          sunSign: horoscopeReading.coreEnergy.split('太陽星座: ')[1]?.split(',')[0] || 'N/A', // Example extraction, adjust as needed
          moonSign: horoscopeReading.coreEnergy.split('月星座: ')[1]?.split(',')[0] || 'N/A',
          ascendant: horoscopeReading.coreEnergy.split('アセンダント: ')[1]?.split(',')[0] || 'N/A',
          chartData: horoscopeReading.astrologyChartData, // Assuming Gemini API returns chart data
          dayMaster: horoscopeReading.coreEnergy.split('日主: ')[1]?.split(',')[0] || 'N/A',
          fiveElementsBalance: horoscopeReading.coreEnergy.split('五行バランス: ')[1] || 'N/A',
          fourPillarsData: horoscopeReading.fourPillarsChartData, // Assuming Gemini API returns chart data
          interpretation: horoscopeReading.coreEnergy
      },
      talents: {
          talents: horoscopeReading.lifePurposeDetails?.talents || [], // Adjust based on actual structure
          lifeTheme: horoscopeReading.lifePurposeDetails?.lifeTheme || horoscopeReading.lifePurpose,
          challenges: horoscopeReading.lifePurposeDetails?.challenges || []
      },
      lifeFlow: {
          lifeCycleData: horoscopeReading.fortuneTimelineDetails?.lifeCycleData || {}, // Adjust based on actual structure
          currentTrend: horoscopeReading.fortuneTimelineDetails?.currentTrend || horoscopeReading.fortuneTimeline,
          futureTrend: horoscopeReading.fortuneTimelineDetails?.futureTrend || 'N/A',
          turningPoints: horoscopeReading.fortuneTimelineDetails?.turningPoints || []
      },
      specialQuestionAnswer: horoscopeReading.specificQuestionAnswer,
      summary: horoscopeReading.summary,
      dailyHoroscopes: dailyHoroscopes
    };

    await pdfGenerator.generateFullPDF(userData, fullHoroscopeData, { outputPath, onProgress });

    // Keep job data for a while after completion for download
    setTimeout(() => {
      if (jobStore[jobId] && jobStore[jobId].status === 'completed') {
          console.log(`Cleaning up job data for ${jobId}`);
          // Optional: Delete the PDF file after some time
          // fs.unlink(outputPath).catch(err => console.error(`Error deleting PDF ${outputPath}:`, err));
          delete jobStore[jobId];
      }
    }, 10 * 60 * 1000); // Clean up after 10 minutes

  } catch (error) {
    console.error(`Error during PDF generation for job ${jobId}:`, error);
    jobStore[jobId] = {
      ...jobStore[jobId], // Keep existing data
      status: 'error',
      message: `PDF生成中にエラーが発生しました: ${error.message}`,
      error: error.message
    };
  }
}

// API handler to request PDF generation
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      name,
      birthDate,
      birthTime,
      birthPlace,
      specificQuestion,
      paymentId // Assuming paymentId is still relevant for validation/logging
    } = req.body;

    if (!name || !birthDate || !birthTime || !birthPlace || !paymentId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Generate a unique job ID
    const jobId = generateJobId();
    jobStore[jobId] = {
      status: 'pending',
      progress: 0,
      message: 'リクエスト受付',
      timestamp: new Date().toISOString(),
      userData: { name, birthDate, birthTime, birthPlace, specificQuestion }
    };

    // Respond immediately with the Job ID and SSE endpoint URL
    res.status(202).json({
      jobId: jobId,
      progressUrl: `/api/pdf-progress/${jobId}` // URL for the client to connect via SSE
    });

    // --- Start Background PDF Generation ---
    // Note: In a true serverless environment, this might still be subject to function timeouts.
    // Consider Vercel Background Functions or external queue/worker for long tasks.

    // 1. Calculate base data (Keep this quick)
    const astrologyData = calculateAstrologyData(birthDate, birthTime, birthPlace);
    const fourPillarsData = calculateFourPillarsData(birthDate, birthTime);

    // 2. Generate readings (Can take time)
    jobStore[jobId] = {
      ...jobStore[jobId],
      status: 'processing',
      progress: 5,
      message: '鑑定文生成中...'
    };

    const horoscopeReading = await generateComprehensiveReading(
      name, birthDate, birthTime, birthPlace, astrologyData, fourPillarsData, specificQuestion
    );

    // 3. Generate daily horoscopes (Can take time, potentially parallelize monthly calls if beneficial)
    jobStore[jobId] = {
      ...jobStore[jobId],
      progress: 15,
      message: '365日占い生成中...'
    };

    const monthlyPromises = Array.from({ length: 12 }, (_, month) =>
      generateDailyHoroscopes(name, birthDate, astrologyData, fourPillarsData, month + 1)
    );

    const monthlyResultsArrays = await Promise.all(monthlyPromises);
    // Flatten the array of arrays into a single array of daily horoscopes
    const dailyHoroscopes = monthlyResultsArrays.flat();

    // 4. Start PDF generation async
    generatePdfInBackground(jobId,
      { name, birthDate, birthTime, birthPlace, specificQuestion },
      horoscopeReading,
      dailyHoroscopes
    ).catch(err => {
      // Log error if background generation fails unexpectedly at the top level
      console.error(`Unhandled error in generatePdfInBackground for job ${jobId}:`, err);
      if(jobStore[jobId] && jobStore[jobId].status !== 'completed'){
        jobStore[jobId] = {
          ...jobStore[jobId],
          status: 'error',
          message: 'PDF生成バックグラウンド処理で予期せぬエラー。',
          error: err.message
        };
      }
    });
    // --- End Background PDF Generation ---

  } catch (error) {
    console.error('Error initiating PDF generation request:', error);
    // Attempt to inform client if job ID was generated
    const potentialJobId = Object.keys(jobStore).find(id => jobStore[id].status === 'pending');
    if (potentialJobId) {
      jobStore[potentialJobId] = {
        ...jobStore[potentialJobId],
        status: 'error',
        message: 'リクエスト処理中にエラーが発生しました。',
        error: error.message
      };
    }
    // Send error response if headers not already sent
    if (!res.headersSent) {
      res.status(500).json({ error: 'PDF生成リクエストの開始中にエラーが発生しました' });
    }
  }
}