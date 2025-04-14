/**
 * PDF生成進捗確認APIのテスト
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handler } from '../../api/pdf-progress';

// KVストアのモック
vi.mock('../../lib/kvStore', () => ({
  getItem: vi.fn()
}));

// jobStoreのモック
vi.mock('../../api/jobStore', () => ({
  getJob: vi.fn()
}));

import { getItem } from '../../lib/kvStore';
import { getJob } from '../../api/jobStore';

describe('pdf-progress.js - PDF生成進捗確認API', () => {
  // モックリクエスト/レスポンスオブジェクト
  let mockReq;
  let mockRes;
  const mockUserId = 'test-user-id';
  const mockJobId = 'job-123456';

  beforeEach(() => {
    // リクエスト/レスポンスのモック初期化
    mockReq = {
      headers: {
        authorization: `Bearer test-token`
      },
      query: {
        jobId: mockJobId
      }
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
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

  describe('正常系のジョブ状態取得', () => {
    it('処理中のジョブの進捗状況を取得できる', async () => {
      // 処理中のジョブ
      const mockJob = {
        id: mockJobId,
        userId: mockUserId,
        status: 'processing',
        progress: 65,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        horoscopeType: 'monthly',
        userData: {
          name: '山田太郎',
          birthDate: '1990-01-01'
        },
        estimatedCompletionTime: new Date(Date.now() + 60000).toISOString() // 1分後
      };

      // モック実装
      getJob.mockResolvedValue(mockJob);

      // テスト対象のハンドラー関数を実行
      await handler(mockReq, mockRes);

      // レスポンスの検証
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        job: mockJob,
        success: true
      });
    });

    it('完了したジョブの情報を取得できる', async () => {
      // 完了したジョブ
      const mockJob = {
        id: mockJobId,
        userId: mockUserId,
        status: 'completed',
        progress: 100,
        created: new Date().toISOString(),
        completed: new Date().toISOString(),
        horoscopeType: 'yearly',
        userData: {
          name: '山田太郎',
          birthDate: '1990-01-01'
        },
        filePath: `/storage/pdfs/${mockJobId}.pdf`,
        fileUrl: `/api/download-pdf?jobId=${mockJobId}`
      };

      // モック実装
      getJob.mockResolvedValue(mockJob);

      // テスト対象のハンドラー関数を実行
      await handler(mockReq, mockRes);

      // レスポンスの検証
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        job: mockJob,
        success: true
      });
    });

    it('エラーステータスのジョブ情報を取得できる', async () => {
      // エラーのジョブ
      const mockJob = {
        id: mockJobId,
        userId: mockUserId,
        status: 'error',
        progress: 35,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        horoscopeType: 'daily',
        userData: {
          name: '山田太郎',
          birthDate: '1990-01-01'
        },
        error: {
          code: 'GENERATION_FAILED',
          message: 'PDFの生成中にエラーが発生しました'
        }
      };

      // モック実装
      getJob.mockResolvedValue(mockJob);

      // テスト対象のハンドラー関数を実行
      await handler(mockReq, mockRes);

      // レスポンスの検証
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        job: mockJob,
        success: true
      });
    });
  });

  describe('エラー処理', () => {
    it('ジョブIDが指定されていない場合は400エラーを返す', async () => {
      // ジョブID無しのリクエスト
      mockReq.query = {};

      // テスト対象のハンドラー関数を実行
      await handler(mockReq, mockRes);

      // エラーレスポンスの検証
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('ジョブIDが必要です'),
          success: false
        })
      );
    });

    it('認証トークンがない場合は401エラーを返す', async () => {
      // 認証ヘッダーなしのリクエスト
      mockReq.headers = {};

      // テスト対象のハンドラー関数を実行
      await handler(mockReq, mockRes);

      // エラーレスポンスの検証
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('認証が必要です'),
          success: false
        })
      );
    });

    it('無効な認証トークンの場合は401エラーを返す', async () => {
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
          error: expect.stringContaining('無効な認証トークンです'),
          success: false
        })
      );
    });

    it('期限切れの認証トークンの場合は401エラーを返す', async () => {
      // 期限切れトークンを持つリクエスト
      mockReq.headers.authorization = 'Bearer expired-token';

      // KVストアのモックを期限切れトークン用に更新
      getItem.mockImplementation((key) => {
        if (key === 'auth:expired-token') {
          return Promise.resolve({
            userId: mockUserId,
            expires: Date.now() - 1000 // 過去の時間
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
          error: expect.stringContaining('認証トークンの有効期限が切れています'),
          success: false
        })
      );
    });

    it('存在しないジョブIDの場合は404エラーを返す', async () => {
      // 存在しないジョブID
      mockReq.query.jobId = 'non-existent-job';

      // ジョブが見つからない
      getJob.mockResolvedValue(null);

      // テスト対象のハンドラー関数を実行
      await handler(mockReq, mockRes);

      // エラーレスポンスの検証
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('指定されたジョブが見つかりません'),
          success: false
        })
      );
    });

    it('他のユーザーのジョブにアクセスしようとした場合は403エラーを返す', async () => {
      // 別ユーザーのジョブ
      const mockJob = {
        id: mockJobId,
        userId: 'different-user-id', // ログインユーザーと異なるID
        status: 'processing',
        progress: 50,
        created: new Date().toISOString(),
        updated: new Date().toISOString()
      };

      // モック実装
      getJob.mockResolvedValue(mockJob);

      // テスト対象のハンドラー関数を実行
      await handler(mockReq, mockRes);

      // エラーレスポンスの検証
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('このリソースにアクセスする権限がありません'),
          success: false
        })
      );
    });

    it('サーバーエラーが発生した場合は500エラーを返す', async () => {
      // モックでエラーをスロー
      getJob.mockRejectedValue(new Error('データベース接続エラー'));

      // テスト対象のハンドラー関数を実行
      await handler(mockReq, mockRes);

      // エラーレスポンスの検証
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('サーバーエラーが発生しました'),
          success: false
        })
      );
    });
  });
});