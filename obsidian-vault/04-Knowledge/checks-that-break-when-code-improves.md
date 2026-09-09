---
type: knowledge
tags: [knowledge, verification, refactoring, false-red, zero-1]
created: 2026-09-09
related: ["[[false-red-checks-are-worse-than-none]]", "[[verification-counts-the-wrong-thing]]", "[[MOC]]"]
---

# 実装を良くすると落ちる検査（もう1つの偽の赤）

[[false-red-checks-are-worse-than-none]] は「検査側の欠陥で最初から赤い」形だった。
これは別の形——**最初は緑で、実装を良くした瞬間に赤くなる**。動きは1つも変わっていないのに。

## 何が起きたか（2026-09-09〜10・ZERO-1 PC版）

1セッションで **6回**踏んだ。すべて「検査が実装の置き場所か書き方を照合していた」。

| 何を照合していたか | いつ落ちたか |
|---|---|
| `app/page.tsx` に `navigator.geolocation.getCurrentPosition` が在ること | 現在地の取得を `use-current-location.ts` へ切り出した |
| `app/page.tsx` に `from "./settings-face-auth.tsx"` が在ること | 設定を「開いてから読む」（lazy）形にした |
| `Math.max(context.currentTime, current.playAt)` という式 | 同じ動きの別の書き方に直した |
| `follow.leaveBottom();` という行 | 呼び出し方を変えた |
| 中継役に `isBinary ? data : data.toString("utf8")` が在ること | 形合わせを `app/ws-sock.ts` へ切り出した |
| 提供元の項目名 `input_audio_format: "pcm16"` | 提供元が beta→GA で形を総入れ替えした |

## いちばん高くつくのは、直す手間ではない

落ちた検査を直すのは数分で済む。本当のコストは**「良くすると赤くなる」体験**が、
改善そのものを止めることにある。`page.tsx` が行数上限に当たったとき、
切り出すたびに無関係な検査が落ちるなら、次からは切り出さずに詰め込む方へ倒れる。

## 決まり

- **見るのは振る舞いだけ。** 値が合っているか（両側で同じ定数を使っているか）、
  意味が在るか（`server_vad` か・日本語の指示が在るか）、**繋がっているか**
  （実体へ import されているか。どのファイルからかは問わない）
- **「このファイルに置く」ことが要件のときだけ、場所を照合してよい。** そのときは
  理由をコメントに書く（例: 読み込むだけで副作用が起きるファイルへロジックを書き戻させない）
- **外部サービスの項目名は照合しない。** 相手の形はこちらの都合で変わらない。
  正しく追随した側が落ちる検査は、追随を妨げるだけ

## なぜ「書いてあるのに」踏んだのか（これが本題）

`zero-1-local-ai/docs/開発の注意.md` §6 には
**「検査は `app/page.tsx` を名指しで読まない」と既に書いてあった**。それでも6回踏んだ。理由は2つ:

1. **書き方が狭すぎた。** `page.tsx` だけの話に読めるので、他のファイル名・式・
   提供元の項目名を照合するのは「別の話」に見える。→ 一般則へ書き直した
2. **そのファイルは自動で読まれない。** `zero-1-local-ai` には `CLAUDE.md` も
   `.claude/` も無く、`docs/開発の注意.md` は**思い出した人しか読まない**。
   このセッションでも、最後に `/self-improve` を回すまで一度も開かなかった

→ **想起されない場所にある学びは、無いのと同じ。** 蓄積（書く）と反映（ルール化）が
揃っていても、**自動で読まれる場所に無ければループは閉じない**。

## 昇格先

- `zero-1-local-ai/docs/開発の注意.md` §6（一般則へ書き直し）— 2026-09-09
- `.claude/agents/verifier.md` 検査の原則#3（新設）— 2026-09-09

→ `zero-1-local-ai/docs/開発の注意.md` §6 と `.claude/agents/verifier.md` 原則#3 に昇格済み（2026-09-09）
