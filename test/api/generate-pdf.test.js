/**
 * PDF生成APIの統合テスト
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from '../../api/generate-pdf.js';

// 依存モジュールのモック
vi.mock('../../api/jobStore.js', () => ({
  jobStore: {},
  generateJobId: vi.fn().mockReturnValue('test-job-id-123')
}));

vi.mock('../../lib/gemini-api.js', () => ({
  generateComprehensiveReading: vi.fn().mockResolvedValue({
    coreEnergy: '太陽星座: 山羊座, 月星座: 蟹座, アセンダント: 牡羊座, 日主: 甲, 五行バランス: 木多く水少なし',
    astrologyChartData: { /* チャートデータ */ },
    fourPillarsChartData: { /* 四柱推命データ */ },
    lifePurpose: '人生の目的テキスト',
    lifePurposeDetails: {
      talents: ['リーダーシップ', '分析力'],
      lifeTheme: '社会的貢献',
      challenges: ['自己肯定感の課題']
    },
    fortuneTimeline: '今後の運勢テキスト',
    fortuneTimelineDetails: {
      lifeCycleData: { /* ライフサイクルデータ */ },
      currentTrend: '現在は成長期',
      futureTrend: '2024年後半から変化の時期',
      turningPoints: ['2025年3月', '2027年8月']
    },
    specificQuestionAnswer: '質問への回答テキスト',
    summary: '総括テキスト'
  }),
  generateDailyHoroscopes: vi.fn().mockResolvedValue([
    { date: '2024-01-01', forecast: '日別占いテキスト1' },
    { date: '2024-01-02', forecast: '日別占いテキスト2' }
  ])
}));

vi.mock('../../lib/astrology.js', () => ({
  calculateAstrologyData: vi.fn().mockReturnValue({ /* 西洋占星術データ */ })
}));

vi.mock('../../lib/four-pillars.js', () => ({
  calculateFourPillarsData: vi.fn().mockReturnValue({ /* 四柱推命データ */ })
}));

vi.mock('../../lib/pdf-generator.js', () => ({
  default: {
    generateFullPDF: vi.fn().mockResolvedValue()
  }
}));

vi.mock('../../lib/email-service.js', () => ({
  emailService: {
    sendPdfEmail: vi.fn().mockResolvedValue()
  }
}));

vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(),
  readFile: vi.fn().mockResolvedValue(Buffer.from('mock pdf content').toString('base64'))
}));

vi.mock('path', () => ({
  join: vi.fn().mockImplementation((...args) => args.join('/')),
  resolve: vi.fn().mockImplementation((...args) => args.join('/'))
}));

vi.mock('os', () => ({
  tmpdir: vi.fn().mockReturnValue('/tmp')
}));

// テスト用ユーティリティ
const createMockRequest = (body = {}) => ({
  method: 'POST',
  body
});

const createMockResponse = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    headersSent: false
  };
  return res;
};

describe('PDF生成API', () => {
  beforeEach(() => {
    // テスト前にモックをリセット
    vi.clearAllMocks();
    // jobStoreをリセット
    const { jobStore } = require('../../api/jobStore.js');
    Object.keys(jobStore).forEach(key => delete jobStore[key]);
  });

  describe('PDF生成リクエスト処理', () => {
    it('正常系：有効なリクエストが受け付けられ、バックグラウンド処理が開始される', async () => {
      // 有効なリクエストデータ
      const validRequestData = {
        name: '山田太郎',
        birthDate: '1990-01-01',
        birthTime: '12:30',
        birthPlace: '東京',
        specificQuestion: '2024年の運勢について教えてください',
        email: 'yamada@example.com',
        paymentId: 'ch_test_12345'
      };

      const req = createMockRequest(validRequestData);
      const res = createMockResponse();

      // APIハンドラーを実行
      await handler(req, res);

      // レスポンスの検証
      expect(res.status).toHaveBeenCalledWith(202);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        jobId: 'test-job-id-123',
        progressUrl: '/api/pdf-progress/test-job-id-123'
      }));

      // ジョブストアの検証
      const { jobStore } = require('../../api/jobStore.js');
      expect(jobStore['test-job-id-123']).toBeDefined();
      expect(jobStore['test-job-id-123'].status).toBe('processing');

      // 依存関数の呼び出し検証
      const { calculateAstrologyData } = require('../../lib/astrology.js');
      const { calculateFourPillarsData } = require('../../lib/four-pillars.js');
      const { generateComprehensiveReading, generateDailyHoroscopes } = require('../../lib/gemini-api.js');

      expect(calculateAstrologyData).toHaveBeenCalledWith(
        validRequestData.birthDate,
        validRequestData.birthTime,
        validRequestData.birthPlace
      );

      expect(calculateFourPillarsData).toHaveBeenCalledWith(
        validRequestData.birthDate,
        validRequestData.birthTime
      );

      expect(generateComprehensiveReading).toHaveBeenCalledWith(
        validRequestData.name,
        validRequestData.birthDate,
        validRequestData.birthTime,
        validRequestData.birthPlace,
        expect.any(Object), // astrologyData
        expect.any(Object), // fourPillarsData
        validRequestData.specificQuestion
      );

      expect(generateDailyHoroscopes).toHaveBeenCalled();
    });

    it('必須パラメータが不足している場合はエラーレスポンスを返す', async () => {
      // 不足したリクエストデータ（birthTimeが欠けている）
      const invalidRequestData = {
        name: '山田太郎',
        birthDate: '1990-01-01',
        birthPlace: '東京',
        paymentId: 'ch_test_12345'
      };

      const req = createMockRequest(invalidRequestData);
      const res = createMockResponse();

      // APIハンドラーを実行
      await handler(req, res);

      // レスポンスの検証
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.stringContaining('必須パラメータ')
      }));

      // バックグラウンド処理が開始されないことを検証
      const { calculateAstrologyData } = require('../../lib/astrology.js');
      expect(calculateAstrologyData).not.toHaveBeenCalled();
    });

    it('POSTメソッド以外のリクエストはエラーレスポンスを返す', async () => {
      const req = {
        method: 'GET',
        body: {}
      };
      const res = createMockResponse();

      // APIハンドラーを実行
      await handler(req, res);

      // レスポンスの検証
      expect(res.status).toHaveBeenCalledWith(405);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.stringContaining('Method not allowed')
      }));
    });

    it('APIエラー時は適切にエラーハンドリングされる', async () => {
      // 有効なリクエストデータだが、APIが例外を投げる
      const validRequestData = {
        name: '山田太郎',
        birthDate: '1990-01-01',
        birthTime: '12:30',
        birthPlace: '東京',
        paymentId: 'ch_test_12345'
      };

      const req = createMockRequest(validRequestData);
      const res = createMockResponse();

      // 例外を投げるようにモック
      const { generateComprehensiveReading } = require('../../lib/gemini-api.js');
      generateComprehensiveReading.mockRejectedValueOnce(new Error('API connection error'));

      // コンソールエラーをモック
      console.error = vi.fn();

      // APIハンドラーを実行
      await handler(req, res);

      // リクエストは受け付けられるが、処理中にエラーが発生する
      expect(res.status).toHaveBeenCalledWith(202);

      // jobStoreでエラーが記録されていることを確認
      const { jobStore } = require('../../api/jobStore.js');
      const jobId = Object.keys(jobStore)[0];

      // ジョブが作成されることを確認
      expect(jobId).toBeDefined();

      // バックグラウンド処理が進むにつれてジョブステータスが更新される
      // しかし、この時点ではまだエラーは記録されていないかもしれない
      // （バックグラウンド処理が非同期で実行されるため）

      // コンソールログが出力されていることを確認
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('バックグラウンドPDF生成処理', () => {
    it('PDFのバックグラウンド生成が正しく開始されることを確認', async () => {
      // バックグラウンド処理の直接呼び出しをテスト
      vi.doMock('../../api/generate-pdf.js', async () => {
        const actualModule = await vi.importActual('../../api/generate-pdf.js');
        return {
          ...actualModule,
          default: actualModule.default,
          // バックグラウンド処理関数を露出させる
          generatePdfInBackground: actualModule.generatePdfInBackground
        };
      });

      // 再インポートして関数を取得
      const { generatePdfInBackground } = await import('../../api/generate-pdf.js');

      // テスト用データ
      const jobId = 'test-background-job';
      const userData = {
        name: '山田太郎',
        birthDate: '1990-01-01',
        birthTime: '12:30',
        birthPlace: '東京',
        email: 'yamada@example.com'
      };
      const horoscopeReading = {
        coreEnergy: '太陽星座: 山羊座, 月星座: 蟹座',
        lifePurpose: 'ライフパーパス',
        fortuneTimeline: '運勢タイムライン',
        specificQuestionAnswer: '質問への回答',
        summary: 'サマリー'
      };
      const dailyHoroscopes = [
        { date: '2024-01-01', forecast: '日別占い1' }
      ];

      // jobStoreを初期化
      const { jobStore } = require('../../api/jobStore.js');
      jobStore[jobId] = {
        status: 'pending',
        progress: 0,
        message: 'テスト用初期状態',
        timestamp: new Date().toISOString(),
        userData
      };

      // タイマーをモック
      vi.useFakeTimers();

      // バックグラウンド処理を呼び出し
      await generatePdfInBackground(jobId, userData, horoscopeReading, dailyHoroscopes);

      // PDF生成関数が呼び出されたことを確認
      const pdfGenerator = require('../../lib/pdf-generator.js').default;
      expect(pdfGenerator.generateFullPDF).toHaveBeenCalledWith(
        userData,
        expect.any(Object), // horoscopeDataの整形結果
        expect.objectContaining({
          outputPath: expect.stringContaining(jobId),
          onProgress: expect.any(Function)
        })
      );

      // jobStoreが更新されていることを確認
      expect(jobStore[jobId].status).toBe('completed');
      expect(jobStore[jobId].progress).toBe(100);

      // メール送信が呼び出されたことを確認
      const { emailService } = require('../../lib/email-service.js');
      expect(emailService.sendPdfEmail).toHaveBeenCalledWith(expect.objectContaining({
        to: userData.email,
        subject: expect.stringContaining(userData.name),
        pdfInfo: expect.objectContaining({
          content: expect.any(String), // Base64エンコードされたPDF
          fileName: expect.stringContaining(userData.name)
        })
      }));

      // クリーンアップタイマーが設定されたことを確認
      expect(setTimeout).toHaveBeenCalled();

      // タイマーを進める
      vi.runAllTimers();

      // ジョブがクリーンアップされていることを確認
      expect(jobStore[jobId]).toBeUndefined();

      // タイマーのモックをクリア
      vi.useRealTimers();
    });

    it('メールアドレスがない場合はメール送信処理がスキップされる', async () => {
      // バックグラウンド処理の直接呼び出しをテスト
      vi.doMock('../../api/generate-pdf.js', async () => {
        const actualModule = await vi.importActual('../../api/generate-pdf.js');
        return {
          ...actualModule,
          default: actualModule.default,
          generatePdfInBackground: actualModule.generatePdfInBackground
        };
      });

      // 再インポートして関数を取得
      const { generatePdfInBackground } = await import('../../api/generate-pdf.js');

      // テスト用データ（emailなし）
      const jobId = 'test-no-email-job';
      const userData = {
        name: '山田太郎',
        birthDate: '1990-01-01',
        birthTime: '12:30',
        birthPlace: '東京'
        // emailなし
      };
      const horoscopeReading = {
        coreEnergy: '太陽星座: 山羊座',
        summary: 'サマリー'
      };
      const dailyHoroscopes = [];

      // jobStoreを初期化
      const { jobStore } = require('../../api/jobStore.js');
      jobStore[jobId] = {
        status: 'pending',
        progress: 0,
        message: 'テスト用初期状態',
        timestamp: new Date().toISOString(),
        userData
      };

      // バックグラウンド処理を呼び出し
      await generatePdfInBackground(jobId, userData, horoscopeReading, dailyHoroscopes);

      // PDF生成関数が呼び出されたことを確認
      const pdfGenerator = require('../../lib/pdf-generator.js').default;
      expect(pdfGenerator.generateFullPDF).toHaveBeenCalled();

      // メール送信が呼び出されないことを確認
      const { emailService } = require('../../lib/email-service.js');
      expect(emailService.sendPdfEmail).not.toHaveBeenCalled();

      // ジョブステータスが正しく更新されていることを確認
      expect(jobStore[jobId].status).toBe('completed');
      expect(jobStore[jobId].message).toContain('メールアドレス未指定');
    });

    it('PDF生成中にエラーが発生した場合、適切にエラーハンドリングされる', async () => {
      // バックグラウンド処理の直接呼び出しをテスト
      vi.doMock('../../api/generate-pdf.js', async () => {
        const actualModule = await vi.importActual('../../api/generate-pdf.js');
        return {
          ...actualModule,
          default: actualModule.default,
          generatePdfInBackground: actualModule.generatePdfInBackground
        };
      });

      // 再インポートして関数を取得
      const { generatePdfInBackground } = await import('../../api/generate-pdf.js');

      // PDF生成でエラーが発生するようにモック
      const pdfGenerator = require('../../lib/pdf-generator.js').default;
      pdfGenerator.generateFullPDF.mockRejectedValueOnce(new Error('PDF生成エラー'));

      // コンソールエラーをモック
      console.error = vi.fn();

      // テスト用データ
      const jobId = 'test-error-job';
      const userData = {
        name: '山田太郎',
        birthDate: '1990-01-01',
        birthTime: '12:30',
        birthPlace: '東京'
      };
      const horoscopeReading = { summary: 'サマリー' };
      const dailyHoroscopes = [];

      // jobStoreを初期化
      const { jobStore } = require('../../api/jobStore.js');
      jobStore[jobId] = {
        status: 'pending',
        progress: 0,
        message: 'テスト用初期状態',
        timestamp: new Date().toISOString(),
        userData
      };

      // バックグラウンド処理を呼び出し
      await generatePdfInBackground(jobId, userData, horoscopeReading, dailyHoroscopes);

      // エラーがログ出力されていることを確認
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(`Error during PDF generation for job ${jobId}`),
        expect.any(Error)
      );

      // ジョブのステータスが「エラー」に更新されていることを確認
      expect(jobStore[jobId].status).toBe('error');
      expect(jobStore[jobId].message).toContain('PDF生成中にエラーが発生しました');
      expect(jobStore[jobId].error).toBe('PDF生成エラー');
    });

    it('メール送信中にエラーが発生してもPDF生成自体は完了とみなされる', async () => {
      // バックグラウンド処理の直接呼び出しをテスト
      vi.doMock('../../api/generate-pdf.js', async () => {
        const actualModule = await vi.importActual('../../api/generate-pdf.js');
        return {
          ...actualModule,
          default: actualModule.default,
          generatePdfInBackground: actualModule.generatePdfInBackground
        };
      });

      // 再インポートして関数を取得
      const { generatePdfInBackground } = await import('../../api/generate-pdf.js');

      // メール送信でエラーが発生するようにモック
      const { emailService } = require('../../lib/email-service.js');
      emailService.sendPdfEmail.mockRejectedValueOnce(new Error('メール送信エラー'));

      // コンソールエラーをモック
      console.error = vi.fn();

      // テスト用データ
      const jobId = 'test-email-error-job';
      const userData = {
        name: '山田太郎',
        birthDate: '1990-01-01',
        birthTime: '12:30',
        birthPlace: '東京',
        email: 'yamada@example.com'
      };
      const horoscopeReading = { summary: 'サマリー' };
      const dailyHoroscopes = [];

      // jobStoreを初期化
      const { jobStore } = require('../../api/jobStore.js');
      jobStore[jobId] = {
        status: 'pending',
        progress: 0,
        message: 'テスト用初期状態',
        timestamp: new Date().toISOString(),
        userData
      };

      // バックグラウンド処理を呼び出し
      await generatePdfInBackground(jobId, userData, horoscopeReading, dailyHoroscopes);

      // メール送信エラーがログ出力されていることを確認
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(`Job ${jobId}: Failed to send email`),
        expect.any(Error)
      );

      // ジョブのステータスがメール送信エラーでも「完了」になっていることを確認
      expect(jobStore[jobId].status).toBe('completed');
      expect(jobStore[jobId].message).toContain('PDF生成完了、しかしメール送信に失敗しました');
      expect(jobStore[jobId].error).toContain('Email Error:');
    });
  });
});