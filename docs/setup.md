# 初回セットアップ

HTML共有くんは、HTMLとレビュー状態をこのPCへ保存し、Tailscale ServeでTailnet内へ公開します。AWSアカウントや外部ホスティングは必要ありません。

## 必要なもの

- Node.js 22以降
- Tailscaleがインストール済みで、このPCとスマホが同じTailnetへ接続済み
- Claude CodeまたはCodex（任意）

## インストール

```bash
git clone https://github.com/Sunwood-ai-labs/html-share-tailscale.git
cd html-share-tailscale
npm install
npm run build
npm link
cp html-share.config.example.yaml html-share.config.yaml
```

Windowsでは `copy html-share.config.example.yaml html-share.config.yaml` でも構いません。

## 設定

`html-share.config.yaml` の次の値を、自分のTailnetに合わせます。

- `server.publicUrl`: Tailscale Serveで使うHTTPS URL
- `server.tailscale.hostname`: `publicUrl` と同じ `*.ts.net` ホスト名
- `server.tailscale.httpsPort`: ServeのHTTPSポート
- `content.roots`: 共有を許可するローカルディレクトリ
- `content.pages`: 最初から一覧へ出すHTML

`server.host` は `127.0.0.1` のままにしてください。HTTPサーバーをLANへ直接バインドせず、Tailscale Serveだけを入口にします。

## 起動とTailscale Serve

まずページをビルドしてローカルサイトへ反映します。

```bash
html-share publish
```

別のターミナルでローカルサーバーを起動します。

```bash
html-share serve
```

さらに別のターミナルで、設定値どおりのTailscale Serveを追加します。

```bash
html-share tailscale serve
```

または、Tailscale CLIを直接使う場合は次の形です。

```bash
tailscale serve --bg --https=9222 http://127.0.0.1:4311
```

既存のServe設定を使っている場合は、同じポートの転送先が `http://127.0.0.1:4311` になっていることだけ確認してください。`tailscale serve reset` や Funnel は実行しません。

スマホでは、次のURLをTailscale接続中のSafariで開きます。

```text
https://<tailnet-hostname>:<https-port>/app/index.html
```

## ページを追加する

共有許可ディレクトリ内のHTMLを登録し、再公開します。

```bash
html-share page add reports/today.html --title "今日のレポート"
html-share publish
```

一覧は設定済みの `content.pages` から生成されます。Codexスレッドを自動で一覧化するものではないため、スレッドをHTML化した場合はそのHTMLを登録してください。

## レビューとインボックス

`/mobile` と `/inbox` は同じローカルレビューAPIを使います。

```bash
html-share review inbox
html-share review push --session "<session-id>"
```

レビュー状態は `server.dataDir`（既定では `.html-share/data`）に保存されます。ペアリングコードやクラウド鍵は使いません。

## 動作確認

```bash
curl http://127.0.0.1:4311/api/health
curl -I https://<tailnet-hostname>:<https-port>/app/index.html
```

最後に、スマホの実ブラウザで一覧、個別ページ、インボックスを開いて確認してください。
