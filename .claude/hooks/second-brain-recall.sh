#!/bin/bash
set -euo pipefail

VAULT="${CLAUDE_PROJECT_DIR:-.}/obsidian-vault"
[ -d "$VAULT" ] || exit 0

echo "## 🧠 第二の脳（obsidian-vault/）からの記憶"
echo

if [ -f "$VAULT/MOC.md" ]; then
  echo "### MOC（目次）"
  cat "$VAULT/MOC.md"
  echo
fi

# 04-Knowledge/ の再利用可能な知見を「クイックインデックス」として常時投入する。
# 全文は重いので各ノートのH1見出しのみを列挙し、必要な知見へ最短で辿れるようにする。
# （これが「学び→反映」閉ループの常時稼働部分: 過去の教訓が毎セッション文脈に乗る）
if compgen -G "$VAULT/04-Knowledge/*.md" > /dev/null; then
  echo "### 知見クイックインデックス（04-Knowledge/ — 詳細は各ファイル参照）"
  for f in "$VAULT"/04-Knowledge/*.md; do
    title=$(grep -m1 '^# ' "$f" 2>/dev/null | sed 's/^# //' || true)
    base=$(basename "$f" .md)
    echo "- [[$base]] — ${title:-$base}"
  done
  echo
fi

# 00-Inbox/ はスマホのObsidianから投げ込まれる未整理メモの着地点。
# ここは「読まれなければ書いた意味が無い」場所なので、見出しではなく全文を投入する。
# ただし溜め込むと毎セッション文脈を食うので、Claude は読んだら行き先へ振り分けて消す
# （振り分け先が決まらないものだけ残す。詳細は 00-Inbox/はじめに.md）。
INBOX_NOTES=$(find "$VAULT/00-Inbox" -maxdepth 1 -name '*.md' ! -name 'はじめに.md' 2>/dev/null | sort || true)
if [ -n "${INBOX_NOTES:-}" ]; then
  echo "### 📥 未整理の受信メモ（00-Inbox/ — スマホから投げ込まれた可能性が高い）"
  echo "_読んだら 03-Decisions / 04-Knowledge / 02-Projects / 01-Daily へ振り分け、元ファイルは消すこと。_"
  echo "_行き先が決まらないものは消さずに深澤へ確認する。_"
  echo
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    echo "#### $(basename "$f")"
    head -c 8000 "$f"
    echo
  done <<< "$INBOX_NOTES"
  echo
fi

# mtime順(ls -t)は使わない: CCRリモート環境はフレッシュクローンで全ファイルのmtimeが
# ほぼ同一になり最新判定が壊れる。ファイル名が YYYY-MM-DD.md なので名前順が正。
LATEST_DAILY=$(ls "$VAULT/01-Daily"/*.md 2>/dev/null | sort | tail -1 || true)
if [ -n "${LATEST_DAILY:-}" ]; then
  echo "### 直近のDaily Note ($(basename "$LATEST_DAILY"))"
  cat "$LATEST_DAILY"
  echo
fi

echo "_(新しい学び・決定事項は obsidian-vault/ に追記する。詳細は .claude/skills/second-brain/SKILL.md を参照)_"
echo "_(セッション区切りでは /self-improve で学びをエージェント定義・CLAUDE.md へ還元する。詳細は .claude/skills/self-improve/SKILL.md)_"
