---
type: moc
tags: [moc]
---

# 🧠 第二の脳 — Map of Content

hide_0001 Portfolio プロジェクトの記憶ハブ。Claude Codeはセッション開始時にこのファイル・知見クイックインデックス・直近のDaily Noteを自動で読み込む（`.claude/hooks/second-brain-recall.sh`）。

## ♻️ 再帰的自己改善ループ
蓄積（`/second-brain`）→ 想起（recall hook）→ **反映（`/self-improve`）** の閉ループで、学びをハーネス自身の指示に昇格させる。詳細: [[recursive-self-improvement]] / [[0003-recursive-self-improvement-loop]]

## 📁 構成
- `00-Inbox/` — 未整理の一時メモ
- `01-Daily/` — セッションごとの作業記録（`YYYY-MM-DD.md`）
- `02-Projects/` — プロジェクト/ゲーム単位のノート
- `03-Decisions/` — 意思決定ログ（ADR形式）
- `04-Knowledge/` — 再利用可能な知見・ハマりどころ・パターン集

## 📌 進行中プロジェクト
- [[second-brain-system]] — このセカンドブレイン基盤自体
- [[recursive-self-improvement]] — 学び→反映の閉ループ（自己改善基盤）
- [[guide-agent-evolution]] — 案内エージェントの週次自己進化＋週次サイト提案基盤
- [[幕末風雲記]] — 幕末戦略シミュレーション（スマホ対応・藩論/京都政局/外国勢力/人物/歴史分岐の5システム実装済み）

## 📚 意思決定ログ
- [[0001-second-brain-vault-structure]]
- [[0002-admin-client-auth-unpublish]] — admin画面を公開から除外（静的ホスティングの認証限界）
- [[0003-recursive-self-improvement-loop]] — 学び→反映の再帰的自己改善ループを追加
- [[0004-code-generator-color-scheme-align]] — code-generatorの色指定をCLAUDE.mdに整合（/self-improve初回）
- [[0005-billing-guard-matcher-sync]] — 課金ガードのsettings.json matcherをguard.shと同期
- [[0006-activate-orphaned-skills]] — 孤立5スキルをSKILL.md化して有効化（design整合含む）
- [[0007-harness-lint-automation]] — 手作業監査をharness-lint.shに機械化し/self-improve手順0に
- [[0008-value-drift-lint]] — 色以外の具体値（予算/閾値/ブランチ）ドリフトをharness-lint検査#5で機械検査
- [[0009-daily-hygiene-rule]] — Daily圧縮（recallコンテキスト節約）をsecond-brainスキルの書式ルールへ昇格
- [[0010-skills-expansion]] — スキル一括拡充（8本→23本、監査スクリプト同梱型）
- [[0011-mtime-free-file-selection]] — mtime依存のファイル選択を廃止（recall hook誤想起の修正）＋lint検査#7
- [[0012-canvas-perf-patterns-promotion]] — Canvasパフォーマンス実証知見（メモ化/オフスクリーン合成/attribution）とOG画像知見をスキルへ昇格
- [[0013-release-check-scripts-exclusion]] — release-check検査#2からscripts/を除外＋grep正規表現バグ2件（行頭直書き取りこぼし/BRE `\+` 量指定子）を修正
- [[0014-import-matching-and-grid-verification-promotion]] — CSV取込マッチング（claimedチェック/一括割当）をcodingへ、グリッド×背景整合・BFS到達性の機械検証をgame-devへ昇格
- [[0015-unpromoted-learning-lint]] — 未昇格の学びを含むDailyをharness-lint検査#8で機械検出（警告のみ・非ブロッキング）
- [[0016-daily-coverage-lint]] — Dailyなしの作業日をharness-lint検査#9で機械検出（直近14日・警告のみ）
- [[0017-legacy-agents-tree-removal]] — レガシー.agents/skills/を削除しvideo-editingを正式スキルへ救出
- [[0018-battle-verification-patterns-promotion]] — 合戦バグ群の学び（陣営の絶対基準/縦位置補正/reason別計測/シーン直起動検証）をgame-dev・dynamic-testerへ昇格＋lint検査#8の未昇格マーカー取りこぼし修正
- [[0019-fixed-canvas-mobile-ui-promotion]] — 固定CanvasのモバイルUI対策（パネル拡大＋入力逆変換/ラベル幅フィット）をgame-devへ昇格＋lint検査#8を位置ベース検査へ強化
- [[0020-perf-cost-placement-and-canvas-layout-promotion]] — 前処理コストの置き場所（静止時ベイクの罠/補償ハック撤去）をcodingへ、Canvas絶対座標レイアウトの整合（分岐の全要素更新/描画倍率とレイアウト予約の一致）をgame-devへ昇格＋7営業日分の遡及Daily整備
- [[0021-routine-schedule-single-source]] — Routineスケジュールの正をCLAUDE.md「定期実行（Routine）一覧」へ単一ソース化＋lint検査#11、/self-improveを週次Routine化（日曜21:00 JST）
- [[0022-asset-reencode-safety]] — アセット再エンコードの安全策（切り出し矩形の解像度非依存化・後読みの同時数/上限）＋マップ描画の機械検査を新設
- [[0023-verification-integrity-and-daily-backfill]] — 検査スクリプトの健全性を横断ルール化＋Daily骨組み生成を機械化（backfill-daily.sh）
- [[0024-encoding-and-required-check-guards]] — 文字化け・const二重定義・必須検査の未実行を release-check で機械検出＋検査#4の腐り修正
- [[0025-csv-sync-direction-and-newline-preservation]] — 正本CSVはゲームへ追随（同期は検査FAIL箇所だけ）＋改行/BOM保持・派生列の再生成スクリプト
- [[0026-vault-boundary-docs-and-known-bug-lint]] — claudechord-vault/obsidian-vaultの境界明文化＋肖像index/source-rect直書きを横断機械検査化
- [[0027-chatgpt-proposal-phased-implementation]] — 外部由来の大規模改善提案（ChatGPT）を5フェーズに分割して実装する進め方
- [[0028-agent-consolidation-and-pipeline-placement]] — 重複エージェント2体を統合し孤立7体をパイプラインへ配置＋harness-lint検査#13
- [[0029-dynamic-test-false-failures]] — 動的テストの偽のFAILを一掃（HTTP配信/外部エラー分離/全canvas走査）＋無効なX-Frame-Options metaをJSフレームバスターへ
- [[0030-marketer-social-automation]] — マーケターの成果をSNS投稿まで到達させる（X/Instagram自動投稿＋認証情報なしで走る検査）
- [[0031-verification-cost-and-fast-path-guards]] — 検査の反復コストを実測して速い経路を分離（44秒→1秒）＋抜け道が広がらない検査4件
- [[0032-marketer-data-driven-evolve-loop]] — マーケターを反応駆動の週次学習ループへ（個別ゲーム自動告知＋反応計測＋/marketer-evolve）
- [[0033-note-monetization-automation-boundary]] — noteの自動化境界を「書くまで」に置く（規約リスク＞収益）
- [[0034-agent-contract-and-least-privilege]] — 全エージェントに契約・最小権限・必須検査を導入し検査#14で強制（19体→22体）

## 🧩 知見
- [[claude-md-project-rules]] — `CLAUDE.md` プロジェクトルールの要約
- [[static-hosting-security-limits]] — GitHub Pagesのセキュリティ制約・XSS/escHtmlのハマりどころ
- [[harness-maintenance-patterns]] — ハーネス保守のパターン・ハマりどころ（色ドリフト/スキル/hook2段/bash罠）
- [[web-audio-singing-synthesis]] — Web Audioでの歌声合成（放射特性/音量正規化/広いCanvasのGrid突き抜け/WAV解析で検証）
- [[native-dialog-toplayer-pitfall]] — ネイティブ`<dialog>`のトップレイヤーがposition:fixed要素を隠す不具合と対処
- [[verification-counts-the-wrong-thing]] — 検査が数える対象を間違えると故障注入をすり抜ける
- [[false-red-checks-are-worse-than-none]] — 偽の赤は検査が無いより悪い（必須検査が常に赤いなら、まず検査を疑う）

## 🔗 関連
- リポジトリルートの `CLAUDE.md` — プロジェクト全体ルール
- `.claude/skills/second-brain/SKILL.md` — 運用ルール詳細
