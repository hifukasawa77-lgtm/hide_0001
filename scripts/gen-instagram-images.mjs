#!/usr/bin/env node
/*
 * gen-instagram-images.mjs — Instagram用の 1080×1080 画像を生成する。
 *
 * 出力: assets/marketing/ig-0N-*.jpg（4枚）
 * 文面の正本は marketing/social_2026-08_x_instagram.md。数値（ゲーム本数・エージェント数）を
 * 変えたときはこのスクリプトの CARDS も直すこと。
 *
 * JPEGで出すのは Instagram Graph API が JPEG しか受け付けないため
 * （リポジトリのWebP原則の例外。CLAUDE.md「画像アセットの方針」参照）。
 *
 * 使い方: node scripts/gen-instagram-images.mjs
 *   一時HTTPサーバを自分で立てて描画する（file:// だとWebフォントとCSSの一部が効かない）。
 */
import { chromium } from 'playwright';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'assets', 'marketing');

const CARDS = [
  { file: 'ig-01-hero.jpg', kicker: 'BROWSER GAMES', title: '37本、<br>ブラウザで無料。',
    sub: 'インストール不要 / No install required',
    items: ['ボードゲーム 20本', 'シミュレーション 6本', 'アクション 4本', 'パズル・RPG ほか 7本'],
    accent: '#22d3ee' },
  { file: 'ig-02-strategy.jpg', kicker: 'HISTORICAL STRATEGY', title: '歴史SLG、<br>4タイトル。',
    sub: 'ヘックス戦・外交・攻城戦 / Hex battles &amp; diplomacy',
    items: ['三国志・天下三分', '戦国風雲記', '源平争乱記', '太平風雲記'],
    accent: '#a78bfa' },
  { file: 'ig-03-board.jpg', kicker: 'BOARD GAMES', title: '盤上遊戯、<br>20本。',
    sub: 'AI対戦つき / Play against AI',
    items: ['将棋・囲碁・チェス', '麻雀・花札・百人一首', 'バックギャモン・オセロ', 'トランプゲーム集'],
    accent: '#22d3ee' },
  { file: 'ig-04-team.jpg', kicker: 'AI TEAM', title: 'AIエージェント<br>22体で作る。',
    sub: '企画から品質ゲート、リリースまで / Plan → gates → release',
    items: ['企画・制作 5体', '品質ゲート 6体', '公開後の改善 4体', '切り分け・検査 2体 ほか'],
    accent: '#a78bfa' },
];

const html = (c) => `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700&family=Noto+Sans+JP:wght@400;700&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:1080px; height:1080px; background:#05070d; overflow:hidden;
         font-family:'Noto Sans JP','Hiragino Sans','Yu Gothic',sans-serif; color:#e8eef7; }
  .bg { position:absolute; inset:0; }
  .glow { position:absolute; border-radius:50%; filter:blur(120px); opacity:.30; }
  .g1 { width:620px; height:620px; background:${c.accent}; top:-180px; right:-140px; }
  .g2 { width:520px; height:520px; background:#7c3aed; bottom:-160px; left:-120px; opacity:.22; }
  .card { position:absolute; inset:64px; border-radius:36px; padding:72px 68px;
          background:rgba(255,255,255,0.045); border:1px solid rgba(255,255,255,0.12);
          backdrop-filter:blur(14px); display:flex; flex-direction:column; }
  .kicker { font-family:'Orbitron',monospace; font-size:26px; letter-spacing:.22em;
            color:${c.accent}; margin-bottom:34px; }
  h1 { font-size:82px; line-height:1.24; font-weight:700; letter-spacing:.01em; }
  .sub { margin-top:26px; font-size:27px; color:#93a4bd; letter-spacing:.02em; }
  ul { margin-top:auto; list-style:none; display:grid; gap:19px; }
  li { font-size:31px; color:#cfdcec; display:flex; align-items:center; gap:19px; }
  li::before { content:''; width:11px; height:11px; border-radius:3px; background:${c.accent}; flex:none; }
  .foot { margin-top:52px; display:flex; align-items:baseline; justify-content:space-between; }
  .url { font-family:'Orbitron',monospace; font-size:23px; color:${c.accent}; letter-spacing:.05em; }
  .brand { font-size:24px; color:#7d8ca5; }
</style></head><body>
<div class="bg"><div class="glow g1"></div><div class="glow g2"></div></div>
<div class="card">
  <div class="kicker">${c.kicker}</div>
  <h1>${c.title}</h1>
  <div class="sub">${c.sub}</div>
  <ul>${c.items.map(i => `<li>${i}</li>`).join('')}</ul>
  <div class="foot"><span class="url">hide の部屋</span><span class="brand">Canvas API / no frameworks</span></div>
</div></body></html>`;

// 描画用の一時HTTPサーバ（Webフォントの読み込みとCSSの安定のため file:// は使わない）
let current = '';
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(current);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

fs.mkdirSync(OUT_DIR, { recursive: true });
const b = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
const p = await b.newPage({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1 });
for (const c of CARDS) {
  current = html(c);
  await p.goto(`http://127.0.0.1:${port}/`);
  await p.waitForTimeout(1200);
  const out = path.join(OUT_DIR, c.file);
  await p.screenshot({ path: out, type: 'jpeg', quality: 92 });
  console.log('生成:', path.relative(ROOT, out));
}
await b.close();
await new Promise(r => server.close(r));
console.log('完了: 4枚を', path.relative(ROOT, OUT_DIR), 'へ出力');
