// lib/email-service.js - メール送信機能（SendGridとResendの両方に対応）

const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'resend'; // 'sendgrid' または 'resend'

/**
 * メール送信サービスインターフェース
 * 環境変数EMAIL_PROVIDERに基づいて適切なサービスを使用
 */
export const emailService = {
  /**
   * PDFファイルを添付してメールを送信
   *
   * @param {Object} options - メール送信オプション
   * @param {string} options.to - 宛先メールアドレス
   * @param {string} options.subject - メール件名
   * @param {string} options.text - プレーンテキスト本文
   * @param {string} options.html - HTML本文（任意）
   * @param {Object} options.pdfInfo - PDF情報
   * @param {string} options.pdfInfo.url - PDFのURL
   * @param {string} options.pdfInfo.fileName - PDFのファイル名
   * @returns {Promise<Object>} - 送信結果
   */
  async sendPdfEmail(options) {
    try {
      if (EMAIL_PROVIDER === 'sendgrid') {
        return await sendWithSendGrid(options);
      } else {
        return await sendWithResend(options);
      }
    } catch (error) {
      console.error(`Failed to send email using ${EMAIL_PROVIDER}:`, error);
      throw new Error('メール送信に失敗しました');
    }
  }
};

/**
 * SendGridでメール送信
 * @param {Object} options - メールオプション
 */
async function sendWithSendGrid(options) {
  try {
    // 初回利用時にSendGridをインポート
    const sgMail = await import('@sendgrid/mail').then(module => module.default);
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    // PDF添付データを準備
    let pdfAttachment;
    if (options.pdfInfo.content) {
        // Base64コンテンツが提供されている場合
        pdfAttachment = {
            filename: options.pdfInfo.fileName,
            content: options.pdfInfo.content, // Base64文字列をそのまま使用
            type: 'application/pdf',
            disposition: 'attachment'
        };
    } else if (options.pdfInfo.url) {
        // URLが提供されている場合（従来の処理）
        pdfAttachment = await fetchPdfAsAttachment(options.pdfInfo.url, options.pdfInfo.fileName);
    } else {
        throw new Error('PDF source (content or url) not provided in pdfInfo.');
    }

    const msg = {
      to: options.to,
      from: process.env.EMAIL_FROM || 'noreply@example.com',
      subject: options.subject,
      text: options.text,
      html: options.html || options.text.replace(/\n/g, '<br>'),
      attachments: [pdfAttachment]
    };

    return await sgMail.send(msg);
  } catch (error) {
    console.error('SendGrid error:', error);
    throw error;
  }
}

/**
 * Resendでメール送信
 * @param {Object} options - メールオプション
 */
async function sendWithResend(options) {
  try {
    // 初回利用時にResendをインポート
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    // PDF添付データを準備
    let attachmentData;
    if (options.pdfInfo.content) {
        // Base64コンテンツが提供されている場合
         attachmentData = {
             filename: options.pdfInfo.fileName,
             content: options.pdfInfo.content // ResendはBase64文字列を直接受け付ける
         };
    } else if (options.pdfInfo.url) {
        // URLが提供されている場合（従来の処理）
        const fetchedAttachment = await fetchPdfAsAttachment(options.pdfInfo.url, options.pdfInfo.fileName);
         attachmentData = {
             filename: fetchedAttachment.filename,
             content: fetchedAttachment.content // fetchPdfAsAttachmentはBase64文字列を返す
         };
    } else {
         throw new Error('PDF source (content or url) not provided in pdfInfo.');
    }

    return await resend.emails.send({
      from: process.env.EMAIL_FROM || 'noreply@example.com',
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html || options.text.replace(/\n/g, '<br>'),
      attachments: [attachmentData] // 準備した添付データを使用
    });
  } catch (error) {
    console.error('Resend error:', error);
    throw error;
  }
}

/**
 * URLからPDFをフェッチして添付ファイル形式に変換
 * @param {string} url - PDFのURL
 * @param {string} fileName - PDFのファイル名
 */
async function fetchPdfAsAttachment(url, fileName) {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();

  return {
    filename: fileName,
    content: Buffer.from(buffer).toString('base64'),
    type: 'application/pdf',
    disposition: 'attachment'
  };
}