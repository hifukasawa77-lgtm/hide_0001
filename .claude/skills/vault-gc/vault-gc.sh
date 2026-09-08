#!/bin/bash
# vault-gc.sh — obsidian-vault のwikilink切れ・孤立ノート・Inbox滞留を検出
# 使い方: bash .claude/skills/vault-gc/vault-gc.sh
# 終了コード: 問題なし=0 / 問題あり=1
set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || echo .)}"
cd "$ROOT" || exit 2
[ -d obsidian-vault ] || { echo "✗ obsidian-vault/ が見つからない"; exit 2; }

python3 - <<'PY'
import os, re, sys, glob

VAULT = 'obsidian-vault'
notes = {}  # basename(拡張子なし) -> path
for p in glob.glob(f'{VAULT}/**/*.md', recursive=True):
    notes[os.path.splitext(os.path.basename(p))[0]] = p

# 00-Inbox/はじめに.md はスマホ連携の常設ガイド（投げ込み場所の説明）で、
# 仕分け対象でも孤立ノートでもない。除外しないと恒久的に✗が出続け、
# 「いつも赤い検査」として本物の滞留が見過ごされる。
PERMANENT = {f'{VAULT}/00-Inbox/はじめに.md'}

fail = False
print('== 1. wikilink切れ ==')
broken = []
links_to = set()
for p in sorted(glob.glob(f'{VAULT}/**/*.md', recursive=True)):
    text = open(p, encoding='utf-8', errors='ignore').read()
    # インラインコード内（`[[wikilink]]` 等の説明表記）はリンクとして扱わない
    text = re.sub(r'`[^`]*`', '', text)
    for m in re.finditer(r'\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]', text):
        target = m.group(1).strip()
        links_to.add(target)
        if target not in notes:
            broken.append(f'  ✗ {p}: [[{target}]] の参照先なし')
if broken:
    print('\n'.join(broken)); fail = True
else:
    print('  ✓ 切れなし')

print('== 2. 孤立ノート（どこからも参照されていない） ==')
orphans = []
for name, p in sorted(notes.items()):
    if '/Templates/' in p or name in ('MOC', 'README'):
        continue
    if '/01-Daily/' in p:  # Dailyは日付で辿れるため対象外
        continue
    if p in PERMANENT:
        continue
    if name not in links_to:
        orphans.append(f'  ✗ {p}（MOCまたは親ノートからリンクを張る）')
if orphans:
    print('\n'.join(orphans)); fail = True
else:
    print('  ✓ 孤立なし')

print('== 3. Inbox滞留 ==')
inbox = [p for p in sorted(glob.glob(f'{VAULT}/00-Inbox/*.md')) if p not in PERMANENT]
if inbox:
    for p in inbox:
        print(f'  ✗ {p}（SKILL.mdの仕分け基準で移動）')
    fail = True
else:
    print('  ✓ 空')

print()
print('==> vault-gc: ' + ('問題あり ❌' if fail else '健全 ✅'))
sys.exit(1 if fail else 0)
PY
