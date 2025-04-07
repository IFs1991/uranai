# Vercel Blob・KV・メール送信設定ガイド

このガイドでは、ライフサイクル・ポテンシャル占術サービスにおけるPDF保存とメール送信機能の設定方法を説明します。

## 前提条件

- Vercelアカウント
- SendGridアカウント または Resendアカウント (メール送信用)
- Node.js v18以上

## 1. 必要なモジュールのインストール

```bash
# Vercel Blob・KV関連
npm install @vercel/blob @vercel/kv

# メール送信関連（どちらか一方または両方）
npm install @sendgrid/mail  # SendGrid用
npm install resend  # Resend用
```

## 2. Vercelプロジェクト設定

### Vercel Blobの設定

1. Vercelダッシュボードにログイン
2. プロジェクトの「Storage」タブを選択
3. 「Connect Storage」をクリック
4. 「Blob」を選択し、指示に従ってストアを作成
5. 作成後、環境変数が自動的にプロジェクトに追加されます：
   - `BLOB_READ_WRITE_TOKEN`
   - `VERCEL_BLOB_STORE_URL`

### Vercel KVの設定

1. Vercelダッシュボードにログイン
2. プロジェクトの「Storage」タブを選択
3. 「Connect Storage」をクリック
4. 「KV」を選択し、指示に従ってデータベースを作成
5. 作成後、環境変数が自動的にプロジェクトに追加されます：
   - `KV_URL`
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
   - `KV_REST_API_READ_ONLY_TOKEN`

## 3. メールサービスの設定

### SendGridを使用する場合

1. [SendGrid](https://sendgrid.com/)にアカウント登録
2. APIキーを作成：
   - ダッシュボードから「Settings」→「API Keys」を選択
   - 「Create API Key」をクリック
   - 権限は「Mail Send」に設定
   - 作成されたAPIキーを保存（一度しか表示されません）
3. 送信元ドメインの設定：
   - 「Settings」→「Sender Authentication」を選択
   - ドメイン認証を設定
4. Vercelの環境変数に追加：
   - `SENDGRID_API_KEY=[作成したAPIキー]`
   - `EMAIL_PROVIDER=sendgrid`
   - `EMAIL_FROM=[認証済みのメールアドレス]`

### Resendを使用する場合（Vercel推奨）

1. [Resend](https://resend.com/)にアカウント登録
2. APIキーを作成：
   - ダッシュボードから「API Keys」を選択
   - 「Create API Key」をクリック
   - キーの名前を入力し、作成
   - 作成されたAPIキーを保存
3. 送信元ドメインの設定：
   - 「Domains」を選択
   - 「Add Domain」をクリック
   - ドメイン認証の手順に従う
4. Vercelの環境変数に追加：
   - `RESEND_API_KEY=[作成したAPIキー]`
   - `EMAIL_PROVIDER=resend`
   - `EMAIL_FROM=[認証済みのメールアドレス]`

## 4. Vercel環境変数の設定

Vercelダッシュボードで以下の環境変数を設定します：

```
GEMINI_API_KEY=...
PAYJP_SECRET_KEY=...
PAYJP_PUBLIC_KEY=...
BLOB_READ_WRITE_TOKEN=...
VERCEL_BLOB_STORE_URL=...
KV_URL=...
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
KV_REST_API_READ_ONLY_TOKEN=...
EMAIL_PROVIDER=resend  # または 'sendgrid'
EMAIL_FROM=noreply@example.com
RESEND_API_KEY=...  # または SENDGRID_API_KEY=...
```

## 5. ローカル開発時の設定

ローカル開発時には、プロジェクトルートに `.env.local` ファイルを作成し、上記の環境変数を設定します。

```bash
# .env.localファイルの作成
cp .env.example .env.local
# エディタで開いて各値を設定
```

## 6. デプロイとテスト

1. 変更をコミットしてVercelにデプロイ
2. デプロイ後、以下をテスト：
   - PDF生成とVercel Blobへの保存
   - メール送信機能
   - データのVercel KVへの保存と取得

## トラブルシューティング

### Vercel Blobの問題

- エラー「Failed to upload to Blob」: `BLOB_READ_WRITE_TOKEN`の値を確認
- ファイルが30日以内に消える: デフォルトの有効期限は30日。自動更新が必要な場合は定期的に新しいバージョンを保存

### メール送信の問題

- メールが届かない: 認証済みドメインからの送信か確認
- スパムフォルダに入る: SPF/DKIM/DMARCレコードの設定を確認
- 「Invalid API Key」エラー: APIキーの値と形式を確認

### Vercel KVの問題

- 接続エラー: 環境変数の値を確認
- データが見つからない: キー命名規則が一致しているか確認

## 注意事項

- SendGridとResendは無料枠がありますが、大量のメール送信には料金がかかります
- Vercel BlobとKVも無料枠がありますが、ストレージと読み書き回数に制限があります
- PDFのサイズが大きい場合、メール送信に失敗する可能性があります
- 実運用時は予期せぬエラーに備えたエラーハンドリングとログを実装してください