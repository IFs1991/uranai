/**
 * ユーザーPDF管理APIのテスト
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handler } from '../../api/user-pdfs';

// jobStoreのモック
vi.mock('../../api/jobStore', () => ({
  getUserJobs: vi.fn()
}));

// KVストアのモック
vi.mock('../../lib/kv-store.js', () => ({
  getItem: vi.fn(),
  setItem: vi.fn()
}));

import { getUserJobs } from '../../api/jobStore';
import { getItem } from '../../lib/kv-store.js';

describe('user-pdfs.js - ユーザーPDF管理API', () => {
  // モックリクエスト/レスポンスオブジェクト
  let mockReq;
  let mockRes;
  const mockUserId = 'test-user-id';

  beforeEach(() => {
    // リクエスト/レスポンスのモック初期化
    mockReq = {
      headers: {
        authorization: `Bearer test-token`
      },
      query: {}
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn()
    };

    // KVストアのモック実装（認証のため）
    getItem.mockImplementation((key) => {
      if (key === 'auth:test-token') {
        return Promise.resolve({
          userId: mockUserId,
          expires: Date.now() + 3600000 // 1時間後
        });
      }
      return Promise.resolve(null);
    });

    // モックのリセット
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('ユーザーPDF一覧の取得', () => {
    it('正常系: ユーザーの全てのPDFジョブ一覧を取得できる', async () => {
      const mockJobs = [
        {
          id: 'job1',
          userId: mockUserId,
          status: 'completed',
          progress: 100,
          message: 'PDF生成完了',
          created: '2023-07-01T12:00:00.000Z',
          updated: '2023-07-01T12:05:00.000Z',
          result: {
            fileName: 'horoscope_job1.pdf'
          },
          userData: {
            name: '山田太郎',
            birthDate: '1990-01-01'
          }
        },
        {
          id: 'job2',
          userId: mockUserId,
          status: 'completed',
          progress: 100,
          message: 'PDF生成完了',
          created: '2023-07-02T14:00:00.000Z',
          updated: '2023-07-02T14:05:00.000Z',
          result: {
            fileName: 'horoscope_job2.pdf'
          },
          userData: {
            name: '佐藤花子',
            birthDate: '1985-05-15'
          }
        }
      ];

      // getUserJobsのモック実装
      getUserJobs.mockResolvedValue(mockJobs);

      // テスト対象のハンドラー関数を実行
      await handler(mockReq, mockRes);

      // レスポンスの検証
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        jobs: mockJobs
      });

      // getUserJobsの呼び出し検証
      expect(getUserJobs).toHaveBeenCalledWith(mockUserId);
    });

    it('正常系: 完了したジョブのみをフィルタリングして取得できる', async () => {
      // クエリパラメータを設定
      mockReq.query = { status: 'completed' };

      const allJobs = [
        {
          id: 'job1',
          userId: mockUserId,
          status: 'completed',
          progress: 100,
          message: 'PDF生成完了',
          created: '2023-07-01T12:00:00.000Z',
          updated: '2023-07-01T12:05:00.000Z'
        },
        {
          id: 'job2',
          userId: mockUserId,
          status: 'processing',
          progress: 50,
          message: 'PDF生成中...',
          created: '2023-07-02T14:00:00.000Z',
          updated: '2023-07-02T14:02:00.000Z'
        },
        {
          id: 'job3',
          userId: mockUserId,
          status: 'completed',
          progress: 100,
          message: 'PDF生成完了',
          created: '2023-07-03T09:00:00.000Z',
          updated: '2023-07-03T09:05:00.000Z'
        }
      ];

      const completedJobs = allJobs.filter(job => job.status === 'completed');

      // getUserJobsのモック実装（全てのジョブを返す）
      getUserJobs.mockResolvedValue(allJobs);

      // テスト対象のハンドラー関数を実行
      await handler(mockReq, mockRes);

      // レスポンスの検証（完了したジョブのみが含まれている）
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        jobs: completedJobs
      });
    });

    it('正常系: 作成日の新しい順にソートされた結果を取得できる', async () => {
      const mockJobs = [
        {
          id: 'job1',
          userId: mockUserId,
          status: 'completed',
          progress: 100,
          created: '2023-07-01T12:00:00.000Z',
          updated: '2023-07-01T12:05:00.000Z'
        },
        {
          id: 'job3',
          userId: mockUserId,
          status: 'completed',
          progress: 100,
          created: '2023-07-03T09:00:00.000Z',
          updated: '2023-07-03T09:05:00.000Z'
        },
        {
          id: 'job2',
          userId: mockUserId,
          status: 'completed',
          progress: 100,
          created: '2023-07-02T14:00:00.000Z',
          updated: '2023-07-02T14:05:00.000Z'
        }
      ];

      // getUserJobsのモック実装
      getUserJobs.mockResolvedValue(mockJobs);

      // テスト対象のハンドラー関数を実行
      await handler(mockReq, mockRes);

      // レスポンスデータを取得
      const responseData = mockRes.json.mock.calls[0][0];
      const sortedJobs = responseData.jobs;

      // 日付順に正しくソートされているか検証
      expect(sortedJobs[0].id).toBe('job3'); // 最新
      expect(sortedJobs[1].id).toBe('job2');
      expect(sortedJobs[2].id).toBe('job1'); // 最古
    });
  });

  describe('認証と権限の検証', () => {
    it('エラー処理: 認証トークンがない場合は401エラーを返す', async () => {
      // 認証ヘッダーなしのリクエスト
      mockReq.headers = {};

      // テスト対象のハンドラー関数を実行
      await handler(mockReq, mockRes);

      // エラーレスポンスの検証
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('認証が必要です')
        })
      );

      // getUserJobsは呼び出されていないことを検証
      expect(getUserJobs).not.toHaveBeenCalled();
    });

    it('エラー処理: 無効な認証トークンの場合は401エラーを返す', async () => {
      // 無効なトークンを持つリクエスト
      mockReq.headers.authorization = 'Bearer invalid-token';

      // KVストアのモックを無効なトークン用に更新
      getItem.mockImplementation((key) => {
        if (key === 'auth:invalid-token') {
          return Promise.resolve(null); // トークンが見つからない
        }
        return Promise.resolve(null);
      });

      // テスト対象のハンドラー関数を実行
      await handler(mockReq, mockRes);

      // エラーレスポンスの検証
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('無効な認証トークンです')
        })
      );

      // getUserJobsは呼び出されていないことを検証
      expect(getUserJobs).not.toHaveBeenCalled();
    });

    it('エラー処理: 期限切れの認証トークンの場合は401エラーを返す', async () => {
      // 期限切れのトークンを持つリクエスト
      mockReq.headers.authorization = 'Bearer expired-token';

      // KVストアのモックを期限切れトークン用に更新
      getItem.mockImplementation((key) => {
        if (key === 'auth:expired-token') {
          return Promise.resolve({
            userId: mockUserId,
            expires: Date.now() - 1000 // 過去の時間（期限切れ）
          });
        }
        return Promise.resolve(null);
      });

      // テスト対象のハンドラー関数を実行
      await handler(mockReq, mockRes);

      // エラーレスポンスの検証
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('認証トークンの有効期限が切れています')
        })
      );

      // getUserJobsは呼び出されていないことを検証
      expect(getUserJobs).not.toHaveBeenCalled();
    });
  });

  describe('エラーハンドリング', () => {
    it('エラー処理: ジョブデータの取得中にエラーが発生した場合は500エラーを返す', async () => {
      // getUserJobsでエラーをスローするように設定
      getUserJobs.mockRejectedValue(new Error('データベースエラー'));

      // テスト対象のハンドラー関数を実行
      await handler(mockReq, mockRes);

      // エラーレスポンスの検証
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('ジョブデータの取得中にエラーが発生しました')
        })
      );
    });

    it('エラー処理: 不正なクエリパラメータの場合は400エラーを返す', async () => {
      // 無効なクエリパラメータを設定
      mockReq.query = { status: 'invalid-status' };

      const allJobs = [
        {
          id: 'job1',
          userId: mockUserId,
          status: 'completed',
          progress: 100
        },
        {
          id: 'job2',
          userId: mockUserId,
          status: 'processing',
          progress: 50
        }
      ];

      // getUserJobsのモック実装
      getUserJobs.mockResolvedValue(allJobs);

      // テスト対象のハンドラー関数を実行
      await handler(mockReq, mockRes);

      // エラーレスポンスの検証
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('無効なステータスフィルターです')
        })
      );
    });
  });
});