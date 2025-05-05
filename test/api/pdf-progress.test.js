/**
 * PDF生成進捗確認APIのテスト
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// importの修正：defaultエクスポートに合わせる
import handler from '../../api/pdf-progress/[jobId].js';

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
      },
      // SSE接続終了時のイベントをモック
      on: vi.fn((event, callback) => {
        if (event === 'close') {
          // closeイベントのコールバックを保存
          mockReq.closeCallback = callback;
        }
      })
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
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
    // テスト後にインターバルをクリア
    if (mockReq.closeCallback) {
      mockReq.closeCallback();
    }
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

      // jobStoreをモック
      vi.mock('../../api/jobStore.js', () => ({
        jobStore: {
          [mockJobId]: mockJob
        }
      }));

      // テスト対象のハンドラー関数を実行
      await handler(mockReq, mockRes);

      // SSEのヘッダー設定の検証
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');

      // 接続確立メッセージが送信されることを検証
      expect(mockRes.write).toHaveBeenCalledWith(expect.stringContaining('connected'));

      // 現在の進捗状況が送信されることを検証
      expect(mockRes.write).toHaveBeenCalledWith(expect.stringContaining('progress'));
      expect(mockRes.write).toHaveBeenCalledWith(expect.stringContaining(String(mockJob.progress)));
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
        blobUrl: `https://storage.example.com/pdfs/${mockJobId}.pdf`,
        emailSent: true
      };

      // jobStoreをモック
      vi.mock('../../api/jobStore.js', () => ({
        jobStore: {
          [mockJobId]: mockJob
        }
      }));

      // テスト対象のハンドラー関数を実行
      await handler(mockReq, mockRes);

      // SSEのヘッダー設定の検証
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');

      // 接続確立メッセージが送信されることを検証
      expect(mockRes.write).toHaveBeenCalledWith(expect.stringContaining('connected'));

      // 現在の進捗状況が送信されることを検証
      expect(mockRes.write).toHaveBeenCalledWith(expect.stringContaining('progress'));
      expect(mockRes.write).toHaveBeenCalledWith(expect.stringContaining('100'));

      // 完了メッセージと共にダウンロードURLが送信されることを検証
      // Note: 実際のステータス更新はsetIntervalで行われるが、テストでは直接チェックしない
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

      // jobStoreをモック
      vi.mock('../../api/jobStore.js', () => ({
        jobStore: {
          [mockJobId]: mockJob
        }
      }));

      // テスト対象のハンドラー関数を実行
      await handler(mockReq, mockRes);

      // SSEのヘッダー設定の検証
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');

      // 接続確立メッセージが送信されることを検証
      expect(mockRes.write).toHaveBeenCalledWith(expect.stringContaining('connected'));

      // エラー情報が含まれていることを検証
      expect(mockRes.write).toHaveBeenCalledWith(expect.stringContaining('error'));
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
          error: expect.stringContaining('有効なジョブIDが必要です')
        })
      );
    });

    it('存在しないジョブIDの場合は404エラーを返す', async () => {
      // 存在しないジョブID
      mockReq.query.jobId = 'non-existent-job';

      // jobStoreをモック（空）
      vi.mock('../../api/jobStore.js', () => ({
        jobStore: {}
      }));

      // テスト対象のハンドラー関数を実行
      await handler(mockReq, mockRes);

      // エラーレスポンスの検証
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('ジョブが見つかりません')
        })
      );
    });
  });
});