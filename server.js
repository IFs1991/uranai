const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const PORT = 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8', // UTF-8を指定
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  console.log(`リクエスト: ${req.method} ${req.url}`);

  try {
    // URLデコードとパス正規化
    let decodedUrl = decodeURIComponent(req.url);
    let requestedPath = decodedUrl.split('?')[0]; // クエリパラメータを除去
    let filePath = path.normalize(path.join(__dirname, requestedPath)); // __dirname基準で絶対パス化

    // ルートパスのリクエストはindex.htmlに
    if (requestedPath === '/') {
      filePath = path.join(__dirname, 'index.html');
    }

    // ディレクトリトラバーサル攻撃を防ぐ
    if (!filePath.startsWith(__dirname)) {
        console.error(`不正なパスへのアクセス試行: ${requestedPath}`);
        res.writeHead(403); // Forbidden
        res.end('Forbidden');
        return;
    }

    // ファイルの存在確認
    try {
        await fs.access(filePath);
    } catch (err) {
        console.error(`ファイルが見つかりません: ${filePath}`);
        res.writeHead(404);
        res.end(`File not found: ${filePath}`);
        return;
    }

    // ファイル情報を取得 (ディレクトリかファイルか)
    const stats = await fs.stat(filePath);
    if (stats.isDirectory()) {
        // ディレクトリの場合はindex.htmlを探す (もし許可するなら)
        // 今回はディレクトリへのアクセスは許可しない
        console.warn(`ディレクトリへのアクセス試行: ${filePath}`);
        res.writeHead(403); // Forbidden
        res.end('Access to directories is forbidden.');
        return;
    }

    // ファイルの拡張子を取得
    const extname = path.extname(filePath).toLowerCase(); // 小文字に統一

    // Content-Typeを設定
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    // ファイルを読み込む
    const content = await fs.readFile(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);

  } catch (err) {
    console.error('サーバー処理エラー:', err);
    // エラーの場合でも最低限のレスポンスを返す
    // Note: ヘッダーが既に送信されている可能性があるため、チェックする
    if (!res.headersSent) {
        res.writeHead(500);
    }
    if (!res.writableEnded) {
       res.end('Internal Server Error');
    }
  }
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`エラー: ポート ${PORT} は既に使用されています。`);
        console.error('他のプロセスがポートを使用しているか、以前のサーバーが終了していない可能性があります。');
        // ポート番号を変更して再試行するか、プロセスを終了するようにユーザーに促す
        // 例: process.exit(1); // エラーで終了する場合
    } else {
        console.error('サーバーエラー:', err);
    }
});


server.listen(PORT, () => {
  console.log(`サーバーが起動しました: http://localhost:${PORT}`);
  console.log('停止するには Ctrl+C を押してください。');
});