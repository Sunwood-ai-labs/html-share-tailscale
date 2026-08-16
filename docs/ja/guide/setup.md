# 初回セットアップ

[ドキュメント入口](../index.md) · [English](../../guide/setup.md)

HTML Share — TailscaleはHTMLとレビュー状態をホストPCへ保存します。Tailscale ServeでTailnet内のHTTPS入口からローカルサーバーへ転送するため、AWSアカウントや外部ホスティングは必要ありません。

## 必要なもの

- Node.js 22以降
- ホストPCにTailscaleがインストール済みであること
- スマホとホストPCが同じTailnetへ接続済みであること
- Claude CodeやCodexなどのエージェントは任意

## インストール

~~~bash
git clone https://github.com/Sunwood-ai-labs/html-share-tailscale.git
cd html-share-tailscale
npm ci
npm run build
npm link
cp html-share.config.example.yaml html-share.config.yaml
cp .env.example .env
~~~

Windows PowerShellでは、`cp` の代わりに `Copy-Item` を使います。

## 個人用の値を設定する

実際のTailnetホスト名・URLは `.env` に置きます。`.env` はGitで無視されます。YAMLはページ一覧と共有rootを管理し、環境変数がサーバーとTailnetの値を上書きします。

~~~dotenv
HTML_SHARE_PUBLIC_URL=https://your-device.example.ts.net:9222
HTML_SHARE_TAILSCALE_HOSTNAME=your-device.example.ts.net
HTML_SHARE_TAILSCALE_HTTPS_PORT=9222
~~~

ローカルサーバーはループバックのままにしてください。

~~~yaml
server:
  host: 127.0.0.1
~~~

実際のホスト名、トークン、IP、業務データを追跡対象のサンプルやドキュメントへ書かないでください。

## 起動する

公開処理、ローカルサーバー、Serve設定を別々のターミナルで実行します。

~~~bash
html-share publish
html-share serve
html-share tailscale serve
~~~

`html-share serve` は `127.0.0.1` だけで待ち受けます。`html-share tailscale serve` は設定したHTTPSポートからローカルoriginへ転送するTailscale CLIを呼び出します。

Tailnet接続中の端末で、次を開きます。

~~~text
https://your-device.example.ts.net:9222/app/index.html
~~~

このアプリではTailscale Funnelを使いません。

## ページを追加する

~~~bash
html-share page add reports/today.html --title "今日のレポート"
html-share publish
~~~

対象HTMLは設定した `content.roots` の内側に置いてください。エージェントのスレッドを自動収集するのではなく、共有したいHTMLを登録して使います。

## レビューの受け渡し

- `/mobile` でPC側の確認依頼をスマホへ送る
- `/inbox` でスマホから置いた依頼をエージェントが引き取る
- CLIだけで使う場合は `html-share review inbox` と `html-share review complete <id...>` を使う

レビュー状態は既定で `server.dataDir`（`.html-share/data`）へ保存されます。

## 確認

~~~bash
curl http://127.0.0.1:4311/api/health
curl -I https://your-device.example.ts.net:9222/app/index.html
npm run verify
~~~

最初のリクエストはローカルプロセスを、2つ目はTailnet接続中の実端末からHTTPS経路を確認します。
