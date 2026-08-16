# トラブルシューティング

[ドキュメント入口](../index.md) · [English](../../guide/troubleshooting.md)

## 設定ファイルが見つからない

サンプルから追跡対象外のローカルファイルを作ります。

~~~powershell
Copy-Item html-share.config.example.yaml html-share.config.yaml
Copy-Item .env.example .env
~~~

リポジトリのルートでコマンドを実行するか、`--config path/to/html-share.config.yaml` を指定してください。

## URLの検証に失敗する

`server.publicUrl` と `HTML_SHARE_PUBLIC_URL` は、次の条件を満たす必要があります。

- HTTPSである
- `*.ts.net` 配下のホスト名である
- 認証情報、クエリ、ハッシュ、パスを含まない
- `server.tailscale.hostname` / `HTML_SHARE_TAILSCALE_HOSTNAME` と一致する
- `server.tailscale.httpsPort` / `HTML_SHARE_TAILSCALE_HTTPS_PORT` と同じポートである

追跡対象の例ではプレースホルダーを使い、実際のホスト名は `.env` に置いてください。

## ローカルサーバーが起動しない

4311番ポートが他のプロセスに使われていないか確認してください。`server.host` は `127.0.0.1` のままにします。`0.0.0.0` のようなLAN全体へのバインドは設定で拒否します。

## Tailscale Serveでエラーになる

次を順番に確認します。

1. ホストPCのTailscaleにログインしている
2. スマホが同じTailnetへ接続している
3. `.env` のHTTPSポートとServe設定のポートが一致している
4. ローカルhealthが先に返る

~~~bash
curl http://127.0.0.1:4311/api/health
~~~

無関係なServe設定をリセットしたり、回避策としてFunnelを有効にしたりしないでください。

## ダッシュボードが空

`content.roots` の内側にあるHTMLを `html-share page add ...` で登録し、`html-share publish` を実行します。CLIはエージェントスレッドからページを推測しません。

## レビュー依頼が見つからない

`html-share review inbox` でwaitingの依頼を一覧します。すでに完了している可能性があります。インボックスには「引き取り済み」という別状態を意図的に持たせていません。
