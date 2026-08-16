<div align="center">
  <img src="assets/brand/html-share-tailscale-header.png" alt="HTML共有くん — Tailnet Rock Edition" width="100%">
  <h1>HTML共有くん — Tailscale版</h1>
  <p>Claude Code・Codex・Cursorなどの成果をTailnet内だけで確認・レビューするHTMLダッシュボード。</p>
</div>

<p align="center">
  <a href="https://github.com/Sunwood-ai-labs/html-share-tailscale/actions/workflows/ci.yml"><img src="https://github.com/Sunwood-ai-labs/html-share-tailscale/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache--2.0-4c6fff.svg" alt="License: Apache-2.0"></a>
</p>

<p align="center"><a href="README.md">English</a> · <a href="README.ja.md">日本語</a></p>

HTML共有くんは、エージェントが作ったHTMLレポートをこのPCへ保存して一覧化し、Tailscale Serve経由でスマホや同じTailnetのPCから確認・返信できるようにします。

このリポジトリは [`minorun365/html-share`](https://github.com/minorun365/html-share) から分岐した独立運用のTailscale版です。AWS、S3、CloudFront、Lambda、外部データベースは前提にしません。

## ✨ できること

- `html-share page add` でHTMLを登録し、ダッシュボードへ反映する
- ページ、既読、スター、レビュー依頼、共有トークンをローカルファイルへ保存する
- ループバックHTTPサーバーをTailscale Serve HTTPSの後ろで動かす
- Tailnet内だけで到達できる期限付き共有リンクを発行する
- PC上のエージェントとスマホの `/mobile`・`/inbox` で依頼や確認を受け渡す

ヘッダーの赤い尻尾は、HTMLがローカル保存からTailnetを通って次の画面へ届く流れを表しています。鳥居のようなゲートはアクセス境界、電光青のノードは非同期の受け渡しです。

## 🚀 まず動かす

### 必要なもの

- Node.js 22以降
- ホストPCにTailscaleがインストール済みで、スマホも同じTailnetへ接続済みであること
- Claude CodeやCodexなどのエージェントは任意。CLI単体でも動作します

### インストール

~~~
git clone https://github.com/Sunwood-ai-labs/html-share-tailscale.git
cd html-share-tailscale
npm ci
npm run build
npm link
cp html-share.config.example.yaml html-share.config.yaml
cp .env.example .env
~~~

Windows PowerShellでは、`cp` の代わりに `Copy-Item html-share.config.example.yaml html-share.config.yaml` と `Copy-Item .env.example .env` を使ってください。

実際のTailnetホスト名とURLは `.env` に書きます。リポジトリでは `.env`・`.env.*`・`html-share.config.yaml`・`.html-share/` を追跡しない設定にしています。ページ一覧や共有rootはYAMLへ、マシン固有の値は環境変数へ分けます。

~~~dotenv
HTML_SHARE_PUBLIC_URL=https://your-device.example.ts.net:9222
HTML_SHARE_TAILSCALE_HOSTNAME=your-device.example.ts.net
HTML_SHARE_TAILSCALE_HTTPS_PORT=9222
~~~

### ダッシュボードを起動する

別々のターミナルで実行します。

~~~
html-share publish
html-share serve
html-share tailscale serve
~~~

Tailnetへ接続した端末のSafariなどで、`https://your-device.example.ts.net:9222/app/index.html` を開きます。`html-share serve` はループバックだけで待ち受け、`html-share tailscale serve` が設定したHTTPSポートからローカルサーバーへ転送します。Tailscale Funnelは使いません。

### ページを追加する

~~~
html-share page add reports/today.html --title "今日のレポート"
html-share publish
~~~

対象HTMLは、設定した `content.roots` の内側に置いてください。`publish` でローカルサイトへコピーしますが、エージェントのスレッドを自動収集する機能ではありません。

## 📱 エージェントとスマホの受け渡し

- `/mobile` はPC側の確認依頼をスマホへ送る入口です
- `/inbox` はスマホから置いた依頼をエージェントが引き取る入口です
- レビュー状態はローカルJSONへ保存され、同じTailnet上のPCから読み取れます
- 誰が接続できるかはTailscale ACLで決まり、別のペアリングコードは追加しません

## 🛡️ 境界と個人情報

- HTTPサーバーは既定で `127.0.0.1` にだけバインドします
- 入口はTailscale Serveを想定し、Funnelや公開ホスティングは設計外です
- 実際のTailnet値は、追跡対象外の `.env` またはローカルYAMLへ置きます
- 登録したHTMLは閲覧者のブラウザでJavaScriptを実行できる信頼済みコンテンツとして扱います
- インターネット公開サイトではないため、公開サービスとして運用しないでください

詳しくは [セキュリティ設計](docs/ja/guide/threat-model.md) を参照してください。

## 📚 ドキュメント

- [ドキュメント入口](docs/ja/index.md)
- [初回セットアップ](docs/ja/guide/setup.md)
- [使い方](docs/ja/guide/usage.md)
- [アーキテクチャ](docs/ja/guide/architecture.md)
- [セキュリティ設計](docs/ja/guide/threat-model.md)
- [トラブルシューティング](docs/ja/guide/troubleshooting.md)
- [English documentation](docs/index.md)

## 🧪 開発

~~~
npm ci
npm run verify
npm run build
~~~

`npm run verify` は、TypeScriptチェック、テスト、スキル/プラグイン検証、セキュリティスキャン、本番依存関係の監査をまとめて実行します。

## 🗂️ 構成

- `src/` — CLI、ローカルサーバー、公開処理、ローカル状態
- `web/` — ダッシュボードとスマホ画面
- `skills/` — HTML作成、モバイルレビュー、インボックス引き取りの手順
- `docs/` — 英語・日本語のガイド
- `assets/brand/` — READMEで使うTailnet Rockのブランド素材

## 📄 ライセンス

Apache License 2.0。詳しくは [LICENSE](LICENSE) を参照してください。
