// Node.js 18+ required (uses native fetch + TextEncoder)
// 使い方: node scripts/post-social.js <bluesky|reddit|x|instagram> [--dry-run]
//   --dry-run … 認証情報を使わず、投稿内容だけを表示する（文面の確認・CIの疎通確認用）
// 認証情報が未設定のプラットフォームは「スキップ」して正常終了する（毎週赤くならないため）。

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SITE_URL = 'https://hifukasawa77-lgtm.github.io/main/';
const AGENTS_URL = 'https://hifukasawa77-lgtm.github.io/main/agents.html';
// Instagram Graph API は「公開HTTPSのURL」からしか画像を取り込めないため、GitHub Pages 上の実体を指す
const MEDIA_BASE = 'https://hifukasawa77-lgtm.github.io/main/assets/marketing/';

const DRY_RUN = process.argv.includes('--dry-run');

// 手書きのコア投稿（サイト全体紹介）。文面の正本は marketing/social_2026-08_x_instagram.md。
// ここは実行用の写し（変更時は両方直す。verify-social-posts.mjs の検査#6が一致を機械確認する）
const BLUESKY_POSTS_CORE = [
  { id: 'core-overview-ja', text: `将棋・麻雀・バックギャモン・ベルトスクロールアクション・シューティング…\nブラウザだけで遊べる本格ゲームを37本無料公開中。インストール不要で今すぐプレイ！\n${SITE_URL}\n#ブラウザゲーム #無料ゲーム #個人開発` },
  { id: 'core-claude-ja',   text: `Claude AIとのペアプログラミングだけでブラウザゲームを37本作りました。素のHTML/CSS/JavaScript（Canvas API）のみ。フレームワーク・ビルドツール一切なし。\n${SITE_URL}\n#Claude #AI駆動開発 #JavaScript #CanvasAPI` },
  { id: 'core-free-ja',     text: `アプリのインストール不要！ブラウザを開くだけで将棋・麻雀・ポーカー・アクションゲームが全部タダで遊べます。37本収録、随時追加中。\n${SITE_URL}\n#暇つぶし #無料ゲーム #ブラウザゲーム #将棋` },
];

const X_POSTS_CORE = [
  { id: 'core-history-slg-ja', text: `歴史シミュレーションを4本、ブラウザで無料公開しています。\n\n・三国志・天下三分（8シナリオ／10勢力）\n・戦国風雲記（街道・攻城ヘックス戦）\n・源平争乱記（兵力でなく"名分"を獲る）\n・太平風雲記（南北朝の正統性争い）\n\n全部インストール不要。フレームワークも不使用です。\n${SITE_URL}\n\n#個人開発 #ブラウザゲーム #シミュレーションゲーム` },
  { id: 'core-ai-team-ja',     text: `ゲーム開発をAIエージェント22体のチームでやっています。\n\n企画→アセット制作→実装→品質ゲート（法務／脆弱性／日英表記／アセット）→動的テスト→採点→リリース。\nこのパイプラインごとサイトで公開しました。\n${AGENTS_URL}\n\n#AI駆動開発 #ClaudeCode #個人開発` },
  { id: 'core-tech-en',        text: `I built 37 browser games with zero frameworks — just vanilla JS and the Canvas API.\n\nHex-grid battles, AI opponents, Web Audio synths: all hand-rolled.\nNo bundler, no npm install. Open the HTML and it runs.\n${SITE_URL}\n\n#JavaScript #CanvasAPI #gamedev #indiedev` },
  { id: 'core-casual-ja',      text: `将棋・囲碁・麻雀・チェス・花札・百人一首・バックギャモン…\nボードゲームだけで20本、ブラウザで無料で遊べます。\n\nアプリ入れなくていいので、通勤中の暇つぶしにどうぞ。\n${SITE_URL}\n\n#無料ゲーム #暇つぶし #将棋 #麻雀` },
];

const INSTAGRAM_POSTS = [
  {
    id: 'ig-hero',
    images: ['ig-01-hero.jpg', 'ig-02-strategy.jpg', 'ig-03-board.jpg', 'ig-04-team.jpg'],
    caption: `ブラウザだけで遊べるゲームを37本、無料公開しています🎮\n\n▫️歴史シミュレーション4本（三国志・戦国・源平・南北朝）\n▫️ボードゲーム20本（将棋・囲碁・麻雀・チェス・花札…）\n▫️アクション・シューティング・パズル\n\nすべてインストール不要。ライブラリもフレームワークも使わず、素のJavaScriptとCanvas APIだけで作りました。\n\n開発はAIエージェント22体のチーム制。企画から品質チェック、リリースまでの流れもサイトで公開しています。\n\nプロフィールのリンクから遊べます👆\n\n—\n37 free browser games, no install required.\nBuilt with vanilla JavaScript and the Canvas API — zero frameworks.\nDeveloped by a team of 22 AI agents.\n\n#個人開発 #ブラウザゲーム #無料ゲーム #ゲーム制作 #JavaScript #CanvasAPI #AI駆動開発 #indiedev #gamedev #browsergames #retrogaming #将棋 #麻雀 #シミュレーションゲーム #プログラミング`,
  },
  {
    id: 'ig-genpei',
    images: ['ig-02-strategy.jpg'],
    caption: `「兵力ではなく"名分"を奪い合う」歴史シミュレーションを作りました⚔️\n\n源平争乱記 — 治承・寿永の乱（1180-1189）が舞台。院宣・官位・三種の神器といった正統性を巡って争います。\n\n戦は数だけでは決まらない。そこを遊びの中心に据えました。\n\nブラウザで無料。インストール不要です。\nプロフィールのリンクから👆\n\n—\nA historical strategy game where you fight for legitimacy, not just troops.\n\n#歴史ゲーム #源平合戦 #シミュレーションゲーム #個人開発 #ブラウザゲーム #ゲーム制作 #strategygame #indiedev #gamedev #history`,
  },
  {
    id: 'ig-team',
    images: ['ig-04-team.jpg'],
    caption: `ゲームを作っているのは、22体のAIエージェントのチームです🤖\n\nプランナーが仕様を書き、デザイナーが絵を作り、コードジェネレーターが実装し、法務・セキュリティ・多言語・アセットの4体が並列でチェック。テスターが実際にブラウザで動かして、エバリュエーターが100点満点で採点。80点未満はやり直しです。\n\nこのチーム表もサイトで公開しています。\n\n#AI駆動開発 #ClaudeCode #個人開発 #プログラミング #AIエージェント #buildinpublic #aitools #indiedev`,
  },
];

const REDDIT_POSTS = [
  { id: 'reddit-webgames',   subreddit: 'webgames',   title: '37 free browser games (shogi, mahjong, backgammon, beat-em-up, shooting) – built with Claude AI + vanilla JS, no install needed' },
  { id: 'reddit-javascript', subreddit: 'javascript', title: 'I built 37 browser games using only vanilla JS and Canvas API with Claude AI pair programming – no frameworks, no bundlers' },
  { id: 'reddit-gamedev',    subreddit: 'gamedev',    title: 'Made 37 browser games with Claude AI as my pair programmer – zero frameworks, pure Canvas API' },
  { id: 'reddit-claudeai',   subreddit: 'ClaudeAI',   title: 'Built 37 browser games through Claude AI pair programming – a year of vanilla JS + Canvas API projects' },
];

// ゲーム別スポットライト投稿（scripts/gen-game-spotlight-posts.mjs の生成物）。
// 未生成でもコア文面だけで動くようフォールバックする
let GAME_SPOTLIGHT_X = [];
let GAME_SPOTLIGHT_BLUESKY = [];
try {
  ({ GAME_SPOTLIGHT_X, GAME_SPOTLIGHT_BLUESKY } = require('../marketing/game-spotlight-posts.generated.js'));
} catch (e) {
  console.log('⚠️  marketing/game-spotlight-posts.generated.js が無い（node scripts/gen-game-spotlight-posts.mjs で生成可能）。コア文面のみでローテーションします');
}

// コア文面 + ゲーム別スポットライトを合流させたローテーション対象（実際に投稿に使う配列）
const X_POSTS = [...X_POSTS_CORE, ...GAME_SPOTLIGHT_X];
const BLUESKY_POSTS = [...BLUESKY_POSTS_CORE, ...GAME_SPOTLIGHT_BLUESKY];

// ── 投稿ログ（反応計測の起点）──────────────────────────────
// 何を・いつ・どのIDで投稿したかを記録する。scripts/fetch-social-engagement.mjs が
// このログを頼りに各SNSの公開反応（いいね数等）を後から取りに行き、marketer-evolve
// （週次の学習ループ）が「何が効いたか」を判断する材料にする。
const POST_LOG_PATH = path.join(__dirname, '..', 'marketing', 'post-log.json');

function logPost(entry) {
  let log = [];
  try { log = JSON.parse(fs.readFileSync(POST_LOG_PATH, 'utf8')); } catch (e) { log = []; }
  log.push({ postedAt: new Date().toISOString(), ...entry });
  if (log.length > 500) log = log.slice(-500); // 無限増殖を防ぐ（直近500件のみ保持）
  fs.writeFileSync(POST_LOG_PATH, JSON.stringify(log, null, 2) + '\n');
}

// Compute UTF-8 byte range for Bluesky richtext facets
function byteRange(text, substr) {
  const enc = new TextEncoder();
  const fullBytes = enc.encode(text);
  const subBytes  = enc.encode(substr);
  outer: for (let i = 0; i <= fullBytes.length - subBytes.length; i++) {
    for (let j = 0; j < subBytes.length; j++) {
      if (fullBytes[i + j] !== subBytes[j]) continue outer;
    }
    return { byteStart: i, byteEnd: i + subBytes.length };
  }
  return null;
}

function buildFacets(text) {
  const facets = [];
  for (const m of text.matchAll(/https?:\/\/\S+/g)) {
    const r = byteRange(text, m[0]);
    if (r) facets.push({ index: r, features: [{ $type: 'app.bsky.richtext.facet#link', uri: m[0] }] });
  }
  for (const m of text.matchAll(/#[^\s#]+/g)) {
    const r = byteRange(text, m[0]);
    if (r) facets.push({ index: r, features: [{ $type: 'app.bsky.richtext.facet#tag', tag: m[0].slice(1) }] });
  }
  return facets;
}

async function postToBluesky(text) {
  const handle   = process.env.BLUESKY_HANDLE;
  const password = process.env.BLUESKY_APP_PASSWORD;
  if (!handle || !password) throw new Error('BLUESKY_HANDLE / BLUESKY_APP_PASSWORD not set');

  const authRes = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: handle, password }),
  });
  if (!authRes.ok) throw new Error(`Bluesky auth failed: ${await authRes.text()}`);
  const { accessJwt, did } = await authRes.json();

  const postRes = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessJwt}` },
    body: JSON.stringify({
      repo: did,
      collection: 'app.bsky.feed.post',
      record: {
        $type: 'app.bsky.feed.post',
        text,
        facets: buildFacets(text),
        createdAt: new Date().toISOString(),
      },
    }),
  });
  if (!postRes.ok) throw new Error(`Bluesky post failed: ${await postRes.text()}`);
  const data = await postRes.json();
  console.log(`✅ Bluesky posted: ${data.uri}`);
  return data;
}

async function postToReddit({ subreddit, title }) {
  const clientId     = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  const username     = process.env.REDDIT_USERNAME;
  const password     = process.env.REDDIT_PASSWORD;
  if (!clientId || !clientSecret) throw new Error('Reddit credentials not set');

  const tokenRes = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'hide-room-bot/1.0',
    },
    body: `grant_type=password&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
  });
  if (!tokenRes.ok) throw new Error(`Reddit auth failed: ${await tokenRes.text()}`);
  const { access_token } = await tokenRes.json();

  const submitRes = await fetch('https://oauth.reddit.com/api/submit', {
    method: 'POST',
    headers: {
      Authorization: `bearer ${access_token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'hide-room-bot/1.0',
    },
    body: new URLSearchParams({ kind: 'link', sr: subreddit, title, url: SITE_URL, resubmit: 'false' }).toString(),
  });
  const data = await submitRes.json();
  if (data.json?.errors?.length) throw new Error(`Reddit error: ${JSON.stringify(data.json.errors)}`);
  console.log(`✅ Reddit r/${subreddit}: posted`);
  return data.json?.data; // { id, name, url, ... }
}


// ── X（旧Twitter）─────────────────────────────────────────────
// API v2 の POST /2/tweets は OAuth 1.0a user context 署名が要る（無料枠: 月500投稿）。
// 依存パッケージを増やさないため、署名は crypto で自前実装する。
function percentEncode(str) {
  return encodeURIComponent(str).replace(/[!*()']/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function oauth1Header({ method, url, consumerKey, consumerSecret, token, tokenSecret }) {
  const params = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: token,
    oauth_version: '1.0',
  };
  // 署名対象は「メソッド & URL & 辞書順に並べたパラメータ」。JSONボディは署名に含めない（仕様どおり）
  const paramString = Object.keys(params).sort()
    .map(k => `${percentEncode(k)}=${percentEncode(params[k])}`).join('&');
  const base = [method.toUpperCase(), percentEncode(url), percentEncode(paramString)].join('&');
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  params.oauth_signature = crypto.createHmac('sha1', signingKey).update(base).digest('base64');
  return 'OAuth ' + Object.keys(params).sort()
    .map(k => `${percentEncode(k)}="${percentEncode(params[k])}"`).join(', ');
}

async function postToX(text) {
  const consumerKey    = process.env.X_API_KEY;
  const consumerSecret = process.env.X_API_SECRET;
  const token          = process.env.X_ACCESS_TOKEN;
  const tokenSecret    = process.env.X_ACCESS_TOKEN_SECRET;
  if (!consumerKey || !consumerSecret || !token || !tokenSecret) {
    console.log('⏭️  X: 認証情報が未設定のためスキップ（docs/social-setup.md 参照）');
    return { skipped: true };
  }
  const url = 'https://api.x.com/2/tweets';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: oauth1Header({ method: 'POST', url, consumerKey, consumerSecret, token, tokenSecret }),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`X post failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  console.log(`✅ X posted: https://x.com/i/status/${data.data?.id}`);
  return data;
}

// ── Instagram ────────────────────────────────────────────────
// Graph API の Content Publishing。単体投稿は media→media_publish の2段、
// カルーセルは各画像を is_carousel_item で作ってから親コンテナにまとめる3段。
// 画像は公開HTTPSのURLからMetaが取りに来るため、GitHub Pages 上の実体を渡す。
async function igApi(path, params, token) {
  const res = await fetch(`https://graph.facebook.com/v21.0/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...params, access_token: token }).toString(),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(`Instagram API ${path}: ${JSON.stringify(data.error || data)}`);
  return data;
}

async function postToInstagram({ images, caption }) {
  const igUserId = process.env.IG_USER_ID;
  const token    = process.env.IG_ACCESS_TOKEN;
  if (!igUserId || !token) {
    console.log('⏭️  Instagram: 認証情報が未設定のためスキップ（docs/social-setup.md 参照）');
    return { skipped: true };
  }

  let creationId;
  if (images.length === 1) {
    const c = await igApi(`${igUserId}/media`, { image_url: MEDIA_BASE + images[0], caption }, token);
    creationId = c.id;
  } else {
    const children = [];
    for (const img of images) {
      const c = await igApi(`${igUserId}/media`, { image_url: MEDIA_BASE + img, is_carousel_item: 'true' }, token);
      children.push(c.id);
    }
    const parent = await igApi(`${igUserId}/media`,
      { media_type: 'CAROUSEL', children: children.join(','), caption }, token);
    creationId = parent.id;
  }

  // コンテナはMetaが画像を取得し終えるまで publish できない。数秒待って再試行する
  for (let i = 0; i < 6; i++) {
    try {
      const pub = await igApi(`${igUserId}/media_publish`, { creation_id: creationId }, token);
      console.log(`✅ Instagram posted: id=${pub.id}`);
      return pub;
    } catch (e) {
      if (i === 5) throw e;
      console.log(`   コンテナ準備待ち（${i + 1}/5）...`);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

function rotate(list) {
  // 週ごとに1つずつずらして使い回す（同じ文面が連続しないように）
  return list[Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)) % list.length];
}

async function main() {
  const platform = process.argv[2];
  const monthIndex = new Date().getMonth() % REDDIT_POSTS.length;

  if (platform === 'bluesky') {
    const post = rotate(BLUESKY_POSTS);
    if (DRY_RUN) return console.log(`--- [dry-run] Bluesky (${post.id}) ---\n${post.text}`);
    if (!process.env.BLUESKY_HANDLE || !process.env.BLUESKY_APP_PASSWORD) {
      return console.log('⏭️  Bluesky: 認証情報が未設定のためスキップ（docs/social-setup.md 参照）');
    }
    console.log(`Posting to Bluesky (${post.id})...`);
    const result = await postToBluesky(post.text);
    logPost({ platform: 'bluesky', contentId: post.id, gameSlug: post.gameSlug, uri: result?.uri });

  } else if (platform === 'reddit') {
    const target = REDDIT_POSTS[monthIndex];
    if (DRY_RUN) return console.log(`--- [dry-run] Reddit r/${target.subreddit} (${target.id}) ---\n${target.title}\n${SITE_URL}`);
    if (!process.env.REDDIT_CLIENT_ID || !process.env.REDDIT_CLIENT_SECRET) {
      return console.log('⏭️  Reddit: 認証情報が未設定のためスキップ（docs/social-setup.md 参照）');
    }
    console.log(`Posting to Reddit r/${target.subreddit} (${target.id})...`);
    const result = await postToReddit(target);
    logPost({ platform: 'reddit', contentId: target.id, subreddit: target.subreddit, redditId: result?.id, redditName: result?.name });

  } else if (platform === 'x') {
    const post = rotate(X_POSTS);
    // Xの上限は280「文字」。日本語は1文字=1カウント、URLは一律23文字として扱われる
    const weighted = post.text.replace(/https?:\/\/\S+/g, 'x'.repeat(23)).length;
    if (weighted > 280) throw new Error(`X post too long (${post.id}): ${weighted}/280 文字`);
    if (DRY_RUN) return console.log(`--- [dry-run] X (${post.id}, ${weighted}/280) ---\n${post.text}`);
    console.log(`Posting to X (${post.id}, ${weighted}/280 文字)...`);
    const result = await postToX(post.text);
    if (!result?.skipped) logPost({ platform: 'x', contentId: post.id, gameSlug: post.gameSlug, tweetId: result?.data?.id });

  } else if (platform === 'instagram') {
    const post = rotate(INSTAGRAM_POSTS);
    if (post.caption.length > 2200) throw new Error(`Instagram caption too long (${post.id}): ${post.caption.length}/2200`);
    if (DRY_RUN) {
      return console.log(`--- [dry-run] Instagram (${post.id}, ${post.caption.length}/2200, 画像${post.images.length}枚) ---\n`
        + post.images.map(i => MEDIA_BASE + i).join('\n') + `\n\n${post.caption}`);
    }
    console.log(`Posting to Instagram (${post.id}, 画像${post.images.length}枚)...`);
    const result = await postToInstagram(post);
    if (!result?.skipped) logPost({ platform: 'instagram', contentId: post.id, mediaId: result?.id });

  } else {
    console.error('Usage: node scripts/post-social.js <bluesky|reddit|x|instagram> [--dry-run]');
    process.exit(1);
  }
}

// 直接実行されたときだけ投稿する（検査スクリプトから require して部品を検証できるように）
if (require.main === module) {
  main().catch(err => { console.error('❌', err.message); process.exit(1); });
}

module.exports = {
  oauth1Header, percentEncode, MEDIA_BASE,
  X_POSTS, BLUESKY_POSTS, INSTAGRAM_POSTS, REDDIT_POSTS,
  X_POSTS_CORE, BLUESKY_POSTS_CORE,
  GAME_SPOTLIGHT_X, GAME_SPOTLIGHT_BLUESKY,
};
