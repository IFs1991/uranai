/**
 * PDFダウンロードAPIのテスト
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handler } from '../../api/download-pdf';
import fs from 'fs';
import path from 'path';

// KVストアのモック
vi.mock('../../lib/kvStore', () => ({
  getItem: vi.fn()
}));

// jobStoreのモック
vi.mock('../../api/jobStore', () => ({
  getJob: vi.fn()
}));

// fs モジュールのモック
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  createReadStream: vi.fn(),
  statSync: vi.fn()
}));

// path モジュールのモック
vi.mock('path', () => ({
  join: vi.fn()
}));

import { getItem } from '../../lib/kvStore';
import { getJob } from '../../api/jobStore';

describe('download-pdf.js - PDFダウンロードAPI', () => {
  // モックデータ
  const mockUserId = 'test-user-id';
  const mockJobId = 'job-123456';
  const mockFilePath = '/storage/pdfs/job-123456.pdf';

  // モックストリーム
  const mockReadStream = {
    pipe: vi.fn().mockImplementation(function() { return this; }),
    on: vi.fn().mockImplementation(function(event, callback) {
      if (event === 'finish') {
        callback();
      }
      return this;
    })
  };

  // モックリクエスト/レスポンスオブジェクト
  let mockReq;
  let mockRes;

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
      json: vi.fn(),
      setHeader: vi.fn(),
      attachment: vi.fn().mockReturnThis(),
      end: vi.fn()
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

    // ファイルパスのモック
    path.join.mockImplementation((...args) => args.join('/'));

    // ファイル統計情報のモック
    fs.statSync.mockReturnValue({
      size: 12345, // ファイルサイズ（バイト）
      isFile: () => true
    });

    // モックのリセット
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('正常系のPDFダウンロード', () => {
    it('完了したジョブのPDFを正常にダウンロードできる', async () => {
      // 完了したジョブ
      const mockJob = {
        id: mockJobId,
        userId: mockUserId,
        status: 'completed',
        progress: 100,
        created: new Date().toISOString(),
        completed: new Date().toISOString(),
        filePath: mockFilePath,
        horoscopeType: 'yearly',
        userData: {
          name: '山田太郎',
          birthDate: '1990-01-01'
        }
      };

      // モック実装
      getJob.mockResolvedValue(mockJob);
      fs.existsSync.mockReturnValue(true);
      fs.createReadStream.mockReturnValue(mockReadStream);

      // テスト対象のハンドラー関数を実行
      await handler(mockReq, mockRes);

      // 適切なヘッダーが設定されたことを検証
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Disposition', `attachment; filename="yearly_horoscope.pdf"`);

      // ファイルストリームが正しくパイプされたことを検証
      expect(fs.createReadStream).toHaveBeenCalledWith(mockFilePath);
      expect(mockReadStream.pipe).toHaveBeenCalledWith(mockRes);
    });

    it('カスタムファイル名が指定された場合に適切なファイル名でダウンロードできる', async () => {
      // 完了したジョブ
      const mockJob = {
        id: mockJobId,
        userId: mockUserId,
        status: 'completed',
        progress: 100,
        created: new Date().toISOString(),
        completed: new Date().toISOString(),
        filePath: mockFilePath,
        horoscopeType: 'monthly',
        userData: {
          name: '山田太郎',
          birthDate: '1990-01-01'
        }
      };

      // カスタムファイル名付きリクエスト
      mockReq.query.filename = '山田太郎_月間占い.pdf';

      // モック実装
      getJob.mockResolvedValue(mockJob);
      fs.existsSync.mockReturnValue(true);
      fs.createReadStream.mockReturnValue(mockReadStream);

      // テスト対象のハンドラー関数を実行
      await handler(mockReq, mockRes);

      // カスタムファイル名が設定されたことを検証
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Disposition', `attachment; filename="山田太郎_月間占い.pdf"`);
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
        status: 'completed',
        progress: 100,
        filePath: mockFilePath,
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

    it('未完了のジョブのPDFをダウンロードしようとした場合は400エラーを返す', async () => {
      // 処理中のジョブ
      const mockJob = {
        id: mockJobId,
        userId: mockUserId,
        status: 'processing', // 完了していない
        progress: 75,
        created: new Date().toISOString(),
        updated: new Date().toISOString()
      };

      // モック実装
      getJob.mockResolvedValue(mockJob);

      // テスト対象のハンドラー関数を実行
      await handler(mockReq, mockRes);

      // エラーレスポンスの検証
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('PDFはまだ生成中です'),
          success: false
        })
      );
    });

    it('PDFファイルが存在しない場合は404エラーを返す', async () => {
      // 完了したジョブだがファイルがない
      const mockJob = {
        id: mockJobId,
        userId: mockUserId,
        status: 'completed',
        progress: 100,
        filePath: mockFilePath,
        created: new Date().toISOString(),
        completed: new Date().toISOString()
      };

      // モック実装
      getJob.mockResolvedValue(mockJob);
      fs.existsSync.mockReturnValue(false); // ファイルが存在しない

      // テスト対象のハンドラー関数を実行
      await handler(mockReq, mockRes);

      // エラーレスポンスの検証
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('PDFファイルが見つかりません'),
          success: false
        })
      );
    });

    it('ストリーミング中にエラーが発生した場合は500エラーを返す', async () => {
      // 完了したジョブ
      const mockJob = {
        id: mockJobId,
        userId: mockUserId,
        status: 'completed',
        progress: 100,
        filePath: mockFilePath,
        created: new Date().toISOString(),
        completed: new Date().toISOString()
      };

      // エラーを発生させるストリーム
      const errorStream = {
        pipe: vi.fn().mockImplementation(function() { return this; }),
        on: vi.fn().mockImplementation(function(event, callback) {
          if (event === 'error') {
            callback(new Error('ストリーミングエラー'));
          }
          return this;
        })
      };

      // モック実装
      getJob.mockResolvedValue(mockJob);
      fs.existsSync.mockReturnValue(true);
      fs.createReadStream.mockReturnValue(errorStream);

      // テスト対象のハンドラー関数を実行
      await handler(mockReq, mockRes);

      // エラーストリームのイベントが登録されていることを確認
      expect(errorStream.on).toHaveBeenCalledWith('error', expect.any(Function));

      // エラーレスポンスの検証
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('ファイルの送信中にエラーが発生しました'),
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