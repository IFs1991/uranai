/**
 * ストレージライブラリのテスト
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  uploadPdf,
  downloadPdf,
  listUserFiles,
  deleteFile,
  getFileMetadata,
  getBlobClient
} from '../../lib/storage';

describe('storage.js - ストレージライブラリ', () => {
  // モックのBlobServiceClientとContainerClient
  let mockBlobServiceClient;
  let mockContainerClient;
  let mockBlockBlobClient;

  beforeEach(() => {
    // Azureストレージクライアントのモック作成
    mockBlockBlobClient = {
      upload: vi.fn().mockResolvedValue({ etag: 'mock-etag' }),
      download: vi.fn().mockResolvedValue({
        readableStreamBody: {
          read: vi.fn().mockReturnValue(Buffer.from('mock pdf content'))
        }
      }),
      delete: vi.fn().mockResolvedValue({}),
      getProperties: vi.fn().mockResolvedValue({
        contentLength: 1024,
        lastModified: new Date(),
        metadata: { userId: 'user123' }
      })
    };

    mockContainerClient = {
      getBlockBlobClient: vi.fn().mockReturnValue(mockBlockBlobClient),
      listBlobsFlat: vi.fn().mockReturnValue({
        byPage: vi.fn().mockReturnValue([
          {
            segment: {
              blobItems: [
                { name: 'user123/file1.pdf', properties: { createdOn: new Date() } },
                { name: 'user123/file2.pdf', properties: { createdOn: new Date() } }
              ]
            }
          }
        ])
      })
    };

    mockBlobServiceClient = {
      getContainerClient: vi.fn().mockReturnValue(mockContainerClient)
    };

    // 環境変数のモック
    vi.stubEnv('AZURE_STORAGE_CONNECTION_STRING', 'mock-connection-string');
    vi.stubEnv('STORAGE_CONTAINER_NAME', 'pdfs');

    // モックの注入
    vi.mock('@azure/storage-blob', () => {
      return {
        BlobServiceClient: {
          fromConnectionString: vi.fn().mockReturnValue(mockBlobServiceClient)
        }
      };
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  describe('getBlobClient', () => {
    it('正常系: 適切なBlobClientを返す', () => {
      // テスト実行
      const result = getBlobClient('user123/test.pdf');

      // 結果検証
      expect(mockBlobServiceClient.getContainerClient).toHaveBeenCalledWith('pdfs');
      expect(mockContainerClient.getBlockBlobClient).toHaveBeenCalledWith('user123/test.pdf');
      expect(result).toBe(mockBlockBlobClient);
    });

    it('エラー処理: 接続文字列が未設定の場合はエラーをスローする', () => {
      // 環境変数の削除
      vi.unstubEnv('AZURE_STORAGE_CONNECTION_STRING');

      // エラーをスローすることを検証
      expect(() => getBlobClient('user123/test.pdf')).toThrow('ストレージ接続文字列が設定されていません');
    });
  });

  describe('uploadPdf', () => {
    it('正常系: PDFデータをアップロードして成功する', async () => {
      // テストデータ
      const userId = 'user123';
      const pdfData = Buffer.from('test pdf content');
      const fileName = 'test.pdf';

      // テスト実行
      const result = await uploadPdf(userId, pdfData, fileName);

      // 結果検証
      expect(mockContainerClient.getBlockBlobClient).toHaveBeenCalledWith('user123/test.pdf');
      expect(mockBlockBlobClient.upload).toHaveBeenCalledWith(pdfData, pdfData.length, {
        blobHTTPHeaders: { blobContentType: 'application/pdf' },
        metadata: { userId: 'user123' }
      });
      expect(result).toEqual({
        success: true,
        fileUrl: expect.stringContaining('user123/test.pdf'),
        etag: 'mock-etag'
      });
    });

    it('エラー処理: アップロード中にエラーが発生した場合は適切に処理する', async () => {
      // アップロードエラーのモック
      mockBlockBlobClient.upload.mockRejectedValue(new Error('アップロードエラー'));

      // テストデータ
      const userId = 'user123';
      const pdfData = Buffer.from('test pdf content');
      const fileName = 'test.pdf';

      // テスト実行とエラー検証
      await expect(uploadPdf(userId, pdfData, fileName)).rejects.toThrow('PDFのアップロードに失敗しました: アップロードエラー');
    });
  });

  describe('downloadPdf', () => {
    it('正常系: PDFデータをダウンロードして成功する', async () => {
      // テストデータ
      const userId = 'user123';
      const fileName = 'test.pdf';

      // テスト実行
      const result = await downloadPdf(userId, fileName);

      // 結果検証
      expect(mockContainerClient.getBlockBlobClient).toHaveBeenCalledWith('user123/test.pdf');
      expect(mockBlockBlobClient.download).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        data: expect.any(Buffer),
        contentType: 'application/pdf'
      });
    });

    it('エラー処理: ファイルが存在しない場合は適切に処理する', async () => {
      // ダウンロードエラーのモック
      mockBlockBlobClient.download.mockRejectedValue({ statusCode: 404 });

      // テストデータ
      const userId = 'user123';
      const fileName = 'notfound.pdf';

      // テスト実行とエラー検証
      await expect(downloadPdf(userId, fileName)).rejects.toThrow('PDFファイルが見つかりません');
    });

    it('エラー処理: その他のエラーが発生した場合は適切に処理する', async () => {
      // ダウンロードエラーのモック
      mockBlockBlobClient.download.mockRejectedValue(new Error('ダウンロードエラー'));

      // テストデータ
      const userId = 'user123';
      const fileName = 'test.pdf';

      // テスト実行とエラー検証
      await expect(downloadPdf(userId, fileName)).rejects.toThrow('PDFのダウンロードに失敗しました: ダウンロードエラー');
    });
  });

  describe('listUserFiles', () => {
    it('正常系: ユーザーのファイル一覧を取得する', async () => {
      // テストデータ
      const userId = 'user123';

      // テスト実行
      const result = await listUserFiles(userId);

      // 結果検証
      expect(mockContainerClient.listBlobsFlat).toHaveBeenCalledWith({
        prefix: 'user123/'
      });
      expect(result).toEqual({
        success: true,
        files: [
          { name: 'file1.pdf', createdAt: expect.any(Date) },
          { name: 'file2.pdf', createdAt: expect.any(Date) }
        ]
      });
    });

    it('エラー処理: ファイル一覧取得中にエラーが発生した場合は適切に処理する', async () => {
      // リストエラーのモック
      mockContainerClient.listBlobsFlat.mockImplementation(() => {
        throw new Error('一覧取得エラー');
      });

      // テストデータ
      const userId = 'user123';

      // テスト実行とエラー検証
      await expect(listUserFiles(userId)).rejects.toThrow('ファイル一覧の取得に失敗しました: 一覧取得エラー');
    });
  });

  describe('deleteFile', () => {
    it('正常系: ファイルの削除に成功する', async () => {
      // テストデータ
      const userId = 'user123';
      const fileName = 'test.pdf';

      // テスト実行
      const result = await deleteFile(userId, fileName);

      // 結果検証
      expect(mockContainerClient.getBlockBlobClient).toHaveBeenCalledWith('user123/test.pdf');
      expect(mockBlockBlobClient.delete).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        message: 'ファイルは正常に削除されました'
      });
    });

    it('エラー処理: 削除中にエラーが発生した場合は適切に処理する', async () => {
      // 削除エラーのモック
      mockBlockBlobClient.delete.mockRejectedValue(new Error('削除エラー'));

      // テストデータ
      const userId = 'user123';
      const fileName = 'test.pdf';

      // テスト実行とエラー検証
      await expect(deleteFile(userId, fileName)).rejects.toThrow('ファイルの削除に失敗しました: 削除エラー');
    });
  });

  describe('getFileMetadata', () => {
    it('正常系: ファイルのメタデータを取得する', async () => {
      // テストデータ
      const userId = 'user123';
      const fileName = 'test.pdf';

      // テスト実行
      const result = await getFileMetadata(userId, fileName);

      // 結果検証
      expect(mockContainerClient.getBlockBlobClient).toHaveBeenCalledWith('user123/test.pdf');
      expect(mockBlockBlobClient.getProperties).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        metadata: {
          size: 1024,
          lastModified: expect.any(Date),
          userId: 'user123'
        }
      });
    });

    it('エラー処理: メタデータ取得中にエラーが発生した場合は適切に処理する', async () => {
      // プロパティ取得エラーのモック
      mockBlockBlobClient.getProperties.mockRejectedValue(new Error('プロパティ取得エラー'));

      // テストデータ
      const userId = 'user123';
      const fileName = 'test.pdf';

      // テスト実行とエラー検証
      await expect(getFileMetadata(userId, fileName)).rejects.toThrow('ファイルのメタデータ取得に失敗しました: プロパティ取得エラー');
    });
  });
});