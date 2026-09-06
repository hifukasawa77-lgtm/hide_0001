# エージェント共通運用規約

`.claude/agents/*.md` の全エージェントが従う**唯一の正**。各エージェント定義は「自分の専門」だけを書き、
ここに書いてある共通事項は繰り返さない（重複させると片方だけ古くなる）。

**各エージェントは着手前にこのファイルを読むこと。**（`sed -n '1,200p' .claude/agent-conventions.md`）

---

## 1. 契約 — 受け取る／返す

エージェント間の受け渡しは**定型**にする。定型を外れた受け渡しは「揃うまで着手しない」。

### 着手前チェック（全エージェント共通）

1. **受け取るべきものが揃っているか** — 揃っていなければ着手せず、上流へ不足を名指しで要求する。
   「無いまま推測で進める」ことを禁じる（推測で進めた成果物は下流の全工程を汚染する）。
2. **対象ファイルが特定できているか** — 不明なら確認する。`git diff HEAD --name-only` で拾えるならそれを使う。
3. **自分の担当範囲か** — 範囲外なら担当エージェント名を添えて差し戻す（§6の振り分け表）。

### 返す形式（全エージェント共通の骨格）

```markdown
## [エージェント名] 結果 — <対象>

**判定**: PASS / FAIL（またはこのエージェント固有の3段階）
**根拠**: <ファイル:行番号> を必ず添える（「なんとなく」は禁止）

| # | 指摘 | 場所 | 深刻度 | 対処／担当 |
|---|------|------|--------|-----------|

**実行した検査**: 対応表の該当コマンド（例: `verify-<対象>.mjs`）… ✅/❌（§4）
**次の担当**: <エージェント名> へ <何を> 渡す
**深澤への確認事項**: <あれば。無ければ「なし」>
```

- **根拠のない指摘を出さない**。コードに存在する事実だけを書く（推測での問題の捏造を禁じる）。
- **「緑になった」を成果にしない**。何を通したかを列挙する。

---

## 2. 権限（tools）の原則

各定義の frontmatter `tools:` は**最小権限**で指定する。担当外の操作は「できない」状態にしておく
（「やらない」と書くだけでは、長い作業の途中で必ず破られる）。

| 役割 | 与える | 与えない |
|---|---|---|
| 診断・監査（security / legal-checker / triage / evaluator / dynamic-tester） | Read, Grep, Glob, Bash | **Edit / Write**（直す係ではない。直すと「検査した人が検査対象を作る」状態になる） |
| 限定改変（i18n / game-balance / optimizer / refactoring / asset-guardian） | Read, Grep, Glob, Bash, Edit | **Write**（新規ファイル作成は担当外） |
| 制作（code-generator / planner / graphic-designer / music-generator / verifier） | Read, Write, Edit, Grep, Glob, Bash ほか | — |
| 外部連携が要る（pmo / graphic-designer） | MCPコネクタが要るため `tools:` を絞らない | — |

`tools:` を書かない＝全ツール付与。**意図して全部要るとき以外は必ず書く**。

---

## 3. コンテキスト節約（CLAUDE.md の規約。違反は下流の全員に効く）

- **Read の前に必ず grep/find で行番号を特定する**。
- **Read には offset + limit を必ず指定する**（1回200行以内。`index.html` 等は前後50行）。
- ファイル全体をチャットへ貼らない。出力は**変更箇所スニペット（前後10行）**。
- 差分の確認は `git diff HEAD` / `git diff HEAD~1 HEAD`。変更ファイルの全体再読み込みは禁止。
- `.claudeignore` 記載ファイルは Read 禁止（grep + offset/limit のみ）。

---

## 4. 必須検査の対応表（触ったら通すまで完了報告しない）

**このリポジトリの不具合は「例外もエラーも出ない」形で出る**（絵が無言で消える／肖像が無言でずれる／
SWが理由を消す／0%で永久に待つ）。だから完了の定義は「動いたように見えた」ではなく
**「対応する機械検査が緑」**。該当する検査を飛ばした完了報告は無効。

| 変更したファイル | 必須検査 |
|---|---|
| `sengoku.html` | `node scripts/verify-sengoku-boot.mjs` / `node scripts/verify-castle-csv.mjs` / `node scripts/verify-castle-layouts.mjs` / `node scripts/verify-map-assets.mjs` / `node scripts/verify-force-list.mjs` / `node scripts/verify-sengoku-balance.mjs` / `node scripts/verify-known-bug-patterns.mjs` |
| `sanguo.html` | `node scripts/verify-sanguo-boot.mjs` / `node scripts/verify-known-bug-patterns.mjs` |
| `taihei.html` | `node scripts/verify-taihei-boot.mjs` / `node scripts/verify-taihei-balance.mjs` |
| `genpei.html` | `node scripts/verify-genpei-boot.mjs` / `node scripts/verify-genpei-balance.mjs` / `node scripts/verify-genpei-kyoten.mjs` |
| `bakumatsu.html` / `game.js` / `bakumatsu.css` | `node scripts/verify-bakumatsu-map.mjs` |
| `sw.js` | `node scripts/verify-service-worker.mjs` |
| `zero-1-mobile.html` / `assets/js/zero1-worker.js` / `assets/js/zero1-tools.js` | `node scripts/verify-zero1-mobile.mjs` / `node scripts/verify-service-worker.mjs` |
| `assets/js/gesture-pointer.js` | `node scripts/verify-gesture-pointer.mjs` |
| `synth-eq.html` | `node scripts/verify-synth-eq.mjs` |
| `assets/` 配下の画像（追加・差し替え・再エンコード） | `node scripts/verify-game-assets.mjs` / `node scripts/verify-asset-format.mjs` / `node scripts/verify-known-bug-patterns.mjs` |
| `assets/js/agent-data.js` | `node scripts/agent-evolve-check.mjs` / `node scripts/agent-dynamic-test.cjs` |
| `marketing/` / `scripts/post-social.js` | `node scripts/verify-social-posts.mjs` |
| `note/` | `node scripts/verify-note-articles.mjs` |
| 上記以外のHTML（新規ゲーム含む） | `bash .claude/skills/dynamic-test/run.sh --changed` |
| コミット直前（全変更共通） | `bash .claude/skills/release-check/release-check.sh` |

- **表に無いファイルでも、CLAUDE.md に検査の記載があればそちらが優先**（CLAUDE.md が正、この表は索引）。
- 検査を新設・改名したら**この表と CLAUDE.md の両方**を直す（harness-lint 検査#14 が実在を機械確認する）。
- **検査自体を直したら、故障を仕込んで ✗ が出ることを確かめる**。偽の緑は検査が無いより悪い。

---

## 5. 停止条件・エスカレーション（共通）

以下は**自力で押し切らず、深澤（PM）へ判断を仰ぐ**。

| 状況 | 対応 |
|---|---|
| 同じ理由で2回以上差し戻された | 根本原因の仮説を添えて深澤へ報告し、判断を仰ぐ |
| 仕様と実装が矛盾していて、どちらが正か決められない | 両方の解釈と影響範囲を提示して確認する |
| 修正すると CLAUDE.md の方針（色・WebP・フレームワーク不使用・課金ゼロ等）に反する | 実行前に確認する。方針違反を黙って通さない |
| 課金が発生し得る操作に触れる | `accounting-agent` の管轄。実行前に通知・承認（`.claude/hooks/accounting-guard.sh`） |
| 破壊的操作（force push・履歴書き換え・大量削除・公開範囲の変更） | 実行前に必ず確認する |
| 検査が落ちるが原因が担当範囲外 | 落ちた検査名・出力・切り分け結果を添えて担当エージェントへ回す（黙って skip しない） |

**禁止（全エージェント共通）**

- 検査・テストを skip / disable / quarantine して緑にする
- 有料APIキーの設定・記述（CLAUDE.md「APIキーに関する禁止事項」）
- `main` への直接 push（作業は `kai_001` または `claude/*`。Routine 系はローリングPRで深澤承認）
- 承認を要する変更（デザイン方針・パラメータ・翻訳適用・リリース）を無断で確定する
- サイバーパンク的演出（ネオングロウ過多・原色ネオン・SF都市風）の持ち込み

---

## 6. 振り分け表（自分で深追いしないもの）

| 見つけたもの | 回す先 |
|---|---|
| FPS低下・メモリリーク・毎フレームの再生成 | `optimizer` |
| XSS・eval系・未検証の外部入力・SRI欠落 | `security` |
| 著作権・ライセンス・出自不明のアセット | `legal-checker` |
| 重複コード・責務の混在・命名の乱れ | `refactoring` |
| 日本語のみのUI文言 | `i18n` |
| WebP方針違反・容量超過・参照切れ・肖像indexずれ | `asset-guardian` |
| 難易度・テンポ・数値の偏り | `game-balance` |
| 原因不明の「動かない」報告（再現から） | `triage` |
| 同じ無言バグを二度踏んだ | `verifier`（機械検査へ昇格させる） |
| 学び・意思決定として残すべきもの | `/second-brain` → `/self-improve` |

---

## 7. エージェント一覧（詳細は各定義と CLAUDE.md「エージェントハーネス設計」）

| フェーズ | エージェント |
|---|---|
| 横断 | `pmo`（進捗・リスク・KPI） / `accounting-agent`（課金監視） |
| 起点 | `researcher`（市場調査） → `planner`（要件・設計・仕様書） |
| 制作 | `graphic-designer` / `music-generator` / `code-generator` |
| 品質ゲート（並列） | `legal-checker` / `security` / `i18n` / `asset-guardian` |
| 動的検証 | `dynamic-tester` |
| 採点・公開 | `evaluator` → `release` → `marketer`（任意） |
| 公開後の改善 | `optimizer` / `refactoring` / `game-balance` / `achievement-agent` |
| 常設ユーティリティ | `triage`（不具合の再現・切り分け） / `verifier`（検査の作成） / `english-teacher` |
