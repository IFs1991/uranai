/**
 * メール送信サービスのテスト
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { emailService } from '../../lib/email-service.js';

// SendGridのモック
vi.mock('@sendgrid/mail', () => ({
  default: {
    setApiKey: vi.fn(),
    send: vi.fn().mockResolvedValue([
      { statusCode: 202 },
      { headers: { 'x-message-id': 'test-message-id' } }
    ])
  }
}));

// Resendのモック
vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor() {
      this.emails = {
        send: vi.fn().mockResolvedValue({
          id: 'test-resend-id',
          from: 'noreply@example.com',
          to: 'test@example.com',
          status: 'sent'
        })
      };
    }
  }
}));

// fetchのモック
global.fetch = vi.fn().mockImplementation(async (url) => {
  if (url === 'https://example.com/test.pdf') {
    return {
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(10) // モック用のバッファ
    };
  }
  throw new Error('Network error');
});

// Bufferのモック
vi.mock('buffer', () => ({
  Buffer: {
    from: vi.fn().mockImplementation((data) => ({
      toString: () => 'base64-encoded-content'
    }))
  }
}));

describe('メール送信サービス', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // テスト前にモックリセット
    vi.clearAllMocks();

    // 環境変数をリセット
    process.env = { ...originalEnv };
    // デフォルトでResendを使用
    process.env.EMAIL_PROVIDER = 'resend';
    process.env.RESEND_API_KEY = 'test-resend-api-key';
    process.env.SENDGRID_API_KEY = 'test-sendgrid-api-key';
    process.env.EMAIL_FROM = 'test@example.com';
  });

  afterEach(() => {
    // 環境変数を元に戻す
    process.env = originalEnv;
  });

  describe('sendPdfEmail 関数 (Resend)', () => {
    it('正常系：Base64コンテンツからメール送信が実行される', async () => {
      // テスト用オプション
      const options = {
        to: 'recipient@example.com',
        subject: 'テストメール',
        text: 'これはテストメールです',
        html: '<p>これはテストメールです</p>',
        pdfInfo: {
          content: 'base64-pdf-content',
          fileName: 'test.pdf'
        }
      };

      // メール送信実行
      const result = await emailService.sendPdfEmail(options);

      // Resend APIが呼び出されることを確認
      const { Resend } = await import('resend');
      const resendInstance = new Resend();

      expect(resendInstance.emails.send).toHaveBeenCalledWith({
        from: 'test@example.com', // 環境変数から
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: [
          {
            content: options.pdfInfo.content,
            filename: options.pdfInfo.fileName
          }
        ]
      });

      // 返り値が正しい形式
      expect(result).toEqual({
        id: 'test-resend-id',
        from: 'noreply@example.com',
        to: 'test@example.com',
        status: 'sent'
      });
    });

    it('URLからPDFを取得してメール送信が実行される', async () => {
      // テスト用オプション
      const options = {
        to: 'recipient@example.com',
        subject: 'テストメール',
        text: 'これはテストメールです',
        pdfInfo: {
          url: 'https://example.com/test.pdf',
          fileName: 'test.pdf'
        }
      };

      // メール送信実行
      await emailService.sendPdfEmail(options);

      // fetchが呼び出されることを確認
      expect(global.fetch).toHaveBeenCalledWith('https://example.com/test.pdf');

      // Resend APIが呼び出されることを確認
      const { Resend } = await import('resend');
      const resendInstance = new Resend();

      // Base64エンコードされたデータが添付されていることを確認
      expect(resendInstance.emails.send).toHaveBeenCalledWith(expect.objectContaining({
        attachments: [
          expect.objectContaining({
            filename: 'test.pdf',
            content: expect.any(String)
          })
        ]
      }));
    });

    it('HTMLが指定されていない場合はテキストからHTMLが生成される', async () => {
      // HTMLなしのオプション
      const options = {
        to: 'recipient@example.com',
        subject: 'テストメール',
        text: 'これは\nテスト\nメールです',
        pdfInfo: {
          content: 'base64-pdf-content',
          fileName: 'test.pdf'
        }
      };

      // メール送信実行
      await emailService.sendPdfEmail(options);

      // Resend APIが呼び出されることを確認
      const { Resend } = await import('resend');
      const resendInstance = new Resend();

      expect(resendInstance.emails.send).toHaveBeenCalledWith(expect.objectContaining({
        html: 'これは<br>テスト<br>メールです', // 改行がbrタグに変換される
      }));
    });
  });

  describe('sendPdfEmail 関数 (SendGrid)', () => {
    beforeEach(() => {
      // SendGridを使用するように環境変数を設定
      process.env.EMAIL_PROVIDER = 'sendgrid';
    });

    it('正常系：Base64コンテンツからメール送信が実行される', async () => {
      // テスト用オプション
      const options = {
        to: 'recipient@example.com',
        subject: 'テストメール',
        text: 'これはテストメールです',
        html: '<p>これはテストメールです</p>',
        pdfInfo: {
          content: 'base64-pdf-content',
          fileName: 'test.pdf'
        }
      };

      // メール送信実行
      const result = await emailService.sendPdfEmail(options);

      // SendGrid APIが正しく設定・呼び出されることを確認
      const sgMail = await import('@sendgrid/mail').then(module => module.default);

      expect(sgMail.setApiKey).toHaveBeenCalledWith('test-sendgrid-api-key');
      expect(sgMail.send).toHaveBeenCalledWith({
        to: options.to,
        from: 'test@example.com', // 環境変数から
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: [
          {
            content: options.pdfInfo.content,
            filename: options.pdfInfo.fileName,
            type: 'application/pdf',
            disposition: 'attachment'
          }
        ]
      });

      // 返り値が正しい形式
      expect(result).toEqual([
        { statusCode: 202 },
        { headers: { 'x-message-id': 'test-message-id' } }
      ]);
    });

    it('URLからPDFを取得してメール送信が実行される', async () => {
      // テスト用オプション
      const options = {
        to: 'recipient@example.com',
        subject: 'テストメール',
        text: 'これはテストメールです',
        pdfInfo: {
          url: 'https://example.com/test.pdf',
          fileName: 'test.pdf'
        }
      };

      // メール送信実行
      await emailService.sendPdfEmail(options);

      // fetchが呼び出されることを確認
      expect(global.fetch).toHaveBeenCalledWith('https://example.com/test.pdf');

      // SendGrid APIが呼び出されることを確認
      const sgMail = await import('@sendgrid/mail').then(module => module.default);

      // Base64エンコードされたデータが添付されていることを確認
      expect(sgMail.send).toHaveBeenCalledWith(expect.objectContaining({
        attachments: [
          expect.objectContaining({
            filename: 'test.pdf',
            content: expect.any(String),
            type: 'application/pdf',
            disposition: 'attachment'
          })
        ]
      }));
    });
  });

  describe('エラーハンドリング', () => {
    it('PDFのURLとコンテンツの両方が欠けている場合はエラーを投げる', async () => {
      // 不正なオプション（PDFソースがない）
      const options = {
        to: 'recipient@example.com',
        subject: 'テストメール',
        text: 'これはテストメールです',
        pdfInfo: {
          fileName: 'test.pdf'
          // URLもcontentも指定なし
        }
      };

      // エラーがスローされることを確認
      await expect(emailService.sendPdfEmail(options)).rejects.toThrow(/PDF source/);
    });

    it('SendGrid APIがエラーを返した場合はエラーが伝播する', async () => {
      // SendGridを使用
      process.env.EMAIL_PROVIDER = 'sendgrid';

      // SendGridのエラーをモック
      const sgMail = await import('@sendgrid/mail').then(module => module.default);
      sgMail.send.mockRejectedValueOnce(new Error('SendGrid API error'));

      // コンソールエラーをモック
      console.error = vi.fn();

      // テスト用オプション
      const options = {
        to: 'recipient@example.com',
        subject: 'テストメール',
        text: 'これはテストメールです',
        pdfInfo: {
          content: 'base64-pdf-content',
          fileName: 'test.pdf'
        }
      };

      // エラーがスローされることを確認
      await expect(emailService.sendPdfEmail(options)).rejects.toThrow('メール送信に失敗しました');

      // エラーがログ出力されることを確認
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send email using sendgrid:'),
        expect.any(Error)
      );
    });

    it('Resend APIがエラーを返した場合はエラーが伝播する', async () => {
      // Resendを使用
      process.env.EMAIL_PROVIDER = 'resend';

      // Resendのエラーをモック
      const { Resend } = await import('resend');
      const mockInstance = new Resend();
      mockInstance.emails.send.mockRejectedValueOnce(new Error('Resend API error'));

      // コンソールエラーをモック
      console.error = vi.fn();

      // テスト用オプション
      const options = {
        to: 'recipient@example.com',
        subject: 'テストメール',
        text: 'これはテストメールです',
        pdfInfo: {
          content: 'base64-pdf-content',
          fileName: 'test.pdf'
        }
      };

      // エラーがスローされることを確認
      await expect(emailService.sendPdfEmail(options)).rejects.toThrow('メール送信に失敗しました');

      // エラーがログ出力されることを確認
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send email using resend:'),
        expect.any(Error)
      );
    });

    it('URLからのPDF取得に失敗した場合はエラーが伝播する', async () => {
      // fetchエラーをモック
      global.fetch.mockRejectedValueOnce(new Error('Failed to fetch PDF'));

      // テスト用オプション
      const options = {
        to: 'recipient@example.com',
        subject: 'テストメール',
        text: 'これはテストメールです',
        pdfInfo: {
          url: 'https://example.com/error.pdf',
          fileName: 'test.pdf'
        }
      };

      // エラーがスローされることを確認
      await expect(emailService.sendPdfEmail(options)).rejects.toThrow('メール送信に失敗しました');
    });
  });
});