# 使い方

[ドキュメント入口](../index.md) · [English](../../guide/usage.md)

## レポートを登録して公開する

設定した `content.roots` の内側にHTMLを置き、登録してローカルサイトへ反映します。

~~~bash
html-share page add reports/today.html --title "今日のレポート"
html-share publish
~~~

ダッシュボードは `.html-share/site/` の生成manifestを読みます。登録済みHTMLを編集した後は、もう一度 `publish` を実行してください。

## ダッシュボードを開く

同じTailnetへ接続した端末から、設定済みのHTTPS URLを開きます。

~~~text
https://your-device.example.ts.net:9222/app/index.html
~~~

`/mobile` はスマホ側のレビュー向け、`/inbox` はエージェントが依頼を引き取る画面です。

## 期限付きリンクを共有する

CLIから共有リンクを作成します。

~~~bash
html-share share demo-report
~~~

共有記録と期限はローカルデータへ保存されます。リンクはTailnet境界の内側だけで到達でき、公開URLにはなりません。

## 端末間でレビュー依頼を受け渡す

スマホ画面またはCLIから依頼を作り、エージェント側のinboxで確認・完了します。

~~~bash
html-share review inbox
html-share review complete <id>
~~~

originはループバックに置いたまま、どのTailnet identityが到達できるかをTailscale ACLで管理してください。
