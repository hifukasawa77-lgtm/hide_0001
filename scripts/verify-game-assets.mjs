#!/usr/bin/env node
/*
 * verify-game-assets.mjs — ゲームHTMLを実際に開き、アセットの404とJS例外を検出する
 *
 * 背景: アセットをWebPへ再エンコードすると拡張子が変わる。参照が文字列リテラルなら一括置換で
 * 追従できるが、`'assets/trains/vehicles/' + id + '.png'` のように**実行時に組み立てている**箇所は
 * 置換から漏れる。漏れても読み込みが失敗するだけでJS例外は出ず、絵が出ないまま無言で進むため、
 * 静的なgrepだけでは気づけない。実際にページを開いて失敗したリクエストを数えるのが唯一確実。
 *
 * 使い方:
 *   node scripts/verify-game-assets.mjs                # 主要ゲームHTMLを一括検査
 *   node scripts/verify-game-assets.mjs beat_em_up.html sanguo.html
 *   node scripts/verify-game-assets.mjs --wait 8000    # 1ページあたりの観測時間（既定5000ms）
 *
 * 終了コード: 404も例外も0件=0 / 1件でもあれば1
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.cjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
};

function serve(root) {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
      const file = path.join(root, rel);
      if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

async function checkPage(browser, port, file, waitMs) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const missing = new Set();
  const external = new Set();   // 別オリジン（CDN・Webフォント）の失敗はFAILにしない
  const errors = [];
  // このリポジトリの資産（同一オリジン＝一時サーバ）だけをFAIL対象にする。
  // CDNやWebフォントは回線・地域・社内プロキシで落ちる。混ぜると「本物の404」が
  // 環境由来の赤に埋もれ、やがて検査ごと無視されるようになる（dynamic-test-auto.cjs と同じ設計）。
  const isLocal = url => { try { return new URL(url).port === String(port); } catch { return false; } };
  const label = url => { try { const u = new URL(url); return u.host + u.pathname; } catch { return url; } };
  page.on('response', r => {
    if (r.status() !== 404) return;
    if (isLocal(r.url())) missing.add(new URL(r.url()).pathname);
    else external.add(label(r.url()) + ' (404)');
  });
  page.on('requestfailed', r => {
    const reason = r.failure()?.errorText || 'failed';
    if (!isLocal(r.url())) { external.add(label(r.url()) + ' (' + reason + ')'); return; }
    const rel = decodeURIComponent(new URL(r.url()).pathname).replace(/^\/+/, '');
    // 検査自身のクリック・Enterがリンクを踏むと遷移が始まり、検査の終了で中断される。
    // 実体が在るのに ERR_ABORTED で「404」と報告されていた（card-games.html → poker.html）。
    // 中断はページの欠陥ではないので、**実体が在るときだけ**除外する。
    // 実在しないファイルの中断は従来どおりFAIL（これを緩めると本物の欠落を見逃す）。
    if (reason.includes('ERR_ABORTED') && fs.existsSync(path.join(ROOT, rel))) return;
    missing.add(new URL(r.url()).pathname + ' (' + reason + ')');
  });
  page.on('pageerror', e => errors.push(String(e).split('\n')[0]));
  try {
    await page.goto(`http://127.0.0.1:${port}/${file}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // 起動直後にしか要求されないアセットもあるため、一定時間フレームを回して観測する
    await page.waitForTimeout(waitMs);
    // 画面を触って「操作後に読むアセット」も引き出す
    await page.mouse.click(640, 400).catch(() => {});
    await page.keyboard.press('Enter').catch(() => {});
    await page.waitForTimeout(Math.min(waitMs, 3000));
  } catch (e) {
    errors.push('goto: ' + e.message);
  }
  await page.close();
  return { file, missing: [...missing], external: [...external], errors };
}

// 静的チェック: コード中の画像参照が、実在するファイルを指しているか。
// ブラウザ検査は「その回に実際に要求されたアセット」しか見えないので、
// 条件分岐の先にある参照や操作しないと出ない画面は素通りする。全参照を machine で当たる。
function checkStaticRefs() {
  const CODE = new Set(['.html', '.js', '.mjs', '.cjs', '.json', '.css']);
  // 対象外: 検査・変換スクリプト自身（MIME表やdocstringにパスらしき文字列を含む）、
  // GameKitのdocコメントの例示パス、別プロジェクトのブラウザ拡張マニフェスト。
  const SKIP = ['scripts/verify-', 'scripts/optimize-', 'scripts/fix-webp-refs', 'scripts/agent-dynamic-test',
    'gamekit/gamekit.js', 'tracker-blocker/', 'node_modules', '.git'];
  const assetRoots = fs.readdirSync(path.join(ROOT, 'assets'), { withFileTypes: true })
    .filter(e => e.isDirectory()).map(e => path.join(ROOT, 'assets', e.name));
  // 実行時に組み立てるパス（`HEX_BATTLE_ROOT + 'backgrounds/01-x.webp'` 等）は、参照文字列だけ見ても
  // 解決できない。assets 直下1階層を候補にするだけでは足りず、2階層以上のルートを持つゲーム
  // （assets/genpei/hex-battles/）が丸ごと「実在しない」と誤報された。ルートを推測で広げると
  // 今度は誤った場所で解決して本物の間違いを見逃すので、**そのファイル自身が宣言している**
  // 'assets/.../' という文字列だけを、そのファイルの解決先に加える。
  const declaredRoots = text => {
    const roots = new Set();
    const re = /["'`](assets\/[A-Za-z0-9_\-./]*\/)["'`]/g;
    let m;
    while ((m = re.exec(text))) roots.add(path.join(ROOT, m[1]));
    return [...roots];
  };
  const bad = [];
  const walk = dir => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      const rel = path.relative(ROOT, p).replace(/\\/g, '/');
      if (SKIP.some(s => rel.startsWith(s))) continue;
      if (e.isDirectory()) { walk(p); continue; }
      if (!CODE.has(path.extname(e.name).toLowerCase())) continue;
      let text; try { text = fs.readFileSync(p, 'utf8'); } catch { continue; }
      const fileRoots = declaredRoots(text);
      const re = /["'`]([A-Za-z0-9_\-./]+\.(?:webp|png|jpe?g))["'`]/g;
      let m;
      while ((m = re.exec(text))) {
        const ref = m[1];
        if (/^https?:/.test(ref) || !ref.includes('/')) continue;   // 外部URL・裸のファイル名は対象外
        // ゲームごとに `ASSET_BASE='assets/city-builder/'` のようなルートを持ち、参照は
        // そこからの相対で書かれていることが多い。assets 直下の各ディレクトリも解決先に含める。
        const cands = [
          path.join(ROOT, ref),
          path.join(path.dirname(p), ref),
          path.join(ROOT, 'assets', ref),
          ...assetRoots.map(r => path.join(r, ref)),
          ...fileRoots.map(r => path.join(r, ref)),
        ];
        if (!cands.some(c => fs.existsSync(c))) bad.push(`${rel}: ${ref}`);
      }
    }
  };
  walk(ROOT);
  return [...new Set(bad)];
}

async function main() {
  const argv = process.argv.slice(2);
  let waitMs = 5000;
  const wi = argv.indexOf('--wait');
  if (wi >= 0) { waitMs = Number(argv[wi + 1]) || 5000; argv.splice(wi, 2); }
  const files = argv.length ? argv
    : fs.readdirSync(ROOT).filter(f => f.endsWith('.html') && !f.startsWith('castle-layout-trace'));

  const staticBad = checkStaticRefs();
  console.log(staticBad.length
    ? `[FAIL] 実在しないファイルを指す画像参照 ${staticBad.length}件`
    : '[ ok ] 画像参照はすべて実在するファイルを指している');
  staticBad.slice(0, 20).forEach(b => console.log('        ✗ ' + b));
  if (staticBad.length > 20) console.log(`        … 他 ${staticBad.length - 20}件`);
  console.log('');

  const { server, port } = await serve(ROOT);
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined)
  });
  let bad = staticBad.length;
  for (const f of files) {
    if (!fs.existsSync(path.join(ROOT, f))) { console.log(`  ?  ${f}（存在しない）`); continue; }
    const r = await checkPage(browser, port, f, waitMs);
    const n = r.missing.length + r.errors.length;
    bad += n;
    const ext = r.external.length ? `  外部:${r.external.length}` : '';
    console.log(`${n ? '[FAIL]' : '[ ok ]'} ${f.padEnd(30)} 404:${String(r.missing.length).padStart(3)}  例外:${r.errors.length}${ext}`);
    r.missing.slice(0, 8).forEach(m => console.log('        ✗ 404 ' + m));
    if (r.missing.length > 8) console.log(`        … 他 ${r.missing.length - 8}件`);
    r.errors.slice(0, 3).forEach(m => console.log('        ✗ ' + m));
    // 別オリジンはFAILにしないが、黙って捨てると「CDNが落ちている」に気づけないので参考表示する
    r.external.slice(0, 3).forEach(m => console.log('        △ 外部 ' + m));
  }
  await browser.close(); server.close();
  console.log(bad ? `\n[FAIL] 合計 ${bad}件` : '\n[PASS] 404・例外ともに0件');
  process.exit(bad ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
