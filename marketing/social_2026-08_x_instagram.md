# ソーシャル投稿コンテンツ — X / Instagram
作成日: 2026-08-24 ／ 担当: Marketer エージェント
サイト: https://hifukasawa77-lgtm.github.io/main/

> 投稿の実行は深澤（PM）。自動投稿を有効にする場合は `docs/social-setup.md` の Secrets 登録手順を参照。
>
> **このファイルが投稿文の正本。** コードブロックの中身がそのまま投稿される文面（改行も含む）。
> `scripts/post-social.js` の `X_POSTS` / `INSTAGRAM_POSTS` は実行用の写しなので**必ず両方直す**。
> 一致は `node scripts/verify-social-posts.mjs` の検査#6が機械確認する。

## 現状サマリー（訴求の根拠）

- 公開ゲーム **37本**（ボード20／シミュレーション6／アクション4／パズル3／RPG2／カード1／その他1）
- 全てブラウザ完結・インストール不要・無料
- 素のHTML/CSS/JavaScript（Canvas API）のみ。フレームワーク・ビルドツール不使用
- Claude AI とのペアプログラミングで制作。22体のAIエージェントによる開発パイプラインを公開中

## USP（この3点だけを繰り返し言う）

1. **歴史SLGが4本**（三国志・戦国・源平・南北朝）— 個人開発でこの density は珍しい
2. **フレームワークゼロ** — ライブラリ無しでヘックス戦・AI思考・Web Audio まで実装
3. **AIチームで作っている** — 22体のエージェント（企画〜品質ゲート〜リリース）を公開している

---

# X（旧Twitter）

## 日本語

### JA-1 — 歴史SLG訴求（主力・最初に出す）
```
歴史シミュレーションを4本、ブラウザで無料公開しています。

・三国志・天下三分（8シナリオ／10勢力）
・戦国風雲記（街道・攻城ヘックス戦）
・源平争乱記（兵力でなく"名分"を獲る）
・太平風雲記（南北朝の正統性争い）

全部インストール不要。フレームワークも不使用です。
https://hifukasawa77-lgtm.github.io/main/

#個人開発 #ブラウザゲーム #シミュレーションゲーム
```

### JA-2 — 技術訴求
```
ライブラリを1つも使わず、素のCanvas APIだけでゲームを37本作りました。

ヘックス戦の経路探索も、AIの思考ルーチンも、Web Audioのシンセも全部自前。
ビルドツールもなし。HTMLファイルを開けば動きます。

https://hifukasawa77-lgtm.github.io/main/

#JavaScript #CanvasAPI #個人開発 #gamedev
```

### JA-3 — AIチーム訴求（差別化が一番効く）
```
ゲーム開発をAIエージェント22体のチームでやっています。

企画→アセット制作→実装→品質ゲート（法務／脆弱性／日英表記／アセット）→動的テスト→採点→リリース。
このパイプラインごとサイトで公開しました。

https://hifukasawa77-lgtm.github.io/main/agents.html

#AI駆動開発 #ClaudeCode #個人開発
```

### JA-4 — カジュアル訴求（リーチ狙い）
```
将棋・囲碁・麻雀・チェス・花札・百人一首・バックギャモン…
ボードゲームだけで20本、ブラウザで無料で遊べます。

アプリ入れなくていいので、通勤中の暇つぶしにどうぞ。
https://hifukasawa77-lgtm.github.io/main/

#無料ゲーム #暇つぶし #将棋 #麻雀
```

## English

### EN-1 — Tech angle
```
I built 37 browser games with zero frameworks — just vanilla JS and the Canvas API.

Hex-grid battles, AI opponents, Web Audio synths: all hand-rolled.
No bundler, no npm install. Open the HTML and it runs.

https://hifukasawa77-lgtm.github.io/main/

#JavaScript #CanvasAPI #gamedev #indiedev
```

### EN-2 — AI team angle
```
My game studio is 22 AI agents.

Planning → assets → code → quality gates (legal / security / i18n) → runtime tests → scoring → release.
I published the whole pipeline:

https://hifukasawa77-lgtm.github.io/main/agents.html

#AIcoding #ClaudeCode #buildinpublic
```

### EN-3 — Strategy games
```
Four historical strategy games, free in your browser:
Three Kingdoms, Sengoku Japan, Genpei War, Nanboku-chō.

Hex battles, diplomacy, siege warfare. No install, no account.

https://hifukasawa77-lgtm.github.io/main/

#strategygames #browsergames #indiegame
```

---

# Instagram

画像は `assets/marketing/` に 1080×1080（正方形）で用意。カルーセル4枚を想定。

- `ig-01-hero.jpg` — 37本・インストール不要
- `ig-02-strategy.jpg` — 歴史SLG 4本
- `ig-03-board.jpg` — ボードゲーム20本
- `ig-04-team.jpg` — AIエージェント22体

## IG-1 — カルーセル本命（日英併記）

```
ブラウザだけで遊べるゲームを37本、無料公開しています🎮

▫️歴史シミュレーション4本（三国志・戦国・源平・南北朝）
▫️ボードゲーム20本（将棋・囲碁・麻雀・チェス・花札…）
▫️アクション・シューティング・パズル

すべてインストール不要。ライブラリもフレームワークも使わず、素のJavaScriptとCanvas APIだけで作りました。

開発はAIエージェント22体のチーム制。企画から品質チェック、リリースまでの流れもサイトで公開しています。

プロフィールのリンクから遊べます👆

—
37 free browser games, no install required.
Built with vanilla JavaScript and the Canvas API — zero frameworks.
Developed by a team of 22 AI agents.

#個人開発 #ブラウザゲーム #無料ゲーム #ゲーム制作 #JavaScript #CanvasAPI #AI駆動開発 #indiedev #gamedev #browsergames #retrogaming #将棋 #麻雀 #シミュレーションゲーム #プログラミング
```

## IG-2 — 歴史SLG単体（リール/単発投稿向け）

```
「兵力ではなく"名分"を奪い合う」歴史シミュレーションを作りました⚔️

源平争乱記 — 治承・寿永の乱（1180-1189）が舞台。院宣・官位・三種の神器といった正統性を巡って争います。

戦は数だけでは決まらない。そこを遊びの中心に据えました。

ブラウザで無料。インストール不要です。
プロフィールのリンクから👆

—
A historical strategy game where you fight for legitimacy, not just troops.

#歴史ゲーム #源平合戦 #シミュレーションゲーム #個人開発 #ブラウザゲーム #ゲーム制作 #strategygame #indiedev #gamedev #history
```

## IG-3 — AIチーム（ストーリーズ/リール向け）

```
ゲームを作っているのは、22体のAIエージェントのチームです🤖

プランナーが仕様を書き、デザイナーが絵を作り、コードジェネレーターが実装し、法務・セキュリティ・多言語・アセットの4体が並列でチェック。テスターが実際にブラウザで動かして、エバリュエーターが100点満点で採点。80点未満はやり直しです。

このチーム表もサイトで公開しています。

#AI駆動開発 #ClaudeCode #個人開発 #プログラミング #AIエージェント #buildinpublic #aitools #indiedev
```

---

## 投稿スケジュール案（週1・水曜21時 JST 想定）

| 週 | X | Instagram |
|---|---|---|
| 1 | JA-1（歴史SLG） | IG-1（カルーセル） |
| 2 | JA-3（AIチーム） | — |
| 3 | EN-1（技術・英語圏向け） | IG-2（源平単体） |
| 4 | JA-4（カジュアル） | IG-3（AIチーム） |

- Xは日本語3：英語1の比率。英語投稿は日本時間の深夜〜早朝（米国日中）に出す
- Instagramはリンクが踏めないため、必ず「プロフィールのリンクから」を入れる
- 反応が取れた投稿は文面を変えて2ヶ月後に再利用してよい

## KPI（初回3ヶ月）

| 指標 | 目標 |
|---|---|
| X インプレッション | 月 5,000 |
| X → サイト流入 | 月 100 セッション |
| Instagram 保存数 | 投稿あたり 10 |
| フォロワー | 3ヶ月で +100（両媒体合計） |

計測は `agent-evolve` の `/stats`（サイト内エージェントの質問傾向）と GitHub Pages のリファラで代替する。
