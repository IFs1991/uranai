/**
 * src/lib/pdf-generator.js
 * PDF生成管理ライブラリ
 *
 * PDFKitを使用して詳細鑑定PDFの内容を描画するクラス。
 * PDFDocumentのインスタンスと鑑定データを受け取り、各ページ要素を描画する。
 */
import PDFDocument from 'pdfkit'; // pdfkitはAPIハンドラ側でインスタンス化される想定だが、型定義等のためにimport
import fs from 'fs';
import path from 'path';
import { format } from 'date-fns';
import ja from 'date-fns/locale/ja';

// --- 定数定義 ---

// アセットパス（プロジェクトルートからの相対パスを想定）
const ASSETS_BASE_PATH = path.resolve(process.cwd(), 'assets');

// カラーテーマ（YAML定義に準拠）
const COLORS = {
    background: '#191970',          // ミッドナイトブルー (ベース背景色)
    backgroundGradientEnd: '#0E0E38', // グラデーション終点
    mainColor: '#483D8B',           // ダークスレートブルー (メインカラー)
    secondaryColor: '#FFD700',       // ゴールド (アクセントカラー)
    tertiaryColor: '#9370DB',        // ミディアムパープル (アクセントカラー2)
    textColor: '#F8F8FF',           // ほぼ白 (テキスト)
    textColorDark: '#333333',       // 暗いテキスト（今回は使用箇所なし）
    cardBg: 'rgba(25, 25, 112, 0.7)', // カード背景（半透明の濃紺）
    highlightBg: 'rgba(255, 255, 255, 0.08)', // 強調背景
    tableHeaderBg: 'rgba(72, 61, 139, 0.8)', // テーブルヘッダー背景
    tableRowEvenBg: 'rgba(25, 25, 112, 0.5)', // テーブル偶数行背景
    tableRowOddBg: 'rgba(25, 25, 112, 0.7)',  // テーブル奇数行背景
    borderColor: 'rgba(255, 215, 0, 0.3)', // 境界線 (ゴールド半透明)
    headerFooterBg: 'rgba(72, 61, 139, 0.3)', // ヘッダー・フッター背景
    sectionHeaderBg: 'rgba(147, 112, 219, 0.4)', // セクションヘッダー背景
};

// フォント設定（APIハンドラ側でdoc.registerFontすることを想定）
// YAMLではシステムフォント推奨だが、PDFでの日本語表示にはフォント埋め込みが現実的
const FONTS = {
    gothic: 'gothic-normal',      // 例: NotoSansJP-Regular
    gothicBold: 'gothic-bold',    // 例: NotoSansJP-Bold
    mincho: 'mincho-normal',      // 例: NotoSerifJP-Regular
    decoration: 'decoration-normal' // 例: HannariMincho-Regular
};

// 画像パス
const IMAGES = {
    background: path.join(ASSETS_BASE_PATH, 'images', 'stars-background.jpg'), // オプションの背景画像
    headerLogo: path.join(ASSETS_BASE_PATH, 'images', 'header-logo.png'),    // ヘッダーロゴ
    divider: path.join(ASSETS_BASE_PATH, 'images', 'divider.png'),          // 区切り線
    stars: path.join(ASSETS_BASE_PATH, 'images', 'stars-decoration.png'),   // 装飾星
    footer: path.join(ASSETS_BASE_PATH, 'images', 'footer-decoration.png'),  // フッター装飾
    astrology: path.join(ASSETS_BASE_PATH, 'images', 'astrology-chart.png'), // 西洋占星術チャート画像
    fourPillars: path.join(ASSETS_BASE_PATH, 'images', 'four-pillars-chart.png'), // 四柱推命チャート画像
    // 惑星シンボル (ファイル名修正)
    sun: path.join(ASSETS_BASE_PATH, 'images', 'symbol-sun.png'),
    moon: path.join(ASSETS_BASE_PATH, 'images', 'symbol-moon.png'),
    mercury: path.join(ASSETS_BASE_PATH, 'images', 'symbol-mercury.png'),
    venus: path.join(ASSETS_BASE_PATH, 'images', 'symbol-venus.png'),
    mars: path.join(ASSETS_BASE_PATH, 'images', 'symbol-mars.png'),
    jupiter: path.join(ASSETS_BASE_PATH, 'images', 'symbol-jupiter.png'),
    saturn: path.join(ASSETS_BASE_PATH, 'images', 'symbol-saturn.png'),
    // 星座シンボル (ファイル名修正)
    aries: path.join(ASSETS_BASE_PATH, 'images', 'symbol-aries.png'),
    taurus: path.join(ASSETS_BASE_PATH, 'images', 'symbol-taurus.png'),
    gemini: path.join(ASSETS_BASE_PATH, 'images', 'symbol-gemini.png'),
    cancer: path.join(ASSETS_BASE_PATH, 'images', 'symbol-cancer.png'),
    leo: path.join(ASSETS_BASE_PATH, 'images', 'symbol-leo.png'),
    virgo: path.join(ASSETS_BASE_PATH, 'images', 'symbol-virgo.png'),
    libra: path.join(ASSETS_BASE_PATH, 'images', 'symbol-libra.png'),
    scorpio: path.join(ASSETS_BASE_PATH, 'images', 'symbol-scorpio.png'),
    sagittarius: path.join(ASSETS_BASE_PATH, 'images', 'symbol-sagittarius.png'),
    capricorn: path.join(ASSETS_BASE_PATH, 'images', 'symbol-capricorn.png'),
    aquarius: path.join(ASSETS_BASE_PATH, 'images', 'symbol-aquarius.png'),
    pisces: path.join(ASSETS_BASE_PATH, 'images', 'symbol-pisces.png'),
};

// レイアウト定数
const PAGE_WIDTH = 595.28; // A4 Width in points
const PAGE_HEIGHT = 841.89; // A4 Height in points
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_HEIGHT = 40;
const HEADER_HEIGHT = 60;
const SAFE_CONTENT_BOTTOM = PAGE_HEIGHT - MARGIN - FOOTER_HEIGHT;
const SAFE_CONTENT_TOP = MARGIN + HEADER_HEIGHT;
const CARD_PADDING = 20;
const SECTION_HEADER_HEIGHT = 40;
const DEFAULT_LINE_GAP = 5;

class PDFGenerator {
    constructor() {
        // 状態を持つ必要があればここに追加（例：ページ番号管理など）
        this.currentPage = 0;
        this.tocEntries = []; // 目次エントリを格納する配列（ページ番号は後で解決）
    }

    /**
     * PDFコンテンツ全体を描画するメインメソッド
     * @param {PDFDocument} doc - PDFDocument インスタンス
     * @param {object} userData - ユーザー情報
     * @param {object} horoscopeData - 占いデータ
     */
    generatePdfContent(doc, userData, horoscopeData) {
        this.currentPage = 0; // ページ番号をリセット
        this.tocEntries = []; // 目次エントリをリセット

        // --- ページ生成 ---
        // 1. 表紙
        this.generateCoverPage(doc, userData);
        this.addPageWithSetup(doc);

        // 2. 目次 (プレースホルダー)
        this.generateTableOfContents(doc);
        this.addPageWithSetup(doc);

        // 3. 基本情報 (セクション1)
        this.generateBasicInfoPage(doc, userData, horoscopeData);
        this.addPageWithSetup(doc); // 次のセクションのために改ページ

        // 4. コアエネルギー解説 (セクション2)
        // このセクションは複数のページにまたがる可能性がある
        this.generateCoreEnergyPages(doc, horoscopeData.coreEnergy);
        // generateCoreEnergyPages 内で必要に応じて改ページされる

        // 5. 才能と人生のテーマ (セクション3)
        this.generateTalentsPages(doc, horoscopeData.talents);
        // generateTalentsPages 内で必要に応じて改ページされる

        // 6. 運命の流れと転機 (セクション4)
        this.generateLifeFlowPages(doc, horoscopeData.lifeFlow);
        // generateLifeFlowPages 内で必要に応じて改ページされる

        // 7. 特定質問への回答 (セクション5) (存在する場合)
        if (userData.specificQuestion && horoscopeData.specialQuestionAnswer) {
            this.addPageWithSetup(doc); // 新しいセクションのために改ページ
            this.generateSpecialQuestionPage(doc, userData.specificQuestion, horoscopeData.specialQuestionAnswer);
        }

        // 8. 総合鑑定まとめ (セクション6)
        this.addPageWithSetup(doc); // 新しいセクションのために改ページ
        this.generateSummaryPage(doc, horoscopeData.summary);

        // 9. 365日占いカレンダー (セクション7) (存在する場合)
        if (horoscopeData.dailyHoroscopes && horoscopeData.dailyHoroscopes.length > 0) {
            this.addPageWithSetup(doc); // 新しいセクションのために改ページ
            this.generateDailyHoroscopesPages(doc, horoscopeData.dailyHoroscopes);
        }

        // TODO: 目次ページ番号の解決と再描画
        // 全ページ数が確定した後、目次ページに戻ってページ番号を書き込む処理が必要
        // pdfkit単体では難しい場合があるため、ここでは省略
    }

    // --- ページ描画ヘルパー ---

    /**
     * ヘッダー、フッター、背景を持つ新しいページを追加または設定
     * @param {PDFDocument} doc
     * @param {boolean} isFirstPage 表紙など、ヘッダーフッターが不要な場合はtrue
     */
    addPageWithSetup(doc, isFirstPage = false) {
        if (this.currentPage > 0) {
            doc.addPage();
        }
        this.currentPage++;
        this.drawGradientBackground(doc);

        if (!isFirstPage) {
            this.drawPageHeader(doc);
            this.drawPageFooter(doc);
            // ページ番号 (フッター内で描画されるように変更)
        }
    }

    /**
     * グラデーション背景を描画
     * @param {PDFDocument} doc PDF文書オブジェクト
     */
    drawGradientBackground(doc) {
        const { width, height } = doc.page;
        // PDFKitのグラデーション機能を使用
        const grad = doc.linearGradient(0, 0, 0, height);
        grad.stop(0, COLORS.background)
            .stop(1, COLORS.backgroundGradientEnd);
        doc.rect(0, 0, width, height).fill(grad);

        // 星空テクスチャを重ねる（オプション）
        if (fs.existsSync(IMAGES.background)) {
            try {
                doc.image(IMAGES.background, 0, 0, {
                    width: width,
                    height: height,
                    align: 'center',
                    valign: 'center'
                });
                 // 画像の上に半透明レイヤーを重ねて少し暗くする（任意）
                 doc.rect(0, 0, width, height).fill(COLORS.background, 0.3);
            } catch (err) {
                console.error(`Error embedding background image: ${err.message}`);
            }
        }
        // 装飾的な光の効果（上部）
        const glow = doc.radialGradient(width / 2, 0, 0, width / 2, 0, width / 2);
        glow.stop(0, 'rgba(255, 215, 0, 0.15)')
            .stop(1, 'rgba(255, 215, 0, 0)');
        doc.circle(width / 2, 0, width / 2).fill(glow);
    }

    /**
     * ページヘッダーを描画
     * @param {PDFDocument} doc PDF文書オブジェクト
     */
    drawPageHeader(doc) {
        const { width } = doc.page;
        const headerBottomY = MARGIN + HEADER_HEIGHT;

        // ヘッダー背景
        doc.rect(0, MARGIN, width, HEADER_HEIGHT).fill(COLORS.headerFooterBg);

        // タイトル or ロゴ
        const logoPath = IMAGES.headerLogo;
        if (fs.existsSync(logoPath)) {
            try {
                 // ロゴサイズを調整
                doc.image(logoPath, MARGIN, MARGIN + 10, { height: HEADER_HEIGHT - 20, align: 'left' });
                 // テキストタイトルも表示する場合（ロゴの横など）
                doc.font(FONTS.gothicBold)
                   .fontSize(14)
                   .fillColor(COLORS.secondaryColor)
                   .text('ライフサイクル・ポテンシャル占術', MARGIN + 80, MARGIN + 25, { align: 'left' });
            } catch (err) {
                console.error(`Error embedding header logo: ${err.message}`);
                this.drawHeaderTextFallback(doc);
            }
        } else {
             this.drawHeaderTextFallback(doc);
        }

        // 区切り線
         doc.strokeColor(COLORS.borderColor)
            .lineWidth(0.5)
            .moveTo(MARGIN, headerBottomY)
            .lineTo(width - MARGIN, headerBottomY)
            .stroke();
    }

     /** ヘッダーテキストのフォールバック描画 */
    drawHeaderTextFallback(doc) {
        doc.font(FONTS.decoration)
           .fontSize(20)
           .fillColor(COLORS.secondaryColor)
           .text('ライフサイクル・ポテンシャル占術', MARGIN, MARGIN + 20, { width: CONTENT_WIDTH, align: 'center' });
    }

    /**
     * ページフッターを描画
     * @param {PDFDocument} doc PDF文書オブジェクト
     */
    drawPageFooter(doc) {
        const { width, height } = doc.page;
        const footerTopY = height - MARGIN - FOOTER_HEIGHT;

        // フッター背景
        doc.rect(0, footerTopY, width, FOOTER_HEIGHT + MARGIN).fill(COLORS.headerFooterBg); // 下部マージンまで背景を伸ばす

        // 区切り線
         doc.strokeColor(COLORS.borderColor)
            .lineWidth(0.5)
            .moveTo(MARGIN, footerTopY)
            .lineTo(width - MARGIN, footerTopY)
            .stroke();

        // コピーライト
        doc.font(FONTS.gothic)
            .fontSize(8)
            .fillColor(COLORS.textColor)
            .text('© 2024 ライフサイクル・ポテンシャル占術 All Rights Reserved.',
                  MARGIN, footerTopY + 10, { width: CONTENT_WIDTH, align: 'center' });

        // ページ番号 (表紙以外)
        if (this.currentPage > 1) {
            doc.font(FONTS.gothicBold)
               .fontSize(10)
               .fillColor(COLORS.textColor)
               .text(`- ${this.currentPage} -`,
                     MARGIN, footerTopY + 25, { width: CONTENT_WIDTH, align: 'center' });
        }
    }

    /**
     * セクションヘッダーを描画
     * @param {PDFDocument} doc PDF文書オブジェクト
     * @param {string} title セクションタイトル
     * @param {number} y Y座標
     * @returns {number} 次のコンテンツの開始Y座標
     */
    drawSectionHeader(doc, title, y) {
        const { width } = doc.page;
        const headerY = this.checkAndAddNewPage(doc, y, SECTION_HEADER_HEIGHT + 10); // ヘッダーと下のマージン分の高さを確保

        // セクションヘッダー背景
        doc.rect(MARGIN, headerY, CONTENT_WIDTH, SECTION_HEADER_HEIGHT)
           .fill(COLORS.sectionHeaderBg);

        // タイトル
        doc.font(FONTS.gothicBold)
           .fontSize(16)
           .fillColor(COLORS.secondaryColor)
           .text(title, MARGIN + CARD_PADDING, headerY + (SECTION_HEADER_HEIGHT - 16) / 2, { // 中央揃え
               width: CONTENT_WIDTH - CARD_PADDING * 2 - 30 // 装飾分のスペース確保
           });

        // 装飾的な星マーク (右端)
        const starPath = IMAGES.stars;
        if (fs.existsSync(starPath)) {
            try {
                doc.image(starPath, width - MARGIN - CARD_PADDING - 25, headerY + (SECTION_HEADER_HEIGHT - 25) / 2, { width: 25 });
            } catch(err) {
                console.error(`Error embedding section star: ${err.message}`);
            }
        }

        return headerY + SECTION_HEADER_HEIGHT + 15; // 次の開始位置 (少しマージンを開ける)
    }

    /**
     * カードスタイルのコンテンツボックスを描画
     * @param {PDFDocument} doc PDF文書オブジェクト
     * @param {number} y 開始Y座標
     * @param {number} height ボックスの高さ (コンテンツ量に応じて可変にする場合あり)
     * @returns {object} コンテンツエリアの座標情報 { x, y, width, height, endY }
     */
    drawContentCard(doc, y, height) {
        const cardY = this.checkAndAddNewPage(doc, y, height); // カード全体の高さを確保

        // カード背景
        doc.roundedRect(MARGIN, cardY, CONTENT_WIDTH, height, 5) // 角丸に変更
           .fill(COLORS.cardBg);

        // カード境界線
        doc.roundedRect(MARGIN, cardY, CONTENT_WIDTH, height, 5)
           .strokeColor(COLORS.borderColor)
           .lineWidth(1)
           .stroke();

        return {
            x: MARGIN + CARD_PADDING,
            y: cardY + CARD_PADDING,
            width: CONTENT_WIDTH - CARD_PADDING * 2,
            height: height - CARD_PADDING * 2,
            endY: cardY + height // カード自体の終了Y座標
        };
    }

     /**
      * 必要であれば改ページし、新しいY座標を返す
      * @param {PDFDocument} doc
      * @param {number} currentY 現在のY座標
      * @param {number} requiredHeight これから描画する要素の高さ
      * @returns {number} 描画を開始すべきY座標 (改ページされた場合は新しいページの開始Y座標)
      */
    checkAndAddNewPage(doc, currentY, requiredHeight) {
        if (currentY + requiredHeight > SAFE_CONTENT_BOTTOM) {
            this.addPageWithSetup(doc);
            return SAFE_CONTENT_TOP; // 新しいページの開始Y座標
        }
        return currentY;
    }

     /**
      * 複数行テキストを描画し、描画後のY座標を返す
      * @param {PDFDocument} doc
      * @param {string} text 描画するテキスト
      * @param {number} x
      * @param {number} y
      * @param {object} options pdfkitのtext()オプション (width必須) + font, fontSize, fillColor
      * @returns {number} 描画後の次の行のY座標
      */
    drawMultilineText(doc, text, x, y, options) {
        const { font, fontSize, fillColor, width, lineGap = DEFAULT_LINE_GAP, ...restOptions } = options;
        const textHeight = doc.font(font).fontSize(fontSize).heightOfString(text, { width, lineGap });
        const drawY = this.checkAndAddNewPage(doc, y, textHeight);

        doc.font(font)
           .fontSize(fontSize)
           .fillColor(fillColor)
           .text(text, x, drawY, { width, lineGap, ...restOptions });

        return drawY + textHeight + lineGap; // 次の描画開始Y座標
    }

     /**
      * 画像を描画し、描画後のY座標を返す
      * @param {PDFDocument} doc
      * @param {string} imagePath 画像パス
      * @param {number} x
      * @param {number} y
      * @param {object} options pdfkitのimage()オプション (width or height必須)
      * @returns {number} 描画後のY座標
      */
    drawImage(doc, imagePath, x, y, options) {
        if (!fs.existsSync(imagePath)) {
            console.error(`Image not found: ${imagePath}`);
            // 画像がない場合の代替テキスト表示など
            const errorText = `[Image not found: ${path.basename(imagePath)}]`;
            const textHeight = 12; // 仮の高さ
            const drawY = this.checkAndAddNewPage(doc, y, textHeight);
            doc.font(FONTS.gothic).fontSize(10).fillColor(COLORS.textColor).text(errorText, x, drawY, options);
            return drawY + textHeight + DEFAULT_LINE_GAP;
        }

        try {
            // 画像の高さを事前に取得するのは難しい場合があるため、指定された高さを信用する
            const imageHeight = options.height || (options.width ? options.width : 100); // widthから推測するかデフォルト値
            const drawY = this.checkAndAddNewPage(doc, y, imageHeight);
            doc.image(imagePath, x, drawY, options);
            return drawY + imageHeight + DEFAULT_LINE_GAP; // 画像の下に少しギャップ
        } catch (err) {
            console.error(`Error embedding image ${imagePath}: ${err.message}`);
            const errorText = `[Error loading image: ${path.basename(imagePath)}]`;
             const textHeight = 12; // 仮の高さ
            const drawY = this.checkAndAddNewPage(doc, y, textHeight);
            doc.font(FONTS.gothic).fontSize(10).fillColor(COLORS.textColor).text(errorText, x, drawY, options);
            return drawY + textHeight + DEFAULT_LINE_GAP;
        }
    }

    /**
     * 表を描画
     * @param {PDFDocument} doc PDF文書オブジェクト
     * @param {array} headers 表ヘッダー配列
     * @param {array} rows 表データ行の配列 (各行が配列)
     * @param {number} x X座標
     * @param {number} y Y座標
     * @param {number} width 表の幅
     * @param {array} columnWidths 各列の幅の配列（オプション）
     * @returns {number} 表の終了Y座標
     */
    drawTable(doc, headers, rows, x, y, width, columnWidths = null) {
        const rowHeight = 25; // 少し高さを確保
        const headerHeight = 30;
        const fontSize = 9;
        const padding = 5;
        let currentY = y;

        // 列幅の計算
        let colWidths = columnWidths;
        if (!colWidths) {
            const defaultColWidth = width / headers.length;
            colWidths = headers.map(() => defaultColWidth);
        }

        // ヘッダー行
        currentY = this.checkAndAddNewPage(doc, currentY, headerHeight);
        doc.rect(x, currentY, width, headerHeight).fill(COLORS.tableHeaderBg);
        let currentX = x;
        headers.forEach((header, i) => {
            doc.font(FONTS.gothicBold)
               .fontSize(fontSize + 1)
               .fillColor(COLORS.secondaryColor)
               .text(header, currentX + padding, currentY + (headerHeight - fontSize - 1) / 2, {
                   width: colWidths[i] - padding * 2,
                   lineBreak: false // ヘッダーは折り返さない想定
               });
            currentX += colWidths[i];
        });
        currentY += headerHeight;

        // データ行
        rows.forEach((row, rowIndex) => {
            currentY = this.checkAndAddNewPage(doc, currentY, rowHeight);
            const bg = rowIndex % 2 === 0 ? COLORS.tableRowEvenBg : COLORS.tableRowOddBg;
            doc.rect(x, currentY, width, rowHeight).fill(bg);
            currentX = x;
            row.forEach((cell, cellIndex) => {
                 // セルの内容を文字列に変換
                const cellText = String(cell);
                 // テキストの高さを計算して、必要なら行高を増やす（今回は固定行高とする）
                 // const cellTextHeight = doc.font(FONTS.gothic).fontSize(fontSize).heightOfString(cellText, { width: colWidths[cellIndex] - padding * 2 });
                doc.font(FONTS.gothic)
                   .fontSize(fontSize)
                   .fillColor(COLORS.textColor)
                   .text(cellText, currentX + padding, currentY + (rowHeight - fontSize) / 2, {
                       width: colWidths[cellIndex] - padding * 2,
                       lineGap: 2,
                       ellipsis: true // 長すぎる場合は省略記号
                   });
                currentX += colWidths[cellIndex];
            });
            currentY += rowHeight;
        });

        // 表の外枠
        // doc.strokeColor(COLORS.borderColor)
        //    .lineWidth(0.5)
        //    .rect(x, y, width, currentY - y) // 開始Y座標を使う
        //    .stroke();

        return currentY; // 表全体の終了Y座標
    }

    /**
     * 惑星シンボルを描画 (画像使用)
     * @param {PDFDocument} doc
     * @param {string} planet 惑星名 (小文字想定: 'sun', 'moon', ...)
     * @param {number} x
     * @param {number} y
     * @param {number} size
     */
    drawPlanetSymbol(doc, planet, x, y, size = 15) {
        const planetKey = planet.toLowerCase();
        const imagePath = IMAGES[planetKey];
        this.drawImage(doc, imagePath, x, y, { width: size, height: size });
         // 画像描画は非同期ではないのでY座標は返さない
    }

     /**
      * 星座シンボルを描画 (画像使用)
      * @param {PDFDocument} doc
      * @param {string} sign 星座名 (日本語: '牡羊座', '牡牛座', ...)
      * @param {number} x
      * @param {number} y
      * @param {number} size
      */
    drawZodiacSymbol(doc, sign, x, y, size = 15) {
        const signMap = {
            '牡羊座': 'aries', '牡牛座': 'taurus', '双子座': 'gemini', '蟹座': 'cancer',
            '獅子座': 'leo', '乙女座': 'virgo', '天秤座': 'libra', '蠍座': 'scorpio',
            '射手座': 'sagittarius', '山羊座': 'capricorn', '水瓶座': 'aquarius', '魚座': 'pisces'
        };
        const signKey = Object.keys(signMap).find(key => sign.includes(key));
        const imagePath = signKey ? IMAGES[signMap[signKey]] : null;

        if (imagePath) {
            this.drawImage(doc, imagePath, x, y, { width: size, height: size });
        } else {
             // 画像がない場合のフォールバック
             doc.font(FONTS.gothic).fontSize(size * 0.8).fillColor(COLORS.textColor).text(`[${sign}]`, x, y);
        }
    }

    // --- ページ生成メソッド ---

    /**
     * 表紙ページを生成
     * @param {PDFDocument} doc PDF文書オブジェクト
     * @param {object} userData ユーザー情報
     */
    generateCoverPage(doc, userData) {
        this.addPageWithSetup(doc, true); // isFirstPage = true
        const { width, height } = doc.page;

        // 大きなタイトル
        doc.font(FONTS.decoration)
           .fontSize(36)
           .fillColor(COLORS.secondaryColor)
           .text('ライフサイクル・ポテンシャル占術', MARGIN, height / 4, { width: CONTENT_WIDTH, align: 'center' });

        // サブタイトル
        doc.font(FONTS.gothicBold)
           .fontSize(18)
           .fillColor(COLORS.tertiaryColor)
           .text('鑑定書', MARGIN, height / 4 + 50, { width: CONTENT_WIDTH, align: 'center' });

        // 宛名
        doc.font(FONTS.gothicBold)
           .fontSize(24)
           .fillColor(COLORS.textColor)
           .text(`${userData.name} 様`, MARGIN, height / 2, { width: CONTENT_WIDTH, align: 'center' });

        // 生年月日など
        const birthDate = new Date(userData.birthDate);
        const formattedBirthDate = format(birthDate, 'yyyy年M月d日', { locale: ja });
        const formattedBirthTime = userData.birthTime || '時刻不明';

        doc.font(FONTS.gothic)
           .fontSize(14)
           .fillColor(COLORS.textColor)
           .text(`生年月日: ${formattedBirthDate}`, MARGIN, height / 2 + 60, { width: CONTENT_WIDTH, align: 'center' })
           .text(`出生時刻: ${formattedBirthTime}`, MARGIN, height / 2 + 80, { width: CONTENT_WIDTH, align: 'center' })
           .text(`出生地: ${userData.birthPlace || '不明'}`, MARGIN, height / 2 + 100, { width: CONTENT_WIDTH, align: 'center' });

        // 生成日
        const today = format(new Date(), 'yyyy年M月d日', { locale: ja });
        doc.fontSize(10)
           .text(`作成日: ${today}`, MARGIN, height - 100, { width: CONTENT_WIDTH, align: 'center' });

        // 装飾的な要素（星や光のエフェクトなど）
        const starPath = IMAGES.stars;
        if (fs.existsSync(starPath)) {
            try {
                const starSize = 30;
                doc.image(starPath, MARGIN, MARGIN, { width: starSize });
                doc.image(starPath, width - MARGIN - starSize, MARGIN, { width: starSize });
                doc.image(starPath, MARGIN, height - MARGIN - starSize, { width: starSize });
                doc.image(starPath, width - MARGIN - starSize, height - MARGIN - starSize, { width: starSize });
            } catch (err) {
                console.error(`Error embedding cover stars: ${err.message}`);
            }
        }

        // フッター (表紙専用の簡易版)
        doc.font(FONTS.gothic)
           .fontSize(10)
           .fillColor(COLORS.textColor)
           .text('© 2024 ライフサイクル・ポテンシャル占術 All Rights Reserved.', 0, height - 50, { align: 'center' });

         // 最初のページ番号を記録
         this.tocEntries.push({ title: '表紙', page: this.currentPage, level: 0 });
    }

    /**
     * 目次ページを生成 (ページ番号はプレースホルダー)
     * @param {PDFDocument} doc PDF文書オブジェクト
     */
    generateTableOfContents(doc) {
        const { width } = doc.page;
        let y = SAFE_CONTENT_TOP + 20; // ヘッダー下から開始

        // タイトル
        doc.font(FONTS.gothicBold)
           .fontSize(24)
           .fillColor(COLORS.secondaryColor)
           .text('目次', MARGIN, y, { width: CONTENT_WIDTH, align: 'center' });

        y += 50;

        // 目次項目 (YAMLに基づいた構造) - ページ番号は後で解決する必要あり
        const tocItemsDefinition = [
            { title: '1. 基本情報', level: 1 },
            { title: '2. コアエネルギー解説', level: 1 },
            { title: '   2.1 西洋占星術チャート', level: 2 },
            { title: '   2.2 四柱推命チャート', level: 2 },
            { title: '   2.3 エネルギーバランス分析', level: 2 },
            { title: '3. 才能と人生のテーマ', level: 1 },
            { title: '   3.1 あなたの主要な才能', level: 2 },
            { title: '   3.2 人生のテーマ', level: 2 },
            { title: '   3.3 成長のための課題', level: 2 },
            { title: '4. 運命の流れと転機', level: 1 },
            { title: '   4.1 現在の運気傾向', level: 2 },
            { title: '   4.2 今後の運気の流れ', level: 2 },
            { title: '   4.3 人生の主要な転機', level: 2 },
            { title: '5. 特定質問への回答', level: 1 }, // 条件付き表示だが項目としては記載
            { title: '6. 総合鑑定まとめ', level: 1 },
            { title: '7. 365日運勢カレンダー', level: 1 },
            { title: '   7.1 月別運勢ガイド', level: 2 },
            { title: '   7.2 日別詳細予報', level: 2 }, // 月ごと
        ];

         // 目次項目の描画
        tocItemsDefinition.forEach(item => {
            const itemY = this.checkAndAddNewPage(doc, y, 25); // 各行の高さを確保
            const indent = item.level === 1 ? 0 : 30;
            const fontSize = item.level === 1 ? 14 : 12;
            const font = item.level === 1 ? FONTS.gothicBold : FONTS.gothic;

            doc.font(font)
               .fontSize(fontSize)
               .fillColor(COLORS.textColor)
               //.text(item.title, MARGIN + indent, itemY, { continued: true }) // ページ番号を右揃えにするため工夫が必要
               //.text('...', { align: 'right' }); // pdfkitでリーダーと右揃えページ番号を同時に行うのは難しい

               // 簡単な実装：タイトルとページ番号（プレースホルダ）を左揃えで表示
               .text(`${item.title} ...................... P.${item.page || '?'}`, MARGIN + indent, itemY, {
                   width: CONTENT_WIDTH - indent,
                   lineBreak: false,
                   ellipsis: true,
               });

            y = itemY + 25; // 次の行へ
        });

         // 装飾的な要素
        const dividerPath = IMAGES.divider;
         if (fs.existsSync(dividerPath)) {
             y = this.checkAndAddNewPage(doc, y, 30);
             try {
                doc.image(dividerPath, width / 2 - 150, y, { width: 300 });
             } catch(err) {
                 console.error(`Error embedding TOC divider: ${err.message}`);
             }
         }
    }

    /**
     * 基本情報ページ (セクション1) を生成
     * @param {PDFDocument} doc PDF文書オブジェクト
     * @param {object} userData ユーザー情報
     * @param {object} horoscopeData 占いデータ
     */
    generateBasicInfoPage(doc, userData, horoscopeData) {
        let y = SAFE_CONTENT_TOP;
        y = this.drawSectionHeader(doc, '1. 基本情報', y);
        this.tocEntries.push({ title: '1. 基本情報', page: this.currentPage, level: 1 });

        // コンテンツカード (高さを動的にするか、十分な高さを確保)
        // テキスト量に応じて高さを計算するのは複雑なため、大きめの高さを確保
        const cardHeightEstimate = 450; // 仮の高さ
        const contentArea = this.drawContentCard(doc, y, cardHeightEstimate);
        let currentCardY = contentArea.y;
        const cardEndX = contentArea.x + contentArea.width;

        // 鑑定対象者情報
        currentCardY = this.drawMultilineText(doc, '鑑定対象者情報', contentArea.x, currentCardY, {
            font: FONTS.gothicBold, fontSize: 14, fillColor: COLORS.secondaryColor, width: contentArea.width
        });
        currentCardY += 10; // マージン

        const birthDate = new Date(userData.birthDate);
        const formattedBirthDate = format(birthDate, 'yyyy年M月d日', { locale: ja });

        const infoTable = [
            ['お名前', userData.name],
            ['生年月日', formattedBirthDate],
            ['出生時刻', userData.birthTime || '不明'],
            ['出生地', userData.birthPlace || '不明']
        ];

        infoTable.forEach(([label, value]) => {
            const labelWidth = 80;
            const valueWidth = contentArea.width - labelWidth - 10;
             // 各行の高さを計算
            const labelHeight = doc.font(FONTS.gothicBold).fontSize(12).heightOfString(label + ':', { width: labelWidth });
            const valueHeight = doc.font(FONTS.gothic).fontSize(12).heightOfString(value, { width: valueWidth });
            const lineHeight = Math.max(labelHeight, valueHeight, 20); // 最低20ptの高さ

            currentCardY = this.checkAndAddNewPage(doc, currentCardY, lineHeight); // 行の高さを確保 (カード内改ページは考慮しない簡易実装)

            doc.font(FONTS.gothicBold)
               .fontSize(12)
               .fillColor(COLORS.tertiaryColor)
               .text(`${label}:`, contentArea.x, currentCardY, { width: labelWidth, lineBreak: false });

            doc.font(FONTS.gothic)
               .fontSize(12)
               .fillColor(COLORS.textColor)
               .text(value, contentArea.x + labelWidth + 10, currentCardY, { width: valueWidth });

            currentCardY += lineHeight; // 行の高さ分進む
        });

        currentCardY += 20; // マージン

        // 特定の質問 (あれば)
        if (userData.specificQuestion) {
             currentCardY = this.checkAndAddNewPage(doc, currentCardY, 60); // ヘッダーとテキスト分の高さを確保
             currentCardY = this.drawMultilineText(doc, '特定の質問', contentArea.x, currentCardY, {
                 font: FONTS.gothicBold, fontSize: 14, fillColor: COLORS.secondaryColor, width: contentArea.width
             });
             currentCardY += 5;
             currentCardY = this.drawMultilineText(doc, userData.specificQuestion, contentArea.x, currentCardY, {
                 font: FONTS.gothic, fontSize: 11, fillColor: COLORS.textColor, width: contentArea.width
             });
             currentCardY += 15;
        }

        // 鑑定概要 (あれば)
        const summary = horoscopeData.summary || '';
        if (summary) {
             currentCardY = this.checkAndAddNewPage(doc, currentCardY, 40); // ヘッダー分の高さを確保
             currentCardY = this.drawMultilineText(doc, '鑑定概要', contentArea.x, currentCardY, {
                font: FONTS.gothicBold, fontSize: 14, fillColor: COLORS.secondaryColor, width: contentArea.width
             });
             currentCardY += 5;
             currentCardY = this.drawFormattedText(doc, summary, contentArea.x, currentCardY, contentArea.width);
        }

        // カードの高さを内容に合わせて調整 (これはpdfkitでは難しいので、固定高で描画した)
        // 必要なら、事前に高さを計算してdrawContentCardに渡す
    }

     /**
      * コアエネルギー解説ページ (セクション2) を生成 (複数ページにまたがる可能性)
      * @param {PDFDocument} doc PDF文書オブジェクト
      * @param {object} coreEnergy コアエネルギーデータ
      */
    generateCoreEnergyPages(doc, coreEnergy) {
        let y = SAFE_CONTENT_TOP;
        y = this.drawSectionHeader(doc, '2. コアエネルギー解説', y);
        this.tocEntries.push({ title: '2. コアエネルギー解説', page: this.currentPage, level: 1 });

        // --- 2.1 & 2.2 西洋占星術と四柱推命チャート ---
        this.tocEntries.push({ title: '   2.1 西洋占星術チャート', page: this.currentPage, level: 2 });
        this.tocEntries.push({ title: '   2.2 四柱推命チャート', page: this.currentPage, level: 2 });

        // コンテンツカード (高さを計算するのは難しいので大きめに確保)
        const chartCardHeightEstimate = 500;
        let contentArea = this.drawContentCard(doc, y, chartCardHeightEstimate);
        let currentCardY = contentArea.y;

        // --- 西洋占星術パート ---
        currentCardY = this.drawMultilineText(doc, '2.1 西洋占星術チャート', contentArea.x, currentCardY, {
            font: FONTS.gothicBold, fontSize: 14, fillColor: COLORS.secondaryColor, width: contentArea.width
        });
        currentCardY += 15;

        const zodiacTable = [
            { label: '太陽星座', value: coreEnergy?.sunSign || 'N/A', planet: 'sun' },
            { label: '月星座', value: coreEnergy?.moonSign || 'N/A', planet: 'moon' },
            { label: 'アセンダント', value: coreEnergy?.ascendant || 'N/A', planet: null }
        ];

        zodiacTable.forEach(item => {
            const lineHeight = 25;
            currentCardY = this.checkAndAddNewPage(doc, currentCardY, lineHeight); // カード内改ページは考慮しない

            const labelX = contentArea.x;
            const valueX = labelX + 130;
            const symbolSize = 15;
            const symbolY = currentCardY + (lineHeight - symbolSize) / 2 - 2; // Y座標調整

            // 惑星シンボル (あれば)
            if (item.planet) {
                this.drawPlanetSymbol(doc, item.planet, labelX, symbolY, symbolSize);
            }

            // ラベル
            doc.font(FONTS.gothicBold)
               .fontSize(12)
               .fillColor(COLORS.tertiaryColor)
               .text(`${item.label}:`, labelX + (item.planet ? symbolSize + 5 : 0), currentCardY + (lineHeight - 12)/2, { width: 100, lineBreak: false });

            // 星座シンボル (あれば)
            if (item.value !== 'N/A') {
                 this.drawZodiacSymbol(doc, item.value, valueX, symbolY, symbolSize);
                 // 値テキスト
                doc.font(FONTS.gothic)
                   .fontSize(12)
                   .fillColor(COLORS.textColor)
                   .text(item.value, valueX + symbolSize + 5, currentCardY + (lineHeight - 12)/2, { width: contentArea.width - (valueX + symbolSize + 5 - contentArea.x) });
            } else {
                 doc.font(FONTS.gothic)
                    .fontSize(12)
                    .fillColor(COLORS.textColor)
                    .text(item.value, valueX, currentCardY + (lineHeight - 12)/2, { width: contentArea.width - (valueX - contentArea.x) });
            }

            currentCardY += lineHeight;
        });
        currentCardY += 10;

        // 星図表示 (画像)
        const chartImageX = contentArea.x;
        const chartImageWidth = 180; // 画像サイズ調整
        const chartImagePath = IMAGES.astrology;
         if (fs.existsSync(chartImagePath)) {
             const chartImageHeight = chartImageWidth; // 正方形と仮定
             const textX = chartImageX + chartImageWidth + 15;
             const textWidth = contentArea.width - chartImageWidth - 15;

             const requiredChartHeight = chartImageHeight + 10; // 画像と下のマージン
             currentCardY = this.checkAndAddNewPage(doc, currentCardY, requiredChartHeight); // カード内改ページは考慮しない

             const chartDrawY = currentCardY; // 描画開始Y座標を保持

             this.drawImage(doc, chartImagePath, chartImageX, chartDrawY, { width: chartImageWidth, height: chartImageHeight });

             // 星図の横に説明テキスト
             const descText = '※ この星図はあなたの出生時の惑星配置を示しています。各惑星の位置や角度が、あなたの性格特性や潜在的な才能に影響を与えています。';
             this.drawMultilineText(doc, descText, textX, chartDrawY, {
                 font: FONTS.gothic, fontSize: 10, fillColor: COLORS.textColor, width: textWidth
             });
             currentCardY = chartDrawY + requiredChartHeight; // 画像の高さ分進める
         } else {
             // 画像がない場合の説明テキスト
             const descText = '西洋占星術チャート画像は利用できません。上記の主要な星座配置があなたの基本的な性質を示します。';
             currentCardY = this.drawMultilineText(doc, descText, contentArea.x, currentCardY, {
                 font: FONTS.gothic, fontSize: 11, fillColor: COLORS.textColor, width: contentArea.width
             });
         }

        currentCardY += 20; // 四柱推命パートへのマージン

        // --- 四柱推命パート ---
        currentCardY = this.checkAndAddNewPage(doc, currentCardY, 30); // ヘッダー高さを確保
        currentCardY = this.drawMultilineText(doc, '2.2 四柱推命チャート', contentArea.x, currentCardY, {
            font: FONTS.gothicBold, fontSize: 14, fillColor: COLORS.secondaryColor, width: contentArea.width
        });
        currentCardY += 15;

        const fourPillarsTable = [
            ['日主', coreEnergy?.dayMaster || 'N/A'],
            ['五行バランス', coreEnergy?.fiveElementsBalance || 'N/A']
        ];

        fourPillarsTable.forEach(([label, value]) => {
            const lineHeight = 25;
            currentCardY = this.checkAndAddNewPage(doc, currentCardY, lineHeight); // カード内改ページは考慮しない

             doc.font(FONTS.gothicBold)
                .fontSize(12)
                .fillColor(COLORS.tertiaryColor)
                .text(`${label}:`, contentArea.x, currentCardY + (lineHeight - 12)/2, { width: 100, lineBreak: false });

             doc.font(FONTS.gothic)
                .fontSize(12)
                .fillColor(COLORS.textColor)
                .text(value, contentArea.x + 100 + 10, currentCardY + (lineHeight - 12)/2, { width: contentArea.width - 110 });

             currentCardY += lineHeight;
        });
        currentCardY += 10;

        // 四柱推命の図表示 (画像)
        const fpImageX = contentArea.x;
        const fpImageWidth = 180; // 画像サイズ調整
        const fpImagePath = IMAGES.fourPillars;
         if (fs.existsSync(fpImagePath)) {
             const fpImageHeight = fpImageWidth * (3/4); // 画像のアスペクト比に合わせる (仮)
             const textX = fpImageX + fpImageWidth + 15;
             const textWidth = contentArea.width - fpImageWidth - 15;

             const requiredFpHeight = fpImageHeight + 10;
             currentCardY = this.checkAndAddNewPage(doc, currentCardY, requiredFpHeight); // カード内改ページは考慮しない

             const fpDrawY = currentCardY;

             this.drawImage(doc, fpImagePath, fpImageX, fpDrawY, { width: fpImageWidth, height: fpImageHeight });

             // 図の横に説明テキスト
             const descText = '※ この四柱推命チャートは、あなたの生年月日時を干支（十干十二支）に変換したものです。年柱・月柱・日柱・時柱の四本の柱から、あなたの命式を読み解きます。';
             this.drawMultilineText(doc, descText, textX, fpDrawY, {
                 font: FONTS.gothic, fontSize: 10, fillColor: COLORS.textColor, width: textWidth
             });
             currentCardY = fpDrawY + requiredFpHeight;
         } else {
             // 画像がない場合の説明テキスト
             const descText = '四柱推命チャート画像は利用できません。上記の日主と五行バランスがあなたの東洋的な性質を示します。';
             currentCardY = this.drawMultilineText(doc, descText, contentArea.x, currentCardY, {
                 font: FONTS.gothic, fontSize: 11, fillColor: COLORS.textColor, width: contentArea.width
             });
         }

        // --- 2.3 エネルギーバランス分析 ---
        // 別のページに描画
        this.addPageWithSetup(doc);
        y = SAFE_CONTENT_TOP;
        y = this.drawSectionHeader(doc, '2.3 エネルギーバランス分析', y);
        this.tocEntries.push({ title: '   2.3 エネルギーバランス分析', page: this.currentPage, level: 2 });

        const interpretationCardHeight = PAGE_HEIGHT - SAFE_CONTENT_TOP - MARGIN - FOOTER_HEIGHT - 20; // ページの残りの高さを確保
        contentArea = this.drawContentCard(doc, y, interpretationCardHeight); // ページの残りをカードエリアとする
        currentCardY = contentArea.y;

        const interpretation = coreEnergy?.interpretation || 'エネルギーバランス分析に関する詳細なテキストは生成されていません。';
        this.drawFormattedText(doc, interpretation, contentArea.x, currentCardY, contentArea.width);
         // drawFormattedText内で改ページされる可能性あり
    }

    /**
     * 才能と人生のテーマページ (セクション3) を生成 (複数ページにまたがる可能性)
     * @param {PDFDocument} doc PDF文書オブジェクト
     * @param {object} talentsData 才能データ ({ talents: [], lifeTheme: '', challenges: [] })
     */
    generateTalentsPages(doc, talentsData) {
        // --- 3.1 あなたの主要な才能 ---
        this.addPageWithSetup(doc); // 新しいセクションのために改ページ
        let y = SAFE_CONTENT_TOP;
        y = this.drawSectionHeader(doc, '3. 才能と人生のテーマ', y);
        this.tocEntries.push({ title: '3. 才能と人生のテーマ', page: this.currentPage, level: 1 });
        this.tocEntries.push({ title: '   3.1 あなたの主要な才能', page: this.currentPage, level: 2 });

        const talents = talentsData?.talents || [];
        // 才能リストの描画エリア高さを確保（可変だが、まずは大きめに見積もる）
        const talentsCardHeightEstimate = 300;
        let contentArea = this.drawContentCard(doc, y, talentsCardHeightEstimate);
        let currentCardY = contentArea.y;

        currentCardY = this.drawMultilineText(doc, '3.1 あなたの主要な才能', contentArea.x, currentCardY, {
            font: FONTS.gothicBold, fontSize: 14, fillColor: COLORS.secondaryColor, width: contentArea.width
        });
        currentCardY += 15;

        if (talents.length > 0) {
            talents.forEach((talent, index) => {
                const talentNumber = index + 1;
                const talentText = `才能 ${talentNumber}: ${talent}`;
                // 各才能テキストの高さを計算
                 const textHeight = doc.font(FONTS.gothic).fontSize(12).heightOfString(talentText, { width: contentArea.width });
                 const requiredHeight = textHeight + 10; // 下のマージン含む

                 // カード内で改ページが必要かチェック (簡易版: 次ページに送る)
                 if (currentCardY + requiredHeight > contentArea.y + contentArea.height) {
                     this.addPageWithSetup(doc);
                     y = SAFE_CONTENT_TOP;
                     // 新しいページにカードを再描画する必要がある
                     contentArea = this.drawContentCard(doc, y, PAGE_HEIGHT - SAFE_CONTENT_TOP - MARGIN - FOOTER_HEIGHT - 20);
                     currentCardY = contentArea.y;
                     // 必要ならセクションヘッダーも再描画
                     this.drawMultilineText(doc, '3.1 あなたの主要な才能 (続き)', contentArea.x, currentCardY, {
                        font: FONTS.gothicBold, fontSize: 14, fillColor: COLORS.secondaryColor, width: contentArea.width
                     });
                     currentCardY += 15;
                 }

                // 描画
                doc.font(FONTS.gothicBold)
                   .fontSize(12)
                   .fillColor(COLORS.tertiaryColor)
                   .text(`才能 ${talentNumber}: `, contentArea.x, currentCardY, { continued: true });
                doc.font(FONTS.gothic)
                   .fillColor(COLORS.textColor)
                   .text(talent, { continued: false }); // 残りを描画

                currentCardY += requiredHeight;
            });
        } else {
            currentCardY = this.drawMultilineText(doc, '特定の才能データは生成されていません。', contentArea.x, currentCardY, {
                font: FONTS.gothic, fontSize: 11, fillColor: COLORS.textColor, width: contentArea.width
            });
        }
        // TODO: カードの高さを内容に合わせる処理


        // --- 3.2 人生のテーマ ---
        this.addPageWithSetup(doc); // 新しいサブセクションのために改ページ
        y = SAFE_CONTENT_TOP;
        y = this.drawSectionHeader(doc, '3.2 人生のテーマ', y); // サブセクションヘッダー
        this.tocEntries.push({ title: '   3.2 人生のテーマ', page: this.currentPage, level: 2 });

        const lifeThemeCardHeight = 400; // 仮
        contentArea = this.drawContentCard(doc, y, lifeThemeCardHeight);
        currentCardY = contentArea.y;

        const lifeTheme = talentsData?.lifeTheme || '人生のテーマに関するデータは生成されていません。';
        this.drawFormattedText(doc, lifeTheme, contentArea.x, currentCardY, contentArea.width);


        // --- 3.3 成長のための課題 ---
        this.addPageWithSetup(doc); // 新しいサブセクションのために改ページ
        y = SAFE_CONTENT_TOP;
        y = this.drawSectionHeader(doc, '3.3 成長のための課題', y); // サブセクションヘッダー
        this.tocEntries.push({ title: '   3.3 成長のための課題', page: this.currentPage, level: 2 });

        const challengesCardHeight = 400; // 仮
        contentArea = this.drawContentCard(doc, y, challengesCardHeight);
        currentCardY = contentArea.y;

        const challenges = talentsData?.challenges || [];

         currentCardY = this.drawMultilineText(doc, 'あなたが成長するために取り組むべき課題:', contentArea.x, currentCardY, {
            font: FONTS.gothicBold, fontSize: 13, fillColor: COLORS.secondaryColor, width: contentArea.width
         });
         currentCardY += 15;

         if (challenges.length > 0) {
             challenges.forEach((challenge, index) => {
                 const challengeNumber = index + 1;
                 const challengeText = `課題 ${challengeNumber}: ${challenge}`;
                 const textHeight = doc.font(FONTS.gothic).fontSize(12).heightOfString(challengeText, { width: contentArea.width });
                 const requiredHeight = textHeight + 10;

                 if (currentCardY + requiredHeight > contentArea.y + contentArea.height) {
                     this.addPageWithSetup(doc);
                     y = SAFE_CONTENT_TOP;
                     contentArea = this.drawContentCard(doc, y, PAGE_HEIGHT - SAFE_CONTENT_TOP - MARGIN - FOOTER_HEIGHT - 20);
                     currentCardY = contentArea.y;
                      this.drawMultilineText(doc, '3.3 成長のための課題 (続き)', contentArea.x, currentCardY, {
                        font: FONTS.gothicBold, fontSize: 13, fillColor: COLORS.secondaryColor, width: contentArea.width
                     });
                     currentCardY += 15;
                 }

                 doc.font(FONTS.gothicBold)
                    .fontSize(12)
                    .fillColor(COLORS.tertiaryColor)
                    .text(`課題 ${challengeNumber}: `, contentArea.x, currentCardY, { continued: true });
                 doc.font(FONTS.gothic)
                    .fillColor(COLORS.textColor)
                    .text(challenge, { continued: false });

                 currentCardY += requiredHeight;
             });
         } else {
             currentCardY = this.drawMultilineText(doc, '特定の課題データは生成されていません。', contentArea.x, currentCardY, {
                 font: FONTS.gothic, fontSize: 11, fillColor: COLORS.textColor, width: contentArea.width
             });
         }
    }

     /**
      * 運命の流れと転機ページ (セクション4) を生成 (複数ページにまたがる可能性)
      * @param {PDFDocument} doc PDF文書オブジェクト
      * @param {object} lifeFlowData 運命の流れデータ ({ currentTrend: '', futureTrend: '', turningPoints: [] })
      */
    generateLifeFlowPages(doc, lifeFlowData) {
        // --- 4.1 現在の運気傾向 ---
        this.addPageWithSetup(doc); // 新しいセクションのために改ページ
        let y = SAFE_CONTENT_TOP;
        y = this.drawSectionHeader(doc, '4. 運命の流れと転機', y);
        this.tocEntries.push({ title: '4. 運命の流れと転機', page: this.currentPage, level: 1 });
        this.tocEntries.push({ title: '   4.1 現在の運気傾向', page: this.currentPage, level: 2 });

        const currentTrendHeight = 350; // 仮
        let contentArea = this.drawContentCard(doc, y, currentTrendHeight);
        let currentCardY = contentArea.y;

        currentCardY = this.drawMultilineText(doc, '4.1 現在の運気傾向', contentArea.x, currentCardY, {
            font: FONTS.gothicBold, fontSize: 14, fillColor: COLORS.secondaryColor, width: contentArea.width
        });
        currentCardY += 15;

        const currentTrend = lifeFlowData?.currentTrend || '現在の運気傾向に関するデータは生成されていません。';
        this.drawFormattedText(doc, currentTrend, contentArea.x, currentCardY, contentArea.width);

        // --- 4.2 今後の運気の流れ ---
        this.addPageWithSetup(doc);
        y = SAFE_CONTENT_TOP;
        y = this.drawSectionHeader(doc, '4.2 今後の運気の流れ', y); // サブセクションヘッダー
        this.tocEntries.push({ title: '   4.2 今後の運気の流れ', page: this.currentPage, level: 2 });

        const futureTrendHeight = 350; // 仮
        contentArea = this.drawContentCard(doc, y, futureTrendHeight);
        currentCardY = contentArea.y;

        const futureTrend = lifeFlowData?.futureTrend || '今後の運気の流れに関するデータは生成されていません。';
        this.drawFormattedText(doc, futureTrend, contentArea.x, currentCardY, contentArea.width);

        // --- 4.3 人生の主要な転機 ---
        this.addPageWithSetup(doc);
        y = SAFE_CONTENT_TOP;
        y = this.drawSectionHeader(doc, '4.3 人生の主要な転機', y); // サブセクションヘッダー
        this.tocEntries.push({ title: '   4.3 人生の主要な転機', page: this.currentPage, level: 2 });

        const turningPointsHeight = 400; // 仮
        contentArea = this.drawContentCard(doc, y, turningPointsHeight);
        currentCardY = contentArea.y;

        const turningPoints = lifeFlowData?.turningPoints || [];

        currentCardY = this.drawMultilineText(doc, 'あなたの人生における重要な転機:', contentArea.x, currentCardY, {
             font: FONTS.gothicBold, fontSize: 13, fillColor: COLORS.secondaryColor, width: contentArea.width
         });
        currentCardY += 15;

        if (turningPoints.length > 0) {
            turningPoints.forEach((point, index) => {
                const pointNumber = index + 1;
                let pointPrefix = `転機 ${pointNumber}: `;
                if (point.age) pointPrefix += `${point.age}歳頃 - `;
                if (point.year) pointPrefix += `${point.year}年頃 - `;
                const pointDesc = point.description || point; // pointがオブジェクトでない場合も考慮

                const textHeight = doc.font(FONTS.gothic).fontSize(12).heightOfString(pointPrefix + pointDesc, { width: contentArea.width });
                const requiredHeight = textHeight + 15; // 下マージン含む

                if (currentCardY + requiredHeight > contentArea.y + contentArea.height) {
                    this.addPageWithSetup(doc);
                    y = SAFE_CONTENT_TOP;
                    contentArea = this.drawContentCard(doc, y, PAGE_HEIGHT - SAFE_CONTENT_TOP - MARGIN - FOOTER_HEIGHT - 20);
                    currentCardY = contentArea.y;
                     this.drawMultilineText(doc, '4.3 人生の主要な転機 (続き)', contentArea.x, currentCardY, {
                        font: FONTS.gothicBold, fontSize: 13, fillColor: COLORS.secondaryColor, width: contentArea.width
                     });
                    currentCardY += 15;
                }

                doc.font(FONTS.gothicBold)
                   .fontSize(12)
                   .fillColor(COLORS.tertiaryColor)
                   .text(pointPrefix, contentArea.x, currentCardY, { continued: true });
                doc.font(FONTS.gothic)
                   .fillColor(COLORS.textColor)
                   .text(pointDesc, { continued: false });

                currentCardY += requiredHeight;
            });
        } else {
            // ライフサイクルデータなど代替情報を表示 (省略)
             currentCardY = this.drawMultilineText(doc, '人生の転機に関する具体的なデータは生成されていません。', contentArea.x, currentCardY, {
                font: FONTS.gothic, fontSize: 11, fillColor: COLORS.textColor, width: contentArea.width
            });
        }
    }

    /**
     * 特定質問への回答ページ (セクション5) を生成
     * @param {PDFDocument} doc PDF文書オブジェクト
     * @param {string} question 質問文
     * @param {string} answer 回答文
     */
    generateSpecialQuestionPage(doc, question, answer) {
        let y = SAFE_CONTENT_TOP;
        y = this.drawSectionHeader(doc, '5. 特定質問への回答', y);
        this.tocEntries.push({ title: '5. 特定質問への回答', page: this.currentPage, level: 1 });

        const cardHeight = PAGE_HEIGHT - SAFE_CONTENT_TOP - MARGIN - FOOTER_HEIGHT - 20; // ページの残りを確保
        const contentArea = this.drawContentCard(doc, y, cardHeight);
        let currentCardY = contentArea.y;

        // 質問表示
        currentCardY = this.drawMultilineText(doc, 'ご質問:', contentArea.x, currentCardY, {
             font: FONTS.gothicBold, fontSize: 14, fillColor: COLORS.secondaryColor, width: contentArea.width
        });
        currentCardY += 10;
        currentCardY = this.drawMultilineText(doc, question, contentArea.x, currentCardY, {
            font: FONTS.gothic, fontSize: 12, fillColor: COLORS.textColor, width: contentArea.width
        });
        currentCardY += 20;

        // 回答表示
        currentCardY = this.checkAndAddNewPage(doc, currentCardY, 40); // ヘッダー高さを確保
        currentCardY = this.drawMultilineText(doc, '占術からの回答:', contentArea.x, currentCardY, {
             font: FONTS.gothicBold, fontSize: 14, fillColor: COLORS.secondaryColor, width: contentArea.width
        });
        currentCardY += 10;

        const answerText = answer || '特定の質問に対する回答は生成されていません。';
        this.drawFormattedText(doc, answerText, contentArea.x, currentCardY, contentArea.width);
    }

    /**
     * 総合鑑定まとめページ (セクション6) を生成
     * @param {PDFDocument} doc PDF文書オブジェクト
     * @param {string} summary 総合鑑定まとめ
     */
    generateSummaryPage(doc, summary) {
        let y = SAFE_CONTENT_TOP;
        y = this.drawSectionHeader(doc, '6. 総合鑑定まとめ', y);
        this.tocEntries.push({ title: '6. 総合鑑定まとめ', page: this.currentPage, level: 1 });

        const cardHeight = PAGE_HEIGHT - SAFE_CONTENT_TOP - MARGIN - FOOTER_HEIGHT - 20; // ページの残りを確保
        const contentArea = this.drawContentCard(doc, y, cardHeight);
        let currentCardY = contentArea.y;

        const summaryText = summary || '総合鑑定まとめは生成されていません。';
        currentCardY = this.drawFormattedText(doc, summaryText, contentArea.x, currentCardY, contentArea.width);

        // アドバイスと次のステップ (同じカード内に追加)
        currentCardY = this.checkAndAddNewPage(doc, currentCardY, 40); // ヘッダー高さを確保
        currentCardY += 20; // 少しスペース

        currentCardY = this.drawMultilineText(doc, '今後に向けてのアドバイス', contentArea.x, currentCardY, {
            font: FONTS.gothicBold, fontSize: 14, fillColor: COLORS.secondaryColor, width: contentArea.width
        });
        currentCardY += 15;

        const adviceText1 = 'この鑑定書は、西洋占星術と四柱推命という二つの占術体系を組み合わせた分析に基づいています。ここで示された内容は、あなたの可能性と傾向を示すものであり、未来を確定的に示すものではありません。最終的にはあなた自身の選択と行動が、人生の形を決めていきます。';
        currentCardY = this.drawMultilineText(doc, adviceText1, contentArea.x, currentCardY, {
            font: FONTS.gothic, fontSize: 11, fillColor: COLORS.textColor, width: contentArea.width
        });
        currentCardY += 10;

        const adviceText2 = 'この鑑定結果を最大限に活かすためには、定期的に読み返し、その時々の状況に合わせて解釈を深めていくことをお勧めします。特に重要な決断の前には、この鑑定書の関連する部分を参照することで、より自分らしい選択ができるでしょう。';
         currentCardY = this.drawMultilineText(doc, adviceText2, contentArea.x, currentCardY, {
            font: FONTS.gothic, fontSize: 11, fillColor: COLORS.textColor, width: contentArea.width
        });
         currentCardY += 10;

         const adviceText3 = 'また、運勢は常に流動的なものです。定期的な鑑定更新を通じて、変化する運気の流れを把握することも大切です。今後の人生が、あなたにとって実り多く、満足のいくものとなることを心より願っています。';
         this.drawMultilineText(doc, adviceText3, contentArea.x, currentCardY, {
            font: FONTS.gothic, fontSize: 11, fillColor: COLORS.textColor, width: contentArea.width
        });
    }

    /**
     * 365日占いカレンダーページ (セクション7) を生成 (複数ページ)
     * @param {PDFDocument} doc PDF文書オブジェクト
     * @param {array} dailyHoroscopes 日別占いデータ [{ date: 'YYYY-MM-DD', luckLevel: number, dailyFortune: '', monthSummary?: '' }, ...]
     */
    generateDailyHoroscopesPages(doc, dailyHoroscopes) {
        let y = SAFE_CONTENT_TOP;
        y = this.drawSectionHeader(doc, '7. 365日運勢カレンダー', y);
        this.tocEntries.push({ title: '7. 365日運勢カレンダー', page: this.currentPage, level: 1 });

        // --- 7.1 月別運勢ガイド ---
        this.tocEntries.push({ title: '   7.1 月別運勢ガイド', page: this.currentPage, level: 2 });

        // 月ごとにデータをグループ化
        const monthlyData = {};
        dailyHoroscopes.forEach(day => {
            if (day.date) {
                try {
                    const date = new Date(day.date);
                    const monthYear = format(date, 'yyyy年M月', { locale: ja });
                    if (!monthlyData[monthYear]) {
                        monthlyData[monthYear] = { days: [], summary: day.monthSummary || null };
                    }
                    monthlyData[monthYear].days.push(day);
                    // 最初の日の月概要を採用
                    if (!monthlyData[monthYear].summary && day.monthSummary) {
                         monthlyData[monthYear].summary = day.monthSummary;
                    }
                } catch(e) {
                    console.error(`Invalid date format in dailyHoroscopes: ${day.date}`);
                }
            }
        });

        // 月別ガイドを描画
        const guideCardHeightEstimate = 400; // 仮
        let contentArea = this.drawContentCard(doc, y, guideCardHeightEstimate);
        let currentCardY = contentArea.y;

        currentCardY = this.drawMultilineText(doc, '7.1 月別運勢ガイド', contentArea.x, currentCardY, {
            font: FONTS.gothicBold, fontSize: 14, fillColor: COLORS.secondaryColor, width: contentArea.width
        });
        currentCardY += 10;
        currentCardY = this.drawMultilineText(doc, '各月の運勢概要です。詳細な日別予報は次ページ以降をご覧ください。', contentArea.x, currentCardY, {
            font: FONTS.gothic, fontSize: 11, fillColor: COLORS.textColor, width: contentArea.width
        });
        currentCardY += 20;

        Object.entries(monthlyData).forEach(([monthYear, data]) => {
            const monthSummary = data.summary || '特筆すべき月間傾向はありません。日別の詳細をご確認ください。';
            const requiredHeight = doc.font(FONTS.gothicBold).fontSize(12).heightOfString(monthYear)
                               + doc.font(FONTS.gothic).fontSize(10).heightOfString(monthSummary, { width: contentArea.width - 20 })
                               + 30; // マージン含む

            if (currentCardY + requiredHeight > contentArea.y + contentArea.height) {
                 this.addPageWithSetup(doc);
                 y = SAFE_CONTENT_TOP;
                 contentArea = this.drawContentCard(doc, y, PAGE_HEIGHT - SAFE_CONTENT_TOP - MARGIN - FOOTER_HEIGHT - 20);
                 currentCardY = contentArea.y;
                 // 必要ならヘッダー再描画
                  this.drawMultilineText(doc, '7.1 月別運勢ガイド (続き)', contentArea.x, currentCardY, {
                    font: FONTS.gothicBold, fontSize: 14, fillColor: COLORS.secondaryColor, width: contentArea.width
                 });
                 currentCardY += 10;
            }

            currentCardY = this.drawMultilineText(doc, monthYear, contentArea.x, currentCardY, {
                font: FONTS.gothicBold, fontSize: 12, fillColor: COLORS.tertiaryColor, width: contentArea.width
            });
            currentCardY += 5;
            currentCardY = this.drawMultilineText(doc, monthSummary, contentArea.x + 10, currentCardY, { // インデント
                font: FONTS.gothic, fontSize: 10, fillColor: COLORS.textColor, width: contentArea.width - 10
            });
            currentCardY += 15;
        });

        // --- 7.2 日別詳細予報 ---
        this.tocEntries.push({ title: '   7.2 日別詳細予報', page: this.currentPage + 1, level: 2 }); // 次のページから開始と仮定

        Object.entries(monthlyData).forEach(([monthYear, data]) => {
            this.addPageWithSetup(doc); // 月ごとに新しいページ
            y = SAFE_CONTENT_TOP;

            // 月のタイトル
            doc.font(FONTS.gothicBold)
               .fontSize(16)
               .fillColor(COLORS.secondaryColor)
               .text(`${monthYear}の日別運勢`, MARGIN, y, { width: CONTENT_WIDTH, align: 'center' });
            y += 40;

            // 日付ごとの運勢テーブルデータ準備
            const rows = data.days.map(day => {
                try {
                    const date = new Date(day.date);
                    const dayDate = format(date, 'd日(E)', { locale: ja });
                    // 運気レベルを星で表現 (0-100 を 1-5星に変換)
                    let stars = '★★★☆☆'; // デフォルト
                    if (typeof day.luckLevel === 'number') {
                        const level = Math.max(0, Math.min(100, day.luckLevel));
                        const starCount = Math.round(level / 20);
                        stars = '★'.repeat(starCount) + '☆'.repeat(5 - starCount);
                    }
                    return [
                        dayDate,
                        stars,
                        day.dailyFortune || '特筆すべき運勢はありません'
                    ];
                } catch(e) {
                     console.error(`Invalid date format in dailyHoroscopes for table: ${day.date}`);
                     return ['日付エラー', '---', '---'];
                }
            });

            // テーブルヘッダー
            const headers = ['日付', '運気', '運勢'];
            // 列幅指定 (運勢列を広く)
            const columnWidths = [80, 80, CONTENT_WIDTH - 80 - 80];

            // 表の描画 (drawTable内で改ページ処理される)
            this.drawTable(doc, headers, rows, MARGIN, y, CONTENT_WIDTH, columnWidths);
        });
    }

    // --- テキスト整形ヘルパー ---

    /**
     * 特定の書式（小見出し【】、箇条書き・）を含むテキストを描画
     * @param {PDFDocument} doc
     * @param {string} text
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @returns {number} 描画後のY座標
     */
    drawFormattedText(doc, text, x, y, width) {
        let currentY = y;
        const paragraphs = text.split('\n').filter(p => p.trim() !== '');

        paragraphs.forEach(paragraph => {
            let options = { font: FONTS.gothic, fontSize: 11, fillColor: COLORS.textColor, width: width };
            let indent = 0;
            let paragraphHeight = 0;

            if (paragraph.startsWith('【') && paragraph.endsWith('】')) {
                options = { font: FONTS.gothicBold, fontSize: 13, fillColor: COLORS.secondaryColor, width: width };
                 paragraphHeight = doc.font(options.font).fontSize(options.fontSize).heightOfString(paragraph, { width });
                 currentY = this.checkAndAddNewPage(doc, currentY, paragraphHeight + 15); // マージン込み
                 doc.font(options.font).fontSize(options.fontSize).fillColor(options.fillColor).text(paragraph, x, currentY, { width });
                 currentY += paragraphHeight + 15; // 小見出し後のマージン

            } else if (paragraph.startsWith('・')) {
                options.width = width - 10; // インデント分引く
                indent = 10;
                paragraph = paragraph.substring(1); // 先頭の「・」を除く
                 paragraphHeight = doc.font(options.font).fontSize(options.fontSize).heightOfString(`・${paragraph}`, { width }); // 高さは「・」込みで計算
                 currentY = this.checkAndAddNewPage(doc, currentY, paragraphHeight + 5); // マージン込み
                 doc.font(options.font).fontSize(options.fontSize).fillColor(options.fillColor).text(`・${paragraph}`, x + indent, currentY, { width: options.width });
                 currentY += paragraphHeight + 5; // 箇条書き後のマージン

            } else {
                 paragraphHeight = doc.font(options.font).fontSize(options.fontSize).heightOfString(paragraph, { width });
                 currentY = this.checkAndAddNewPage(doc, currentY, paragraphHeight + 10); // マージン込み
                 doc.font(options.font).fontSize(options.fontSize).fillColor(options.fillColor).text(paragraph, x + indent, currentY, { width });
                 currentY += paragraphHeight + 10; // 通常段落後のマージン
            }
        });
        return currentY;
    }
}

// クラスをエクスポート
export default PDFGenerator;