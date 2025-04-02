// PDFKitを使用した占い結果PDF生成ライブラリ
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { createWriteStream } = require('fs');
const astrology = require('./astrology');
const fourPillars = require('./four-pillars');

// 標準フォント設定
const FONTS = {
  NORMAL: 'Helvetica',
  BOLD: 'Helvetica-Bold',
  ITALIC: 'Helvetica-Oblique',
  JAPANESE: 'Hiragino Sans', // macOSに標準搭載の日本語フォント
};

// カラー設定
const COLORS = {
  PRIMARY: '#483D8B',    // ダークスレートブルー - 宇宙・神秘的なイメージ
  SECONDARY: '#FFD700',  // ゴールド - 星のアクセント
  TERTIARY: '#9370DB',   // ミディアムパープル - 東洋的要素
  BACKGROUND: '#191970', // ミッドナイトブルー - 宇宙背景
  TEXT: '#F8F8FF',       // ほぼ白 - 暗い背景に読みやすく
  HEADING: '#FFD700',    // 見出し用ゴールド
  SUBHEADING: '#9370DB', // サブ見出し用パープル
};

class PDFGenerator {
  constructor() {
    this.doc = null;
    this.stream = null;
    this.currentPage = 1;
    this.totalPages = 0;
  }

  /**
   * PDF生成を開始し、ストリームを返す
   * @param {Object} userData ユーザーデータ（名前、生年月日時、出生地など）
   * @param {Object} options PDF生成オプション
   * @returns {stream.Readable} 読み取り可能なストリーム
   */
  createStream(userData, options = {}) {
    // PDFドキュメント初期化（A4サイズ）
    this.doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      bufferPages: true, // ページ番号付けのためにバッファリング
      autoFirstPage: false, // 最初のページは手動で追加
    });
    
    // ストリーム作成
    this.stream = this.doc.pipe(createWriteStream(options.outputPath || 'horoscope.pdf'));
    
    // メタデータ設定
    this.doc.info.Title = `${userData.name}様 ライフサイクル・ポテンシャル占術 詳細鑑定書`;
    this.doc.info.Author = 'ライフサイクル・ポテンシャル占術';
    this.doc.info.Subject = '西洋占星術と四柱推命を統合した詳細鑑定';
    this.doc.info.Keywords = '占い,西洋占星術,四柱推命,運勢,ライフサイクル';
    
    // ユーザーデータ保存
    this.userData = userData;
    
    return this.doc;
  }

  /**
   * 完全なPDFを生成
   * @param {Object} userData ユーザーデータ
   * @param {Object} horoscopeData 占い結果データ
   * @param {Object} options オプション
   * @returns {Promise<string>} 生成されたPDFのパス
   */
  async generateFullPDF(userData, horoscopeData, options = {}) {
    const outputPath = options.outputPath || `horoscope_${Date.now()}.pdf`;
    
    // ストリームを作成
    this.createStream(userData, { outputPath });
    
    try {
      // PDFの各セクションを順次生成
      await this.generateCoverPage(userData);
      await this.generateIntroductionPage();
      await this.generateTableOfContents();
      
      // 3つのフレームワークセクションを生成
      await this.generateCoreEnergySection(horoscopeData.coreEnergy);
      await this.generateTalentsSection(horoscopeData.talents);
      await this.generateLifeFlowSection(horoscopeData.lifeFlow);
      
      // 特別質問がある場合は回答セクションを生成
      if (userData.specialQuestion) {
        await this.generateSpecialQuestionSection(
          userData.specialQuestion, 
          horoscopeData.specialQuestionAnswer
        );
      }
      
      // 総括セクション
      await this.generateSummarySection(horoscopeData.summary);
      
      // 365日占いカレンダーセクションを並列生成
      await this.generate365DaysCalendar(horoscopeData.dailyHoroscopes);
      
      // ページ番号を追加
      this.addPageNumbers();
      
      // PDFを完了
      this.doc.end();
      
      // ストリームが閉じるのを待つ
      await new Promise(resolve => this.stream.on('finish', resolve));
      
      return outputPath;
    } catch (error) {
      // エラーが発生した場合はストリームを破棄
      this.doc.end();
      throw new Error(`PDF生成エラー: ${error.message}`);
    }
  }

  /**
   * 表紙ページを生成
   * @param {Object} userData ユーザーデータ
   */
  async generateCoverPage(userData) {
    this.doc.addPage();
    
    // 背景を設定
    this.drawStarryBackground();
    
    // タイトル
    this.doc.fontSize(28)
       .font(FONTS.BOLD)
       .fillColor(COLORS.HEADING)
       .text('ライフサイクル・ポテンシャル占術', {
         align: 'center',
         continued: false
       })
       .moveDown(0.5);
    
    this.doc.fontSize(22)
       .fillColor(COLORS.TEXT)
       .text('詳細鑑定書', {
         align: 'center',
         continued: false
       })
       .moveDown(2);
    
    // 占い対象者情報
    this.doc.fontSize(16)
       .fillColor(COLORS.SECONDARY)
       .text(`${userData.name} 様`, {
         align: 'center',
         continued: false
       })
       .moveDown(1);
    
    // 生年月日時と出生地
    const birthDateText = this.formatBirthDateTime(userData);
    
    this.doc.fontSize(12)
       .fillColor(COLORS.TEXT)
       .text(`生年月日時: ${birthDateText}`, {
         align: 'center',
         continued: false
       })
       .moveDown(0.5);
    
    this.doc.text(`出生地: ${userData.birthPlace}`, {
      align: 'center',
      continued: false
    })
    .moveDown(2);
    
    // 生成日時
    const today = new Date();
    const formattedDate = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
    
    this.doc.fontSize(10)
       .fillColor(COLORS.TEXT)
       .text(`鑑定日: ${formattedDate}`, {
         align: 'center',
         continued: false
       })
       .moveDown(1);
    
    // フッター
    this.doc.fontSize(8)
       .fillColor(COLORS.TEXT)
       .text('© ライフサイクル・ポテンシャル占術', {
         align: 'center'
       });
  }

  /**
   * 導入ページを生成
   */
  async generateIntroductionPage() {
    this.doc.addPage();
    
    // ページタイトル
    this.doc.fontSize(20)
       .font(FONTS.BOLD)
       .fillColor(COLORS.HEADING)
       .text('はじめに', {
         align: 'center',
         continued: false
       })
       .moveDown(1);
    
    // 導入テキスト
    this.doc.fontSize(12)
       .font(FONTS.NORMAL)
       .fillColor(COLORS.TEXT)
       .text('この鑑定書について', {
         continued: false,
         underline: true
       })
       .moveDown(0.5);
    
    this.doc.text(
      'ライフサイクル・ポテンシャル占術は、西洋占星術と東洋の四柱推命を統合した新しい占術システムです。' +
      '両方の叡智を組み合わせることで、あなたの人生の可能性をより多角的に分析し、潜在的なポテンシャルを最大限に引き出すためのガイダンスを提供します。',
      { align: 'justify', continued: false }
    )
    .moveDown(1);
    
    this.doc.text('この鑑定書の使い方', {
      continued: false,
      underline: true
    })
    .moveDown(0.5);
    
    this.doc.text(
      '本鑑定書は以下の3つのフレームワークを通じて、あなたの人生をより深く理解するためのガイドです：' +
      '\n\n1. 核となるエネルギーと個性 — あなたの本質的な特徴と可能性' +
      '\n2. 才能と人生のテーマ — あなたの潜在的な能力と人生の目的' +
      '\n3. 運気の流れと成長のタイミング — 人生の波と最適な行動時期',
      { align: 'justify', continued: false }
    )
    .moveDown(1);
    
    this.doc.text(
      '最後には365日の日別占いカレンダーを収録しており、毎日の指針としてご活用いただけます。',
      { align: 'justify', continued: false }
    )
    .moveDown(1);
    
    // 西洋占星術と四柱推命の説明
    this.doc.fontSize(12)
       .font(FONTS.BOLD)
       .fillColor(COLORS.SUBHEADING)
       .text('西洋占星術と四柱推命について', {
         continued: false
       })
       .moveDown(0.5);
    
    this.doc.font(FONTS.NORMAL)
       .fillColor(COLORS.TEXT)
       .text(
         '西洋占星術は太陽系の惑星の動きを基に、あなたの性格や運命を読み解きます。' +
         '一方、四柱推命は中国の陰陽五行思想に基づき、生年月日時から導き出される干支の組み合わせにより、' +
         'あなたの本質や人生の流れを捉えます。',
         { align: 'justify', continued: false }
       )
       .moveDown(0.5);
    
    this.doc.text(
      'これら二つの占術体系はそれぞれ異なるアプローチながらも、人間の本質と可能性を探求するという' +
      '共通の目標を持っています。本鑑定書ではこの二つを組み合わせることで、より立体的な人生の見取り図を提供します。',
      { align: 'justify', continued: false }
    );
  }

  /**
   * 目次ページを生成
   */
  async generateTableOfContents() {
    this.doc.addPage();
    
    // ページタイトル
    this.doc.fontSize(20)
       .font(FONTS.BOLD)
       .fillColor(COLORS.HEADING)
       .text('目次', {
         align: 'center',
         continued: false
       })
       .moveDown(2);
    
    // 目次項目
    const tocItems = [
      { title: 'はじめに', page: 2 },
      { title: '1. 核となるエネルギーと個性', page: 4 },
      { title: '2. 才能と人生のテーマ', page: 6 },
      { title: '3. 運気の流れと成長のタイミング', page: 8 }
    ];
    
    // ユーザーの特別質問がある場合は目次に追加
    if (this.userData.specialQuestion) {
      tocItems.push({ title: '4. 特別質問への回答', page: 10 });
      tocItems.push({ title: '5. 総括とアドバイス', page: 11 });
      tocItems.push({ title: '6. 365日占いカレンダー', page: 12 });
    } else {
      tocItems.push({ title: '4. 総括とアドバイス', page: 10 });
      tocItems.push({ title: '5. 365日占いカレンダー', page: 11 });
    }
    
    // 目次の各項目を描画
    this.doc.fontSize(14)
       .font(FONTS.NORMAL)
       .fillColor(COLORS.TEXT);
    
    tocItems.forEach(item => {
      this.doc.text(
        item.title, 
        50, 
        this.doc.y, 
        { 
          continued: true,
          width: 400
        }
      );
      
      // 点線
      const xPos = this.doc.x;
      const yPos = this.doc.y;
      const lineWidth = 450 - xPos;
      
      this.doc.fontSize(14)
         .text('', { continued: false })
         .moveUp();
      
      // 点線を描画
      this.doc.fontSize(14)
         .text('. . . . . . . . . . . . . . . . . . . . ', xPos, yPos, {
           continued: true,
           width: lineWidth,
           align: 'right'
         });
      
      // ページ番号
      this.doc.text(`${item.page}`, { align: 'right', continued: false })
         .moveDown(1);
    });
  }

  /**
   * 核となるエネルギーと個性セクションを生成
   * @param {Object} coreEnergyData 核となるエネルギーデータ
   */
  async generateCoreEnergySection(coreEnergyData) {
    this.doc.addPage();
    
    // セクションタイトル
    this.doc.fontSize(20)
       .font(FONTS.BOLD)
       .fillColor(COLORS.HEADING)
       .text('1. 核となるエネルギーと個性', {
         align: 'center',
         continued: false
       })
       .moveDown(1);
    
    // 西洋占星術データ
    this.doc.fontSize(16)
       .fillColor(COLORS.SUBHEADING)
       .text('西洋占星術のホロスコープ', {
         continued: false
       })
       .moveDown(0.5);
    
    // ホロスコープ情報の表示
    this.doc.fontSize(12)
       .font(FONTS.NORMAL)
       .fillColor(COLORS.TEXT);
    
    const horoscopeData = [
      { label: '太陽星座', value: coreEnergyData.sunSign },
      { label: '月星座', value: coreEnergyData.moonSign },
      { label: 'アセンダント', value: coreEnergyData.ascendant }
    ];
    
    horoscopeData.forEach(item => {
      this.doc.text(`${item.label}: `, {
        continued: true,
        width: 120
      });
      
      this.doc.font(FONTS.BOLD)
         .text(item.value, {
           continued: false
         })
         .font(FONTS.NORMAL)
         .moveDown(0.5);
    });
    
    this.doc.moveDown(0.5);
    
    // SVGホロスコープチャート
    this.drawHoroscopeChart(coreEnergyData.chartData);
    
    this.doc.moveDown(1);
    
    // 四柱推命データ
    this.doc.fontSize(16)
       .font(FONTS.BOLD)
       .fillColor(COLORS.SUBHEADING)
       .text('四柱推命の命式', {
         continued: false
       })
       .moveDown(0.5);
    
    // 命式情報の表示
    this.doc.fontSize(12)
       .font(FONTS.NORMAL)
       .fillColor(COLORS.TEXT);
    
    const fourPillarsData = [
      { label: '日主（本命）', value: coreEnergyData.dayMaster },
      { label: '五行バランス', value: coreEnergyData.fiveElementsBalance }
    ];
    
    fourPillarsData.forEach(item => {
      this.doc.text(`${item.label}: `, {
        continued: true,
        width: 120
      });
      
      this.doc.font(FONTS.BOLD)
         .text(item.value, {
           continued: false
         })
         .font(FONTS.NORMAL)
         .moveDown(0.5);
    });
    
    this.doc.moveDown(0.5);
    
    // 命式チャート
    this.drawFourPillarsChart(coreEnergyData.fourPillarsData);
    
    this.doc.moveDown(1);
    
    // 解釈
    this.doc.fontSize(14)
       .font(FONTS.BOLD)
       .fillColor(COLORS.SUBHEADING)
       .text('あなたの核となるエネルギー', {
         continued: false
       })
       .moveDown(0.5);
    
    this.doc.fontSize(12)
       .font(FONTS.NORMAL)
       .fillColor(COLORS.TEXT)
       .text(coreEnergyData.interpretation, {
         align: 'justify',
         continued: false
       });
  }

  /**
   * 才能と人生のテーマセクションを生成
   * @param {Object} talentsData 才能データ
   */
  async generateTalentsSection(talentsData) {
    this.doc.addPage();
    
    // セクションタイトル
    this.doc.fontSize(20)
       .font(FONTS.BOLD)
       .fillColor(COLORS.HEADING)
       .text('2. 才能と人生のテーマ', {
         align: 'center',
         continued: false
       })
       .moveDown(1);
    
    // 主要な才能
    this.doc.fontSize(16)
       .fillColor(COLORS.SUBHEADING)
       .text('あなたの主要な才能', {
         continued: false
       })
       .moveDown(0.5);
    
    // 才能リスト
    talentsData.talents.forEach((talent, index) => {
      this.doc.fontSize(14)
         .font(FONTS.BOLD)
         .fillColor(COLORS.SECONDARY)
         .text(`${index + 1}. ${talent.title}`, {
           continued: false
         })
         .moveDown(0.3);
      
      this.doc.fontSize(12)
         .font(FONTS.NORMAL)
         .fillColor(COLORS.TEXT)
         .text(talent.description, {
           align: 'justify',
           continued: false
         })
         .moveDown(0.8);
    });
    
    this.doc.moveDown(0.5);
    
    // 人生のテーマ
    this.doc.fontSize(16)
       .font(FONTS.BOLD)
       .fillColor(COLORS.SUBHEADING)
       .text('あなたの人生のテーマ', {
         continued: false
       })
       .moveDown(0.5);
    
    this.doc.fontSize(12)
       .font(FONTS.NORMAL)
       .fillColor(COLORS.TEXT)
       .text(talentsData.lifeTheme, {
         align: 'justify',
         continued: false
       })
       .moveDown(1);
    
    // チャレンジと成長ポイント
    this.doc.fontSize(16)
       .font(FONTS.BOLD)
       .fillColor(COLORS.SUBHEADING)
       .text('チャレンジと成長ポイント', {
         continued: false
       })
       .moveDown(0.5);
    
    talentsData.challenges.forEach((challenge, index) => {
      this.doc.fontSize(12)
         .font(FONTS.BOLD)
         .fillColor(COLORS.TEXT)
         .text(`・${challenge.title}`, {
           continued: false
         })
         .moveDown(0.3);
      
      this.doc.font(FONTS.NORMAL)
         .text(challenge.description, {
           align: 'justify',
           continued: false
         })
         .moveDown(0.5);
    });
  }

  /**
   * 運気の流れと成長のタイミングセクションを生成
   * @param {Object} lifeFlowData 運気の流れデータ
   */
  async generateLifeFlowSection(lifeFlowData) {
    this.doc.addPage();
    
    // セクションタイトル
    this.doc.fontSize(20)
       .font(FONTS.BOLD)
       .fillColor(COLORS.HEADING)
       .text('3. 運気の流れと成長のタイミング', {
         align: 'center',
         continued: false
       })
       .moveDown(1);
    
    // 人生周期チャート
    this.doc.fontSize(16)
       .fillColor(COLORS.SUBHEADING)
       .text('あなたの人生周期', {
         continued: false
       })
       .moveDown(0.5);
    
    this.drawLifeCycleChart(lifeFlowData.lifeCycleData);
    
    this.doc.moveDown(1);
    
    // 運気の流れ
    this.doc.fontSize(16)
       .font(FONTS.BOLD)
       .fillColor(COLORS.SUBHEADING)
       .text('運気の流れ', {
         continued: false
       })
       .moveDown(0.5);
    
    // 現在と今後の運気
    this.doc.fontSize(14)
       .fillColor(COLORS.TERTIARY)
       .text('現在の運気', {
         continued: false
       })
       .moveDown(0.3);
    
    this.doc.fontSize(12)
       .font(FONTS.NORMAL)
       .fillColor(COLORS.TEXT)
       .text(lifeFlowData.currentTrend, {
         align: 'justify',
         continued: false
       })
       .moveDown(0.8);
    
    this.doc.fontSize(14)
       .font(FONTS.BOLD)
       .fillColor(COLORS.TERTIARY)
       .text('今後の展望', {
         continued: false
       })
       .moveDown(0.3);
    
    this.doc.fontSize(12)
       .font(FONTS.NORMAL)
       .fillColor(COLORS.TEXT)
       .text(lifeFlowData.futureTrend, {
         align: 'justify',
         continued: false
       })
       .moveDown(1);
    
    // ターニングポイント
    this.doc.fontSize(16)
       .font(FONTS.BOLD)
       .fillColor(COLORS.SUBHEADING)
       .text('重要なターニングポイント', {
         continued: false
       })
       .moveDown(0.5);
    
    lifeFlowData.turningPoints.forEach((point, index) => {
      this.doc.fontSize(14)
         .font(FONTS.BOLD)
         .fillColor(COLORS.SECONDARY)
         .text(`${point.age}歳: ${point.title}`, {
           continued: false
         })
         .moveDown(0.3);
      
      this.doc.fontSize(12)
         .font(FONTS.NORMAL)
         .fillColor(COLORS.TEXT)
         .text(point.description, {
           align: 'justify',
           continued: false
         })
         .moveDown(0.8);
    });
  }

  /**
   * 特別質問への回答セクションを生成
   * @param {string} question 質問
   * @param {string} answer 回答
   */
  async generateSpecialQuestionSection(question, answer) {
    this.doc.addPage();
    
    // セクションタイトル
    this.doc.fontSize(20)
       .font(FONTS.BOLD)
       .fillColor(COLORS.HEADING)
       .text('4. 特別質問への回答', {
         align: 'center',
         continued: false
       })
       .moveDown(1);
    
    // 質問
    this.doc.fontSize(16)
       .fillColor(COLORS.SUBHEADING)
       .text('あなたの質問', {
         continued: false
       })
       .moveDown(0.5);
    
    this.doc.fontSize(14)
       .font(FONTS.ITALIC)
       .fillColor(COLORS.TEXT)
       .text(`"${question}"`, {
         align: 'left',
         continued: false
       })
       .moveDown(1);
    
    // 回答
    this.doc.fontSize(16)
       .font(FONTS.BOLD)
       .fillColor(COLORS.SUBHEADING)
       .text('鑑定結果', {
         continued: false
       })
       .moveDown(0.5);
    
    this.doc.fontSize(12)
       .font(FONTS.NORMAL)
       .fillColor(COLORS.TEXT)
       .text(answer, {
         align: 'justify',
         continued: false
       });
  }

  /**
   * 総括セクションを生成
   * @param {string} summary 総括テキスト
   */
  async generateSummarySection(summary) {
    this.doc.addPage();
    
    const sectionNumber = this.userData.specialQuestion ? '5' : '4';
    
    // セクションタイトル
    this.doc.fontSize(20)
       .font(FONTS.BOLD)
       .fillColor(COLORS.HEADING)
       .text(`${sectionNumber}. 総括とアドバイス`, {
         align: 'center',
         continued: false
       })
       .moveDown(1);
    
    // 総括テキスト
    this.doc.fontSize(12)
       .font(FONTS.NORMAL)
       .fillColor(COLORS.TEXT)
       .text(summary, {
         align: 'justify',
         continued: false
       })
       .moveDown(1);
    
    // 最終メッセージ
    this.doc.fontSize(14)
       .font(FONTS.BOLD)
       .fillColor(COLORS.SECONDARY)
       .text('あなたの可能性を最大限に', {
         align: 'center',
         continued: false
       })
       .moveDown(0.5);
    
    this.doc.fontSize(12)
       .font(FONTS.ITALIC)
       .fillColor(COLORS.TEXT)
       .text(
         'この鑑定書が、あなたの人生の航路を照らす星となりますように。' +
         'あなたの内なる力を信じ、自分自身の可能性を最大限に引き出してください。' +
         'すべての瞬間が、あなたの人生の物語を紡いでいます。',
         {
           align: 'center',
           continued: false
         }
       );
  }

  /**
   * 365日占いカレンダーセクションを生成
   * @param {Array} dailyHoroscopes 365日分の占いデータ
   */
  async generate365DaysCalendar(dailyHoroscopes) {
    const sectionNumber = this.userData.specialQuestion ? '6' : '5';
    
    this.doc.addPage();
    
    // セクションタイトル
    this.doc.fontSize(20)
       .font(FONTS.BOLD)
       .fillColor(COLORS.HEADING)
       .text(`${sectionNumber}. 365日占いカレンダー`, {
         align: 'center',
         continued: false
       })
       .moveDown(1);
    
    // カレンダーの説明
    this.doc.fontSize(12)
       .font(FONTS.NORMAL)
       .fillColor(COLORS.TEXT)
       .text(
         'このカレンダーでは、あなたの今後365日の日別占いを提供します。' +
         '各日の運気の傾向と、特に注目すべきポイントを確認できます。' +
         '毎日の参考にしていただき、最適なタイミングで行動する指針としてください。',
         {
           align: 'justify',
           continued: false
         }
       )
       .moveDown(1);
    
    // 月別に並列処理で生成
    const months = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    
    // 各月のカレンダーを生成
    for (const month of months) {
      await this.generateMonthlyCalendar(month, dailyHoroscopes);
    }
  }

  /**
   * 月別カレンダーページを生成
   * @param {number} month 月(0-11)
   * @param {Array} dailyHoroscopes 365日分の占いデータ
   */
  async generateMonthlyCalendar(month, dailyHoroscopes) {
    this.doc.addPage();
    
    const today = new Date();
    const year = today.getFullYear();
    const monthName = new Date(year, month, 1).toLocaleString('ja-JP', { month: 'long' });
    
    // 月タイトル
    this.doc.fontSize(18)
       .font(FONTS.BOLD)
       .fillColor(COLORS.HEADING)
       .text(`${monthName}`, {
         align: 'center',
         continued: false
       })
       .moveDown(1);
    
    // その月の日数を取得
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // カレンダーグリッドを描画
    const startX = 50;
    const startY = this.doc.y;
    const cellWidth = 70;
    const cellHeight = 90;
    const colsPerRow = 7;
    
    // 曜日ヘッダー
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    
    weekdays.forEach((day, i) => {
      this.doc.fontSize(10)
         .font(FONTS.BOLD)
         .fillColor(i === 0 ? '#FF0000' : i === 6 ? '#0000FF' : COLORS.TEXT)
         .text(day, startX + i * cellWidth + 30, startY, {
           width: cellWidth,
           align: 'center'
         });
    });
    
    // 月の最初の日の曜日を取得
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    
    // 各日のセルを描画
    let currentRow = 0;
    let currentCol = firstDayOfMonth;
    
    for (let day = 1; day <= daysInMonth; day++) {
      const x = startX + currentCol * cellWidth;
      const y = startY + 20 + currentRow * cellHeight;
      
      // 日付のインデックスを計算（月初からの経過日数）
      const dateIndex = this.calculateDateIndex(new Date(year, month, day));
      const horoscope = dailyHoroscopes[dateIndex];
      
      // 日付セルの枠
      this.doc.rect(x, y, cellWidth, cellHeight)
         .stroke();
      
      // 日付
      this.doc.fontSize(10)
         .font(FONTS.BOLD)
         .fillColor(currentCol === 0 ? '#FF0000' : currentCol === 6 ? '#0000FF' : COLORS.TEXT)
         .text(day.toString(), x + 5, y + 5);
      
      // 占い結果（運気レベルと簡単なメッセージ）
      if (horoscope) {
        // 運気レベルを星で表示（1-5）
        const stars = '★'.repeat(horoscope.luckyLevel);
        
        this.doc.fontSize(8)
           .font(FONTS.NORMAL)
           .fillColor(COLORS.SECONDARY)
           .text(stars, x + 5, y + 20);
        
        // 一言メッセージ
        this.doc.fontSize(7)
           .fillColor(COLORS.TEXT)
           .text(horoscope.shortMessage, x + 5, y + 30, {
             width: cellWidth - 10,
             height: cellHeight - 40,
             ellipsis: true
           });
      }
      
      // 次のセルに移動
      currentCol++;
      if (currentCol >= colsPerRow) {
        currentCol = 0;
        currentRow++;
      }
    }
  }

  /**
   * 西洋占星術ホロスコープチャートを描画
   * @param {Object} chartData ホロスコープデータ
   */
  drawHoroscopeChart(chartData) {
    const centerX = 300;
    const centerY = this.doc.y + 150;
    const radius = 100;
    
    // 円を描画
    this.doc.circle(centerX, centerY, radius)
       .lineWidth(1)
       .stroke();
    
    // 十二宮を描画
    for (let i = 0; i < 12; i++) {
      const angle = (i * 30) * Math.PI / 180;
      const outerX = centerX + radius * Math.cos(angle);
      const outerY = centerY + radius * Math.sin(angle);
      const innerX = centerX + radius * 0.8 * Math.cos(angle);
      const innerY = centerY + radius * 0.8 * Math.sin(angle);
      
      // 宮の境界線
      this.doc.moveTo(centerX, centerY)
         .lineTo(outerX, outerY)
         .stroke();
      
      // 星座記号を配置
      const symbolX = centerX + radius * 0.9 * Math.cos(angle + Math.PI / 12);
      const symbolY = centerY + radius * 0.9 * Math.sin(angle + Math.PI / 12);
      
      this.doc.fontSize(8)
         .fillColor(COLORS.SECONDARY)
         .text(this.getZodiacSymbol(i), symbolX - 4, symbolY - 4);
    }
    
    // 惑星配置を描画
    if (chartData && chartData.planets) {
      Object.entries(chartData.planets).forEach(([planet, position]) => {
        const angle = position.degree * Math.PI / 180;
        const planetX = centerX + radius * 0.6 * Math.cos(angle);
        const planetY = centerY + radius * 0.6 * Math.sin(angle);
        
        this.doc.fontSize(8)
           .fillColor(COLORS.TEXT)
           .text(this.getPlanetSymbol(planet), planetX - 4, planetY - 4);
      });
    }
    
    // チャートの下に惑星の位置情報を表示
    this.doc.moveDown(20); // チャートの下に移動
    
    this.doc.fontSize(9)
       .font(FONTS.BOLD)
       .fillColor(COLORS.TEXT)
       .text('惑星の位置:', {
         continued: false
       })
       .moveDown(0.3);
    
    if (chartData && chartData.planets) {
      Object.entries(chartData.planets).forEach(([planet, position]) => {
        const planetName = this.getPlanetName(planet);
        const signName = this.getZodiacName(Math.floor(position.degree / 30));
        
        this.doc.fontSize(8)
           .font(FONTS.NORMAL)
           .text(`${planetName}: ${signName} ${Math.floor(position.degree % 30)}°`, {
             continued: false
           });
      });
    }
  }

  /**
   * 四柱推命の命式チャートを描画
   * @param {Object} fourPillarsData 四柱推命データ
   */
  drawFourPillarsChart(fourPillarsData) {
    const startX = 150;
    const startY = this.doc.y;
    const cellWidth = 70;
    const cellHeight = 30;
    
    // ヘッダー行
    const headers = ['年柱', '月柱', '日柱', '時柱'];
    
    headers.forEach((header, i) => {
      this.doc.rect(startX + i * cellWidth, startY, cellWidth, cellHeight)
         .stroke();
      
      this.doc.fontSize(10)
         .font(FONTS.BOLD)
         .fillColor(COLORS.TEXT)
         .text(header, startX + i * cellWidth + 5, startY + 10);
    });
    
    // 天干行
    if (fourPillarsData && fourPillarsData.heavenlyStems) {
      fourPillarsData.heavenlyStems.forEach((stem, i) => {
        this.doc.rect(startX + i * cellWidth, startY + cellHeight, cellWidth, cellHeight)
           .stroke();
        
        this.doc.fontSize(10)
           .font(FONTS.NORMAL)
           .fillColor(this.getFiveElementColor(stem.element))
           .text(stem.name, startX + i * cellWidth + 5, startY + cellHeight + 10);
      });
    }
    
    // 地支行
    if (fourPillarsData && fourPillarsData.earthlyBranches) {
      fourPillarsData.earthlyBranches.forEach((branch, i) => {
        this.doc.rect(startX + i * cellWidth, startY + cellHeight * 2, cellWidth, cellHeight)
           .stroke();
        
        this.doc.fontSize(10)
           .font(FONTS.NORMAL)
           .fillColor(COLORS.TEXT)
           .text(branch.name, startX + i * cellWidth + 5, startY + cellHeight * 2 + 10);
      });
    }
    
    // 蔵干行
    if (fourPillarsData && fourPillarsData.hiddenStems) {
      fourPillarsData.hiddenStems.forEach((stems, i) => {
        this.doc.rect(startX + i * cellWidth, startY + cellHeight * 3, cellWidth, cellHeight)
           .stroke();
        
        const stemsText = stems.map(s => s.name).join(',');
        
        this.doc.fontSize(8)
           .font(FONTS.NORMAL)
           .fillColor(COLORS.TEXT)
           .text(stemsText, startX + i * cellWidth + 5, startY + cellHeight * 3 + 10);
      });
    }
  }

  /**
   * 人生周期チャートを描画
   * @param {Object} lifeCycleData 人生周期データ
   */
  drawLifeCycleChart(lifeCycleData) {
    const startX = 50;
    const startY = this.doc.y;
    const width = 500;
    const height = 120;
    
    // 背景
    this.doc.rect(startX, startY, width, height)
       .fillOpacity(0.1)
       .fillAndStroke(COLORS.BACKGROUND, COLORS.TEXT);
    
    // 横軸（年齢）
    this.doc.moveTo(startX, startY + height - 20)
       .lineTo(startX + width, startY + height - 20)
       .stroke();
    
    // 年齢マーカー
    for (let age = 0; age <= 100; age += 10) {
      const x = startX + (width * age / 100);
      
      this.doc.moveTo(x, startY + height - 20)
         .lineTo(x, startY + height - 15)
         .stroke();
      
      this.doc.fontSize(8)
         .fillColor(COLORS.TEXT)
         .text(age.toString(), x - 4, startY + height - 15);
    }
    
    // 運気の波を描画
    if (lifeCycleData && lifeCycleData.cycles) {
      const cycles = lifeCycleData.cycles;
      let lastX = startX;
      let lastY = startY + height - 20 - (cycles[0].level * 70 / 10);
      
      this.doc.moveTo(lastX, lastY);
      
      cycles.forEach(cycle => {
        const x = startX + (width * cycle.endAge / 100);
        const y = startY + height - 20 - (cycle.level * 70 / 10);
        
        this.doc.lineTo(x, y);
        
        // ターニングポイントを強調
        if (cycle.isTurningPoint) {
          this.doc.circle(x, y, 3)
             .fill(COLORS.SECONDARY);
        }
        
        lastX = x;
        lastY = y;
      });
      
      this.doc.strokeColor(COLORS.TERTIARY)
         .lineWidth(2)
         .stroke();
    }
    
    // 現在地を表示
    if (lifeCycleData && lifeCycleData.currentAge) {
      const currentX = startX + (width * lifeCycleData.currentAge / 100);
      
      this.doc.moveTo(currentX, startY)
         .lineTo(currentX, startY + height - 20)
         .strokeColor(COLORS.SECONDARY)
         .dash(3, { space: 2 })
         .stroke()
         .undash();
      
      this.doc.circle(currentX, startY + 10, 5)
         .fill(COLORS.SECONDARY);
      
      this.doc.fontSize(9)
         .fillColor(COLORS.SECONDARY)
         .text('現在', currentX - 10, startY);
    }
  }

  /**
   * 星空の背景を描画
   */
  drawStarryBackground() {
    // 背景グラデーション
    this.doc.fillColor(COLORS.BACKGROUND)
       .rect(0, 0, this.doc.page.width, this.doc.page.height)
       .fill();
    
    // ランダムな星を描画
    const starCount = 200;
    
    for (let i = 0; i < starCount; i++) {
      const x = Math.random() * this.doc.page.width;
      const y = Math.random() * this.doc.page.height;
      const size = Math.random() * 1.5 + 0.5;
      const opacity = Math.random() * 0.7 + 0.3;
      
      this.doc.fillColor(COLORS.TEXT)
         .fillOpacity(opacity)
         .circle(x, y, size)
         .fill();
    }
    
    // 不透明度をリセット
    this.doc.fillOpacity(1);
  }

  /**
   * ページ番号を追加
   */
  addPageNumbers() {
    const totalPages = this.doc.bufferedPageRange().count;
    
    for (let i = 0; i < totalPages; i++) {
      this.doc.switchToPage(i);
      
      // 最初のページ（表紙）には表示しない
      if (i > 0) {
        this.doc.fontSize(8)
           .fillColor(COLORS.TEXT)
           .text(
             `${i} / ${totalPages - 1}`,
             50,
             this.doc.page.height - 30,
             { align: 'center', width: this.doc.page.width - 100 }
           );
      }
    }
  }

  /**
   * 生年月日時のフォーマット
   * @param {Object} userData ユーザーデータ
   * @returns {string} フォーマットされた生年月日時
   */
  formatBirthDateTime(userData) {
    const { birthYear, birthMonth, birthDay, birthHour, birthMinute } = userData;
    
    let formattedDate = `${birthYear}年${birthMonth}月${birthDay}日`;
    
    if (birthHour !== undefined && birthMinute !== undefined) {
      formattedDate += ` ${birthHour}時${birthMinute}分`;
    }
    
    return formattedDate;
  }

  /**
   * 日付から365日カレンダーのインデックスを計算
   * @param {Date} date 日付
   * @returns {number} インデックス
   */
  calculateDateIndex(date) {
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    
    const timeDiff = date.getTime() - startDate.getTime();
    const dayDiff = Math.floor(timeDiff / (1000 * 3600 * 24));
    
    return dayDiff;
  }

  /**
   * 星座のシンボルを取得
   * @param {number} index 星座インデックス(0-11)
   * @returns {string} 星座シンボル
   */
  getZodiacSymbol(index) {
    const symbols = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];
    return symbols[index] || '';
  }

  /**
   * 星座の名前を取得
   * @param {number} index 星座インデックス(0-11)
   * @returns {string} 星座名
   */
  getZodiacName(index) {
    const names = [
      '牡羊座', '牡牛座', '双子座', '蟹座', '獅子座', '乙女座',
      '天秤座', '蠍座', '射手座', '山羊座', '水瓶座', '魚座'
    ];
    return names[index] || '';
  }

  /**
   * 惑星のシンボルを取得
   * @param {string} planet 惑星名
   * @returns {string} 惑星シンボル
   */
  getPlanetSymbol(planet) {
    const symbols = {
      sun: '☉',
      moon: '☽',
      mercury: '☿',
      venus: '♀',
      mars: '♂',
      jupiter: '♃',
      saturn: '♄',
      uranus: '♅',
      neptune: '♆',
      pluto: '♇',
      ascendant: 'Asc',
      midheaven: 'MC'
    };
    
    return symbols[planet.toLowerCase()] || '';
  }

  /**
   * 惑星の日本語名を取得
   * @param {string} planet 惑星名
   * @returns {string} 惑星の日本語名
   */
  getPlanetName(planet) {
    const names = {
      sun: '太陽',
      moon: '月',
      mercury: '水星',
      venus: '金星',
      mars: '火星',
      jupiter: '木星',
      saturn: '土星',
      uranus: '天王星',
      neptune: '海王星',
      pluto: '冥王星',
      ascendant: 'アセンダント',
      midheaven: 'ミッドヘブン'
    };
    
    return names[planet.toLowerCase()] || planet;
  }

  /**
   * 五行に対応する色を取得
   * @param {string} element 五行要素
   * @returns {string} 色コード
   */
  getFiveElementColor(element) {
    const colors = {
      wood: '#00BB00', // 緑
      fire: '#FF4500',  // 赤
      earth: '#CD853F', // 茶
      metal: '#CCCCCC', // 銀
      water: '#1E90FF'  // 青
    };
    
    return colors[element.toLowerCase()] || COLORS.TEXT;
  }
}

module.exports = new PDFGenerator();