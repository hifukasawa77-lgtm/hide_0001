# スマホのObsidianと第二の脳をつなぐ（Android）

スマホで書いたメモを Claude Code が読み、Claude が書いた記憶をスマホで読めるようにする手順。
共用するVaultは**リポジトリの `obsidian-vault/`**（第二の脳）そのもの。

```
スマホのObsidian ──(Obsidian Git プラグイン)── GitHub: hifukasawa77-lgtm/main
                                                    obsidian-vault/
                                                        │
                                              Claude Code が読み書き
```

## なぜgitを挟むのか
Claude Code はクラウドのコンテナで動いていて、**スマホの中のフォルダには一切触れない**。
共通で触れる場所がGitHubリポジトリしかないので、そこを待ち合わせ場所にする。
Obsidian Sync（公式・有料）ではClaudeが読めないため採らない。

## ⚠️ 先に知っておくこと
**このリポジトリは公開リポジトリ**。`obsidian-vault/` に書いたものは誰でも読める。
パスワード・APIキー・他人の個人情報・人に見られたくない私事は書かないこと。
それらを扱いたくなったら、先にプライベートリポジトリへ分ける相談をすること。

## 手順（Android・初回のみ）

### 1. GitHubのアクセストークンを作る
スマホからpushするのに要る。PCのブラウザで:

1. GitHub → Settings → Developer settings → **Personal access tokens → Fine-grained tokens** → Generate new token
2. Repository access: **Only select repositories** → `hifukasawa77-lgtm/main`
3. Permissions → Repository permissions → **Contents: Read and write**
4. 生成された `github_pat_...` を控える（**リポジトリにも、このVaultにも書かない**。
   スマホのパスワードマネージャか、Obsidian Gitの設定欄に直接入れるだけにする）

### 2. Obsidian（Android）を入れて空のVaultを作る
Playストアから Obsidian → 「新規Vaultを作成」→ 名前は何でもよい（例: `main`）。
※ **既存のメモがあるVaultを使い回さない**。次の手順でリポジトリを取り込むので、空から始める方が安全。

### 3. Obsidian Git プラグインを入れる
設定 → コミュニティプラグイン → 制限モードをオフ → 閲覧 → **「Git」**（作者: Vinzent03）→ インストール → 有効化

### 4. リポジトリをクローンする
コマンドパレット（右下の⌘ or 設定から）→ `Git: Clone an existing remote repo`

- URL: `https://github.com/hifukasawa77-lgtm/main.git`
- Username: `hifukasawa77-lgtm`
- Password: 手順1のトークン
- 保存先: 今のVaultフォルダ（空のまま指定する）
- **Depth of clone: `1`** ← 必ず入れる（後述）

クローンが終わったら Obsidian を再読み込みする。

#### ⚠️ Depth は必ず `1` にする
このリポジトリは**履歴（`.git`）だけで 2.2GB** ある（過去にPNGで抱えていた画像の履歴が残っているため）。
既定の全履歴クローンだとスマホで 2.5GB 超を落とすことになり、まず終わらない。
`depth 1` なら最新の作業ツリーだけ＝**約 380MB** で済む。それでも Wi-Fi 必須。

この 380MB もほぼ全部が `assets/`（ゲーム画像 317MB）で、メモ本体（`obsidian-vault/`）は
**わずか 748KB**。Obsidian Git（モバイル）は一部フォルダだけ取ってくる機能を持たないので、
今の構成ではここは削れない。**スマホの空きや通信が厳しければ、次の「代案」を採ること。**

#### 代案: メモ専用のリポジトリに分ける
`obsidian-vault/` だけを入れた**別の小さなリポジトリ**を作り、スマホはそちらだけをクローンする
（数MBで済み、同期も一瞬）。ただし第二の脳の正本が2箇所に分かれるため、
どちらを正本にするか・どう突き合わせるかを決める必要がある。
重さが問題になったら深澤へ相談すること（勝手に分けない）。

### 5. Vaultの入口を obsidian-vault/ に寄せる
クローンするとリポジトリ全体（`index.html` や `assets/` も）がVaultに見える。
メモだけ見たいので、**設定 → ファイルとリンク → 除外フォルダ** に以下を足す:

```
assets, gamekit, scripts, cloudflare-worker, node_modules, .github, specs, marketing, note, local_llm, claudechord-vault
```

（`obsidian-vault/` と `docs/` だけが見えていれば十分）

### 6. 自動同期を入れる
Git プラグインの設定で:

- **Vault backup interval (minutes)**: `10`（10分ごとに自動コミット＆push）
- **Auto pull interval (minutes)**: `10`（Claudeが書いたものを自動で取り込む）
- **Pull updates on startup**: オン
- **Commit message**: `vault: モバイルから同期 {{date}}`

## 毎日の使い方

**深澤（スマホ）**
- 思いついたら Obsidian の新規ノート（既定で `00-Inbox/` に作られる）に書き捨てる
- 形式は自由。1行でよい
- 数分待つか、Gitプラグインの「Commit and sync」を手で押せば GitHub に上がる

**Claude Code（次のセッション）**
- セッション開始時に `00-Inbox/` のメモを**全文読む**（`.claude/hooks/second-brain-recall.sh`）
- 読んだら行き先へ振り分ける: 決定→`03-Decisions/` / 学び→`04-Knowledge/` /
  プロジェクト→`02-Projects/` / 作業記録→`01-Daily/`
- 振り分けたら `00-Inbox/` から消す（溜めると毎セッション読み直して文脈を食う）
- 行き先が決まらないものは消さずに深澤へ確認する

## つまずいたら

| 症状 | 原因と対処 |
|---|---|
| pushで認証エラー | トークンの期限切れ、または権限が Contents: Read only。手順1をやり直す |
| 「conflict」と出る | スマホとClaudeが同じファイルを同時に直した。Obsidianで該当ファイルを開いて `<<<<<<<` の箇所を手で直し、再度 Commit and sync |
| Claudeが書いたメモが出てこない | Auto pull が効いていない。コマンドパレット → `Git: Pull` を手で実行 |
| Vaultに大量のHTMLが見える | 手順5の除外フォルダが入っていない |
| クローンが終わらない・容量が足りない | Depth に `1` を入れ忘れている（全履歴 2.5GB を落としにいく）。Vaultを消してやり直す。depth 1 でも約380MBあるので、厳しければ手順4の「代案」へ |

## 同期しないもの
`.gitignore` で端末ごとに変わるだけのファイルを外している（衝突の元になるため）:
`obsidian-vault/.obsidian/workspace.json` / `workspace-mobile.json` / `cache` / `.trash/`

共有する設定は `obsidian-vault/.obsidian/app.json` だけ（新規ノートの作成先を `00-Inbox/` に固定している）。
