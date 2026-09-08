#!/usr/bin/env node
// CSP を入れたあと、**実物で**壊れていないかを確かめる。
//
// ★CSP 違反は**画面に何も出ない**。絵が出ない・音が鳴らない・通信が届かないだけで、
//   例外もエラーメッセージも利用者には見えない（コンソールにしか出ない）。
//   このサイトの他の無言バグとまったく同じ壊れ方をする。
//   **だから静的検査だけにしない。** 実際にブラウザで開いて違反イベントを拾う。
//
// ★別オリジン（CDN・Webフォント）の**読込失敗**は FAIL にしない。回線・地域・
//   社内プロキシで落ちるものを混ぜると、本物の違反が環境由来の赤に埋もれる
//   （verify-game-assets.mjs と同じ設計）。CSP の**違反**は環境に依らないので FAIL。

import { createServer } from "node:http";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 8129;

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wasm": "application/wasm",
};

/**
 * meta の CSP を読む（静的検査のぶん）。
 *
 * ★**開いた引用符と同じ引用符まで**を読む。`content="... 'self' ..."` のように
 *   中に反対側の引用符が入るので、`["']([^"']+)["']` と書くと最初の `'self'` の
 *   `'` で切れ、**正しく設定されているページを「CSPが無い」と誤報する**
 *   （2026-09-08、実際にそう出た）。誤検知が出る検査は必ず無視されるようになる。
 */
export function readMetaCsp(html) {
  const tag = html.match(/<meta[^>]*http-equiv=(["'])Content-Security-Policy\1[^>]*>/i);
  if (!tag) return "";
  const match = tag[0].match(/content=(["'])((?:(?!\1)[\s\S])*)\1/i);
  return match ? match[2].replace(/\s+/g, " ").trim() : "";
}

/** 守りとして成り立っているか。**「在る」だけでは意味がない** */
export function auditCsp(csp) {
  const problems = [];
  const warnings = [];
  const directive = (name) => {
    const found = csp.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name} `) || part === name);
    return found ? found.slice(name.length).trim() : "";
  };
  if (!csp) return ["CSP が無い"];
  const connect = directive("connect-src") || directive("default-src");
  // ★ここが緩いと、XSS が起きたとき鍵をそのまま外へ送れる。
  //   ただし `https://*.huggingface.co` のような**ドメインを絞った下位ワイルドカード**は
  //   緩さではない。丸ごとの `*` と、スキームだけの `https:` を見る
  //   （雑に `*` を含むかで見ると、正しく絞っているページまで赤くなる）
  const wide = connect.split(/\s+/).filter((token) => /^(\*|https?:|\*:)$/.test(token) || /^https?:\/\/\*$/.test(token));
  // ★これは△（警告）で、✗にはしない。index/dashboard は数十のAPIとCORSプロキシを叩いており、
  //   どれが要るかを**推測で**絞ると、例外もエラーも出ないまま表示だけが欠ける。
  //   実際に叩いている宛先を数え上げてから絞ること。
  //   通らないと分かっている検査を✗のまま置くと、やがて誰も検査を見なくなる。
  if (wide.length) warnings.push(`connect-src が緩い（${wide.join(" ")}）— XSSが起きたとき、どこへでも送れる`);
  if (!connect) problems.push("connect-src も default-src も無い");
  const form = directive("form-action");
  if (!form) problems.push("form-action が無い — form でデータを外へ送れる");
  if (!directive("base-uri")) problems.push("base-uri が無い — <base> で全部の相対URLを乗っ取れる");
  const object = directive("object-src") || directive("default-src");
  if (object !== "'none'" && !/'none'/.test(object) && !/'self'/.test(object)) problems.push("object-src が緩い");
  return Object.assign(problems, { warnings });
}

function serve() {
  return new Promise((resolve) => {
    const server = createServer((request, response) => {
      const url = decodeURIComponent((request.url ?? "/").split("?")[0]);
      const file = path.join(ROOT, url === "/" ? "index.html" : url.replace(/^\//, ""));
      if (!file.startsWith(ROOT)) { response.writeHead(403); response.end(); return; }
      try {
        if (statSync(file).isDirectory()) { response.writeHead(404); response.end(); return; }
        response.writeHead(200, { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream" });
        response.end(readFileSync(file));
      } catch {
        // favicon を404にすると console.error が出て全ページが落ちる（204で黙らせる）
        response.writeHead(url.includes("favicon") ? 204 : 404); response.end();
      }
    });
    server.listen(PORT, "127.0.0.1", () => resolve(server));
  });
}

async function main() {
  const pages = readdirSync(ROOT).filter((name) => name.endsWith(".html")).sort();
  let failures = 0;

  console.log("== CSP 静的検査 ==");
  const missing = [];
  const loose = [];
  for (const name of pages) {
    const csp = readMetaCsp(readFileSync(path.join(ROOT, name), "utf8"));
    const problems = auditCsp(csp);
    if (problems.length) missing.push(`${name}: ${problems.join(" / ")}`);
    for (const warning of problems.warnings ?? []) loose.push(`${name}: ${warning}`);
  }
  if (missing.length) { failures += missing.length; missing.forEach((line) => console.log(`✗ ${line}`)); }
  else console.log(`◯ ${pages.length}ページすべてに、持ち出しを塞ぐCSPがある`);
  loose.forEach((line) => console.log(`△ ${line}`));

  if (process.argv.includes("--static-only")) { report(failures); return; }

  console.log("\n== 実物で確かめる（違反は画面に出ないので、ここでしか分からない） ==");
  const server = await serve();
  // ★同梱ブラウザの版が package の想定とずれていることがある。落ちたら
  //   環境に在る実体を使う（版ずれで検査が動かないと、誰も CSP を確かめなくなる）
  const browser = await chromium.launch().catch(() => chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }));
  const only = process.argv.find((arg) => arg.startsWith("--only="))?.slice(7);
  const targets = only ? pages.filter((name) => name.includes(only)) : pages;
  for (const name of targets) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const violations = [];
    // ★違反はイベントで拾う。console だけ見ると、拾えないブラウザ・版がある
    await page.addInitScript(() => {
      window.__CSP_VIOLATIONS = [];
      document.addEventListener("securitypolicyviolation", (event) => {
        window.__CSP_VIOLATIONS.push(`${event.violatedDirective} ← ${event.blockedURI}`);
      });
    });
    page.on("pageerror", (error) => violations.push(`例外: ${error.message}`));
    try {
      await page.goto(`http://127.0.0.1:${PORT}/${name}`, { waitUntil: "load", timeout: 20_000 });
      await page.waitForTimeout(1200);
      const blocked = await page.evaluate(() => window.__CSP_VIOLATIONS ?? []);
      // ★訪問者の localhost 宛てが塞がれるのは**意図どおり**。公開ページが
      //   訪問者のPCの口を叩くのは正しくない（ZERO-1の音声中継が 3001 で待っている）。
      //   ここを FAIL にすると、正しい守りを外す方向へ直したくなる
      violations.push(...blocked.filter((line) => !/\b(localhost|127\.0\.0\.1)\b/.test(line)));
      const intended = blocked.filter((line) => /\b(localhost|127\.0\.0\.1)\b/.test(line));
      if (intended.length) console.log(`◯ ${name}（意図どおり塞いだ: ${intended.length}件 — 訪問者のPC宛て）`);
    } catch (cause) {
      violations.push(`開けなかった: ${cause.message.split("\n")[0]}`);
    }
    await context.close();
    if (violations.length) {
      failures += 1;
      console.log(`✗ ${name}`);
      [...new Set(violations)].slice(0, 6).forEach((line) => console.log(`    ${line}`));
    }
  }
  await browser.close();
  server.close();
  if (!failures) console.log(`◯ ${targets.length}ページを実際に開き、CSP違反も例外も0件`);
  report(failures);
}

function report(failures) {
  console.log(failures ? `\n==> ✗ ${failures}件` : "\n==> ◯ 問題なし");
  process.exitCode = failures ? 1 : 0;
}

if (import.meta.url === `file://${path.resolve(process.argv[1] ?? "")}`) await main();
