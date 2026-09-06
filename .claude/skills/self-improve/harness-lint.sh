#!/bin/bash
# harness-lint.sh — ハーネス整合性の一括検査
# /self-improve の手順0（振り返り前のヘルスチェック）として実行する。
# 今日までに手作業で繰り返した監査（SKILL.md欠落・frontmatter・色ドリフト・
# 課金ガードの2段ゲート同期・主要参照の実在）を機械化したもの。
# 使い方: bash .claude/skills/self-improve/harness-lint.sh
# 終了コード: 問題なし=0 / 問題あり=1
set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || echo .)}"
cd "$ROOT" || exit 2
FAIL=0
WARN=0
note_fail() { echo "  ✗ $1"; FAIL=1; }
note_warn() { echo "  △ $1"; WARN=1; }
ok() { echo "  ✓ $1"; }

echo "== 1. スキルの SKILL.md 存在チェック =="
for d in .claude/skills/*/; do
  d="${d%/}"
  if [ -f "$d/SKILL.md" ]; then
    ok "$d/SKILL.md"
  else
    note_fail "$d に SKILL.md なし（$(ls "$d" 2>/dev/null | tr '\n' ' ')）— スキルとしてロードされない"
  fi
done

echo "== 2. frontmatter 検証（agents + skills: 1行目---, name:, description:, 閉じ---）=="
for f in .claude/agents/*.md .claude/skills/*/SKILL.md; do
  [ -f "$f" ] || continue
  [ "$(sed -n '1p' "$f")" = "---" ] || { note_fail "$f: 1行目が --- でない"; continue; }
  awk 'NR>1 && $0=="---"{found=1;exit} END{exit !found}' "$f" || { note_fail "$f: 閉じ --- なし"; continue; }
  fm=$(awk 'NR==1{next} $0=="---"{exit} {print}' "$f")
  echo "$fm" | grep -q '^name:' || { note_fail "$f: name: なし"; continue; }
  echo "$fm" | grep -q '^description:' || { note_fail "$f: description: なし"; continue; }
  ok "$f"
done

echo "== 3. 課金ガードの2段ゲート同期（settings.json matcher == BILLING_RISK_TOOLS）=="
if [ -f .claude/settings.json ] && [ -f .claude/hooks/accounting-guard.sh ]; then
  M=$(python3 -c "import json,sys;d=json.load(open('.claude/settings.json'));print([h['matcher'] for h in d.get('hooks',{}).get('PreToolUse',[]) if 'accounting-guard' in str(h)][0])" 2>/dev/null || echo "__ERR__")
  B=$(grep -oE "BILLING_RISK_TOOLS='[^']*'" .claude/hooks/accounting-guard.sh | sed "s/BILLING_RISK_TOOLS='//;s/'$//")
  if [ "$M" = "__ERR__" ] || [ -z "$M" ]; then
    note_fail "settings.json から accounting-guard の matcher を取得できない"
  elif [ "$M" = "$B" ]; then
    ok "matcher == BILLING_RISK_TOOLS"
  else
    note_fail "不一致: matcher='$M' / BILLING_RISK_TOOLS='$B'（matcherは上位集合＝同一文字列であること）"
  fi
else
  echo "  - 課金ガード未設定（スキップ）"
fi

echo "== 4. 色ドリフト（CLAUDE.md禁止のマゼンタ/原色ネオンが指示として残っていないか）=="
# 禁止文（禁止/使わない/避け）を除いた、指示としての #ff00ff / ネオンシアン を検出。
# このスクリプト自身は検出パターン文字列を含むため除外する。
DRIFT=$(grep -rniE '#ff00ff|ネオンシアン|マゼンタ' .claude/agents .claude/skills 2>/dev/null \
  | grep -v 'harness-lint.sh' \
  | grep -vE '禁止|使わない|使用しない|避け|NG|準拠' || true)
if [ -z "$DRIFT" ]; then
  ok "色ドリフトなし"
else
  # パイプを避け（サブシェルだとFAILが親へ伝播しない）here-stringで回す
  while IFS= read -r l; do
    [ -n "$l" ] && note_fail "色ドリフト疑い: $l"
  done <<< "$DRIFT"
fi

echo "== 5. CLAUDE.md正の具体値ドリフト（予算/採点閾値/作業ブランチが再掲先と一致するか）=="
# 色以外の重複した具体値（閾値・予算・ブランチ名）も必ずドリフトする（[[harness-maintenance-patterns]]）。
# 正の単一ソースから値を導出し、再掲している各ファイルと突き合わせる（カンマ表記差は除去して比較）。
# 6a. 予算上限: 正=accounting/budget.md の MONTHLY_LIMIT（ガードが実際に読む値）
if [ -f accounting/budget.md ]; then
  LIM=$(grep -oE 'MONTHLY_LIMIT:[[:space:]]*[0-9]+' accounting/budget.md | grep -oE '[0-9]+' | head -1)
  if [ -n "$LIM" ]; then
    for f in CLAUDE.md .claude/agents/accounting-agent.md; do
      [ -f "$f" ] || continue
      if grep -qE "¥?${LIM}" <(tr -d ',' < "$f"); then ok "予算上限 ¥${LIM} 整合: $f"
      else note_fail "予算上限ドリフト: $f が budget.md の ¥${LIM} と不一致"; fi
    done
  fi
fi
# 6b. Evaluator合格閾値: 正=CLAUDE.md「N点以上 かつ … M点以上」
read -r T1 T2 < <(grep -oE '[0-9]+点以上' CLAUDE.md | grep -oE '[0-9]+' | head -2 | tr '\n' ' ')
if [ -n "${T1:-}" ] && [ -n "${T2:-}" ]; then
  if grep -qE "${T1}.*${T2}|${T2}.*${T1}" .claude/agents/evaluator.md; then ok "採点閾値 ${T1}/${T2} 整合: evaluator.md"
  else note_fail "採点閾値ドリフト: evaluator.md が CLAUDE.md の ${T1}点/${T2}点 と不一致"; fi
fi
# 6c. 作業ブランチ: 正=CLAUDE.md「作業ブランチ: \`xxx\`」
WB=$(grep -E '作業ブランチ:' CLAUDE.md | grep -oE '`[^`]+`' | head -1 | tr -d '`')
if [ -n "$WB" ]; then
  if grep -qE "作業ブランチ.*${WB}" .claude/agents/pmo.md; then ok "作業ブランチ ${WB} 整合: pmo.md"
  else note_fail "作業ブランチドリフト: pmo.md が CLAUDE.md の ${WB} と不一致"; fi
fi

echo "== 6. 主要参照パスの実在 =="
for p in \
  .claude/hooks/second-brain-recall.sh .claude/hooks/accounting-guard.sh .claude/hooks/notify-slack.sh \
  .claude/skills/second-brain/SKILL.md .claude/skills/self-improve/SKILL.md \
  gamekit/gamekit.js gamekit/template.html \
  accounting/budget.md accounting/ledger.md \
  obsidian-vault/MOC.md obsidian-vault/Templates/decision-note.md ; do
  [ -e "$p" ] && ok "$p" || note_fail "参照先なし: $p"
done

echo "== 7. mtime依存ソート（ls -t 等）が .claude スクリプトにないか =="
# CCRリモート環境はフレッシュクローンで全ファイルのmtimeがほぼ同一になるため、
# hooks/skills のスクリプトで mtime順ソートに依存すると選択結果が不定になる
# （recall hook が「直近のDaily」を誤選択した実例: 2026-07-09）。
# このスクリプト自身は検出パターン文字列を含むため除外する。
MT=$(grep -rnE 'ls[[:space:]]+-[a-zA-Z]*t|find[[:space:]].*-newer|sort[[:space:]].*-k.*%Y' \
  .claude/hooks .claude/skills --include='*.sh' --include='*.cjs' 2>/dev/null \
  | grep -v 'harness-lint.sh' \
  | grep -vE '^[^:]+:[0-9]+:[[:space:]]*#' || true)
if [ -z "$MT" ]; then
  ok "mtime依存ソートなし"
else
  while IFS= read -r l; do
    [ -n "$l" ] && note_fail "mtime依存ソート疑い（フレッシュクローンで不定）: $l"
  done <<< "$MT"
fi

echo "== 8. 未昇格の学びを含むDaily（昇格漏れリマインド・警告のみ／exit codeに影響しない）=="
# 「学び」セクションを含むDailyに 昇格済み/反映済み マーカーが無ければ警告する。
# 学びの昇格は /self-improve の手順1〜4で行う人間+LLM作業のため、この検査は
# 非ブロッキング（△）。手作業でやっていた「未マーカーDailyの遡り点検」の機械化（2026-07-16）。
for f in obsidian-vault/01-Daily/*.md; do
  [ -f "$f" ] || continue
  # 明示の未昇格マーカーは最優先で警告する。ファイル内に昇格済みマーカーが同居して
  # いても（セクション単位で昇格状況が異なるDaily）取りこぼさない（2026-07-17の実例:
  # 冒頭セクションの「昇格済み」で後続2件の未昇格が不可視化されていた）。
  # マーカー実体（太字 **未昇格**）のみ拾う。地の文の言及（「未昇格4件を昇格」等）は対象外
  if grep -q '\*\*未昇格\*\*' "$f"; then
    note_warn "$f: 未昇格マーカーあり（/self-improve で昇格する）"
    continue
  fi
  # 見出し型（## 学んだこと）に加え inline 太字型（**学び（…）**）も学びとして検出する
  grep -qE '^## 学んだこと|学び（' "$f" || continue
  # マーカーの「存在」だけでは、昇格済みマーカーの後ろに新しい学びセクションが
  # 追記されたDailyを見逃す（2026-07-17で実例: マージで末尾に未マーカーの学び2件が
  # 追記されたが存在チェックは✓）。最後の学び行と最後のマーカー行の位置を比べ、
  # 学びが後ろなら未昇格分ありとして警告する。
  LAST_LEARN=$(grep -nE '^## 学んだこと|学び（' "$f" | tail -1 | cut -d: -f1)
  LAST_MARK=$(grep -nE '昇格済み|反映済み|昇格しない' "$f" | tail -1 | cut -d: -f1)
  if [ -z "$LAST_MARK" ]; then
    note_warn "$f: 学びに昇格済み/反映済みマーカーなし（/self-improve で昇格要否を点検）"
  elif [ "$LAST_LEARN" -gt "$LAST_MARK" ]; then
    note_warn "$f: 最後のマーカー(${LAST_MARK}行)より後ろに学び(${LAST_LEARN}行)が追記されている（/self-improve で昇格要否を点検）"
  else
    ok "$f"
  fi
done

echo "== 9. Dailyなしの作業日（直近14日・警告のみ／exit codeに影響しない）=="
# 作業コミット（obsidian-vault/ 以外を変更した非マージコミット）がある日に
# 対応する 01-Daily/YYYY-MM-DD.md が無ければ警告する。検査#8は「存在するDailyの
# 昇格漏れ」しか見えず、Dailyごと書かれなかった作業日は蓄積ループから漏れる
# （2026-07-15の大型実装5件が無記録だった実例）。記録要否の判断はLLM作業のため
# 非ブロッキング（△）。古い作業日を延々警告しないよう直近14日に限定する。
COMMITS=$(git log --no-merges --since='14 days ago' --date=short --pretty='%H %ad' 2>/dev/null || true)
if [ -z "$COMMITS" ]; then
  echo "  - 直近14日のコミットなし（スキップ）"
else
  WORKDAYS=""
  while read -r h d; do
    [ -n "$h" ] || continue
    # obsidian-vault/ のみのコミット（Daily追記等）は「作業」に数えない。
    # 注意: `git show | grep -q` 直結は pipefail 下で grep の早期exitが
    # git show を SIGPIPE(141) で殺しパイプライン全体が偽になる（変更ファイル数が
    # 多いコミットだけ落ちる）ため、先に変数へ受けてから grep する。
    CHANGED=$(git show --pretty=format: --name-only "$h" 2>/dev/null || true)
    if grep -qv -e '^$' -e '^obsidian-vault/' <<< "$CHANGED"; then
      WORKDAYS="$WORKDAYS$d"$'\n'
    fi
  done <<< "$COMMITS"
  while IFS= read -r d; do
    [ -n "$d" ] || continue
    if [ -f "obsidian-vault/01-Daily/$d.md" ]; then
      ok "$d（Dailyあり）"
    else
      note_warn "$d: 作業コミットあり・Dailyなし（学び/決定があれば obsidian-vault/01-Daily/$d.md へ記録）"
    fi
  done <<< "$(printf '%s' "$WORKDAYS" | sort -u)"
fi

echo "== 10. 案内エージェント知識のdrift（agent-data.js ⇄ worker site-knowledge.js）=="
if [ -f scripts/gen-agent-knowledge.mjs ] && command -v node >/dev/null 2>&1; then
  if node scripts/gen-agent-knowledge.mjs --check >/dev/null 2>&1; then
    ok "site-knowledge.js は agent-data.js と一致"
  else
    note_fail "site-knowledge.js が乖離。実行: node scripts/gen-agent-knowledge.mjs"
  fi
else
  ok "スキップ（生成スクリプトなし or node なし）"
fi

echo "== 11. Routineスケジュールのドリフト（CLAUDE.md「定期実行（Routine）一覧」== 各スキルの記載）=="
# 2026-07-18にagent-evolveを日次→週次へ変えた際、実態だけ変わりCLAUDE.md・SKILL.md・
# プロジェクトノートが「毎日05:00」のまま1週間放置された（07-25の16thで発見）。
# CLAUDE.mdの表を正とし、各スキルSKILL.mdが同じ曜日・時刻を書いているかを機械照合する。
# 注: Routineの「実態」はAPI側にありCIからは読めない。ここで防げるのは"片方だけ更新"のドリフト。
if grep -q '定期実行（Routine）一覧' CLAUDE.md 2>/dev/null; then
  # 注（bash罠）: この環境は LANG 未設定＝C locale のため、`[月火水木金土日]` のような
  # 多バイト文字のブラケット表現はバイト単位比較になり必ず空振りする。
  # 多バイト文字は「リテラル」か「[^...]（単バイト否定）」の形でのみ使うこと。
  ROWS=$(grep -oE '^\| `/[a-z-]+` \| *毎週[^|]*曜 [0-9][0-9]:[0-9][0-9]' CLAUDE.md || true)
  if [ -z "$ROWS" ]; then
    note_warn "Routine一覧の表から行を抽出できない（表形式が変わった可能性）"
  else
    while IFS= read -r row; do
      [ -n "$row" ] || continue
      SK=$(printf '%s' "$row" | grep -oE '`/[a-z-]+`' | tr -d '`/')
      DAY=$(printf '%s' "$row" | grep -oE '毎週[^ ]*曜')
      TIME=$(printf '%s' "$row" | grep -oE '[0-9]{2}:[0-9]{2}')
      F=".claude/skills/${SK}/SKILL.md"
      if [ ! -f "$F" ]; then note_fail "Routine一覧のスキルが実在しない: $F"; continue; fi
      # スキル側にスケジュール記載があるなら曜日・時刻の両方が一致していること
      if grep -qE '毎週[^ ]*曜 *[0-9][0-9]:[0-9][0-9]|毎日 *[0-9][0-9]:[0-9][0-9]' "$F"; then
        if grep -qE "${DAY} *${TIME}" "$F"; then ok "Routine整合 /${SK}: ${DAY} ${TIME}"
        else note_fail "Routineドリフト: $F が CLAUDE.md の「${DAY} ${TIME}」と不一致"; fi
      else
        ok "Routine整合 /${SK}: スキル側にスケジュール記載なし（CLAUDE.mdの表が単一ソース）"
      fi
    done <<< "$ROWS"
  fi
else
  note_warn "CLAUDE.md に「定期実行（Routine）一覧」が見つからない"
fi

echo "== 12. シェル検査の多バイトブラケット表現（C localeで空振り＝偽の✓を生む）=="
# LANG未設定（C locale）では `[月火水木金土日]` のような多バイト文字のブラケット表現が
# バイト単位比較になり必ず空振りする。厄介なのは**エラーにならず「検査が通った」ように
# 見える**点で、lintの信頼性そのものを損なう（検査#11の初回実装で実際に発生, 2026-07-25）。
# 正しい書き方: 多バイトはリテラルで置き、可変部は単バイトの否定クラスにする（`毎週[^ ]*曜`）。
# 対象はシェル(grep/sed/awk)のみ。JSのRegExpはUTF-16認識なのでlocaleの影響を受けない。
if command -v python3 >/dev/null 2>&1; then
  MB=$(python3 - <<'PYEOF'
import re, os
pat = re.compile(r'\[\^?[^\]\n]*[^\x00-\x7F][^\]\n]*\]')
out = []
for dp, dn, fn in os.walk('.claude'):
    for f in fn:
        if not f.endswith('.sh'):
            continue
        p = os.path.join(dp, f)
        try:
            lines = open(p, encoding='utf-8', errors='replace').read().split('\n')
        except OSError:
            continue
        for i, l in enumerate(lines, 1):
            if l.strip().startswith('#'):   # 解説コメントは対象外（自己誤検出の回避）
                continue
            if not re.search(r'grep|sed|awk', l):
                continue
            m = pat.search(l)
            if m:
                out.append('%s:%d: [多バイトブラケット] %s' % (p, i, m.group(0)[:40]))
            # 同じ「localeで無言に壊れる」系: grep -P の \x{...} は (*UTF) が要る。
            # C locale だと PCRE が code point を大きすぎると判断してエラー終了し、
            # grep が常に0を返す＝日本語を含む全ページが「含まれていない」と誤判定される
            # （i18n-check.sh で実際に発生, 2026-08-05）。
            if re.search(r'grep\b[^|;]*-\w*P', l) and re.search(r'\\x\{', l) and '(*UTF)' not in l:
                out.append('%s:%d: [PCRE \\x{} に (*UTF) なし] %s' % (p, i, l.strip()[:60]))
print('\n'.join(out))
PYEOF
)
  if [ -z "$MB" ]; then
    ok "多バイトブラケット表現なし／PCRE の \\x{} は (*UTF) 付き"
  else
    while IFS= read -r l; do
      [ -n "$l" ] && note_fail "locale依存で空振り→偽の✓: $l"
    done <<< "$MB"
  fi
else
  echo "  - python3なし（スキップ）"
fi

echo ""
echo "== 13. エージェント定義 ⇄ CLAUDE.md ⇄ agents.html の整合 =="
# 目的: 「定義はあるがどのパイプラインからも呼ばれない孤立エージェント」と、
# 「サイトの図には居るのに CLAUDE.md には無い（またはその逆）」の食い違いを機械検出する。
# 2026-08-23: 21体中9体が孤立、Release は agents.html の図にだけ存在していた実績あり。
if command -v python3 >/dev/null 2>&1; then
  AG=$(python3 - <<'PYEOF'
import os, re, glob
out = []
names = sorted(os.path.basename(p)[:-3] for p in glob.glob('.claude/agents/*.md'))
claude = open('CLAUDE.md', encoding='utf-8').read()
site = open('agents.html', encoding='utf-8').read() if os.path.exists('agents.html') else ''
skills = ''
for p in glob.glob('.claude/skills/*/*'):
    if os.path.isfile(p):
        try: skills += open(p, encoding='utf-8', errors='replace').read()
        except OSError: pass

for n in names:
    # (a) CLAUDE.md のエージェント節に載っているか（`agent-name` のバッククォート表記で照合）
    if '`%s`' % n not in claude:
        out.append('FAIL:%s: CLAUDE.md のエージェント一覧に無い（役割とフロー上の位置を追記する）' % n)
    # (b) パイプライン上の位置が分かるか — CLAUDE.md のフロー図か、スキルからの呼び出しがあるか
    label = n.replace('-agent', '').replace('-', '[- ]?')
    in_flow = re.search(r'\[%s' % label, claude, re.I) is not None
    called  = re.search(r'\b%s\b' % re.escape(n), skills, re.I) is not None
    body = open('.claude/agents/%s.md' % n, encoding='utf-8').read()
    declares = 'パイプライン上の位置' in body
    if not (in_flow or called or declares):
        out.append('FAIL:%s: どのフロー図・スキルからも参照されず「パイプライン上の位置」節も無い（孤立）' % n)
    # (c) サイトのメンバー表に載っているか
    card = 'designer' if n == 'graphic-designer' else n   # graphic-designer のカード画像は designer.svg
    if site and ('assets/agents/%s.svg' % card) not in site:
        out.append('WARN:%s: agents.html にカードが無い（サイトの紹介と実体がずれる）' % n)

# (d) 逆方向 — 定義が消えたのにサイト/CLAUDE.md に残っていないか
if site:
    for m in re.findall(r'assets/agents/([a-z0-9-]+)\.svg', site):
        if m not in names and m != 'designer':   # designer.svg = graphic-designer のカード画像
            out.append('FAIL:%s: agents.html が参照するが .claude/agents/%s.md が無い（削除漏れ）' % (m, m))
print('\n'.join(out))
PYEOF
)
  if [ -z "$AG" ]; then
    ok "全エージェントが CLAUDE.md・agents.html・パイプラインと整合"
  else
    while IFS= read -r l; do
      [ -z "$l" ] && continue
      case "$l" in
        FAIL:*) note_fail "${l#FAIL:}" ;;
        WARN:*) note_warn "${l#WARN:}" ;;
      esac
    done <<< "$AG"
  fi
else
  echo "  - python3なし（スキップ）"
fi


echo "== 14. エージェント定義 ⇄ 共通運用規約（.claude/agent-conventions.md）の適合 =="
# 目的: 「規約を書いたが誰も従っていない」状態を機械検出する。
# 権限（tools）未指定・契約/停止条件の欠落・存在しない検査コマンドや旧ファイル名の参照を洗う。
if command -v python3 >/dev/null 2>&1; then
  AC=$(python3 - <<'PYEOF14'
import os, re, glob
out = []
CONV = '.claude/agent-conventions.md'
if not os.path.exists(CONV):
    print('FAIL:%s が無い（全エージェントの共通運用規約の正本）' % CONV)
    raise SystemExit
conv = open(CONV, encoding='utf-8').read()

# MCPコネクタが要るため tools を絞らないエージェント（理由を定義本文に書くこと）
TOOLS_EXEMPT = {'graphic-designer', 'pmo'}

names = sorted(os.path.basename(p)[:-3] for p in glob.glob('.claude/agents/*.md'))
html_pages = {os.path.basename(p) for p in glob.glob('*.html')}

for n in names:
    body = open('.claude/agents/%s.md' % n, encoding='utf-8').read()
    m = re.match(r'^---\n(.*?)\n---\n', body, re.S)
    if not m:
        out.append('FAIL:%s: frontmatter が無い' % n); continue
    fm = m.group(1)
    # (a) 最小権限の宣言
    has_tools = re.search(r'^tools:', fm, re.M) is not None
    if not has_tools and n not in TOOLS_EXEMPT:
        out.append('FAIL:%s: frontmatter に tools: が無い（未指定＝全ツール付与。規約§2）' % n)
    if not has_tools and n in TOOLS_EXEMPT and '権限について' not in body:
        out.append('WARN:%s: tools: を絞らない理由が本文に書かれていない（規約§2）' % n)
    # (b) 契約・停止条件・共通規約への参照
    if '## 契約' not in body:
        out.append('FAIL:%s: 「## 契約」節が無い（受け取る/返す/次の担当。規約§1）' % n)
    else:
        for kw in ('受け取る', '返す'):
            if kw not in body:
                out.append('FAIL:%s: 契約に「%s」が無い' % (n, kw))
    if '停止条件' not in body:
        out.append('FAIL:%s: 「停止条件」節が無い（規約§5）' % n)
    if 'agent-conventions.md' not in body:
        out.append('FAIL:%s: 共通運用規約（.claude/agent-conventions.md）を参照していない' % n)
    # (c) 参照している検査スクリプトが実在するか
    for sc in set(re.findall(r'(scripts/[A-Za-z0-9_.-]+\.(?:mjs|cjs|js|py))', body)):
        if not os.path.exists(sc):
            out.append('FAIL:%s: 存在しない検査スクリプトを参照 → %s' % (n, sc))
    for sk in set(re.findall(r'(\.claude/skills/[A-Za-z0-9_./-]+\.(?:sh|cjs|mjs))', body)):
        if not os.path.exists(sk):
            out.append('FAIL:%s: 存在しないスキルスクリプトを参照 → %s' % (n, sk))
    # (d) 実在しないHTMLページ名の参照（改称の取りこぼし。例: game.html → zelda_like.html）
    for pg in set(re.findall(r'`([a-z0-9_-]+\.html)`', body)):
        if pg not in html_pages:
            out.append('FAIL:%s: 実在しないページを参照 → %s（改称の取りこぼし）' % (n, pg))

# (e) 規約§4の対応表が参照する検査コマンドの実体
for sc in set(re.findall(r'(scripts/[A-Za-z0-9_.-]+\.(?:mjs|cjs|js|py))', conv)):
    if not os.path.exists(sc):
        out.append('FAIL:agent-conventions: 対応表が存在しないスクリプトを参照 → %s' % sc)
for sk in set(re.findall(r'(\.claude/skills/[A-Za-z0-9_./-]+\.(?:sh|cjs|mjs))', conv)):
    if not os.path.exists(sk):
        out.append('FAIL:agent-conventions: 対応表が存在しないスクリプトを参照 → %s' % sk)
# (f) 規約が挙げるエージェント名が実在するか（振り分け表・一覧の腐り防止）
for ref in set(re.findall(r'`([a-z][a-z0-9-]+)`', conv)):
    if ref.endswith('-agent') or ref in ('planner','researcher','evaluator','release','marketer','optimizer',
                                          'refactoring','security','triage','verifier','pmo','i18n','asset-guardian',
                                          'code-generator','graphic-designer','music-generator','legal-checker',
                                          'dynamic-tester','game-balance','english-teacher'):
        if ref not in names:
            out.append('FAIL:agent-conventions: 実在しないエージェントを参照 → %s' % ref)
print('\n'.join(out))
PYEOF14
)
  if [ -z "$AC" ]; then
    ok "全エージェントが共通運用規約（tools宣言・契約・停止条件・参照の実在）に適合"
  else
    while IFS= read -r l; do
      [ -z "$l" ] && continue
      case "$l" in
        FAIL:*) note_fail "${l#FAIL:}" ;;
        WARN:*) note_warn "${l#WARN:}" ;;
      esac
    done <<< "$AC"
  fi
else
  echo "  - python3なし（スキップ）"
fi

echo ""
if [ "$FAIL" = 0 ]; then
  if [ "$WARN" = 0 ]; then
    echo "==> harness-lint: 問題なし ✅"
  else
    echo "==> harness-lint: 問題なし ✅（△の警告あり — /self-improve の振り返りで点検）"
  fi
else
  echo "==> harness-lint: 問題あり ❌（上記 ✗ を /self-improve で是正）"
fi
exit "$FAIL"
