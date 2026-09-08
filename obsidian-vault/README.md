# 🧠 Obsidian Vault — hide_0001 Portfolio セカンドブレイン

このフォルダは Claude Code の「第二の脳」として運用する Obsidian 互換の Markdown Vault です。
GitHub Pages で公開される `index.html` 等とは無関係の、プロジェクトの意思決定・学び・知見を蓄積するための個人ナレッジベースです。

## 使い方（人間側）
Obsidian アプリでこのフォルダ（`obsidian-vault/`）をVaultとして開くと、`[[wikilink]]` やグラフビュー・バックリンクがそのまま機能します。

**スマホ（Android）からも同じVaultを開けます**。Obsidian Git プラグインでこのリポジトリを同期する構成で、
セットアップ手順は `docs/obsidian-スマホ連携.md` を参照。スマホで書いたメモは `00-Inbox/` に落ち、
次のセッションで Claude Code が全文読んで振り分けます。

## 使い方（Claude Code側）
- **読み込み**: セッション開始時に `.claude/hooks/second-brain-recall.sh` が `MOC.md` と直近の `01-Daily/` ノートを自動で読み込み、コンテキストに追加する
- **書き込み**: いつ・何をどう書くかは `.claude/skills/second-brain/SKILL.md` のルールに従う

## フォルダ構成
| フォルダ | 役割 |
|---|---|
| `MOC.md` | 目次（Map of Content）。全プロジェクト・ノートへのハブ |
| `00-Inbox/` | 未整理の一時メモ・思いつき（**スマホからの投げ込み先**。recall hookが全文読む） |
| `01-Daily/` | `YYYY-MM-DD.md` 形式のセッション作業記録 |
| `02-Projects/` | プロジェクト/ゲーム単位のノート（1ファイル1プロジェクト） |
| `03-Decisions/` | 意思決定ログ（ADR形式、`NNNN-スラッグ.md`） |
| `04-Knowledge/` | 再利用可能な知見・ハマりどころ・パターン集 |
| `Templates/` | 各ノート種別のテンプレート |
| `99-Attachments/` | スマホから貼った画像等の添付先（`.obsidian/app.json` で指定） |

## PMO（`pmo/` Google Drive）との役割分担
- **このVault**: 個人の知的資産（意思決定の理由・学び・気づき）
- **PMOの`pmo/`**: ステークホルダー向けの進捗・リスク・KPI管理文書

## 禁止事項
- APIキー・パスワード等の機微情報は書かない（このリポジトリは公開リポジトリ）
