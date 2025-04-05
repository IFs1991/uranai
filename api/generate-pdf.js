/**
 * PDF生成APIエンドポイント
 *
 * このファイルは以下の機能を持ちます：
 * 1. PDF生成リクエストの受け付け
 * 2. 占い結果の生成（Gemini API連携）
 * 3. PDFのバックグラウンド生成
 * 4. 生成状況の管理（jobStore使用）
 */

import { jobStore, generateJobId } from './jobStore.js';
import { generateComprehensiveReading, generateDailyHoroscopes } from '../lib/gemini-api.js';
import { calculateAstrologyData } from '../lib/astrology.js';
import { calculateFourPillarsData } from '../lib/four-pillars.js';
import pdfGenerator from '../lib/pdf-generator.js';
import { emailService } from '../lib/email-service.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// 一時ディレクトリの確保（Vercel環境用）
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

/**
 * バックグラウンドでPDFを生成する関数
 * （サーバーレス環境では真の意味でのバックグラウンド処理ではなく、非同期処理）
 *
 * @param {string} jobId ジョブID
 * @param {object} userData ユーザーデータ（emailを含む可能性あり）
 * @param {object} horoscopeReading 占い結果
 * @param {array} dailyHoroscopes 日別占い
 */
async function generatePdfInBackground(jobId, userData, horoscopeReading, dailyHoroscopes) {
  const tmpDir = await ensureTmpDir();
  const outputPath = path.join(tmpDir, `${jobId}.pdf`);

  try {
    // jobStoreにエントリが存在しない場合は初期化（通常はhandlerから呼び出されるので存在するはず）
    if (!jobStore[jobId]) {
      console.warn(`Job ${jobId} not found in store when starting background task. Initializing.`);
      jobStore[jobId] = {
        status: 'processing',
        progress: 0,
        message: 'PDF生成を開始しました',
        timestamp: new Date().toISOString(),
        userData
      };
    } else {
      // 既存のデータを保持しつつステータスを更新
      jobStore[jobId] = {
        ...jobStore[jobId],
        status: 'processing',
        progress: 0, // この段階でのプログレスをリセット
        message: 'PDF生成を開始しました',
      };
    }

    // 進捗状況更新コールバック
    const onProgress = (progressData) => {
      console.log(`Job ${jobId} Progress:`, progressData);
      jobStore[jobId] = {
        ...jobStore[jobId], // タイムスタンプやユーザーデータなどの既存データを保持
        status: progressData.error ? 'error' : (progressData.completed ? 'completed' : 'processing'),
        progress: progressData.progress || jobStore[jobId].progress,
        message: progressData.message,
        path: progressData.completed ? outputPath : undefined, // 完了時のみパスを保存
        error: progressData.error ? progressData.message : undefined,
      };
    };

    // pdfGenerator用に占いデータを整形
    const fullHoroscopeData = {
      coreEnergy: {
        sunSign: horoscopeReading.coreEnergy.split('太陽星座: ')[1]?.split(',')[0] || 'N/A',
        moonSign: horoscopeReading.coreEnergy.split('月星座: ')[1]?.split(',')[0] || 'N/A',
        ascendant: horoscopeReading.coreEnergy.split('アセンダント: ')[1]?.split(',')[0] || 'N/A',
        chartData: horoscopeReading.astrologyChartData,
        dayMaster: horoscopeReading.coreEnergy.split('日主: ')[1]?.split(',')[0] || 'N/A',
        fiveElementsBalance: horoscopeReading.coreEnergy.split('五行バランス: ')[1] || 'N/A',
        fourPillarsData: horoscopeReading.fourPillarsChartData,
        interpretation: horoscopeReading.coreEnergy
      },
      talents: {
        talents: horoscopeReading.lifePurposeDetails?.talents || [],
        lifeTheme: horoscopeReading.lifePurposeDetails?.lifeTheme || horoscopeReading.lifePurpose,
        challenges: horoscopeReading.lifePurposeDetails?.challenges || []
      },
      lifeFlow: {
        lifeCycleData: horoscopeReading.fortuneTimelineDetails?.lifeCycleData || {},
        currentTrend: horoscopeReading.fortuneTimelineDetails?.currentTrend || horoscopeReading.fortuneTimeline,
        futureTrend: horoscopeReading.fortuneTimelineDetails?.futureTrend || 'N/A',
        turningPoints: horoscopeReading.fortuneTimelineDetails?.turningPoints || []
      },
      specialQuestionAnswer: horoscopeReading.specificQuestionAnswer,
      summary: horoscopeReading.summary,
      dailyHoroscopes: dailyHoroscopes
    };

    // PDF生成実行
    await pdfGenerator.generateFullPDF(userData, fullHoroscopeData, { outputPath, onProgress });

    // PDF生成が完了したことを示す
    onProgress({ progress: 100, message: 'PDF生成完了', completed: true });

    // --- メール送信処理 --- (userData.email が存在する場合)
    if (userData.email) {
        console.log(`Job ${jobId}: PDF generated, attempting to send email to ${userData.email}`);
        jobStore[jobId] = {
            ...jobStore[jobId],
            message: 'PDF生成完了、メール送信準備中...'
        };
        try {
            const pdfContent = await fs.readFile(outputPath, { encoding: 'base64' });
            const fileName = `${userData.name}_${new Date(userData.birthDate).toISOString().split('T')[0]}_占い鑑定書.pdf`;

            await emailService.sendPdfEmail({
                to: userData.email,
                subject: `${userData.name}様の占い鑑定書が完成しました`,
                text: `${userData.name}様

お待たせいたしました。ご依頼いただいた占い鑑定書のPDFファイルが完成しました。
添付ファイルをご確認ください。

${specificQuestion ? `【ご質問内容】\n${specificQuestion}\n\n【回答の概要】\n${horoscopeReading.specificQuestionAnswer || '鑑定書内をご参照ください'}\n\n` : ''}詳細は鑑定書をご覧ください。

ご利用ありがとうございました。`,
                html: `<p>${userData.name}様</p>
<p>お待たせいたしました。ご依頼いただいた占い鑑定書のPDFファイルが完成しました。<br>
添付ファイルをご確認ください。</p>
${specificQuestion ? `<p><strong>【ご質問内容】</strong><br>${specificQuestion.replace(/\n/g, '<br>')}</p><p><strong>【回答の概要】</strong><br>${(horoscopeReading.specificQuestionAnswer || '鑑定書内をご参照ください').replace(/\n/g, '<br>')}</p><br>` : ''}
<p>詳細は鑑定書をご覧ください。</p>
<p>ご利用ありがとうございました。</p>`,
                pdfInfo: {
                    content: pdfContent, // Base64コンテンツ
                    fileName: fileName
                }
            });

            console.log(`Job ${jobId}: Email successfully sent to ${userData.email}`);
            jobStore[jobId] = {
                ...jobStore[jobId],
                message: 'PDF生成完了、メール送信済み'
            };
        } catch (emailError) {
            console.error(`Job ${jobId}: Failed to send email to ${userData.email}`, emailError);
            // メール送信失敗はジョブ全体のエラーとはしないが、メッセージには残す
            jobStore[jobId] = {
                ...jobStore[jobId],
                status: 'completed', // PDF自体は生成されているので完了扱い
                message: `PDF生成完了、しかしメール送信に失敗しました: ${emailError.message}`,
                error: `Email Error: ${emailError.message}` // エラー詳細も記録
            };
        }
    } else {
         console.log(`Job ${jobId}: PDF generated, no email provided.`);
         jobStore[jobId] = {
             ...jobStore[jobId],
             message: 'PDF生成完了（メールアドレス未指定）'
         };
    }
    // --- メール送信処理ここまで ---

    // 完了したジョブデータを一定時間保持（ダウンロード用）
    setTimeout(() => {
      if (jobStore[jobId] && jobStore[jobId].status === 'completed') {
        console.log(`Cleaning up job data for ${jobId}`);
        // オプション: 一定時間後にPDFファイルを削除
        // fs.unlink(outputPath).catch(err => console.error(`Error deleting PDF ${outputPath}:`, err));
        delete jobStore[jobId];
      }
    }, 10 * 60 * 1000); // 10分後にクリーンアップ

  } catch (error) {
    console.error(`Error during PDF generation for job ${jobId}:`, error);
    if (jobStore[jobId]) {
      jobStore[jobId] = {
        ...jobStore[jobId], // 既存データを保持
        status: 'error',
        message: `PDF生成中にエラーが発生しました: ${error.message}`,
        error: error.message
      };
    }
  }
}

/**
 * PDF生成リクエストを処理するAPIハンドラー
 */
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
      email,
      paymentId // 決済検証用
    } = req.body;

    // 必須パラメータのチェック
    if (!name || !birthDate || !birthTime || !birthPlace || !paymentId) {
      return res.status(400).json({ error: '必須パラメータが不足しています' });
    }

    // 一意のジョブIDを生成
    const jobId = generateJobId();
    jobStore[jobId] = {
      status: 'pending',
      progress: 0,
      message: 'リクエスト受付',
      timestamp: new Date().toISOString(),
      userData: { name, birthDate, birthTime, birthPlace, specificQuestion, email }
    };

    // ジョブIDとSSEエンドポイントURLを即時返却
    res.status(202).json({
      jobId: jobId,
      progressUrl: `/api/pdf-progress/${jobId}` // クライアントがSSE接続するためのURL
    });

    // --- バックグラウンドPDF生成開始 ---
    // 注: 実際のサーバーレス環境では関数タイムアウトの制約を受ける可能性があります。
    // Vercel Background FunctionsやAWS Step Functionsなどの検討が推奨されます。

    // 1. 基本データの計算（高速処理）
    const astrologyData = calculateAstrologyData(birthDate, birthTime, birthPlace);
    const fourPillarsData = calculateFourPillarsData(birthDate, birthTime);

    // 2. 鑑定文生成（時間がかかる処理）
    jobStore[jobId] = {
      ...jobStore[jobId],
      status: 'processing',
      progress: 5,
      message: '鑑定文生成中...'
    };

    const horoscopeReading = await generateComprehensiveReading(
      name, birthDate, birthTime, birthPlace, astrologyData, fourPillarsData, specificQuestion
    );

    // 3. 365日占い生成（時間がかかる処理、月単位で並列化）
    jobStore[jobId] = {
      ...jobStore[jobId],
      progress: 15,
      message: '365日占い生成中...'
    };

    // 12ヶ月分を並列生成
    const monthlyPromises = Array.from({ length: 12 }, (_, month) =>
      generateDailyHoroscopes(name, birthDate, astrologyData, fourPillarsData, month + 1)
    );

    const monthlyResultsArrays = await Promise.all(monthlyPromises);
    // 月別配列を単一の日別占い配列に平坦化
    const dailyHoroscopes = monthlyResultsArrays.flat();

    // 4. 非同期でPDF生成開始
    generatePdfInBackground(
      jobId,
      { name, birthDate, birthTime, birthPlace, specificQuestion, email },
      horoscopeReading,
      dailyHoroscopes
    ).catch(err => {
      // トップレベルでバックグラウンド生成が予期せず失敗した場合にログ出力
      console.error(`Unhandled error in generatePdfInBackground for job ${jobId}:`, err);
      if (jobStore[jobId] && jobStore[jobId].status !== 'completed') {
        jobStore[jobId] = {
          ...jobStore[jobId],
          status: 'error',
          message: 'PDF生成バックグラウンド処理で予期せぬエラーが発生しました。',
          error: err.message
        };
      }
    });
    // --- バックグラウンドPDF生成終了 ---

  } catch (error) {
    console.error('Error initiating PDF generation request:', error);
    // ジョブIDが生成されていれば、そのジョブのステータスを更新
    const potentialJobId = Object.keys(jobStore).find(id => jobStore[id].status === 'pending');
    if (potentialJobId) {
      jobStore[potentialJobId] = {
        ...jobStore[potentialJobId],
        status: 'error',
        message: 'リクエスト処理中にエラーが発生しました。',
        error: error.message
      };
    }
    // ヘッダーがまだ送信されていなければエラーレスポンスを返す
    if (!res.headersSent) {
      res.status(500).json({ error: 'PDF生成リクエストの開始中にエラーが発生しました' });
    }
  }
}