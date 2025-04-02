import { createPdfDocument, generatePdfPages, addTableOfContents, addAstrologyChart, addFourPillarsChart, createCalendarPages } from '../lib/pdf-generator.js';
import { generateComprehensiveReading, generateDailyHoroscopes } from '../lib/gemini-api.js';
import { calculateAstrologyData } from '../lib/astrology.js';
import { calculateFourPillarsData } from '../lib/four-pillars.js';

// PDF生成処理を行うサーバーレス関数
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // リクエストからユーザーデータを取得
    const { 
      name, 
      birthDate, 
      birthTime, 
      birthPlace, 
      specificQuestion, 
      paymentId 
    } = req.body;

    // パラメータのバリデーション
    if (!name || !birthDate || !birthTime || !birthPlace || !paymentId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // ストリーミングヘッダー設定
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${name}_lifecycle_potential_horoscope.pdf"`);
    res.setHeader('Transfer-Encoding', 'chunked');

    // PDF作成開始
    const doc = createPdfDocument();
    
    // PDFを直接レスポンスストリームにパイプ
    doc.pipe(res);

    // 基本データの計算
    const astrologyData = calculateAstrologyData(birthDate, birthTime, birthPlace);
    const fourPillarsData = calculateFourPillarsData(birthDate, birthTime);

    // PDFの表紙と導入部分を生成
    await generatePdfPages(doc, {
      name,
      birthDate,
      birthTime,
      birthPlace,
      astrologyData,
      fourPillarsData
    });

    // 目次の追加
    addTableOfContents(doc);

    // Gemini APIで詳細な鑑定文を生成
    const horoscopeReading = await generateComprehensiveReading(
      name, 
      birthDate, 
      birthTime, 
      birthPlace, 
      astrologyData, 
      fourPillarsData, 
      specificQuestion
    );

    // 3つのフレームワークセクションを追加
    doc.addPage();
    doc.fontSize(24).text('I. 核となるエネルギーと個性', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(horoscopeReading.coreEnergy, { align: 'justify' });
    
    doc.addPage();
    doc.fontSize(24).text('II. 才能と人生のテーマ', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(horoscopeReading.lifePurpose, { align: 'justify' });
    
    doc.addPage();
    doc.fontSize(24).text('III. 運気の流れと成長のタイミング', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(horoscopeReading.fortuneTimeline, { align: 'justify' });

    // 星座チャートと命式の視覚的表現を追加
    doc.addPage();
    doc.fontSize(24).text('あなたの星座チャート', { align: 'center' });
    doc.moveDown();
    addAstrologyChart(doc, astrologyData);
    
    doc.addPage();
    doc.fontSize(24).text('あなたの四柱推命命式', { align: 'center' });
    doc.moveDown();
    addFourPillarsChart(doc, fourPillarsData);

    // 特定質問がある場合はその回答を追加
    if (specificQuestion) {
      doc.addPage();
      doc.fontSize(24).text('特別質問への回答', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(specificQuestion, { align: 'left', continued: false });
      doc.moveDown();
      doc.fontSize(12).text(horoscopeReading.specificQuestionAnswer, { align: 'justify' });
    }

    // 総括セクション
    doc.addPage();
    doc.fontSize(24).text('総括とアドバイス', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(horoscopeReading.summary, { align: 'justify' });

    // 並列処理で365日分の日別占いを月ごとに生成
    const monthlyPromises = Array.from({ length: 12 }, async (_, month) => {
      const dailyHoroscopes = await generateDailyHoroscopes(
        name, 
        birthDate, 
        astrologyData, 
        fourPillarsData, 
        month + 1
      );
      return { month: month + 1, horoscopes: dailyHoroscopes };
    });

    // 全ての月の日別占いを待機
    const monthlyResults = await Promise.all(monthlyPromises);
    
    // 日別占いの結果をソートして365日カレンダーを作成
    monthlyResults.sort((a, b) => a.month - b.month);
    
    // 365日カレンダーページを追加
    doc.addPage();
    doc.fontSize(24).text('365日占いカレンダー', { align: 'center' });
    doc.moveDown();
    
    // 月ごとにカレンダーページを作成
    for (const monthData of monthlyResults) {
      createCalendarPages(doc, monthData.month, monthData.horoscopes);
    }

    // PDF生成を完了
    doc.end();
    
    // レスポンスは既にストリーミング開始しているので、ここでは追加レスポンスは不要

  } catch (error) {
    console.error('PDF生成エラー:', error);
    
    // エラー発生時にはレスポンスヘッダーが既に送信されている可能性があるため、
    // エラーハンドリングは慎重に行う
    if (!res.headersSent) {
      return res.status(500).json({ error: 'PDF生成中にエラーが発生しました' });
    } else {
      // ヘッダーが既に送信されている場合は接続を終了するしかない
      res.end();
    }
  }
}