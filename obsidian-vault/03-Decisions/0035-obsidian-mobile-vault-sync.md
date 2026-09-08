---
type: decision
tags: [decision, second-brain, obsidian, mobile]
date: 2026-09-08
status: accepted
---

# 0035 — スマホのObsidianと第二の脳をgit経由で共有する

## 背景
深澤から「スマホにインストールされているObsidianの指定フォルダと連携して、第二の脳として記憶していってほしい」との依頼。
Claude Code はクラウドのコンテナで動いており、**スマホの中のフォルダには一切触れられない**。
共通で触れる場所は GitHub リポジトリ `hifukasawa77-lgtm/main` だけ。

## 決定
`obsidian-vault/`（既存の第二の脳）を**スマホのObsidianからも開く共用Vault**とし、
Android の Obsidian Git プラグインでこのリポジトリを同期する。Obsidian Sync（公式・有料）は
Claude が読めないため採らない。

- スマホで書いたメモは `00-Inbox/` に落ちる（`.obsidian/app.json` で新規ノート作成先を固定）
- recall hook が `00-Inbox/` を**全文**コンテキストへ入れる（見出しだけでは意味が無い場所のため）
- Claude は読んだら行き先へ振り分け、元ファイルを消す。決まらないものは残して深澤へ確認する

## 理由
- **「書いたのに読まれない」が最大の失敗モード**。Inbox を recall に載せないと、スマホからのメモは
  誰にも読まれないまま溜まり続ける（例外もエラーも出ない。ただ届かない）
- **溜め込みも失敗モード**。全文を毎セッション読むので、振り分けて消すまでを1セットにしないと
  文脈を食い続ける。だから「消す」までをスキルの手順に書いた
- **推測で振り分けない**。間違った場所へ入れたメモは二度と見つからず、消したのと同じになる

## 判明した制約
- `.git` が **2.2GB**（PNG時代の履歴）。全履歴クローンはスマホでまず終わらないので
  **depth 1 必須**（作業ツリー約380MB）
- その380MBの大半は `assets/`（317MB）で、メモ本体は **748KB**。
  Obsidian Git（モバイル）は部分取得を持たないため今の構成では削れない
- 重すぎる場合の代案は「メモ専用の別リポジトリへ分ける」だが、**正本が2箇所に分かれる**ので
  勝手に分けず深澤へ相談する

## リスク
**このリポジトリは公開**。スマホから書くと機微情報が無自覚に混入しやすい。
`00-Inbox/はじめに.md` と CLAUDE.md に警告を置き、Claude 側も混入を見つけたら即報告する運用にした。

## 成果物
- `docs/obsidian-スマホ連携.md` — Android のセットアップ手順とつまずき表
- `.claude/hooks/second-brain-recall.sh` — Inbox 全文読み込みを追加
- `.claude/skills/second-brain/SKILL.md` — 受信メモの振り分け手順を追加
- `obsidian-vault/.obsidian/app.json` / `99-Attachments/` / `00-Inbox/はじめに.md`
- `.gitignore` — 端末ごとに変わる Obsidian 設定を除外
