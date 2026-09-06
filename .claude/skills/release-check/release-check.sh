#!/bin/bash
# release-check.sh — コミット/デプロイ前の機械チェック（workflowスキルのチェックリスト機械化）
# 使い方: bash .claude/skills/release-check/release-check.sh
# 終了コード: 問題なし=0 / 問題あり=1
set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || echo .)}"
cd "$ROOT" || exit 2
FAIL=0
note_fail() { echo "  ✗ $1"; FAIL=1; }
# 警告（△）は exit code に影響しない。実行の有無を機械では確かめられない項目に使う
note_warn() { echo "  △ $1"; }
ok() { echo "  ✓ $1"; }

echo "== 1. ブラウザプロファイル/一時ディレクトリの混入 =="
PROFILES=$(git ls-files --cached --others --exclude-standard 2>/dev/null \
  | grep -E '(^|/)(\.edge-test-profile|tmp-edge-profile-[^/]*|\.playwright-profile)(/|$)' | cut -d/ -f1 | sort -u || true)
if [ -z "$PROFILES" ]; then ok "混入なし"; else
  while IFS= read -r p; do [ -n "$p" ] && note_fail "プロファイル混入: $p（削除または .gitignore へ）"; done <<< "$PROFILES"
fi

echo "== 2. console.log の追加行（git diff HEAD、scripts/ 除外） =="
# scripts/ はCLIツール（実行ログが仕様）のため対象外（ADR 0013, 2026-07-13 深澤承認）
# 注: 「^\+[^+].*パターン」の1段regexは行頭直書き（+console.log…）を取りこぼすため、+++ヘッダ除外を分離する。
#     除外側は必ず -E で書く（BREだと \+ がGNU拡張の量指定子になり全行除外される罠）
LOGS=$(git diff HEAD --unified=0 -- '*.html' '*.js' ':(exclude)scripts/**' 2>/dev/null | grep -E '^\+' | grep -Ev '^\+\+\+' | grep 'console\.log' | head -10 || true)
if [ -z "$LOGS" ]; then ok "追加なし"; else
  while IFS= read -r l; do [ -n "$l" ] && note_fail "console.log残り: ${l:0:100}"; done <<< "$LOGS"
fi

echo "== 3. CDNスクリプトの SRI（integrity）欠落（変更HTML） =="
CHANGED_HTML=$(git diff HEAD --name-only --diff-filter=ACM 2>/dev/null | grep -E '\.html$' || true)
if [ -z "$CHANGED_HTML" ]; then ok "変更HTMLなし"; else
  SRI_OK=1
  while IFS= read -r f; do
    [ -f "$f" ] || continue
    # SRI適用不可として除外するホスト: 配信側がファイルを無告知で更新するため integrity を付けると壊れる。
    # 除外は「提供元がSRI非対応と明示しているもの」に限る（追加時は理由をここに書くこと）。
    #   - accounts.google.com/gsi/client … Google Identity Services。Googleがハッシュを固定しない
    #   - www.googletagmanager.com/gtag/js … Google アナリティクス。配信内容が随時更新されるため
    #     integrity を付けるとブラウザが読込をブロックする（Google もSRIを案内していない）。
    #     16ページが同じスニペットを持つので、除外しないと該当ページを触るたびに偽の✗が出る
    SRI_EXEMPT='accounts\.google\.com/gsi/client|www\.googletagmanager\.com/gtag/js'
    NOSRI=$(grep -oE '<script[^>]*src="https://[^"]*"[^>]*>' "$f" | grep -v 'integrity=' | grep -cvE "$SRI_EXEMPT" || true)
    if [ "${NOSRI:-0}" -gt 0 ]; then note_fail "$f: SRIなしのCDNスクリプト ×${NOSRI}"; SRI_OK=0; fi
  done <<< "$CHANGED_HTML"
  [ "$SRI_OK" = 1 ] && ok "SRI欠落なし"
fi

echo "== 4. 1MB超の新規ファイル／既存ファイルの急増 =="
# 意図は「重いものを新たに持ち込ませない」こと。既に1MB超の既存ファイル（sengoku.html は
# 元から1.4MB）を**触っただけで毎回✗**にすると、release-check が sengoku 作業のたびに
# 恒常的に赤くなり、他の指摘ごと無視されるようになる（＝検査が腐る）。
# よって既存ファイルは「1MB超 かつ 今回の差分で+100KB以上increaseした」場合だけ指摘する。
BIG_OK=1
BIGLIST=$(git diff HEAD --name-only --diff-filter=ACM 2>/dev/null || true)
while IFS= read -r f; do
  [ -n "$f" ] && [ -f "$f" ] || continue
  SZ=$(du -k "$f" | cut -f1)
  [ "$SZ" -gt 1024 ] || continue
  # HEAD 側のサイズ（新規ファイルは 0 扱い）
  PREV=$(git cat-file -s "HEAD:$f" 2>/dev/null || echo 0)
  PREV_KB=$(( PREV / 1024 ))
  if [ "$PREV_KB" -eq 0 ]; then
    note_fail "大容量の新規ファイル: $f (${SZ}KB) — /asset-optimize で削減を検討"; BIG_OK=0
  elif [ $(( SZ - PREV_KB )) -ge 100 ]; then
    note_fail "既存ファイルが急増: $f (${PREV_KB}KB → ${SZ}KB) — /asset-optimize で削減を検討"; BIG_OK=0
  fi
done <<< "$BIGLIST"
[ "$BIG_OK" = 1 ] && ok "1MB超なし"

echo "== 5. APIキー/シークレットらしき文字列（追加行） =="
SECRETS=$(git diff HEAD --unified=0 2>/dev/null \
  | grep -E '^\+[^+]' \
  | grep -aE 'sk-ant-|sk-[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{20,}|_API_KEY[[:space:]]*[=:][[:space:]]*["'"'"'][^"'"'"']{8,}|hooks\.slack\.com/services/' \
  | head -5 || true)
if [ -z "$SECRETS" ]; then ok "検出なし"; else
  while IFS= read -r l; do [ -n "$l" ] && note_fail "シークレット疑い: ${l:0:60}...（コミット禁止・即削除）"; done <<< "$SECRETS"
fi

echo "== 6. 文字化け（UTF-8をCP932として読んだ痕跡）の追加行 =="
# 日本語UTF-8のバイト列をCP932として解釈すると、ひらがな/カタカナが「見慣れない漢字＋半角カナ」の
# 並びに化ける。検出パターンはその先頭バイトに当たる文字を \x{} で書く（literalで書くと
# このスクリプト自身が検出対象になるため）。
# 編集ツールがファイルをUTF-8以外で書き戻すと**例外もエラーも出さずに**全日本語が壊れ、
# sengoku.html では <title>・meta description まで化けたまま1コミット公開された
# （2026-08-12 da0cda3→9c71184 で697行。さらに古い4行はコメント内のため2026-08-17まで生存）。
# 注意: C locale では \x{} は (*UTF) 無しだとPCREがエラー終了し**常に0件**を返す（偽の✓）。
MOJI=$(git diff HEAD --unified=0 2>/dev/null \
  | grep -E '^\+[^+]' \
  | grep -aP '(*UTF)[\x{7E3A}\x{7E67}\x{7E5D}][\x{3041}-\x{30FF}\x{FF61}-\x{FF9F}]|\x{8757}\x{FF7D}|\x{8B0C}\x{FF66}' \
  | head -5 || true)
if [ -z "$MOJI" ]; then ok "文字化けなし"; else
  while IFS= read -r l; do [ -n "$l" ] && note_fail "文字化け疑い: ${l:0:60}...（UTF-8で保存し直す。git履歴から原文を回収できる場合がある）"; done <<< "$MOJI"
fi

echo "== 7. test-screenshots/ の混入（ステージ済み） =="
SHOTS=$(git diff --cached --name-only 2>/dev/null | grep -c 'test-screenshots/' || true)
if [ "${SHOTS:-0}" = 0 ]; then ok "混入なし"; else note_fail "test-screenshots/ が ${SHOTS} 件ステージされている（unstageする）"; fi

echo "== 8. トップレベル宣言の二重定義（変更HTML） =="
# 同一スコープで `const X` が2回宣言されると **SyntaxError でページが丸ごと起動不能**になる。
# 単一HTMLのゲームはトップレベルconstが数百個あり、ブランチのマージで重複が生まれた実績がある
# （2026-08-04「main が二重定義していた REQUESTED_KOKUJIN_TEMPLE_PORTRAIT_SLOTS を解消」）。
# Playwright検査でも捕まるが、あちらは数分かかるうえ実行され忘れる。ここは grep で即座に落とす。
# 桁位置0の宣言だけを見るため、関数内・ブロック内の同名変数は対象外。
# **function は対象外**: 関数宣言の再定義はJS仕様上は合法（後勝ち）で SyntaxError にならない。
# 初版で function を含めたところ shogi.html の findKing/inB が誤検知した（＝正常なコードを
# 落とす検査は、そのうち丸ごと無視される）。落とすのは const / let だけに限定する。
DUP_OK=1
HTMLS=$(git diff HEAD --name-only --diff-filter=ACM 2>/dev/null | grep -E '\.html$' || true)
while IFS= read -r f; do
  [ -n "$f" ] && [ -f "$f" ] || continue
  DUPS=$(grep -oP '(*UTF)^(const|let)\s+\K\w+' "$f" | sort | uniq -d | head -3 || true)
  [ -z "$DUPS" ] && continue
  while IFS= read -r d; do [ -n "$d" ] && note_fail "二重定義: $f の '$d'（SyntaxErrorで起動不能になる）"; done <<< "$DUPS"
  DUP_OK=0
done <<< "$HTMLS"
[ "$DUP_OK" = 1 ] && ok "二重定義なし"

echo "== 9. アセットの形式方針（原則WebP・今回持ち込む分） =="
# 2026-08-02 に全アセットをWebP化したのに、3週間でPNGが235枚・384MB戻り assets が
# 587MB まで膨らんだ（2026-08-25 再変換）。方針はCLAUDE.mdに書いてあったが、守れているかを
# 確かめる手段が無かったため誰も気づかなかった。方針は文書ではなく検査で守る。
if [ -f scripts/verify-asset-format.mjs ]; then
  if ASSET_FMT=$(node scripts/verify-asset-format.mjs --diff 2>&1); then
    ok "WebP方針に反する画像なし"
  else
    # 概要の1行だけを ✗ として立て、内訳と手順はそのまま見せる（✗ が並ぶと読みにくい）
    SUMMARY=$(printf '%s\n' "$ASSET_FMT" | grep -m1 'WebP化されていない画像' | sed 's/^ *✗ *//')
    note_fail "${SUMMARY:-WebP化されていない画像があります}"
    printf '%s\n' "$ASSET_FMT" | sed -n '/WebP化されていない画像/,$p' | tail -n +2 | sed 's/^/  /' | head -20
  fi
else
  note_warn "scripts/verify-asset-format.mjs が無い（アセット形式の検査を実行できない）"
fi

echo "== 10. 変更ファイルに対応する必須チェック（CLAUDE.md 規定・実行の有無は見ない） =="
# CLAUDE.md は「sengoku.html を触ったら必ず実行」等を規定しているが、**文書にあるだけでは
# 実行されない**。実例: 2026-08-13 の 78ee5e6 が clan名を 足利→将軍足利 に改名して
# verify-castle-csv を壊し、23件FAIL・force-list 20件✗ のまま4日間気づかれなかった
# （同期間はDailyも無く、検査を回した形跡がない）。ここでは「今の差分に必要な検査コマンド」を
# 提示するだけに留める（Playwright検査は数分かかるため release-check 内では実行しない）。
CHANGED_ALL=$(git diff HEAD --name-only 2>/dev/null; git diff --cached --name-only 2>/dev/null)
req_for(){ grep -qx "$1" <<< "$CHANGED_ALL" && printf '%s\n' "$2"; }
# ディレクトリ配下の変更に対応する検査（req_for は完全一致なので、配下のどれが変わっても効く形が要る）
req_prefix(){ grep -q "^$1" <<< "$CHANGED_ALL" && printf '%s\n' "$2"; }
REQ=$( {
  req_for sengoku.html      "node scripts/verify-sengoku-boot.mjs / verify-castle-csv.mjs / verify-castle-layouts.mjs / verify-map-assets.mjs / verify-force-list.mjs / verify-sengoku-balance.mjs"
  req_for sanguo.html       "node scripts/verify-sanguo-boot.mjs"
  req_for synth-eq.html     "node scripts/verify-synth-eq.mjs（UI変更時は gen-synth-eq-og.mjs も）"
  req_for genpei.html       "node scripts/verify-genpei-boot.mjs / verify-genpei-kyoten.mjs / verify-genpei-balance.mjs"
  req_for siro_ichi.csv     "node scripts/verify-castle-csv.mjs"
  req_for force_list.csv    "node scripts/verify-force-list.mjs"
  req_for assets/js/agent-data.js "node scripts/agent-evolve-check.mjs / gen-agent-knowledge.mjs / agent-dynamic-test.cjs"
  req_for zero-1-mobile.html "node scripts/verify-zero1-mobile.mjs / verify-gesture-pointer.mjs"
  req_for assets/js/gesture-pointer.js "node scripts/verify-gesture-pointer.mjs"
  req_for assets/js/zero1-worker.js "node scripts/verify-zero1-mobile.mjs"
  req_for sw.js             "node scripts/verify-service-worker.mjs（別オリジンの横取り＝全ページの通信に効く）"
  req_prefix note/            "node scripts/verify-note-articles.mjs（noteへ貼る前に必須）"
} | sort -u )
if [ -z "$REQ" ]; then ok "対象ファイルの変更なし"; else
  while IFS= read -r r; do [ -n "$r" ] && note_warn "要実行: $r"; done <<< "$REQ"
fi

echo ""
echo "-- git diff --stat（参考） --"
git diff HEAD --stat 2>/dev/null | tail -3

echo ""
if [ "$FAIL" = 0 ]; then echo "==> release-check: 問題なし ✅（次: /dynamic-test → コミット）"; else echo "==> release-check: 要対応 ❌"; fi
exit "$FAIL"
