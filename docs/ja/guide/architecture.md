# アーキテクチャ

[ドキュメント入口](../index.md) · [English](../../guide/architecture.md)

HTML Share — Tailscaleは、1つのローカルoriginと、1つの意図したネットワーク入口で構成します。

~~~text
HTML + html-share.config.yaml
            │
            ▼
      html-share publish
            │
            ├─ .html-share/site/  静的サイト + ページmanifest
            ├─ .html-share/data/  レビュー状態 + 共有トークン
            │
            ▼
  127.0.0.1:4311 ローカルHTTPサーバー
            │
            ▼
  Tailscale Serve HTTPS (*.ts.net)
            │
            ▼
       Tailnet内のスマホ/PC
~~~

## 実行単位

- `src/bundle.ts` — 許可したローカルアセットを埋め込み、ページmanifestを作る
- `src/publish.ts` — ダッシュボードと登録ページを `.html-share/site/` へ配置し、期限付きTailnetリンクを作る
- `src/local-server.ts` — 静的ファイルとレビュー/設定APIを同じoriginで提供する
- `src/local-state.ts` — JSON状態を一時ファイル経由で保存する
- `src/review-client.ts` — PC側エージェントとローカルAPIの間でレビューカードを送受信する

## 保存境界

生成サイトと可変状態を分けます。

- `.html-share/site/` はブラウザへ配信する生成サイト
- `.html-share/data/` は設定、レビュー、共有記録
- `html-share.config.yaml` と `.env` はローカル設定

サーバーは生成サイトの内側だけを配信します。リポジトリ、設定ファイル、データディレクトリを静的ファイルとして公開しません。

## Tailnet境界

アプリはループバックで待ち受けます。Tailscale Serveがユーザー設定のHTTPSプロキシとしてoriginへ接続します。Tailnet外からのアクセスは設計対象ではなく、アプリ自身に公開インターネット向けの認証層はありません。

## 期限付きリンクとレビュー

`html-share share` やダッシュボードの共有操作は、ランダムトークンと期限をローカル状態へ保存します。サーバーは両方を検査してからページを返します。

スマホからの依頼は `/api/owner/reviews` へ送られ、`inbox` アイテムとして保存されます。ダッシュボードやPC側CLIから完了できます。インボックスは受け渡し箱であり、進捗トラッカーではありません。
