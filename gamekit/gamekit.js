/* =========================================================================
 * GameKit — hide_0001 ポートフォリオ用 Canvas マイクロエンジン
 * GameKit — Canvas micro-engine for the hide_0001 portfolio
 *
 * 方針 / Policy:
 *  - フレームワーク不使用・ビルド不要。<script src="gamekit/gamekit.js"> で読み込むだけ
 *  - Canvas API のみ。DOM はキャンバス1枚あれば動く
 *  - ダーク背景 + シアン/パープルのアクセント（サイバーパンク演出は不可）
 *
 * 使い方 / Usage:
 *   const game = new GameKit.Engine(canvas, { width: 960, height: 540 });
 *   game.changeScene(new TitleScene());
 *   game.start();
 * ========================================================================= */
(function (global) {
  'use strict';

  /* ----------------------------------------------------------------------
   * ctx.roundRect 互換実装（旧Edge / 古いWebView / Safari 16.3以前）
   *
   * GameKit 自身と各ゲームは角丸パネルを roundRect で描く。未実装の環境では
   * 描画ループの毎フレームが TypeError で落ち、「背景だけ残ってUIが出ない」
   * 形で無言に壊れる（タイトル画面は出るので起動成功に見えてしまう）。
   * 呼び出し側を書き換えるのではなく、ここで一度だけ prototype を補う。
   * -------------------------------------------------------------------- */
  (function installRoundRectPolyfill() {
    // 半径指定を CSS border-radius と同じ短縮記法で [tl,tr,br,bl] の {x,y} 4組へ正規化する
    const normalizeRadii = (radii) => {
      const list = Array.isArray(radii) ? radii : [radii === undefined ? 0 : radii];
      const toXY = (r) => {
        if (r && typeof r === 'object') {
          return { x: Math.max(0, Number(r.x) || 0), y: Math.max(0, Number(r.y) || 0) };
        }
        const v = Math.max(0, Number(r) || 0);
        return { x: v, y: v };
      };
      const v = list.map(toXY);
      if (v.length === 1) return [v[0], v[0], v[0], v[0]];
      if (v.length === 2) return [v[0], v[1], v[0], v[1]];
      if (v.length === 3) return [v[0], v[1], v[2], v[1]];
      return [v[0], v[1], v[2], v[3]];
    };

    function roundRect(x, y, w, h, radii) {
      x = Number(x); y = Number(y); w = Number(w); h = Number(h);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) return;

      let r = normalizeRadii(radii);
      // 負の幅・高さは矩形を反転させたのと同じ。原点を正規化し、角の対応も入れ替える
      if (w < 0) { x += w; w = -w; r = [r[1], r[0], r[3], r[2]]; }
      if (h < 0) { y += h; h = -h; r = [r[3], r[2], r[1], r[0]]; }

      if (w === 0 || h === 0) { this.moveTo(x, y); this.lineTo(x + w, y + h); return; }

      // 隣り合う半径の和が辺を超える場合は仕様どおり全体を等比縮小する
      const ratio = (sum, len) => (sum > 0 ? len / sum : Infinity);
      const scale = Math.min(
        ratio(r[0].x + r[1].x, w), ratio(r[3].x + r[2].x, w),
        ratio(r[0].y + r[3].y, h), ratio(r[1].y + r[2].y, h),
        1
      );
      if (scale < 1) r = r.map(p => ({ x: p.x * scale, y: p.y * scale }));

      const HALF_PI = Math.PI / 2;
      this.moveTo(x + r[0].x, y);
      this.lineTo(x + w - r[1].x, y);
      this.ellipse(x + w - r[1].x, y + r[1].y, r[1].x, r[1].y, 0, -HALF_PI, 0);
      this.lineTo(x + w, y + h - r[2].y);
      this.ellipse(x + w - r[2].x, y + h - r[2].y, r[2].x, r[2].y, 0, 0, HALF_PI);
      this.lineTo(x + r[3].x, y + h);
      this.ellipse(x + r[3].x, y + h - r[3].y, r[3].x, r[3].y, 0, HALF_PI, Math.PI);
      this.lineTo(x, y + r[0].y);
      this.ellipse(x + r[0].x, y + r[0].y, r[0].x, r[0].y, 0, Math.PI, Math.PI + HALF_PI);
      this.closePath();
    }

    // Path2D 側にも同じ実装を配る（街道描画などで new Path2D() を使うため）
    [global.CanvasRenderingContext2D, global.Path2D, global.OffscreenCanvasRenderingContext2D]
      .forEach(ctor => {
        if (ctor && ctor.prototype && typeof ctor.prototype.roundRect !== 'function') {
          Object.defineProperty(ctor.prototype, 'roundRect', {
            value: roundRect, writable: true, configurable: true, enumerable: false
          });
        }
      });
  })();

  const GameKit = {};

  /* ----------------------------------------------------------------------
   * Engine — ゲームループ + シーン管理
   * deltaTime はフレームレート非依存（秒単位・0.1sでキャップ）
   * -------------------------------------------------------------------- */
  class Engine {
    constructor(canvas, opts = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.width = opts.width || canvas.width;
      this.height = opts.height || canvas.height;
      canvas.width = this.width;
      canvas.height = this.height;
      this.scene = null;
      this.isPaused = false;
      this.input = new Input(canvas);
      this.audio = new Sfx();
      this._last = 0;
      this._raf = 0;
      this._running = false;
    }

    changeScene(next) {
      if (this.scene && this.scene.exit) this.scene.exit(this);
      this.scene = next;
      if (next && next.enter) next.enter(this);
    }

    start() {
      if (this._running) return;
      this._running = true;
      this._last = performance.now();
      const loop = (t) => {
        if (!this._running) return;
        const dt = Math.min((t - this._last) / 1000, 0.1);
        this._last = t;
        // update/draw の例外でループ自体を止めない。止めると次フレームが予約されず、
        // 描きかけのフレーム（＝背景画像だけ）が固まったまま入力も効かなくなり、
        // 「ゲームが起動しない」ようにしか見えなくなる（原因の特定が極端に難しくなる）。
        // 例外は握り潰さず console へ出し、engine.errors に積んで検査から拾えるようにする。
        try {
          if (!this.isPaused && this.scene) {
            this.scene.update(dt, this);
            this.scene.draw(this.ctx, this);
          }
        } catch (e) {
          this._reportFrameError(e);
        }
        try { this.input.endFrame(); } catch (e) { this._reportFrameError(e); }
        this._raf = requestAnimationFrame(loop);
      };
      this._raf = requestAnimationFrame(loop);
    }

    // フレーム内で出た例外の記録。同じメッセージのログ連投は抑えつつ、発生回数は数え続ける。
    // errors[] は「起動して遊べるか」を見る検査（scripts/verify-sengoku-boot.mjs）が参照する。
    _reportFrameError(e) {
      if (!this.errors) this.errors = [];
      const message = (e && (e.stack || e.message)) ? String(e.stack || e.message) : String(e);
      const key = message.split('\n').slice(0, 2).join(' | ');
      let rec = this.errors.find((r) => r.key === key);
      if (!rec) {
        rec = { key: key, count: 0 };
        if (this.errors.length < 50) this.errors.push(rec);
      }
      rec.count++;
      if (rec.count <= 3) console.error('[GameKit] フレーム処理で例外:', e);
      else if (rec.count === 4) console.error('[GameKit] 同一の例外が続くため以降のログを抑制:', key);
    }

    stop() {
      this._running = false;
      cancelAnimationFrame(this._raf);
    }
  }
  GameKit.Engine = Engine;

  /* ----------------------------------------------------------------------
   * Scene — 基底クラス。enter/exit/update/draw を上書きして使う
   * -------------------------------------------------------------------- */
  class Scene {
    enter(game) {}
    exit(game) {}
    update(dt, game) {}
    draw(ctx, game) {}
  }
  GameKit.Scene = Scene;

  /* ----------------------------------------------------------------------
   * Input — キーボード + ポインタ（マウス/タッチ統合）
   *   isDown('ArrowLeft') : 押下中
   *   justPressed('Space'): このフレームで押された
   *   pointer: { x, y, isDown, justPressed }（キャンバス座標系に変換済み）
   * -------------------------------------------------------------------- */
  class Input {
    constructor(canvas) {
      this.canvas = canvas;
      this._down = new Set();
      this._pressed = new Set();
      this.pointer = { x: 0, y: 0, isDown: false, justPressed: false };

      global.addEventListener('keydown', (e) => {
        if (!this._down.has(e.code)) this._pressed.add(e.code);
        this._down.add(e.code);
        // ゲーム操作キーのスクロールを抑止
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
          e.preventDefault();
        }
      });
      global.addEventListener('keyup', (e) => this._down.delete(e.code));

      const toLocal = (e) => {
        const r = canvas.getBoundingClientRect();
        const p = e.touches ? e.touches[0] : e;
        return {
          x: ((p.clientX - r.left) / r.width) * (Number(canvas.dataset.logicalWidth) || canvas.width),
          y: ((p.clientY - r.top) / r.height) * (Number(canvas.dataset.logicalHeight) || canvas.height),
        };
      };
      const down = (e) => {
        const p = toLocal(e);
        Object.assign(this.pointer, p, { isDown: true, justPressed: true });
        if (e.touches) e.preventDefault();
      };
      const move = (e) => {
        if (e.touches && !this.pointer.isDown) return;
        Object.assign(this.pointer, toLocal(e));
      };
      const up = () => { this.pointer.isDown = false; };
      canvas.addEventListener('mousedown', down);
      canvas.addEventListener('mousemove', move);
      global.addEventListener('mouseup', up);
      canvas.addEventListener('touchstart', down, { passive: false });
      canvas.addEventListener('touchmove', move, { passive: false });
      canvas.addEventListener('touchend', up);
    }

    isDown(code) { return this._down.has(code); }
    justPressed(code) { return this._pressed.has(code); }
    /** 方向入力を {x,y} (-1..1) で返す（矢印 + WASD） */
    axis() {
      const x = (this.isDown('ArrowRight') || this.isDown('KeyD') ? 1 : 0)
              - (this.isDown('ArrowLeft') || this.isDown('KeyA') ? 1 : 0);
      const y = (this.isDown('ArrowDown') || this.isDown('KeyS') ? 1 : 0)
              - (this.isDown('ArrowUp') || this.isDown('KeyW') ? 1 : 0);
      return { x, y };
    }
    endFrame() {
      this._pressed.clear();
      this.pointer.justPressed = false;
    }
  }
  GameKit.Input = Input;

  /* ----------------------------------------------------------------------
   * Assets — 画像/JSON のプリロード（404 は reject して検知可能にする）
   *   const img = await GameKit.Assets.loadImages({ hero: 'assets/art/hero.png' });
   * -------------------------------------------------------------------- */
  GameKit.Assets = {
    loadImages(map) {
      const entries = Object.entries(map).map(([name, url]) =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve([name, img]);
          img.onerror = () => reject(new Error('画像の読み込みに失敗 / failed to load: ' + url));
          img.src = url;
        })
      );
      return Promise.all(entries).then((pairs) => Object.fromEntries(pairs));
    },
    loadJSON(url) {
      return fetch(url).then((r) => {
        if (!r.ok) throw new Error('JSONの読み込みに失敗 / failed to load: ' + url);
        return r.json();
      });
    },
  };

  /* ----------------------------------------------------------------------
   * Sprite — スプライトシートのフレームアニメーション
   *   new Sprite(img, { fw: 32, fh: 32, frames: 4, fps: 8 })
   * -------------------------------------------------------------------- */
  class Sprite {
    constructor(img, opts) {
      this.img = img;
      this.fw = opts.fw;
      this.fh = opts.fh;
      this.frames = opts.frames;
      this.fps = opts.fps || 8;
      this.t = 0;
    }
    update(dt) { this.t += dt; }
    draw(ctx, x, y, w, h) {
      const i = Math.floor(this.t * this.fps) % this.frames;
      const cols = Math.floor(this.img.width / this.fw);
      const sx = (i % cols) * this.fw;
      const sy = Math.floor(i / cols) * this.fh;
      ctx.drawImage(this.img, sx, sy, this.fw, this.fh, x, y, w || this.fw, h || this.fh);
    }
  }
  GameKit.Sprite = Sprite;

  /* ----------------------------------------------------------------------
   * Collision — 衝突判定（game-dev スキル準拠）
   * -------------------------------------------------------------------- */
  GameKit.Collision = {
    aabb(a, b) {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    },
    circles(a, b) {
      return Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r;
    },
    rectCircle(rect, c) {
      const nx = Math.max(rect.x, Math.min(c.x, rect.x + rect.w));
      const ny = Math.max(rect.y, Math.min(c.y, rect.y + rect.h));
      return Math.hypot(c.x - nx, c.y - ny) < c.r;
    },
  };

  /* ----------------------------------------------------------------------
   * Sfx — Web Audio API プロシージャル効果音（音声ファイル不要）
   * Music-Generator エージェントの納品コードもここに統合できる
   * -------------------------------------------------------------------- */
  class Sfx {
    constructor() { this._ctx = null; }
    _ac() {
      // AudioContext はユーザー操作後に生成（autoplay 制限対策）
      if (!this._ctx) this._ctx = new (global.AudioContext || global.webkitAudioContext)();
      if (this._ctx.state === 'suspended') this._ctx.resume();
      return this._ctx;
    }
    /** 単音ビープ。type: 'sine'|'square'|'triangle'|'sawtooth' */
    beep(freq = 440, dur = 0.12, type = 'sine', vol = 0.2) {
      const ac = this._ac();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
      osc.connect(gain).connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + dur);
    }
    /** ノイズバースト（ヒット/爆発用） */
    noise(dur = 0.2, vol = 0.25) {
      const ac = this._ac();
      const len = Math.floor(ac.sampleRate * dur);
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ac.createBufferSource();
      const gain = ac.createGain();
      gain.gain.value = vol;
      src.buffer = buf;
      src.connect(gain).connect(ac.destination);
      src.start();
    }
    /** 音符列ジングル。notes: [{f: 周波数, d: 長さ秒}] */
    jingle(notes, type = 'triangle', vol = 0.18) {
      const ac = this._ac();
      let t = ac.currentTime;
      for (const n of notes) {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = type;
        osc.frequency.value = n.f;
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + n.d);
        osc.connect(gain).connect(ac.destination);
        osc.start(t);
        osc.stop(t + n.d);
        t += n.d;
      }
    }
  }
  GameKit.Sfx = Sfx;

  /* ----------------------------------------------------------------------
   * Particles — アンビエントパーティクル（ポートフォリオ共通の背景演出）
   * -------------------------------------------------------------------- */
  class Particles {
    constructor(w, h, opts = {}) {
      this.w = w;
      this.h = h;
      this.colors = opts.colors || ['#22d3ee', '#a78bfa'];
      this.items = Array.from({ length: opts.count || 60 }, () => this._spawn());
    }
    _spawn() {
      return {
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        r: 0.5 + Math.random() * 1.8,
        vx: (Math.random() - 0.5) * 18,
        vy: (Math.random() - 0.5) * 18,
        c: this.colors[(Math.random() * this.colors.length) | 0],
        a: 0.15 + Math.random() * 0.45,
      };
    }
    update(dt) {
      for (const p of this.items) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.x < 0) p.x += this.w; else if (p.x > this.w) p.x -= this.w;
        if (p.y < 0) p.y += this.h; else if (p.y > this.h) p.y -= this.h;
      }
    }
    draw(ctx) {
      for (const p of this.items) {
        ctx.globalAlpha = p.a;
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }
  GameKit.Particles = Particles;

  /* ----------------------------------------------------------------------
   * Gen — プロシージャル画像生成（ノイズ・パレット・背景・パターン・アイコン）
   * 外部の生成AI（GPT Image等）を使わず、シード値から再現可能なアセットを
   * Canvas API で直接生成する。`gamekit/generator.html` で動作確認・PNG書き出し可能
   * -------------------------------------------------------------------- */

  /** sides角形（star=trueなら2*sides頂点の星形）のパスを ctx に積む（内部ヘルパー） */
  function polygonPath(ctx, cx, cy, r, sides, rotation = -Math.PI / 2, star = false) {
    const points = star ? sides * 2 : sides;
    const step = (Math.PI * 2) / points;
    for (let i = 0; i <= points; i++) {
      const angle = rotation + i * step;
      const radius = star && i % 2 === 1 ? r * 0.5 : r;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
  }

  const Gen = {
    /** カラーパレット集。デフォルトはポートフォリオ標準のシアン/パープル（黒背景） */
    palettes: {
      cyanPurple: ['#22d3ee', '#a78bfa', '#05070d'],
      auroraTeal: ['#2dd4bf', '#818cf8', '#05070d'],
      roseQuartz: ['#f472b6', '#a78bfa', '#05070d'],
      emberViolet: ['#fb923c', '#a78bfa', '#05070d'],
    },

    /** シード付き疑似乱数生成器（mulberry32）。0..1 を返す関数を返す */
    rng(seed) {
      let a = (seed >>> 0) || 1;
      return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },

    /** 格子点ノイズ + 補間による2D value noise（-1..1）を返す */
    valueNoise2D(rng) {
      const cache = new Map();
      const valAt = (ix, iy) => {
        const key = ix + ',' + iy;
        let v = cache.get(key);
        if (v === undefined) { v = rng() * 2 - 1; cache.set(key, v); }
        return v;
      };
      const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
      return function (x, y) {
        const x0 = Math.floor(x), y0 = Math.floor(y);
        const sx = fade(x - x0), sy = fade(y - y0);
        const n00 = valAt(x0, y0), n10 = valAt(x0 + 1, y0);
        const n01 = valAt(x0, y0 + 1), n11 = valAt(x0 + 1, y0 + 1);
        return GameKit.MathX.lerp(
          GameKit.MathX.lerp(n00, n10, sx),
          GameKit.MathX.lerp(n01, n11, sx),
          sy
        );
      };
    },

    /** value noise を複数オクターブで合成したフラクタルノイズ（-1..1）を返す */
    fractalNoise2D(rng, opts = {}) {
      const octaves = opts.octaves || 4;
      const persistence = opts.persistence || 0.5;
      const scale = opts.scale || 0.01;
      const base = Gen.valueNoise2D(rng);
      return function (x, y) {
        let amp = 1, freq = 1, sum = 0, max = 0;
        for (let i = 0; i < octaves; i++) {
          sum += base(x * scale * freq, y * scale * freq) * amp;
          max += amp;
          amp *= persistence;
          freq *= 2;
        }
        return sum / max;
      };
    },

    /** ノイズで駆動した放射グラデーションの重ね描きでネビュラ風背景を生成 */
    nebulaBackground(ctx, w, h, opts = {}) {
      const rng = opts.rng || Gen.rng(opts.seed || 1);
      const palette = opts.palette || Gen.palettes.cyanPurple;
      const blobCount = opts.blobCount || 5;
      const noise = Gen.fractalNoise2D(rng, { octaves: 3, scale: 0.002 });

      ctx.save();
      ctx.fillStyle = palette[palette.length - 1];
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < blobCount; i++) {
        const n = Math.abs(noise(i * 137.1, i * 91.7));
        const x = (0.1 + rng() * 0.8) * w;
        const y = (0.1 + rng() * 0.8) * h;
        const r = (0.25 + n * 0.35) * Math.max(w, h);
        const color = palette[i % (palette.length - 1)];
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, color + 'cc');
        grad.addColorStop(1, color + '00');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },

    /** 書き出し用の静止スターフィールド（動的な背景演出は GameKit.Particles を使う） */
    starfield(ctx, w, h, opts = {}) {
      const rng = opts.rng || Gen.rng(opts.seed || 1);
      const palette = opts.palette || Gen.palettes.cyanPurple;
      const count = opts.count || 150;

      ctx.save();
      ctx.fillStyle = palette[palette.length - 1];
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < count; i++) {
        ctx.globalAlpha = 0.2 + rng() * 0.7;
        ctx.fillStyle = palette[(rng() * (palette.length - 1)) | 0];
        ctx.beginPath();
        ctx.arc(rng() * w, rng() * h, 0.4 + rng() * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    },

    /** タイル可能なパターンを size x size の正方形に描画。
     *  type: 'dots' | 'hexgrid' | 'waves' | 'grain' */
    tilePattern(ctx, size, opts = {}) {
      const rng = opts.rng || Gen.rng(opts.seed || 1);
      const palette = opts.palette || Gen.palettes.cyanPurple;
      const type = opts.type || 'dots';
      const scale = opts.scale || size / 8;

      ctx.save();
      switch (type) {
        case 'dots':
          ctx.fillStyle = palette[0] + '33';
          for (let y = 0; y <= size; y += scale) {
            for (let x = 0; x <= size; x += scale) {
              ctx.beginPath();
              ctx.arc(x, y, scale * 0.12, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          break;
        case 'hexgrid': {
          ctx.strokeStyle = palette[1] + '40';
          ctx.lineWidth = 1;
          const hexR = scale * 0.6;
          const stepX = hexR * 1.5;
          const stepY = hexR * Math.sqrt(3) * 0.5;
          let row = 0;
          for (let y = -hexR; y <= size + hexR; y += stepY, row++) {
            for (let x = -hexR; x <= size + hexR; x += stepX) {
              const cx = x + (row % 2 ? stepX / 2 : 0);
              ctx.beginPath();
              polygonPath(ctx, cx, y, hexR, 6, Math.PI / 6, false);
              ctx.closePath();
              ctx.stroke();
            }
          }
          break;
        }
        case 'waves': {
          ctx.strokeStyle = palette[0] + '55';
          ctx.lineWidth = 1.5;
          const waveCount = Math.max(2, Math.round(size / scale));
          for (let i = 0; i < waveCount; i++) {
            const yBase = ((i + 0.5) / waveCount) * size;
            ctx.beginPath();
            for (let x = 0; x <= size; x += 4) {
              const y = yBase + Math.sin((x / size) * Math.PI * 2) * (scale * 0.25);
              if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();
          }
          break;
        }
        case 'grain': {
          const alpha = opts.alpha ?? 32;
          const img = ctx.createImageData(size, size);
          for (let i = 0; i < img.data.length; i += 4) {
            const v = (rng() * 255) | 0;
            img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
            img.data[i + 3] = alpha;
          }
          ctx.putImageData(img, 0, 0);
          break;
        }
      }
      ctx.restore();
    },

    /** 発光オーブ/ジェム風アイコンを描画（実績バッジ・パワーアップ等に利用可） */
    orbIcon(ctx, cx, cy, r, opts = {}) {
      const palette = opts.palette || Gen.palettes.cyanPurple;
      ctx.save();
      if (opts.glow !== false) {
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.8);
        glow.addColorStop(0, palette[0] + '55');
        glow.addColorStop(1, palette[0] + '00');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      const body = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
      body.addColorStop(0, '#ffffff');
      body.addColorStop(0.4, palette[0]);
      body.addColorStop(1, palette[1]);
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.ellipse(cx - r * 0.32, cy - r * 0.35, r * 0.28, r * 0.16, -Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },

    /** 多角形/星形のGlassmorphismバッジアイコンを描画（GameKit.UI.glassPanelと同系の配色） */
    polygonBadge(ctx, cx, cy, r, opts = {}) {
      const sides = opts.sides || 6;
      const rotation = opts.rotation ?? -Math.PI / 2;
      ctx.save();
      ctx.beginPath();
      polygonPath(ctx, cx, cy, r, sides, rotation, !!opts.star);
      ctx.closePath();
      ctx.fillStyle = opts.fill || 'rgba(255,255,255,0.06)';
      ctx.fill();
      ctx.lineWidth = opts.lineWidth || 2;
      ctx.strokeStyle = opts.stroke || (opts.palette ? opts.palette[0] : 'rgba(255,255,255,0.18)');
      ctx.stroke();
      ctx.restore();
    },

    /** canvas を PNG の data URL に変換 */
    toPNG(canvas) {
      return canvas.toDataURL('image/png');
    },

    /** canvas を PNG ファイルとしてダウンロード */
    download(canvas, filename = 'asset.png') {
      const a = document.createElement('a');
      a.href = Gen.toPNG(canvas);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },
  };
  GameKit.Gen = Gen;

  /* ----------------------------------------------------------------------
   * UI — Glassmorphism パネルとテキスト描画
   * -------------------------------------------------------------------- */
  GameKit.UI = {
    glassPanel(ctx, x, y, w, h, opts = {}) {
      const r = opts.radius || 14;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fillStyle = opts.fill || 'rgba(255,255,255,0.06)';
      ctx.fill();
      ctx.strokeStyle = opts.stroke || 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    },
    text(ctx, str, x, y, opts = {}) {
      ctx.save();
      ctx.font = opts.font || '16px "Segoe UI", "Hiragino Sans", sans-serif';
      ctx.fillStyle = opts.color || '#e2e8f0';
      ctx.textAlign = opts.align || 'center';
      ctx.textBaseline = opts.baseline || 'top';
      ctx.fillText(str, x, y);
      ctx.restore();
    },
  };

  /* ----------------------------------------------------------------------
   * Save — localStorage ラッパー（ゲームごとに名前空間を分ける）
   * -------------------------------------------------------------------- */
  class Save {
    constructor(ns) { this.ns = 'gamekit:' + ns + ':'; }
    get(key, fallback = null) {
      try {
        const raw = localStorage.getItem(this.ns + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    }
    set(key, value) {
      try { localStorage.setItem(this.ns + key, JSON.stringify(value)); } catch (e) {}
    }
  }
  GameKit.Save = Save;

  /* Math ユーティリティ */
  GameKit.MathX = {
    clamp: (v, lo, hi) => Math.min(hi, Math.max(lo, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    rand: (lo, hi) => lo + Math.random() * (hi - lo),
  };

  global.GameKit = GameKit;
})(window);
