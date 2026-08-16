# アーキテクチャ

```text
HTMLファイル + html-share.config.yaml
             │
             ▼
       html-share publish
             │
             ├─ .html-share/site/       静的サイトとmanifest
             ├─ .html-share/data/       レビュー・設定・共有リンク
             │
             ▼
  127.0.0.1:4311 のローカルHTTPサーバー
             │
             ▼
  Tailscale Serve HTTPS (*.ts.net)
             │
             ▼
       Tailnet内のスマホ/PC
```

## 実行単位

- `src/bundle.ts`: 許可したroots内のHTMLへローカルアセットを埋め込み、ページmanifestを作る
- `src/publish.ts`: `web/` と生成済みページを `.html-share/site/` へ配置し、期限付きTailnetリンクを作る
- `src/local-server.ts`: 静的ファイルとレビュー・設定APIを同じオリジンで提供する
- `src/local-state.ts`: JSON状態を一時ファイル経由で保存する
- `src/review-client.ts`: PC側CLIからループバックAPIへレビューを送受信する

## 公開境界

HTTPサーバーはループバックアドレスだけで待ち受けます。外部から見える入口は利用者が明示的に設定したTailscale Serveで、Funnelは使用しません。したがって共有URLはTailnet外からは到達できません。

## 共有リンク

`html-share share` またはダッシュボードの「共有URLを発行」は、ランダムなトークンを `.html-share/data/shares.json` に保存します。サーバーはトークンと期限を検査してから対象HTMLを返します。元ページの直接URLもTailnet内では利用できます。

本人がスマホから置く依頼は `/api/owner/reviews` へ投稿し、宛先を持たない `inbox` セッションへ固定します。ペアリング済みのどのPCからでも取り込み、完了にできます。任意の `target` はプロジェクトの呼び名のヒントで、ファイルパスではありません。取り込む側が依頼文と合わせて作業フォルダを見極めます。

依頼の状態は `waiting` と `completed` の2つだけで、「取り込み済み」を表す状態を持ちません。そのためエージェントは、作業の完了を待たず取り込んだ時点で完了にします。開いたままの依頼が「まだどのPCも拾っていないもの」を意味するようになり、スマホの一覧がそのまま受け渡しの状態を表します。進捗と結果はインボックスではなくチャットで返します。

ペアリングコードや端末トークンは使いません。Tailnetがアクセス境界になり、レビュー状態はローカルJSONへ保存します。

## 閲覧面の表

スマホ幅では、はみ出した表を縦積みのカードへ畳みます。スクリプトはAPIを呼ばないので、閲覧面の `connect-src 'none'` はそのままです。相対パスのJSはCSPで読めないため、配信HTMLへインラインで埋め込みます。
