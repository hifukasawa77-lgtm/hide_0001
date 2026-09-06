/**
 * gesture-pointer.js — エアタッチ / Air Touch
 * カメラに指をかざすと画面にポインターが出て、タップ・スワイプ・ドラッグ&ドロップができる。
 *
 * 【設計の要点】
 * 層を3つに分ける。ここを混ぜると「実機でしか検査できない機能」になってしまう:
 *   1. 推定層（source） … 映像 → 手のランドマーク21点。MediaPipe HandLandmarker。差し替え可能。
 *   2. 判定層（GestureEngine） … ランドマーク → ポインター座標と押下状態。**純粋なロジック**。
 *   3. 作用層（PointerDriver） … 押下状態 → 実DOMへのイベント合成・スクロール・ドラッグ。
 * 検査（scripts/verify-gesture-pointer.mjs）は 1 を合成データに差し替えて 2・3 を通しで確かめる。
 * ヘッドレスにはカメラもGPUも無いので、この分離が無いと**何ひとつ機械検査できない**。
 *
 * 【なぜ肌色検出ではなく学習済みモデルなのか】
 * 肌色（YCbCr）でのしきい値判定は実装が軽い代わりに、照明と肌の色で精度が大きく変わる。
 * 暗い肌の人ほど当たらなくなる＝使える人が限られる作りになるため採らない。
 *
 * 【プライバシー】
 * 映像は端末から一切出ない。外へ出る通信は「初回のモデル取得」だけで、
 * 取得したモデルは Cache Storage に残す（2回目以降は圏外でも動く）。
 *
 * 【ハマりどころ（実装中に踏んだもの）】
 * - 合成した PointerEvent からは**互換の MouseEvent が自動生成されない**。
 *   本物のポインターと違い、pointerdown を出しても mousedown は出ない。両方出すこと。
 * - CSS の :hover はブラウザが持つ状態で、合成イベントでは点かない。
 *   見た目のホバーは自前のクラス（.airtouch-hover）で付ける。
 * - オーバーレイに pointer-events:none を付け忘れると、elementFromPoint が
 *   **自分のカーソルを拾って**永遠に何も押せなくなる（例外は出ない）。
 * - 手が視界から消えたときに押下を解除しないと、押しっぱなしのまま固まる。
 */

/* ------------------------------------------------------------------ *
 * 既定値
 * ------------------------------------------------------------------ */
export const DEFAULTS = Object.freeze({
  // ピンチ（親指と人差し指をつまむ）の判定。手の大きさで正規化した比で見るので、
  // カメラからの距離が変わっても閾値が変わらない。
  // 上下2つあるのはヒステリシス。1つの閾値だと、境目の揺れでON/OFFが連打される。
  pinchDown: 0.42,
  pinchUp: 0.58,
  // タップ: 短く・動かさずに離したとき
  tapMaxMs: 450,
  tapMaxPx: 28,
  // スワイプ: 速く払って離したとき
  swipeMinPx: 70,
  swipeMinSpeed: 480, // px/秒
  // 手を見失ってからポインターを消すまでの猶予。0にすると1フレームの検出漏れで点滅する
  lostMs: 320,
  // カメラ画像のうち実際に使う範囲（正規化座標）。四隅まで使わせると、
  // 腕を伸ばしきらないと画面端に届かない。
  // ★上下左右で対称にすること。ずらすと「手を真ん中に置いているのにポインターが下」に
  //   なり、原因が分からないまま「なんとなく狙いにくい」だけが残る
  activeBox: { x0: 0.16, y0: 0.16, x1: 0.84, y1: 0.84 },
  mirror: true,
  /* --- 静止クリック（つまむのが疲れる／指が動かしにくいとき） --- */
  // ★既定はOFF。ONにすると「止めているだけ」で押されるので、意図しない誤爆が必ず起きる。
  //   使う人が選んだときだけ効かせる
  dwellEnabled: false,
  /** 止まったと見なす半径（px）。手ぶれ取りの後でもこの程度は揺れる */
  dwellRadius: 26,
  /** この時間止め続けたら押す（ms） */
  dwellMs: 900,
  /* --- スクロールの加速 --- */
  // 指の動きと1:1のままだと、長い記事で腕が何往復も要る。
  // ゆっくり動かすときは1:1（狙いを外さない）、速く払うほど倍率を上げる
  scrollGainMax: 3.2,
  /** この速さ（px/秒）で倍率が最大になる */
  scrollGainSpeed: 900,
  /* --- 中指つまみ ＝ 右クリック --- */
  secondaryEnabled: true,
  // 手ぶれ取り（1€フィルタ）。速く動かすほど追従を上げ、止めているほど滑らかにする
  minCutoff: 1.4,
  beta: 0.008,
  dCutoff: 1.0,
  // 推定は毎フレーム走らせない（電池）。間のフレームは直前の結果を使い、フィルタが繋ぐ
  detectIntervalMs: 33,
});

/** 手のランドマーク番号（MediaPipe HandLandmarker の並び） */
export const LM = Object.freeze({
  WRIST: 0, THUMB_TIP: 4, INDEX_MCP: 5, INDEX_TIP: 8,
  MIDDLE_MCP: 9, MIDDLE_TIP: 12, RING_TIP: 16, PINKY_MCP: 17, PINKY_TIP: 20,
});

/** 骨格の描き方（プレビュー用）。手の形が見えると狙いを合わせやすい */
export const HAND_BONES = Object.freeze([
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
]);

/* ------------------------------------------------------------------ *
 * 1€ フィルタ — 手ぶれを消しつつ、速い動きには遅れない
 *
 * 単純な移動平均だと「止めれば滑らかだが動かすと遅れる」の二択になる。
 * 1€フィルタは速度に応じてカットオフを上げるので、その二択を避けられる。
 * ------------------------------------------------------------------ */
class LowPass {
  constructor() { this.y = null; }
  filter(value, alpha) {
    this.y = this.y === null ? value : alpha * value + (1 - alpha) * this.y;
    return this.y;
  }
  get value() { return this.y; }
  reset() { this.y = null; }
}

export class OneEuroFilter {
  constructor({ minCutoff = DEFAULTS.minCutoff, beta = DEFAULTS.beta, dCutoff = DEFAULTS.dCutoff } = {}) {
    this.minCutoff = minCutoff; this.beta = beta; this.dCutoff = dCutoff;
    this.x = new LowPass(); this.dx = new LowPass(); this.lastTime = null;
  }
  reset() { this.x.reset(); this.dx.reset(); this.lastTime = null; }
  /** @param {number} value @param {number} timeSec 秒 */
  filter(value, timeSec) {
    if (this.lastTime === null || timeSec <= this.lastTime) {
      this.lastTime = timeSec;
      this.x.filter(value, 1);
      return value;
    }
    const dt = timeSec - this.lastTime;
    this.lastTime = timeSec;
    const rate = 1 / dt;
    const derivative = (value - this.x.value) * rate;
    const edx = this.dx.filter(derivative, alphaFor(this.dCutoff, rate));
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    return this.x.filter(value, alphaFor(cutoff, rate));
  }
}

function alphaFor(cutoff, rate) {
  const tau = 1 / (2 * Math.PI * cutoff);
  const te = 1 / rate;
  return 1 / (1 + tau / te);
}

/* ------------------------------------------------------------------ *
 * ランドマークから読み取る値（純粋関数 — 検査しやすいようにここへ切り出す）
 * ------------------------------------------------------------------ */
const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));

/**
 * 手の大きさ（手首→中指付け根）。ピンチ量をこれで割ることで、
 * カメラから遠い・近いで閾値が変わらなくなる。
 */
export function handScale(landmarks) {
  if (!landmarks || landmarks.length <= LM.MIDDLE_MCP) return 0;
  const base = dist3(landmarks[LM.WRIST], landmarks[LM.MIDDLE_MCP]);
  // 手のひらを真正面に向けると手首→中指付け根が短く写る。横幅も見て小さすぎを防ぐ
  const span = landmarks.length > LM.PINKY_MCP
    ? dist3(landmarks[LM.INDEX_MCP], landmarks[LM.PINKY_MCP]) : 0;
  return Math.max(base, span, 1e-6);
}

/** ピンチ量（0に近いほど強く摘まんでいる）。手の大きさで正規化済み */
export function pinchRatio(landmarks) {
  if (!landmarks || landmarks.length <= LM.INDEX_TIP) return Number.POSITIVE_INFINITY;
  return dist3(landmarks[LM.THUMB_TIP], landmarks[LM.INDEX_TIP]) / handScale(landmarks);
}

/**
 * 中指つまみの量。**人差し指つまみ＝左クリック、中指つまみ＝右クリック**に使う。
 * 同じ手の別の指なので、持ち替えも道具も要らずに2種類の押下を作れる。
 */
export function secondaryPinchRatio(landmarks) {
  if (!landmarks || landmarks.length <= LM.MIDDLE_TIP) return Number.POSITIVE_INFINITY;
  return dist3(landmarks[LM.THUMB_TIP], landmarks[LM.MIDDLE_TIP]) / handScale(landmarks);
}

/**
 * つまみ具合を 0〜1 で返す（1 = 押している）。
 *
 * ★これが無いと「押せたかどうか」が押した瞬間にしか分からない。
 *   あと少しで押せるのか、まるで足りないのかが見えないと、空振りの理由が分からず
 *   利用者は「効かない」としか言えなくなる。連続値にしてリングの縮み具合へ出す。
 */
export function pinchProgress(pinch, down = DEFAULTS.pinchDown, up = DEFAULTS.pinchUp) {
  if (!Number.isFinite(pinch)) return 0;
  if (up <= down) return pinch <= down ? 1 : 0;
  return clamp01((up - pinch) / (up - down));
}

/**
 * スクロールの倍率。ゆっくり動かすときは1:1のまま、速く払うほど上げる。
 * ★遅いところを1:1に保つのが要点。全域で倍率を掛けると、狙った位置で止められなくなる。
 */
export function scrollGain(speed, { scrollGainMax = DEFAULTS.scrollGainMax, scrollGainSpeed = DEFAULTS.scrollGainSpeed } = {}) {
  const magnitude = Math.abs(Number(speed) || 0);
  if (scrollGainSpeed <= 0) return 1;
  const t = clamp01(magnitude / scrollGainSpeed);
  return 1 + (scrollGainMax - 1) * t * t;   // 二乗で立ち上げる（遅い側をより素直に）
}

/* ------------------------------------------------------------------ *
 * 個人ごとの調整（キャリブレーション）
 *
 * ★閾値 0.42 / 0.58 は開発時の当て値で、誰の手でも合う保証はない。
 *   手の大きさで正規化してあっても、指の長さの比・爪の長さ・関節の可動域は人それぞれで、
 *   「つまんだつもりなのに反応しない」「開いているのに押されっぱなし」が起きる。
 *   表情ケアが目の開きに個人基準を持つのと同じ考え方で、実際の手から作る。
 * ★純粋関数にする。実機でしか集められない値でも、**判定そのものは机上で全部試せる**。
 * ------------------------------------------------------------------ */

/** 中央値。外れ値（1フレームの検出ミス）に引きずられないため平均を使わない */
export function median(values) {
  const sorted = [...(values ?? [])].filter((value) => Number.isFinite(value)).sort((left, right) => left - right);
  if (!sorted.length) return NaN;
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export const CALIBRATION_MIN_SAMPLES = 8;

/**
 * 「開いた手」と「つまんだ手」の実測から、押下の上下閾値を作る。
 *
 * @returns {{ok:true, pinchDown:number, pinchUp:number, open:number, closed:number}
 *          | {ok:false, reason:string}}
 *
 * ★失敗を握りつぶさない。2つの山が重なっている（＝つまめていない／開けていない）ときに
 *   無理やり閾値を作ると、**調整したのに前より当たらない**という最悪の結果になる。
 *   理由を返して既定値を使わせる。
 */
export function deriveThresholds(openSamples, closedSamples) {
  const open = median(openSamples);
  const closed = median(closedSamples);
  if (!Number.isFinite(open) || !Number.isFinite(closed)) return { ok: false, reason: '手を読み取れませんでした' };
  if ((openSamples?.length ?? 0) < CALIBRATION_MIN_SAMPLES || (closedSamples?.length ?? 0) < CALIBRATION_MIN_SAMPLES) {
    return { ok: false, reason: '手が写っている時間が短すぎました' };
  }
  if (closed >= open) return { ok: false, reason: 'つまんだ手と開いた手の区別がつきませんでした' };
  const gap = open - closed;
  // 開きとつまみが近すぎると、どこに線を引いても揺れで往復する
  if (gap < 0.12) return { ok: false, reason: 'つまむ動きが小さすぎました（親指と人差し指をしっかり離してから、確実にくっつけてください）' };
  // 2つの山の間に線を引く。押す側は近め（押しやすく）、離す側は遠め（離しやすく）
  const pinchDown = closed + gap * 0.35;
  const pinchUp = closed + gap * 0.65;
  return { ok: true, pinchDown, pinchUp, open, closed };
}

/**
 * 調整の進行。「開く」→「つまむ」の2段階ぶんの標本を集める。
 * 画面側はこれに毎フレームのピンチ量を流し込むだけでよい。
 */
export class PinchCalibration {
  constructor({ holdMs = 2500 } = {}) {
    this.holdMs = holdMs;
    this.reset();
  }
  reset() {
    this.phase = 'open';            // 'open' → 'closed' → 'done'
    this.open = [];
    this.closed = [];
    this.startedAt = null;
    this.result = null;
  }
  /** いま画面に出すべき案内 */
  get instruction() {
    if (this.phase === 'open') return '手を開いたまま、カメラに向けてください';
    if (this.phase === 'closed') return '親指と人差し指を、しっかりくっつけてください';
    return this.result?.ok ? '調整できました' : `調整できませんでした: ${this.result?.reason ?? ''}`;
  }
  /** 0〜1。いまの段階がどこまで進んだか */
  progress(now) {
    if (this.phase === 'done' || this.startedAt === null) return this.phase === 'done' ? 1 : 0;
    return clamp01((now - this.startedAt) / this.holdMs);
  }
  /**
   * @param {number} pinch いまのピンチ量（手が見えていなければ NaN/Infinity を渡す）
   * @returns {boolean} 段階が進んだか
   */
  sample(pinch, now) {
    if (this.phase === 'done') return false;
    if (!Number.isFinite(pinch)) {
      // ★手が消えている間は数えない。数えると「見えていないのに時間だけ進む」ことになり、
      //   標本が足りないまま次へ行って、質の悪い閾値ができる
      this.startedAt = null;
      return false;
    }
    if (this.startedAt === null) this.startedAt = now;
    (this.phase === 'open' ? this.open : this.closed).push(pinch);
    if (now - this.startedAt < this.holdMs) return false;
    if (this.phase === 'open') { this.phase = 'closed'; this.startedAt = null; return true; }
    this.phase = 'done';
    this.result = deriveThresholds(this.open, this.closed);
    return true;
  }
}

/* ------------------------------------------------------------------ *
 * 設定の保存（調整結果・静止クリックの入切など）
 *
 * ★調整は毎回やり直させない。1回2〜5秒とはいえ、開くたびに求められると
 *   「使うまでが面倒な機能」になり、結局誰も使わなくなる。
 * ★storage を引数で受けるのは検査のため（localStorage は端末の状態に依存する）。
 * ------------------------------------------------------------------ */
export const SETTINGS_KEY = 'airtouch:settings:v1';
/** 保存してよい値だけを通す。知らない鍵を素通しすると、古い版の設定が黙って効き続ける */
const SETTING_KEYS = ['pinchDown', 'pinchUp', 'dwellEnabled', 'dwellMs', 'secondaryEnabled', 'navigateOnSwipe', 'dockSide'];

export function sanitizeSettings(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const key of SETTING_KEYS) {
    const value = raw[key];
    if (value === undefined || value === null) continue;
    if (key === 'dockSide') { if (value === 'top' || value === 'bottom') out[key] = value; continue; }
    if (typeof value === 'boolean') { out[key] = value; continue; }
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
  }
  // 上下が逆に保存されていたら捨てる。逆のまま使うと押下が一度も成立しない
  if (out.pinchDown !== undefined && out.pinchUp !== undefined && out.pinchUp <= out.pinchDown) {
    delete out.pinchDown; delete out.pinchUp;
  }
  return out;
}

export function loadSettings(storage) {
  try {
    const raw = storage?.getItem?.(SETTINGS_KEY);
    return raw ? sanitizeSettings(JSON.parse(raw)) : {};
  } catch { return {}; }   // 壊れた値・シークレットタブ。既定へ落ちるだけで画面は止めない
}

export function saveSettings(patch, storage) {
  const next = { ...loadSettings(storage), ...sanitizeSettings(patch) };
  try { storage?.setItem?.(SETTINGS_KEY, JSON.stringify(next)); } catch { /* 保存できなくても今回は動く */ }
  return next;
}

/**
 * いま何ができるかの一覧。**設定で切ってあるものは載せない**——
 * 出来ないことが書いてあると、試して反応しないときに「壊れている」と受け取られる。
 */
export function helpText(options = {}) {
  const lines = [
    '👌 つまむ = タップ / Pinch = tap',
    '✋ つまんだまま動かす = ドラッグ・スクロール / Pinch & move = drag or scroll',
    '💨 速く払う = スワイプ / Flick = swipe',
  ];
  if (options.secondaryEnabled !== false) lines.push('🤏 中指でつまむ = 右クリック / Middle-finger pinch = right click');
  if (options.dwellEnabled) lines.push('⏱ 止めて待つ = タップ（つままなくてよい） / Hold still = tap');
  if (options.navigateOnSwipe) lines.push('↩️ 右へ払う = 前のページへ戻る / Flick right = go back');
  lines.push('🖐 手を下ろす = ポインターを消す / Lower your hand = hide the pointer');
  return lines.join('\n');
}

/**
 * ポインターの位置に使う点。
 * 人差し指の先そのものではなく、**親指の先との中点**を使う。
 * 摘まむ動作で人差し指の先は必ず動くので、指先を使うと「押した瞬間にポインターがずれる」。
 */
export function pointerAnchor(landmarks) {
  const index = landmarks[LM.INDEX_TIP];
  const thumb = landmarks[LM.THUMB_TIP];
  if (!thumb) return { x: index.x, y: index.y };
  return { x: (index.x * 0.65 + thumb.x * 0.35), y: (index.y * 0.65 + thumb.y * 0.35) };
}

/**
 * カメラの正規化座標 → 画面座標。
 * 前面カメラは鏡なので x を反転する（しないと手を右に動かすとポインターが左へ行く）。
 */
export function mapToScreen(nx, ny, { width, height, activeBox = DEFAULTS.activeBox, mirror = true } = {}) {
  const mx = mirror ? 1 - nx : nx;
  const u = clamp01((mx - activeBox.x0) / (activeBox.x1 - activeBox.x0));
  const v = clamp01((ny - activeBox.y0) / (activeBox.y1 - activeBox.y0));
  return { x: u * width, y: v * height };
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/* ------------------------------------------------------------------ *
 * 判定層 — ランドマーク列 → ポインターと押下状態
 * ------------------------------------------------------------------ */
export class GestureEngine {
  constructor(options = {}) {
    this.options = { ...DEFAULTS, ...options };
    this.reset();
  }

  reset() {
    this.fx = new OneEuroFilter(this.options);
    this.fy = new OneEuroFilter(this.options);
    this.visible = false;
    this.pressed = false;
    this.pinch = Number.POSITIVE_INFINITY;
    this.x = 0; this.y = 0;
    this.vx = 0; this.vy = 0;
    this._lastSeen = 0;
    this._lastT = 0;
    this._down = null;
    this.progress = 0;          // つまみ具合 0〜1（連続表示用）
    this.secondary = false;     // 中指つまみ＝右クリック
    this.dwell = 0;             // 静止クリックの進み具合 0〜1
    this._stillAt = null;
    this._stillX = 0; this._stillY = 0;
    this._dwellFired = false;
  }

  /**
   * @param {{landmarks:Array}|null} hand 検出結果（見えていなければ null）
   * @param {number} now performance.now() のミリ秒
   * @param {{width:number,height:number}} viewport
   * @returns {{visible:boolean,x:number,y:number,pinch:number,pressed:boolean,events:Array}}
   */
  update(hand, now, viewport) {
    const events = [];
    const opts = this.options;

    if (!hand || !hand.landmarks || hand.landmarks.length < 21) {
      // 見失ってすぐ消すと、1フレームの検出漏れで点滅する。猶予を置く
      if (this.visible && now - this._lastSeen > opts.lostMs) {
        // ★押しっぱなしのまま消さない。解除しないと掴んだものが張り付く
        if (this.pressed) {
          this.pressed = false;
          events.push({ type: 'up', x: this.x, y: this.y, ms: now - this._down.t,
            dist: 0, vx: 0, vy: 0, tap: false, swipe: null, cancelled: true });
        }
        this.visible = false;
        this.progress = 0; this.dwell = 0; this.secondary = false;
        this._stillAt = null; this._dwellFired = false;
        this.fx.reset(); this.fy.reset();
        events.push({ type: 'disappear' });
      }
      return this.snapshot(events);
    }

    const point = pointerAnchor(hand.landmarks);
    const screen = mapToScreen(point.x, point.y, {
      width: viewport.width, height: viewport.height,
      activeBox: opts.activeBox, mirror: opts.mirror,
    });
    const t = now / 1000;
    const px = this.fx.filter(screen.x, t);
    const py = this.fy.filter(screen.y, t);

    if (!this.visible) {
      this.visible = true;
      this.x = px; this.y = py; this._lastT = now;
      this.vx = 0; this.vy = 0;
      events.push({ type: 'appear', x: px, y: py });
    }

    const dt = Math.max((now - this._lastT) / 1000, 1e-3);
    const dx = px - this.x;
    const dy = py - this.y;
    // 速度は指数移動平均。1フレームだけの跳ねでスワイプ判定を出さないため
    this.vx = this.vx * 0.7 + (dx / dt) * 0.3;
    this.vy = this.vy * 0.7 + (dy / dt) * 0.3;
    this.x = px; this.y = py; this._lastT = now;
    this._lastSeen = now;
    this.pinch = pinchRatio(hand.landmarks);
    // 「あと少しで押せる」を見せるための連続値。押した瞬間だけ変わる表示では、
    // 空振りしたときに何が足りないのか利用者に分からない
    this.progress = pinchProgress(this.pinch, opts.pinchDown, opts.pinchUp);

    // 中指つまみ＝右クリック。同じ手の別の指なので持ち替えが要らない。
    // ★人差し指が開いていることを条件に入れる。**摘まむと中指も一緒に親指へ寄る**ので、
    //   中指だけを見ると普通のタップが右クリックにもなる（例外は出ず、押すたびにメニューが出る）
    if (opts.secondaryEnabled) {
      const second = secondaryPinchRatio(hand.landmarks);
      const indexOpen = this.pinch >= opts.pinchUp;
      if (!this.pressed && !this.secondary && indexOpen && second <= opts.pinchDown) {
        this.secondary = true;
        events.push({ type: 'secondary', x: px, y: py });
      } else if (this.secondary && second >= opts.pinchUp) {
        this.secondary = false;
      }
    }

    // 静止クリック。つまむのが疲れる／指が動かしにくいときの代わり。
    // ★既定はOFF。止めているだけで押されるので、意図しない誤爆が必ず起きる
    if (opts.dwellEnabled && !this.pressed && !this.secondary) {
      const moved = this._stillAt === null ? Infinity : Math.hypot(px - this._stillX, py - this._stillY);
      if (moved > opts.dwellRadius) {
        this._stillAt = now; this._stillX = px; this._stillY = py; this._dwellFired = false;
      }
      this.dwell = this._dwellFired ? 0 : clamp01((now - (this._stillAt ?? now)) / opts.dwellMs);
      if (!this._dwellFired && this.dwell >= 1) {
        this._dwellFired = true;
        this.dwell = 0;
        events.push({ type: 'dwell', x: px, y: py });
      }
    } else {
      this.dwell = 0; this._stillAt = null; this._dwellFired = false;
    }

    // ヒステリシス付きの押下判定
    if (!this.pressed && this.pinch <= opts.pinchDown) {
      this.pressed = true;
      this._down = { t: now, x: px, y: py };
      events.push({ type: 'down', x: px, y: py });
    } else if (this.pressed && this.pinch >= opts.pinchUp) {
      this.pressed = false;
      const ms = now - this._down.t;
      const moved = Math.hypot(px - this._down.x, py - this._down.y);
      const speed = Math.hypot(this.vx, this.vy);
      const tap = ms <= opts.tapMaxMs && moved <= opts.tapMaxPx;
      const swipe = (!tap && moved >= opts.swipeMinPx && speed >= opts.swipeMinSpeed)
        ? { dir: swipeDirection(this.vx, this.vy), vx: this.vx, vy: this.vy } : null;
      events.push({ type: 'up', x: px, y: py, ms, dist: moved, vx: this.vx, vy: this.vy, tap, swipe, cancelled: false });
    }

    // vx/vy を move にも載せる。作用層のスクロール加速が「今どれだけ速いか」を知るため
    events.push({ type: 'move', x: px, y: py, dx, dy, vx: this.vx, vy: this.vy, pressed: this.pressed });
    return this.snapshot(events);
  }

  snapshot(events) {
    return {
      visible: this.visible, x: this.x, y: this.y, pinch: this.pinch, pressed: this.pressed,
      progress: this.progress, secondary: this.secondary, dwell: this.dwell, events,
    };
  }
}

export function swipeDirection(vx, vy) {
  return Math.abs(vx) >= Math.abs(vy) ? (vx > 0 ? 'right' : 'left') : (vy > 0 ? 'down' : 'up');
}

/* ------------------------------------------------------------------ *
 * 作用層 — 画面のカーソル描画と、実DOMへのイベント合成
 * ------------------------------------------------------------------ */
const STYLE_ID = 'airtouch-style';
const HOVER_CLASS = 'airtouch-hover';
const DRAG_CLASS = 'airtouch-dragging';

const STYLE = `
.airtouch-layer{position:fixed; inset:0; z-index:2147483000; pointer-events:none; contain:layout style}
.airtouch-cursor{
  position:absolute; left:0; top:0; width:54px; height:54px; margin:-27px 0 0 -27px;
  opacity:0; transition:opacity .18s ease; will-change:transform;
}
.airtouch-cursor.is-visible{opacity:1}
.airtouch-cursor .ring{
  position:absolute; inset:0; border-radius:50%;
  border:2px solid rgba(34,211,238,.85); background:rgba(34,211,238,.10);
  box-shadow:0 0 12px rgba(34,211,238,.35);
  transform:scale(1); transition:transform .12s ease, border-color .12s ease, background .12s ease;
}
.airtouch-cursor .dot{
  position:absolute; left:50%; top:50%; width:8px; height:8px; margin:-4px 0 0 -4px;
  border-radius:50%; background:#e6edf6;
}
/* つまみ具合を輪の縮み方で連続的に見せる。押した瞬間だけ変わる表示だと、
   空振りしたときに「あと少しだった」のか「全然だった」のかが分からない */
.airtouch-cursor .ring{transform:scale(calc(1 - var(--airtouch-progress, 0) * .42))}
/* 進み具合の円弧（つまみ＝シアン / 静止クリック＝パープル）。
   mask で中を抜いてリング状にする。要素を増やさず角度だけで表せる */
.airtouch-cursor .arc{
  position:absolute; inset:-5px; border-radius:50%; opacity:0;
  -webkit-mask:radial-gradient(closest-side, transparent 76%, #000 78%);
          mask:radial-gradient(closest-side, transparent 76%, #000 78%);
}
.airtouch-cursor .arc.pinch{
  background:conic-gradient(rgba(34,211,238,.95) calc(var(--airtouch-progress, 0) * 360deg), transparent 0);
  opacity:calc(var(--airtouch-progress, 0) * .95);
}
.airtouch-cursor .arc.dwell{
  background:conic-gradient(rgba(167,139,250,.95) calc(var(--airtouch-dwell, 0) * 360deg), transparent 0);
  opacity:calc(var(--airtouch-dwell, 0) * .95);
}
.airtouch-cursor.is-pressed .ring{
  border-color:rgba(167,139,250,.95); background:rgba(167,139,250,.30);
}
.airtouch-cursor.is-secondary .ring{border-color:rgba(251,191,36,.95); background:rgba(251,191,36,.26)}
.airtouch-cursor.is-dragging .ring{border-style:dashed}
.airtouch-ripple{
  position:absolute; left:0; top:0; width:22px; height:22px; margin:-11px 0 0 -11px;
  border-radius:50%; border:2px solid rgba(167,139,250,.9); animation:airtouch-pop .42s ease-out forwards;
}
@keyframes airtouch-pop{from{transform:scale(.5);opacity:.9} to{transform:scale(2.6);opacity:0}}
/* プレビューと案内文は縦に積む。別々に画面へ置くと、
   文言が伸びた瞬間に重なって読めなくなる（実機のスクリーンショットで見つけた） */
.airtouch-dock{
  position:absolute; left:12px; right:12px; bottom:calc(12px + env(safe-area-inset-bottom));
  display:flex; flex-direction:column; align-items:center; gap:8px;
}
.airtouch-hint{
  padding:7px 13px; border-radius:999px; font-size:.76rem; line-height:1.35; text-align:center;
  background:rgba(8,10,18,.86); color:#e6edf6; border:1px solid rgba(34,211,238,.32);
  max-width:min(92vw,420px);
}
.airtouch-preview{
  position:relative; align-self:flex-start; width:112px; aspect-ratio:4/3;
  border-radius:14px; overflow:hidden; border:1px solid rgba(34,211,238,.32);
  background:#05070d; box-shadow:0 6px 20px rgba(0,0,0,.45);
}
.airtouch-preview video,.airtouch-preview canvas{position:absolute; inset:0; width:100%; height:100%; object-fit:cover}
/* 前面カメラは鏡で見せる。鏡にしないと、手を右へ動かしたとき映像だけ左へ動いて狙えない */
.airtouch-preview video{transform:scaleX(-1)}
.airtouch-preview[hidden]{display:none}
/* プレビューは邪魔になったら上へ逃がす／消せる。実機では下端に置くと
   ちょうど押したいボタンの上に重なることがある */
.airtouch-dock.is-top{top:calc(12px + env(safe-area-inset-top)); bottom:auto; flex-direction:column-reverse}
/* できることの一覧。何ができるか分からないまま手をかざしても、何も起きない */
.airtouch-help{
  padding:10px 14px; border-radius:14px; font-size:.74rem; line-height:1.6;
  background:rgba(8,10,18,.9); color:#e6edf6; border:1px solid rgba(167,139,250,.32);
  max-width:min(92vw,420px); text-align:left; white-space:pre-line;
}
.airtouch-help[hidden]{display:none}
.${HOVER_CLASS}{outline:2px solid rgba(34,211,238,.55); outline-offset:2px}
.${DRAG_CLASS}{opacity:.62}
@media (prefers-reduced-motion:reduce){
  .airtouch-cursor,.airtouch-cursor .ring{transition:none}
  .airtouch-ripple{animation:none; opacity:0}
}
`;

function ensureStyle(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLE;
  doc.head.appendChild(style);
}

/** 縦（または横）にスクロールできる一番近い先祖を返す。無ければ null */
export function scrollableAncestor(node, axis = 'y') {
  const doc = node?.ownerDocument ?? document;
  for (let el = node; el && el !== doc.documentElement; el = el.parentElement) {
    const style = doc.defaultView.getComputedStyle(el);
    const overflow = axis === 'y' ? style.overflowY : style.overflowX;
    const scrollable = /(auto|scroll|overlay)/.test(overflow);
    const room = axis === 'y' ? el.scrollHeight - el.clientHeight : el.scrollWidth - el.clientWidth;
    if (scrollable && room > 1) return el;
  }
  const se = doc.scrollingElement ?? doc.documentElement;
  const room = axis === 'y' ? se.scrollHeight - se.clientHeight : se.scrollWidth - se.clientWidth;
  return room > 1 ? se : null;
}

/** ドラッグの対象になる先祖（draggable な要素、または data-airtouch-drag） */
export function draggableAncestor(node) {
  for (let el = node; el; el = el.parentElement) {
    if (el.draggable === true || el.getAttribute?.('draggable') === 'true' || el.hasAttribute?.('data-airtouch-drag')) return el;
  }
  return null;
}

function newDataTransfer() {
  try { return new DataTransfer(); } catch { return null; }
}

/**
 * ポインターの見た目と、実DOMへのイベント合成。
 *
 * ★合成イベントの落とし穴: 本物のポインターと違い、PointerEvent を出しても
 *   ブラウザは対になる MouseEvent を作ってくれない。mousedown/mousemove/mouseup/click も
 *   自分で出さないと、mouse系だけを聞いている既存のUIが一切反応しない。
 */
export class PointerDriver {
  constructor({
    doc = document, root = null, onGesture = null, reducedMotion = false,
    navigateOnSwipe = false,
    scrollGainMax = DEFAULTS.scrollGainMax, scrollGainSpeed = DEFAULTS.scrollGainSpeed,
  } = {}) {
    this.doc = doc;
    this.onGesture = onGesture;
    this.reducedMotion = reducedMotion;
    // ★既定OFF。横に払っただけで前のページへ戻ると、書きかけの入力が消える
    this.navigateOnSwipe = navigateOnSwipe;
    this.scrollGainMax = scrollGainMax;
    this.scrollGainSpeed = scrollGainSpeed;
    ensureStyle(doc);
    this.layer = doc.createElement('div');
    this.layer.className = 'airtouch-layer';
    this.layer.setAttribute('aria-hidden', 'true');
    this.cursor = doc.createElement('div');
    this.cursor.className = 'airtouch-cursor';
    this.cursor.innerHTML = '<span class="arc pinch"></span><span class="arc dwell"></span>'
      + '<span class="ring"></span><span class="dot"></span>';
    this.dock = doc.createElement('div');
    this.dock.className = 'airtouch-dock';
    this.help = doc.createElement('div');
    this.help.className = 'airtouch-help';
    this.help.hidden = true;
    this.hint = doc.createElement('div');
    this.hint.className = 'airtouch-hint';
    this.hint.hidden = true;
    this.dock.append(this.help, this.hint);
    this.layer.append(this.cursor, this.dock);
    (root ?? doc.body).appendChild(this.layer);

    this.hovered = null;
    this.downTarget = null;
    this.mode = null;         // 'drag' | 'pan'
    this.dragEl = null;
    this.dragOver = null;
    this.dragStarted = false;
    this.scroller = null;
    this.pointerId = 90210;   // 本物のポインターと衝突しない固定ID
    this._inertia = null;
    this.lastGesture = null;
  }

  destroy() {
    this.cancelInertia();
    this.clearHover();
    this.layer.remove();
  }

  setHint(text) {
    this.hint.textContent = text ?? '';
    this.hint.hidden = !text;
  }

  /** できることの一覧を出す（空文字・null で消す） */
  setHelp(text) {
    this.help.textContent = text ?? '';
    this.help.hidden = !text;
  }

  helpVisible() { return !this.help.hidden; }

  /** プレビューと案内文の置き場所。押したいものと重なったら上へ逃がす */
  setDockSide(side) {
    this.dockSide = side === 'top' ? 'top' : 'bottom';
    this.dock.classList.toggle('is-top', this.dockSide === 'top');
    return this.dockSide;
  }

  /** 判定層の1フレーム分の結果を画面と実DOMへ反映する */
  apply(frame) {
    this.cursor.style.transform = `translate(${frame.x}px, ${frame.y}px)`;
    this.cursor.classList.toggle('is-visible', frame.visible);
    this.cursor.classList.toggle('is-pressed', frame.pressed);
    this.cursor.classList.toggle('is-secondary', frame.secondary === true);
    // 押し切る前の「あと少し」を連続で見せる。CSS変数にしておけば
    // 見た目（円弧・輪の縮み）はスタイル側だけで差し替えられる
    this.cursor.style.setProperty('--airtouch-progress', String(frame.progress ?? 0));
    this.cursor.style.setProperty('--airtouch-dwell', String(frame.dwell ?? 0));
    for (const event of frame.events) {
      if (event.type === 'appear') this.cancelInertia();
      else if (event.type === 'down') this.handleDown(event);
      else if (event.type === 'move') this.handleMove(event);
      else if (event.type === 'up') this.handleUp(event);
      else if (event.type === 'secondary') this.handleSecondary(event);
      else if (event.type === 'dwell') this.handleDwell(event);
      else if (event.type === 'disappear') this.clearHover();
    }
  }

  elementAt(x, y) {
    // ★ layer に pointer-events:none が付いているので、ここで自分のカーソルは拾わない
    return this.doc.elementFromPoint(Math.round(x), Math.round(y));
  }

  /* --- ホバー ---------------------------------------------------- */
  updateHover(target, x, y) {
    if (target === this.hovered) return;
    if (this.hovered) {
      this.hovered.classList?.remove(HOVER_CLASS);
      this.fire(this.hovered, 'pointerout', x, y);
      this.fire(this.hovered, 'pointerleave', x, y, { bubbles: false });
      this.fire(this.hovered, 'mouseout', x, y, { mouse: true });
    }
    this.hovered = target;
    if (target) {
      // CSS の :hover はブラウザの状態で、合成イベントでは点かない。自前のクラスで見せる
      target.classList?.add(HOVER_CLASS);
      this.fire(target, 'pointerover', x, y);
      this.fire(target, 'pointerenter', x, y, { bubbles: false });
      this.fire(target, 'mouseover', x, y, { mouse: true });
    }
  }

  clearHover() {
    if (!this.hovered) return;
    this.hovered.classList?.remove(HOVER_CLASS);
    this.hovered = null;
  }

  /* --- 押す・動かす・離す ----------------------------------------- */
  handleDown(event) {
    this.cancelInertia();
    const target = this.elementAt(event.x, event.y);
    this.downTarget = target;
    this.dragStarted = false;
    this.dragOver = null;
    if (!target) { this.mode = null; return; }
    this.updateHover(target, event.x, event.y);
    const draggable = draggableAncestor(target);
    if (draggable) {
      this.mode = 'drag';
      this.dragEl = draggable;
      this.scroller = null;
    } else {
      this.mode = 'pan';
      this.dragEl = null;
      // スクロールできる箱の上なら、指でなぞるのと同じように中身を動かす
      this.scroller = scrollableAncestor(target, 'y');
    }
    this.fire(target, 'pointerdown', event.x, event.y, { buttons: 1 });
    this.fire(target, 'mousedown', event.x, event.y, { mouse: true, buttons: 1 });
  }

  handleMove(event) {
    const target = this.elementAt(event.x, event.y);
    if (!event.pressed) {
      this.updateHover(target, event.x, event.y);
      this.fire(target, 'pointermove', event.x, event.y);
      this.fire(target, 'mousemove', event.x, event.y, { mouse: true });
      return;
    }
    // 押している間は、押し始めた要素へ送り続ける（本物のタッチの暗黙キャプチャと同じ）
    const sink = this.downTarget ?? target;
    this.fire(sink, 'pointermove', event.x, event.y, { buttons: 1 });
    this.fire(sink, 'mousemove', event.x, event.y, { mouse: true, buttons: 1 });

    if (this.mode === 'drag' && this.dragEl) {
      if (!this.dragStarted) {
        this.dragStarted = true;
        this.dragEl.classList.add(DRAG_CLASS);
        this.cursor.classList.add('is-dragging');
        this.dataTransfer = newDataTransfer();
        this.fireDrag(this.dragEl, 'dragstart', event.x, event.y);
      }
      this.fireDrag(this.dragEl, 'drag', event.x, event.y);
      if (target !== this.dragOver) {
        if (this.dragOver) this.fireDrag(this.dragOver, 'dragleave', event.x, event.y);
        this.dragOver = target;
        if (target) this.fireDrag(target, 'dragenter', event.x, event.y);
      }
      if (target) this.fireDrag(target, 'dragover', event.x, event.y);
      return;
    }

    if (this.mode === 'pan' && this.scroller) {
      // 指の動きと中身の動きを一致させる（下へ払ったら中身も下へ）。
      // ★ゆっくり動かすときは1:1のまま（狙いを外さない）、速く払うほど倍率を上げる。
      //   常に等倍だと長い記事で腕が何往復も要り、これが一番疲れる
      const gain = scrollGain(Math.hypot(event.vx ?? 0, event.vy ?? 0), {
        scrollGainMax: this.scrollGainMax, scrollGainSpeed: this.scrollGainSpeed,
      });
      this.scroller.scrollTop -= event.dy * gain;
      this.scroller.scrollLeft -= event.dx * gain;
    }
  }

  handleUp(event) {
    const sink = this.downTarget;
    if (sink) {
      this.fire(sink, 'pointerup', event.x, event.y);
      this.fire(sink, 'mouseup', event.x, event.y, { mouse: true });
    }
    if (this.mode === 'drag' && this.dragStarted && this.dragEl) {
      const dropTarget = this.dragOver ?? this.elementAt(event.x, event.y);
      if (dropTarget) this.fireDrag(dropTarget, 'drop', event.x, event.y);
      this.fireDrag(this.dragEl, 'dragend', event.x, event.y);
      this.dragEl.classList.remove(DRAG_CLASS);
      this.cursor.classList.remove('is-dragging');
      this.emit('drag', { x: event.x, y: event.y, source: this.dragEl, target: dropTarget ?? null });
    } else if (event.cancelled) {
      // 手を見失っての解除。押した扱いにはしない（勝手に押されるのが一番こわい）
      this.emit('cancel', { x: event.x, y: event.y, target: sink ?? null });
    } else if (event.tap && sink) {
      this.tap(sink, event.x, event.y);
    } else if (event.swipe) {
      this.swipe(event);
    } else if (this.mode === 'pan') {
      this.emit('pan', { x: event.x, y: event.y, target: sink ?? null });
    }
    this.downTarget = null; this.mode = null; this.dragEl = null;
    this.dragOver = null; this.dragStarted = false; this.scroller = null;
  }

  tap(target, x, y) {
    this.ripple(x, y);
    // 入力欄はまず focus。click だけだとキーボードが出ない
    if (typeof target.focus === 'function' && /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(target.tagName)) {
      try { target.focus({ preventScroll: true }); } catch { /* 表示に影響しない */ }
    }
    this.fire(target, 'click', x, y, { mouse: true, detail: 1 });
    this.emit('tap', { x, y, target });
  }

  /** 中指つまみ＝右クリック。同じ手のまま持ち替えずに出せる */
  handleSecondary(event) {
    const target = this.elementAt(event.x, event.y);
    if (!target) return;
    this.ripple(event.x, event.y);
    // contextmenu だけでは「右ボタンで押した」ことにならない受け側がある。
    // 本物のマウスと同じ並び（down → up → contextmenu）で出す
    this.fire(target, 'pointerdown', event.x, event.y, { buttons: 2, button: 2 });
    this.fire(target, 'mousedown', event.x, event.y, { mouse: true, buttons: 2, button: 2 });
    this.fire(target, 'mouseup', event.x, event.y, { mouse: true, button: 2 });
    this.fire(target, 'contextmenu', event.x, event.y, { mouse: true, button: 2 });
    this.emit('secondary', { x: event.x, y: event.y, target });
  }

  /** 静止クリック。つまむのが疲れる／指が動かしにくい人のための代わりの押し方 */
  handleDwell(event) {
    const target = this.elementAt(event.x, event.y);
    if (!target) return;
    this.fire(target, 'pointerdown', event.x, event.y, { buttons: 1 });
    this.fire(target, 'mousedown', event.x, event.y, { mouse: true, buttons: 1 });
    this.fire(target, 'pointerup', event.x, event.y);
    this.fire(target, 'mouseup', event.x, event.y, { mouse: true });
    this.tap(target, event.x, event.y);
    this.emit('dwell', { x: event.x, y: event.y, target });
  }

  swipe(event) {
    const scroller = this.scroller ?? scrollableAncestor(this.downTarget ?? this.doc.body, 'y');
    this.emit('swipe', { x: event.x, y: event.y, dir: event.swipe.dir, vx: event.vx, vy: event.vy, target: this.downTarget ?? null });
    // 横払いで戻る／進む。★既定OFF（書きかけの入力が消えるので、選んだ人だけ）
    if (this.navigateOnSwipe && (event.swipe.dir === 'right' || event.swipe.dir === 'left')) {
      const history = this.doc.defaultView?.history;
      if (event.swipe.dir === 'right') history?.back?.();
      else history?.forward?.();
      return;
    }
    if (scroller && !this.reducedMotion) this.startInertia(scroller, event.vx, event.vy);
  }

  /** 払った勢いを少しだけ続ける。実機で「指を離した瞬間に止まる」と操作感が固い */
  startInertia(scroller, vx, vy) {
    this.cancelInertia();
    const view = this.doc.defaultView;
    let speedX = -vx / 60, speedY = -vy / 60;
    const step = () => {
      speedX *= 0.94; speedY *= 0.94;
      scroller.scrollTop += speedY;
      scroller.scrollLeft += speedX;
      if (Math.hypot(speedX, speedY) < 0.4) { this._inertia = null; return; }
      this._inertia = view.requestAnimationFrame(step);
    };
    this._inertia = view.requestAnimationFrame(step);
  }

  cancelInertia() {
    if (this._inertia === null) return;
    this.doc.defaultView.cancelAnimationFrame(this._inertia);
    this._inertia = null;
  }

  ripple(x, y) {
    if (this.reducedMotion) return;
    const node = this.doc.createElement('span');
    node.className = 'airtouch-ripple';
    node.style.transform = `translate(${x}px, ${y}px)`;
    this.layer.appendChild(node);
    this.doc.defaultView.setTimeout(() => node.remove(), 500);
  }

  emit(kind, detail) {
    this.lastGesture = { kind, ...detail };
    const target = detail.target ?? this.doc.body;
    target.dispatchEvent?.(new CustomEvent('airtouch:gesture', {
      bubbles: true, composed: true, detail: { kind, ...detail },
    }));
    this.onGesture?.(kind, detail);
  }

  /* --- イベント合成 ------------------------------------------------ */
  fire(target, type, x, y, { mouse = false, buttons = 0, button = 0, bubbles = true, detail = 0 } = {}) {
    if (!target?.dispatchEvent) return;
    const init = {
      bubbles, composed: true, cancelable: true, view: this.doc.defaultView,
      clientX: x, clientY: y, screenX: x, screenY: y, buttons, button, detail,
    };
    const Ctor = mouse ? this.doc.defaultView.MouseEvent : this.doc.defaultView.PointerEvent;
    const event = mouse ? new Ctor(type, init)
      : new Ctor(type, { ...init, pointerId: this.pointerId, pointerType: 'mouse', isPrimary: true, width: 1, height: 1, pressure: buttons ? 0.5 : 0 });
    // 合成であることを隠さない。受け側が本物と区別したいときのために印を残す
    try { Object.defineProperty(event, 'airtouch', { value: true }); } catch { /* 印は付かなくても動く */ }
    target.dispatchEvent(event);
  }

  fireDrag(target, type, x, y) {
    if (!target?.dispatchEvent) return;
    const view = this.doc.defaultView;
    const init = {
      bubbles: true, composed: true, cancelable: true, view,
      clientX: x, clientY: y, screenX: x, screenY: y,
      dataTransfer: this.dataTransfer ?? undefined,
    };
    let event;
    try { event = new view.DragEvent(type, init); }
    catch { event = new view.MouseEvent(type, init); }
    target.dispatchEvent(event);
  }
}

/* ------------------------------------------------------------------ *
 * 推定層 — MediaPipe HandLandmarker
 *
 * ★版は固定する。CDNの最新を指すと、ある日いきなり形が変わって黙って止まる。
 *   版を上げるときは importmap の integrity も取り直すこと:
 *     npm pack @mediapipe/tasks-vision@<版> && tar xzf ... &&
 *     openssl dgst -sha384 -binary package/vision_bundle.mjs | openssl base64 -A
 * ------------------------------------------------------------------ */
export const VISION_VERSION = '1.0.1';
export const VISION_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}/vision_bundle.mjs`;
export const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}/wasm`;
export const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const MODEL_CACHE = 'airtouch-model-v1';

/**
 * モデルは一度取ったら端末に残す。毎回7MB落とすのは携帯回線では現実的でない。
 * Cache Storage が使えない環境（プライベートウィンドウ等）では素直に毎回取りに行く。
 */
async function fetchModel(onStatus) {
  let cache = null;
  try { cache = await caches.open(MODEL_CACHE); } catch { cache = null; }
  const hit = cache ? await cache.match(MODEL_URL).catch(() => null) : null;
  if (hit) {
    onStatus?.({ stage: 'model', text: '手の認識モデルを読み込んでいます（保存済み）…' });
    return new Uint8Array(await hit.arrayBuffer());
  }
  onStatus?.({ stage: 'model', text: '手の認識モデルを取得しています（初回だけ・約7MB）…' });
  const response = await fetch(MODEL_URL, { mode: 'cors' });
  if (!response.ok) throw new Error(`モデルを取得できませんでした (HTTP ${response.status})`);
  const buffer = await response.arrayBuffer();
  if (cache) {
    try { await cache.put(MODEL_URL, new Response(buffer.slice(0), { headers: { 'Content-Type': 'application/octet-stream' } })); }
    catch { /* 容量制限。次回また取りに行くだけなので致命ではない */ }
  }
  return new Uint8Array(buffer);
}

/** importmap 経由（integrity 検証あり）で読み、駄目なら理由を残して直接URLで読み直す */
async function loadVision(onStatus) {
  onStatus?.({ stage: 'library', text: '手の認識ライブラリを読み込んでいます…' });
  try {
    return { module: await import('mediapipe-vision'), verified: true };
  } catch (cause) {
    const module = await import(/* @vite-ignore */ VISION_URL);
    return { module, verified: false, reason: `${cause?.name ?? 'Error'}: ${cause?.message ?? cause}` };
  }
}

/**
 * カメラ映像から手を読む source を作る。
 * source は { start, poll, stop, video } を持つ差し替え可能な口。検査ではここを合成データに替える。
 */
export function createHandSource({ onStatus = null, facingMode = 'user' } = {}) {
  let landmarker = null;
  let stream = null;
  let video = null;
  let lastVideoTime = -1;
  let last = null;
  let verified = true;

  return {
    get video() { return video; },
    get verified() { return verified; },

    async start(doc = document) {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('この端末（またはブラウザ）はカメラを使えません');
      const { module: vision, verified: ok, reason } = await loadVision(onStatus);
      verified = ok;
      if (!ok) onStatus?.({ stage: 'library', text: `注意: ライブラリの整合性検証を飛ばしました（${reason}）`, level: 'warn' });
      const [fileset, modelAssetBuffer] = await Promise.all([
        vision.FilesetResolver.forVisionTasks(WASM_BASE),
        fetchModel(onStatus),
      ]);
      onStatus?.({ stage: 'camera', text: 'カメラの使用許可をお願いします…' });
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
        audio: false,
      });
      video = doc.createElement('video');
      video.playsInline = true; video.muted = true; video.autoplay = true;
      video.srcObject = stream;
      await video.play();
      landmarker = await vision.HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetBuffer, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      }).catch(async (cause) => {
        // GPU が使えない端末は珍しくない。黙って諦めずCPUで動かす
        onStatus?.({ stage: 'model', text: `GPUが使えないためCPUで動かします（${cause?.message ?? cause}）`, level: 'warn' });
        return vision.HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetBuffer, delegate: 'CPU' },
          runningMode: 'VIDEO', numHands: 1,
        });
      });
      onStatus?.({ stage: 'ready', text: '指をかざしてください / Hold up a finger' });
    },

    poll(now) {
      if (!landmarker || !video || video.readyState < 2) return last;
      // ★同じ時刻で2回呼ぶと MediaPipe は例外を投げる。フレームが進んだときだけ推定する
      if (video.currentTime === lastVideoTime) return last;
      lastVideoTime = video.currentTime;
      const result = landmarker.detectForVideo(video, now);
      const hands = result?.landmarks ?? [];
      if (!hands.length) { last = null; return null; }
      // 2つ写ったら、カメラに近い（＝大きく写っている）方を使う
      let best = hands[0];
      for (const hand of hands) if (handScale(hand) > handScale(best)) best = hand;
      last = { landmarks: best, handedness: result?.handedness?.[hands.indexOf(best)]?.[0]?.categoryName ?? '' };
      return last;
    },

    stop() {
      // ★止め忘れるとカメラのランプが点きっぱなしになる。信用を失う類の不具合
      try { landmarker?.close?.(); } catch { /* 閉じられなくても停止は続ける */ }
      landmarker = null;
      for (const track of stream?.getTracks?.() ?? []) track.stop();
      stream = null;
      if (video) { video.pause?.(); video.srcObject = null; video = null; }
      last = null;
    },
  };
}

/* ------------------------------------------------------------------ *
 * まとめ役 — カメラ・判定・作用をつなぐ
 * ------------------------------------------------------------------ */
/** localStorage は端末の状態で丸ごと落ちる（シークレットタブ・容量枯渇・設定でブロック） */
function safeStorage(doc) {
  try { return doc?.defaultView?.localStorage ?? null; } catch { return null; }
}

export class AirTouch {
  /**
   * @param {object} options
   * @param {Function} [options.createSource] source を作る関数。検査はここを差し替える
   * @param {Function} [options.onStatus] 画面へ出す状態の通知
   * @param {Function} [options.onGesture] タップ等が起きたときの通知
   */
  constructor({
    doc = document, createSource = null, onStatus = null, onGesture = null,
    engine = {}, preview = true, storage = undefined,
  } = {}) {
    this.doc = doc;
    this.createSource = createSource ?? ((opts) => createHandSource(opts));
    this.onStatus = onStatus;
    this.onGesture = onGesture;
    // 保存済みの設定（調整結果・静止クリックの入切）を土台にする。
    // 呼び出し側が明示した値の方が強い
    this.storage = storage === undefined ? safeStorage(doc) : storage;
    this.settings = loadSettings(this.storage);
    this.engineOptions = { ...this.settings, ...engine };
    this.wantPreview = preview;
    this.calibration = null;
    this.enabled = false;
    this.source = null;
    this.driver = null;
    this.engine = null;
    this._raf = null;
    this._lastDetect = 0;
    this.polls = 0;
    this._hand = null;
    this.error = null;
  }

  status(payload) { this.onStatus?.(payload); }

  async enable() {
    if (this.enabled) return true;
    const reduced = this.doc.defaultView.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    this.engine = new GestureEngine(this.engineOptions);
    this.driver = new PointerDriver({
      doc: this.doc, onGesture: this.onGesture, reducedMotion: reduced,
      navigateOnSwipe: this.engineOptions.navigateOnSwipe === true,
    });
    this.driver.setDockSide(this.engineOptions.dockSide ?? 'bottom');
    this.driver.setHint('カメラを準備しています… / Starting camera…');
    this.source = this.createSource({ onStatus: (s) => { this.driver?.setHint(s.text); this.status(s); } });
    try {
      await this.source.start(this.doc);
    } catch (cause) {
      // ★「使えません」だけでは打つ手が無い。理由は必ず呼び出し側へ渡す
      this.error = `${cause?.name ?? 'Error'}: ${cause?.message ?? cause}`;
      this.status({ stage: 'error', text: this.error, level: 'error' });
      // ★ここで片付けないと、失敗したのに透明な層だけが画面に残る。
      //   pointer-events:none なので見た目には何も起きず、**次に開いた画面で
      //   カーソルの残骸が居座る**（実際に検査で見つけた）
      try { this.source?.stop?.(); } catch { /* 片付けは続ける */ }
      this.driver.destroy();
      this.driver = null;
      this.source = null;
      this.engine = null;
      this.enabled = false;
      return false;
    }
    if (this.wantPreview && this.source.video) this.mountPreview(this.source.video);
    this.enabled = true;
    this.driver.setHint('指をかざしてください。つまむとタップ / Pinch to tap');
    this.loop();
    return true;
  }

  /**
   * 設定を1つ変える。**動かしたまま効く**——切り替えるたびにカメラを掴み直すと、
   * 許可の確認が出たり数秒待たされたりして、試しながら調整できない
   */
  setSetting(key, value) {
    const patch = { [key]: value };
    const clean = sanitizeSettings(patch);
    if (!(key in clean)) return this.settings;
    this.settings = saveSettings(clean, this.storage);
    Object.assign(this.engineOptions, clean);
    if (this.engine) Object.assign(this.engine.options, clean);
    if (this.driver) {
      if (key === 'navigateOnSwipe') this.driver.navigateOnSwipe = clean[key] === true;
      if (key === 'dockSide') this.driver.setDockSide(clean[key]);
      if (this.driver.helpVisible()) this.driver.setHelp(helpText(this.engineOptions));
    }
    return this.settings;
  }

  /** できることの一覧を出す／消す */
  toggleHelp(show) {
    if (!this.driver) return false;
    const next = show ?? !this.driver.helpVisible();
    this.driver.setHelp(next ? helpText(this.engineOptions) : '');
    return next;
  }

  /** 手の大きさ・つまみ方の個人差を実測して閾値を作り直す */
  startCalibration() {
    if (!this.enabled) return false;
    this.calibration = new PinchCalibration();
    this.driver.setHint(this.calibration.instruction);
    return true;
  }

  cancelCalibration() {
    this.calibration = null;
    this.driver?.setHint('指をかざしてください。つまむとタップ / Pinch to tap');
  }

  /** 調整の1フレーム分。tick から呼ぶ（検査からも直接呼べるように切り出す） */
  stepCalibration(now) {
    const cal = this.calibration;
    if (!cal) return null;
    const pinch = this._hand?.landmarks ? pinchRatio(this._hand.landmarks) : NaN;
    cal.sample(pinch, now);
    // 進み具合はカーソルの円弧を借りて見せる（見る場所を増やさない）
    this.driver?.cursor.style.setProperty('--airtouch-dwell', String(cal.progress(now)));
    if (cal.phase !== 'done') {
      this.driver?.setHint(cal.instruction);
      return cal;
    }
    this.calibration = null;
    this.driver?.cursor.style.setProperty('--airtouch-dwell', '0');
    if (cal.result?.ok) {
      this.setSetting('pinchDown', cal.result.pinchDown);
      this.setSetting('pinchUp', cal.result.pinchUp);
      this.driver?.setHint(`調整できました（つまみ ${cal.result.pinchDown.toFixed(2)}〜${cal.result.pinchUp.toFixed(2)}） / Calibrated`);
    } else {
      // ★失敗しても既定値のまま使える。「調整できないと使えない」にはしない
      this.driver?.setHint(`${cal.instruction} — これまでの設定のまま使えます`);
    }
    this.status({ stage: 'calibration', text: cal.instruction, level: cal.result?.ok ? 'info' : 'warn', result: cal.result });
    return cal;
  }

  disable() {
    if (!this.enabled && !this.source) return;
    this.enabled = false;
    if (this._raf !== null) { this.doc.defaultView.cancelAnimationFrame(this._raf); this._raf = null; }
    try { this.source?.stop(); } catch { /* 停止は続ける */ }
    this.source = null;
    this.preview?.remove(); this.preview = null; this.previewCanvas = null;
    this.driver?.destroy(); this.driver = null;
    this.engine = null;
    this._hand = null;
    this.calibration = null;
  }

  mountPreview(video) {
    this.preview = this.doc.createElement('div');
    this.preview.className = 'airtouch-preview';
    this.previewCanvas = this.doc.createElement('canvas');
    this.previewCanvas.width = 112; this.previewCanvas.height = 84;
    this.preview.append(video, this.previewCanvas);
    // 案内文の上に積む（重なりを作らない）
    this.driver.dock.prepend(this.preview);
  }

  loop() {
    const view = this.doc.defaultView;
    const step = () => {
      if (!this.enabled) return;
      this._raf = view.requestAnimationFrame(step);
      this.tick(view.performance.now());
    };
    this._raf = view.requestAnimationFrame(step);
  }

  /**
   * 1フレーム分。**loop から切り出してあるのは検査のため**。
   * rAF の中に閉じ込めると、実時間に依存して「たまに落ちる検査」しか書けなくなる。
   */
  tick(now) {
    // ★タブが裏に回ったら推定しない。カメラを回したまま推論を続けると電池が溶ける
    if (this.doc.hidden) return null;
    const view = this.doc.defaultView;
    if (now - this._lastDetect >= (this.engineOptions.detectIntervalMs ?? DEFAULTS.detectIntervalMs)) {
      this._lastDetect = now;
      this.polls += 1;
      try { this._hand = this.source?.poll(now) ?? null; }
      catch (cause) { this._hand = null; this.driver?.setHint(`認識でつまずきました: ${cause?.message ?? cause}`); }
    }
    const frame = this.engine.update(this._hand, now, {
      width: view.innerWidth, height: view.innerHeight,
    });
    if (this.calibration) {
      // ★調整中は押下を実DOMへ通さない。閾値を測っている最中のつまみで
      //   ボタンが押されると、調整するたびに画面が勝手に動く（カーソルは出したままにする）
      this.driver.apply({ ...frame, pressed: false, events: frame.events.filter((e) => e.type === 'appear' || e.type === 'disappear') });
      this.stepCalibration(now);
      this.drawPreview();
      return frame;
    }
    this.driver.apply(frame);
    this.drawPreview();
    return frame;
  }

  /** プレビューへ骨格を描く。手が「見えているか」が分かると、狙いを直せる */
  drawPreview() {
    const canvas = this.previewCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const marks = this._hand?.landmarks;
    if (!marks) return;
    // 映像はCSSで鏡にしてある。骨格も同じく反転しないと左右がずれて写る
    const px = (p) => (1 - p.x) * canvas.width;
    const py = (p) => p.y * canvas.height;
    ctx.strokeStyle = 'rgba(34,211,238,.9)'; ctx.lineWidth = 1.6;
    for (const [a, b] of HAND_BONES) {
      if (!marks[a] || !marks[b]) continue;
      ctx.beginPath(); ctx.moveTo(px(marks[a]), py(marks[a])); ctx.lineTo(px(marks[b]), py(marks[b])); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(167,139,250,.95)';
    for (const point of marks) { ctx.beginPath(); ctx.arc(px(point), py(point), 1.8, 0, Math.PI * 2); ctx.fill(); }
  }
}

export default AirTouch;
