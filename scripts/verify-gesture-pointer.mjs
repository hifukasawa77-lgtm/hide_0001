#!/usr/bin/env node
/*
 * verify-gesture-pointer.mjs — エアタッチ（assets/js/gesture-pointer.js）の必須チェック
 *
 * この機能は**実機でしか全部は確かめられない**。カメラもGPUも無いヘッドレスでは
 * 手の認識そのものは動かない。だから確かめるのは「認識できたあと」の全部にする:
 *   - 手ぶれ取り（1€フィルタ）が、揺れを消しつつ速い動きに遅れないか
 *   - ピンチ判定が、カメラからの距離で変わらないか（＝手の大きさで正規化できているか）
 *   - 閾値付近の揺れで押下が連打されないか（ヒステリシス）
 *   - タップ・スワイプ・パン・ドラッグ&ドロップが、実DOMに正しいイベントとして届くか
 *   - 手を見失ったときに押しっぱなしで固まらないか
 *   - オーバーレイが本物の操作を邪魔しないか（pointer-events:none）
 *   - OFFでカメラが確実に止まるか
 *   - ページ側の配線（CSP・importmapの版と integrity・遅延読み込み）
 *
 * 推定層は window.__AIRTOUCH_SOURCE_FACTORY で合成データに差し替える。
 * 時間も明示的に渡すので、実時間に依存して「たまに落ちる検査」にはならない。
 *
 * 使い方: node scripts/verify-gesture-pointer.mjs
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'zero-1-mobile.html';
const MODULE = 'assets/js/gesture-pointer.js';
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml' };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  // ブラウザが勝手に取りに行く。404を返すと console.error が出て検査が常に落ちる
  if (url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  const file = path.join(ROOT, url === '/' ? PAGE : url.replace(/^\//, ''));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;

let pass = 0, fail = 0;
const ok = (n, e='') => { pass++; console.log(`  ✅ ${n}${e ? '  ' + e : ''}`); };
const ng = (n, e='') => { fail++; console.log(`  ❌ ${n}${e ? '  ' + e : ''}`); };
const check = (n, cond, e='') => (cond ? ok(n, e) : ng(n, e));

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH
    || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined),
  args: ['--no-sandbox'],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
});

const errors = [];
const requested = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('request', (r) => requested.push(r.url()));

console.log('\n== エアタッチ（カメラで指をかざして操作）の検査 ==');

/* ------------------------------------------------------------------ *
 * 0. ページ側の配線（静的）
 * ------------------------------------------------------------------ */
const html = fs.readFileSync(path.join(ROOT, PAGE), 'utf8');
const moduleSource = fs.readFileSync(path.join(ROOT, MODULE), 'utf8');
const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1] ?? '';
check('1. モデル取得先がCSPに入っている', /connect-src[^;]*storage\.googleapis\.com/.test(csp), csp.match(/connect-src[^;]*/)?.[0]?.slice(0, 90));
// これを忘れるとカメラ映像を <video> に流した瞬間に止まる（例外の文面からは理由が読めない）
check('2. カメラ映像用の media-src がある', /media-src[^;]*blob:/.test(csp), csp.match(/media-src[^;]*/)?.[0]);
// ★壊れた importmap は「例外で検査ごと死ぬ」のではなく、不合格として名指しする。
//   例外で死ぬと、他の46件が走ったのかどうかも分からなくなる
let importmap = null, mapError = '';
try { importmap = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]); }
catch (cause) { mapError = String(cause?.message ?? cause); }
check('2b. importmap が読める形になっている', importmap !== null, mapError);
const visionUrl = importmap?.imports?.['mediapipe-vision'];
check('3. 手の認識ライブラリの版を固定している', /@mediapipe\/tasks-vision@\d+\.\d+\.\d+\//.test(visionUrl ?? ''), visionUrl);
check('4. その版に integrity（改ざん検知）が付いている',
  typeof importmap?.integrity?.[visionUrl] === 'string' && importmap.integrity[visionUrl].startsWith('sha384-'),
  importmap?.integrity?.[visionUrl]?.slice(0, 24));
// ★ここがずれると、integrity検証を通った版とは**別の版**を直接URLで読み直してしまう。
//   例外は出ず「なぜか動きが変わった」だけが残る
const moduleVersion = moduleSource.match(/VISION_VERSION = '([\d.]+)'/)?.[1];
const mapVersion = visionUrl?.match(/tasks-vision@([\d.]+)\//)?.[1];
check('5. モジュールが持つ版と importmap の版が一致', moduleVersion === mapVersion, `モジュール ${moduleVersion} / importmap ${mapVersion}`);

await page.goto(`${BASE}/${PAGE}`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.ZERO1_MOBILE_READY === true, { timeout: 15_000 }).catch(() => {});
check('6. 起動時の例外が0件', errors.length === 0, errors.slice(0, 2).join(' / '));
// ★使わない人にライブラリ数MBを払わせない。押されるまで取りに行かないこと
check('7. 押されるまでエアタッチを読み込まない（遅延読み込み）',
  !requested.some((u) => u.includes('gesture-pointer.js')) && !requested.some((u) => u.includes('tasks-vision')));
check('8. 起動前からエアタッチのボタンが押せる（LLMの取得を待たせない）',
  await page.locator('#btn-air').isVisible());

/* ------------------------------------------------------------------ *
 * 判定層 — 純粋ロジック（時間を明示して決定的に確かめる）
 * ------------------------------------------------------------------ */
const HELPERS = `
  const VIEW = { width: 390, height: 844 };
  /** 正規化座標(nx,ny)に、指定のピンチ量で手を置く。
   *  親指と人差し指を対称に近づけるので、つまんでもポインターの位置は動かない */
  window.makeHand = (nx, ny, pinch, scale = 0.15) => {
    const d = pinch * scale;
    const lm = Array.from({ length: 21 }, () => ({ x: nx, y: ny, z: 0 }));
    lm[0]  = { x: nx, y: ny + scale, z: 0 };        // 手首
    lm[9]  = { x: nx, y: ny, z: 0 };                // 中指の付け根
    lm[5]  = { x: nx - scale / 3, y: ny, z: 0 };    // 人差し指の付け根
    lm[17] = { x: nx + scale / 3, y: ny, z: 0 };    // 小指の付け根
    lm[8]  = { x: nx + 0.35 * d, y: ny, z: 0 };     // 人差し指の先
    lm[4]  = { x: nx - 0.65 * d, y: ny, z: 0 };     // 親指の先
    return { landmarks: lm };
  };
  /** 人差し指は開いたまま、中指だけを親指へ寄せた手（＝右クリックの構え） */
  window.makeSecondaryHand = (nx, ny, secondary, scale = 0.15) => {
    const hand = window.makeHand(nx, ny, 0.95, scale);
    hand.landmarks[12] = { x: hand.landmarks[4].x + secondary * scale, y: ny, z: 0 };
    return hand;
  };
  window.VIEW = VIEW;
`;
await page.addScriptTag({ content: HELPERS, type: 'module' }).catch(() => {});
await page.evaluate(HELPERS);

const logic = await page.evaluate(async ([base]) => {
  const M = await import(`${base}/assets/js/gesture-pointer.js`);
  const out = {};

  // --- 座標の対応（鏡） ---
  const left = M.mapToScreen(0.25, 0.5, { width: 390, height: 844 });
  const right = M.mapToScreen(0.75, 0.5, { width: 390, height: 844 });
  out.mirrored = left.x > right.x;
  out.center = M.mapToScreen(0.5, 0.5, { width: 390, height: 844 });
  const outside = M.mapToScreen(0.99, 0.99, { width: 390, height: 844 });
  out.clamped = { x: outside.x, y: outside.y };

  // --- ピンチ量が手の大きさで正規化されているか ---
  const near = M.pinchRatio(window.makeHand(0.5, 0.5, 0.3, 0.30).landmarks);
  const far = M.pinchRatio(window.makeHand(0.5, 0.5, 0.3, 0.06).landmarks);
  out.pinchNear = near; out.pinchFar = far;

  // --- つまんでもポインターがずれないか ---
  const openAnchor = M.pointerAnchor(window.makeHand(0.5, 0.5, 0.9).landmarks);
  const pinchAnchor = M.pointerAnchor(window.makeHand(0.5, 0.5, 0.15).landmarks);
  out.anchorDrift = Math.hypot(openAnchor.x - pinchAnchor.x, openAnchor.y - pinchAnchor.y);

  // --- 1€フィルタ: 揺れを消す／速い動きに遅れない ---
  const filter = new M.OneEuroFilter();
  const raw = [], smooth = [];
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648 - 0.5;
  for (let i = 0; i < 90; i++) {
    const value = 200 + rnd() * 12;             // 止めているつもりでも指は揺れる
    raw.push(value);
    smooth.push(filter.filter(value, i / 60));
  }
  const spread = (a) => { const m = a.reduce((s, v) => s + v, 0) / a.length; return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length); };
  out.jitterRaw = spread(raw.slice(30)); out.jitterSmooth = spread(smooth.slice(30));
  const fast = new M.OneEuroFilter();
  let last = 0;
  for (let i = 0; i < 30; i++) last = fast.filter(i * 30, i / 60);   // 1800px/秒 で払う
  out.lag = 29 * 30 - last;

  // --- 押下のヒステリシス ---
  const engine = new M.GestureEngine();
  const feed = (pinch, t, x = 0.5, y = 0.5) => engine.update(window.makeHand(x, y, pinch), t, window.VIEW).events.map((e) => e.type);
  const seq = [];
  seq.push(...feed(0.9, 0), ...feed(0.30, 33),
    ...feed(0.50, 66), ...feed(0.35, 99), ...feed(0.50, 132), ...feed(0.35, 165),   // 上下の閾値の“間”で往復させる
    ...feed(0.9, 198));
  out.hysteresis = seq.filter((t) => t === 'down' || t === 'up');

  // --- 手を見失ったら、押しっぱなしを解除する ---
  const lost = new M.GestureEngine();
  lost.update(window.makeHand(0.5, 0.5, 0.9), 0, window.VIEW);
  lost.update(window.makeHand(0.5, 0.5, 0.2), 33, window.VIEW);
  const before = lost.pressed;
  let released = null;
  for (const t of [66, 200, 500, 900]) {
    const frame = lost.update(null, t, window.VIEW);
    const up = frame.events.find((e) => e.type === 'up');
    if (up) released = up;
  }
  out.lostPressedBefore = before;
  out.lostReleased = released ? { cancelled: released.cancelled, tap: released.tap } : null;
  out.lostVisible = lost.visible;

  // --- タップ／スワイプの見分け ---
  const classify = (steps) => {
    const e = new M.GestureEngine();
    let up = null;
    for (const [pinch, t, x, y] of steps) {
      for (const event of e.update(window.makeHand(x, y, pinch), t, window.VIEW).events) if (event.type === 'up') up = event;
    }
    return up;
  };
  out.tap = classify([[0.9, 0, 0.5, 0.5], [0.2, 33, 0.5, 0.5], [0.2, 100, 0.5, 0.5], [0.9, 180, 0.5, 0.5]]);
  out.slow = classify([[0.9, 0, 0.5, 0.5], [0.2, 33, 0.5, 0.5],
    [0.2, 300, 0.5, 0.45], [0.2, 600, 0.5, 0.40], [0.2, 900, 0.5, 0.35], [0.9, 1200, 0.5, 0.35]]);
  out.flick = classify([[0.9, 0, 0.5, 0.6], [0.2, 33, 0.5, 0.6],
    [0.2, 66, 0.5, 0.52], [0.2, 99, 0.5, 0.44], [0.2, 132, 0.5, 0.36], [0.9, 165, 0.5, 0.30]]);
  out.dirs = [M.swipeDirection(500, 10), M.swipeDirection(-500, 10), M.swipeDirection(10, 500), M.swipeDirection(10, -500)];
  return out;
}, [BASE]);

check('9. カメラの左右を鏡にしている（手を右へ→ポインターも右へ）', logic.mirrored);
check('10. 真ん中は画面の真ん中に対応する',
  Math.abs(logic.center.x - 195) < 1 && Math.abs(logic.center.y - 422) < 1,
  `${logic.center.x.toFixed(0)},${logic.center.y.toFixed(0)}`);
check('11. 使う範囲の外は画面端で止まる（範囲外で座標が暴れない）',
  logic.clamped.x === 0 && logic.clamped.y === 844, `${logic.clamped.x},${logic.clamped.y}`);
check('12. ピンチ量がカメラからの距離で変わらない（手の大きさで正規化）',
  Math.abs(logic.pinchNear - logic.pinchFar) < 0.01,
  `近く ${logic.pinchNear.toFixed(3)} / 遠く ${logic.pinchFar.toFixed(3)}`);
check('13. つまんでもポインターがずれない（指先ではなく摘まむ点を使う）',
  logic.anchorDrift < 0.005, `ずれ ${logic.anchorDrift.toFixed(4)}`);
check('14. 手ぶれを減らす', logic.jitterSmooth < logic.jitterRaw * 0.5,
  `生 ${logic.jitterRaw.toFixed(2)}px → 補正後 ${logic.jitterSmooth.toFixed(2)}px`);
check('15. 速い動きに遅れない（追従の遅れが1フレーム相当以内）',
  Math.abs(logic.lag) < 30, `遅れ ${logic.lag.toFixed(1)}px`);
check('16. 閾値付近の揺れで押下が連打されない（ヒステリシス）',
  logic.hysteresis.join(',') === 'down,up', logic.hysteresis.join(','));
check('17. 手を見失ったら押下を解除する（掴んだまま固まらない）',
  logic.lostPressedBefore && logic.lostReleased?.cancelled === true && logic.lostReleased.tap === false && logic.lostVisible === false,
  JSON.stringify(logic.lostReleased));
check('18. 短く摘まんで離す＝タップ', logic.tap?.tap === true && logic.tap.swipe === null, `${logic.tap?.ms}ms / ${logic.tap?.dist?.toFixed(1)}px`);
check('19. ゆっくり大きく動かす＝タップにもスワイプにもしない',
  logic.slow?.tap === false && logic.slow.swipe === null, `${logic.slow?.dist?.toFixed(0)}px`);
check('20. 速く払う＝スワイプ（向き付き）',
  logic.flick?.swipe?.dir === 'up', JSON.stringify(logic.flick?.swipe && { dir: logic.flick.swipe.dir }));
check('21. 4方向を正しく向き分ける', logic.dirs.join(',') === 'right,left,down,up', logic.dirs.join(','));

/* ------------------------------------------------------------------ *
 * 作用層 — 実DOMへイベントが届くか
 * ------------------------------------------------------------------ */
const FIXTURE = async ([base]) => {
  const M = await import(`${base}/assets/js/gesture-pointer.js`);
  // 実物のDOMを相手にする。関数だけの検査は「合っているのに何も押せない」を見逃す
  const panel = document.createElement('div');
  panel.id = 'airtouch-fixture';
  panel.style.cssText = 'position:fixed; inset:0; z-index:1';
  panel.innerHTML = `
    <button id="fx-a" style="position:absolute; left:20px; top:60px; width:150px; height:64px">A</button>
    <button id="fx-b" style="position:absolute; left:20px; top:150px; width:150px; height:64px">B</button>
    <div id="fx-scroll" style="position:absolute; left:0; top:300px; width:390px; height:220px; overflow-y:auto">
      <div style="height:2400px"></div>
    </div>
    <div id="fx-item" draggable="true" style="position:absolute; left:230px; top:60px; width:120px; height:80px; background:#123">つまむ</div>
    <div id="fx-zone" style="position:absolute; left:230px; top:170px; width:120px; height:100px; background:#231">おく</div>
  `;
  document.body.appendChild(panel);

  const log = [];
  const watch = (id, types) => {
    const el = document.getElementById(id);
    for (const type of types) el.addEventListener(type, (e) => log.push(`${id}:${type}`));
  };
  watch('fx-a', ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click', 'pointerover', 'pointerout']);
  watch('fx-b', ['click', 'pointerover', 'pointerout']);
  watch('fx-item', ['dragstart', 'drag', 'dragend', 'click']);
  watch('fx-zone', ['dragenter', 'dragover', 'drop']);
  const gestures = [];
  document.addEventListener('airtouch:gesture', (e) => gestures.push(e.detail.kind));

  const engine = new M.GestureEngine();
  const driver = new M.PointerDriver({ doc: document, reducedMotion: false });
  const view = { width: window.innerWidth, height: window.innerHeight };
  // 画面座標 → カメラの正規化座標（mapToScreen の逆算）。狙った要素の上へ手を置くため
  const box = M.DEFAULTS.activeBox;
  const toCam = (sx, sy) => ({
    nx: 1 - (box.x0 + (sx / view.width) * (box.x1 - box.x0)),
    ny: box.y0 + (sy / view.height) * (box.y1 - box.y0),
  });
  const step = (sx, sy, pinch, t) => {
    const cam = toCam(sx, sy);
    driver.apply(engine.update(window.makeHand(cam.nx, cam.ny, pinch), t, view));
  };
  const reset = () => { engine.reset(); log.length = 0; gestures.length = 0; };

  const out = { overlayPointerEvents: getComputedStyle(document.querySelector('.airtouch-layer')).pointerEvents };

  // --- タップ ---
  const a = document.getElementById('fx-a').getBoundingClientRect();
  const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  step(ax, ay, 0.9, 0); step(ax, ay, 0.2, 40); step(ax, ay, 0.2, 120); step(ax, ay, 0.9, 200);
  out.tapLog = [...log]; out.tapGestures = [...gestures];
  out.tapClicks = log.filter((l) => l === 'fx-a:click').length;

  // --- ホバーは対象が変わったら付け替える ---
  reset();
  const b = document.getElementById('fx-b').getBoundingClientRect();
  step(ax, ay, 0.9, 400); step(ax, ay, 0.9, 440);
  const hoverA = document.getElementById('fx-a').classList.contains('airtouch-hover');
  step(b.left + 40, b.top + 30, 0.9, 480); step(b.left + 40, b.top + 30, 0.9, 520);
  out.hover = { a: hoverA, aAfter: document.getElementById('fx-a').classList.contains('airtouch-hover'),
    b: document.getElementById('fx-b').classList.contains('airtouch-hover'), log: [...log] };

  // --- つまんでなぞる＝スクロール（タップにはしない） ---
  reset();
  const scroller = document.getElementById('fx-scroll');
  scroller.scrollTop = 0;
  const sx = 195;
  step(sx, 480, 0.9, 700); step(sx, 480, 0.2, 740);
  for (let i = 1; i <= 5; i++) step(sx, 480 - i * 28, 0.2, 740 + i * 90);   // ゆっくり上へ払う
  step(sx, 340, 0.9, 1300);
  out.pan = { scrollTop: scroller.scrollTop, gestures: [...gestures], clicks: log.filter((l) => l.endsWith(':click')).length };

  // --- 速く払う＝スワイプ ---
  reset();
  scroller.scrollTop = 0;
  step(sx, 500, 0.9, 2000); step(sx, 500, 0.2, 2033);
  for (let i = 1; i <= 4; i++) step(sx, 500 - i * 40, 0.2, 2033 + i * 33);
  step(sx, 340, 0.9, 2200);
  out.swipe = { gestures: [...gestures], scrollTop: scroller.scrollTop };
  await new Promise((r) => setTimeout(r, 260));     // 慣性が続く時間
  out.swipeAfterInertia = scroller.scrollTop;
  driver.cancelInertia();

  // --- ドラッグ&ドロップ ---
  reset();
  const item = document.getElementById('fx-item').getBoundingClientRect();
  const zone = document.getElementById('fx-zone').getBoundingClientRect();
  const ix = item.left + item.width / 2, iy = item.top + item.height / 2;
  const zx = zone.left + zone.width / 2, zy = zone.top + zone.height / 2;
  step(ix, iy, 0.9, 3000); step(ix, iy, 0.2, 3040);
  for (let i = 1; i <= 4; i++) step(ix + (zx - ix) * i / 4, iy + (zy - iy) * i / 4, 0.2, 3040 + i * 120);
  step(zx, zy, 0.9, 3600);
  out.drag = { log: [...log], gestures: [...gestures] };

  driver.destroy();
  panel.remove();
  return out;
};

const dom = await page.evaluate(FIXTURE, [BASE]);

check('22. カーソルの層が本物の操作を邪魔しない（pointer-events:none）',
  dom.overlayPointerEvents === 'none', dom.overlayPointerEvents);
// ★合成 PointerEvent からは互換の MouseEvent が自動生成されない。両方出さないと
//   mouse系だけを聞いている既存のUIが一切反応しない（実際に一度これで無反応だった）
check('23. タップで pointerdown と mousedown の両方が届く',
  dom.tapLog.includes('fx-a:pointerdown') && dom.tapLog.includes('fx-a:mousedown'), dom.tapLog.join(' '));
check('24. タップで pointerup と mouseup の両方が届く',
  dom.tapLog.includes('fx-a:pointerup') && dom.tapLog.includes('fx-a:mouseup'));
check('25. タップは click を1回だけ出す（二重発火しない）', dom.tapClicks === 1, `${dom.tapClicks}回`);
check('26. タップが airtouch:gesture(tap) として観測できる', dom.tapGestures.includes('tap'), dom.tapGestures.join(','));
check('27. ホバーが対象に付く（合成イベントでは :hover が点かないぶんを自前で）',
  dom.hover.a === true && dom.hover.b === true && dom.hover.aAfter === false,
  JSON.stringify({ a: dom.hover.a, aAfter: dom.hover.aAfter, b: dom.hover.b }));
check('28. 対象が変わると pointerout / pointerover が飛ぶ',
  dom.hover.log.includes('fx-a:pointerout') && dom.hover.log.includes('fx-b:pointerover'));
check('29. つまんでなぞるとスクロールする', dom.pan.scrollTop > 60, `${dom.pan.scrollTop}px`);
check('30. なぞった後に誤タップしない', dom.pan.clicks === 0 && !dom.pan.gestures.includes('tap'), dom.pan.gestures.join(','));
check('31. 速く払うとスワイプになる', dom.swipe.gestures.includes('swipe'), dom.swipe.gestures.join(','));
check('32. 離した後も慣性で少し滑る', dom.swipeAfterInertia > dom.swipe.scrollTop,
  `離した時 ${dom.swipe.scrollTop}px → ${dom.swipeAfterInertia}px`);
check('33. ドラッグ開始が dragstart として届く', dom.drag.log.includes('fx-item:dragstart'), dom.drag.log.join(' '));
check('34. 置き先に dragenter / dragover / drop が届く',
  dom.drag.log.includes('fx-zone:dragenter') && dom.drag.log.includes('fx-zone:dragover') && dom.drag.log.includes('fx-zone:drop'));
check('35. ドラッグの終わりに dragend が届く（掴んだ見た目が残らない）', dom.drag.log.includes('fx-item:dragend'));
check('36. ドラッグをタップと取り違えない', !dom.drag.log.includes('fx-item:click') && dom.drag.gestures.includes('drag'), dom.drag.gestures.join(','));

/* ------------------------------------------------------------------ *
 * まとめ役 — カメラの入切・電池・失敗時の見せ方
 * ------------------------------------------------------------------ */
const facade = await page.evaluate(async ([base]) => {
  const M = await import(`${base}/assets/js/gesture-pointer.js`);
  const fake = { started: false, stopped: false, polls: 0, hand: null };
  const air = new M.AirTouch({
    createSource: () => ({
      video: null,
      async start() { fake.started = true; },
      poll() { fake.polls += 1; return fake.hand; },
      stop() { fake.stopped = true; },
    }),
    preview: false,
  });
  const enabled = await air.enable();
  const layerAfterEnable = Boolean(document.querySelector('.airtouch-layer'));
  fake.hand = window.makeHand(0.5, 0.5, 0.9);
  air.tick(1000); air.tick(1100);
  const cursorVisible = document.querySelector('.airtouch-cursor')?.classList.contains('is-visible');

  // 裏に回ったら推定しない（カメラを回したまま推論を続けると電池が溶ける）
  const pollsBefore = fake.polls;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
  air.tick(1200); air.tick(1300);
  const pollsWhileHidden = fake.polls - pollsBefore;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });

  // 推定は毎フレーム走らせない（間引き）
  const throttleBefore = fake.polls;
  for (let i = 0; i < 10; i++) air.tick(1400 + i * 8);   // 8ms刻み＝毎フレーム相当
  const throttled = fake.polls - throttleBefore;

  air.disable();
  const layerAfterDisable = Boolean(document.querySelector('.airtouch-layer'));

  // 失敗したときに、理由が画面へ出るか
  const notices = [];
  const broken = new M.AirTouch({
    createSource: () => ({ async start() { throw new Error('カメラの許可が下りませんでした'); }, poll() { return null; }, stop() {} }),
    onStatus: (s) => notices.push(s),
    preview: false,
  });
  const brokenResult = await broken.enable();
  // ★失敗しても層が残ってはいけない。透明なまま居座り、次の画面で残骸が出る
  const brokenLayer = Boolean(document.querySelector('.airtouch-layer'));
  broken.disable();

  // 「動きを減らす」設定では慣性を効かせない
  const still = new M.PointerDriver({ doc: document, reducedMotion: true });
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed; inset:0; overflow-y:auto';
  box.innerHTML = '<div style="height:3000px"></div>';
  document.body.appendChild(box);
  box.scrollTop = 500;
  still.downTarget = box; still.mode = 'pan'; still.scroller = box;
  still.swipe({ x: 100, y: 100, vx: 0, vy: -2000, swipe: { dir: 'up', vx: 0, vy: -2000 } });
  const beforeQuiet = box.scrollTop;
  await new Promise((r) => setTimeout(r, 220));
  const afterQuiet = box.scrollTop;
  still.cancelInertia(); still.destroy(); box.remove();

  return { enabled, layerAfterEnable, cursorVisible, started: fake.started, stopped: fake.stopped,
    pollsWhileHidden, throttled, layerAfterDisable, brokenResult, brokenLayer,
    brokenNotice: notices.find((n) => n.stage === 'error')?.text ?? '', brokenError: broken.error,
    quiet: { before: beforeQuiet, after: afterQuiet } };
}, [BASE]);

check('37. ONでカメラ側が起動し、カーソルが出る',
  facade.enabled === true && facade.started === true && facade.layerAfterEnable === true && facade.cursorVisible === true);
check('38. 裏に回ったら推定を止める（電池）', facade.pollsWhileHidden === 0, `${facade.pollsWhileHidden}回`);
check('39. 推定を毎フレーム走らせない（間引き）', facade.throttled <= 4, `10フレームで ${facade.throttled}回`);
// ★止め忘れるとカメラのランプが点きっぱなしになる。信用を失う類の不具合
check('40. OFFでカメラを確実に止め、カーソルも消す',
  facade.stopped === true && facade.layerAfterDisable === false);
check('41. 始められないときは理由を知らせる（黙って失敗しない）',
  facade.brokenResult === false && /許可が下りませんでした/.test(facade.brokenNotice), facade.brokenNotice.slice(0, 60));
check('42. 失敗の内容を後から取り出せる', /Error: /.test(facade.brokenError ?? ''), facade.brokenError);
// ★透明な層が残ると、見た目には何も起きないまま次の画面にカーソルの残骸が居座る
check('42b. 失敗したときに層を残さない', facade.brokenLayer === false);
check('42c. 「動きを減らす」設定では慣性を効かせない',
  facade.quiet.before === facade.quiet.after, `${facade.quiet.before} → ${facade.quiet.after}`);

/* ------------------------------------------------------------------ *
 * ページのボタン配線（通し）
 * ------------------------------------------------------------------ */
const wiring = await page.evaluate(async () => {
  // ページ自身の toggleAir を、合成データの source で通す
  window.__AIRTOUCH_SOURCE_FACTORY = () => ({
    video: null,
    async start() { window.__fakeStarted = true; },
    poll() { return null; },
    stop() { window.__fakeStopped = true; },
  });
  document.getElementById('btn-air').click();
  for (let i = 0; i < 60 && !window.ZERO1_AIRTOUCH?.on; i++) await new Promise((r) => setTimeout(r, 50));
  const on = { pressed: document.getElementById('btn-air').getAttribute('aria-pressed'),
    sheet: document.getElementById('btn-air-2').textContent, started: window.__fakeStarted === true,
    layer: Boolean(document.querySelector('.airtouch-layer')) };
  document.getElementById('btn-air-2').click();
  for (let i = 0; i < 60 && window.ZERO1_AIRTOUCH?.on; i++) await new Promise((r) => setTimeout(r, 50));
  const off = { pressed: document.getElementById('btn-air').getAttribute('aria-pressed'),
    sheet: document.getElementById('btn-air-2').textContent, stopped: window.__fakeStopped === true,
    layer: Boolean(document.querySelector('.airtouch-layer')) };
  return { on, off };
});
check('43. ヘッダーのボタンでONにできる',
  wiring.on.pressed === 'true' && wiring.on.started && wiring.on.layer, JSON.stringify(wiring.on));
check('44. 設定シートの表示がONと連動する', wiring.on.sheet === 'ON', wiring.on.sheet);
check('45. 設定シート側からOFFにでき、カメラが止まる',
  wiring.off.pressed === 'false' && wiring.off.sheet === 'OFF' && wiring.off.stopped && !wiring.off.layer,
  JSON.stringify(wiring.off));
const pageFailure = await page.evaluate(async () => {
  window.__AIRTOUCH_SOURCE_FACTORY = () => ({
    async start() { throw new Error('カメラを使えませんでした'); }, poll() { return null; }, stop() {},
  });
  document.getElementById('btn-air').click();
  for (let i = 0; i < 60 && document.getElementById('sheet').classList.contains('hidden'); i++) await new Promise((r) => setTimeout(r, 50));
  return { note: document.getElementById('air-note').textContent,
    pressed: document.getElementById('btn-air').getAttribute('aria-pressed'),
    sheetOpen: !document.getElementById('sheet').classList.contains('hidden'),
    layer: Boolean(document.querySelector('.airtouch-layer')) };
});
check('46. 失敗した理由がページに出る（押した所からたどれる）',
  /カメラを使えませんでした/.test(pageFailure.note) && pageFailure.sheetOpen, pageFailure.note.slice(0, 50));
check('47. 失敗したらONにならず、層も残らない',
  pageFailure.pressed === 'false' && pageFailure.layer === false, JSON.stringify(pageFailure));
check('48. 一連の操作で例外が出ていない', errors.length === 0, errors.slice(0, 2).join(' / '));

/* ------------------------------------------------------------------ *
 * デスクトップ幅でも同じように使えるか
 *
 * ★このページは「スマホ内で動くAI」だが、PCのブラウザでも同じURLが開ける。
 *   エアタッチはカメラさえあれば端末を選ばないので、**スマホ幅で通ったから
 *   デスクトップでも通る、とは限らない所**を実際に通して確かめる:
 *     - 中央寄せ（max-width:820px）のページで、画面の端まで狙えるか
 *     - 広い画面でも、押した要素へイベントが届くか（座標は画面全体で持つ）
 *     - PCのカメラは facingMode:'user' を必須にすると掴めないことがある
 * ------------------------------------------------------------------ */
const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const desktopErrors = [];
desktop.on('pageerror', (e) => desktopErrors.push('pageerror: ' + e.message));
desktop.on('console', (m) => { if (m.type() === 'error') desktopErrors.push('console: ' + m.text()); });
await desktop.goto(`${BASE}/${PAGE}`, { waitUntil: 'domcontentloaded' });
await desktop.waitForFunction(() => window.ZERO1_MOBILE_READY === true, { timeout: 15_000 }).catch(() => {});
await desktop.evaluate(HELPERS);
const wide = await desktop.evaluate(FIXTURE, [BASE]);
// ★mapToScreen を直接呼んで確かめてはいけない。関数が正しくても、まとめ役が
//   渡す画面サイズを本文の幅にしていたら端へ届かない（故障注入ですり抜けた）。
//   実際に動く経路（AirTouch.tick）を通して、出てきたポインター位置を見る
const wideMap = await desktop.evaluate(async ([base]) => {
  const M = await import(`${base}/assets/js/gesture-pointer.js`);
  const reach = async (nx, ny) => {
    const air = new M.AirTouch({
      createSource: () => ({ async start() {}, poll() { return window.makeHand(nx, ny, 0.9); }, stop() {} }),
      preview: false,
    });
    await air.enable();
    air.tick(1000); air.tick(1100);            // 手ぶれ取りが落ち着くまで2回
    const at = { x: air.engine.x, y: air.engine.y };
    air.disable();
    return at;
  };
  return {
    size: { width: window.innerWidth, height: window.innerHeight },
    // xは鏡なので、カメラ画像の左端(0.16)が画面の右端に対応する
    corner: await reach(0.16, 0.84),            // 画面の右下いっぱい
    origin: await reach(0.84, 0.16),            // 画面の左上いっぱい
  };
}, [BASE]);

check('49. デスクトップ幅でも例外が出ない', desktopErrors.length === 0, desktopErrors.slice(0, 2).join(' / '));
check('50. デスクトップ幅でもタップが click として届く', wide.tapClicks === 1, `${wide.tapClicks}回`);
check('51. デスクトップ幅でもなぞってスクロールできる', wide.pan.scrollTop > 60, `${wide.pan.scrollTop}px`);
check('52. デスクトップ幅でもドラッグ&ドロップが成立する',
  wide.drag.log.includes('fx-item:dragstart') && wide.drag.log.includes('fx-zone:drop'), wide.drag.gestures.join(','));
// ★中央寄せ（max-width:820px）のページでも、座標は画面全体で持つ。
//   ここを本文の幅で持つと、広い画面では左右の余白へポインターが届かなくなる
check('53. 広い画面でも画面の隅まで狙える（座標を本文幅で持っていない）',
  wideMap.corner.x >= wideMap.size.width - 1 && wideMap.corner.y >= wideMap.size.height - 1
  && wideMap.origin.x <= 1 && wideMap.origin.y <= 1,
  `右下 ${wideMap.corner.x.toFixed(0)},${wideMap.corner.y.toFixed(0)} / 画面 ${wideMap.size.width}x${wideMap.size.height}`);
// ★PCのWebカメラは前面/背面の区別を持たない。facingMode を exact で要求すると
//   OverconstrainedError で掴めない端末がある。希望として渡すだけにしておくこと
check('54. カメラの向きを必須条件にしていない（PCのWebカメラでも掴める）',
  !/exact\s*:\s*['"]?user/.test(moduleSource) && /facingMode,/.test(moduleSource));
await desktop.screenshot({ path: path.join(ROOT, 'test-screenshots', 'zero-1-airtouch-desktop.png') });
await desktop.close();

/* ------------------------------------------------------------------ *
 * ブラッシュアップ分（2026-09-06）— 狙いやすさ・疲れにくさ・できること・見え方
 *
 * ★どれも「例外もエラーも出ないまま効かない」種類の機能。
 *   進み具合の表示は出ていなくても動くし、スクロールの加速は倍率1でも動く。
 *   数字と実DOMへ届いたイベントで確かめる。
 * ------------------------------------------------------------------ */
const brush = await page.evaluate(async ([base]) => {
  const M = await import(`${base}/assets/js/gesture-pointer.js`);
  const out = {};
  const view = { width: window.innerWidth, height: window.innerHeight };
  const box = M.DEFAULTS.activeBox;
  const toCam = (sx, sy) => ({
    nx: 1 - (box.x0 + (sx / view.width) * (box.x1 - box.x0)),
    ny: box.y0 + (sy / view.height) * (box.y1 - box.y0),
  });

  // ★前の検査で設定シートを開いたままだと、覆いが画面を塞いで elementFromPoint が
  //   そちらを拾い、**何を押しても届かない**（例外は出ず、ログが空になるだけ）
  document.getElementById('sheet')?.classList.add('hidden');
  document.getElementById('backdrop')?.classList.add('hidden');
  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed; inset:0; z-index:2147482000';
  panel.innerHTML = `
    <button id="bx-a" style="position:absolute; left:20px; top:60px; width:150px; height:64px">A</button>
    <div id="bx-scroll" style="position:absolute; left:0; top:300px; width:390px; height:220px; overflow-y:auto">
      <div style="height:4000px"></div>
    </div>`;
  document.body.appendChild(panel);
  const log = [];
  for (const type of ['click', 'contextmenu']) {
    document.getElementById('bx-a').addEventListener(type, (e) => { log.push(type); e.preventDefault(); });
  }

  const rect = document.getElementById('bx-a').getBoundingClientRect();
  const AX = rect.left + rect.width / 2, AY = rect.top + rect.height / 2;

  /* --- 進み具合（連続値）が判定層から作用層まで通っているか --- */
  {
    const engine = new M.GestureEngine();
    const driver = new M.PointerDriver({ doc: document });
    const at = (pinch, t) => {
      const cam = toCam(AX, AY);
      const frame = engine.update(window.makeHand(cam.nx, cam.ny, pinch), t, view);
      driver.apply(frame);
      return { progress: frame.progress, css: driver.cursor.style.getPropertyValue('--airtouch-progress') };
    };
    at(0.95, 0);
    out.progressOpen = at(0.95, 40);
    out.progressHalf = at(0.50, 80);
    out.progressFull = at(0.20, 120);
    driver.destroy();
  }

  /* --- 中指つまみ＝右クリック。普通のタップで誤爆しないこと --- */
  {
    const engine = new M.GestureEngine();
    const driver = new M.PointerDriver({ doc: document });
    const cam = toCam(AX, AY);
    const feed = (hand, t) => driver.apply(engine.update(hand, t, view));
    log.length = 0;
    feed(window.makeSecondaryHand(cam.nx, cam.ny, 0.9), 0);
    feed(window.makeSecondaryHand(cam.nx, cam.ny, 0.9), 40);
    feed(window.makeSecondaryHand(cam.nx, cam.ny, 0.2), 80);
    out.secondaryLog = [...log];
    // 普通のタップ（人差し指つまみ）では出ないこと。★摘まむと中指も親指へ寄るので
    //   中指だけを見ていると、押すたびに右クリックが出る
    engine.reset(); log.length = 0;
    feed(window.makeHand(cam.nx, cam.ny, 0.95), 200);
    feed(window.makeHand(cam.nx, cam.ny, 0.20), 240);
    feed(window.makeHand(cam.nx, cam.ny, 0.20), 320);
    feed(window.makeHand(cam.nx, cam.ny, 0.95), 400);
    out.tapLog = [...log];
    driver.destroy();
  }

  /* --- スクロールの加速。同じ距離でも、速く払うほど多く進む --- */
  {
    const scroller = document.getElementById('bx-scroll');
    const run = (intervalMs) => {
      const engine = new M.GestureEngine();
      const driver = new M.PointerDriver({ doc: document, reducedMotion: true });
      scroller.scrollTop = 0;
      let t = 0;
      const step = (sy, pinch) => {
        const cam = toCam(195, sy);
        driver.apply(engine.update(window.makeHand(cam.nx, cam.ny, pinch), t, view));
        t += intervalMs;
      };
      step(500, 0.95); step(500, 0.2);
      for (let i = 1; i <= 5; i++) step(500 - i * 28, 0.2);
      const moved = scroller.scrollTop;
      driver.cancelInertia(); driver.destroy();
      return moved;
    };
    out.panSlow = run(120);   // ゆっくり（約233px/秒）
    out.panFast = run(20);    // 速く（約1400px/秒）
  }

  /* --- 静止クリック（既定OFF） --- */
  {
    out.dwellDefault = M.DEFAULTS.dwellEnabled;
    const engine = new M.GestureEngine({ dwellEnabled: true });
    const driver = new M.PointerDriver({ doc: document });
    const cam = toCam(AX, AY);
    log.length = 0;
    let css = '';
    for (let t = 0; t <= 1200; t += 100) {
      const frame = engine.update(window.makeHand(cam.nx, cam.ny, 0.95), t, view);
      driver.apply(frame);
      if (t === 500) css = driver.cursor.style.getPropertyValue('--airtouch-dwell');
    }
    out.dwellClicks = log.filter((l) => l === 'click').length;
    out.dwellCss = css;
    // 動かし続けている間は押さない（読んでいるだけで押されると使い物にならない）
    engine.reset(); log.length = 0;
    for (let t = 0; t <= 1200; t += 100) {
      const cam2 = toCam(AX + ((t / 100) % 2 ? 40 : -40), AY);
      driver.apply(engine.update(window.makeHand(cam2.nx, cam2.ny, 0.95), t, view));
    }
    out.dwellMovingClicks = log.filter((l) => l === 'click').length;
    driver.destroy();
  }

  /* --- 横払いで戻る（既定OFF） --- */
  {
    // ★本物の history を差し替える。偽の window を渡すと PointerEvent が作れず、
    //   「戻るを試す前に検査が落ちる」だけになる（実際に踏んだ）
    const realBack = window.history.back;
    let backs = 0;
    window.history.back = () => { backs++; };
    const engine = new M.GestureEngine();
    const flick = (driver) => {
      engine.reset();
      let t = 5000;
      const step = (sx, pinch) => {
        const c = toCam(sx, 500);
        driver.apply(engine.update(window.makeHand(c.nx, c.ny, pinch), t, view));
        t += 25;
      };
      step(80, 0.95); step(80, 0.2);
      for (let i = 1; i <= 5; i++) step(80 + i * 40, 0.2);
      step(300, 0.95);
    };
    const off = new M.PointerDriver({ doc: document, reducedMotion: true });
    flick(off); out.navOffBacks = backs; off.cancelInertia(); off.destroy();
    backs = 0;
    const on = new M.PointerDriver({ doc: document, reducedMotion: true, navigateOnSwipe: true });
    flick(on); out.navOnBacks = backs; on.cancelInertia(); on.destroy();
    window.history.back = realBack;
  }

  /* --- できることの一覧・表示位置 --- */
  {
    const driver = new M.PointerDriver({ doc: document });
    out.helpHiddenAtStart = driver.help.hidden;
    driver.setHelp(M.helpText({ dwellEnabled: false }));
    out.helpShown = !driver.help.hidden;
    out.helpNoDwell = !driver.help.textContent.includes('止めて待つ');
    driver.setHelp(M.helpText({ dwellEnabled: true }));
    out.helpWithDwell = driver.help.textContent.includes('止めて待つ');
    out.dockDefault = getComputedStyle(driver.dock).bottom;
    driver.setDockSide('top');
    out.dockTop = driver.dock.classList.contains('is-top');
    out.dockTopStyle = getComputedStyle(driver.dock).top;
    driver.destroy();
  }

  panel.remove();
  return out;
}, [BASE]);

check('55. つまみ具合が連続値で出る（あと少しなのか、まるで足りないのかが見える）',
  brush.progressOpen.progress === 0 && Math.abs(brush.progressHalf.progress - 0.5) < 0.01 && brush.progressFull.progress === 1,
  `${brush.progressOpen.progress} / ${brush.progressHalf.progress?.toFixed(2)} / ${brush.progressFull.progress}`);
check('56. 進み具合がカーソルまで届いている（判定層で作って作用層で捨てていない）',
  Math.abs(Number(brush.progressHalf.css) - 0.5) < 0.01, brush.progressHalf.css);
check('57. 中指つまみで contextmenu が届く（同じ手のまま右クリック）',
  brush.secondaryLog.includes('contextmenu'), brush.secondaryLog.join(','));
check('58. 普通のタップでは contextmenu を出さない（摘まむと中指も親指へ寄る）',
  !brush.tapLog.includes('contextmenu') && brush.tapLog.includes('click'), brush.tapLog.join(','));
check('59. 速く払うほどスクロールが伸びる（長い記事で腕が何往復も要らない）',
  brush.panFast > brush.panSlow * 1.5, `ゆっくり ${brush.panSlow}px → 速く ${brush.panFast}px`);
check('60. ゆっくりのときは指の動きと1:1のまま（狙いが狂わない）',
  brush.panSlow > 100 && brush.panSlow < 190, `${brush.panSlow}px（実移動 140px）`);
check('61. 静止クリックは既定OFF（止めているだけで押されるのは誤爆する）',
  brush.dwellDefault === false);
check('62. ONにすると、止め続けるだけでタップが届く', brush.dwellClicks === 1, `${brush.dwellClicks}回`);
check('63. 静止クリックの進み具合がカーソルに出る（いつ押されるか分かる）',
  Number(brush.dwellCss) > 0.2 && Number(brush.dwellCss) < 1, brush.dwellCss);
check('64. 動かしている間は静止クリックしない（読んでいるだけで押されない）',
  brush.dwellMovingClicks === 0, `${brush.dwellMovingClicks}回`);
check('65. 横払いで戻るは既定OFF（書きかけの入力が消えない）', brush.navOffBacks === 0, `${brush.navOffBacks}回`);
check('66. ONにすると右へ払って前のページへ戻れる', brush.navOnBacks === 1, `${brush.navOnBacks}回`);
check('67. できることの一覧は最初は出ていない（画面を塞がない）', brush.helpHiddenAtStart === true);
check('68. 切ってある操作は一覧に載せない（試して反応しない＝壊れている、になる）',
  brush.helpShown && brush.helpNoDwell && brush.helpWithDwell);
check('69. 表示（プレビュー・案内）を上へ逃がせる',
  brush.dockTop && brush.dockTopStyle !== 'auto', `${brush.dockDefault} → top:${brush.dockTopStyle}`);

/* --- 調整（つまみ方の個人差）と、設定の保存 --------------------------- */
const calib = await page.evaluate(async ([base]) => {
  const M = await import(`${base}/assets/js/gesture-pointer.js`);
  const out = {};
  const view = { width: window.innerWidth, height: window.innerHeight };
  const box = M.DEFAULTS.activeBox;
  const button = document.createElement('button');
  document.getElementById('sheet')?.classList.add('hidden');
  document.getElementById('backdrop')?.classList.add('hidden');
  button.style.cssText = 'position:fixed; left:20px; top:60px; width:150px; height:64px; z-index:2147482000';
  document.body.appendChild(button);
  // ★クリックだけを数えても意味がない。調整中は指を離さないので click は元々起きず、
  //   押下を素通しに戻しても検査が通ってしまう（故障注入で実際にすり抜けた）。
  //   押し始め（pointerdown / mousedown）まで届いていないことを見る
  let presses = 0;
  for (const type of ['pointerdown', 'mousedown', 'click']) {
    button.addEventListener(type, () => { presses++; });
  }
  const rect = button.getBoundingClientRect();
  const cam = {
    nx: 1 - (box.x0 + ((rect.left + rect.width / 2) / view.width) * (box.x1 - box.x0)),
    ny: box.y0 + ((rect.top + rect.height / 2) / view.height) * (box.y1 - box.y0),
  };

  const memory = () => {
    const store = { raw: null };
    return { store, getItem: () => store.raw, setItem: (k, v) => { store.raw = v; } };
  };
  /** 調整を最後まで回す。open→closed の順に構えを変える */
  const run = async (openPinch, closedPinch, storage) => {
    let pinch = openPinch;
    const air = new M.AirTouch({
      createSource: () => ({ video: null, async start() {}, poll: () => window.makeHand(cam.nx, cam.ny, pinch), stop() {} }),
      preview: false, storage,
    });
    await air.enable();
    air.startCalibration();
    for (let t = 0; t <= 6000; t += 50) {
      // 2つ目の段階（つまむ）へ進んだら構えを変える
      pinch = air.calibration?.phase === 'closed' ? closedPinch : openPinch;
      air.tick(t);
      if (!air.calibration) break;
    }
    const result = { settings: { ...air.settings }, hint: air.driver?.hint.textContent ?? '' };
    air.disable();
    return result;
  };

  const good = memory();
  const okRun = await run(0.95, 0.15, good);
  out.calibrated = okRun.settings;
  out.calibratedHint = okRun.hint;
  out.calibratedPresses = presses;        // 調整中に押されていないこと
  out.stored = good.store.raw;

  const bad = memory();
  const badRun = await run(0.5, 0.45, bad);   // 開きとつまみの差が小さすぎる
  out.badSettings = badRun.settings;
  out.badHint = badRun.hint;
  out.badStored = bad.store.raw;

  // 保存済みの閾値が次回の既定になるか
  const reuse = new M.AirTouch({
    createSource: () => ({ video: null, async start() {}, poll: () => null, stop() {} }),
    preview: false, storage: good,
  });
  out.reused = { down: reuse.engineOptions.pinchDown, up: reuse.engineOptions.pinchUp };

  // 上下が逆に保存されていたら捨てる（逆のままだと押下が一度も成立しない）
  const broken = { getItem: () => JSON.stringify({ pinchDown: 0.8, pinchUp: 0.2, dwellEnabled: true }), setItem() {} };
  out.brokenLoaded = M.loadSettings(broken);

  button.remove();
  return out;
}, [BASE]);

check('70. 調整（開く→つまむ）で自分用の閾値ができる',
  Number.isFinite(calib.calibrated.pinchDown) && calib.calibrated.pinchUp > calib.calibrated.pinchDown,
  `${calib.calibrated.pinchDown?.toFixed(2)}〜${calib.calibrated.pinchUp?.toFixed(2)}`);
check('71. 調整中は押下が実DOMへ通らない（調整のたびに画面が動かない）',
  calib.calibratedPresses === 0, `${calib.calibratedPresses}回`);
check('72. 調整の結果が保存され、次に開いたときの既定になる',
  Math.abs(calib.reused.down - calib.calibrated.pinchDown) < 1e-9
  && Math.abs(calib.reused.up - calib.calibrated.pinchUp) < 1e-9,
  `${JSON.stringify(calib.reused)} / 保存 ${calib.stored?.slice(0, 60)}`);
check('73. 区別のつかない構えでは閾値を作らない（前より当たらなくなるのを防ぐ）',
  calib.badSettings.pinchDown === undefined && calib.badStored === null, JSON.stringify(calib.badSettings));
check('74. 調整できなくても、これまでの設定のまま使えると伝える',
  /そのまま使えます|まま使えます/.test(calib.badHint), calib.badHint.slice(0, 60));
check('75. 壊れた保存値（上下が逆）は捨てる（押下が一度も成立しなくなる）',
  calib.brokenLoaded.pinchDown === undefined && calib.brokenLoaded.dwellEnabled === true,
  JSON.stringify(calib.brokenLoaded));

/* --- ページ側の配線（細かい設定） ------------------------------------- */
const tuning = await page.evaluate(async () => {
  window.__AIRTOUCH_SOURCE_FACTORY = () => ({
    video: null, async start() {}, poll() { return null; }, stop() {},
  });
  const before = document.getElementById('air-options').hidden;
  document.getElementById('btn-air').click();
  for (let i = 0; i < 60 && !window.ZERO1_AIRTOUCH?.on; i++) await new Promise((r) => setTimeout(r, 50));
  const shown = document.getElementById('air-options').hidden === false;
  const helpAtStart = document.querySelector('.airtouch-help')?.hidden === false;
  document.getElementById('btn-air-dwell').click();
  const dwell = { pressed: document.getElementById('btn-air-dwell').getAttribute('aria-pressed'),
    setting: window.ZERO1_AIRTOUCH.instance?.settings?.dwellEnabled,
    engine: window.ZERO1_AIRTOUCH.instance?.engine?.options?.dwellEnabled,
    help: document.querySelector('.airtouch-help')?.textContent ?? '' };
  document.getElementById('btn-air-dock').click();
  const dock = document.querySelector('.airtouch-dock')?.classList.contains('is-top');
  document.getElementById('btn-air-help').click();
  const helpOff = document.querySelector('.airtouch-help')?.hidden === true;
  document.getElementById('btn-air-cal').click();
  const calibrating = Boolean(window.ZERO1_AIRTOUCH.instance?.calibration);
  const sheetClosed = document.getElementById('sheet').classList.contains('hidden');
  window.ZERO1_AIRTOUCH.instance?.cancelCalibration();
  document.getElementById('btn-air-2').click();
  for (let i = 0; i < 60 && window.ZERO1_AIRTOUCH?.on; i++) await new Promise((r) => setTimeout(r, 50));
  return { before, shown, helpAtStart, dwell, dock, helpOff, calibrating, sheetClosed,
    hiddenAfterOff: document.getElementById('air-options').hidden };
});
check('76. 細かい設定は動いている間だけ出す（押しても効かないボタンを並べない）',
  tuning.before === true && tuning.shown === true && tuning.hiddenAfterOff === true, JSON.stringify(tuning));
check('77. 起動したら「できること」を一度出す（何ができるか分からないと使われない）',
  tuning.helpAtStart === true);
check('78. 静止クリックの入切が、動いたまま判定層まで届く',
  tuning.dwell.pressed === 'true' && tuning.dwell.setting === true && tuning.dwell.engine === true,
  JSON.stringify(tuning.dwell).slice(0, 90));
check('79. 切り替えた内容が、出したままの一覧にその場で反映される',
  tuning.dwell.help.includes('止めて待つ'));
check('80. 表示の位置を切り替えられる／一覧を閉じられる', tuning.dock === true && tuning.helpOff === true);
check('81. 調整を始めると設定シートを閉じて画面の案内へ渡す',
  tuning.calibrating === true && tuning.sheetClosed === true);

const shots = path.join(ROOT, 'test-screenshots');
fs.mkdirSync(shots, { recursive: true });
await page.screenshot({ path: path.join(shots, 'zero-1-airtouch.png') });

await browser.close();
server.close();
console.log(`\n  合計: ${pass} 件合格 / ${fail} 件不合格`);
process.exit(fail ? 1 : 0);
