#!/usr/bin/env node
/*
 * verify-zero1-mobile.mjs — zero-1-mobile.html（スマホ内で動くAI）の必須チェック
 *
 * このページは**この環境では推論そのものを検査できない**。WebGPUのあるGPUが要り、
 * モデルの重みも1GB級のダウンロードが要るため。だから「動く／動かない」ではなく、
 * その手前で静かに壊れる部分を見る:
 *   - 起動して例外0件か（モジュール読み込み・importmap・CSPの誤りはここで出る）
 *   - WebGPUが無い端末に、**理由と打つ手を出しているか**（黙って白い画面にしない）
 *   - モデルIDが実在するか（実在しないIDは読み込みが始まらず理由も出ない）
 *   - 端末メモリからのモデル選びが、載らないモデルを既定にしないか
 *   - 会話の組み立てで、最後の質問を落としていないか
 *
 * 使い方: node scripts/verify-zero1-mobile.mjs
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'zero-1-mobile.html';
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml' };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
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
// スマホの画面で見る。PCの幅で確かめると、実機でだけ崩れる崩れ方を見逃す
const page = await browser.newPage({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
});

const errors = [];
const missing = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('response', (r) => { if (r.status() >= 400) missing.push(`${r.status()} ${r.url()}`); });

console.log('\n== ZERO-1 Mobile の検査 ==');
await page.goto(`${BASE}/${PAGE}`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.ZERO1_MOBILE_READY === true, { timeout: 15_000 }).catch(() => {});

check('1. 起動時の例外が0件', errors.length === 0, errors.slice(0, 2).join(' / '));
check('2. 読み込めないファイルが無い', missing.length === 0, missing.slice(0, 2).join(' / '));
check('3. 検査用の橋渡しが開いている', await page.evaluate(() => typeof window.ZERO1_MOBILE?.recommendModel === 'function'));

// --- WebGPU が無い端末の見え方 ------------------------------------------------
// ヘッドレスChromiumにはWebGPUが無い。深澤さんの古い端末で起きうる状態と同じなので、
// ここで「黙って白い画面」になっていないかを確かめられる
// ★`navigator.gpu` の有無で分岐してはいけない。オブジェクトは在るのにアダプタが
//   取れない環境（このヘッドレスChromiumがまさにそれ）では非対応と判定されるため、
//   一番確かめたい「非対応時の見え方」がまるごと対象外になる（実際に一度そうなった）。
//   ページ自身の判定と同じ経路で聞く。
const runnable = await page.evaluate(async () => {
  let adapter = null;
  try { adapter = navigator.gpu ? await navigator.gpu.requestAdapter() : null; } catch { adapter = null; }
  return window.ZERO1_MOBILE.canRun({ webgpu: Boolean(adapter), secure: window.isSecureContext });
});
const checksText = await page.locator('#checks').innerText();
check('4. 端末の確認結果を必ず出す', checksText.trim().length > 0, checksText.split('\n')[0]);
if (!runnable) {
  check('5. WebGPU非対応を、理由付きで伝える', /WebGPU/.test(checksText) && /対応していません|unavailable/i.test(checksText));
  check('6. 打つ手を書いている（Chromeの更新）', /Chrome/.test(checksText) || /Chrome/.test(await page.locator('#progress-note').innerText()));
  check('7. 動かせない端末では起動ボタンを押させない', await page.locator('#btn-start').isDisabled());
} else {
  // 動かせる環境なら、起動ボタンは押せる状態でなければならない
  check('5-7. 動かせる端末では起動できる', !(await page.locator('#btn-start').isDisabled()));
}

// --- モデル一覧 ---------------------------------------------------------------
const models = await page.evaluate(() => window.ZERO1_MOBILE.MODELS);
check('8. モデルが4段階そろっている', models.length === 4, models.map((m) => m.name).join(' / '));
check('9. モデルの選択肢が画面に出る', await page.locator('#models .model').count() === models.length);
check('10. 大きさをGBで見せる（落とす前に分かる）',
  /GB/.test(await page.locator('#models .model .size').first().innerText()));

// ★実在しないモデルIDは、読み込みが始まらず理由も出ない。npm の実体と突き合わせる
const shipped = path.join(ROOT, 'node_modules/@mlc-ai/web-llm/lib/index.js');
if (fs.existsSync(shipped)) {
  const { prebuiltAppConfig } = await import(`file://${shipped}`);
  const available = prebuiltAppConfig.model_list.map((m) => m.model_id);
  const bogus = models.filter((m) => !available.includes(m.id));
  check('11. すべてのモデルIDが実在する', bogus.length === 0, bogus.map((m) => m.id).join(' / '));
} else {
  console.log('  ⏭️ 11. モデルIDの実在確認は skip（npm i @mlc-ai/web-llm で有効になります）');
}

// ★版を上げて integrity を取り直し忘れると、CDNの中身と一致せず**読み込みが丸ごと失敗**する。
//   版とハッシュが同じURLを指しているかだけは、ここで必ず突き合わせる
const importmap = JSON.parse(fs.readFileSync(path.join(ROOT, PAGE), 'utf8')
  .match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
const libUrl = importmap.imports['web-llm'];
check('11b. ライブラリの版を固定している', /@mlc-ai\/web-llm@\d+\.\d+\.\d+\//.test(libUrl), libUrl);
// ★検査に使う版が、ページが実際に読む版と違っては意味がない。
//   package.json を ^ 付きにすると別の版が入り、違う一覧に対してIDを確かめてしまう
const pinned = libUrl.match(/web-llm@([\d.]+)\//)?.[1];
const declared = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
  .devDependencies?.['@mlc-ai/web-llm'];
check('11a. 検査に使う版と、ページが読む版が同じ', declared === pinned, `package.json ${declared} / ページ ${pinned}`);
check('11c. 固定した版そのものに integrity が付いている',
  typeof importmap.integrity?.[libUrl] === 'string' && importmap.integrity[libUrl].startsWith('sha384-'),
  Object.keys(importmap.integrity ?? {}).join(' / '));

// --- モデル選び ---------------------------------------------------------------
const pick = await page.evaluate(() => {
  const { recommendModel, MODELS } = window.ZERO1_MOBILE;
  const all = MODELS.map((m) => m.id);
  return {
    tiny: recommendModel(2, all)?.id,
    mid: recommendModel(4, all)?.id,
    big: recommendModel(8, all)?.id,
    unknown: recommendModel(NaN, all)?.id,
    narrowed: recommendModel(8, [MODELS[0].id])?.id,
    empty: recommendModel(8, []),
  };
});
check('12. メモリが少ない端末には軽いモデル', pick.tiny === models[0].id, pick.tiny);
check('13. メモリに余裕があれば大きいモデル', pick.big === models[3].id, pick.big);
check('14. メモリが分からないときは真ん中（落としてから失敗させない）',
  pick.unknown === models[1].id, pick.unknown);
check('15. 使えるIDだけから選ぶ', pick.narrowed === models[0].id, pick.narrowed);
check('16. 候補が空なら黙って壊れずnullを返す', pick.empty === null);

// ★メモリだけ見て空き容量を見ないと、載るのに保存できないモデルを勧めてしまう。
//   8GBメモリでも空きが1GBしかない端末は珍しくない。2.4GB落としてから失敗するのは、
//   携帯回線なら通信量まで無駄になる一番痛い外し方（実際にこの実装をしていた）
const storage = await page.evaluate(() => {
  const { recommendModel, storageFit, MODELS } = window.ZERO1_MOBILE;
  const all = MODELS.map((m) => m.id);
  return {
    tight: recommendModel(8, all, 1.0)?.id,     // メモリは潤沢だが空きが1GB
    roomy: recommendModel(8, all, 20)?.id,      // 空きも潤沢
    unknown: recommendModel(8, all, NaN)?.id,   // 空きが分からない端末は妨げない
    none: recommendModel(8, all, 0.2)?.id,      // どれも入らない → 一番軽いもの
    fitNo: storageFit(MODELS[3], 1.0),
    fitTight: storageFit(MODELS[0], 1.0),
    fitYes: storageFit(MODELS[0], 20),
    fitUnknown: storageFit(MODELS[3], NaN),
  };
});
check('16b. 空きが少ない端末には、保存できるモデルを勧める',
  storage.tight === models[0].id, storage.tight);
check('16c. 空きが十分ならメモリ基準で選ぶ', storage.roomy === models[3].id, storage.roomy);
check('16d. 空きが分からない端末を妨げない', storage.unknown === models[3].id, storage.unknown);
check('16e. どれも入らなくても、一番軽いものを返す（nullで詰まらせない）',
  storage.none === models[0].id, storage.none);
check('16f. 入る／ぎりぎり／入らない を区別する',
  storage.fitNo === 'no' && storage.fitTight === 'tight' && storage.fitYes === 'yes' && storage.fitUnknown === 'unknown',
  `${storage.fitNo}/${storage.fitTight}/${storage.fitYes}/${storage.fitUnknown}`);

// 失敗したとき、スマホには開発者ツールが無い。そのまま渡せる手掛かりを画面へ出すこと
const failureFields = await page.evaluate(() => {
  const box = document.getElementById('failure-detail');
  return { exists: Boolean(box), copy: Boolean(document.getElementById('btn-copy')) };
});
check('16g. 失敗の手掛かりを画面に出す仕掛けがある', failureFields.exists && failureFields.copy);

// ★実機で踏んだ壁（2026-09-01）。WebGPUは「対応しています」と緑で出るのに、
//   float16 が使えない端末では q4f16 のモデルがシェーダーのコンパイルで落ちる:
//   「[Invalid ShaderModule] ... entryPoint: "index_kernel"」
//   画面上は緑なのに起動だけ失敗するので、対応の有無を必ず見て切り替える
const precision = await page.evaluate(() => {
  const { resolveModels, MODEL_TIERS, deviceReport } = window.ZERO1_MOBILE;
  const f16 = resolveModels(true);
  const f32 = resolveModels(false);
  return {
    f16ids: f16.map((m) => m.id),
    f32ids: f32.map((m) => m.id),
    tiers: MODEL_TIERS.length,
    sameKeys: f16.every((m, i) => m.key === f32[i].key),
    f32Bigger: f16.every((m, i) => f32[i].sizeMB >= m.sizeMB),
    noteWhenMissing: deviceReport({ webgpu: true, f16: false, secure: true, memoryGB: 4, storageGB: 10 })
      .map((r) => r.text).join(' / '),
    noteWhenPresent: deviceReport({ webgpu: true, f16: true, secure: true, memoryGB: 4, storageGB: 10 })
      .map((r) => r.text).join(' / '),
  };
});
check('16h. float16の有無で別のモデルへ切り替える',
  precision.f16ids.every((id) => /q4f16_1/.test(id)) && precision.f32ids.every((id) => /q4f32_1/.test(id)),
  precision.f32ids[1]);
check('16i. どちらの精度でも段（軽い〜かしこい）が揃っている',
  precision.tiers === 4 && precision.sameKeys && precision.f16ids.length === 4 && precision.f32ids.length === 4);
check('16j. float32版は容量が大きいことを正しく持っている', precision.f32Bigger);
check('16k. float16が無い端末に、その旨と対処を伝える',
  /float16/.test(precision.noteWhenMissing) && /float32/.test(precision.noteWhenMissing),
  precision.noteWhenMissing.split(' / ')[1]);
check('16l. float16がある端末には余計な警告を出さない',
  /float16 が使えます/.test(precision.noteWhenPresent));

// float32版のIDも実在しなければ、切り替えた先で同じように失敗する
if (fs.existsSync(shipped)) {
  const { prebuiltAppConfig } = await import(`file://${shipped}`);
  const available = prebuiltAppConfig.model_list.map((m) => m.model_id);
  const bogus = [...precision.f16ids, ...precision.f32ids].filter((id) => !available.includes(id));
  check('16m. 両方の精度のモデルIDが実在する', bogus.length === 0, bogus.join(' / '));
}

// --- 会話の組み立て -----------------------------------------------------------
const built = await page.evaluate(() => {
  const history = Array.from({ length: 14 }, (unused, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant', text: `発言${i}`,
  }));
  // 長文を貼られた直後に質問する、という実際にありがちな並び
  history.push({ role: 'assistant', text: 'あ'.repeat(5000) });
  const question = 'これを3行にまとめて'.repeat(200);
  history.push({ role: 'user', text: question });
  const messages = window.ZERO1_MOBILE.buildMessages(history, 4, 100);
  const last = messages[messages.length - 1];
  return {
    first: messages[0].role,
    lastWhole: last.content === question,
    lastLength: last.content.length,
    longestPast: Math.max(...messages.slice(1, -1).map((m) => m.content.length)),
    length: messages.length,
  };
});
check('17. 人格を必ず先頭に置く', built.first === 'system');
// ★ここを切ると、残った文脈に対して答えてしまい、例外も出ないまま見当違いの返事になる
check('18. 直近の質問だけは長くても切らない', built.lastWhole, `${built.lastLength}文字`);
check('19. 過去の長文は切って送る（窓を食い潰させない）', built.longestPast <= 101, `最長 ${built.longestPast}文字`);
check('20. 古い会話は落として送る', built.length <= 6, `${built.length}件`);

// --- 進捗の見せ方 -------------------------------------------------------------
const progress = await page.evaluate(() => [
  window.ZERO1_MOBILE.progressText({ progress: 0.42, text: 'Fetching param cache' }),
  window.ZERO1_MOBILE.progressText({}),
]);
check('21. 進捗は%と中身の両方を出す（止まって見えないように）',
  progress[0].percent === 42 && /Fetching/.test(progress[0].label), progress[0].label);
check('22. 進捗が空でも壊れない', progress[1].percent === 0);

// --- 画面（スマホ幅） ---------------------------------------------------------
const layout = await page.evaluate(() => ({
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  inputFont: parseFloat(getComputedStyle(document.getElementById('input')).fontSize),
}));
check('23. 横スクロールが出ない', layout.overflow <= 1, `はみ出し ${layout.overflow}px`);
// canvas は置換要素で既定300×150。inset:0 だけでは伸びず、背景の残像が左上にだけ残って
// 矩形の切れ目が出る（実際にスクリーンショットで見つけた）
const bg = await page.evaluate(() => {
  const canvas = document.getElementById('bg-canvas');
  return { w: canvas.offsetWidth, h: canvas.offsetHeight, vw: window.innerWidth, vh: window.innerHeight };
});
check('23b. 背景canvasが画面いっぱいに広がっている',
  bg.w >= bg.vw - 1 && bg.h >= bg.vh - 1, `${bg.w}x${bg.h} / 画面 ${bg.vw}x${bg.vh}`);
// 16px未満だと、入力欄をタップした瞬間にブラウザが勝手にズームして画面が崩れる
check('24. 入力欄の文字が16px以上（タップ時の自動ズーム回避）', layout.inputFont >= 16, `${layout.inputFont}px`);

// --- 人格 ---------------------------------------------------------------------
const prompt = await page.evaluate(() => window.ZERO1_MOBILE.SYSTEM_PROMPT);
check('25. 事故1（英語で書いてから訳す）への対策が入っている', /訳す/.test(prompt) && /禁止/.test(prompt));
check('26. 事故2（聞き返しだけを返す）への対策が入っている', /質問だけを返しては/.test(prompt));
check('27. 健康・法律・お金を断定させない', /健康|医療/.test(prompt) && /専門家/.test(prompt));

// --- 端末を丸ごと再現して、画面が本当に切り替えているかを見る -------------------
// ★純粋関数が正しくても、画面がそれを使っていなければ意味がない。
//   実際、resolveModels は正しいのに画面が固定の一覧を使う改変が、
//   関数だけの検査ではすり抜けた（故障注入で判明）。ここは通しで確かめる。
async function withDevice({ f16, memoryGB, quotaGB }) {
  const scoped = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await scoped.addInitScript(([hasF16, mem, quota]) => {
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: {
      requestAdapter: async () => ({ features: new Set(hasF16 ? ['shader-f16'] : []) }),
    }});
    Object.defineProperty(navigator, 'deviceMemory', { configurable: true, value: mem });
    Object.defineProperty(navigator, 'storage', { configurable: true, value: {
      estimate: async () => ({ quota: quota * 1e9, usage: 0 }),
    }});
  }, [f16, memoryGB, quotaGB]);
  await scoped.goto(`${BASE}/${PAGE}`, { waitUntil: 'domcontentloaded' });
  await scoped.waitForFunction(() => window.ZERO1_MOBILE_READY === true, { timeout: 15_000 });
  const result = await scoped.evaluate(() => ({
    checks: document.getElementById('checks').innerText,
    selected: window.ZERO1_MOBILE_STATE?.model ?? '',
    sizes: [...document.querySelectorAll('.model .size')].map((n) => n.textContent),
    startEnabled: !document.getElementById('btn-start').disabled,
  }));
  await scoped.close();
  return result;
}

// 深澤さんの端末そのもの（WebGPUあり・float16なし・メモリ4GB・空き10.7GB）
const noF16 = await withDevice({ f16: false, memoryGB: 4, quotaGB: 10.7 });
check('28. float16が無い端末で、画面がfloat32版を並べる',
  /q4f32_1/.test(noF16.selected), noF16.selected);
check('29. その端末にも「float32を使う」と伝える', /float32/.test(noF16.checks));
check('30. 一覧の容量もfloat32版の値になる', noF16.sizes[0] === '1.0GB', noF16.sizes.join(' '));
check('31. その端末でも起動できる（止めない）', noF16.startEnabled);

const withF16 = await withDevice({ f16: true, memoryGB: 4, quotaGB: 10.7 });
check('32. float16がある端末では軽いfloat16版を並べる',
  /q4f16_1/.test(withF16.selected), withF16.selected);
check('33. 一覧の容量もfloat16版の値になる', withF16.sizes[0] === '0.9GB', withF16.sizes.join(' '));

// --- 起動の失敗を、打つ手のある形で見せているか -------------------------------
// ★2026-09-02、深澤さんの端末で起動に失敗し、画面に残ったのは
//   「TypeError: Failed to fetch」の一行だけだった。原因は sw.js が別オリジンの通信まで
//   横取りしていたこと（scripts/verify-service-worker.mjs で別途検査）。
//   ブラウザは Failed to fetch の理由を伏せるので、**ページ側で手掛かりを足さないと
//   誰も原因に辿り着けない**。ここは合成のライブラリを差し込んで通しで確かめる。
//   ★純粋関数（preflight 等）だけを叩く検査にしないこと。画面がそれを使っていなければ
//     「関数は正しいのに動かない」を見逃す（エアタッチの移植で実際に踏んだ）。
async function withEngine({ reachable = true, failTimes = 0, failWith = 'network', noWorker = false,
  workerLoads = true, timeouts = null, hang = false, gpuLoss = 0, ask = '', longAnswer = false, stopAt = 0,
  speak = false, reply = '', chip = -1, noLibrary = false,
  gpuLossKind = 'mapAsync', adapterGoneFor = 0, adapterGoesAt = 'loss' } = {}) {
  const scoped = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await scoped.addInitScript(([canReach, times, kind, banWorker, clocks, neverFinishes, gpuLossTimes, streamsLong, readsAloud, fixedReply, skipLibrary, lossKind, adapterGone, adapterGoesAt]) => {
    window.__ZERO1_LONG = streamsLong;
    window.__ZERO1_REPLY = fixedReply;
    // 読み上げが実際に走った回数を数える。止めたのに読み上げが続いたら止めた意味が無い
    window.__ZERO1_SPOKEN = 0;
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      cancel() {}, speak() { window.__ZERO1_SPOKEN++; },
    }});
    window.SpeechSynthesisUtterance = function (text) { this.text = text; };
    if (readsAloud) { try { localStorage.setItem('zero1-mobile-speak', 'true'); } catch { /* 無視 */ } }
    if (clocks) window.__ZERO1_TIMEOUTS = clocks;
    window.__ZERO1_HANG = neverFinishes;
    window.__ZERO1_GPU_LOSS = gpuLossTimes;
    window.__ZERO1_LOSS_KIND = lossKind;
    // ★切れた直後は requestAdapter が null を返し続ける。実機はこの状態だった。
    //   ただし**消えるのは切れた瞬間から**で、起動前の端末確認では見えている——
    //   最初から消しておくと「WebGPU非対応の端末」を再現してしまい別物になる
    window.__ZERO1_ADAPTER_GONE = 0;
    window.__ZERO1_ADAPTER_BUDGET = adapterGone;
    window.__ZERO1_ADAPTER_AT = adapterGoesAt;   // 'engine'=載せ終わった瞬間 / 'loss'=切れた瞬間
    // 画面を消させない仕掛けを使っているかを見る（実機で切れた原因そのもの）
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: {
      request: async () => { window.__ZERO1_PROBE.wakeLocks++; return { release: async () => {} }; },
    }});
    if (banWorker) {
      // Worker が作れない端末の再現（作れなければ画面と同じ糸へ落ちるはず）
      Object.defineProperty(window, 'Worker', { configurable: true, value: function () { throw new Error('Worker は使えません'); } });
    }
    window.__ZERO1_PROBE_ADAPTER = 0;
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: {
      requestAdapter: async () => {
        window.__ZERO1_PROBE_ADAPTER++;
        // 切れている間は null を返す（実機で WebLLM が受け取っていたもの）
        if (window.__ZERO1_ADAPTER_GONE > 0) { window.__ZERO1_ADAPTER_GONE--; return null; }
        return { features: new Set() };   // float16なし = 深澤さんの端末
      },
    }});
    Object.defineProperty(navigator, 'deviceMemory', { configurable: true, value: 4 });
    Object.defineProperty(navigator, 'storage', { configurable: true, value: {
      estimate: async () => ({ quota: 10.7e9, usage: 0 }),
    }});
    window.__ZERO1_PROBE = { attempts: 0, requests: [], workerUsed: 0, mainThreadUsed: 0, wakeLocks: 0, asked: 0 };
    // 取得先への問い合わせだけを横取りする（ページ自身の読み込みは素通し）
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input.url;
      if (/huggingface\.co|raw\.githubusercontent\.com/.test(url)) {
        window.__ZERO1_PROBE.requests.push({ url, method: init?.method ?? 'GET', headers: Object.keys(init?.headers ?? {}), signal: Boolean(init?.signal) });
        if (canReach === 'hang') {
          // ★相手が接続だけ受けて何も返さない状態の再現。時間切れを渡していなければ
          //   ここは永遠に解決せず、検査は待ちきれずに落ちる（＝時間切れの有無を見ている）
          return new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal.reason)));
        }
        if (!canReach) return Promise.reject(new TypeError('Failed to fetch'));
        return Promise.resolve(new Response('{}', { status: 200 }));
      }
      return original(input, init);
    };
    if (skipLibrary) return;   // 合成のライブラリを差し込まない＝本体を取りに行く経路を通す
    window.__ZERO1_WEBLLM = {
      get prebuiltAppConfig() {
        const tiers = window.ZERO1_MOBILE?.MODEL_TIERS ?? [];
        return { model_list: tiers.flatMap((t) => [t.f16, t.f32]).map((v) => ({
          model_id: v.id,
          model: `https://huggingface.co/mlc-ai/${v.id}`,
          model_lib: `https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_84/base/${v.id}.wasm`,
        })) };
      },
      CreateWebWorkerMLCEngine: async (worker, id, opts) => {
        window.__ZERO1_PROBE.workerUsed++;
        window.__ZERO1_PROBE.workerIsWorker = worker instanceof Worker;
        // 返事が返ってこないまま黙る糸の再現（実際に深澤さんの端末で起きた形）
        if (window.__ZERO1_HANG) return new Promise(() => {});
        return window.__ZERO1_WEBLLM.CreateMLCEngine(id, opts);
      },
      CreateMLCEngine: async (id, opts) => {
        const armAdapter = (when) => {
          if (window.__ZERO1_ADAPTER_AT === when) {
            window.__ZERO1_ADAPTER_GONE = window.__ZERO1_ADAPTER_BUDGET;
            window.__ZERO1_ADAPTER_BUDGET = 0;
          }
        };
        if (!window.__ZERO1_PROBE.workerUsed || window.__ZERO1_PROBE.attempts) window.__ZERO1_PROBE.mainThreadUsed++;
        window.__ZERO1_PROBE.attempts++;
        opts?.initProgressCallback?.({ progress: 0.5, text: 'Fetching param cache' });
        if (window.__ZERO1_PROBE.attempts <= times) {
          throw kind === 'network' ? new TypeError('Failed to fetch') : new Error('[Invalid ShaderModule] entryPoint: "index_kernel"');
        }
        // ★読み込みは数分かかる。載せ終わった時点で既に切れていることがある
        armAdapter('engine');
        return { chat: { completions: { create: async () => {
          window.__ZERO1_PROBE.asked++;
          // ★実機で出たそのままの文言。GPUとの接続が切れた形を再現する
          if (window.__ZERO1_GPU_LOSS > 0) {
            window.__ZERO1_GPU_LOSS--;
            armAdapter('loss');
            if (window.__ZERO1_LOSS_KIND === 'adapter') {
              // ★2026-09-03 深澤報告（2件目）の文言そのまま。切れたGPUを取り直そうとした
              //   WebLLM が requestAdapter() から null を受け取ったときに出る
              throw new Error('Unable to find a compatible GPU. This issue might be because your computer'
                + " doesn't have a GPU, or your system settings are not configured properly.");
            }
            const lost = new Error("Failed to execute 'mapAsync' on 'GPUBuffer': A valid external Instance reference no longer exists.");
            lost.name = 'AbortError';
            throw lost;
          }
          // 長い返答（止める操作を確かめるため）。interruptGenerate で打ち切れること、
          // 打ち切れなくても受け取る側が抜けることの両方を見たいので、止まるのは
          // **ページ側が抜けたとき**だけにしてある
          if (window.__ZERO1_LONG) {
            return (async function* () {
              for (let i = 0; i < 400; i++) {
                if (window.__ZERO1_PROBE.interrupted) return;
                yield { choices: [{ delta: { content: `あ${i} ` } }] };
                await new Promise((r) => setTimeout(r, 12));
              }
            })();
          }
          // 返答の中身を差し替えられるようにしておく（体裁の組み立てを通しで確かめるため）
          const tokens = window.__ZERO1_REPLY
            ? window.__ZERO1_REPLY.match(/[\s\S]{1,8}/g)
            : ['こんに', 'ちは', '。'];
          return (async function* () {
            for (const token of tokens) yield { choices: [{ delta: { content: token } }] };
          })();
        } } },
        // 止めろと言われたことが、ちゃんとモデル側まで届いているか
        interruptGenerate: () => { window.__ZERO1_PROBE.interrupted = true; } };
      },
    };
  }, [reachable, failTimes, failWith, noWorker, timeouts, hang, gpuLoss, longAnswer, speak, reply, noLibrary,
    gpuLossKind, adapterGoneFor, adapterGoesAt]);
  // ★worker は実物を動かす（合図の受け渡しごと確かめる）。ただしCDNへは出ない
  await scoped.route('https://cdn.jsdelivr.net/**', (route) => route.fulfill({
    status: workerLoads ? 200 : 503, contentType: 'text/javascript',
    body: 'export class WebWorkerMLCEngineHandler { onmessage() {} }',
  }));
  await scoped.goto(`${BASE}/${PAGE}`, { waitUntil: 'domcontentloaded' });
  await scoped.waitForFunction(() => window.ZERO1_MOBILE_READY === true, { timeout: 15_000 });
  await scoped.locator('#btn-start').click();
  await scoped.waitForFunction(
    () => !document.getElementById('failure').hidden || !document.getElementById('chat').classList.contains('hidden'),
    { timeout: 20_000 });
  if (chip >= 0) {
    await scoped.locator('#chips button').nth(chip).click();
    await scoped.waitForFunction(() => window.ZERO1_MOBILE_STATE?.busy === false
      && (window.ZERO1_MOBILE_STATE?.history?.length ?? 0) >= 2, { timeout: 20_000 }).catch(() => {});
  }
  if (ask) {
    await scoped.locator('#input').fill(ask);
    await scoped.locator('#btn-send').click();
    if (stopAt) {
      // 流れ始めてから止める（まだ1文字も出ていない状態で押すと、何を止めたのか分からない）
      await scoped.waitForFunction(() => (document.querySelector('#msgs .msg:last-child .body')?.textContent ?? '').length > 4,
        { timeout: 10_000 }).catch(() => {});
      await scoped.waitForTimeout(stopAt);
      const sawWhileStreaming = await scoped.evaluate(() => ({
        label: document.getElementById('btn-send').getAttribute('aria-label'),
        stopClass: document.getElementById('btn-send').classList.contains('stop'),
        disabled: document.getElementById('btn-send').disabled,
        length: (document.querySelector('#msgs .msg:last-child .body')?.textContent ?? '').length,
      }));
      await scoped.locator('#btn-send').click();
      scoped.__stopped = sawWhileStreaming;
    }
    await scoped.waitForFunction(() => {
      const last = document.querySelector('#msgs .msg:last-child');
      return last && !last.classList.contains('pending')
        && !/考えています|載せ直して/.test(last.textContent)
        && window.ZERO1_MOBILE_STATE?.busy === false;
    }, { timeout: 30_000 }).catch(() => {});
  }
  const result = await scoped.evaluate(() => ({
    reply: document.querySelector('#msgs .msg:last-child')?.textContent ?? '',
    body: document.querySelector('#msgs .msg:last-child .body')?.textContent ?? '',
    tag: document.querySelector('#msgs .msg:last-child .tag')?.textContent ?? '',
    sendLabel: document.getElementById('btn-send').getAttribute('aria-label'),
    sendStop: document.getElementById('btn-send').classList.contains('stop'),
    stored: JSON.parse(localStorage.getItem('zero1-mobile-history') ?? '[]'),
    bodyHtml: document.querySelector('#msgs .msg.ai:last-of-type .body')?.innerHTML ?? '',
    announced: document.getElementById('announce').textContent,
    headNote: document.getElementById('head-note').textContent,
    chips: [...document.querySelectorAll('#chips button')].map((b) => b.textContent),
    copyable: Boolean(document.querySelector('#msgs .msg.ai:last-of-type .tools button')),
    actions: [...document.querySelectorAll('#msgs .msg .tools button')].map((b) => b.textContent ?? ''),
    pwned: window.__PWNED ?? 0,
    spoken: window.__ZERO1_SPOKEN,
    detail: document.getElementById('failure-detail').textContent,
    hint: document.getElementById('failure-hint').textContent,
    failed: !document.getElementById('failure').hidden,
    chatting: !document.getElementById('chat').classList.contains('hidden'),
    stage: window.ZERO1_MOBILE_STATE?.stage ?? '',
    mainThreadOnly: window.ZERO1_MOBILE_STATE?.mainThreadOnly ?? null,
    workerError: window.ZERO1_MOBILE_STATE?.workerError ?? '',
    probe: window.__ZERO1_PROBE,
    adapterAsks: window.__ZERO1_PROBE_ADAPTER,
  }));
  result.whileStreaming = scoped.__stopped ?? null;
  await scoped.close();
  return result;
}

const unreachable = await withEngine({ reachable: false });
check('34. 取得先へ届かないとき、どのホストで切れたのかを残す',
  /huggingface\.co/.test(unreachable.detail) && /raw\.githubusercontent\.com/.test(unreachable.detail),
  unreachable.detail.split('\n').find((l) => l.startsWith('届かなかった')) ?? '（行が無い）');
check('35. 2.5GB落とし始める前に、届くかを先に確かめる',
  unreachable.probe.attempts === 0 && /接続/.test(unreachable.stage), `${unreachable.stage} / 取得試行 ${unreachable.probe.attempts}回`);
check('36. Failed to fetch に、打つ手を1行添える',
  /再読み込み/.test(unreachable.hint) && /Wi-Fi/.test(unreachable.hint), unreachable.hint.slice(0, 40));
check('37. 通信を仲介しているService Workerの有無を手掛かりに残す',
  /配信経路/.test(unreachable.detail),
  unreachable.detail.split('\n').find((l) => l.startsWith('配信経路')) ?? '（行が無い）');
check('38. 確認の問い合わせに独自ヘッダを足さない（CORSの事前問い合わせで誤検知しない）',
  unreachable.probe.requests.length === 2
    && unreachable.probe.requests.every((r) => r.headers.length === 0)
    && unreachable.probe.requests.some((r) => r.method === 'HEAD'),
  JSON.stringify(unreachable.probe.requests.map((r) => `${r.method}:${r.headers.join(',')}`)));

// 途中で切れるのは携帯回線では当たり前。落とした分は端末に残るので続きからやり直す
const flaky = await withEngine({ failTimes: 2, failWith: 'network' });
check('39. 通信が切れても、続きからやり直して起動する',
  flaky.chatting && !flaky.failed && flaky.probe.attempts === 3, `取得試行 ${flaky.probe.attempts}回`);

// ★端末側の理由（シェーダーのコンパイル失敗など）で3回繰り返すのは、時間を捨てるだけ
const broken = await withEngine({ failTimes: 9, failWith: 'device' });
check('40. 通信起因でない失敗は、やり直さず即座に理由を出す',
  broken.failed && broken.probe.attempts === 1, `取得試行 ${broken.probe.attempts}回`);
check('41. GPUが原因のときは、GPU向けの打つ手を出す',
  /かるい|GPU/.test(broken.hint), broken.hint.slice(0, 40));

// --- 読み込み中に画面が固まらないか（0%のまま動かない、の正体） ---------------
// ★2026-09-03、深澤さんの端末で「エラーは出ないが0%のまま進まない」。
//   モデルの読み込み（取得・WebAssemblyのコンパイル・GPUへの転送）を画面と同じ糸で
//   やると、その数分ぶん画面がまるごと固まる。進捗も再描画されないので、進んでいるのか
//   止まっているのかすら分からない。**例外は一切出ない**ので検査で押さえるしかない。
const worker = await withEngine({});
check('42. モデルは画面とは別の糸（Web Worker）で動かす',
  worker.probe.workerUsed === 1 && worker.probe.workerIsWorker === true && worker.mainThreadOnly === false,
  `別の糸 ${worker.probe.workerUsed}回 / 実物のWorker ${worker.probe.workerIsWorker}`);

// Worker が使えない端末では画面と同じ糸へ落とす（動かないより固まる方がまし）。
// ただし落ちた事実は隠さない
const fallback = await withEngine({ noWorker: true });
check('43. Workerが作れない端末でも起動する（画面と同じ糸へ落ちる）',
  fallback.chatting && fallback.mainThreadOnly === true, `固まる経路: ${fallback.mainThreadOnly}`);

// --- 「0%」が固まりなのか進行中なのかを、利用者が区別できるか -----------------
const clock = await page.evaluate(() => {
  const { clockText, elapsedText } = window.ZERO1_MOBILE;
  return { moving: clockText(30, 3), stalled: clockText(400, 200), fmtSec: elapsedText(45), fmtMin: elapsedText(125) };
});
check('44. 進捗が止まったら「止まっている」と分かる文言になる',
  !/進んでいません/.test(clock.moving) && /進んでいません/.test(clock.stalled) && /軽いモデル/.test(clock.stalled),
  clock.stalled.slice(0, 40));
check('45. 経過時間は分秒で読める形にする', clock.fmtSec === '45秒' && clock.fmtMin === '2分05秒',
  `${clock.fmtSec} / ${clock.fmtMin}`);

// 経過時計が実際に動くこと＝画面の糸が空いていること。ここが止まるなら固まっている
const ticking = await (async () => {
  const scoped = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await scoped.addInitScript(() => {
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: { requestAdapter: async () => ({ features: new Set() }) } });
    Object.defineProperty(navigator, 'deviceMemory', { configurable: true, value: 4 });
    Object.defineProperty(navigator, 'storage', { configurable: true, value: { estimate: async () => ({ quota: 10.7e9, usage: 0 }) } });
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input.url;
      if (/huggingface\.co|raw\.githubusercontent\.com/.test(url)) return Promise.resolve(new Response('{}', { status: 200 }));
      return original(input, init);
    };
    window.__ZERO1_WEBLLM = {
      get prebuiltAppConfig() {
        const tiers = window.ZERO1_MOBILE?.MODEL_TIERS ?? [];
        return { model_list: tiers.flatMap((t) => [t.f16, t.f32]).map((v) => ({
          model_id: v.id, model: `https://huggingface.co/mlc-ai/${v.id}`,
          model_lib: `https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_84/base/${v.id}.wasm`,
        })) };
      },
      // 読み込みに時間がかかる状態（進捗を1度も返さない）の再現
      CreateWebWorkerMLCEngine: () => new Promise(() => {}),
      CreateMLCEngine: () => new Promise(() => {}),
    };
  });
  await scoped.route('https://cdn.jsdelivr.net/**', (route) => route.fulfill({
    status: 200, contentType: 'text/javascript',
    body: 'export class WebWorkerMLCEngineHandler { onmessage() {} }',
  }));
  await scoped.goto(`${BASE}/${PAGE}`, { waitUntil: 'domcontentloaded' });
  await scoped.waitForFunction(() => window.ZERO1_MOBILE_READY === true, { timeout: 15_000 });
  await scoped.locator('#btn-start').click();
  await scoped.waitForFunction(() => !document.getElementById('progress-clock').hidden, { timeout: 10_000 });
  const first = await scoped.locator('#progress-clock').innerText();
  await scoped.waitForFunction((was) => document.getElementById('progress-clock').innerText !== was, first, { timeout: 8_000 })
    .catch(() => {});
  const second = await scoped.locator('#progress-clock').innerText();
  await scoped.close();
  return { first, second };
})();
check('46. 進捗が0%のあいだも、経過時間が動き続ける（固まっていないことが分かる）',
  ticking.first !== '' && ticking.second !== ticking.first, `${ticking.first} → ${ticking.second}`);

// --- 相手が応答しないとき、0%で永久に待たない -------------------------------
// ★fetch には既定の制限時間が無い。時間切れを渡していないと、この検査は
//   永遠に待って落ちる（＝時間切れの有無そのものを見ている）
const hung = await withEngine({ reachable: 'hang' });
check('47. 取得先が応答しないときは時間切れにする（0%で永久に待たない）',
  hung.failed && /応答がありません/.test(hung.detail),
  hung.detail.split('\n').find((l) => l.startsWith('届かなかった')) ?? '（行が無い）');
check('48. 時間切れの仕掛けを実際に渡している',
  hung.probe.requests.length > 0 && hung.probe.requests.every((r) => r.signal === true));

// --- メモリが足りないモデルを、黙って選ばせない -------------------------------
// ★空き容量（保存できるか）とメモリ（動かせるか）は別の話。メモリ4GBの端末に
//   2.5GBのモデルを警告なしで選ばせていた。載らないと取得は最後まで進むのに
//   GPUへ載せる段で固まる——例外が出ないので「進まない」としか見えない
const heavy = await (async () => {
  const scoped = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await scoped.addInitScript(() => {
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: { requestAdapter: async () => ({ features: new Set() }) } });
    Object.defineProperty(navigator, 'deviceMemory', { configurable: true, value: 4 });
    Object.defineProperty(navigator, 'storage', { configurable: true, value: { estimate: async () => ({ quota: 10.7e9, usage: 0 }) } });
  });
  await scoped.goto(`${BASE}/${PAGE}`, { waitUntil: 'domcontentloaded' });
  await scoped.waitForFunction(() => window.ZERO1_MOBILE_READY === true, { timeout: 15_000 });
  // 深澤さんが実際に選んでいた「日本語に強い」（必要メモリ6GB）を押す
  const japanese = scoped.locator('.model').nth(2);
  const label = await japanese.innerText();
  await japanese.click();
  const note = await scoped.locator('#progress-note').innerText();
  await scoped.close();
  return { label, note };
})();
check('49. メモリが足りないモデルは、一覧の時点で重すぎると伝える',
  /重すぎます/.test(heavy.label), heavy.label.replace(/\n/g, ' ').slice(0, 50));
check('50. 選んだ後も、必要なメモリの目安を出す（止めはしない）',
  /重すぎます/.test(heavy.note) && /6GB/.test(heavy.note), heavy.note.slice(0, 50));

// --- Workerが読む版が、ページの importmap と同じか ---------------------------
// ★ずれると、integrity を通った版とは別の版を読み込んでしまう
const workerSrc = fs.readFileSync(path.join(ROOT, 'assets/js/zero1-worker.js'), 'utf8');
const workerUrl = workerSrc.match(/WEBLLM_URL\s*=\s*'([^']+)'/)?.[1] ?? '';
check('51. workerが読むライブラリの版が、ページの importmap と同じ',
  workerUrl === libUrl, `worker ${workerUrl} / ページ ${libUrl}`);

// --- 別の糸が「作れても動かない」場合に、待ち続けないか -----------------------
// ★2026-09-03、深澤さんの端末は経過時計だけが動き、進捗は1度も出ないまま止まった。
//   worker は読み込みに失敗しても例外を投げず**ただ黙る**ので、仕事を渡した側は
//   返事を待ち続けて 0% のまま永久に止まる。例外もエラーも出ない
const deadWorker = await withEngine({ workerLoads: false });
check('53. 別の糸が動き出さないときは、待たずに画面と同じ糸へ落とす',
  deadWorker.chatting && deadWorker.mainThreadOnly === true && deadWorker.workerError !== '',
  deadWorker.workerError.slice(0, 60));

// 返事が返らないまま黙る糸。待ち続けず、何秒進まなかったかを持って失敗にする
const stalled = await withEngine({ hang: true, timeouts: { firstProgress: 2500 } });
check('54. 進捗が1度も出ないまま止まったら、待ち続けずに失敗として出す',
  stalled.failed && /進みませんでした/.test(stalled.detail),
  stalled.detail.split('\n').find((l) => l.startsWith('理由')) ?? '（行が無い）');
check('55. 止まったときは「軽いモデル」という打つ手を出す',
  /軽いモデル/.test(stalled.hint), stalled.hint.slice(0, 40));
check('56. 進捗が1度も出なかった事実を手掛かりに残す',
  /進捗が1度でも出たか: いいえ/.test(stalled.detail));

// ★画面写真1枚で「どこで止まったか」が分かること。文字で聞き返す往復が消える
const staged = await page.evaluate(() => window.ZERO1_MOBILE.clockText(400, 200, 'モデルの取得と準備'));
check('57. 経過時計に、いまどの段階かを添える（画面写真だけで場所が分かる）',
  /モデルの取得と準備/.test(staged), staged.slice(0, 40));

// --- GPUとの接続が切れたときに、載せ直して答え直すか -------------------------
// ★2026-09-03、深澤さんの端末は起動には成功したのに、最初の返事で
//   `AbortError: Failed to execute 'mapAsync' on 'GPUBuffer':
//    A valid external Instance reference no longer exists.` を返した。
//   数分の読み込みのあいだに画面が消え、AndroidがGPUの資源を手放したため。
//   **モデルは端末に残っている**ので、載せ直せば数秒で戻る。諦めるのが一番もったいない。
const lostOnce = await withEngine({ ask: 'こんにちは', gpuLoss: 1 });
check('58. GPUとの接続が切れたら、載せ直して答え直す（打ち直させない）',
  /こんにちは。/.test(lostOnce.reply) && lostOnce.probe.asked === 2,
  `返答「${lostOnce.reply.slice(0, 20)}」/ 問い合わせ ${lostOnce.probe.asked}回`);

// 載せ直しても戻らないときは、打つ手（再読み込み）を出す
const lostForever = await withEngine({ ask: 'こんにちは', gpuLoss: 9 });
check('59. 載せ直しても戻らないときは、次の一手を出す',
  /再読み込み/.test(lostForever.reply) && /端末に残っている/.test(lostForever.reply),
  lostForever.reply.slice(0, 40));

const lostKinds = await page.evaluate(() => {
  const { isDeviceLost } = window.ZERO1_MOBILE;
  return {
    real: isDeviceLost({ name:'AbortError', message:"Failed to execute 'mapAsync' on 'GPUBuffer': A valid external Instance reference no longer exists." }),
    network: isDeviceLost(new TypeError('Failed to fetch')),
    shader: isDeviceLost(new Error('[Invalid ShaderModule] entryPoint: "index_kernel"')),
  };
});
check('60. GPUの切断と、通信・シェーダーの失敗を取り違えない',
  lostKinds.real === true && lostKinds.network === false && lostKinds.shader === false,
  JSON.stringify(lostKinds));

// ★そもそも切らせない。数分の読み込み中に画面が消えるのが引き金だった
check('61. 読み込みのあいだ、画面を消させない（wake lock を要求する）',
  lostOnce.probe.wakeLocks >= 1, `要求 ${lostOnce.probe.wakeLocks}回`);

// --- CSPが「別の糸」を止めていないか ------------------------------------------
// ★worker-src を締めると worker は**例外もエラーも出さずに黙る**（作られはするが動かない）。
//   そうなると読み込みが 0% から進まない状態へ逆戻りする
{
  const csp = fs.readFileSync(path.join(ROOT, PAGE), 'utf8')
    .match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1] ?? '';
  const directive = (name) => (csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(name + ' ')) ?? '');
  const workerHost = new URL(workerUrl).origin;
  check('52. CSPが別の糸（worker）と、そこが読むライブラリを止めていない',
    /worker-src[^;]*'self'/.test(csp)
      && directive('script-src').includes(workerHost)
      && directive('connect-src').includes(workerHost),
    `worker-src: ${directive('worker-src') || '（無し）'}`);
}

// --- 生成を止められるか -------------------------------------------------------
// ★0.5〜3B級は的外れな長文を書き始めることがあり、出し切るまで数十秒かかる。
//   その間ずっとGPUが回るので電池にも効く。**待つ以外の選択肢を必ず1つ置く**。
//   例外もエラーも出ない類の不便なので、検査で押さえるしかない。
const stopped = await withEngine({ ask: '長い話をして', longAnswer: true, stopAt: 250, speak: true });
check('62. 生成中、送信ボタンは「止める」に変わる（押せないボタンにしない）',
  stopped.whileStreaming?.stopClass === true
    && /止める|Stop/.test(stopped.whileStreaming?.label ?? '')
    && stopped.whileStreaming?.disabled === false,
  JSON.stringify(stopped.whileStreaming));
check('63. 止めると、その場で生成が終わる',
  stopped.body.length > 0 && stopped.body.length < 400 * 4,
  `${stopped.body.length}文字で停止`);
check('64. 止めろがモデル側にも届く（受け取る側で抜けるだけにしない）',
  stopped.probe.interrupted === true);
check('65. 止めるまでに書けた分は捨てない（止める＝やり直しにしない）',
  stopped.stored.some((m) => m.role === 'assistant' && m.text.length > 0)
    && stopped.stored.at(-1)?.text === stopped.body,
  `履歴 ${stopped.stored.length}件 / 末尾 ${String(stopped.stored.at(-1)?.text ?? '').slice(0, 12)}`);
check('66. 止めたことが画面に残る（黙って途切れさせない）',
  /止め|Stopped/.test(stopped.tag), stopped.tag);
check('67. 止めたら読み上げも走らせない（止めた意味が消える）',
  stopped.spoken === 0, `読み上げ ${stopped.spoken}回`);
check('68. 止めたあとは、また送れる状態へ戻る',
  stopped.sendStop === false && /送信|Send/.test(stopped.sendLabel ?? ''), stopped.sendLabel);

// 止めなければ最後まで流れて、読み上げも走る（62〜68が「常に止まる」にすり替わらないこと）
const finished = await withEngine({ ask: 'こんにちは', speak: true });
check('69. 止めなければ最後まで答え、読み上げも走る',
  /こんにちは。/.test(finished.body) && finished.spoken === 1 && !/止め|Stopped/.test(finished.tag),
  `${finished.body} / 読み上げ ${finished.spoken}回`);

// --- 端末に残っているモデルを、残っていると言えるか ---------------------------
// ★2回目以降は取得が要らないのに、画面は常に「初回だけダウンロードします」と言っていた。
//   すぐ起動するのに「これから2.5GB落ちる」ように見えるのは、そのまま離脱の理由になる。
async function withCaches({ seeded = [], broken = false, quotaGB = 10.7 } = {}) {
  const scoped = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await scoped.addInitScript(([urls, throws, quota]) => {
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: { requestAdapter: async () => ({ features: new Set() }) } });
    Object.defineProperty(navigator, 'deviceMemory', { configurable: true, value: 4 });
    Object.defineProperty(navigator, 'storage', { configurable: true, value: { estimate: async () => ({ quota: quota * 1e9, usage: 0 }) } });
    // 合成の Cache Storage。実物と同じく「名前 → 要求の一覧」の2段
    // モデル削除が会話を巻き込まないことを見るため、先に履歴を入れておく
    try { localStorage.setItem('zero1-mobile-history', JSON.stringify([{ role:'user', text:'消さないで' }])); } catch { /* 無視 */ }
    const store = new Map([['webllm/model', new Set(urls)], ['other-cache', new Set(['https://example.com/x'])]]);
    window.__ZERO1_CACHE = store;
    Object.defineProperty(window, 'caches', { configurable: true, value: {
      keys: async () => { if (throws) throw new DOMException('storage unavailable'); return [...store.keys()]; },
      open: async (name) => ({
        keys: async () => [...(store.get(name) ?? new Set())].map((url) => ({ url })),
        delete: async (url) => store.get(name)?.delete(url) ?? false,
      }),
    }});
  }, [seeded, broken, quotaGB]);
  await scoped.goto(`${BASE}/${PAGE}`, { waitUntil: 'domcontentloaded' });
  await scoped.waitForFunction(() => window.ZERO1_MOBILE_READY === true, { timeout: 15_000 });
  return scoped;
}

// 「ふつう」（q4f32版＝float16の無い端末）を落とし終えている状態を作る
const keptId = (await page.evaluate(() => window.ZERO1_MOBILE.resolveModels(false)[1].id));
const kept = await withCaches({ seeded: [
  `https://huggingface.co/mlc-ai/${keptId}/resolve/main/params_shard_0.bin`,
  `https://huggingface.co/mlc-ai/${keptId}/resolve/main/mlc-chat-config.json`,
] });
const keptView = await kept.evaluate(() => {
  const before = document.getElementById('model-lead').innerText;
  document.querySelectorAll('#models .model')[0].click();   // 保存していないモデルへ切り替える
  const other = document.getElementById('model-lead').innerText;
  document.querySelectorAll('#models .model')[1].click();   // 戻す
  return {
    labels: [...document.querySelectorAll('#models .model')].map((b) => b.innerText),
    start: document.getElementById('btn-start').innerText,
    cached: [...(window.ZERO1_MOBILE_STATE?.cached ?? [])],
    lead: before, leadOther: other,
  };
});
check('70. 端末に残っているモデルを「保存済み」と伝える',
  /保存済み/.test(keptView.labels[1]) && keptView.cached.includes(keptId),
  keptView.labels[1].replace(/\n/g, ' ').slice(0, 46));
check('71. 保存済みでないモデルには「保存済み」と書かない（全部に付けない）',
  !/保存済み/.test(keptView.labels[0]) && !/保存済み/.test(keptView.labels[3]));
check('72. 起動ボタンも「すぐ起動する」と分かる文言になる',
  /保存済み|already/i.test(keptView.start), keptView.start);
// ★説明文が「初回だけダウンロードします」のままだと、すぐ起動する人まで身構えてしまう
check('72b. 保存済みのときは、取得の説明を出さない',
  /保存済み/.test(keptView.lead) && !/初回だけ/.test(keptView.lead)
    && /初回だけ/.test(keptView.leadOther),
  keptView.lead.slice(0, 40));

// 消す口が画面にあること。無ければブラウザ設定でサイトデータを全消しするしかない
await kept.locator('#btn-settings').click();
const rowBefore = await kept.locator('#model-storage').innerText();
await kept.locator('#btn-drop').click();
await kept.waitForFunction(() => /削除しました|削除できません/.test(document.getElementById('model-storage').innerText), { timeout: 8_000 })
  .catch(() => {});   // ★解けなくても例外で落とさない（落とすと以降の検査が1件も走らない）
const dropped = await kept.evaluate(() => ({
  note: document.getElementById('model-storage').innerText,
  left: [...(window.__ZERO1_CACHE.get('webllm/model') ?? [])].length,
  other: [...(window.__ZERO1_CACHE.get('other-cache') ?? [])].length,
  labels: [...document.querySelectorAll('#models .model')].map((b) => b.innerText),
  history: localStorage.getItem('zero1-mobile-history'),
}));
await kept.close();
check('73. 消す前に、何をどれだけ空けるのかが分かる',
  /GB/.test(rowBefore) && /会話と設定は残ります/.test(rowBefore), rowBefore.slice(0, 46));
check('74. 削除すると、モデルの実体が端末から消える',
  dropped.left === 0 && /削除しました/.test(dropped.note), `残り ${dropped.left}件`);
check('75. 削除は他のキャッシュ・会話履歴を巻き込まない',
  dropped.other === 1 && /消さないで/.test(dropped.history ?? ''),
  `他キャッシュ ${dropped.other}件 / 会話 ${dropped.history ?? '(消えた)'}`);
check('76. 削除後は「保存済み」の表示も消える',
  !/保存済み/.test(dropped.labels[1]), dropped.labels[1].replace(/\n/g, ' ').slice(0, 40));

// ★保存済みなら、空き容量の警告より先にそれを言う。すでに端末にあるものへ
//   「空きが足りません」と出して起動を止めるのは端的に誤り
const tight = await withCaches({ quotaGB: 0.2, seeded: [
  `https://huggingface.co/mlc-ai/${keptId}/resolve/main/params_shard_0.bin`,
] });
const tightView = await tight.evaluate(() => {
  const models = [...document.querySelectorAll('#models .model')];
  models[1].click();
  return { disabled: document.getElementById('btn-start').disabled, note: document.getElementById('progress-note').innerText };
});
await tight.close();
check('77. 保存済みのモデルは、空きが少なくても起動を止めない',
  tightView.disabled === false && !/空き容量が足りません/.test(tightView.note),
  `起動不可: ${tightView.disabled} / ${tightView.note.slice(0, 30) || '（警告なし）'}`);

// ★Cache Storage はシークレットタブ・容量枯渇・破損で落ちる。落ちても画面を止めない
const noCaches = await withCaches({ broken: true });
const noCachesView = await noCaches.evaluate(() => ({
  count: document.querySelectorAll('#models .model').length,
  disabled: document.getElementById('btn-start').disabled,
  labels: [...document.querySelectorAll('#models .model')].map((b) => b.innerText).join(' '),
}));
await noCaches.close();
check('78. Cache Storage が使えない端末でも、起動画面が止まらない',
  noCachesView.count === 4 && noCachesView.disabled === false && !/保存済み/.test(noCachesView.labels),
  `モデル ${noCachesView.count}件 / 起動不可 ${noCachesView.disabled}`);

// --- 返答の体裁と、渡っていない文脈の見え方 -----------------------------------
// ★モデルの出力は `**強調**` や `- 箇条書き` を含むのに、素の文字として並べていたので
//   記号がそのまま読者に見えていた。ただし体裁を整える＝モデルの出力を解釈するので、
//   **HTMLを組み立てたら負け**（`<img onerror=…>` がそのまま動く道ができる）。
const FORMATTED = [
  '## 手順',
  '- **鍋**に水を入れる',
  '- `salt` をひとつまみ',
  '',
  '```js',
  'const x = 1 < 2;',
  '```',
  '',
  '危険なもの: <img src=x onerror="window.__PWNED=1"> と <script>window.__PWNED=1</script>',
].join('\n');
const rich = await withEngine({ ask: '教えて', reply: FORMATTED });
check('79. 箇条書き・見出し・コードを、記号のまま見せない',
  /<h3>/.test(rich.bodyHtml) && /<ul>/.test(rich.bodyHtml) && /<li>/.test(rich.bodyHtml)
    && /<pre>/.test(rich.bodyHtml) && /<strong>鍋<\/strong>/.test(rich.bodyHtml),
  rich.bodyHtml.slice(0, 60));
check('80. モデルの出力からHTMLを組み立てない（返答経由のXSSを作らない）',
  !/<img/i.test(rich.bodyHtml) && !/<script/i.test(rich.bodyHtml)
    && /&lt;img/i.test(rich.bodyHtml) && rich.pwned !== 1,
  rich.bodyHtml.includes('&lt;img') ? '文字として出ている' : rich.bodyHtml.slice(-60));
check('81. 返答をコピーできる口がある（指で長押しの範囲選択に頼らない）', rich.copyable);
// ★#msgs 自体を live 領域にすると、流れてくる途中を1トークンずつ読み上げてしまう
check('82. 画面読み上げへは、書き終わった全文を1度だけ渡す',
  rich.announced.includes('鍋') && rich.announced.includes('salt')
    && rich.announced === FORMATTED,
  `${rich.announced.length}文字`);

// --- 最初の一言のとっかかり ---------------------------------------------------
const chipped = await withEngine({ chip: 0 });
check('83. 起動直後に、聞き方の候補を出す',
  chipped.stored[0]?.role === 'user' && chipped.stored[0]?.text.length > 0,
  chipped.stored[0]?.text ?? '（送られていない）');
check('84. 一度話し始めたら候補は引っ込める（邪魔をしない）',
  chipped.chips.length === 0, `残っている候補 ${chipped.chips.length}件`);

// --- モデルに渡っていない分を、渡っていないと分かるようにする -----------------
// ★buildMessages は直近の数往復しか渡さないのに、画面には40件残る。
//   利用者からは全部覚えているように見えて、実際は覚えていない
const memory = await page.evaluate(() => {
  const st = window.ZERO1_MOBILE_STATE;
  const api = window.ZERO1_MOBILE;
  st.history = Array.from({ length: 12 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: `発言${i}` }));
  api.renderHistory();
  const line = document.querySelector('#msgs .forget');
  const seen = { text: line?.textContent ?? '', above: line?.previousElementSibling?.textContent ?? '',
    below: line?.nextElementSibling?.textContent ?? '' };
  // 渡る分（8往復）に収まっているうちは、線を引かない
  st.history = st.history.slice(0, 4);
  api.renderHistory();
  seen.shortHasLine = Boolean(document.querySelector('#msgs .forget'));
  // 会話が空なら候補が戻る
  st.history = [];
  api.renderHistory();
  seen.chips = document.querySelectorAll('#chips button').length;
  return { ...seen, boundary: api.memoryBoundary(Array(12), 8), none: api.memoryBoundary(Array(4), 8) };
});
check('85. モデルに渡らなくなった位置に、境目を出す',
  /覚えて|memory/i.test(memory.text) && /発言4/.test(memory.below) && /発言3/.test(memory.above),
  `${memory.above.slice(0, 6)} ┃ ${memory.below.slice(0, 6)}`);
check('86. 境目の位置が、実際に渡す範囲（直近8件）と一致する',
  memory.boundary === 4 && memory.none === -1, `境目 ${memory.boundary} / 短い会話 ${memory.none}`);
check('87. 全部渡っているうちは境目を出さない（意味の無い線を引かない）',
  memory.shortHasLine === false);
check('88. 会話を消したら、候補がまた出る', memory.chips >= 3, `候補 ${memory.chips}件`);

// ★境目は「履歴の何番目か」で決めること。子要素の並び順で数えると、履歴に無い吹き出し
//   （起動直後のあいさつ、失敗の通知）の分だけ無言で1つずれる——例外は出ず、線だけが動く
const greeted = await page.evaluate(() => {
  const st = window.ZERO1_MOBILE_STATE;
  const api = window.ZERO1_MOBILE;
  st.history = Array.from({ length: 12 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: `発言${i}` }));
  api.renderHistory();
  const hello = document.createElement('div');   // 起動直後のあいさつ（履歴には無い）
  hello.className = 'msg ai';
  hello.textContent = 'おかえりなさい';
  document.getElementById('msgs').prepend(hello);
  api.paintMemoryBoundary();
  const line = document.querySelector('#msgs .forget');
  return { below: line?.nextElementSibling?.textContent ?? '', above: line?.previousElementSibling?.textContent ?? '' };
});
check('89. 履歴に無い吹き出し（あいさつ等）が在っても、境目がずれない',
  /発言4/.test(greeted.below) && /発言3/.test(greeted.above),
  `${greeted.above.slice(0, 6)} ┃ ${greeted.below.slice(0, 6)}`);

// --- 速さを数字で見せる -------------------------------------------------------
// ★「スマホの中だけで動く」の説得力は、結局この数字に出る。
//   合計だけ見ると遅く見えるので、最初の1つが届くまでの時間を別に出す
check('90. 返答に、端末内での速さを添える',
  /tok\/秒/.test(finished.tag) && /最初の返事まで/.test(finished.tag) && /端末内/.test(finished.tag),
  finished.tag);
const speedShapes = await page.evaluate(() => {
  const { speedText, bootText } = window.ZERO1_MOBILE;
  return {
    normal: speedText({ tokens: 120, firstMs: 1200, streamMs: 10_000 }),
    single: speedText({ tokens: 1, firstMs: 900, streamMs: 0 }),
    empty: speedText(null),
    boot: bootText('ふつう / Standard', 3.4),
    bootFloor: bootText('かるい / Light', 0.2),
  };
});
check('91. 速さの数字が読める形になっている（tok/秒・最初の返事まで）',
  /約12\.0 tok\/秒/.test(speedShapes.normal) && /1\.2秒/.test(speedShapes.normal), speedShapes.normal);
check('92. 数えるものが足りないときは、数字を出さない（意味の無い精度を出さない）',
  speedShapes.single === '' && speedShapes.empty === '');
check('93. 起動にかかった時間を出す（2回目が速いことは数字でしか伝わらない）',
  /起動3秒/.test(speedShapes.boot) && /起動1秒/.test(speedShapes.bootFloor),
  `${speedShapes.boot} / ${speedShapes.bootFloor}`);
check('94. 起動したら、その時間が画面のヘッダに出る',
  /端末内/.test(finished.headNote) && /起動/.test(finished.headNote), finished.headNote);

// --- ホーム画面に置けるか -----------------------------------------------------
// ★2.5GBのモデルを端末に持っているのに、毎回ブラウザでURLを辿る必要があった。
//   サイト共通の manifest.json は start_url が index.html を指していて、
//   ホーム画面から開いてもZERO-1には来ない
const installable = await page.evaluate(async () => {
  const link = document.querySelector('link[rel="manifest"]');
  if (!link) return { linked: false };
  const url = new URL(link.getAttribute('href'), location.href).href;
  const res = await fetch(url);
  if (!res.ok) return { linked: true, fetched: false, url };
  const manifest = await res.json();
  return {
    linked: true, fetched: true, url,
    // ★相対パスの解決まで見る。書き間違えても静かに別のページが開くだけで、
    //   例外もエラーも出ない
    start: new URL(manifest.start_url, url).pathname,
    display: manifest.display,
    theme: manifest.theme_color,
    background: manifest.background_color,
    icons: (manifest.icons ?? []).length,
    pageTheme: document.querySelector('meta[name="theme-color"]')?.content ?? '',
  };
});
check('95. ホーム画面に置ける（このページ専用の manifest がある）',
  installable.linked && installable.fetched && /zero-1-mobile\.html$/.test(installable.start ?? ''),
  installable.start ?? '（manifestが無い）');
check('96. アプリとして開く（アドレスバーの分だけ画面が広くなる）',
  installable.display === 'standalone' && installable.icons > 0, `${installable.display} / 図案 ${installable.icons}件`);
// ★背景色がページと違うと、起動直後に白い画面が一瞬光る（黒基調のページでは特に目立つ）
check('97. manifest の色がページと合っている（起動時に白く光らない）',
  installable.theme === installable.pageTheme && installable.background === installable.pageTheme,
  `manifest ${installable.theme}/${installable.background} · ページ ${installable.pageTheme}`);

// --- 圏外でページ自体が開けるか -----------------------------------------------
// ★モデルは端末に残るのに、ページ本体が取れないと起動できない。
//   「圏外でも使えます」と謳っている以上、ページと worker は先に確保しておく
{
  const swSource = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const list = swSource.match(/const PRECACHE_URLS = \[([\s\S]*?)\];/)?.[1] ?? '';
  const urls = [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const needed = ['./zero-1-mobile.html', './assets/js/zero1-worker.js'];
  const listed = needed.filter((u) => urls.includes(u));
  // 実体が在るかまで見る。書き間違えても addAll の失敗は握り潰されるので何も起きない
  const real = urls.filter((u) => u !== './' && !fs.existsSync(path.join(ROOT, u.replace(/^\.\//, ''))));
  check('98. 圏外でも開けるよう、ページと worker を事前に確保している',
    listed.length === needed.length, `${listed.length}/${needed.length}件`);
  check('99. 事前確保の一覧が、実在するファイルだけを指している',
    real.length === 0, real.join(' / ') || '全て実在');
}

// ★WebLLM本体はCDN（別オリジン）なので事前確保できない。取れなかったときに
//   「なぜ起動できないのか」が残らないと、圏外で詰まった人には何も分からない
const noLib = await withEngine({ noLibrary: true, workerLoads: false });
check('100. ライブラリ本体を取得できないときも、理由と次の一手を出す',
  noLib.failed && /ライブラリ本体/.test(noLib.hint), noLib.hint.slice(0, 52));

// --- 実機で出た「GPUが見つからない」を、切断として扱えているか -----------------
// ★2026-09-03 深澤報告（2件目）: 起動には成功した（1分01秒）のに、最初の質問で
//   `Error: Unable to find a compatible GPU.` が**英語のまま**出た。中身は
//   「読み込み中にGPUとの接続が切れた」で1件目と同じなのに、判定に入っておらず
//   載せ直しが一度も走らなかった。打つ手の無い英文だけが利用者に残る。
const adapterKind = await page.evaluate(() => {
  const { isDeviceLost } = window.ZERO1_MOBILE;
  return {
    real: isDeviceLost(new Error('Unable to find a compatible GPU. This issue might be because your'
      + " computer doesn't have a GPU, or your system settings are not configured properly.")),
    mapAsync: isDeviceLost({ name:'AbortError', message:"Failed to execute 'mapAsync' on 'GPUBuffer': A valid external Instance reference no longer exists." }),
    network: isDeviceLost(new TypeError('Failed to fetch')),
    shader: isDeviceLost(new Error('[Invalid ShaderModule] entryPoint: "index_kernel"')),
    quota: isDeviceLost(new Error('QuotaExceededError: storage full')),
  };
});
check('101. 「GPUが見つからない」もGPU切断として扱う（英文を放置しない）',
  adapterKind.real === true && adapterKind.mapAsync === true, JSON.stringify(adapterKind));
// ★広げすぎない。通信・シェーダー・容量の失敗まで切断扱いにすると、
//   直しようのない失敗を何度も載せ直すことになる
check('102. 通信・シェーダー・容量の失敗まで切断扱いにしない',
  adapterKind.network === false && adapterKind.shader === false && adapterKind.quota === false,
  JSON.stringify(adapterKind));

// 実機と同じ形で通しで確かめる: 最初の質問が「GPUが見つからない」で落ちる
const adapterLost = await withEngine({ ask: '明日の持ち物を一覧にして', gpuLoss: 1, gpuLossKind: 'adapter' });
check('103. その形で切れても、載せ直して答え直す（英文を見せない）',
  /こんにちは。/.test(adapterLost.body) && !/Unable to find/.test(adapterLost.reply),
  `返答「${adapterLost.body.slice(0, 16)}」/ 問い合わせ ${adapterLost.probe.asked}回`);

// ★切れた直後は requestAdapter が null を返し続ける。待たずに載せ直すと同じ失敗をするだけ
const adapterSlow = await withEngine({ ask: 'こんにちは', gpuLoss: 1, gpuLossKind: 'adapter',
  adapterGoneFor: 3, timeouts: { adapterWait: 8000 } });
check('104. GPUが戻るのを待ってから載せ直す（すぐ載せ直して同じ失敗をしない）',
  /こんにちは。/.test(adapterSlow.body) && adapterSlow.adapterAsks >= 4,
  `アダプタ確認 ${adapterSlow.adapterAsks}回 / 返答「${adapterSlow.body.slice(0, 12)}」`);

// 戻らないままなら、待ち続けずに日本語で次の一手を出す
const adapterDead = await withEngine({ ask: 'こんにちは', gpuLoss: 9, gpuLossKind: 'adapter',
  adapterGoneFor: 999, timeouts: { adapterWait: 2500 } });
check('105. 戻らないときは、待ち続けず日本語で次の一手を出す',
  /読み込み直す/.test(adapterDead.body) && /端末に残っている/.test(adapterDead.body)
    && !/Unable to find/.test(adapterDead.body),
  adapterDead.body.slice(0, 44));

// --- 載せ終わった時点で既に切れている場合 -------------------------------------
// ★読み込みは数分かかる。載せ終わった瞬間には切れていて、最初の質問で初めて露見する
//   ——これが「起動はしたのに答えない」の正体。聞かれる前に気づく
const lostAtBoot = await withEngine({ ask: 'こんにちは', adapterGoneFor: 3, adapterGoesAt: 'engine',
  timeouts: { adapterWait: 6000 } });
check('106. 載せ終わった時点で切れていても、質問される前に気づいて直す',
  lostAtBoot.chatting && /こんにちは。/.test(lostAtBoot.body) && !lostAtBoot.failed
    && lostAtBoot.adapterAsks >= 3,
  `会話へ到達: ${lostAtBoot.chatting} / アダプタ確認 ${lostAtBoot.adapterAsks}回`);

// --- 答えている最中に画面を消させない -----------------------------------------
// ★長い返答の途中で画面が消えると、読み込み中と同じようにGPUの資源が手放される
check('107. 答えている間も画面を消させない（読み込み中だけにしない）',
  finished.probe.wakeLocks >= 2, `wake lock 要求 ${finished.probe.wakeLocks}回`);

// --- GPUが戻らなかったときを、行き止まりにしないか ---------------------------
// ★2026-09-03 深澤報告（3件目）: 英文は消えたが「ページを再読み込みしてください」で
//   止まっていた。文字で手順を頼むのは利用者への丸投げで、しかも聞きかけの質問は消える。
//   モデルは端末に残っているので**その数秒はこちらでやる**。
const dead = await withEngine({ ask: 'カレーの作り方を手短に', gpuLoss: 9, gpuLossKind: 'adapter',
  adapterGoneFor: 999, timeouts: { adapterWait: 2000 } });
check('108. 行き止まりにせず、押せば済む一手を置く',
  dead.actions.some((label) => /再読み込み/.test(label)),
  dead.actions.join(' / ') || '（ボタンが無い）');
check('109. 英文ではなく、何が起きたかを日本語で言う',
  /GPUとの接続/.test(dead.body) && !/Unable to find/.test(dead.body), dead.body.slice(0, 40));

// 覚書の作法。**読んだ時点で消す**——消さないと、起動のたびに同じ質問を投げ直して
// 同じ失敗を繰り返す輪に入り、利用者には止められない
const resumeRules = await page.evaluate(() => {
  const { keepResume, takeResume } = window.ZERO1_MOBILE;
  keepResume('明日の持ち物');
  const first = takeResume();
  const second = takeResume();           // 2回目はもう無い
  sessionStorage.setItem('zero1-mobile-resume', JSON.stringify({ question:'古い質問', at: Date.now() - 700_000 }));
  const stale = takeResume();            // 10分以上前のものは引き継がない
  return { first: first?.question ?? null, second, stale };
});
check('110. 聞きかけの質問を持ち越す', resumeRules.first === '明日の持ち物', String(resumeRules.first));
check('111. 覚書は読んだ時点で消す（同じ失敗を繰り返す輪に入らない）', resumeRules.second === null);
check('112. 古すぎる覚書は引き継がない（別の日の質問が突然飛ばない）', resumeRules.stale === null);

// 通しで確かめる: 1回目はGPUが死ぬ → ボタンを押す → 読み込み直して自動で起動 →
// **打ち直さずに**同じ質問の答えが返る
const resumed = await (async () => {
  const scoped = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await scoped.addInitScript(() => {
    window.__ZERO1_TIMEOUTS = { adapterWait: 1200 };
    // 1回目の読み込みだけGPUが死ぬ。読み込み直せば生き返る（実機と同じ形）
    const already = sessionStorage.getItem('z1-test-died') === '1';
    let gone = false;
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: {
      requestAdapter: async () => (gone ? null : { features: new Set() }),
    }});
    Object.defineProperty(navigator, 'deviceMemory', { configurable: true, value: 4 });
    Object.defineProperty(navigator, 'storage', { configurable: true, value: { estimate: async () => ({ quota: 10.7e9, usage: 0 }) } });
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input.url;
      if (/huggingface\.co|raw\.githubusercontent\.com/.test(url)) return Promise.resolve(new Response('{}', { status: 200 }));
      return original(input, init);
    };
    window.__ZERO1_WEBLLM = {
      get prebuiltAppConfig() {
        const tiers = window.ZERO1_MOBILE?.MODEL_TIERS ?? [];
        return { model_list: tiers.flatMap((t) => [t.f16, t.f32]).map((v) => ({
          model_id: v.id, model: `https://huggingface.co/mlc-ai/${v.id}`,
          model_lib: `https://raw.githubusercontent.com/x/${v.id}.wasm`,
        })) };
      },
      CreateWebWorkerMLCEngine: (worker, id, opts) => window.__ZERO1_WEBLLM.CreateMLCEngine(id, opts),
      CreateMLCEngine: async (id, opts) => {
        opts?.initProgressCallback?.({ progress: 1, text: 'done' });
        return { chat: { completions: { create: async () => {
          if (!already) {
            sessionStorage.setItem('z1-test-died', '1');
            gone = true;
            throw new Error('Unable to find a compatible GPU.');
          }
          return (async function* () {
            for (const token of ['カレー', 'は', '玉ねぎから']) yield { choices: [{ delta: { content: token } }] };
          })();
        } } }, interruptGenerate() {} };
      },
    };
  });
  await scoped.route('https://cdn.jsdelivr.net/**', (route) => route.fulfill({
    status: 200, contentType: 'text/javascript', body: 'export class WebWorkerMLCEngineHandler { onmessage() {} }',
  }));
  await scoped.goto(`${BASE}/${PAGE}`, { waitUntil: 'domcontentloaded' });
  await scoped.waitForFunction(() => window.ZERO1_MOBILE_READY === true, { timeout: 15_000 });
  await scoped.locator('#btn-start').click();
  await scoped.waitForSelector('#chips button', { timeout: 20_000 });
  await scoped.locator('#input').fill('カレーの作り方を手短に');
  await scoped.locator('#btn-send').click();
  await scoped.waitForSelector('#msgs .msg .tools button', { timeout: 25_000 });
  // 押すだけ。打ち直させない
  await scoped.locator('#msgs .msg .tools button').last().click();
  await scoped.waitForFunction(
    () => !document.getElementById('chat').classList.contains('hidden')
      && /カレーは玉ねぎから/.test(document.getElementById('msgs').textContent ?? ''),
    { timeout: 30_000 }).catch(() => {});
  const seen = await scoped.evaluate(() => ({
    started: !document.getElementById('chat').classList.contains('hidden'),
    texts: [...document.querySelectorAll('#msgs .msg')].map((m) => m.textContent ?? ''),
    left: sessionStorage.getItem('zero1-mobile-resume'),
  }));
  await scoped.close();
  return seen;
})();
check('113. 押したら、起動ボタンを押させずに続きから起動する',
  resumed.started === true, `会話画面: ${resumed.started}`);
check('114. 打ち直さずに、同じ質問の答えが返る',
  resumed.texts.some((t) => /カレーの作り方を手短に/.test(t))
    && resumed.texts.some((t) => /カレーは玉ねぎから/.test(t)),
  resumed.texts.map((t) => t.slice(0, 14)).join(' | '));
check('115. 引き継ぎの覚書は残さない（次の起動で勝手に投げ直さない）',
  resumed.left === null, String(resumed.left));

// ---------------------------------------------------------------------------
// 端末内ツール層（意図ルーティング）とサイト知識（ローカルRAG）
//
// ★「関数が正しいか」ではなく「画面がそれを使っているか」を見る。
//   純粋関数だけを叩く検査は、配線が外れても素通りする（エアタッチの移植で踏んだ）。
//   だから合成のライブラリを差し込んで**実際に送信ボタンを押し**、
//   モデルへ渡った messages まで覗く。
// ---------------------------------------------------------------------------

const tools = await (async () => {
  const scoped = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await scoped.addInitScript(() => {
    window.__ASKED = [];        // モデルへ渡った messages を全部覚えておく
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { cancel() {}, speak() {} } });
    window.SpeechSynthesisUtterance = function (text) { this.text = text; };
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: {
      requestAdapter: async () => ({ features: new Set() }) } });
    Object.defineProperty(navigator, 'deviceMemory', { configurable: true, value: 4 });
    Object.defineProperty(navigator, 'storage', { configurable: true, value: {
      estimate: async () => ({ quota: 10.7e9, usage: 0 }) } });
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input.url;
      if (/huggingface\.co|raw\.githubusercontent\.com/.test(url)) return Promise.resolve(new Response('{}', { status: 200 }));
      return original(input, init);
    };
    window.__ZERO1_WEBLLM = {
      get prebuiltAppConfig() {
        const tiers = window.ZERO1_MOBILE?.MODEL_TIERS ?? [];
        return { model_list: tiers.flatMap((t) => [t.f16, t.f32]).map((v) => ({
          model_id: v.id, model: `https://huggingface.co/mlc-ai/${v.id}`,
          model_lib: `https://raw.githubusercontent.com/x/${v.id}.wasm`,
        })) };
      },
      CreateWebWorkerMLCEngine: (worker, id, opts) => window.__ZERO1_WEBLLM.CreateMLCEngine(id, opts),
      CreateMLCEngine: async (id, opts) => {
        opts?.initProgressCallback?.({ progress: 1, text: 'done' });
        return { chat: { completions: { create: async (request) => {
          window.__ASKED.push(request.messages);
          return (async function* () { yield { choices: [{ delta: { content: 'モデルが答えました。' } }] }; })();
        } } }, interruptGenerate() {} };
      },
    };
  });
  await scoped.route('https://cdn.jsdelivr.net/**', (route) => route.fulfill({
    status: 200, contentType: 'text/javascript', body: 'export class WebWorkerMLCEngineHandler { onmessage() {} }',
  }));
  await scoped.goto(`${BASE}/${PAGE}`, { waitUntil: 'domcontentloaded' });
  await scoped.waitForFunction(() => window.ZERO1_MOBILE_READY === true, { timeout: 15_000 });
  await scoped.locator('#btn-start').click();
  await scoped.waitForSelector('#chips button', { timeout: 20_000 });
  return scoped;
})();

/** 実際に打って送る。返ってくるのは画面に出たものと、モデルへ渡ったもの */
const askTool = async (text) => {
  await tools.locator('#input').fill(text);
  await tools.locator('#btn-send').click();
  await tools.waitForFunction(() => {
    const last = document.querySelector('#msgs .msg:last-child');
    return last && !last.classList.contains('pending') && window.ZERO1_MOBILE_STATE?.busy === false;
  }, { timeout: 15_000 }).catch(() => {});
  return tools.evaluate(() => ({
    body: document.querySelector('#msgs .msg:last-child .body')?.textContent ?? '',
    html: document.querySelector('#msgs .msg:last-child .body')?.innerHTML ?? '',
    tag: document.querySelector('#msgs .msg:last-child .tag')?.textContent ?? '',
    actions: [...document.querySelectorAll('#msgs .msg:last-child .tools button')].map((b) => b.textContent ?? ''),
    asked: window.__ASKED.length,
    last: window.__ASKED[window.__ASKED.length - 1] ?? null,
    pwned: window.__PWNED ?? 0,
    timers: window.ZERO1_MOBILE_STATE?.timers?.length ?? -1,
  }));
};

check('116. ツール層の橋渡しが開いている',
  await tools.evaluate(() => ['runTool', 'buildSiteContext', 'matchTool', 'pickGames']
    .every((name) => typeof window.ZERO1_MOBILE?.[name] === 'function')));

const toolClock = await askTool('今何時？');
check('117. 時計はモデルを通さずに答える（GPUを回さない）',
  toolClock.asked === 0 && /時計/.test(toolClock.tag) && /\d+時\d+分/.test(toolClock.body), `${toolClock.body} ｜ ${toolClock.tag}`);

const unit = await askTool('10kmは何マイル');
check('118. 単位換算は端末内で答える', unit.asked === 0 && /6\.21/.test(unit.body), unit.body);

// ★0.5〜3B級は桁の多い掛け算を**自信たっぷりに間違える**。ここは必ず横取りする
const math = await askTool('1234*5678は？');
check('119. 桁の多い計算をモデルに渡さない（黙って間違えさせない）',
  math.asked === 0 && /7,?006,?652/.test(math.body), math.body);

// ★「eval が無いこと」は静的に見ないと保証にならない。利用者が打った式を
//   そのまま評価する道が1本でもあれば、そこが抜け道になる
const toolSource = fs.readFileSync(path.join(ROOT, 'assets/js/zero1-tools.js'), 'utf8');
const pageSource = fs.readFileSync(path.join(ROOT, PAGE), 'utf8');
check('120. 式の評価に eval / new Function を使っていない',
  !/\beval\s*\(/.test(toolSource) && !/new\s+Function\s*\(/.test(toolSource)
    && !/\beval\s*\(/.test(pageSource) && !/new\s+Function\s*\(/.test(pageSource));

await askTool('メモ: 牛乳を買う');
const memo = await askTool('メモを見せて');
check('121. メモを覚えて、聞かれたら出す', memo.asked === 0 && /牛乳を買う/.test(memo.body), memo.body);
check('122. メモは端末に残る（次に開いても消えていない）',
  /牛乳/.test(await tools.evaluate(() => localStorage.getItem('zero1-mobile-memos') ?? '')));

// 故障注入: メモとサイト内検索は「利用者が打った文字」を含む。ここが抜け道になっていないか
await askTool('メモ: <img src=x onerror="window.__PWNED=1">');
const xss = await askTool('メモを見せて');
check('123. メモの中身からHTMLを組み立てない（ツール経由のXSSを作らない）',
  xss.pwned === 0 && !/<img/i.test(xss.html) && /onerror/.test(xss.body), xss.body.slice(0, 40));

const timer = await askTool('3分タイマー');
check('124. タイマーを始められる', timer.asked === 0 && timer.timers === 1 && /タイマー/.test(timer.tag), timer.body.split('\n')[0]);

// ★スマホでは画面を消すだけで setTimeout が遅れる・止まる（例外もエラーも出ない）。
//   終わる時刻を正本に持ち、画面が戻ったときに貼り直しているかを見る。
//   setTimeout だけに頼った実装は、ここで**鳴らないまま**すり抜けられない
const fired = await tools.evaluate(async () => {
  const timers = window.ZERO1_MOBILE_STATE.timers;
  if (!timers.length) return { ok:false, why:'タイマーが無い' };
  timers[0].endAt = Date.now() - 1000;             // 画面を消していた間に期限が過ぎた状態
  document.dispatchEvent(new Event('visibilitychange'));
  await new Promise((r) => setTimeout(r, 200));
  return { ok:true, left: window.ZERO1_MOBILE_STATE.timers.length,
    text: document.querySelector('#msgs .msg:last-child .body')?.textContent ?? '' };
});
check('125. 画面が戻ったときに、期限切れのタイマーを鳴らす（setTimeout を信じない）',
  fired.ok && fired.left === 0 && /たちました/.test(fired.text), `${fired.text} ｜ 残り${fired.left}`);

await askTool('10分タイマー');
const timerStopped = await askTool('タイマー止めて');
check('126. タイマーを止められる（作成より先に取り消しを見る）',
  timerStopped.asked === 0 && timerStopped.timers === 0 && /止め/.test(timerStopped.body), timerStopped.body);

const games = await askTool('おすすめのゲームは？');
check('127. サイト内検索は、押せるボタンで開かせる（URLを打たせない）',
  games.asked === 0 && games.actions.length >= 2, games.actions.join(' / '));

// ★モデルはゲーム名を知らないので、空振りを渡すと**存在しないタイトルを作る**。
//   返すのは必ず実在のファイルであること
const hrefs = await tools.evaluate(() => (window.ZERO1_MOBILE.pickGames('おすすめのゲームは？', window.ZERO1_MOBILE.siteData())?.games ?? []).map((g) => g.href));
const ghosts = hrefs.filter((href) => !fs.existsSync(path.join(ROOT, href)));
check('128. 検索が返すゲームが全部実在する（存在しないゲームを勧めない）',
  hrefs.length > 0 && ghosts.length === 0, ghosts.join(' / ') || `${hrefs.length}本`);

// ★誤爆すると利用者からは「AIが答えてくれなくなった」に見える。
//   ツールの言葉を含むのに、ツールでは答えられない質問を必ず流す
const passthrough = await askTool('ゲームの作り方を教えて');
check('129. ツールで答えられないものは、黙ってモデルへ流す',
  passthrough.asked === 1 && !/端末内ツール/.test(passthrough.tag), `モデル ${passthrough.asked}回 ｜ ${passthrough.tag}`);

const site = await askTool('このサイトは無料ですか？');
const systems = (site.last ?? []).filter((m) => m.role === 'system');
check('130. サイトの知識が、実際にモデルへ渡っている',
  systems.length === 1 && /無料/.test(systems[0]?.content ?? ''), (systems[0]?.content ?? '').slice(-60));
// ★2つ目の system は、チャットテンプレートが黙って捨てることがある。
//   捨てられても例外は出ないので、届かなかったことに誰も気づけない
check('131. system は1つに畳んで渡す（2つ目を作らない）', systems.length === 1, `system ${systems.length}件`);
check('132. 文脈を足しても、最後の質問が押し出されない',
  (site.last ?? []).at(-1)?.role === 'user' && /無料/.test((site.last ?? []).at(-1)?.content ?? ''),
  (site.last ?? []).at(-1)?.content ?? '');

// ★当たらない質問に毎回29KBを足すと、窓が埋まって質問の方が押し出される。
//   「知っているときほど質問を忘れる」が一番たちの悪い壊れ方
const rag = await tools.evaluate(() => {
  const { buildSiteContext, siteData } = window.ZERO1_MOBILE;
  const data = siteData();
  return {
    none: buildSiteContext('量子力学について', data).length,
    hit: buildSiteContext('三郷市ってどんな街？', data).length,
    // 5件当たる質問。上限を絞ったときに本当に切り詰まるかを見る
    //（0文字で通ってしまう条件にしないこと——上限が効かなくても素通りする）
    wide: buildSiteContext('将棋と麻雀とチェスは無料ですか 三郷', data).length,
    capped: buildSiteContext('将棋と麻雀とチェスは無料ですか 三郷', data, { budget: 200 }).length,
    count: buildSiteContext('hideさんについて教えて', data),
    games: (data?.GAMES ?? []).length,
  };
});
check('133. 関係の無い質問には、1文字も足さない', rag.none === 0, `${rag.none}文字`);
check('134. 当たったときだけ足す', rag.hit > 0 && rag.hit < 400, `${rag.hit}文字`);
check('135. 当たりが増えても上限で頭打ちになる',
  rag.wide > rag.capped && rag.capped > 0, `上限なし${rag.wide}文字 → 上限あり${rag.capped}文字`);
// ★KBの本文には {GAME_COUNT} という差し込み記号がある。そのまま渡すと
//   モデルは答えにもその記号を書き写す（例外もエラーも出ない）
check('136. 差し込み記号を、そのままモデルへ渡さない',
  !/\{GAME_COUNT\}/.test(rag.count) && rag.count.includes(String(rag.games)),
  `ゲーム${rag.games}本`);

// ★「圏外でも使える」と謳っている以上、import できないと**モジュールごと落ちる**
const swSource = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const needed = ['./assets/js/zero1-tools.js', './assets/js/agent-data.js'];
check('137. ツール層とサイト知識を事前キャッシュに入れている（圏外で起動できる）',
  needed.every((url) => swSource.includes(`'${url}'`) && fs.existsSync(path.join(ROOT, url.replace('./', '')))),
  needed.filter((url) => !swSource.includes(`'${url}'`)).join(' / ') || '2/2件');

await tools.close();

// ===========================================================================
// クラウド頭脳 / Cloud Brain（BYOK） — specs/zero1_cloud_brain.md §5 の新規項目
//
// ★ここも「関数は正しいのに画面が使っていない」を見逃さないため、可能な限り
//   実際のUI操作（ボタンクリック・入力）を通す。window.fetch を差し込むのは
//   `__ZERO1_WEBLLM` と同じ考え方（CDNへ出ずに合成のOpenAIエンドポイントで確かめる）。
// ===========================================================================
console.log('\n== クラウド頭脳（BYOK）の検査 ==');

check('138. CSPのconnect-srcにhttps://api.openai.comが含まれる（静的）',
  /connect-src[^"]*https:\/\/api\.openai\.com/.test(pageSource));

/**
 * クラウド頭脳の送信フローを、実際のUI操作で通しで確かめる。
 * window.fetch を CLOUD_API_URL だけ横取りし、それ以外は素通しする
 * （__ZERO1_WEBLLM の合成ライブラリと同じ考え方。page.route ではなく window.fetch を
 *   差し込むのは、ストリーミングの分割・中断のタイミングを検査側で完全に制御するため）。
 */
async function withCloud({ status = 200, chunks = ['こんに', 'ちは', '。'], delayMs = 0,
  networkFail = false, failOnce = false, ask = '', stopAt = 0, clickRetry = false,
  fakeEngine = false, seedKey = 'sk-TEST-should-never-leak-98765' } = {}) {
  const scoped = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const cdnRequests = [];
  scoped.on('request', (req) => {
    if (/cdn\.jsdelivr\.net|huggingface\.co|raw\.githubusercontent\.com/.test(req.url())) cdnRequests.push(req.url());
  });
  await scoped.addInitScript(([status, chunks, delayMs, networkFail, failOnce, seedKey]) => {
    // ★入口カードから毎回打たせない検査もあるので、キーは事前に保存しておく
    if (seedKey) { try { localStorage.setItem('zero1-mobile-cloud-key', JSON.stringify(seedKey)); } catch { /* 無視 */ } }
    window.__CLOUD_CALLS = 0;
    window.__CLOUD_ABORTED = 0;
    window.__CLOUD_REQUESTS = [];
    window.__PWNED = 0;
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url !== 'https://api.openai.com/v1/chat/completions') return original(input, init);
      window.__CLOUD_CALLS += 1;
      const callNo = window.__CLOUD_CALLS;
      window.__CLOUD_REQUESTS.push({ headers: Object.keys(init?.headers ?? {}), auth: init?.headers?.Authorization ?? '' });
      if (networkFail && (!failOnce || callNo === 1)) return Promise.reject(new TypeError('Failed to fetch'));
      if (status !== 200) {
        return Promise.resolve(new Response(JSON.stringify({ error: { message: 'boom' } }),
          { status, headers: { 'Content-Type': 'application/json' } }));
      }
      const encoder = new TextEncoder();
      const signal = init?.signal;
      const stream = new ReadableStream({
        async start(controller) {
          let aborted = false;
          signal?.addEventListener('abort', () => {
            aborted = true;
            window.__CLOUD_ABORTED += 1;
            try { controller.error(new DOMException('The operation was aborted.', 'AbortError')); } catch { /* 既に閉じている */ }
          });
          for (const piece of chunks) {
            if (aborted) return;
            if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
            if (aborted) return;
            const line = `data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`;
            try { controller.enqueue(encoder.encode(line)); } catch { return; }
          }
          if (!aborted) { try { controller.enqueue(encoder.encode('data: [DONE]\n\n')); controller.close(); } catch { /* 無視 */ } }
        },
      });
      return Promise.resolve(new Response(stream, { status: 200 }));
    };
  }, [status, chunks, delayMs, networkFail, failOnce, seedKey]);
  await scoped.goto(`${BASE}/${PAGE}`, { waitUntil: 'domcontentloaded' });
  await scoped.waitForFunction(() => window.ZERO1_MOBILE_READY === true, { timeout: 15_000 });
  if (fakeEngine) await scoped.evaluate(() => { window.ZERO1_MOBILE_STATE.engine = {}; });
  // 「クラウド頭脳だけで始める」入口から入る（保存済みキーがあれば入力欄は空のままでよい）
  await scoped.locator('#btn-cloud-entry').click();
  await scoped.waitForFunction(() => !document.getElementById('chat').classList.contains('hidden'), { timeout: 10_000 });
  if (ask) {
    await scoped.locator('#input').fill(ask);
    await scoped.locator('#btn-send').click();
    if (stopAt) {
      // 1文字でも出てから止める（何も出ていないうちに押すと、何を止めたのか分からない）
      await scoped.waitForFunction(() => (document.querySelector('#msgs .msg:last-child .body')?.textContent ?? '').length > 0,
        { timeout: 10_000 }).catch(() => {});
      await scoped.waitForTimeout(stopAt);
      await scoped.locator('#btn-send').click();
    }
    await scoped.waitForFunction(() => {
      const last = document.querySelector('#msgs .msg:last-child');
      return last && !last.classList.contains('pending') && window.ZERO1_MOBILE_STATE?.busy === false;
    }, { timeout: 15_000 }).catch(() => {});
    if (clickRetry) {
      await scoped.locator('#msgs .msg:last-child .tools button', { hasText: 'もう一度試す' }).click();
      await scoped.waitForFunction(() => {
        const last = document.querySelector('#msgs .msg:last-child');
        return last && !last.classList.contains('pending') && window.ZERO1_MOBILE_STATE?.busy === false;
      }, { timeout: 15_000 }).catch(() => {});
    }
  }
  const result = await scoped.evaluate(() => ({
    body: document.querySelector('#msgs .msg:last-child .body')?.textContent ?? '',
    bodyHtml: document.querySelector('#msgs .msg.ai:last-of-type .body')?.innerHTML ?? '',
    tag: document.querySelector('#msgs .msg:last-child .tag')?.textContent ?? '',
    actions: [...document.querySelectorAll('#msgs .msg:last-child .tools button')].map((b) => b.textContent ?? ''),
    domText: document.body.innerText,
    domHtml: document.documentElement.outerHTML,
    headNote: document.getElementById('head-note').textContent,
    calls: window.__CLOUD_CALLS,
    aborted: window.__CLOUD_ABORTED,
    pwned: window.__PWNED ?? 0,
    chatting: !document.getElementById('chat').classList.contains('hidden'),
  }));
  result.cdnRequests = cdnRequests;
  await scoped.close();
  return result;
}

// --- 送信フロー（成功） ---------------------------------------------------------
const flow = await withCloud({ ask: 'こんにちは', chunks: ['こん', 'にち', 'は。'] });
check('144. クラウド頭脳の送信フロー（ストリーミング表示・タグ表示）が実際のUIで動く',
  flow.body === 'こんにちは。' && /クラウド頭脳\(GPT\)/.test(flow.tag) && /Cloud brain/.test(flow.tag),
  `${flow.body} ｜ ${flow.tag}`);

// --- 401: キーを見せず、やり直しボタンも出さない --------------------------------
const unauthorized = await withCloud({ status: 401, ask: 'こんにちは' });
check('145. 401失敗時、キーを含まないエラーが出て「もう一度試す」は出ない',
  unauthorized.actions.length === 0 && /APIキー|Invalid API key/.test(unauthorized.body)
    && !unauthorized.domText.includes('sk-TEST') && !unauthorized.domHtml.includes('sk-TEST'),
  unauthorized.body);

// --- ネットワーク中断 → 「もう一度試す」で再送し成功する ------------------------
const retried = await withCloud({ networkFail: true, failOnce: true, ask: 'こんにちは',
  clickRetry: true, chunks: ['了解', 'です'] });
check('146. ネットワーク中断後、「もう一度試す」ボタンで再送し成功する',
  retried.calls === 2 && retried.body === '了解です', `${retried.calls}回 ｜ ${retried.body}`);

// --- 「止める」ボタンでクラウドのfetchが中断される -------------------------------
const cloudStopped = await withCloud({ delayMs: 150, chunks: ['あ', 'い', 'う', 'え', 'お'], ask: 'こんにちは', stopAt: 60 });
check('147. 「止める」ボタンでクラウド生成中のfetchが中断される（AbortController）',
  cloudStopped.aborted >= 1 && /止めました/.test(cloudStopped.body), `中断${cloudStopped.aborted}回 ｜ ${cloudStopped.body}`);

// --- 失敗時、ローカルエンジンがある場合だけ「ローカルモデルで答える」が出る ------
const failWithEngine = await withCloud({ status: 500, ask: 'こんにちは', fakeEngine: true });
const failWithoutEngine = await withCloud({ status: 500, ask: 'こんにちは', fakeEngine: false });
check('148. クラウド失敗時、ローカルエンジンがある場合だけ代替ボタンが出る（自動フォールバックしない）',
  failWithEngine.actions.some((a) => /ローカルモデルで答える/.test(a))
    && !failWithoutEngine.actions.some((a) => /ローカルモデルで答える/.test(a)),
  `engine有: ${failWithEngine.actions.join(',')} ｜ engine無: ${failWithoutEngine.actions.join(',')}`);

// --- 「クラウド頭脳だけで始める」導線はローカルの取得先に一切触れない -----------
const entryOnly = await withCloud({ ask: '' });
check('149. 「クラウド頭脳だけで始める」導線でCDN・重みへのリクエストが発生しない',
  entryOnly.cdnRequests.length === 0 && entryOnly.chatting === true, entryOnly.cdnRequests.join(', '));

// --- モデルの出力からHTMLを組み立てない（XSS注入試験） --------------------------
const cloudRich = await withCloud({ ask: '教えて', chunks: [FORMATTED] });
check('157. クラウド応答からHTMLを組み立てない（返答経由のXSSを作らない）',
  !/<img/i.test(cloudRich.bodyHtml) && !/<script/i.test(cloudRich.bodyHtml)
    && /&lt;img/i.test(cloudRich.bodyHtml) && cloudRich.pwned !== 1,
  cloudRich.bodyHtml.includes('&lt;img') ? '文字として出ている' : cloudRich.bodyHtml.slice(-60));

// --- WebGPU非対応端末で、クラウド頭脳の入口カードが強調表示される ---------------
async function withNoWebGPU() {
  const scoped = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await scoped.addInitScript(() => {
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: undefined });
  });
  await scoped.goto(`${BASE}/${PAGE}`, { waitUntil: 'domcontentloaded' });
  await scoped.waitForFunction(() => window.ZERO1_MOBILE_READY === true, { timeout: 15_000 });
  const out = await scoped.evaluate(() => ({
    highlighted: document.getElementById('cloud-entry-card').classList.contains('highlight'),
    startDisabled: document.getElementById('btn-start').disabled,
  }));
  await scoped.close();
  return out;
}
const noGpu = await withNoWebGPU();
check('150. WebGPU非対応端末で、クラウド頭脳の入口カードが強調表示される（M8）',
  noGpu.highlighted && noGpu.startDisabled, JSON.stringify(noGpu));

// --- 設定シートの一連の操作（トグル・キー保存・マスク表示・削除） ---------------
const sheet = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await sheet.goto(`${BASE}/${PAGE}`, { waitUntil: 'domcontentloaded' });
await sheet.waitForFunction(() => window.ZERO1_MOBILE_READY === true, { timeout: 15_000 });

const initialBrain = await sheet.evaluate(() => window.ZERO1_MOBILE_STATE.brain);
check('139. 初回ロード時（localStorage空）に state.brain === local（既定OFF）', initialBrain === 'local', initialBrain);

await sheet.locator('#btn-settings').click();
await sheet.locator('#btn-cloud').click(); // キー未保存のままONを試みる
const afterToggleNoKey = await sheet.evaluate(() => ({
  brain: window.ZERO1_MOBILE_STATE.brain,
  optionsHidden: document.getElementById('cloud-options').hidden,
}));
check('140. キー未保存のまま btn-cloud をONにしても state.brain は local のまま（キー要求が先）',
  afterToggleNoKey.brain === 'local' && afterToggleNoKey.optionsHidden === false, JSON.stringify(afterToggleNoKey));

const TEST_KEY = 'sk-SHEETTEST-should-never-leak-13579';
await sheet.locator('#cloud-key-input').fill(TEST_KEY);
await sheet.locator('#btn-cloud-save').click();
const afterSave = await sheet.evaluate(() => ({
  cloudKey: window.ZERO1_MOBILE_STATE.cloudKey,
  status: document.getElementById('cloud-key-status').textContent,
  domHtml: document.documentElement.outerHTML,
  domText: document.body.innerText,
}));
check('141. キー保存 → state.cloudKeyに反映 → 画面のマスク表示に生キーが一切出現しない',
  afterSave.cloudKey === TEST_KEY && afterSave.status.includes('sk-…')
    && !afterSave.domHtml.includes(TEST_KEY) && !afterSave.domText.includes(TEST_KEY),
  afterSave.status);

await sheet.locator('#btn-cloud').click(); // 保存済みなので今度はONになる
const afterOn = await sheet.evaluate(() => ({
  brain: window.ZERO1_MOBILE_STATE.brain,
  ariaPressed: document.getElementById('btn-cloud').getAttribute('aria-pressed'),
  headNote: document.getElementById('head-note').textContent,
}));
check('152. #head-note がクラウド頭脳ONで文言が切り替わる（OpenAIへ送信される旨）',
  afterOn.brain === 'cloud' && afterOn.ariaPressed === 'true' && /OpenAI/.test(afterOn.headNote), afterOn.headNote);

await sheet.locator('#btn-cloud-clear').click();
const afterClear = await sheet.evaluate(() => ({
  brain: window.ZERO1_MOBILE_STATE.brain,
  cloudKey: window.ZERO1_MOBILE_STATE.cloudKey,
  headNote: document.getElementById('head-note').textContent,
}));
check('151. btn-cloud-clear でキー削除後、state.brain が自動的に local へ戻る',
  afterClear.brain === 'local' && afterClear.cloudKey === null && !/OpenAI/.test(afterClear.headNote),
  JSON.stringify(afterClear));

const leaked = await sheet.evaluate((key) => {
  const hits = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const k = localStorage.key(i);
    const v = localStorage.getItem(k) ?? '';
    if (k !== 'zero1-mobile-cloud-key' && v.includes(key)) hits.push(k);
  }
  return hits;
}, TEST_KEY);
check('154. zero1-mobile-cloud-key 以外のlocalStorageキーにAPIキー文字列が紛れ込んでいない',
  leaked.length === 0, leaked.join(', '));
await sheet.close();

// --- 純粋関数の分岐網羅（classifyCloudError / parseSSE） ------------------------
const cloudErr = await page.evaluate(() => {
  const { classifyCloudError } = window.ZERO1_MOBILE;
  return {
    e401: classifyCloudError(401, '', null),
    e429: classifyCloudError(429, '', null),
    e404: classifyCloudError(404, '', null),
    e500: classifyCloudError(500, '', null),
    net: classifyCloudError(undefined, undefined, new TypeError('Failed to fetch')),
    abort: classifyCloudError(undefined, undefined, { name: 'AbortError' }),
  };
});
check('142. classifyCloudError の分岐網羅（401/429/404/5xx/ネットワーク不能/AbortError）',
  cloudErr.e401.retryable === false && !/sk-/.test(cloudErr.e401.hint)
    && cloudErr.e429.retryable === true
    && cloudErr.e404.retryable === false
    && cloudErr.e500.retryable === true
    && cloudErr.net.retryable === true
    && cloudErr.abort.stopped === true && cloudErr.abort.retryable === false,
  JSON.stringify(cloudErr));

// ★チャンクが \n\n の境目で分割されるとは限らない。わざと3文字ずつに切って注入する
const sse = await page.evaluate(async () => {
  const { parseSSE } = window.ZERO1_MOBILE;
  const text = `data: ${JSON.stringify({ choices: [{ delta: { content: 'こんにちは' } }] })}\n\ndata: [DONE]\n\n`;
  const encoder = new TextEncoder();
  const chunks = [];
  for (let i = 0; i < text.length; i += 3) chunks.push(text.slice(i, i + 3));
  let idx = 0;
  const reader = {
    async read() {
      if (idx >= chunks.length) return { done: true, value: undefined };
      const value = encoder.encode(chunks[idx]);
      idx += 1;
      return { done: false, value };
    },
  };
  let out = '';
  await parseSSE(reader, (delta) => { out += delta; });
  return out;
});
check('143. parseSSE が\\n\\n境界をまたぐ意地悪な分割チャンクでも正しく復元する', sse === 'こんにちは', sse);

// --- 橋渡しの列挙チェック --------------------------------------------------------
const bridgeCheck = await page.evaluate(() => {
  const fns = ['readCloudKey', 'writeCloudKey', 'clearCloudKey', 'maskKey', 'cloudReady',
    'parseSSE', 'classifyCloudError', 'streamCloudAnswer', 'sendCloud'];
  const missingFns = fns.filter((n) => typeof window.ZERO1_MOBILE[n] !== 'function');
  const consts = ['CLOUD_MODEL_DEFAULT', 'CLOUD_API_URL'];
  const missingConsts = consts.filter((n) => typeof window.ZERO1_MOBILE[n] !== 'string');
  return { missingFns, missingConsts };
});
check('153. window.ZERO1_MOBILE にクラウド頭脳の新規関数・定数が全て公開されている',
  bridgeCheck.missingFns.length === 0 && bridgeCheck.missingConsts.length === 0,
  [...bridgeCheck.missingFns, ...bridgeCheck.missingConsts].join(', '));

// --- i18n / 静的grep -------------------------------------------------------------
check('155. 新規UI文言（クラウド頭脳・APIキー・エラー）が日英併記になっている',
  /クラウド頭脳 \/ Cloud Brain/.test(pageSource) && /Invalid API key/.test(pageSource)
    && /Rate limited/.test(pageSource) && /Model not found/.test(pageSource)
    && /保存 \/ Save/.test(pageSource) && /削除 \/ Delete/.test(pageSource));

const innerHtmlAssignments = (pageSource.match(/\.innerHTML\s*=/g) ?? []).length;
check('156. クラウド頭脳の新規コードに innerHTML/eval/new Function を使っていない（静的）',
  innerHtmlAssignments === 5 && !/\beval\s*\(/.test(pageSource) && !/new\s+Function\s*\(/.test(pageSource),
  `innerHTML代入 ${innerHtmlAssignments}件（既存5件から増えていないこと）`);

const shot = path.join(ROOT, 'test-screenshots');
fs.mkdirSync(shot, { recursive: true });
await page.screenshot({ path: path.join(shot, 'zero-1-mobile.png'), fullPage: false });

await browser.close();
server.close();
console.log(`\n  合計: ${pass} 件合格 / ${fail} 件不合格`);
process.exit(fail ? 1 : 0);
