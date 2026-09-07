# ZERO-1 Mobile — クラウド頭脳（BYOK オプトイン機能）要件定義書／基本設計書／詳細設計書

- 起票: Planner
- 依頼元: 深澤（PM）
- 対象ファイル: `zero-1-mobile.html`, `assets/js/zero1-worker.js`（変更なし想定・確認事項あり）, `sw.js`（変更なし想定・確認事項あり）, `scripts/verify-zero1-mobile.mjs`（拡張）
- 参考: 深澤提示の外部リポジトリ https://github.com/Avinashb722/jarvis-ai-assistant （README調査のみ。コードは移植しない）
- 日付: 2026-09-07

---

## 0. 発端と確定した前提（必ず遵守）

深澤の直接指示「頭脳としてGPT-5.6のAPIを使う」は、以下の **BYOK（Bring Your Own Key）方式** に確定済み。
この前提を崩す実装（運営側キーの導入・サーバー経由の代理送信等）は行わない。

1. リポジトリ・環境変数・設定ファイルにAPIキーを一切置かない（CLAUDE.md「APIキーに関する禁止事項」）
2. 利用者（サイト訪問者）が自分のOpenAI APIキーを画面で入力し、**端末の `localStorage` にのみ保存**する
3. 課金は各利用者自身が負う。ZERO-1 Mobile運営側（このサイト）は一切課金されない
4. 既定（デフォルト）は今まで通りローカルWebGPU LLM。GPT-5.6クラウド頭脳は**任意のオプトイン機能**として追加する

**この前提により Accounting-Agent の課金監視対象にはならない**（運営側の課金操作が存在しないため）。
ただし念のため PMO/Accounting へは「利用者自身が負う従量課金の外部API連携を追加する」旨を共有すること。

---

## 1. 要件定義書

### 1.1 背景・目的

ZERO-1 Mobile は「端末内で完結するローカルLLM」が核（0.5〜3B級・WebGPU）。賢さはクラウド勢に及ばないため、
「もっと賢い答えが欲しい」利用者向けに、**自分のAPIキーで動くクラウド頭脳**を任意追加する。
ローカル完結という売り・オフライン動作・既定の体験は一切変更しない。

### 1.2 名称（論点1の結論）

**"Jarvis" 等の商標性のある固有名詞は使用しない**（Marvel/Disneyの商標リスク。Legal-Checkerが確実に検出する）。

| 対象 | 採用名 | 備考 |
|---|---|---|
| 機能名（画面表示） | **クラウド頭脳 / Cloud Brain** | 既存の「スマホの中だけで動くAI」と対になる汎用名。ZERO-1の「頭脳」表現に寄せた |
| 内部識別子 | `brain: 'local' \| 'cloud'` | コード内の状態名。商標語を含まない |
| 将来の常時リスニング機能（本フェーズでは実装しない。§1.6参照） | ハンズフリーモード / Hands-free mode | 深澤指定の代替名候補をそのまま採用。ウェイクフレーズは固有名（"Hey Jarvis"相当）を作らず「マイクを常時オン」のような機能名で説明する |

### 1.3 機能要件一覧（MoSCoW）

#### Must
- **M1**: 設定シートに「クラウド頭脳 / Cloud Brain」トグルを追加する。**既定OFF**
- **M2**: OpenAI APIキー入力欄（`type="password"`）。保存は `localStorage` のみ、キー名は `zero1-mobile-cloud-key`。
  保存後はマスク表示（例: `sk-...ab12`）。**削除ボタン**を独立して置く（既存の「モデルを削除する」と同じ設計思想）
- **M3**: クラウド頭脳ONかつキー保存済みのとき、送信メッセージは `https://api.openai.com` へ直接 `fetch`（ストリーミング）する。
  レスポンスの組み立ては既存の `finishAnswer`（`textContent` ベース）を再利用し、**新たに`innerHTML`を使わない**
- **M4**: 失敗は理由を残す（既存哲学の踏襲）。401/429/5xx/ネットワーク到達不能/モデル未存在(404)を判別し、
  日本語の次の一手を提示する。**キー自体を絶対にエラー文言・DOM・ログに出さない**
- **M5**: クラウド頭脳が生成中でも画面をブロックしない（`fetch`は非同期I/Oのため元々ブロックしない。
  Web Workerへ追い出す必要は無い＝WebLLMの「別スレッド必須」はWASMコンパイル等CPU拘束作業に対する対策であり、
  ネットワークI/Oには該当しない。設計書にこの判断根拠を明記する）
- **M6**: 「止める」ボタンは、クラウド生成中は `AbortController.abort()` でfetchを中断する（既存の
  `interruptGenerate` と同じUXで統一）
- **M7**: クラウド頭脳が有効な間、ヘッダーの `#head-note` と設定シートに「質問はOpenAIへ送信されます」の
  持続的な表示を出す（既存の「会話はこの端末から出ません」という既定の約束を、オプトイン時だけ上書きする）
- **M8**: WebGPU非対応端末（`canRun(env)` が false）でも、クラウド頭脳だけなら使える動線を用意する
  （ローカルモデルのダウンロード無しで直接チャット画面へ進める入口を setup 画面に追加）
- **M9**: CSPの `connect-src` に `https://api.openai.com` を追加する（詳細設計書§3.4）

#### Should
- **S1**: クラウド頭脳の呼び出し失敗時、ローカルモデルが読み込み済みなら「ローカルモデルで答える」の
  選択肢をボタンで提示する（**自動フォールバックはしない**。黙って切り替えると何が起きたか利用者に伝わらない）
- **S2**: 応答完了時のタグ表示（`tagMessage`）で「クラウド頭脳(GPT) · 速さ」を明示し、ローカル／端末内ツール／
  クラウドのどれが答えたか常に区別できるようにする（既存の「ツールかモデルか区別する」原則の踏襲）
- **S3**: モデル名は既定 `gpt-5.6` 定数を持ちつつ、詳細設定（`<details>` で折りたたみ）でモデル名を
  上書きできるようにする（論点5・下記「未確定事項」参照。誤ったモデルIDでもAPIが404を返し理由が残るため、
  ハードコードのリスクを緩和できる）

#### Could
- **C1**: OpenAI利用規約・料金は利用者自身のアカウントに適用される旨の注記をキー入力欄の直下に表示
- **C2**: 将来のハンズフリーモード（§1.6）
- **C3**: 将来のTTS音声選択（性別・声質。既存 `SpeechSynthesis` の `getVoices()` から選ばせる）
- **C4**: 将来の音声認識の多言語切り替え（現状 `lang='ja-JP'` 固定）

#### Won't（本フェーズ）
- **W1**: 生体認証（顔認証・指紋認証）— §1.7で理由を明記
- **W2**: サーバー経由の代理APIキー運用・運営側キーでの提供
- **W3**: クラウド頭脳のデフォルト化（既定は今後もローカルのまま）

### 1.4 非機能要件

- **プライバシー**: クラウド頭脳ONの間の送信内容（会話履歴・端末内ツールで得たサイト文脈）はOpenAIへ送信される。
  ローカル頭脳／端末内ツールのみの経路は変更なし（引き続き外部送信ゼロ）
- **セキュリティ**: APIキーは `localStorage`（同一オリジンのみ参照可）。CSPの `connect-src` ホワイトリストにより、
  XSSが仮に発生してもキーを任意の外部ドメインへ持ち出す `fetch`/`XHR` は失敗する（多層防御。ただしXSS自体の
  混入を防ぐのが第一防御＝`textContent`徹底）
- **可用性**: OpenAI API障害時もローカル頭脳・端末内ツールは影響を受けず引き続き使える（疎結合を維持）
- **i18n**: 新規UI文言はすべて日英併記（既存の `<b>日本語</b><small>説明</small>` パターンに合わせる）
- **アクセシビリティ**: トグルボタンに `aria-pressed`、新規フォームに `aria-label` を付与
- **互換性**: `fetch` + `ReadableStream` が使える環境であれば動作（WebGPU非依存。M8のとおりWebGPU非対応端末の
  受け皿にもなる）

### 1.5 制約条件

- CLAUDE.md「APIキーに関する禁止事項」「有料API禁止」はいずれも**運営側が支払う**ケースを禁じるものであり、
  利用者自身が自分のキーで自分の分だけ課金される本方式（BYOK）はこの禁止に抵触しない（§0で確定済み）。
  ただし念のため深澤へこの解釈の最終確認を求める（停止条件参照）
- サイバーパンク演出禁止・黒背景+シアン/パープル系のカラースキームを維持。新規UIも既存 `.row`/`.sheet`/`.ghost`
  クラスをそのまま使う（新しい配色を持ち込まない）
- フレームワーク不使用・ビルドツール不使用の方針を維持（`fetch`のみで実装、追加ライブラリ不要）

### 1.6 論点2の結論: ウェイクワード＋常時リスニング

**本フェーズでは実装しない（Could — 将来検討）**。理由:

- `webkitSpeechRecognition`（Web Speech API）は多くのブラウザ実装で音声をGoogle等のクラウド音声認識サーバーへ
  送信する。既存のプッシュ・トゥ・トーク（マイクボタン押下時のみ・`continuous:false`）は「押した時だけ」の
  明示操作なので実害は小さいが、**常時リスニング**は「話していないときも継続的にマイクが有効」という体験変化であり、
  「端末内で完結する」という核心の売りと矛盾する度合いが大きい
- 実装する場合の設計方針（将来実装時にこの結論を踏襲すること）:
  1. 既定OFF。設定シートで明示的にONにした人だけが対象（エアタッチの「静止クリック」と同じ既定OFFの考え方）
  2. ON時は「音声はブラウザの音声認識機能を経由し、多くの環境でクラウドへ送信されます」の注意書きを
     トグル直下に常時表示する
  3. `SpeechRecognition`（非webkitプレフィックス）が使え、かつオンデバイス認識に対応する環境ではそちらを優先する
     （判定できない場合は上記の注意書きを表示したままにする＝安全側に倒す）
  4. ウェイクワード自体に固有名詞ブランドを作らない（例:「聞き取り中」の視覚表示で足りるなら音声起動語は不要）

### 1.7 論点3の結論: 生体認証（顔認証・指紋認証）

**スコープ外（Won't）**。理由:

- ブラウザから直接 OpenCV（顔認証）や ADB（Android指紋認証）は利用できない
- Web標準の近い代替は **WebAuthn**（端末のプラットフォーム認証器＝指紋/顔をブラウザ経由で使う。生体データ自体は
  サイトへ渡らない）。技術的には実装可能
- しかし ZERO-1 Mobile はログインアカウントを持たない公開ページで、保護すべき「個人の秘密」は
  実質 **BYOKのAPIキーのみ**。WebAuthnでキーの読み出し・使用をロックする案はCould候補として記録するが、
  今回のスコープには含めない（体験の複雑化に見合う保護対象が薄いため）
- 将来ニーズが出た場合は WebAuthn（`navigator.credentials`）でのキー閲覧ロックを別チケットで検討する

### 1.8 論点4の結論: TTS

現行の `SpeechSynthesisUtterance`（ブラウザ標準 `SpeechSynthesis` API）をそのまま使い続ける。
多くの環境で端末内処理（プラットフォームの音声合成エンジン）だが、一部ブラウザはクラウド音声を使う実装もあるため
「必ず端末内」とは断定しない。**変更不要**。性別・声質の選択（`getVoices()`）はCould（C3）として将来検討。

### 1.9 論点5の結論: CSPとAPI到達性

現状の `zero-1-mobile.html` のCSP（18行目）:

```
connect-src 'self' https://cdn.jsdelivr.net https://huggingface.co https://*.huggingface.co
  https://*.hf.co https://raw.githubusercontent.com https://storage.googleapis.com;
```

`https://api.openai.com` が無いため、追加しないとクラウド頭脳の `fetch` は**CSP違反で無言に近い形で失敗する**
（`document.addEventListener('securitypolicyviolation', …)` が既に仕込まれているため理由の収集automatic自体は
効くが、UIへの反映が要る）。**`connect-src` に `https://api.openai.com` を追加する**（詳細設計書§3.4）。

`sw.js` は `new URL(req.url).origin !== self.location.origin` でオリジン非一致を即座に見送る
**オリジン非依存の実装**（ホワイトリスト方式ではない）ため、`api.openai.com` への `fetch` は
**追加コード不要でそのまま素通しされる**。§4「変更不要ファイル」に記載。

### 1.10 未確定事項（深澤へ確認・停止条件）

- **「GPT-5.6」というモデルIDが実在するかは本仕様書の時点で未確認**（Plannerの知識では検証不能）。
  ハードコードした場合、モデル名が誤っていると `404 model_not_found` が返り**理由は残るため無言故障にはならない**が、
  無駄な手戻りを避けるため、実装直前に深澤またはCode-Generatorが OpenAI の現行モデル一覧で正式なモデルIDを
  確認すること。仕様上は `CLOUD_MODEL_DEFAULT` という**差し替え可能な定数1箇所**に閉じ込め、かつ利用者が
  詳細設定でモデル名を上書きできる（S3）ため、名称が変わっても機能自体は壊れない設計にしてある
- **エンドポイント形式（Chat Completions `/v1/chat/completions` vs 新しい Responses API `/v1/responses`）も
  実装時点の最新ドキュメントで確認すること**。本仕様は実装が最も広く枯れている Chat Completions
  ストリーミング形式（`data: {...}\n\n` のSSE、`[DONE]`終端）を前提に設計しているが、Responses API が
  現行の推奨である場合はそちらへ差し替えて構わない（SSEパース関数を差し替えるだけで済むよう分離設計にする）
- 上記2点は「実装を止める」停止条件ではなく、**実装直前の最終確認事項**として記録する

---

## 2. 基本設計書

### 2.1 システム構成（変更差分のみ）

```
[ブラウザ / zero-1-mobile.html]
  ├─ ローカル頭脳経路（既存・変更なし）
  │    画面スレッド ──postMessage──> assets/js/zero1-worker.js ──CDN取得──> cdn.jsdelivr.net(WebLLM本体)
  │                                                              └─fetch重み──> huggingface.co 等
  │
  ├─ クラウド頭脳経路（新規）
  │    画面スレッド ──fetch(stream)──> https://api.openai.com/v1/chat/completions
  │         │  Authorization: Bearer <localStorageのキー>
  │         └─ 別スレッド不要（非同期I/Oのため画面をブロックしない。§1.3 M5）
  │
  └─ 端末内ツール経路（既存・変更なし）assets/js/zero1-tools.js（外部送信なし）

[sw.js]  origin不一致は素通し（既存実装のまま。api.openai.comも対象。変更不要）
```

### 2.2 画面遷移（差分）

```
setup画面
 ├─ [既存] モデルを選ぶ → 取得 → 起動する → chat画面（brain=local）
 └─ [新規] 「クラウド頭脳だけで始める」カード
       → APIキー入力（未保存なら） → 保存 → chat画面（brain=cloud, ローカルモデル取得なし）

chat画面（設定シート）
 └─ [新規] 「クラウド頭脳」トグル ON/OFF
       ON かつ キー未保存 → キー入力欄を展開（M2）
       ON かつ キー保存済み → 以後の送信はクラウド経由
       OFF → 以後の送信はローカル頭脳（state.engineが無ければ既存のsetup誘導）
```

state遷移: `state.brain`（`'local'` 既定 / `'cloud'`）。送信時の分岐は `send()` 内、
`answerWithTool()` の**後**（端末内ツールは常に最優先。§既存コードコメントの原則を継承）。

### 2.3 データ構造

```js
// localStorage 追加キー（すべて zero-1-mobile.html 内で完結、他ページと共有しない）
'zero1-mobile-brain'       // 'local' | 'cloud'（既定 'local'）
'zero1-mobile-cloud-key'   // string（生のAPIキー。JSON.stringifyされた文字列として保存される既存writeStore踏襲）
'zero1-mobile-cloud-model' // string（省略可。既定は定数 CLOUD_MODEL_DEFAULT）

// state 追加フィールド
state.brain        // 'local' | 'cloud'
state.cloudKey      // string | null（メモリ上のキャッシュ。読み出しは起動時に1回）
state.cloudModel    // string（既定 CLOUD_MODEL_DEFAULT）
state.cloudAbort    // AbortController | null（生成中のfetchを止めるため）
```

### 2.4 主要コンポーネントの役割

| コンポーネント | 役割 |
|---|---|
| `readCloudKey()` / `writeCloudKey(key)` / `clearCloudKey()` | キーの読み書き削除。`readStore`/`writeStore` の薄いラッパー |
| `maskKey(key)` | 表示用マスク（`sk-...` + 末尾4文字のみ） |
| `cloudReady()` | `state.brain==='cloud' && Boolean(state.cloudKey)` |
| `streamCloudAnswer(node, context, opts)` | OpenAI へのストリーミング呼び出し・逐次描画。`streamAnswer` と対になる関数 |
| `parseSSE(reader, onDelta)` | `data: {...}` 行を分割・JSON化してコールバックへ渡す純粋寄りの補助関数（検査しやすいよう分離） |
| `classifyCloudError(status, bodyText, cause)` | 401/429/404/5xx/ネットワーク不能を判別し `{hint, retryable}` を返す |
| `sendCloud(clean)` | `send()` からクラウド分岐時に呼ばれる本体。UI描画・履歴保存・エラー提示を担う |

---

## 3. 詳細設計書

### 3.1 ファイル構成案（変更ファイルのみ）

```
zero-1-mobile.html          変更（CSP・HTML・スクリプト内追加関数・window.ZERO1_MOBILE拡張）
assets/js/zero1-worker.js   変更なし（クラウド頭脳はWorkerを経由しない。§1.3 M5の理由による）
sw.js                       変更なし（オリジン非依存の素通し実装が既にapi.openai.comをカバー）
scripts/verify-zero1-mobile.mjs  拡張（§5 受け入れ条件）
```

### 3.2 HTML変更（setup画面・具体位置: `zero-1-mobile.html` 269行目付近 `#model-card` の後）

`#model-card` の閉じタグ（288行目 `</div>`）の直後に、新規カードを追加する:

```html
<div class="card" id="cloud-entry-card">
  <h2>クラウド頭脳だけで始める / Start with Cloud Brain only</h2>
  <p class="progress-note">この端末にモデルをダウンロードせず、自分のOpenAI APIキーで始めます。
    質問はOpenAIへ送信されます。<br>
    Skip the on-device download and use your own OpenAI API key instead. Messages are sent to OpenAI.</p>
  <input type="password" id="cloud-entry-key" placeholder="sk-..." autocomplete="off"
    aria-label="OpenAI APIキー / OpenAI API key" style="width:100%;margin:8px 0">
  <button class="ghost" id="btn-cloud-entry" style="width:100%">クラウド頭脳で始める / Start with Cloud Brain</button>
</div>
```

- `!canRun(env)` のとき（デバイスチェック失敗時）は `#cloud-entry-card` に `class="highlight"` 等で強調する
  （M8: WebGPU非対応端末の受け皿を目立たせる）。装飾は既存 `.card` の枠内で完結させ、新しい配色は作らない
- `btn-cloud-entry` クリック時: `cloud-entry-key` の値を `writeCloudKey()` → `state.brain='cloud'` →
  `writeStore(BRAIN_KEY,'cloud')` → `$('setup').classList.add('hidden')` →
  `$('chat').classList.remove('hidden')` → `$('composer').classList.remove('hidden')`
  （既存1596-1598行のパターンをそのまま再利用。ローカルモデルロード関連の呼び出しは一切行わない）

### 3.3 HTML変更（設定シート・具体位置: 313-351行目 `#sheet` 内）

336行目「モデルを変える」行の直後に新規行を追加:

```html
<div class="row">
  <span class="t"><b>クラウド頭脳 / Cloud Brain</b>
    <small id="cloud-note">自分のOpenAI APIキーで、より賢い返答を受け取れます。送信内容はOpenAIへ届きます。</small></span>
  <button class="ghost" id="btn-cloud" aria-pressed="false">OFF</button>
</div>
<div class="row sub" id="cloud-options" hidden>
  <span class="t"><b>APIキー / API key</b>
    <small id="cloud-key-status">未設定 / Not set</small></span>
  <span class="opts">
    <input type="password" id="cloud-key-input" placeholder="sk-..." autocomplete="off"
      aria-label="OpenAI APIキー / OpenAI API key">
    <button class="ghost" id="btn-cloud-save">保存 / Save</button>
    <button class="ghost" id="btn-cloud-clear">削除 / Remove</button>
  </span>
</div>
<div class="row sub" id="cloud-advanced" hidden>
  <span class="t"><b>モデル名（上級者向け）/ Model (advanced)</b>
    <small>空欄なら既定のモデルを使います / Leave blank to use the default model</small></span>
  <input type="text" id="cloud-model-input" placeholder="gpt-5.6">
</div>
```

`air-options`（324-332行目）と同じ「機能が有効な間だけ出す」設計を踏襲し、`cloud-options`/`cloud-advanced` は
`btn-cloud` がONの間だけ `hidden` を外す。

### 3.4 CSP変更（18行目）

`connect-src` へ `https://api.openai.com` を追加:

```
connect-src 'self' https://cdn.jsdelivr.net https://huggingface.co https://*.huggingface.co
  https://*.hf.co https://raw.githubusercontent.com https://storage.googleapis.com https://api.openai.com;
```

（追記のみ。既存の許可ホストは変更しない）

### 3.5 JavaScript追加関数（配置目安: 既存 `streamAnswer`/`isNetworkFailure` 群の近く、1650〜1900行付近）

```js
const BRAIN_KEY = 'zero1-mobile-brain';
const CLOUD_KEY_KEY = 'zero1-mobile-cloud-key';
const CLOUD_MODEL_KEY = 'zero1-mobile-cloud-model';
// ★未確定: 実装直前に現行のOpenAIモデル一覧で正式IDを確認すること（§1.10）
const CLOUD_MODEL_DEFAULT = 'gpt-5.6';
const CLOUD_API_URL = 'https://api.openai.com/v1/chat/completions';

function readCloudKey() { return readStore(CLOUD_KEY_KEY, null); }
function writeCloudKey(key) { writeStore(CLOUD_KEY_KEY, key); }
function clearCloudKey() { try { localStorage.removeItem(CLOUD_KEY_KEY); } catch { /* 既存方針: 失敗は無視 */ } }

/** 表示用マスク。先頭と末尾だけ見せる。ログにも画面にもこれ以外の形で出さない */
function maskKey(key) {
  if (!key || key.length < 8) return '••••';
  return `${key.slice(0, 3)}…${key.slice(-4)}`;
}

function cloudReady() { return state.brain === 'cloud' && Boolean(state.cloudKey); }

/**
 * SSEの行を分割してJSONへ。OpenAI Chat Completions のストリーミング形式
 * （`data: {...}\n\n`・終端 `data: [DONE]`）を前提にする。
 * ★チャンクが `\n\n` の境目で分割されるとは限らない。バッファへ貯めてから切り出す
 *   （検査でわざと変な位置に分割したチャンクを流し込んで確認する。§5）
 */
async function parseSSE(reader, onDelta) {
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 2);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const json = JSON.parse(payload);
        const delta = json.choices?.[0]?.delta?.content ?? '';
        if (delta) onDelta(delta);
      } catch { /* 不完全な行は無視（次のチャンクで揃うことがある） */ }
    }
  }
}

/**
 * クラウド頭脳の失敗理由を判別する。
 * ★キーの値そのものは絶対に含めない。status とOpenAIのエラーcodeだけを見る
 */
function classifyCloudError(status, bodyText, cause) {
  if (cause?.name === 'AbortError') return { hint: '', retryable: false, stopped: true };
  if (status === 401) return { hint: 'APIキーが正しくありません。設定で確認してください / Invalid API key', retryable: false };
  if (status === 429) return { hint: '利用上限に達しています。しばらくしてから、またはOpenAI側の請求設定をご確認ください / Rate limited', retryable: true };
  if (status === 404) return { hint: `指定したモデルが見つかりません（${state.cloudModel}）。設定でモデル名を確認してください / Model not found`, retryable: false };
  if (status >= 500) return { hint: 'OpenAI側で問題が起きています。しばらくしてからお試しください / OpenAI server error', retryable: true };
  if (!status) return { hint: '通信できませんでした。電波状況をご確認ください / Could not reach the server', retryable: true };
  return { hint: `エラーが起きました（status ${status}）/ Request failed`, retryable: true };
}

/** クラウド頭脳での1回ぶんの応答。streamAnswer と対になる */
async function streamCloudAnswer(node, context = '') {
  const controller = new AbortController();
  state.cloudAbort = controller;
  const body = bodyOf(node);
  const began = performance.now();
  let firstAt = 0, tokens = 0, answer = '';
  const res = await fetch(CLOUD_API_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${state.cloudKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: state.cloudModel || CLOUD_MODEL_DEFAULT,
      messages: buildMessages(state.history, 8, 1200, context),
      stream: true, temperature: 0.6, max_tokens: 512,
    }),
    signal: controller.signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error('cloud_http_error');
    err.status = res.status; err.bodyText = text;
    throw err;
  }
  await parseSSE(res.body.getReader(), (delta) => {
    if (state.stopping) return;
    if (!answer) { node.classList.remove('pending'); firstAt = performance.now(); }
    tokens += 1; answer += delta;
    body.textContent = answer;
    $('chat').scrollTop = $('chat').scrollHeight;
  });
  state.speed = firstAt ? { tokens, firstMs: firstAt - began, streamMs: performance.now() - firstAt } : null;
  return answer;
}
```

`send()` の分岐（1810行目付近、`answerWithTool` 呼び出しの直後）:

```js
async function send(text) {
  const clean = text.trim();
  if (!clean || state.busy) return;
  if (answerWithTool(clean)) return;
  if (cloudReady()) { await sendCloud(clean); return; }
  // ↓ 既存のローカル頭脳の処理はそのまま
  ...
}

async function sendCloud(clean) {
  state.busy = true; state.stopping = false; paintSend(true);
  void keepAwake();
  $('input').value = '';
  state.history.push({ role:'user', text:clean });
  addMessage('user', clean).dataset.h = String(state.history.length - 1);
  paintSuggestions();
  const node = addMessage('assistant', '考えています…', true);
  const context = buildSiteContext(clean, window.AGENT_DATA ?? null);
  let answer = '';
  try {
    answer = await streamCloudAnswer(node, context);
    if (!answer) answer = state.stopping ? '（止めました / Stopped）' : 'うまく答えられませんでした。もう一度お願いします。';
    node.classList.remove('pending');
    finishAnswer(node, answer);
    const speed = speedText(state.speed);
    tagMessage(node, [state.stopping ? '途中で止めました / Stopped' : '', `クラウド頭脳(GPT) / Cloud brain`, speed].filter(Boolean).join(' · '));
    state.history.push({ role:'assistant', text:answer });
    node.dataset.h = String(state.history.length - 1);
    writeStore(HISTORY_KEY, state.history.slice(-40));
    paintMemoryBoundary();
    if (state.speak) speak(answer);
  } catch (cause) {
    node.classList.remove('pending');
    const { hint, retryable, stopped } = classifyCloudError(cause?.status, cause?.bodyText, cause);
    if (!stopped) {
      bodyOf(node).textContent = hint;
      if (retryable) actionMessage(node, 'もう一度試す / Retry', () => sendCloud(clean));
      // ★自動フォールバックはしない（S1）。選べる形でだけ提示する
      if (state.engine) actionMessage(node, 'ローカルモデルで答える / Answer locally instead', () => {
        state.brain = 'local'; writeStore(BRAIN_KEY, 'local');
        node.remove(); state.history.pop();
        send(clean);
      });
    } else {
      bodyOf(node).textContent = '（止めました / Stopped）';
    }
  } finally {
    state.busy = false; state.cloudAbort = null; paintSend(false); paintSuggestions();
  }
}
```

- `stopGenerating()` の拡張:
```js
function stopGenerating() {
  if (!state.busy) return false;
  state.stopping = true;
  try { state.engine?.interruptGenerate?.(); } catch { /* 既存 */ }
  try { state.cloudAbort?.abort(); } catch { /* 既存 */ }
  return true;
}
```

- `#head-note` の切り替え（設定シートの `btn-cloud` トグルイベント内、既存 `btn-speak` イベント §2043行目の隣に追加）:
```js
$('btn-cloud').addEventListener('click', () => {
  const next = state.brain === 'cloud' ? 'local' : 'cloud';
  if (next === 'cloud' && !state.cloudKey) { $('cloud-options').hidden = false; return; } // まずキーを求める
  state.brain = next; writeStore(BRAIN_KEY, next);
  $('btn-cloud').textContent = next === 'cloud' ? 'ON' : 'OFF';
  $('btn-cloud').setAttribute('aria-pressed', String(next === 'cloud'));
  $('cloud-options').hidden = next !== 'cloud';
  $('cloud-advanced').hidden = next !== 'cloud';
  $('head-note').textContent = next === 'cloud'
    ? 'クラウド頭脳使用中・質問はOpenAIへ送信されます / Cloud brain active — sent to OpenAI'
    : 'スマホの中だけで動きます / Runs entirely on this phone';
});
$('btn-cloud-save').addEventListener('click', () => {
  const key = $('cloud-key-input').value.trim();
  if (!key) return;
  state.cloudKey = key; writeCloudKey(key);
  $('cloud-key-input').value = '';
  $('cloud-key-status').textContent = `保存済み: ${maskKey(key)} / Saved`;
});
$('btn-cloud-clear').addEventListener('click', () => {
  clearCloudKey(); state.cloudKey = null;
  $('cloud-key-status').textContent = '未設定 / Not set';
  if (state.brain === 'cloud') { state.brain = 'local'; writeStore(BRAIN_KEY, 'local'); $('btn-cloud').click(); }
});
```

- 起動時初期化（既存の2082-2085行目付近、`state.history = readStore(...)` の並びに追加）:
```js
state.brain = readStore(BRAIN_KEY, 'local');
state.cloudKey = readCloudKey();
state.cloudModel = readStore(CLOUD_MODEL_KEY, CLOUD_MODEL_DEFAULT);
if (state.brain === 'cloud' && !state.cloudKey) state.brain = 'local'; // キーが無いのにONは矛盾。安全側へ
if (state.brain === 'cloud') $('head-note').textContent = 'クラウド頭脳使用中・質問はOpenAIへ送信されます / Cloud brain active — sent to OpenAI';
```

### 3.6 `window.ZERO1_MOBILE` ブリッジへの追加（716行目付近。既存コメント「足し忘れると検査側が
"is not a function" で落ちる」に従い、新規関数を全て足す）

```js
window.ZERO1_MOBILE = { /* 既存の列挙 … */,
  readCloudKey, writeCloudKey, clearCloudKey, maskKey, cloudReady,
  parseSSE, classifyCloudError, streamCloudAnswer, sendCloud,
  CLOUD_MODEL_DEFAULT, CLOUD_API_URL };
```

### 3.7 変更不要ファイル（確認済み・再掲）

- `assets/js/zero1-worker.js`: 変更不要（クラウド頭脳はWorkerを経由しない。§1.3 M5）
- `sw.js`: 変更不要（67行目 `if (new URL(req.url).origin !== self.location.origin) return;` が
  オリジン非依存の素通しのため、`api.openai.com` は既にカバー済み）。念のため
  `node scripts/verify-service-worker.mjs` を回帰確認する

---

## 4. Graphic-Designer / Music-Generator への発注

**発注なし**。新規UIは既存の `.card`/`.row`/`.ghost`/`.sub` クラスを流用するテキストベースの構成で完結する
（新規アイコン・画像・SEは不要）。

---

## 5. 受け入れ条件（完成の定義）

- [ ] `node scripts/verify-zero1-mobile.mjs` が緑（既存154項目 + 下記の新規追加項目）
- [ ] `node scripts/verify-service-worker.mjs` が緑（`api.openai.com` を含むオリジン非依存の素通しに回帰なし）
- [ ] `bash .claude/skills/dynamic-test/run.sh zero-1-mobile.html` が PASS
- [ ] Security: `innerHTML`/`eval`/`new Function` を新規コードで使っていない（静的grep）。
      XSS注入試験（クラウド応答に `<img src=x onerror=...>` を模したテキストを混ぜて `textContent` のみで
      描画され実行されないことを確認）が PASS
- [ ] i18n: 新規UI文言（トグル・キー入力・エラーメッセージ）が全て日英併記
- [ ] §1.3 Must（M1〜M9）が全て実装されている（Evaluatorが採点）

### `scripts/verify-zero1-mobile.mjs` への新規追加項目（見積もり: 約20〜24項目）

1. CSPの `connect-src` に `https://api.openai.com` が含まれる（静的チェック）
2. 初回ロード時（localStorage空）に `state.brain === 'local'`（既定OFFの確認）
3. キー未保存のまま `btn-cloud` をONにしても `state.brain` は `'local'` のまま（キー要求が先）
4. キー保存 → `state.cloudKey` に反映 → 画面のマスク表示が生キーを含まない（DOM全文をgrepしてキー文字列が
   一切出現しないことを確認）
5. `classifyCloudError` の分岐網羅（401/429/404/5xx/ネットワーク不能/AbortError）
6. `parseSSE` が `\n\n` 境界をまたいで分割されたチャンクでも正しく復元できる（意地悪な分割を注入）
7. `route` でOpenAIエンドポイントをモックし、実際のUIフロー（送信→ストリーミング表示→タグ表示に
   「クラウド頭脳(GPT)」が出る）を確認
8. `route` で401を返し、キーを含まないエラーメッセージが表示され「もう一度試す」ボタンが出ないこと
   （401はretryable falseのため）を確認
9. `route` でネットワーク中断（abort）を起こし、「もう一度試す」ボタンが機能し再送されることを確認
10. 「止める」ボタン押下で `AbortController.abort()` が呼ばれ、ストリーミングが中断されることを確認
11. クラウド呼び出し失敗時、`state.engine` がある場合のみ「ローカルモデルで答える」ボタンが出ることを確認
12. 「クラウド頭脳だけで始める」導線で、WebLLM本体（`cdn.jsdelivr.net`）・重み（huggingface.co等）への
    リクエストが一切発生しないことを確認（`page.on('request')` で監視）
13. `!canRun(env)`（WebGPU非対応を模擬）のとき、クラウド頭脳の入口カードが表示されること
14. `btn-cloud-clear` でキー削除後、`state.brain` が自動的に `'local'` へ戻ることを確認
15. `#head-note` がクラウド頭脳ON/OFFで文言が切り替わることを確認
16. `window.ZERO1_MOBILE` に新規関数が全て公開されていることを確認（列挙チェック）
17. `zero1-mobile-cloud-key` 以外のlocalStorageキーにAPIキー文字列が紛れ込んでいないことを確認
    （履歴・メモ等の他ストアをgrep）

---

## 6. 推定工数

**中（3〜8h）**

- HTML/CSS追加（設定シート・setup画面カード）: 0.5h
- JS実装（streamCloudAnswer/parseSSE/classifyCloudError/sendCloud/イベント配線）: 2h
- CSP・window.ZERO1_MOBILEブリッジ更新: 0.2h
- `verify-zero1-mobile.mjs` 新規17〜24項目の追加（Verifierまたはこの場でCode-Generatorが実施）: 2〜3h
  （OpenAIエンドポイントの `route` モック・SSE意地悪分割の注入がやや手間）
- 回帰確認（既存154項目＋service-worker）＋動的テスト: 0.5h

---

## 7. 深澤への確認事項（着手前に承認を求める）

1. 上記の要件・設計（クラウド頭脳の名称・BYOKフロー・失敗時UX・スコープ外項目）で実装してよいか
2. §1.10「未確定事項」— `CLOUD_MODEL_DEFAULT = 'gpt-5.6'` のモデルID・エンドポイント形式は
   実装直前にOpenAI公式ドキュメントで最終確認する前提でよいか（Plannerの知識では実在確認ができない）
3. §0の解釈（BYOKは「有料APIキー禁止」の対象外）について、念のため最終確認したい
4. ウェイクワード／常時リスニング・生体認証は本フェーズ対象外（Won't/Could送り）という判断でよいか
