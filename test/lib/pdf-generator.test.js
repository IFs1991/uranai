/**
 * PDFGenerator クラスの単体テスト
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PDFGenerator from '../../lib/pdf-generator.js';

// PDFKitモジュールのモック
vi.mock('pdfkit', () => {
  return {
    default: vi.fn().mockImplementation(() => {
      return {
        addPage: vi.fn(),
        font: vi.fn().mockReturnThis(),
        fontSize: vi.fn().mockReturnThis(),
        fillColor: vi.fn().mockReturnThis(),
        strokeColor: vi.fn().mockReturnThis(),
        lineWidth: vi.fn().mockReturnThis(),
        text: vi.fn().mockReturnThis(),
        moveDown: vi.fn().mockReturnThis(),
        image: vi.fn().mockReturnThis(),
        rect: vi.fn().mockReturnThis(),
        fill: vi.fn().mockReturnThis(),
        stroke: vi.fn().mockReturnThis(),
        circle: vi.fn().mockReturnThis(),
        lineCap: vi.fn().mockReturnThis(),
        moveTo: vi.fn().mockReturnThis(),
        lineTo: vi.fn().mockReturnThis(),
        save: vi.fn().mockReturnThis(),
        restore: vi.fn().mockReturnThis(),
        rotate: vi.fn().mockReturnThis(),
        translate: vi.fn().mockReturnThis(),
        linearGradient: vi.fn().mockReturnThis(),
        dash: vi.fn().mockReturnThis(),
        undash: vi.fn().mockReturnThis(),
        currentLineHeight: vi.fn().mockReturnValue(15),
        widthOfString: vi.fn().mockImplementation((text) => text.length * 5),
        heightOfString: vi.fn().mockImplementation((text, options) => {
          const lines = text.split('\n').length;
          return lines * 15;
        }),
        page: { width: 595.28, height: 841.89, margins: { top: 50, bottom: 50, left: 50, right: 50 } },
        pipe: vi.fn(),
        end: vi.fn()
      };
    })
  };
});

// PDFドキュメントのモック
const mockPDFDocument = {
  addPage: vi.fn(),
  font: vi.fn().mockReturnThis(),
  fontSize: vi.fn().mockReturnThis(),
  fillColor: vi.fn().mockReturnThis(),
  strokeColor: vi.fn().mockReturnThis(),
  lineWidth: vi.fn().mockReturnThis(),
  text: vi.fn().mockReturnThis(),
  moveDown: vi.fn().mockReturnThis(),
  image: vi.fn().mockReturnThis(),
  rect: vi.fn().mockReturnThis(),
  fill: vi.fn().mockReturnThis(),
  stroke: vi.fn().mockReturnThis(),
  circle: vi.fn().mockReturnThis(),
  lineCap: vi.fn().mockReturnThis(),
  moveTo: vi.fn().mockReturnThis(),
  lineTo: vi.fn().mockReturnThis(),
  save: vi.fn().mockReturnThis(),
  restore: vi.fn().mockReturnThis(),
  rotate: vi.fn().mockReturnThis(),
  translate: vi.fn().mockReturnThis(),
  linearGradient: vi.fn().mockReturnThis(),
  dash: vi.fn().mockReturnThis(),
  undash: vi.fn().mockReturnThis(),
  currentLineHeight: vi.fn().mockReturnValue(15),
  widthOfString: vi.fn().mockImplementation((text) => text.length * 5),
  heightOfString: vi.fn().mockImplementation((text, options) => {
    const lines = text.split('\n').length;
    return lines * 15;
  }),
  page: { width: 595.28, height: 841.89, margins: { top: 50, bottom: 50, left: 50, right: 50 } },
  pipe: vi.fn(),
  end: vi.fn()
};

// fsモジュールのモック
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  readFileSync: vi.fn().mockReturnValue(Buffer.from('mock image data')),
  createWriteStream: vi.fn().mockReturnValue({
    on: vi.fn().mockImplementation((event, callback) => {
      if (event === 'finish') {
        setTimeout(callback, 0);
      }
      return {
        on: vi.fn()
      };
    })
  })
}));

// fsプロミスモジュールのモック
vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(),
  readFile: vi.fn().mockResolvedValue(Buffer.from('mock pdf content')),
  writeFile: vi.fn().mockResolvedValue(),
  access: vi.fn().mockResolvedValue(true)
}));

// パスモジュールのモック
vi.mock('path', () => ({
  join: vi.fn().mockImplementation((...args) => args.join('/')),
  resolve: vi.fn().mockImplementation((...args) => args.join('/')),
}));

// ストリームモジュールのモック
vi.mock('stream', () => ({
  pipeline: vi.fn().mockImplementation((readable, writable, callback) => {
    setTimeout(() => callback(), 0);
    return { pipe: vi.fn() };
  })
}));

// os
vi.mock('os', () => ({
  tmpdir: vi.fn().mockReturnValue('/tmp')
}));

describe('PDFGenerator クラス', () => {
  let pdfGenerator;

  beforeEach(() => {
    // テスト前にモックをリセット
    vi.clearAllMocks();
    pdfGenerator = new PDFGenerator();
  });

  describe('generatePdfContent メソッド', () => {
    it('正常系：PDF生成の基本構造と各セクションの存在確認', async () => {
      // モックメソッド
      pdfGenerator.generateCoverPage = vi.fn();
      pdfGenerator.generateTableOfContents = vi.fn();
      pdfGenerator.generateBasicInfoPage = vi.fn();
      pdfGenerator.generateCoreEnergyPages = vi.fn();
      pdfGenerator.generateTalentsPages = vi.fn();
      pdfGenerator.generateLifeFlowPages = vi.fn();
      pdfGenerator.generateSpecialQuestionPage = vi.fn();
      pdfGenerator.generateSummaryPage = vi.fn();
      pdfGenerator.generateDailyHoroscopesPages = vi.fn();

      const userData = {
        name: '山田太郎',
        birthDate: '1990-01-01',
        birthTime: '12:30',
        birthPlace: '東京',
        specificQuestion: '2024年の運勢について教えてください',
      };

      const horoscopeData = {
        coreEnergy: { /* データ */ },
        talents: { /* データ */ },
        lifeFlow: { /* データ */ },
        specialQuestionAnswer: '回答テキスト',
        summary: 'サマリーテキスト',
        dailyHoroscopes: []
      };

      await pdfGenerator.generatePdfContent(mockPDFDocument, userData, horoscopeData);

      // 各セクションが正しく呼び出されることを確認
      expect(pdfGenerator.generateCoverPage).toHaveBeenCalledWith(mockPDFDocument, userData);
      expect(pdfGenerator.generateTableOfContents).toHaveBeenCalledWith(mockPDFDocument);
      expect(pdfGenerator.generateBasicInfoPage).toHaveBeenCalledWith(mockPDFDocument, userData, horoscopeData);
      expect(pdfGenerator.generateCoreEnergyPages).toHaveBeenCalledWith(mockPDFDocument, horoscopeData.coreEnergy);
      expect(pdfGenerator.generateTalentsPages).toHaveBeenCalledWith(mockPDFDocument, horoscopeData.talents);
      expect(pdfGenerator.generateLifeFlowPages).toHaveBeenCalledWith(mockPDFDocument, horoscopeData.lifeFlow);

      // 特別質問がある場合のみその関数が呼ばれることを確認
      expect(pdfGenerator.generateSpecialQuestionPage).toHaveBeenCalledWith(
        mockPDFDocument,
        userData.specificQuestion,
        horoscopeData.specialQuestionAnswer
      );

      expect(pdfGenerator.generateSummaryPage).toHaveBeenCalledWith(mockPDFDocument, horoscopeData.summary);
      expect(pdfGenerator.generateDailyHoroscopesPages).toHaveBeenCalledWith(mockPDFDocument, horoscopeData.dailyHoroscopes);
    });
  });

  describe('addPageWithSetup メソッド', () => {
    it('新しいページを追加して背景とヘッダー・フッターを描画する', () => {
      // メソッドをモック
      pdfGenerator.drawGradientBackground = vi.fn();
      pdfGenerator.drawPageHeader = vi.fn();
      pdfGenerator.drawPageFooter = vi.fn();

      // 通常のページをテスト
      pdfGenerator.addPageWithSetup(mockPDFDocument, false);

      expect(mockPDFDocument.addPage).toHaveBeenCalled();
      expect(pdfGenerator.drawGradientBackground).toHaveBeenCalledWith(mockPDFDocument);
      expect(pdfGenerator.drawPageHeader).toHaveBeenCalledWith(mockPDFDocument);
      expect(pdfGenerator.drawPageFooter).toHaveBeenCalledWith(mockPDFDocument);

      // 最初のページをテスト
      vi.clearAllMocks();
      pdfGenerator.addPageWithSetup(mockPDFDocument, true);

      expect(mockPDFDocument.addPage).toHaveBeenCalled();
      expect(pdfGenerator.drawGradientBackground).toHaveBeenCalledWith(mockPDFDocument);
      // 最初のページではヘッダーは描画されないことを確認
      expect(pdfGenerator.drawPageHeader).not.toHaveBeenCalled();
      expect(pdfGenerator.drawPageFooter).toHaveBeenCalledWith(mockPDFDocument);
    });
  });

  describe('drawSectionHeader メソッド', () => {
    it('セクションヘッダーが正しい書式で描画される', () => {
      const title = '鑑定結果';
      const y = 100;

      const newY = pdfGenerator.drawSectionHeader(mockPDFDocument, title, y);

      // フォントとスタイルが設定される
      expect(mockPDFDocument.font).toHaveBeenCalled();
      expect(mockPDFDocument.fontSize).toHaveBeenCalled();
      expect(mockPDFDocument.fillColor).toHaveBeenCalled();

      // テキストが描画される
      expect(mockPDFDocument.text).toHaveBeenCalledWith(title, expect.any(Number), y, expect.any(Object));

      // 新しいY座標が返される
      expect(newY).toBeGreaterThan(y);
    });
  });

  describe('drawContentCard メソッド', () => {
    it('コンテンツカードが正しい書式で描画される', () => {
      const y = 100;
      const height = 200;

      const newY = pdfGenerator.drawContentCard(mockPDFDocument, y, height);

      // 矩形が描画される
      expect(mockPDFDocument.rect).toHaveBeenCalledWith(
        expect.any(Number), y, expect.any(Number), height, expect.any(Number)
      );

      // 塗りつぶしと枠線
      expect(mockPDFDocument.fill).toHaveBeenCalled();
      expect(mockPDFDocument.stroke).toHaveBeenCalled();

      // 新しいY座標が返される
      expect(newY).toBe(y + height);
    });
  });

  describe('checkAndAddNewPage メソッド', () => {
    it('必要な場合に新しいページを追加する', () => {
      pdfGenerator.addPageWithSetup = vi.fn();

      // ページ内に収まる場合
      const y1 = 100;
      const requiredHeight1 = 200;
      const result1 = pdfGenerator.checkAndAddNewPage(mockPDFDocument, y1, requiredHeight1);

      expect(pdfGenerator.addPageWithSetup).not.toHaveBeenCalled();
      expect(result1).toBe(y1);

      // ページに収まらない場合
      const y2 = mockPDFDocument.page.height - 100;
      const requiredHeight2 = 200;
      const result2 = pdfGenerator.checkAndAddNewPage(mockPDFDocument, y2, requiredHeight2);

      expect(pdfGenerator.addPageWithSetup).toHaveBeenCalledWith(mockPDFDocument);
      // 新しいページのmargin.topの位置が返される
      expect(result2).toBe(mockPDFDocument.page.margins.top);
    });
  });

  describe('drawMultilineText メソッド', () => {
    it('テキストが複数行に正しく描画される', () => {
      const text = '複数行の\nテキスト';
      const x = 50;
      const y = 100;
      const options = { width: 400 };

      pdfGenerator.checkAndAddNewPage = vi.fn().mockReturnValue(y);

      const newY = pdfGenerator.drawMultilineText(mockPDFDocument, text, x, y, options);

      // 改ページ判定が行われる
      expect(pdfGenerator.checkAndAddNewPage).toHaveBeenCalled();

      // テキストが描画される
      expect(mockPDFDocument.text).toHaveBeenCalledWith(text, x, y, options);

      // 新しいY座標が返される（テキストの高さ分増加）
      expect(newY).toBeGreaterThan(y);
    });
  });

  describe('drawFormattedText メソッド', () => {
    it('特殊書式を含むテキストが正しく整形される', () => {
      const text = '## 小見出し\n* 箇条書き1\n* 箇条書き2\n\n通常の段落';
      const x = 50;
      const y = 100;
      const width = 400;

      pdfGenerator.drawMultilineText = vi.fn().mockReturnValue(y + 50);

      const newY = pdfGenerator.drawFormattedText(mockPDFDocument, text, x, y, width);

      // drawMultilineTextが複数回呼ばれる（フォーマットごとに）
      expect(pdfGenerator.drawMultilineText).toHaveBeenCalledTimes(4);

      // 新しいY座標が返される
      expect(newY).toBeGreaterThan(y);
    });
  });

  describe('drawTable メソッド', () => {
    it('表ヘッダーと内容が正しく描画される', () => {
      const headers = ['項目', '値'];
      const rows = [
        ['名前', '山田太郎'],
        ['生年月日', '1990-01-01']
      ];
      const x = 50;
      const y = 100;
      const width = 400;

      pdfGenerator.checkAndAddNewPage = vi.fn().mockReturnValue(y);

      const newY = pdfGenerator.drawTable(mockPDFDocument, headers, rows, x, y, width);

      // 改ページ判定が行われる
      expect(pdfGenerator.checkAndAddNewPage).toHaveBeenCalled();

      // ヘッダーと各行が描画される
      expect(mockPDFDocument.font).toHaveBeenCalled();
      expect(mockPDFDocument.fillColor).toHaveBeenCalled();
      expect(mockPDFDocument.rect).toHaveBeenCalled();
      expect(mockPDFDocument.text).toHaveBeenCalled();

      // 新しいY座標が返される
      expect(newY).toBeGreaterThan(y);
    });
  });

  describe('drawImage メソッド', () => {
    it('画像が正しく描画される', () => {
      const imagePath = 'images/test.png';
      const x = 50;
      const y = 100;
      const options = { width: 200 };

      pdfGenerator.checkAndAddNewPage = vi.fn().mockReturnValue(y);

      const newY = pdfGenerator.drawImage(mockPDFDocument, imagePath, x, y, options);

      // 改ページ判定が行われる
      expect(pdfGenerator.checkAndAddNewPage).toHaveBeenCalled();

      // 画像が描画される
      expect(mockPDFDocument.image).toHaveBeenCalledWith(
        expect.any(String), x, y, expect.objectContaining(options)
      );

      // 新しいY座標が返される
      expect(newY).toBeGreaterThan(y);
    });

    it('画像ファイルが存在しない場合はエラーをログ出力し、元のY座標を返す', () => {
      const imagePath = 'images/not-exist.png';
      const x = 50;
      const y = 100;
      const options = { width: 200 };

      // existsSyncをfalseを返すようにモック
      const existsSync = vi.fn().mockReturnValue(false);
      require('fs').existsSync = existsSync;

      // コンソールエラーをモック
      console.error = vi.fn();

      const newY = pdfGenerator.drawImage(mockPDFDocument, imagePath, x, y, options);

      // 画像が存在するかチェックされる
      expect(existsSync).toHaveBeenCalledWith(expect.stringContaining(imagePath));

      // エラーがログ出力される
      expect(console.error).toHaveBeenCalled();

      // 画像は描画されない
      expect(mockPDFDocument.image).not.toHaveBeenCalled();

      // 元のY座標が返される
      expect(newY).toBe(y);
    });
  });

  describe('generateCoverPage メソッド', () => {
    it('表紙ページが正しく生成される', () => {
      pdfGenerator.addPageWithSetup = vi.fn();
      pdfGenerator.drawImage = vi.fn().mockReturnValue(200);
      pdfGenerator.drawMultilineText = vi.fn().mockReturnValue(300);

      const userData = { name: '山田太郎' };

      pdfGenerator.generateCoverPage(mockPDFDocument, userData);

      // 表紙ページが追加される
      expect(pdfGenerator.addPageWithSetup).toHaveBeenCalledWith(mockPDFDocument, true);

      // ロゴ画像が描画される
      expect(pdfGenerator.drawImage).toHaveBeenCalled();

      // タイトルとユーザー名が描画される
      expect(pdfGenerator.drawMultilineText).toHaveBeenCalled();
      expect(mockPDFDocument.fontSize).toHaveBeenCalled();
      expect(mockPDFDocument.fillColor).toHaveBeenCalled();
    });
  });

  describe('generateTableOfContents メソッド', () => {
    it('目次ページが正しく生成される', () => {
      pdfGenerator.addPageWithSetup = vi.fn();
      pdfGenerator.drawSectionHeader = vi.fn().mockReturnValue(100);
      pdfGenerator.drawMultilineText = vi.fn().mockReturnValue(150);

      pdfGenerator.generateTableOfContents(mockPDFDocument);

      // 目次ページが追加される
      expect(pdfGenerator.addPageWithSetup).toHaveBeenCalledWith(mockPDFDocument);

      // 目次タイトルが描画される
      expect(pdfGenerator.drawSectionHeader).toHaveBeenCalledWith(mockPDFDocument, '目次', expect.any(Number));

      // 目次項目が描画される
      expect(pdfGenerator.drawMultilineText).toHaveBeenCalled();
    });
  });
});