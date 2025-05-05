/**
 * Gemini API連携ライブラリのテスト
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateComprehensiveReading,
  generateDailyHoroscope,
  generatePersonalityAnalysis,
  predictSpecificQuestion
} from '../../lib/gemini-api';

// @google/generative-aiのモック
vi.mock('@google/generative-ai', () => {
  // 複数のレスポンスタイプを返せるようにするモック関数
  const createMockResponse = (content) => ({
    response: {
      text: () => content,
      candidates: [{
        content: {
          parts: [{ text: content }],
          role: 'model'
        },
        finishReason: 'STOP',
        index: 0,
        safetyRatings: []
      }],
      promptFeedback: {
        safetyRatings: []
      }
    }
  });

  // 各種レスポンスを定義
  const mockResponses = {
    comprehensiveReading: createMockResponse(`
# 2024年の総合運勢
## 全体の傾向
2024年はあなたにとって新たな可能性が広がる年になります。
## 仕事運
仕事面では、4月から6月にかけて大きなチャンスが訪れるでしょう。
## 金運
財政面は安定しており、堅実な投資が実を結ぶ時期です。
## 恋愛運
恋愛面では、7月から9月にかけて素晴らしい出会いが期待できます。
## アドバイス
自分の直感を信じて行動することが、最良の結果をもたらすでしょう。
    `),
    dailyHoroscope: createMockResponse(`
# 2024年5月15日の運勢
## 全体運
今日は直感が冴えわたる日です。思いついたアイデアは積極的に実行しましょう。
## 仕事運
会議やミーティングでは、あなたの意見が高く評価されるでしょう。
## 金運
予期せぬ出費に注意が必要です。無駄遣いは控えましょう。
## 恋愛運
パートナーとの会話が特に重要な日です。素直な気持ちを伝えることで関係が深まります。
## ラッキーアイテム
青色の小物
    `),
    personalityAnalysis: createMockResponse(`
# 性格分析
## 基本的な性格
あなたは論理的で分析力に優れた性格です。物事を客観的に捉える能力があり、冷静な判断ができます。
## 長所
- 分析力が高い
- 忍耐強い
- 信頼性がある
## 短所
- 時に頑固になることがある
- 完璧主義の傾向がある
## 人間関係
少数の深い人間関係を好む傾向があります。信頼できる人との絆を大切にします。
## 仕事適性
詳細な分析や計画が必要な職種に向いています。研究職や分析職が適性があります。
    `),
    specificQuestion: createMockResponse(`
# 転職についての鑑定結果
## 現在の状況
現在のキャリアに停滞感を感じているようです。新しい挑戦を求める気持ちが高まっています。
## 転職のタイミング
2024年の後半、特に9月〜11月が転職に適した時期となるでしょう。
## 適職
あなたの強みを活かせる企画職や創造性を必要とするポジションが向いています。
## アドバイス
転職前に、希望する業界についての知識を深めることをお勧めします。また、自己PRを明確にしておくことが重要です。
    `)
  };

  // モックの実装を返す
  return {
    GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
      getGenerativeModel: vi.fn().mockImplementation(({ model, generationConfig, safetySettings }) => ({
        generateContent: vi.fn().mockImplementation((prompt) => {
          // プロンプトに基づいて適切なレスポンスを返す
          if (typeof prompt === 'string') {
            if (prompt.includes('総合鑑定') || prompt.includes('comprehensive reading')) {
              return Promise.resolve(mockResponses.comprehensiveReading);
            } else if (prompt.includes('日別運勢') || prompt.includes('daily horoscope')) {
              return Promise.resolve(mockResponses.dailyHoroscope);
            } else if (prompt.includes('性格分析') || prompt.includes('personality analysis')) {
              return Promise.resolve(mockResponses.personalityAnalysis);
            } else if (prompt.includes('specific question') || prompt.includes('質問')) {
              return Promise.resolve(mockResponses.specificQuestion);
            }
          }
          // デフォルトレスポンス
          return Promise.resolve(createMockResponse('Mock Gemini API response'));
        }),
        startChat: vi.fn().mockImplementation(() => ({
          sendMessage: vi.fn().mockImplementation((message) => {
            return Promise.resolve(createMockResponse(`Response to: ${message}`));
          }),
          getHistory: vi.fn().mockReturnValue([
            { role: 'user', text: 'Initial message' },
            { role: 'model', text: 'Initial response' }
          ])
        })),
        countTokens: vi.fn().mockResolvedValue({ totalTokens: 150 })
      }))
    }))
  };
});

// 環境変数のモック
vi.mock('process.env', () => ({
  GEMINI_API_KEY: 'dummy-api-key-for-testing',
}));

import { GoogleGenerativeAI } from '@google/generative-ai';

describe('gemini-api.js - Gemini API連携機能', () => {
  // モック用の変数
  let mockGenerateContent;

  beforeEach(() => {
    // モックのリセット
    vi.resetAllMocks();

    // generateContentのモックを取得
    mockGenerateContent = GoogleGenerativeAI().getGenerativeModel().generateContent;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generateComprehensiveReading', () => {
    it('正常系: 個人データから総合鑑定結果を生成する', async () => {
      // モックレスポンスの設定
      const mockGenAIResponse = {
        response: {
          text: () => `
# 2024年の総合運勢
## 全体の傾向
2024年はあなたにとって新たな可能性が広がる年になります。
## 仕事運
仕事面では、4月から6月にかけて大きなチャンスが訪れるでしょう。
## 金運
財政面は安定しており、堅実な投資が実を結ぶ時期です。
## 恋愛運
恋愛面では、7月から9月にかけて素晴らしい出会いが期待できます。
## アドバイス
自分の直感を信じて行動することが、最良の結果をもたらすでしょう。
          `
        }
      };
      mockGenerateContent.mockResolvedValue(mockGenAIResponse);

      // テスト用の個人データ
      const userData = {
        name: '山田太郎',
        birthDate: '1990-01-01',
        birthTime: '12:30',
        birthPlace: '東京',
        gender: '男性'
      };

      // テスト対象の関数を実行
      const result = await generateComprehensiveReading(userData);

      // 結果の検証
      expect(result).toContain('2024年の総合運勢');
      expect(result).toContain('全体の傾向');
      expect(result).toContain('仕事運');
      expect(result).toContain('金運');
      expect(result).toContain('恋愛運');
      expect(result).toContain('アドバイス');

      // Gemini APIが適切に呼び出されたことを検証
      expect(GoogleGenerativeAI).toHaveBeenCalledWith('dummy-api-key-for-testing');
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);

      // プロンプトに必要なユーザー情報が含まれているか検証
      const promptArg = mockGenerateContent.mock.calls[0][0];
      expect(promptArg).toContain(userData.name);
      expect(promptArg).toContain(userData.birthDate);
      expect(promptArg).toContain(userData.birthTime);
      expect(promptArg).toContain(userData.birthPlace);
    });

    it('エラー発生時は適切に例外をスローする', async () => {
      // エラーをスローするようにモック
      const errorMessage = 'API呼び出しエラー';
      mockGenerateContent.mockRejectedValue(new Error(errorMessage));

      // テスト用の個人データ
      const userData = {
        name: '山田太郎',
        birthDate: '1990-01-01',
        birthTime: '12:30',
        birthPlace: '東京',
      };

      // 関数呼び出しでエラーがスローされることを検証
      await expect(generateComprehensiveReading(userData))
        .rejects
        .toThrow('総合鑑定の生成中にエラーが発生しました: API呼び出しエラー');
    });
  });

  describe('generateDailyHoroscope', () => {
    it('正常系: 日付と個人データから日別運勢を生成する', async () => {
      // モックレスポンスの設定
      const mockGenAIResponse = {
        response: {
          text: () => `
# 2024年5月15日の運勢
## 全体運
今日は直感が冴えわたる日です。思いついたアイデアは積極的に実行しましょう。
## 仕事運
会議やミーティングでは、あなたの意見が高く評価されるでしょう。
## 金運
予期せぬ出費に注意が必要です。無駄遣いは控えましょう。
## 恋愛運
パートナーとの会話が特に重要な日です。素直な気持ちを伝えることで関係が深まります。
## ラッキーアイテム
青色の小物
          `
        }
      };
      mockGenerateContent.mockResolvedValue(mockGenAIResponse);

      // テスト用のパラメータ
      const date = '2024-05-15';
      const userData = {
        name: '山田太郎',
        birthDate: '1990-01-01',
        birthTime: '12:30',
        birthPlace: '東京',
      };

      // テスト対象の関数を実行
      const result = await generateDailyHoroscope(date, userData);

      // 結果の検証
      expect(result).toContain('2024年5月15日の運勢');
      expect(result).toContain('全体運');
      expect(result).toContain('仕事運');
      expect(result).toContain('金運');
      expect(result).toContain('恋愛運');
      expect(result).toContain('ラッキーアイテム');

      // Gemini APIが適切に呼び出されたことを検証
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);

      // プロンプトに必要な情報が含まれているか検証
      const promptArg = mockGenerateContent.mock.calls[0][0];
      expect(promptArg).toContain(date);
      expect(promptArg).toContain(userData.birthDate);
    });
  });

  describe('generatePersonalityAnalysis', () => {
    it('正常系: 個人データから性格分析を生成する', async () => {
      // モックレスポンスの設定
      const mockGenAIResponse = {
        response: {
          text: () => `
# 性格分析
## 基本的な性格
あなたは論理的で分析力に優れた性格です。物事を客観的に捉える能力があり、冷静な判断ができます。
## 長所
- 分析力が高い
- 忍耐強い
- 信頼性がある
## 短所
- 時に頑固になることがある
- 完璧主義の傾向がある
## 人間関係
少数の深い人間関係を好む傾向があります。信頼できる人との絆を大切にします。
## 仕事適性
詳細な分析や計画が必要な職種に向いています。研究職や分析職が適性があります。
          `
        }
      };
      mockGenerateContent.mockResolvedValue(mockGenAIResponse);

      // テスト用の個人データ
      const userData = {
        name: '山田太郎',
        birthDate: '1990-01-01',
        birthTime: '12:30',
        birthPlace: '東京',
        gender: '男性'
      };

      // テスト対象の関数を実行
      const result = await generatePersonalityAnalysis(userData);

      // 結果の検証
      expect(result).toContain('性格分析');
      expect(result).toContain('基本的な性格');
      expect(result).toContain('長所');
      expect(result).toContain('短所');
      expect(result).toContain('人間関係');
      expect(result).toContain('仕事適性');

      // Gemini APIが適切に呼び出されたことを検証
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });
  });

  describe('predictSpecificQuestion', () => {
    it('正常系: 特定の質問に対する回答を生成する', async () => {
      // モックレスポンスの設定
      const mockGenAIResponse = {
        response: {
          text: () => `
# 転職すべきかについての鑑定

現在のあなたの星の配置を見ると、キャリアの変化に適した時期に入っています。
特に2024年後半は、新しい挑戦に取り組むことで、あなたの才能がより発揮される可能性が高まっています。

## 詳細な分析
- 現在の職場では、あなたの能力が十分に評価されていない兆候があります
- 7月から9月にかけて、キャリアに関する重要な機会が訪れるでしょう
- 新しい環境では、あなたのコミュニケーション能力と分析力が高く評価されるでしょう

## アドバイス
転職を検討することは妥当ですが、7月まで待つことをお勧めします。それまでの間に、
スキルアップや情報収集に時間を使うことで、より良い選択ができるでしょう。
          `
        }
      };
      mockGenerateContent.mockResolvedValue(mockGenAIResponse);

      // テスト用のパラメータ
      const question = '転職すべきでしょうか？';
      const userData = {
        name: '山田太郎',
        birthDate: '1990-01-01',
        birthTime: '12:30',
        birthPlace: '東京',
      };

      // テスト対象の関数を実行
      const result = await predictSpecificQuestion(question, userData);

      // 結果の検証
      expect(result).toContain('転職すべきかについての鑑定');
      expect(result).toContain('詳細な分析');
      expect(result).toContain('アドバイス');

      // Gemini APIが適切に呼び出されたことを検証
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);

      // プロンプトに質問が含まれているか検証
      const promptArg = mockGenerateContent.mock.calls[0][0];
      expect(promptArg).toContain(question);
    });

    it('空の質問の場合は一般的な運勢予測を返す', async () => {
      // モックレスポンスの設定
      const mockGenAIResponse = {
        response: {
          text: () => '一般的な運勢予測のテキスト'
        }
      };
      mockGenerateContent.mockResolvedValue(mockGenAIResponse);

      // 空の質問
      const question = '';
      const userData = {
        name: '山田太郎',
        birthDate: '1990-01-01'
      };

      // テスト対象の関数を実行
      const result = await predictSpecificQuestion(question, userData);

      // 一般的な予測が返されることを検証
      expect(result).toBe('一般的な運勢予測のテキスト');
    });
  });
});