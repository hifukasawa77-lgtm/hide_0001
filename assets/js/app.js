    /* ────────────────────────────────────────
       Canvas Background — コンステレーション
       オーブ(8) + スパーク(45) + 接続線
    ──────────────────────────────────────── */
    (function () {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      const canvas = document.getElementById('bg-canvas');
      const ctx = canvas.getContext('2d');

      // モバイルでは粒子数を抑え、O(n²)の接続線描画の負荷を下げる
      const isMobile = window.matchMedia('(max-width: 768px)').matches;
      const ORB_COUNT   = isMobile ? 4 : 8;
      const SPARK_COUNT = isMobile ? 18 : 45;
      const CONNECT_DIST = 120;

      const ORB_COLORS = [
        [249, 115,  22, 0.09],
        [168,  85, 247, 0.07],
        [ 14, 165, 233, 0.08],
        [251, 191,  36, 0.09],
        [244, 114, 182, 0.07],
      ];

      let W, H, particles = [];

      function resize() {
        W = canvas.width  = window.innerWidth;
        H = canvas.height = window.innerHeight;
      }

      function mkOrb() {
        const r = 80 + Math.random() * 150;
        const c = ORB_COLORS[Math.floor(Math.random() * ORB_COLORS.length)];
        return {
          type: 'orb',
          x: Math.random() * W, y: Math.random() * H,
          r, c,
          vx: (Math.random() - 0.5) * 0.14,
          vy: -(0.07 + Math.random() * 0.13),
          phase: Math.random() * Math.PI * 2,
          life: 0,
          maxLife: 450 + Math.random() * 550,
        };
      }

      function mkSpark() {
        return {
          type: 'spark',
          x: Math.random() * W, y: Math.random() * H,
          r: 1.4 + Math.random() * 2.2,
          vx: (Math.random() - 0.5) * 0.5,
          vy: -(0.12 + Math.random() * 0.32),
          life: 0,
          maxLife: 260 + Math.random() * 380,
          alpha: 0.28 + Math.random() * 0.35,
        };
      }

      function init() {
        resize();
        particles = [];
        for (let i = 0; i < ORB_COUNT;   i++) particles.push(mkOrb());
        for (let i = 0; i < SPARK_COUNT; i++) particles.push(mkSpark());
      }

      function fade(life, maxLife, ramp) {
        return Math.min(1, life / ramp) * Math.min(1, (maxLife - life) / ramp);
      }

      function draw() {
        ctx.clearRect(0, 0, W, H);

        const sparks = [];
        for (const p of particles) {
          if (p.type === 'orb') {
            const f = fade(p.life, p.maxLife, 60);
            const [r, g, b, a] = p.c;
            const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
            grd.addColorStop(0,   `rgba(${r},${g},${b},${(a * f * 0.85).toFixed(3)})`);
            grd.addColorStop(0.5, `rgba(${r},${g},${b},${(a * f * 0.35).toFixed(3)})`);
            grd.addColorStop(1,   `rgba(${r},${g},${b},0)`);
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = grd;
            ctx.fill();
            p.x += p.vx + Math.sin(p.life * 0.018 + p.phase) * 0.28;
            p.y += p.vy;
            p.life++;
            if (p.life > p.maxLife || p.y < -p.r * 2) Object.assign(p, mkOrb());
          } else {
            sparks.push(p);
          }
        }

        for (let i = 0; i < sparks.length; i++) {
          for (let j = i + 1; j < sparks.length; j++) {
            const dx = sparks[i].x - sparks[j].x;
            const dy = sparks[i].y - sparks[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < CONNECT_DIST) {
              const la = (1 - dist / CONNECT_DIST) * 0.07;
              ctx.beginPath();
              ctx.strokeStyle = `rgba(249,115,22,${la.toFixed(3)})`;
              ctx.lineWidth = 0.6;
              ctx.moveTo(sparks[i].x, sparks[i].y);
              ctx.lineTo(sparks[j].x, sparks[j].y);
              ctx.stroke();
            }
          }
        }

        for (const p of sparks) {
          const f = fade(p.life, p.maxLife, 30);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(249,115,22,${(p.alpha * f).toFixed(3)})`;
          ctx.fill();
          p.x += p.vx;
          p.y += p.vy;
          p.life++;
          if (p.life > p.maxLife || p.y < -10) Object.assign(p, mkSpark());
        }

        rafId = requestAnimationFrame(draw);
      }

      // タブ非表示時はアニメーションを停止してCPU/バッテリー消費を抑える
      let rafId = null;
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
        } else if (rafId === null) {
          rafId = requestAnimationFrame(draw);
        }
      });

      window.addEventListener('resize', resize);
      init();
      rafId = requestAnimationFrame(draw);
    })();

    /* ────────────────────────────────────────
       Typewriter effect
    ──────────────────────────────────────── */
    (function () {
      const el = document.getElementById('typewriter');
      const twCursor = document.getElementById('tw-cursor');
      const texts = ['三郷市在住の', '埼玉から発信する', 'ゆるく開発する'];
      let ti = 0, ci = 0, deleting = false;

      function tick() {
        const text = texts[ti];
        if (!deleting) {
          el.textContent = text.slice(0, ++ci);
          if (twCursor) twCursor.style.opacity = '1';
          if (ci === text.length) {
            deleting = true;
            setTimeout(tick, 1600);
            return;
          }
          setTimeout(tick, 80);
        } else {
          el.textContent = text.slice(0, --ci);
          if (twCursor) twCursor.style.opacity = '0.3';
          if (ci === 0) {
            deleting = false;
            ti = (ti + 1) % texts.length;
            if (twCursor) twCursor.style.opacity = '1';
            setTimeout(tick, 400);
            return;
          }
          setTimeout(tick, 40);
        }
      }
      tick();
    })();

    /* ────────────────────────────────────────
       Scroll reveal
    ──────────────────────────────────────── */
    (function () {
      function setup() {
        const items = document.querySelectorAll('.reveal');
        const io = new IntersectionObserver(
          (entries) => {
            entries.forEach((e, i) => {
              if (e.isIntersecting) {
                // stagger sibling cards
                const siblings = Array.from(e.target.parentElement.querySelectorAll('.reveal'));
                const idx = siblings.indexOf(e.target);
                setTimeout(() => e.target.classList.add('visible'), idx * 80);
                io.unobserve(e.target);
              }
            });
          },
          { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
        );
        items.forEach((el) => io.observe(el));
      }
      if ('requestIdleCallback' in window) {
        requestIdleCallback(setup, { timeout: 2000 });
      } else {
        setTimeout(setup, 1);
      }
    })();

    /* ────────────────────────────────────────
       Home dashboard widgets
    ──────────────────────────────────────── */
    (function () {
      const visitKpi = document.getElementById('home-visit-kpi');
      if (!visitKpi) return;

      const visitSub = document.getElementById('home-visit-sub');
      const weatherKpi = document.getElementById('home-weather-kpi');
      const weatherSub = document.getElementById('home-weather-sub');
      const weatherDetail = document.getElementById('home-weather-detail');
      const weatherTime = document.getElementById('home-weather-time');
      const fxList = document.getElementById('home-fx-list');
      const fxTime = document.getElementById('home-fx-time');
      const stockList = document.getElementById('home-stock-list');
      const stockRetryBtn = document.getElementById('home-stock-retry-btn');
      const stockForm = document.getElementById('home-stock-form');
      const stockInput = document.getElementById('home-stock-input');
      const stockCustomList = document.getElementById('home-stock-custom-list');
      const stockTime = document.getElementById('home-stock-time');
      const gasList = document.getElementById('home-gas-list');
      const gasTime = document.getElementById('home-gas-time');
      const updatesList = document.getElementById('home-updates-list');
      const todoForm = document.getElementById('home-todo-form');
      const todoInput = document.getElementById('home-todo-input');
      const todoVoiceBtn = document.getElementById('home-todo-voice');
      const todoPriority = document.getElementById('home-todo-priority');
      const todoSubmitBtn = document.getElementById('home-todo-submit');
      const todoList = document.getElementById('home-todo-list');
      const todoCount = document.getElementById('home-todo-count');
      const memoBox = document.getElementById('home-memo');
      const memoStatus = document.getElementById('home-memo-status');
      const memoVoiceBtn = document.getElementById('home-memo-voice');
      const voiceStatus = document.getElementById('home-voice-status');
      const memoToTodoBtn = document.getElementById('home-memo-to-todo');
      const calendarLabel = document.getElementById('home-calendar-label');
      const calendarToday = document.getElementById('home-calendar-today');
      const calendarGrid = document.getElementById('home-calendar-grid');
      const calPrevBtn = document.getElementById('cal-prev-btn');
      const calNextBtn = document.getElementById('cal-next-btn');
      let calendarOffset = 0; // 0=今月, -1=先月, +1=来月 ...
      const scheduleForm = document.getElementById('home-schedule-form');
      const scheduleDateInput = document.getElementById('home-schedule-date');
      const scheduleTextInput = document.getElementById('home-schedule-text');
      const scheduleList = document.getElementById('home-schedule-list');
      const gcalSyncBtn = document.getElementById('gcal-sync-btn');
      const gcalSyncStatus = document.getElementById('gcal-sync-status');

      const TODO_KEY = 'dashboard-todos';
      const MEMO_KEY = 'dashboard-memo';
      const MEMO_SAVED_KEY = 'dashboard-memo-saved-at';

      // ユーザーごとに固有のIDをCookieで管理し、予定データを分離する
      function getOrCreateUserId() {
        const match = document.cookie.split('; ').find(r => r.startsWith('_sched_uid='));
        if (match) return match.split('=')[1];
        const uid = ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
          (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
        const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
        document.cookie = `_sched_uid=${uid}; expires=${expires}; path=/; SameSite=Strict; Secure`;
        return uid;
      }

      const SCHEDULE_KEY = 'dashboard-schedules-' + getOrCreateUserId();
      const VISIT_KEY = 'home-dashboard-visit';
      // Google Cloud Console で発行した OAuth 2.0 クライアントID に差し替えてください
      // 許可オリジン: https://hifukasawa77-lgtm.github.io
      const GCAL_CLIENT_ID = '601000685632-fdusp854qdtm2hlkjagq7t75q32f52t1.apps.googleusercontent.com';
      const STOCK_SNAPSHOT_KEY = 'dashboard-stock-snapshot';
      const CUSTOM_STOCKS_KEY = 'dashboard-custom-stocks';
      const STOCK_CHART_CACHE_PREFIX = 'dashboard-stock-chart-';
      const STOCK_CHART_CACHE_TTL = 30 * 60 * 1000;
      const STOCK_QUOTE_CACHE_TTL = 15 * 60 * 1000;
      let activeChartSymbol = null;
      let activeChartName = '';
      let activeChartRange = '1mo';
      const GAS_SNAPSHOT_KEY = 'dashboard-gas-snapshot-v2';

      const updateItems = [
        { date: '2026-05-11', text: 'ニュースフィード・よく使うリンクカードを追加', link: '#dashboard' },
        { date: '2026-04-16', text: '三郷市グルメまとめページを公開', link: 'misato-gourmet.html' },
        { date: '2026-04-16', text: 'ホームに14機能ダッシュボードを追加', link: '#dashboard' },
        { date: '2026-04-15', text: '地震・防災情報・電車遅延カードを追加', link: '#dashboard' },
      ];

      const weatherMap = {
        0: ['☀️', '快晴'],
        1: ['🌤', 'ほぼ晴れ'],
        2: ['⛅', '一部曇り'],
        3: ['☁️', '曇り'],
        45: ['🌫', '霧'],
        48: ['🌫', '霧'],
        51: ['🌦', '小雨'],
        53: ['🌦', '雨'],
        55: ['🌧', '強雨'],
        61: ['🌧', '弱雨'],
        63: ['🌧', '雨'],
        65: ['🌧', '強雨'],
        71: ['🌨', '小雪'],
        73: ['🌨', '雪'],
        75: ['❄️', '大雪'],
        80: ['🌦', 'にわか雨'],
        81: ['🌦', '雨'],
        82: ['⛈', '雷雨'],
        95: ['⛈', '雷雨'],
        96: ['⛈', '雷雨'],
        99: ['⛈', '激しい雷雨'],
      };

      function weatherCodeToIcon(code, hour) {
        const isNight = typeof hour === 'number' && (hour < 6 || hour >= 19);
        const b = 'assets/weather/';
        if (code === 0) return b + (isNight ? 'clear-night.svg' : 'clear-day.svg');
        if (code <= 2) return b + (isNight ? 'partly-cloudy-night.svg' : 'partly-cloudy-day.svg');
        if (code <= 3) return b + 'cloudy.svg';
        if (code <= 48) return b + 'fog.svg';
        if (code <= 57) return b + 'drizzle.svg';
        if (code <= 63) return b + 'rain.svg';
        if (code <= 67) return b + 'heavy-rain.svg';
        if (code <= 77) return b + 'snow.svg';
        if (code <= 81) return b + 'rain.svg';
        if (code <= 82) return b + 'heavy-rain.svg';
        if (code <= 86) return b + 'snow.svg';
        if (code <= 94) return b + 'thunderstorms.svg';
        return b + 'thunderstorms-rain.svg';
      }

      function fetchWithTimeout(url, timeoutMs, options) {
        const ctrl = new AbortController();
        const id = setTimeout(() => ctrl.abort(), timeoutMs || 7000);
        return fetch(url, Object.assign({}, options || {}, { signal: ctrl.signal })).finally(() => clearTimeout(id));
      }

      function fmtNum(n, digits) {
        if (n == null || Number.isNaN(Number(n))) return '—';
        return Number(n).toLocaleString('ja-JP', { maximumFractionDigits: digits == null ? 0 : digits });
      }

      function escHtml(s) {
        return String(s)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      function toDateKey(dateObj) {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }

      function incrementLocalVisit() {
        const today = toDateKey(new Date());
        const saved = JSON.parse(localStorage.getItem(VISIT_KEY) || '{}');
        // Weekly history: keep last 7 days
        const history = Array.isArray(saved.weeklyHistory) ? saved.weeklyHistory : [];
        const todayIdx = history.findIndex(e => e.date === today);
        if (todayIdx >= 0) { history[todayIdx].count += 1; } else { history.push({ date: today, count: 1 }); }
        const cutoff = toDateKey(new Date(Date.now() - 6 * 86400000));
        const trimmed = history.filter(e => e.date >= cutoff).sort((a, b) => a.date < b.date ? -1 : 1);
        const yesterdayKey = toDateKey(new Date(Date.now() - 86400000));
        let next;
        if (saved.date === today) {
          next = { date: today, todayCount: (saved.todayCount || 0) + 1, total: (saved.total || 0) + 1, yesterday: saved.yesterday != null ? saved.yesterday : 0, weeklyHistory: trimmed };
        } else {
          next = { date: today, todayCount: 1, total: (saved.total || 0) + 1, yesterday: saved.date === yesterdayKey ? (saved.todayCount || 0) : 0, weeklyHistory: trimmed };
        }
        localStorage.setItem(VISIT_KEY, JSON.stringify(next));
        return next;
      }

      // E: count-up animation
      function animateCount(el, target, onComplete) {
        const duration = 1200;
        const start = performance.now();
        el.textContent = '0 回';
        function step(now) {
          const t = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          el.textContent = fmtNum(Math.round(eased * target)) + ' 回';
          if (t < 1) { requestAnimationFrame(step); } else if (onComplete) { onComplete(); }
        }
        requestAnimationFrame(step);
      }

      // G: weekly sparkline SVG bar chart
      function renderVisitSparkline(history) {
        if (!history || history.length === 0) return '';
        const today = toDateKey(new Date());
        const maxC = Math.max(...history.map(e => e.count), 1);
        const n = history.length, vw = 116, vh = 28;
        const bw = Math.max(4, Math.floor((vw - (n - 1) * 2) / n));
        const bars = history.map((e, i) => {
          const bh = Math.max(3, Math.round((e.count / maxC) * vh));
          const x = i * (bw + 2), y = vh - bh;
          const fill = e.date === today ? 'var(--blue)' : 'rgba(14,165,233,0.4)';
          const [, mo, da] = e.date.split('-');
          return '<rect x="' + x + '" y="' + y + '" width="' + bw + '" height="' + bh + '" rx="2" fill="' + fill + '"><title>' + parseInt(mo) + '/' + parseInt(da) + ': ' + e.count + '回</title></rect>';
        }).join('');
        return '<svg viewBox="0 0 ' + vw + ' ' + vh + '" width="' + vw + '" height="' + vh + '" style="display:block">' + bars + '</svg>';
      }

      async function initVisitCard() {
        const local = incrementLocalVisit();
        let total = local.total;
        try {
          const res = await fetchWithTimeout('https://api.countapi.xyz/get/hide-fukasawa-dashboard/visits', 5000);
          if (res.ok) {
            const data = await res.json();
            if (typeof data.value === 'number') total = data.value;
          }
        } catch (e) { /* Fallback to local-only count. */ }
        visitSub.textContent = `本日のアクセス: ${fmtNum(local.todayCount)} 回`;
        // F: yesterday comparison
        const trendEl = document.getElementById('home-visit-trend');
        if (trendEl && local.yesterday > 0) {
          const diff = local.todayCount - local.yesterday;
          const sign = diff > 0 ? '+' : '';
          const arrow = diff > 0 ? '↑' : diff < 0 ? '↓' : '→';
          const color = diff > 0 ? 'var(--green)' : diff < 0 ? '#ef4444' : 'var(--muted)';
          trendEl.innerHTML = '<span style="color:' + color + ';font-weight:600">昨日比 ' + sign + escHtml(fmtNum(diff)) + ' ' + arrow + '</span>';
        }
        // G: sparkline
        const sparkEl = document.getElementById('home-visit-sparkline');
        if (sparkEl) sparkEl.innerHTML = renderVisitSparkline(local.weeklyHistory);
        // E: count-up + H: milestone
        animateCount(visitKpi, total, function() {
          const milestones = [
            { min: 10000, color: 'var(--orange)', label: '🏆 10,000回！' },
            { min: 1000,  color: 'var(--orange)', label: '🏆 1,000回！' },
            { min: 500,   color: 'var(--purple)', label: '⭐ 500回！' },
            { min: 100,   color: 'var(--green)',  label: '🎉 100回！' },
          ];
          const ms = milestones.find(m => total >= m.min);
          if (ms) {
            visitKpi.style.color = ms.color;
            const badge = document.createElement('span');
            badge.style.cssText = 'font-size:0.65rem;border-radius:8px;padding:1px 6px;background:rgba(0,0,0,0.06);margin-left:6px;font-weight:600;vertical-align:middle';
            badge.textContent = ms.label;
            visitKpi.appendChild(badge);
          }
        });
      }

      function renderUpdates() {
        updatesList.innerHTML = updateItems.map((item) => `
          <li class="dashboard-mini-item col">
            <small>${item.date}</small>
            <span>${escHtml(item.text)}</span>
            <a class="dash-open-link" href="${/^(https?:|\/|#)/i.test(item.link) ? item.link : '#'}">開く →</a>
          </li>`).join('');
      }

      // ── ゲーム履歴カード ────────────────────────────────────────────
      (function() {
        const GAME_HISTORY_KEY = 'game-score-history-v1';
        const ICONS  = { win:'🏆', lose:'💔', clear:'⭐', gameover:'💀', draw:'🤝' };
        const LABELS_JA = { win:'勝利', lose:'敗北', clear:'クリア', gameover:'ゲームオーバー', draw:'引き分け' };
        const LABELS_EN = { win:'Win', lose:'Lose', clear:'Clear', gameover:'Game Over', draw:'Draw' };

        function fmt(iso) {
          const d = new Date(iso);
          return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        }

        function renderGameHistory() {
          const el = document.getElementById('home-game-history-list');
          if (!el) return;
          const lang = localStorage.getItem('site-lang') === 'en' ? 'en' : 'ja';
          let history = [];
          try { history = JSON.parse(localStorage.getItem(GAME_HISTORY_KEY) || '[]'); } catch {}
          if (!history.length) {
            el.innerHTML = `<li class="game-history-item"><span style="color:var(--muted)">${lang==='en'?'No play history yet':'まだプレイ履歴がありません'}</span></li>`;
            return;
          }
          const labels = lang === 'en' ? LABELS_EN : LABELS_JA;
          el.innerHTML = history.slice(0, 10).map(h => {
            const icon = ICONS[h.result] || '🎮';
            const cls  = h.result || 'draw';
            const sc   = h.score != null ? `<small>${Number(h.score).toLocaleString()}pt</small>` : '';
            return `<li class="game-history-item">
              <span>${icon}</span>
              <span class="gh-name">${escHtml(h.game)}</span>
              ${sc}
              <span class="game-history-badge ${escHtml(cls)}">${escHtml(labels[cls] || cls)}</span>
              <small style="white-space:nowrap">${fmt(h.timestamp)}</small>
            </li>`;
          }).join('');
        }

        const clearBtn = document.getElementById('home-game-history-clear');
        if (clearBtn) {
          clearBtn.addEventListener('click', () => {
            if (!confirm('ゲーム履歴を消去しますか？')) return;
            localStorage.removeItem(GAME_HISTORY_KEY);
            renderGameHistory();
          });
        }

        window.addEventListener('storage', e => { if (e.key === GAME_HISTORY_KEY) renderGameHistory(); });
        renderGameHistory();
      })();

      function getWindDirLabel(deg) {
        const dirs = ['北','北北東','北東','東北東','東','東南東','南東','南南東','南','南南西','南西','西南西','西','西北西','北西','北北西'];
        return dirs[Math.round(deg / 22.5) % 16];
      }

      function drawWindCompass(containerId, direction, speed) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const size = 96;
        const cx = size / 2, cy = size / 2, r = size / 2 - 5;
        // 気象学的風向（どこから吹いてくるか）→ 矢印は吹いてくる方向を指す
        const rad = (direction - 90) * Math.PI / 180;
        const arrowLen = r * 0.58;
        const tx = cx + Math.cos(rad) * arrowLen;
        const ty = cy + Math.sin(rad) * arrowLen;
        const bx = cx - Math.cos(rad) * arrowLen * 0.45;
        const by = cy - Math.sin(rad) * arrowLen * 0.45;
        const perpX = -Math.sin(rad) * 5;
        const perpY = Math.cos(rad) * 5;

        const cardinals = [
          { label: 'N', a: -90 }, { label: 'E', a: 0 },
          { label: 'S', a: 90 }, { label: 'W', a: 180 },
        ];
        const ticksHtml = cardinals.map(({ label, a }) => {
          const tr = a * Math.PI / 180;
          const lx = cx + Math.cos(tr) * (r - 3);
          const ly = cy + Math.sin(tr) * (r - 3);
          return `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" fill="#00e5ff" font-size="8" font-weight="700" font-family="sans-serif">${label}</text>`;
        }).join('');

        // 目盛り（8方位の短い線）
        const tickLines = Array.from({ length: 8 }, (_, i) => {
          const a = (i * 45 - 90) * Math.PI / 180;
          const x1 = cx + Math.cos(a) * (r - 1);
          const y1 = cy + Math.sin(a) * (r - 1);
          const x2 = cx + Math.cos(a) * (r - 6);
          const y2 = cy + Math.sin(a) * (r - 6);
          return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(0,229,255,0.3)" stroke-width="1"/>`;
        }).join('');

        container.innerHTML = `
          <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
            <circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(0,229,255,0.04)" stroke="rgba(0,229,255,0.2)" stroke-width="1.5"/>
            <circle cx="${cx}" cy="${cy}" r="${r * 0.55}" fill="none" stroke="rgba(0,229,255,0.1)" stroke-width="1"/>
            ${tickLines}
            ${ticksHtml}
            <line x1="${bx}" y1="${by}" x2="${tx}" y2="${ty}" stroke="#00e5ff" stroke-width="2.5" stroke-linecap="round" opacity="0.9"/>
            <polygon points="${tx},${ty} ${bx + perpX},${by + perpY} ${bx - perpX},${by - perpY}" fill="#00e5ff" opacity="0.9"/>
            <circle cx="${cx}" cy="${cy}" r="3" fill="#00e5ff" opacity="0.6"/>
          </svg>
          <div style="font-size:0.68rem;color:var(--muted);text-align:center;margin-top:2px;line-height:1.4">
            ${getWindDirLabel(direction)}から<br>${fmtNum(speed, 1)}m/s
          </div>`;
      }

      function drawTempChart(canvasId, hours, temps, nowHour, humidities, weatherCodes) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || temps.length < 2) return;
        const dpr = window.devicePixelRatio || 1;
        const W = canvas.offsetWidth || 260;
        const H = canvas.offsetHeight || 115;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        const hasIcons = Array.isArray(weatherCodes) && weatherCodes.length > 0;
        const pad = { top: 18, bottom: hasIcons ? 40 : 22, left: 30, right: 10 };
        const iconCache = {};
        const cW = W - pad.left - pad.right;
        const cH = H - pad.top - pad.bottom;
        const n = temps.length;
        const minT = Math.min(...temps) - 1;
        const maxT = Math.max(...temps) + 1;
        const xOf = i => pad.left + (i / (n - 1)) * cW;
        const yOf = t => pad.top + (1 - (t - minT) / (maxT - minT)) * cH;
        const nowIdx = hours.indexOf(nowHour);

        function drawBase(hoverIdx) {
          ctx.clearRect(0, 0, W, H);

          // 現在時刻ライン
          if (nowIdx >= 0) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255,100,200,0.5)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(xOf(nowIdx), pad.top);
            ctx.lineTo(xOf(nowIdx), pad.top + cH);
            ctx.stroke();
            ctx.restore();
          }

          // グラデーション塗りつぶし
          const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + cH);
          grad.addColorStop(0, 'rgba(0,229,255,0.25)');
          grad.addColorStop(1, 'rgba(0,229,255,0)');
          ctx.beginPath();
          ctx.moveTo(xOf(0), yOf(temps[0]));
          for (let i = 1; i < n; i++) {
            const cpx = (xOf(i - 1) + xOf(i)) / 2;
            ctx.bezierCurveTo(cpx, yOf(temps[i - 1]), cpx, yOf(temps[i]), xOf(i), yOf(temps[i]));
          }
          ctx.lineTo(xOf(n - 1), pad.top + cH);
          ctx.lineTo(xOf(0), pad.top + cH);
          ctx.closePath();
          ctx.fillStyle = grad;
          ctx.fill();

          // 折れ線
          ctx.beginPath();
          ctx.moveTo(xOf(0), yOf(temps[0]));
          for (let i = 1; i < n; i++) {
            const cpx = (xOf(i - 1) + xOf(i)) / 2;
            ctx.bezierCurveTo(cpx, yOf(temps[i - 1]), cpx, yOf(temps[i]), xOf(i), yOf(temps[i]));
          }
          ctx.strokeStyle = '#00e5ff';
          ctx.lineWidth = 2;
          ctx.stroke();

          // ラベル（3時間ごと）
          ctx.font = '8px sans-serif';
          ctx.textAlign = 'center';
          for (let i = 0; i < n; i++) {
            if (hours[i] % 3 !== 0) continue;
            const x = xOf(i);
            const y = yOf(temps[i]);
            ctx.fillStyle = '#00e5ff';
            ctx.fillText(`${Math.round(temps[i])}°`, x, y - 5);
            const labelY = pad.top + cH + 14;
            ctx.fillStyle = 'rgba(120,140,160,0.85)';
            ctx.fillText(`${hours[i]}時`, x, labelY);
            if (hasIcons && weatherCodes[i] != null) {
              const src = weatherCodeToIcon(weatherCodes[i], hours[i]);
              const img = iconCache[src];
              if (img && img.complete && img.naturalWidth > 0) {
                ctx.drawImage(img, x - 8, pad.top + cH + 18, 16, 16);
              }
            }
          }

          // Y軸最高最低
          ctx.textAlign = 'right';
          ctx.fillStyle = 'rgba(120,140,160,0.7)';
          ctx.fillText(`${Math.round(maxT)}°`, pad.left - 2, pad.top + 6);
          ctx.fillText(`${Math.round(minT)}°`, pad.left - 2, pad.top + cH);

          // ホバー縦線 + ドット
          if (hoverIdx != null) {
            ctx.save();
            ctx.strokeStyle = 'rgba(0,229,255,0.6)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(xOf(hoverIdx), pad.top);
            ctx.lineTo(xOf(hoverIdx), pad.top + cH);
            ctx.stroke();
            ctx.restore();
            ctx.beginPath();
            ctx.arc(xOf(hoverIdx), yOf(temps[hoverIdx]), 3.5, 0, Math.PI * 2);
            ctx.fillStyle = '#00e5ff';
            ctx.fill();
          }
        }

        drawBase(null);

        // Preload weather icons and redraw once loaded
        if (hasIcons) {
          const needed = new Set();
          for (let i = 0; i < hours.length; i++) {
            if (hours[i] % 3 === 0 && weatherCodes[i] != null) {
              needed.add(weatherCodeToIcon(weatherCodes[i], hours[i]));
            }
          }
          let pending = needed.size;
          if (pending === 0) { drawBase(null); }
          else {
            for (const src of needed) {
              const img = new Image();
              iconCache[src] = img;
              img.onload = img.onerror = () => { if (--pending === 0) drawBase(null); };
              img.src = src;
            }
          }
        }

        let tip = document.getElementById('stock-hover-tip');
        if (!tip) {
          tip = document.createElement('div');
          tip.id = 'stock-hover-tip';
          document.body.appendChild(tip);
        }

        canvas._hoverCleanup?.();

        function getXY(e) {
          return e.touches ? [e.touches[0].clientX, e.touches[0].clientY] : [e.clientX, e.clientY];
        }

        function onMove(e) {
          const rect = canvas.getBoundingClientRect();
          const [cx, cy] = getXY(e);
          const idx = Math.max(0, Math.min(n - 1, Math.round((cx - rect.left - pad.left) / cW * (n - 1))));
          drawBase(idx);

          const hum = humidities?.[idx];
          const humStr = hum != null ? `<div>💧 湿度: <b>${Math.round(hum)}%</b></div>` : '';
          tip.innerHTML =
            `<div class="sht-date">${hours[idx]}時</div>` +
            `<div>🌡 気温: <b>${Math.round(temps[idx])}°C</b></div>` +
            humStr;

          const tipW = 140;
          const left = cx + 14 + tipW > window.innerWidth ? cx - tipW - 14 : cx + 14;
          tip.style.left = left + 'px';
          tip.style.top = Math.max(8, cy - 60) + 'px';
          tip.style.display = 'block';
        }

        function onLeave() {
          drawBase(null);
          if (tip) tip.style.display = 'none';
        }

        canvas.addEventListener('mousemove', onMove);
        canvas.addEventListener('mouseleave', onLeave);
        canvas.addEventListener('touchmove', onMove, { passive: true });
        canvas.addEventListener('touchend', onLeave);

        canvas._hoverCleanup = () => {
          canvas.removeEventListener('mousemove', onMove);
          canvas.removeEventListener('mouseleave', onLeave);
          canvas.removeEventListener('touchmove', onMove);
          canvas.removeEventListener('touchend', onLeave);
        };
      }

      // ── 現在地 → 市区町村コード/名称（国土地理院 + 統計ダッシュボードAPI）──
      // 座標は小数点2桁（約1km精度）に丸めてキャッシュ。
      const DASHBOARD_LOC_KEY = 'dashboard-location-v2';
      const DASHBOARD_LOC_TTL = 30 * 60 * 1000; // 30分

      function extractStatRegionName(data) {
        const objs = data?.GET_META_REGION_INF?.METADATA_INF?.CLASS_INF?.CLASS_OBJ;
        const arr = Array.isArray(objs) ? objs : (objs ? [objs] : []);
        for (const obj of arr) {
          const cls = obj?.CLASS;
          const rows = Array.isArray(cls) ? cls : (cls ? [cls] : []);
          const active = rows.find(row => row?.['@name']);
          if (active) {
            return {
              city: active['@name'],
              prefecture: obj?.['@name'] || '',
              level: active['@level'] || ''
            };
          }
        }
        return { city: '', prefecture: '', level: '' };
      }

      async function getRegionNameFromCode(muniCd) {
        const url = 'https://dashboard.e-stat.go.jp/api/1.0/Json/getRegionInfo?Lang=JP&RegionCode=' + encodeURIComponent(muniCd);
        const data = await fetchWithTimeout(url, 7000).then(r => {
          if (!r.ok) throw new Error('region-info');
          return r.json();
        });
        return extractStatRegionName(data);
      }

      async function detectDashboardArea(forceRefresh) {
        if (forceRefresh) {
          try { localStorage.removeItem(DASHBOARD_LOC_KEY); } catch {}
        }
        try {
          const c = JSON.parse(localStorage.getItem(DASHBOARD_LOC_KEY) || 'null');
          if (!forceRefresh && c && Date.now() - c.ts < DASHBOARD_LOC_TTL
              && c.city && /^\d{5}$/.test(String(c.muniCd || ''))) return c;
        } catch {}
        const pos = await new Promise((resolve, reject) =>
          navigator.geolocation
            ? navigator.geolocation.getCurrentPosition(resolve, reject, {
                timeout: 12000, maximumAge: 300000, enableHighAccuracy: false
              })
            : reject(new Error('unsupported'))
        );
        const { latitude: lat, longitude: lon } = pos.coords;
        const gsiData = await fetchWithTimeout(
          `https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lat=${lat}&lon=${lon}`,
          6000
        ).then(r => r.json());
        const muniCd = String(gsiData?.results?.muniCd || '').trim();
        if (!/^\d{5}$/.test(muniCd)) throw new Error('gsi-no-muni');
        const region = await getRegionNameFromCode(muniCd);
        const city = region.city || `エリア${muniCd}`;
        const result = {
          lat: Math.round(lat * 100) / 100,
          lon: Math.round(lon * 100) / 100,
          muniCd,
          city,
          prefecture: region.prefecture || '',
          ts: Date.now()
        };
        try { localStorage.setItem(DASHBOARD_LOC_KEY, JSON.stringify(result)); } catch {}
        return result;
      }

      async function getWeatherLocation() {
        return detectDashboardArea(false);
      }

      window.toggleWeatherRadar = function() {
        const wrap = document.getElementById('home-weather-radar-wrap');
        const btn  = document.getElementById('home-weather-radar-btn');
        const mapDiv = document.getElementById('home-weather-radar');
        if (!wrap) return;
        const opening = wrap.style.display === 'none';
        wrap.style.display = opening ? 'block' : 'none';
        if (btn) btn.textContent = opening ? '× レーダーを閉じる' : '🌧 雨雲レーダー';

        if (opening && mapDiv && !mapDiv._radarInitialized) {
          const loc = window._weatherLatLon || { lat: 35.83, lon: 139.87 };
          const iframe = document.createElement('iframe');
          iframe.src = `https://embed.windy.com/embed2.html?lat=${loc.lat}&lon=${loc.lon}&detailLat=${loc.lat}&detailLon=${loc.lon}&zoom=9&level=surface&overlay=rain&product=ecmwf&menu=&message=&marker=&calendar=now&pressure=&type=map&location=coordinates&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1`;
          iframe.style.cssText = 'width:100%;height:100%;border:none';
          iframe.loading = 'lazy';
          iframe.allowFullscreen = true;
          mapDiv.innerHTML = '';
          mapDiv.appendChild(iframe);
          mapDiv._radarInitialized = true;
        }
      };

      async function initWeatherCard() {
        let lat = 35.83, lon = 139.87, city = '三郷市', muniCd = '';
        try {
          const loc = await getWeatherLocation();
          lat = loc.lat; lon = loc.lon; city = loc.city; muniCd = loc.muniCd || '';
        } catch {}
        const titleEl = document.getElementById('home-weather-city-title');
        if (titleEl) titleEl.textContent = `🌤 ${city}の天気`;
        window._weatherLatLon = { lat, lon };
        const radarBtn = document.getElementById('home-weather-radar-btn');
        if (radarBtn) radarBtn.style.display = '';
        window.dispatchEvent(new CustomEvent('dashboard-location-updated', { detail: { city } }));

        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
          + '&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m,wind_direction_10m,uv_index,surface_pressure'
          + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max'
          + '&hourly=temperature_2m,relative_humidity_2m,weather_code'
          + '&timezone=Asia%2FTokyo&forecast_days=7';
        try {
          const res = await fetchWithTimeout(url, 8000);
          if (!res.ok) throw new Error('weather');
          const data = await res.json();
          const code = data.current.weather_code;
          const temp = Math.round(data.current.temperature_2m);
          const humidity = Math.round(data.current.relative_humidity_2m);
          const windSpeed = Number(data.current.wind_speed_10m || 0);
          const windDir = Number(data.current.wind_direction_10m ?? 0);
          const uvIndex = Number(data.current.uv_index ?? 0);
          const pressure = Math.round(data.current.surface_pressure ?? 0);
          const pair = weatherMap[code] || ['🌡', '不明'];
          const wIconSrc = weatherCodeToIcon(code, new Date().getHours());
          weatherKpi.innerHTML = `<img src="${wIconSrc}" alt="${escHtml(pair[1])}" style="width:2.2rem;height:2.2rem;vertical-align:middle;margin-right:4px">${temp}°C`;
          weatherSub.textContent = `${pair[1]} / 湿度 ${humidity}% / 風速 ${fmtNum(windSpeed, 1)}m/s`;

          const tomorrowCode = data.daily?.weather_code?.[1];
          const tomorrowMax = data.daily?.temperature_2m_max?.[1];
          const tomorrowMin = data.daily?.temperature_2m_min?.[1];
          const tomorrowRainProb = data.daily?.precipitation_probability_max?.[1];
          const tomorrowPair = weatherMap[tomorrowCode] || ['🌡', '不明'];
          const tomorrowMaxNum = Number.isFinite(Number(tomorrowMax)) ? Number(tomorrowMax) : temp;
          const tomorrowMinNum = Number.isFinite(Number(tomorrowMin)) ? Number(tomorrowMin) : temp - 3;

          const pollen = await getPollenForecast({
            lat, lon, muniCd,
            humidity,
            wind: windSpeed,
            tomorrowMax: tomorrowMaxNum,
            tomorrowWeatherCode: Number(tomorrowCode || code),
            tomorrowRainProb: Number(tomorrowRainProb || 0),
          });

          const tomorrowIconSrc = weatherCodeToIcon(Number(tomorrowCode ?? code), 12);
          weatherDetail.innerHTML = `
            <li class="dashboard-mini-item"><span>明日の天気</span><small><img src="${tomorrowIconSrc}" alt="${tomorrowPair[1]}" style="width:1rem;height:1rem;vertical-align:middle;margin-right:2px">${Math.round(tomorrowMaxNum)}° / ${Math.round(tomorrowMinNum)}° (${tomorrowPair[1]})</small></li>
          `;

          // 風向コンパス描画
          drawWindCompass('home-weather-compass', windDir, windSpeed);

          // 紫外線・気圧表示
          const uvLabel = uvIndex <= 2 ? '低い' : uvIndex <= 5 ? 'やや強い' : uvIndex <= 7 ? '強い' : uvIndex <= 10 ? '非常に強い' : '危険';
          document.getElementById('home-weather-uvpress').innerHTML = `
            <div class="weather-uvpress-item"><span>🌞 紫外線</span><small>${fmtNum(uvIndex, 1)} <strong>(${uvLabel})</strong></small></div>
            <div class="weather-uvpress-item"><span>🌬 気圧</span><small>${pressure} <strong>hPa</strong></small></div>
          `;

          // 生活指数
          const todayRainProb = data.daily?.precipitation_probability_max?.[0] ?? 0;
          const heatStroke = calcHeatStrokeIndex(temp, humidity, uvIndex);
          const laundry = calcLaundryIndex(temp, humidity, windSpeed, todayRainProb);
          document.getElementById('home-weather-indices').innerHTML = `
            <div class="weather-indices-title">🌈 生活指数</div>
            <div class="weather-indices-grid">
              <div class="weather-index-item"><div class="wi-name">🥵 熱中症</div><div class="wi-val">${escHtml(heatStroke)}</div></div>
              <div class="weather-index-item"><div class="wi-name">👕 洗濯物</div><div class="wi-val">${escHtml(laundry)}</div></div>
              <div class="weather-index-item"><div class="wi-name">☀️ 紫外線</div><div class="wi-val">${escHtml(uvLabel)}</div></div>
              <div class="weather-index-item"><div class="wi-name">🌸 花粉</div><div class="wi-val" title="${escHtml(pollen.source)}">${escHtml(pollen.label)}</div></div>
            </div>
            <div class="local-pop-source">花粉 出典: ${escHtml(pollen.source)}</div>
          `;

          // 時間別気温グラフ描画
          if (data.hourly?.time && data.hourly?.temperature_2m) {
            const nowHour = new Date().getHours();
            const todayPrefix = data.hourly.time[0].slice(0, 10); // "YYYY-MM-DD"
            const startIdx = data.hourly.time.findIndex(t => t.startsWith(todayPrefix) && parseInt(t.slice(11, 13)) === 0);
            const idx = startIdx >= 0 ? startIdx : 0;
            const hourTemps = data.hourly.temperature_2m.slice(idx, idx + 24);
            const hourHumidities = (data.hourly.relative_humidity_2m || []).slice(idx, idx + 24);
            const hourWeatherCodes = (data.hourly.weather_code || []).slice(idx, idx + 24);
            const hourLabels = data.hourly.time.slice(idx, idx + 24).map(t => parseInt(t.slice(11, 13)));
            drawTempChart('home-weather-tempchart', hourLabels, hourTemps, nowHour, hourHumidities, hourWeatherCodes);
          }

          document.getElementById('home-weather-visuals').style.display = '';

          // 週間天気予報（7日分）
          if (data.daily?.time?.length) {
            const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];
            const weeklyItems = data.daily.time.map((dateStr, i) => {
              const dt = new Date(dateStr);
              let label;
              if (i === 0) label = '今日';
              else if (i === 1) label = '明日';
              else label = WEEKDAYS_JA[dt.getDay()] + '曜';
              const wCode = data.daily.weather_code?.[i] ?? 0;
              const wPair = weatherMap[wCode] || ['🌡', ''];
              const wIconDay = weatherCodeToIcon(wCode, 12);
              const maxT = Math.round(data.daily.temperature_2m_max?.[i] ?? 0);
              const minT = Math.round(data.daily.temperature_2m_min?.[i] ?? 0);
              const rainP = Math.round((data.daily.precipitation_probability_max?.[i] ?? 0) / 10) * 10;
              return `<div class="weather-day-item">
                <div class="wd-label">${label}</div>
                <div class="wd-icon"><img src="${wIconDay}" alt="${wPair[1]}" style="width:1.6rem;height:1.6rem"></div>
                <div class="wd-temp">${maxT}°/<span class="wd-min">${minT}°</span></div>
                <div class="wd-rain">💧${rainP}%</div>
              </div>`;
            }).join('');
            const weeklyEl = document.getElementById('home-weather-weekly');
            weeklyEl.innerHTML = `<div class="weather-weekly-title">📅 週間天気予報</div><div class="weather-weekly-grid">${weeklyItems}</div>`;
            weeklyEl.style.display = '';
          }

          weatherTime.textContent = `更新: ${new Date().toLocaleTimeString('ja-JP')}`;
        } catch (e) {
          weatherKpi.textContent = '取得失敗';
          weatherSub.textContent = '時間をおいて再読み込みしてください。';
          weatherDetail.innerHTML = '<li class="dashboard-mini-item"><span>天気詳細の取得に失敗しました</span></li>';
          weatherTime.textContent = '更新時刻: 取得失敗';
        }
      }

      function calcHeatStrokeIndex(temp, humidity, uv) {
        const e = (humidity / 100) * 6.105 * Math.exp(17.27 * temp / (237.3 + temp));
        const wbgt = 0.567 * temp + 0.393 * e + 3.94 + 0.1 * uv;
        if (wbgt >= 31) return '危険';
        if (wbgt >= 28) return '厳重警戒';
        if (wbgt >= 25) return '警戒';
        if (wbgt >= 21) return '注意';
        return 'ほぼ安全';
      }

      function calcLaundryIndex(temp, humidity, windSpeed, rainProb) {
        const tempScore  = Math.max(0, Math.min(40, (temp - 10) * 2));
        const humScore   = Math.max(0, Math.min(40, 100 - humidity));
        const windScore  = Math.min(15, windSpeed * 3);
        const score = Math.max(0, Math.min(100, tempScore + humScore + windScore - rainProb * 0.6));
        if (score >= 75) return 'よく乾く';
        if (score >= 55) return '乾きやすい';
        if (score >= 35) return '普通';
        if (score >= 15) return '乾きにくい';
        return '乾かない';
      }

      function estimatePollenFromWeather(params) {
        const month = new Date().getMonth() + 1;
        const seasonalBase = ({
          1: 0, 2: 2, 3: 4, 4: 3, 5: 1, 6: 0,
          7: 0, 8: 0, 9: 1, 10: 1, 11: 0, 12: 0,
        })[month] || 0;

        let score = seasonalBase;
        if (params.wind >= 6) score += 2;
        else if (params.wind >= 3) score += 1;

        if (params.humidity <= 45) score += 2;
        else if (params.humidity <= 60) score += 1;
        else if (params.humidity >= 80) score -= 1;

        if (params.tomorrowMax >= 20) score += 2;
        else if (params.tomorrowMax >= 14) score += 1;

        if (params.tomorrowRainProb >= 60) score -= 2;
        else if (params.tomorrowRainProb >= 30) score -= 1;

        const clearCodes = [0, 1, 2];
        const rainCodes = [51, 53, 55, 61, 63, 65, 66, 67, 80, 81, 82];
        if (clearCodes.includes(params.tomorrowWeatherCode)) score += 1;
        if (rainCodes.includes(params.tomorrowWeatherCode)) score -= 2;

        if (score < 0) score = 0;
        if (score > 7) score = 7;

        if (score <= 1) return '少ない';
        if (score === 2) return 'やや少ない';
        if (score <= 4) return 'やや多い';
        if (score <= 6) return '多い';
        return '非常に多い';
      }

      function pollenLabelFromPeak(peak) {
        if (peak >= 80) return '非常に多い';
        if (peak >= 30) return '多い';
        if (peak >= 10) return 'やや多い';
        if (peak >= 3) return 'やや少ない';
        return '少ない';
      }

      async function getWeathernewsPollen(muniCd) {
        if (!/^\d{5}$/.test(String(muniCd || ''))) throw new Error('pollen-no-municd');
        const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
        const target = `https://wxtech.weathernews.com/opendata/v1/pollen?citycode=${muniCd}&start=${today}&end=${today}`;
        const data = await fetchJsonWithProxies(target);

        // レスポンス形式は実機確認できなかったため、想定しうる構造を防御的に走査する
        const records = Array.isArray(data) ? data
          : Array.isArray(data?.data) ? data.data
          : Array.isArray(data?.pollen) ? data.pollen
          : Array.isArray(data?.result) ? data.result
          : Array.isArray(data?.values) ? data.values
          : null;
        if (!records || !records.length) throw new Error('pollen-no-records');

        const values = [];
        records.forEach((r) => {
          ['value', 'count', 'pollen', 'total', 'level', 'index'].forEach((k) => {
            const v = Number(r?.[k]);
            if (Number.isFinite(v)) values.push(v);
          });
        });
        if (!values.length) throw new Error('pollen-no-values');

        const peak = Math.max(...values);
        return {
          label: `${pollenLabelFromPeak(peak)}（実測ピーク ${fmtNum(peak, 1)}）`,
          source: 'ウェザーニューズ ポールンロボ（実測値）',
        };
      }

      async function getPollenForecast(params) {
        try {
          return await getWeathernewsPollen(params.muniCd);
        } catch (e) {}

        try {
          const api = 'https://air-quality-api.open-meteo.com/v1/air-quality'
            + `?latitude=${params.lat || 35.83}&longitude=${params.lon || 139.87}`
            + '&hourly=alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen'
            + '&timezone=Asia%2FTokyo&forecast_days=2';
          const res = await fetchWithTimeout(api, 8000);
          if (!res.ok) throw new Error('pollen');
          const data = await res.json();

          const keys = ['alder_pollen', 'birch_pollen', 'grass_pollen', 'mugwort_pollen', 'olive_pollen', 'ragweed_pollen'];
          const values = [];
          keys.forEach((k) => {
            const arr = data?.hourly?.[k];
            if (!Array.isArray(arr)) return;
            arr.slice(0, 24).forEach((v) => {
              if (typeof v === 'number' && Number.isFinite(v)) values.push(v);
            });
          });

          if (!values.length) throw new Error('no-pollen-data');
          const peak = Math.max(...values);

          return {
            label: `${pollenLabelFromPeak(peak)}（予測ピーク ${fmtNum(peak, 1)}）`,
            source: 'Open-Meteo 花粉データ',
          };
        } catch (e) {
          const estimated = estimatePollenFromWeather(params);
          return {
            label: `${estimated}（簡易推定）`,
            source: '気象条件から推定',
          };
        }
      }

      function drawFxChart(canvasId, dates, usdData, eurData, gbpData) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || dates.length < 2) return;

        const dpr = window.devicePixelRatio || 1;
        const W = canvas.offsetWidth || 260;
        const H = 100;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        const pad = { top: 14, bottom: 22, left: 36, right: 10 };
        const cW = W - pad.left - pad.right;
        const cH = H - pad.top - pad.bottom;
        const n = dates.length;

        const norm = arr => { const b = arr[0]; return arr.map(v => ((v - b) / b) * 100); };
        const usdN = norm(usdData);
        const eurN = norm(eurData);
        const gbpN = norm(gbpData);

        const allVals = [...usdN, ...eurN, ...gbpN];
        const minV = Math.min(...allVals) - 0.3;
        const maxV = Math.max(...allVals) + 0.3;
        const range = maxV - minV || 1;

        const xOf = i => pad.left + (i / (n - 1)) * cW;
        const yOf = v => pad.top + (1 - (v - minV) / range) * cH;

        const series = [
          { data: usdN, raw: usdData, color: '#00e5ff', label: 'USD' },
          { data: eurN, raw: eurData, color: '#ff2d78', label: 'EUR' },
          { data: gbpN, raw: gbpData, color: '#9b59ff', label: 'GBP' },
        ];

        function drawBase(hoverIdx) {
          ctx.clearRect(0, 0, W, H);

          // ゼロライン強調
          ctx.save();
          ctx.strokeStyle = 'rgba(200,200,220,0.6)';
          ctx.lineWidth = 1.3;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(pad.left, yOf(0));
          ctx.lineTo(pad.left + cW, yOf(0));
          ctx.stroke();
          ctx.restore();

          // ホバー縦線
          if (hoverIdx != null) {
            const hx = xOf(hoverIdx);
            ctx.save();
            ctx.strokeStyle = 'rgba(200,200,230,0.5)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath(); ctx.moveTo(hx, pad.top); ctx.lineTo(hx, pad.top + cH); ctx.stroke();
            series.forEach(s => {
              ctx.strokeStyle = s.color + '55';
              const hy = yOf(s.data[hoverIdx]);
              ctx.beginPath(); ctx.moveTo(pad.left, hy); ctx.lineTo(pad.left + cW, hy); ctx.stroke();
            });
            ctx.restore();
          }

          // 各通貨ライン + グラデーション塗り
          series.forEach(({ data, color }) => {
            ctx.beginPath();
            data.forEach((v, i) => {
              if (i === 0) ctx.moveTo(xOf(i), yOf(v));
              else {
                const cpx = (xOf(i - 1) + xOf(i)) / 2;
                ctx.bezierCurveTo(cpx, yOf(data[i - 1]), cpx, yOf(v), xOf(i), yOf(v));
              }
            });
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.8;
            ctx.shadowColor = color;
            ctx.shadowBlur = 5;
            ctx.stroke();
            ctx.shadowBlur = 0;
            // グラデーション塗り
            const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + cH);
            grad.addColorStop(0, color + '28');
            grad.addColorStop(1, color + '00');
            ctx.beginPath();
            data.forEach((v, i) => {
              if (i === 0) ctx.moveTo(xOf(i), yOf(v));
              else { const cpx = (xOf(i-1)+xOf(i))/2; ctx.bezierCurveTo(cpx, yOf(data[i-1]), cpx, yOf(v), xOf(i), yOf(v)); }
            });
            ctx.lineTo(xOf(n-1), pad.top + cH); ctx.lineTo(xOf(0), pad.top + cH); ctx.closePath();
            ctx.fillStyle = grad; ctx.fill();
            // ホバー点
            if (hoverIdx != null) {
              ctx.beginPath();
              ctx.arc(xOf(hoverIdx), yOf(data[hoverIdx]), 3, 0, Math.PI * 2);
              ctx.fillStyle = color; ctx.fill();
            }
          });

          // Y軸ラベル
          ctx.fillStyle = 'rgba(120,140,160,0.8)';
          ctx.font = '8px sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(`${maxV >= 0 ? '+' : ''}${maxV.toFixed(1)}%`, pad.left - 3, pad.top + 7);
          ctx.fillText(`${minV >= 0 ? '+' : ''}${minV.toFixed(1)}%`, pad.left - 3, pad.top + cH + 4);
          ctx.fillStyle = 'rgba(200,200,220,0.5)';
          ctx.fillText('0%', pad.left - 3, yOf(0) + 4);

          // X軸ラベル
          ctx.textAlign = 'left';
          ctx.fillStyle = 'rgba(120,140,160,0.7)';
          ctx.fillText(dates[0].slice(5).replace('-', '/'), pad.left, H - 5);
          ctx.textAlign = 'right';
          ctx.fillText(dates[n - 1].slice(5).replace('-', '/'), pad.left + cW, H - 5);
        }

        drawBase(null);

        // ホバーインタラクション
        let tip = document.getElementById('stock-hover-tip');
        if (!tip) { tip = document.createElement('div'); tip.id = 'stock-hover-tip'; document.body.appendChild(tip); }

        canvas._fxHoverCleanup?.();
        const getIdx = clientX => {
          const rect = canvas.getBoundingClientRect();
          const x = clientX - rect.left;
          const idx = Math.round((x - pad.left) / cW * (n - 1));
          return Math.max(0, Math.min(n - 1, idx));
        };
        const onMove = e => {
          const clientX = e.touches ? e.touches[0].clientX : e.clientX;
          const clientY = e.touches ? e.touches[0].clientY : e.clientY;
          const idx = getIdx(clientX);
          drawBase(idx);
          const sign = v => (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
          tip.innerHTML = `<div class="sht-date">${dates[idx].slice(5).replace('-', '/')}</div>` +
            series.map(s => `<span style="color:${s.color}">■</span> ${s.label}: ${fmtNum(s.raw[idx], 2)} <span style="color:${s.data[idx]>=0?'#4ade80':'#f87171'}">(${sign(s.data[idx])})</span>`).join('<br>');
          tip.style.display = 'block';
          tip.style.left = Math.min(clientX + 12, window.innerWidth - 180) + 'px';
          tip.style.top = (clientY - 60) + 'px';
        };
        const onLeave = () => { drawBase(null); tip.style.display = 'none'; };
        canvas.addEventListener('mousemove', onMove);
        canvas.addEventListener('mouseleave', onLeave);
        canvas.addEventListener('touchmove', onMove, { passive: true });
        canvas.addEventListener('touchend', onLeave);
        canvas._fxHoverCleanup = () => {
          canvas.removeEventListener('mousemove', onMove);
          canvas.removeEventListener('mouseleave', onLeave);
          canvas.removeEventListener('touchmove', onMove);
          canvas.removeEventListener('touchend', onLeave);
        };
      }

      async function fetchFxHistory() {
        const fmtDate = d => d.toISOString().slice(0, 10);

        // Primary: frankfurter.app（ECBデータ、一括取得）
        try {
          const end = new Date();
          const start = new Date();
          start.setDate(start.getDate() - 30);
          const res = await fetchWithTimeout(
            `https://api.frankfurter.app/${fmtDate(start)}..${fmtDate(end)}?from=JPY&to=USD,EUR,GBP,AUD,CNY`, 6000
          );
          if (res.ok) {
            const hist = await res.json();
            const sortedDates = Object.keys(hist.rates || {}).sort();
            if (sortedDates.length >= 2) {
              return {
                dates: sortedDates,
                usd: sortedDates.map(d => 1 / hist.rates[d].USD),
                eur: sortedDates.map(d => 1 / hist.rates[d].EUR),
                gbp: sortedDates.map(d => 1 / hist.rates[d].GBP),
                aud: sortedDates.map(d => hist.rates[d].AUD ? 1 / hist.rates[d].AUD : null).filter(Boolean),
                cny: sortedDates.map(d => hist.rates[d].CNY ? 1 / hist.rates[d].CNY : null).filter(Boolean),
                audDates: sortedDates.filter(d => hist.rates[d].AUD),
                cnyDates: sortedDates.filter(d => hist.rates[d].CNY),
              };
            }
          }
        } catch (_) {}

        // Fallback: @fawazahmed0/currency-api（jsDelivr CDN、日別リクエスト）
        const dates = [];
        for (let i = 28; i >= 0; i -= 4) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          dates.push(fmtDate(d));
        }
        const results = await Promise.allSettled(
          dates.map(date =>
            fetchWithTimeout(
              `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/jpy.json`, 5000
            ).then(r => r.ok ? r.json() : null)
          )
        );
        const valid = [];
        results.forEach((r, i) => {
          if (r.status === 'fulfilled' && r.value?.jpy?.usd) {
            valid.push({ date: dates[i], j: r.value.jpy });
          }
        });
        if (valid.length >= 2) {
          return {
            dates: valid.map(v => v.date),
            usd: valid.map(v => 1 / v.j.usd),
            eur: valid.map(v => 1 / v.j.eur),
            gbp: valid.map(v => 1 / v.j.gbp),
            aud: valid.map(v => v.j.aud ? 1 / v.j.aud : null).filter(Boolean),
            cny: valid.map(v => v.j.cny ? 1 / v.j.cny : null).filter(Boolean),
            audDates: valid.filter(v => v.j.aud).map(v => v.date),
            cnyDates: valid.filter(v => v.j.cny).map(v => v.date),
          };
        }
        return null;
      }

      async function initFxCard() {
        try {
          // ライブレートと履歴を並行取得
          const [liveRes, hist] = await Promise.all([
            fetchWithTimeout('https://open.er-api.com/v6/latest/JPY', 8000),
            fetchFxHistory(),
          ]);
          if (!liveRes.ok) throw new Error('fx');
          const data = await liveRes.json();
          const rates = data?.rates;
          if (!rates?.USD || !rates?.EUR || !rates?.GBP) throw new Error('fx');

          const live = {
            usd: 1 / rates.USD,
            eur: 1 / rates.EUR,
            gbp: 1 / rates.GBP,
            aud: rates.AUD ? 1 / rates.AUD : null,
            cny: rates.CNY ? 1 / rates.CNY : null,
          };

          // 前日比：履歴の最後から2点を使用
          const prevOf = arr => arr && arr.length >= 2 ? arr[arr.length - 2] : null;
          const prev = {
            usd: prevOf(hist?.usd),
            eur: prevOf(hist?.eur),
            gbp: prevOf(hist?.gbp),
            aud: prevOf(hist?.aud),
            cny: prevOf(hist?.cny),
          };

          // カード生成
          const mkCard = (pair, rate, prevRate, histPts) => {
            if (!rate) return '';
            const change = prevRate ? rate - prevRate : 0;
            const pct = prevRate ? (change / prevRate) * 100 : 0;
            const dir = change >= 0 ? 'up' : 'down';
            const cls = change >= 0 ? 'dash-market-up' : 'dash-market-down';
            const sign = change >= 0 ? '+' : '';
            const chgHtml = prevRate
              ? `<div class="frc-chg ${cls}">${sign}${fmtNum(change, 2)} (${sign}${pct.toFixed(2)}%)</div>`
              : '';
            return `<div class="fx-rate-card ${dir}">
              <div class="frc-pair">${escHtml(pair)}</div>
              <div class="frc-rate stock-val-flip">${fmtNum(rate, 2)}</div>
              ${chgHtml}
              <canvas class="fx-sparkline" data-dir="${dir}"></canvas>
            </div>`;
          };

          fxList.innerHTML =
            mkCard('USD / JPY', live.usd, prev.usd, hist?.usd) +
            mkCard('EUR / JPY', live.eur, prev.eur, hist?.eur) +
            mkCard('GBP / JPY', live.gbp, prev.gbp, hist?.gbp) +
            (live.aud ? mkCard('AUD / JPY', live.aud, prev.aud, hist?.aud) : '') +
            (live.cny ? mkCard('CNY / JPY', live.cny, prev.cny, hist?.cny) : '');

          // スパークライン描画
          const sparkData = [hist?.usd, hist?.eur, hist?.gbp, hist?.aud, hist?.cny];
          fxList.querySelectorAll('canvas.fx-sparkline').forEach((cv, i) => {
            const pts = sparkData[i];
            if (pts && pts.length >= 2) {
              const mapped = pts.map((v, j) => ({ v, t: j }));
              drawSparkline(cv, mapped, cv.dataset.dir);
            }
          });

          const hhmm = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
          fxTime.textContent = `最終更新: ${hhmm}`;

          // 比較チャート
          if (hist && hist.dates.length >= 2) {
            document.getElementById('home-fx-chart-wrap').style.display = '';
            drawFxChart('home-fx-chart', hist.dates, hist.usd, hist.eur, hist.gbp);
            const pct30 = arr => {
              const v = ((arr[arr.length - 1] - arr[0]) / arr[0]) * 100;
              return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
            };
            const legend = [
              { label: 'USD', color: '#00e5ff', val: pct30(hist.usd) },
              { label: 'EUR', color: '#ff2d78', val: pct30(hist.eur) },
              { label: 'GBP', color: '#9b59ff', val: pct30(hist.gbp) },
            ];
            document.getElementById('home-fx-legend').innerHTML = legend.map(l =>
              `<div class="fx-legend-item">
                <div class="fx-legend-dot" style="background:${l.color}"></div>
                <span>${l.label} <strong style="color:${l.color}">${l.val}</strong></span>
              </div>`
            ).join('');
          }
        } catch (e) {
          fxList.innerHTML = '<div class="fx-rate-card"><div class="frc-pair">円相場の取得に失敗しました</div></div>';
          fxTime.textContent = '取得失敗';
        }
      }

      document.getElementById('home-fx-refresh-btn')?.addEventListener('click', async () => {
        const btn = document.getElementById('home-fx-refresh-btn');
        if (!btn || btn.disabled) return;
        btn.textContent = '⏳'; btn.disabled = true;
        await initFxCard();
        btn.textContent = '🔄'; btn.disabled = false;
      });

      function parseStockPayload(payload) {
        let data;
        try {
          data = typeof payload === 'string' ? JSON.parse(payload) : payload;
        } catch (e) {
          return null;
        }

        const quote = data?.quoteResponse?.result?.[0];
        if (quote && Number.isFinite(Number(quote.regularMarketPrice))) {
          return {
            price: Number(quote.regularMarketPrice),
            prev:  Number(quote.regularMarketPreviousClose || quote.regularMarketPrice),
            marketCap: Number(quote.marketCap) || null,
            industry: quote.industry || '',
            sharesOutstanding: Number(quote.sharesOutstanding) || 0,
            dividendYield: Number(quote.trailingAnnualDividendYield) || 0,
            currency: quote.currency || '',
          };
        }

        const meta = data?.chart?.result?.[0]?.meta;
        if (meta && Number.isFinite(Number(meta.regularMarketPrice))) {
          return {
            price: Number(meta.regularMarketPrice),
            prev:  Number(meta.previousClose || meta.chartPreviousClose || meta.regularMarketPrice),
            marketCap: null,
          };
        }
        return null;
      }

      function fmtMarketCap(cap, symbol) {
        if (!cap || !Number.isFinite(cap) || cap <= 0) return null;
        if (/\.\w+$/.test(symbol) && !/^\^/.test(symbol)) {
          // 日本株など（.T/.OS 等）→ 兆/億
          if (cap >= 1e12) return (cap / 1e12).toFixed(1) + '兆円';
          if (cap >= 1e8)  return Math.round(cap / 1e8) + '億円';
          return Math.round(cap / 1e4) + '万円';
        }
        // 米国株・指数
        if (cap >= 1e12) return (cap / 1e12).toFixed(2) + 'T';
        if (cap >= 1e9)  return (cap / 1e9).toFixed(1) + 'B';
        if (cap >= 1e6)  return Math.round(cap / 1e6) + 'M';
        return cap.toLocaleString();
      }

      const INDUSTRY_JA = {
        'Auto Manufacturers':'自動車','Auto Parts':'自動車部品',
        'Semiconductors':'半導体','Semiconductor Equipment':'半導体製造装置',
        'Consumer Electronics':'電機・精密機器','Electronic Components':'電子部品',
        'Electrical Equipment & Parts':'電気機器',
        'Software—Application':'ソフトウェア','Software—Infrastructure':'ソフトウェア基盤',
        'Information Technology Services':'ITサービス',
        'Banks—Diversified':'銀行','Banks—Regional':'地方銀行',
        'Insurance—Life':'生命保険','Insurance—Property & Casualty':'損害保険',
        'Capital Markets':'証券・金融',
        'Steel':'鉄鋼','Aluminum':'非鉄金属',
        'Specialty Chemicals':'化学','Diversified Chemicals':'総合化学',
        'Drug Manufacturers—General':'医薬品','Drug Manufacturers—Specialty & Generic':'ジェネリック医薬品',
        'Medical Instruments & Supplies':'医療機器',
        'Food Distribution':'食料品','Beverages—Non-Alcoholic':'飲料','Beverages—Alcoholic':'酒類',
        'Grocery Stores':'スーパー','Department Stores':'百貨店','Specialty Retail':'小売業',
        'Telecom Services':'通信サービス',
        'Oil & Gas Integrated':'石油・ガス','Oil & Gas E&P':'石油開発',
        'Real Estate—Diversified':'不動産','REIT—Diversified':'不動産投資信託',
        'Industrial Distribution':'機械商社','Specialty Industrial Machinery':'産業機械',
        'Farm & Construction Machinery':'建設機械',
        'Publishing':'出版','Advertising Agencies':'広告',
        'Leisure':'レジャー','Resorts & Casinos':'観光・ホテル','Restaurants':'外食',
        'Paper & Paper Products':'紙・パルプ',
      };

      function fmtShares(n) {
        if (!n || !Number.isFinite(n) || n <= 0) return null;
        if (n >= 1e8) return (n / 1e8).toFixed(1) + '億株';
        if (n >= 1e4) return Math.round(n / 1e4) + '万株';
        return n.toLocaleString() + '株';
      }

      function parseJsonText(text) {
        try {
          return JSON.parse(String(text || ''));
        } catch (e) {
          return null;
        }
      }

      async function fetchJsonWithProxies(target) {
        const enc = encodeURIComponent(target);
        const tryProxy = async ({ type, url }) => {
          const res = await fetchWithTimeout(url, 10000);
          if (!res.ok) throw new Error('HTTP ' + res.status);
          const text = type === 'json'
            ? String((await res.json())?.contents || '')
            : await res.text();
          const parsed = parseJsonText(text);
          if (!parsed) throw new Error('parse-failed');
          return parsed;
        };
        // 複数プロキシを並列実行し、最速の成功を使う
        return Promise.any([
          tryProxy({ type: 'raw',  url: `https://corsproxy.io/?${enc}` }),
          tryProxy({ type: 'json', url: `https://api.allorigins.win/get?url=${enc}` }),
          tryProxy({ type: 'raw',  url: `https://api.allorigins.win/raw?url=${enc}` }),
          tryProxy({ type: 'raw',  url: `https://api.codetabs.com/v1/proxy?quest=${target}` }),
          tryProxy({ type: 'raw',  url: `https://thingproxy.freeboard.io/fetch/${target}` }),
        ]);
      }

      // ── スパークライン ────────────────────────────────────
      function drawSparkline(canvas, points, dir) {
        const W = canvas.clientWidth || 120, H = canvas.height || 30;
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d');
        if (!points || points.length < 2) return;
        const vals = points.map(p => p.v);
        const lo = Math.min(...vals), hi = Math.max(...vals);
        const xOf = i => (i / (points.length - 1)) * W;
        const yOf = v => H - 2 - ((v - lo) / (hi - lo || 1)) * (H - 4);
        const color = dir === 'up' ? '#16a34a' : '#dc2626';
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, dir === 'up' ? 'rgba(22,163,74,0.22)' : 'rgba(220,38,38,0.22)');
        grad.addColorStop(1, 'transparent');
        ctx.beginPath();
        points.forEach((p, i) => i === 0 ? ctx.moveTo(xOf(i), yOf(p.v)) : ctx.lineTo(xOf(i), yOf(p.v)));
        ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
        ctx.fillStyle = grad; ctx.fill();
        ctx.beginPath();
        points.forEach((p, i) => i === 0 ? ctx.moveTo(xOf(i), yOf(p.v)) : ctx.lineTo(xOf(i), yOf(p.v)));
        ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.stroke();
      }

      async function drawIndexSparklines(container) {
        const canvases = container.querySelectorAll('canvas.stock-index-sparkline');
        await Promise.allSettled(Array.from(canvases).map(async (cv) => {
          const sym = cv.dataset.symbol, dir = cv.dataset.dir;
          if (!sym) return;
          const pts = await fetchStockHistoryMulti(sym, '1mo').catch(() => null);
          if (pts && pts.length >= 2) drawSparkline(cv, pts, dir);
        }));
      }

      function updateMarketStatusBadges() {
        const el = document.getElementById('market-status-badges');
        if (!el) return;
        const now = new Date();
        const jst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
        const ny  = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
        const isWeekday = d => d.getDay() >= 1 && d.getDay() <= 5;
        const inRange = (d, h1, m1, h2, m2) => {
          const t = d.getHours() * 60 + d.getMinutes();
          return t >= h1 * 60 + m1 && t < h2 * 60 + m2;
        };
        const tseOpen  = isWeekday(jst) && (inRange(jst, 9, 0, 11, 30) || inRange(jst, 12, 30, 15, 30));
        const nyseOpen = isWeekday(ny)  && inRange(ny, 9, 30, 16, 0);
        el.innerHTML =
          `<span class="market-badge ${tseOpen  ? 'open' : 'closed'}">東証 ${tseOpen  ? 'OPEN' : 'CLOSED'}</span>` +
          `<span class="market-badge ${nyseOpen ? 'open' : 'closed'}">NYSE ${nyseOpen ? 'OPEN' : 'CLOSED'}</span>`;
      }

      // ── 比較チャート ─────────────────────────────────────
      const COMPARE_INDICES = [
        { symbol: '^GSPC',     name: 'S&P500',   color: '#22c55e' },
        { symbol: '^N225',     name: '日経平均',  color: '#38bdf8' },
        { symbol: '^DJI',      name: 'NYダウ',   color: '#818cf8' },
        { symbol: '^GDAXI',    name: 'DAX',      color: '#fb923c' },
        { symbol: '000001.SS', name: '上海総合',  color: '#f87171' },
      ];
      let compareRange = '1y';

      async function fetchStockHistoryMulti(symbol, range) {
        const cacheKey = `stock-compare-${symbol}-${range}`;
        try {
          const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
          if (cached && Date.now() - cached.ts < 4 * 60 * 60 * 1000) return cached.data;
        } catch (e) { /* ignore */ }

        const interval = range === '1y' ? '1wk' : '1mo';
        const enc = encodeURIComponent(symbol);
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${enc}?interval=${interval}&range=${range}`;
        const payload = await fetchJsonWithProxies(url);
        const result = payload?.chart?.result?.[0];
        if (!result) throw new Error('no-result');

        const timestamps = result.timestamp || [];
        const closes = result.indicators?.quote?.[0]?.close || [];
        const points = [];
        for (let i = 0; i < timestamps.length; i++) {
          if (closes[i] != null) points.push({ t: timestamps[i] * 1000, v: closes[i] });
        }
        if (!points.length) throw new Error('no-data');
        try { localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: points })); } catch (e) { /* ignore */ }
        return points;
      }

      function drawCompareChart(canvas, seriesList) {
        const W = canvas.clientWidth || canvas.offsetWidth || 300;
        const H = 120;
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');

        if (!seriesList.length) return;

        const pad = { top: 10, bottom: 18, left: 36, right: 10 };
        const cW = W - pad.left - pad.right;
        const cH = H - pad.top - pad.bottom;

        const allTs = seriesList.flatMap(s => s.norm.map(p => p.t));
        const tMin = Math.min(...allTs), tMax = Math.max(...allTs);
        const allVals = seriesList.flatMap(s => s.norm.map(p => p.v));
        const vMin = Math.min(...allVals), vMax = Math.max(...allVals);
        const vPad = (vMax - vMin) * 0.08 || 2;
        const lo = vMin - vPad, hi = vMax + vPad;

        const xOf = t => pad.left + ((t - tMin) / (tMax - tMin || 1)) * cW;
        const yOf = v => pad.top + (1 - (v - lo) / (hi - lo)) * cH;

        function closestPt(norm, hoverT) {
          return norm.reduce((a, b) => Math.abs(b.t - hoverT) < Math.abs(a.t - hoverT) ? b : a);
        }

        function drawBase(hoverT) {
          ctx.clearRect(0, 0, W, H);

          // グリッド・ゼロライン
          ctx.strokeStyle = 'rgba(150,150,180,0.18)';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 4]);
          [0.25, 0.5, 0.75].forEach(t => {
            const y = pad.top + t * cH;
            ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + cW, y); ctx.stroke();
          });
          if (lo < 0 && hi > 0) {
            ctx.strokeStyle = 'rgba(200,200,220,0.7)';
            ctx.lineWidth = 1.5;
            const y0 = yOf(0);
            ctx.beginPath(); ctx.moveTo(pad.left, y0); ctx.lineTo(pad.left + cW, y0); ctx.stroke();
          }
          ctx.setLineDash([]);

          // Y軸ラベル
          ctx.fillStyle = 'rgba(120,130,150,0.85)';
          ctx.font = '8px sans-serif';
          ctx.textAlign = 'right';
          [lo + (hi - lo) * 0.1, lo + (hi - lo) * 0.9].forEach(v => {
            ctx.fillText((v >= 0 ? '+' : '') + v.toFixed(0) + '%', pad.left - 2, yOf(v) + 3);
          });

          // X軸ラベル（両端）
          ctx.fillStyle = 'rgba(120,130,150,0.7)';
          ctx.textAlign = 'left';
          ctx.fillText(new Date(tMin).getFullYear(), pad.left, H - 3);
          ctx.textAlign = 'right';
          ctx.fillText(new Date(tMax).getFullYear(), pad.left + cW, H - 3);

          // ホバー縦線 + 横線
          if (hoverT != null) {
            const hx = xOf(hoverT);
            ctx.save();
            ctx.strokeStyle = 'rgba(200,200,230,0.5)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath(); ctx.moveTo(hx, pad.top); ctx.lineTo(hx, pad.top + cH); ctx.stroke();
            seriesList.forEach(s => {
              const pt = closestPt(s.norm, hoverT);
              const hy = yOf(pt.v);
              ctx.strokeStyle = s.color + '55';
              ctx.beginPath(); ctx.moveTo(pad.left, hy); ctx.lineTo(pad.left + cW, hy); ctx.stroke();
            });
            ctx.restore();
          }

          // 各指数の折れ線（グラデーション塗り付き）
          seriesList.forEach(s => {
            if (s.norm.length < 2) return;
            // ライン描画
            ctx.beginPath();
            s.norm.forEach((p, i) => {
              if (i === 0) ctx.moveTo(xOf(p.t), yOf(p.v));
              else ctx.lineTo(xOf(p.t), yOf(p.v));
            });
            ctx.strokeStyle = s.color;
            ctx.lineWidth = 1.6;
            ctx.shadowColor = s.color;
            ctx.shadowBlur = 4;
            ctx.stroke();
            ctx.shadowBlur = 0;
            // グラデーション塗り
            const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + cH);
            grad.addColorStop(0, s.color + '28');
            grad.addColorStop(1, s.color + '00');
            ctx.beginPath();
            s.norm.forEach((p, i) => i === 0 ? ctx.moveTo(xOf(p.t), yOf(p.v)) : ctx.lineTo(xOf(p.t), yOf(p.v)));
            ctx.lineTo(xOf(s.norm[s.norm.length - 1].t), pad.top + cH);
            ctx.lineTo(xOf(s.norm[0].t), pad.top + cH);
            ctx.closePath();
            ctx.fillStyle = grad; ctx.fill();

            if (hoverT != null) {
              // ホバー点
              const pt = closestPt(s.norm, hoverT);
              ctx.beginPath();
              ctx.arc(xOf(pt.t), yOf(pt.v), 3, 0, Math.PI * 2);
              ctx.fillStyle = s.color;
              ctx.fill();
            } else {
              // 末端ラベル
              const last = s.norm[s.norm.length - 1];
              const sign = last.v >= 0 ? '+' : '';
              ctx.fillStyle = s.color;
              ctx.font = 'bold 7.5px sans-serif';
              ctx.textAlign = 'left';
              ctx.fillText(`${sign}${last.v.toFixed(0)}%`, Math.min(xOf(last.t) + 2, W - 28), yOf(last.v) + 3);
            }
          });
        }

        drawBase(null);

        let tip = document.getElementById('stock-hover-tip');
        if (!tip) {
          tip = document.createElement('div');
          tip.id = 'stock-hover-tip';
          document.body.appendChild(tip);
        }

        canvas._hoverCleanup?.();

        function getXY(e) {
          return e.touches ? [e.touches[0].clientX, e.touches[0].clientY] : [e.clientX, e.clientY];
        }

        function onMove(e) {
          const rect = canvas.getBoundingClientRect();
          const [cx, cy] = getXY(e);
          const hoverT = tMin + ((cx - rect.left - pad.left) / cW) * (tMax - tMin);

          drawBase(hoverT);

          const refPt = closestPt(seriesList[0].norm, hoverT);
          const d = new Date(refPt.t);
          const ds = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;

          const rows = seriesList.map(s => {
            const pt = closestPt(s.norm, hoverT);
            const sign = pt.v >= 0 ? '+' : '';
            const cls = pt.v >= 0 ? 'sht-hi' : 'sht-lo';
            return `<div><span style="color:${s.color}">■</span> ${escHtml(s.name)}: <b class="${cls}">${sign}${pt.v.toFixed(1)}%</b></div>`;
          }).join('');

          tip.innerHTML = `<div class="sht-date">${ds}</div>${rows}`;

          const tipW = 160;
          const left = cx + 14 + tipW > window.innerWidth ? cx - tipW - 14 : cx + 14;
          tip.style.left = left + 'px';
          tip.style.top = Math.max(8, cy - 90) + 'px';
          tip.style.display = 'block';
        }

        function onLeave() {
          drawBase(null);
          if (tip) tip.style.display = 'none';
        }

        canvas.addEventListener('mousemove', onMove);
        canvas.addEventListener('mouseleave', onLeave);
        canvas.addEventListener('touchmove', onMove, { passive: true });
        canvas.addEventListener('touchend', onLeave);

        canvas._hoverCleanup = () => {
          canvas.removeEventListener('mousemove', onMove);
          canvas.removeEventListener('mouseleave', onLeave);
          canvas.removeEventListener('touchmove', onMove);
          canvas.removeEventListener('touchend', onLeave);
        };
      }

      async function renderCompareChart() {
        const canvas = document.getElementById('home-stock-compare-canvas');
        const legend = document.getElementById('home-stock-compare-legend');
        const msgEl = document.getElementById('home-stock-compare-msg');
        if (!canvas) return;
        msgEl.textContent = '取得中…';

        const results = await Promise.allSettled(
          COMPARE_INDICES.map(idx =>
            fetchStockHistoryMulti(idx.symbol, compareRange)
              .then(points => ({ ...idx, points }))
          )
        );

        const seriesList = results
          .filter(r => r.status === 'fulfilled')
          .map(r => r.value)
          .filter(s => s.points && s.points.length > 1)
          .map(s => {
            const base = s.points[0].v;
            return { ...s, norm: s.points.map(p => ({ t: p.t, v: (p.v / base - 1) * 100 })) };
          });

        msgEl.textContent = '';
        if (!seriesList.length) { msgEl.textContent = 'データ取得失敗'; return; }

        canvas._lastSeries = seriesList;
        drawCompareChart(canvas, seriesList);

        legend.innerHTML = seriesList.map(s => {
          const last = s.norm[s.norm.length - 1];
          const sign = last.v >= 0 ? '+' : '';
          const cls = last.v >= 0 ? 'dash-market-up' : 'dash-market-down';
          return `<span style="white-space:nowrap"><span style="color:${s.color}">■</span> ${escHtml(s.name)} <span class="${cls}">${sign}${last.v.toFixed(1)}%</span></span>`;
        }).join('');
      }

      async function fetchStock(symbol) {
        const cacheKey = 'dashboard-stock-quote-' + symbol;
        let staleData = null;
        try {
          const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
          if (cached) {
            if (Date.now() - cached.ts < STOCK_QUOTE_CACHE_TTL) return cached.data;
            staleData = cached.data;
          }
        } catch (e) { /* ignore */ }

        const enc = encodeURIComponent(symbol);
        const tryEndpoints = (urls) => Promise.any(
          urls.map(url =>
            fetchJsonWithProxies(url).then(payload => {
              const r = parseStockPayload(payload);
              if (!r) throw new Error('parse-failed');
              return r;
            })
          )
        ).catch(() => null);

        // v7 quote を優先（業種・発行済株式数・配当利回りが含まれる）、失敗時のみ v8 chart へフォールバック
        const v7urls = [
          `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${enc}`,
          `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${enc}`,
        ];
        const v8urls = [
          `https://query1.finance.yahoo.com/v8/finance/chart/${enc}?interval=1d&range=2d`,
          `https://query2.finance.yahoo.com/v8/finance/chart/${enc}?interval=1d&range=2d`,
        ];
        const parsed = (await tryEndpoints(v7urls)) ?? (await tryEndpoints(v8urls));

        if (!parsed) {
          if (staleData) return staleData;
          throw new Error('stock-fetch-failed');
        }
        try { localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: parsed })); } catch (e) { /* ignore */ }
        return parsed;
      }

      async function fetchStockHistory(symbol, range) {
        const cacheKey = STOCK_CHART_CACHE_PREFIX + symbol + '-' + range;
        let staleData = null;
        try {
          const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
          if (cached) {
            const cachedPts = cached.pts || cached.data;
            if (Date.now() - cached.ts < STOCK_CHART_CACHE_TTL) return { pts: cachedPts, prevClose: cached.prevClose ?? null };
            staleData = { pts: cachedPts, prevClose: cached.prevClose ?? null };
          }
        } catch (e) { /* ignore */ }

        const enc = encodeURIComponent(symbol);
        const urls = [
          `https://query1.finance.yahoo.com/v8/finance/chart/${enc}?interval=1d&range=${range}`,
          `https://query2.finance.yahoo.com/v8/finance/chart/${enc}?interval=1d&range=${range}`,
        ];

        const parsePoints = (payload) => {
          const result = payload?.chart?.result?.[0];
          if (!result) return null;
          const timestamps = result.timestamp || [];
          const q = result.indicators?.quote?.[0] || {};
          const closes = q.close || [], opens = q.open || [], highs = q.high || [], lows = q.low || [], volumes = q.volume || [];
          const prevClose = result.meta?.chartPreviousClose ?? result.meta?.previousClose ?? null;
          const pts = [];
          for (let i = 0; i < timestamps.length; i++) {
            if (closes[i] != null) pts.push({ t: timestamps[i] * 1000, v: closes[i], o: opens[i] ?? null, h: highs[i] ?? null, l: lows[i] ?? null, vol: volumes[i] ?? null });
          }
          return pts.length ? { pts, prevClose } : null;
        };

        const result = await Promise.any(
          urls.map(url => fetchJsonWithProxies(url).then(p => {
            const parsed = parsePoints(p);
            if (!parsed) throw new Error('chart-no-data');
            return parsed;
          }))
        ).catch(() => null);

        if (!result) {
          if (staleData) { staleData._stale = true; return staleData; }
          throw new Error('chart-fetch-failed');
        }

        try {
          localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), pts: result.pts, prevClose: result.prevClose }));
        } catch (e) { /* ignore */ }
        return result;
      }

      function renderStockChart(symbol, name, range) {
        const chartArea = document.getElementById('home-stock-chart-area');
        const canvas = document.getElementById('home-stock-chart');
        const msg = document.getElementById('home-stock-chart-msg');
        const label = document.getElementById('home-stock-chart-label');
        if (!chartArea || !canvas || !msg || !label) return;

        activeChartSymbol = symbol;
        activeChartName = name;
        activeChartRange = range;

        chartArea.style.display = '';
        label.textContent = name;
        msg.textContent = 'チャートを読み込み中…';
        canvas.style.display = 'none';

        document.querySelectorAll('.stock-tab-btn').forEach((btn) => {
          btn.classList.toggle('active', btn.dataset.range === range);
        });

        fetchStockHistory(symbol, range).then(({ pts, prevClose, _stale }) => {
          if (activeChartSymbol !== symbol || activeChartRange !== range) return;
          msg.textContent = _stale ? '※ キャッシュデータを表示中（最新取得に失敗）' : '';
          canvas.style.display = '';
          drawStockCanvas(canvas, pts, prevClose);
        }).catch(() => {
          if (activeChartSymbol !== symbol) return;
          msg.textContent = 'チャートデータを取得できませんでした。時間をおいて再試行してください。';
        });
      }

      function drawStockCanvas(canvas, points, prevClose = null) {
        const dpr = window.devicePixelRatio || 1;
        const W = canvas.offsetWidth || 280;
        const H = 100;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        const pad = { top: 16, bottom: 22, left: 44, right: 10 };
        const cW = W - pad.left - pad.right;
        const cH = H - pad.top - pad.bottom;
        const values = points.map((p) => p.v);
        const n = values.length;

        const minV = Math.min(...values);
        const maxV = Math.max(...values);
        const margin = (maxV - minV) * 0.15 || 1;
        const lo = minV - margin;
        const hi = maxV + margin;

        const xOf = (i) => pad.left + (n === 1 ? cW / 2 : (i / (n - 1)) * cW);
        const yOf = (v) => pad.top + (1 - (v - lo) / (hi - lo)) * cH;

        function drawBase(hoverIdx) {
          ctx.clearRect(0, 0, W, H);

          // グリッド
          ctx.save();
          ctx.strokeStyle = 'rgba(0,0,0,0.05)';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 4]);
          [0.33, 0.66].forEach((t) => {
            const y = pad.top + t * cH;
            ctx.beginPath();
            ctx.moveTo(pad.left, y);
            ctx.lineTo(pad.left + cW, y);
            ctx.stroke();
          });
          ctx.restore();

          // 前日終値 破線
          if (prevClose != null) {
            const py = yOf(prevClose);
            if (py >= pad.top && py <= pad.top + cH) {
              ctx.save();
              ctx.strokeStyle = 'rgba(148,163,184,0.7)';
              ctx.lineWidth = 1;
              ctx.setLineDash([4, 4]);
              ctx.beginPath();
              ctx.moveTo(pad.left, py);
              ctx.lineTo(pad.left + cW, py);
              ctx.stroke();
              ctx.setLineDash([]);
              ctx.fillStyle = 'rgba(148,163,184,0.8)';
              ctx.font = `${9 * dpr > 12 ? 9 : 9}px sans-serif`;
              ctx.textAlign = 'right';
              ctx.fillText('前終', pad.left - 2, py + 3);
              ctx.restore();
            }
          }

          // グラデーション塗り
          const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + cH);
          grad.addColorStop(0, 'rgba(14,165,233,0.18)');
          grad.addColorStop(1, 'rgba(14,165,233,0)');
          ctx.beginPath();
          values.forEach((v, i) => {
            if (i === 0) ctx.moveTo(xOf(i), yOf(v));
            else {
              const cpx = (xOf(i - 1) + xOf(i)) / 2;
              ctx.bezierCurveTo(cpx, yOf(values[i - 1]), cpx, yOf(v), xOf(i), yOf(v));
            }
          });
          ctx.lineTo(xOf(n - 1), pad.top + cH);
          ctx.lineTo(xOf(0), pad.top + cH);
          ctx.closePath();
          ctx.fillStyle = grad;
          ctx.fill();

          // ライン
          ctx.beginPath();
          values.forEach((v, i) => {
            if (i === 0) ctx.moveTo(xOf(i), yOf(v));
            else {
              const cpx = (xOf(i - 1) + xOf(i)) / 2;
              ctx.bezierCurveTo(cpx, yOf(values[i - 1]), cpx, yOf(v), xOf(i), yOf(v));
            }
          });
          ctx.strokeStyle = '#0ea5e9';
          ctx.lineWidth = 2;
          ctx.shadowColor = '#0ea5e9';
          ctx.shadowBlur = 6;
          ctx.stroke();
          ctx.shadowBlur = 0;

          // ホバー時: 縦線
          if (hoverIdx != null) {
            ctx.save();
            ctx.strokeStyle = 'rgba(249,115,22,0.55)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(xOf(hoverIdx), pad.top);
            ctx.lineTo(xOf(hoverIdx), pad.top + cH);
            ctx.stroke();
            ctx.restore();
          }

          // 最新点 or ホバー点
          const dotIdx = hoverIdx != null ? hoverIdx : n - 1;
          ctx.beginPath();
          ctx.arc(xOf(dotIdx), yOf(values[dotIdx]), 3.5, 0, Math.PI * 2);
          ctx.fillStyle = hoverIdx != null ? '#f97316' : '#0ea5e9';
          ctx.fill();

          // Y軸ラベル
          ctx.fillStyle = 'rgba(100,120,140,0.85)';
          ctx.font = '9px sans-serif';
          ctx.textAlign = 'right';
          [lo + (hi - lo) * 0.1, lo + (hi - lo) * 0.9].forEach((v) => {
            ctx.fillText(v >= 1000 ? Math.round(v).toLocaleString() : v.toFixed(1), pad.left - 3, yOf(v) + 3);
          });

          // X軸ラベル（最大4点）
          ctx.textAlign = 'center';
          const labelCount = Math.min(4, n);
          for (let k = 0; k < labelCount; k++) {
            const idx = Math.round((k / (labelCount - 1 || 1)) * (n - 1));
            const d = new Date(points[idx].t);
            const lbl = `${d.getMonth() + 1}/${String(d.getDate()).padStart(2, '0')}`;
            ctx.fillText(lbl, xOf(idx), H - 6);
          }
        }

        drawBase(null);

        // ホバートリップ要素（1つだけ作成）
        let tip = document.getElementById('stock-hover-tip');
        if (!tip) {
          tip = document.createElement('div');
          tip.id = 'stock-hover-tip';
          document.body.appendChild(tip);
        }

        canvas._hoverCleanup?.();

        function getXY(e) {
          return e.touches ? [e.touches[0].clientX, e.touches[0].clientY] : [e.clientX, e.clientY];
        }

        function onMove(e) {
          const rect = canvas.getBoundingClientRect();
          const [cx, cy] = getXY(e);
          const canvasX = cx - rect.left;

          let best = 0, bestDx = Infinity;
          for (let i = 0; i < n; i++) {
            const dx = Math.abs(xOf(i) - canvasX);
            if (dx < bestDx) { bestDx = dx; best = i; }
          }

          drawBase(best);

          const pt = points[best];
          const d = new Date(pt.t);
          const ds = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
          const fmt = (v) => v != null ? (v >= 1000 ? Math.round(v).toLocaleString() : v.toFixed(2)) : '—';
          const fmtVol = (v) => v == null ? '—' : v >= 1e8 ? (v / 1e8).toFixed(1) + '億' : v >= 1e4 ? (v / 1e4).toFixed(0) + '万' : v.toLocaleString();
          tip.innerHTML =
            `<div class="sht-date">${ds}</div>` +
            `<div>始値: <b>${fmt(pt.o)}</b></div>` +
            `<div>高値: <b class="sht-hi">${fmt(pt.h)}</b></div>` +
            `<div>安値: <b class="sht-lo">${fmt(pt.l)}</b></div>` +
            `<div>終値: <b>${fmt(pt.v)}</b></div>` +
            `<div>出来高: <b>${fmtVol(pt.vol)}</b></div>` +
            `<div style="border-top:1px solid rgba(100,160,220,0.2);margin-top:3px;padding-top:3px">前日終値: <b>${fmt(prevClose)}</b></div>`;

          const tipW = 155;
          const left = cx + 14 + tipW > window.innerWidth ? cx - tipW - 14 : cx + 14;
          tip.style.left = left + 'px';
          tip.style.top = Math.max(8, cy - 70) + 'px';
          tip.style.display = 'block';
        }

        function onLeave() {
          drawBase(null);
          if (tip) tip.style.display = 'none';
        }

        canvas.addEventListener('mousemove', onMove);
        canvas.addEventListener('mouseleave', onLeave);
        canvas.addEventListener('touchmove', onMove, { passive: true });
        canvas.addEventListener('touchend', onLeave);

        canvas._hoverCleanup = () => {
          canvas.removeEventListener('mousemove', onMove);
          canvas.removeEventListener('mouseleave', onLeave);
          canvas.removeEventListener('touchmove', onMove);
          canvas.removeEventListener('touchend', onLeave);
        };
      }

      function renderStockRows(rows, targetEl) {
        const el = targetEl || stockList;
        el.innerHTML = rows.map((row) => {
          const current = Number(row.price);
          const prev = Number(row.prev);
          const change = current - prev;
          const pct = prev ? (change / prev) * 100 : 0;
          const cls = change >= 0 ? 'dash-market-up' : 'dash-market-down';
          const dir = change >= 0 ? 'up' : 'down';
          const sign = change >= 0 ? '+' : '';
          const mcap = fmtMarketCap(row.marketCap, row.symbol || '');
          return `<div class="stock-index-card ${dir}">
            <div class="sic-name">${escHtml(row.name)}</div>
            <div class="sic-price stock-val-flip">${fmtNum(current, 2)}</div>
            <div class="sic-chg ${cls}">${sign}${fmtNum(change, 2)} (${sign}${pct.toFixed(2)}%)</div>
            ${mcap ? `<div class="sic-mcap">時価総額 ${escHtml(mcap)}</div>` : ''}
            <canvas class="stock-index-sparkline" data-symbol="${escHtml(row.symbol || '')}" data-dir="${dir}"></canvas>
          </div>`;
        }).join('');
        drawIndexSparklines(el);
      }

      const COMPANY_URLS = {
        '1301.T':'https://www.kyokuyo.co.jp/','1332.T':'https://www.nissui.co.jp/',
        '1333.T':'https://www.maruha-nichiro.co.jp/','1605.T':'https://www.inpex.co.jp/',
        '1662.T':'https://www.japex.co.jp/','1721.T':'https://www.comsis.co.jp/',
        '1801.T':'https://www.taisei.co.jp/','1802.T':'https://www.obayashi.co.jp/',
        '1803.T':'https://www.shimz.co.jp/','1812.T':'https://www.kajima.co.jp/',
        '1925.T':'https://www.daiwahouse.co.jp/','1928.T':'https://www.sekisuihouse.co.jp/',
        '1963.T':'https://www.jgc.com/jp/','2002.T':'https://www.nisshin.com/',
        '2009.T':'https://www.yamazakipan.co.jp/','2201.T':'https://www.morinaga.co.jp/',
        '2206.T':'https://www.glico.com/jp/','2220.T':'https://www.kamedaseika.co.jp/',
        '2264.T':'https://www.morinagamilk.co.jp/','2267.T':'https://www.yakult.co.jp/',
        '2269.T':'https://www.meiji.com/','2282.T':'https://www.nipponham.co.jp/',
        '2288.T':'https://www.marudai.jp/','2296.T':'https://www.itohamyonekyu-holdings.com/',
        '2154.T':'https://openupgroup.co.jp/',
        '2432.T':'https://dena.com/jp/','2433.T':'https://www.hakuhodody-holdings.co.jp/',
        '2501.T':'https://www.sapporoholdings.jp/','2502.T':'https://www.asahigroup-holdings.com/',
        '2503.T':'https://www.kirinholdings.com/jp/','2531.T':'https://www.takara.co.jp/',
        '2579.T':'https://www.ccbji.co.jp/','2587.T':'https://www.suntory.co.jp/',
        '2590.T':'https://www.dydo-ghd.co.jp/','2593.T':'https://www.itoen.co.jp/',
        '2602.T':'https://www.nisshin-oillio.com/','2651.T':'https://www.lawson.co.jp/',
        '2678.T':'https://www.askul.co.jp/','2702.T':'https://www.mcd-holdings.co.jp/',
        '2768.T':'https://www.sojitz.com/jp/','2801.T':'https://www.kikkoman.co.jp/',
        '2802.T':'https://www.ajinomoto.co.jp/','2871.T':'https://www.nichirei.co.jp/',
        '2897.T':'https://www.nissin.com/jp/','2914.T':'https://www.jti.co.jp/',
        '3048.T':'https://www.biccamera.co.jp/','3086.T':'https://www.j-front-retailing.com/',
        '3099.T':'https://www.imhds.co.jp/','3101.T':'https://www.toyobo.co.jp/',
        '3105.T':'https://www.nisshinbo.co.jp/','3107.T':'https://www.daiwabo-hd.co.jp/',
        '3116.T':'https://www.toyota-boshoku.com/jp/','3141.T':'https://www.welcia-yakkyoku.co.jp/',
        '3197.T':'https://www.skylark.co.jp/','3231.T':'https://www.nomura-re.co.jp/',
        '3289.T':'https://www.tokyu-fudosan-hd.co.jp/','3291.T':'https://www.iida-group.co.jp/',
        '3382.T':'https://www.7andi.com/','3401.T':'https://www.teijin.co.jp/',
        '3402.T':'https://www.toray.co.jp/','3407.T':'https://www.asahi-kasei.co.jp/',
        '3436.T':'https://www.sumcosi.com/','3659.T':'https://www.nexon.co.jp/',
        '3765.T':'https://www.gungho.jp/','3863.T':'https://www.nipponpapergroup.com/',
        '3864.T':'https://www.mpm.co.jp/','3865.T':'https://www.hokuetsu.co.jp/',
        '4004.T':'https://www.resonac.com/jp/','4005.T':'https://www.sumitomo-chem.co.jp/',
        '4021.T':'https://www.nissanchem.co.jp/','4042.T':'https://www.tosoh.co.jp/',
        '4043.T':'https://www.tokuyama.co.jp/','4061.T':'https://www.denka.co.jp/',
        '4063.T':'https://www.shinetsu.co.jp/','4151.T':'https://www.kyowakirin.co.jp/',
        '4183.T':'https://www.mitsuichem.com/jp/','4188.T':'https://www.mitsubishichemicalgroup.com/jp/',
        '4202.T':'https://www.daicel.com/','4204.T':'https://www.sekisui.co.jp/',
        '4272.T':'https://www.nipponkayaku.co.jp/','4307.T':'https://www.nri.com/jp/',
        '4324.T':'https://www.group.dentsu.com/jp/','4385.T':'https://about.mercari.com/',
        '4452.T':'https://www.kao.com/jp/','4489.T':'https://www.persol-group.co.jp/',
        '4502.T':'https://www.takeda.com/ja-jp/','4503.T':'https://www.astellas.com/jp/',
        '4506.T':'https://www.sumitomo-pharma.co.jp/','4507.T':'https://www.shionogi.com/jp/ja/',
        '4519.T':'https://www.chugai-pharm.co.jp/','4523.T':'https://www.eisai.co.jp/',
        '4528.T':'https://www.ono.co.jp/','4536.T':'https://www.santen.co.jp/ja/',
        '4543.T':'https://www.terumo.co.jp/','4568.T':'https://www.daiichisankyo.co.jp/',
        '4578.T':'https://www.otsuka.co.jp/','4612.T':'https://www.nipponpaint-holdings.com/jp/',
        '4613.T':'https://www.kansai.co.jp/','4631.T':'https://www.dic.co.jp/',
        '4661.T':'https://www.olc.co.jp/','4684.T':'https://www.obic.co.jp/',
        '4689.T':'https://lyc.yahoo.co.jp/','4704.T':'https://www.trendmicro.com/ja_jp/',
        '4751.T':'https://www.cyberagent.co.jp/','4755.T':'https://corp.rakuten.co.jp/',
        '4768.T':'https://www.otsuka-shokai.co.jp/','4901.T':'https://fujifilm.com/jp/ja/',
        '4902.T':'https://www.konicaminolta.jp/','4911.T':'https://corp.shiseido.com/jp/',
        '4912.T':'https://www.lion.co.jp/ja/','4967.T':'https://www.kobayashi.co.jp/',
        '5019.T':'https://www.idemitsu.com/jp/','5020.T':'https://www.eneos.co.jp/',
        '5101.T':'https://www.y-yokohama.com/','5105.T':'https://www.toyo-tire.co.jp/',
        '5108.T':'https://www.bridgestone.co.jp/','5110.T':'https://www.srigroup.co.jp/',
        '5201.T':'https://www.agc.com/ja/','5214.T':'https://www.neg.co.jp/',
        '5233.T':'https://www.taiheiyo-cement.co.jp/','5301.T':'https://www.tokaicarbon.co.jp/',
        '5332.T':'https://www.toto.co.jp/','5333.T':'https://www.ngk-insulators.com/ja/',
        '5334.T':'https://www.ngkntk.co.jp/','5401.T':'https://www.nipponsteel.com/',
        '5406.T':'https://www.kobelco.co.jp/','5411.T':'https://www.jfe-holdings.co.jp/',
        '5471.T':'https://www.daido-steel.co.jp/','5486.T':'https://www.proterial.com/japan/',
        '5703.T':'https://www.nikkeikin.co.jp/','5706.T':'https://www.mmc.co.jp/',
        '5713.T':'https://www.smm.co.jp/','5714.T':'https://www.dowa.co.jp/',
        '5801.T':'https://www.furukawa.co.jp/','5802.T':'https://global-sei.com/jp/',
        '5803.T':'https://www.fujikura.co.jp/','6098.T':'https://recruit-holdings.com/ja/',
        '6301.T':'https://www.komatsu.com/ja/','6302.T':'https://www.shi.co.jp/',
        '6305.T':'https://www.hitachicm.com/jp/','6326.T':'https://www.kubota.co.jp/',
        '6328.T':'https://www.ebara.co.jp/','6367.T':'https://www.daikin.co.jp/',
        '6370.T':'https://www.kurita.co.jp/','6395.T':'https://www.tadano.co.jp/',
        '6406.T':'https://www.fujitec.co.jp/','6412.T':'https://www.heiwa.co.jp/',
        '6436.T':'https://www.amano.co.jp/','6448.T':'https://www.brother.co.jp/',
        '6457.T':'https://www.glory.co.jp/','6465.T':'https://www.hoshizaki.co.jp/',
        '6471.T':'https://www.nsk.com/jp/','6472.T':'https://www.ntn.co.jp/',
        '6473.T':'https://www.jtekt.co.jp/','6474.T':'https://www.nachi-fujikoshi.co.jp/',
        '6477.T':'https://www.nabtesco.co.jp/','6479.T':'https://www.minebeamitsumi.com/jpn/',
        '6481.T':'https://www.thk.com/jp/','6501.T':'https://www.hitachi.co.jp/',
        '6502.T':'https://www.toshiba.co.jp/','6503.T':'https://www.mitsubishielectric.co.jp/',
        '6504.T':'https://www.fujielectric.co.jp/','6506.T':'https://www.yaskawa.co.jp/',
        '6526.T':'https://www.socionext.com/jp/','6532.T':'https://www.baycurrent.co.jp/',
        '6594.T':'https://www.nidec.com/ja-JP/','6645.T':'https://www.omron.com/jp/ja/',
        '6701.T':'https://jpn.nec.com/','6702.T':'https://www.fujitsu.com/jp/',
        '6723.T':'https://www.renesas.com/jp/ja/','6724.T':'https://corporate.epson/ja/',
        '6750.T':'https://www.elecom.co.jp/','6752.T':'https://holdings.panasonic/jp/',
        '6753.T':'https://corporate.jp.sharp/','6754.T':'https://www.anritsu.com/ja-JP/',
        '6758.T':'https://www.sony.com/ja/','6762.T':'https://www.tdk.com/ja/',
        '6770.T':'https://www.alpsalpine.com/j/','6806.T':'https://www.hirose.com/ja/',
        '6841.T':'https://www.yokogawa.com/jp/','6845.T':'https://www.azbil.com/jp/',
        '6856.T':'https://www.horiba.com/jpn/','6857.T':'https://www.advantest.com/ja/',
        '6861.T':'https://www.keyence.co.jp/','6869.T':'https://www.sysmex.co.jp/',
        '6902.T':'https://www.denso.com/jp/ja/','6920.T':'https://www.lasertec.co.jp/',
        '6923.T':'https://www.stanley.co.jp/','6925.T':'https://www.ushio.co.jp/',
        '6951.T':'https://www.jeol.co.jp/','6952.T':'https://casio.com/jp/',
        '6954.T':'https://www.fanuc.co.jp/','6963.T':'https://www.rohm.co.jp/',
        '6965.T':'https://www.hamamatsu.com/jp/ja/','6966.T':'https://www.mitsui-high-tec.com/jp/',
        '6971.T':'https://www.kyocera.co.jp/','6976.T':'https://www.yuden.co.jp/',
        '6981.T':'https://www.murata.com/ja-jp/','6988.T':'https://www.nitto.com/jp/ja/',
        '7003.T':'https://www.mes.co.jp/','7004.T':'https://www.hitachizosen.co.jp/',
        '7011.T':'https://www.mhi.com/jp/','7012.T':'https://www.khi.co.jp/',
        '7013.T':'https://www.ihi.co.jp/','7201.T':'https://www.nissan.co.jp/',
        '7202.T':'https://www.isuzu.co.jp/','7203.T':'https://www.toyota.co.jp/',
        '7211.T':'https://www.mitsubishi-motors.co.jp/','7261.T':'https://www.mazda.co.jp/',
        '7267.T':'https://www.honda.co.jp/','7269.T':'https://www.suzuki.co.jp/',
        '7270.T':'https://www.subaru.co.jp/','7272.T':'https://global.yamaha-motor.com/jp/',
        '7309.T':'https://www.shimano.com/ja/','7453.T':'https://ryohin-keikaku.jp/',
        '7731.T':'https://www.nikon.co.jp/','7733.T':'https://www.olympus.co.jp/',
        '7735.T':'https://www.disco.co.jp/','7741.T':'https://www.hoya.co.jp/',
        '7751.T':'https://canon.jp/','7752.T':'https://jp.ricoh.com/',
        '7762.T':'https://citizen.jp/','7832.T':'https://www.bandainamco.co.jp/',
        '7911.T':'https://www.toppan.co.jp/','7912.T':'https://www.dnp.co.jp/',
        '7974.T':'https://www.nintendo.co.jp/','8001.T':'https://www.itochu.co.jp/ja/',
        '8002.T':'https://www.marubeni.com/jp/','8015.T':'https://www.toyota-tsusho.com/',
        '8031.T':'https://www.mitsui.com/jp/ja/','8035.T':'https://www.tel.com/jp/',
        '8053.T':'https://www.sumitomocorp.com/ja/jp/','8058.T':'https://www.mitsubishicorp.com/jp/ja/',
        '8113.T':'https://www.unicharm.co.jp/','8136.T':'https://www.sanrio.co.jp/',
        '8233.T':'https://www.takashimaya.co.jp/','8252.T':'https://www.0101maruigroup.co.jp/',
        '8253.T':'https://corporate.saisoncard.co.jp/','8267.T':'https://www.aeon.info/',
        '8306.T':'https://www.mufg.jp/','8309.T':'https://www.smth.co.jp/',
        '8316.T':'https://www.smfg.co.jp/','8331.T':'https://www.chibabank.co.jp/',
        '8332.T':'https://www.concordia-fg.jp/','8354.T':'https://www.fukuoka-fg.com/',
        '8355.T':'https://www.shizuokabank.co.jp/','8359.T':'https://www.82bank.co.jp/',
        '8369.T':'https://www.kyotobank.co.jp/','8377.T':'https://www.hokuhoku-fg.co.jp/',
        '8379.T':'https://www.hirogingroup.co.jp/','8381.T':'https://www.gogin.co.jp/',
        '8382.T':'https://www.chugin.co.jp/','8411.T':'https://www.mizuho-fg.co.jp/',
        '8591.T':'https://www.orix.co.jp/','8604.T':'https://www.nomura.co.jp/',
        '8630.T':'https://www.sompo-hd.com/','8725.T':'https://www.ms-ad-hd.com/',
        '8750.T':'https://www.dai-ichi-life-hd.com/','8766.T':'https://www.tokiomarinehd.com/',
        '8795.T':'https://www.taiyo-seimei.co.jp/','8801.T':'https://www.mitsuifudosan.co.jp/',
        '8802.T':'https://www.mec.co.jp/','8830.T':'https://www.sumitomo-rd.co.jp/',
        '9001.T':'https://www.tobu.co.jp/','9005.T':'https://www.tokyu.co.jp/',
        '9006.T':'https://www.keikyu.co.jp/','9007.T':'https://www.odakyu.jp/',
        '9008.T':'https://www.keio.co.jp/','9009.T':'https://www.keisei.co.jp/',
        '9020.T':'https://www.jreast.co.jp/','9021.T':'https://www.westjr.co.jp/',
        '9022.T':'https://jr-central.co.jp/','9062.T':'https://www.nittsu.co.jp/',
        '9064.T':'https://www.yamato-hd.co.jp/','9101.T':'https://www.nyk.com/',
        '9104.T':'https://www.mol.co.jp/','9107.T':'https://www.kline.co.jp/',
        '9201.T':'https://www.jal.com/ja/','9202.T':'https://www.ana.co.jp/',
        '9301.T':'https://www.mitsubishi-logistics.co.jp/','9412.T':'https://www.skyperfectjsat.space/',
        '9432.T':'https://www.ntt.co.jp/','9433.T':'https://www.kddi.com/',
        '9434.T':'https://www.softbank.jp/','9501.T':'https://www.tepco.co.jp/',
        '9502.T':'https://www.chuden.co.jp/','9503.T':'https://www.kepco.co.jp/',
        '9531.T':'https://www.tokyo-gas.co.jp/','9532.T':'https://www.osakagas.co.jp/',
        '9602.T':'https://www.toho.co.jp/','9613.T':'https://www.nttdata.com/jp/ja/',
        '9618.T':'https://www.ichijo.co.jp/','9719.T':'https://www.scsk.jp/',
        '9735.T':'https://www.secom.co.jp/','9766.T':'https://www.konami.com/jp/',
        '9983.T':'https://www.fastretailing.com/jp/','9984.T':'https://www.softbankgroup.com/ja/',
      };

      let customStocks = [];
      let customRenderSeq = 0;
      const STOCK_ALIASES = [
        { keys: ['トヨタ', 'トヨタ自動車', 'toyota', 'toyota motor'], symbol: '7203.T', name: 'トヨタ自動車' },
        { keys: ['三菱自動車', '三菱自動車工業', 'mitsubishi motors', 'mitsubishi motor'], symbol: '7211.T', name: '三菱自動車工業' },
        { keys: ['ソニー', 'sony', 'ソニーグループ'], symbol: '6758.T', name: 'ソニーグループ' },
        { keys: ['任天堂', 'nintendo'], symbol: '7974.T', name: '任天堂' },
        { keys: ['キーエンス', 'keyence'], symbol: '6861.T', name: 'キーエンス' },
        { keys: ['三菱ufj', 'mufg', '三菱ufjフィナンシャル'], symbol: '8306.T', name: '三菱UFJフィナンシャル・グループ' },
        { keys: ['オープンアップグループ', 'openup', 'open up', 'openupgroup', '2154'], symbol: '2154.T', name: 'オープンアップグループ' },
        { keys: ['富士通', 'fujitsu'], symbol: '6702.T', name: '富士通' },
        { keys: ['日立', '日立製作所', 'hitachi'], symbol: '6501.T', name: '日立製作所' },
        { keys: ['nec', '日本電気'], symbol: '6701.T', name: '日本電気(NEC)' },
        { keys: ['東芝', 'toshiba'], symbol: '6502.T', name: '東芝' },
        { keys: ['パナソニック', 'panasonic'], symbol: '6752.T', name: 'パナソニック ホールディングス' },
        { keys: ['三菱電機', 'mitsubishi electric'], symbol: '6503.T', name: '三菱電機' },
        { keys: ['ホンダ', '本田', '本田技研', 'honda'], symbol: '7267.T', name: '本田技研工業' },
        { keys: ['日産', '日産自動車', 'nissan'], symbol: '7201.T', name: '日産自動車' },
        { keys: ['スバル', 'subaru', '富士重工'], symbol: '7270.T', name: 'SUBARU' },
        { keys: ['マツダ', 'mazda'], symbol: '7261.T', name: 'マツダ' },
        { keys: ['ソフトバンクグループ', 'softbank group', 'sbg'], symbol: '9984.T', name: 'ソフトバンクグループ' },
        { keys: ['ソフトバンク', 'softbank'], symbol: '9434.T', name: 'ソフトバンク' },
        { keys: ['ntt', '日本電信電話', 'nippon telegraph'], symbol: '9432.T', name: '日本電信電話(NTT)' },
        { keys: ['kddi', 'au'], symbol: '9433.T', name: 'KDDI' },
        { keys: ['楽天', '楽天グループ', 'rakuten'], symbol: '4755.T', name: '楽天グループ' },
        { keys: ['ファーストリテイリング', 'ユニクロ', 'uniqlo', 'fast retailing'], symbol: '9983.T', name: 'ファーストリテイリング' },
        { keys: ['リクルート', 'recruit'], symbol: '6098.T', name: 'リクルートホールディングス' },
        { keys: ['メルカリ', 'mercari'], symbol: '4385.T', name: 'メルカリ' },
        { keys: ['東京エレクトロン', 'tel', 'tokyo electron'], symbol: '8035.T', name: '東京エレクトロン' },
        { keys: ['アドバンテスト', 'advantest'], symbol: '6857.T', name: 'アドバンテスト' },
        { keys: ['信越化学', 'shinetsu', 'shin-etsu'], symbol: '4063.T', name: '信越化学工業' },
        { keys: ['三菱商事', 'mitsubishi corp'], symbol: '8058.T', name: '三菱商事' },
        { keys: ['三井物産', 'mitsui'], symbol: '8031.T', name: '三井物産' },
        { keys: ['伊藤忠', 'itochu'], symbol: '8001.T', name: '伊藤忠商事' },
        { keys: ['住友商事', 'sumitomo corp'], symbol: '8053.T', name: '住友商事' },
        { keys: ['丸紅', 'marubeni'], symbol: '8002.T', name: '丸紅' },
        { keys: ['イオン', 'aeon'], symbol: '8267.T', name: 'イオン' },
        { keys: ['セブンイレブン', 'セブン&アイ', '7&i', 'seven & i'], symbol: '3382.T', name: 'セブン&アイ・ホールディングス' },
        { keys: ['資生堂', 'shiseido'], symbol: '4911.T', name: '資生堂' },
        { keys: ['日本製鉄', '新日鉄', 'nippon steel'], symbol: '5401.T', name: '日本製鉄' },
        { keys: ['deна', 'dena'], symbol: '2432.T', name: 'DeNA' },
        { keys: ['サイバーエージェント', 'cyberagent'], symbol: '4751.T', name: 'サイバーエージェント' },
        // 追加
        { keys: ['旭化成', 'asahi kasei'], symbol: '3407.T', name: '旭化成' },
        { keys: ['花王', 'kao'], symbol: '4452.T', name: '花王' },
        { keys: ['武田薬品', '武田薬品工業', 'takeda'], symbol: '4502.T', name: '武田薬品工業' },
        { keys: ['アステラス', 'astellas'], symbol: '4503.T', name: 'アステラス製薬' },
        { keys: ['第一三共', 'daiichi sankyo'], symbol: '4568.T', name: '第一三共' },
        { keys: ['中外製薬', 'chugai'], symbol: '4519.T', name: '中外製薬' },
        { keys: ['エーザイ', 'eisai'], symbol: '4523.T', name: 'エーザイ' },
        { keys: ['塩野義', '塩野義製薬', 'shionogi'], symbol: '4507.T', name: '塩野義製薬' },
        { keys: ['大塚', '大塚HD', 'otsuka'], symbol: '4578.T', name: '大塚ホールディングス' },
        { keys: ['村田製作所', 'murata'], symbol: '6981.T', name: '村田製作所' },
        { keys: ['tdk'], symbol: '6762.T', name: 'TDK' },
        { keys: ['ファナック', 'fanuc'], symbol: '6954.T', name: 'ファナック' },
        { keys: ['デンソー', 'denso'], symbol: '6902.T', name: 'デンソー' },
        { keys: ['京セラ', 'kyocera'], symbol: '6971.T', name: '京セラ' },
        { keys: ['レーザーテック', 'lasertec'], symbol: '6920.T', name: 'レーザーテック' },
        { keys: ['ルネサス', 'renesas'], symbol: '6723.T', name: 'ルネサスエレクトロニクス' },
        { keys: ['オリエンタルランド', 'olc', 'disney japan'], symbol: '4661.T', name: 'オリエンタルランド' },
        { keys: ['三井住友', 'smfg', 'smbc'], symbol: '8316.T', name: '三井住友フィナンシャルグループ' },
        { keys: ['みずほ', 'mizuho'], symbol: '8411.T', name: 'みずほフィナンシャルグループ' },
        { keys: ['野村', '野村HD', 'nomura'], symbol: '8604.T', name: '野村ホールディングス' },
        { keys: ['オリックス', 'orix'], symbol: '8591.T', name: 'オリックス' },
        { keys: ['東京海上', 'tokio marine'], symbol: '8766.T', name: '東京海上ホールディングス' },
        { keys: ['三井不動産', 'mitsui fudosan'], symbol: '8801.T', name: '三井不動産' },
        { keys: ['三菱地所', 'mitsubishi estate'], symbol: '8802.T', name: '三菱地所' },
        { keys: ['jr東日本', '東日本旅客鉄道', 'jr east'], symbol: '9020.T', name: '東日本旅客鉄道' },
        { keys: ['jr東海', '東海旅客鉄道', 'jr central'], symbol: '9022.T', name: '東海旅客鉄道' },
        { keys: ['jr西日本', '西日本旅客鉄道', 'jr west'], symbol: '9021.T', name: '西日本旅客鉄道' },
        { keys: ['日本郵船', 'nyk'], symbol: '9101.T', name: '日本郵船' },
        { keys: ['商船三井', 'mol'], symbol: '9104.T', name: '商船三井' },
        { keys: ['川崎汽船', 'kline', 'k line'], symbol: '9107.T', name: '川崎汽船' },
        { keys: ['ana', '全日空', 'anaホールディングス'], symbol: '9202.T', name: 'ANAホールディングス' },
        { keys: ['jal', '日本航空'], symbol: '9201.T', name: '日本航空' },
        { keys: ['東京ガス', 'tokyo gas'], symbol: '9531.T', name: '東京ガス' },
        { keys: ['関西電力', 'kansai electric'], symbol: '9503.T', name: '関西電力' },
        { keys: ['東京電力', 'tepco'], symbol: '9501.T', name: '東京電力ホールディングス' },
        { keys: ['eneos', 'エネオス', '日本石油'], symbol: '5020.T', name: 'ENEOSホールディングス' },
        { keys: ['ブリヂストン', 'bridgestone'], symbol: '5108.T', name: 'ブリヂストン' },
        { keys: ['agc', '旭硝子'], symbol: '5201.T', name: 'AGC' },
        { keys: ['jfe'], symbol: '5411.T', name: 'JFEホールディングス' },
        { keys: ['住友金属鉱山', 'sumitomo metal mining'], symbol: '5713.T', name: '住友金属鉱山' },
        { keys: ['コマツ', 'komatsu'], symbol: '6301.T', name: 'コマツ' },
        { keys: ['クボタ', 'kubota'], symbol: '6326.T', name: 'クボタ' },
        { keys: ['ダイキン', 'daikin'], symbol: '6367.T', name: 'ダイキン工業' },
        { keys: ['セコム', 'secom'], symbol: '9735.T', name: 'セコム' },
        { keys: ['nttデータ', 'ntt data'], symbol: '9613.T', name: 'NTTデータグループ' },
        { keys: ['富士フイルム', 'fujifilm'], symbol: '4901.T', name: '富士フイルムホールディングス' },
        { keys: ['コニカミノルタ', 'konica minolta'], symbol: '4902.T', name: 'コニカミノルタ' },
        { keys: ['キヤノン', 'canon'], symbol: '7751.T', name: 'キヤノン' },
        { keys: ['ニコン', 'nikon'], symbol: '7731.T', name: 'ニコン' },
        { keys: ['hoya'], symbol: '7741.T', name: 'HOYA' },
        { keys: ['シスメックス', 'sysmex'], symbol: '6869.T', name: 'シスメックス' },
        { keys: ['テルモ', 'terumo'], symbol: '4543.T', name: 'テルモ' },
        { keys: ['小野薬品', 'ono pharma'], symbol: '4528.T', name: '小野薬品工業' },
        { keys: ['コナミ', 'konami'], symbol: '9766.T', name: 'コナミグループ' },
        { keys: ['バンダイナムコ', 'bandai namco'], symbol: '7832.T', name: 'バンダイナムコホールディングス' },
        { keys: ['東宝', 'toho'], symbol: '9602.T', name: '東宝' },
        { keys: ['電通', 'dentsu'], symbol: '4324.T', name: '電通グループ' },
        { keys: ['博報堂', 'hakuhodo'], symbol: '2433.T', name: '博報堂DYホールディングス' },
        { keys: ['セブン銀行', 'seven bank'], symbol: '8410.T', name: 'セブン銀行' },
        { keys: ['住友化学', 'sumitomo chemical'], symbol: '4005.T', name: '住友化学' },
        { keys: ['東レ', 'toray'], symbol: '3402.T', name: '東レ' },
        { keys: ['帝人', 'teijin'], symbol: '3401.T', name: '帝人' },
        { keys: ['日東電工', 'nitto denko'], symbol: '6988.T', name: '日東電工' },
        { keys: ['日本たばこ', 'jt', '日本たばこ産業'], symbol: '2914.T', name: '日本たばこ産業' },
        { keys: ['キリン', 'kirin'], symbol: '2503.T', name: 'キリンホールディングス' },
        { keys: ['アサヒ', 'asahi beer', 'asahi group'], symbol: '2502.T', name: 'アサヒグループホールディングス' },
        { keys: ['サントリー', 'suntory food'], symbol: '2587.T', name: 'サントリー食品インターナショナル' },
        { keys: ['味の素', 'ajinomoto'], symbol: '2802.T', name: '味の素' },
        { keys: ['明治', '明治HD', 'meiji'], symbol: '2269.T', name: '明治ホールディングス' },
        { keys: ['ヤクルト', 'yakult'], symbol: '2267.T', name: 'ヤクルト本社' },
        { keys: ['日本ハム', 'nippon ham'], symbol: '2282.T', name: '日本ハム' },
        { keys: ['伊藤園', 'ito en'], symbol: '2593.T', name: '伊藤園' },
        { keys: ['亀田製菓', 'kameda seika', 'kameda'], symbol: '2220.T', name: '亀田製菓' },
        { keys: ['大成建設', 'taisei', 'taisei corporation', '1801'], symbol: '1801.T', name: '大成建設' },
        { keys: ['ホクト', 'hokuto', '1379'], symbol: '1379.T', name: 'ホクト' },
        { keys: ['安藤ハザマ', '安藤・間', 'ando hazama', 'hazama ando', '1719'], symbol: '1719.T', name: '安藤ハザマ' },
        // 水産・食品
        { keys: ['極洋', 'kyokuyo', '1301'], symbol: '1301.T', name: '極洋' },
        { keys: ['日本水産', 'nissui', 'にっすい', '1332'], symbol: '1332.T', name: '日本水産' },
        { keys: ['マルハニチロ', 'maruha nichiro', '1333'], symbol: '1333.T', name: 'マルハニチロ' },
        // エネルギー
        { keys: ['inpex', 'インペックス', '1605'], symbol: '1605.T', name: 'INPEX' },
        { keys: ['石油資源開発', 'japex', 'ジャペックス', '1662'], symbol: '1662.T', name: '石油資源開発' },
        { keys: ['出光興産', '出光', 'idemitsu', '5019'], symbol: '5019.T', name: '出光興産' },
        { keys: ['中部電力', 'chuden', '9502'], symbol: '9502.T', name: '中部電力' },
        { keys: ['大阪ガス', 'osaka gas', '9532'], symbol: '9532.T', name: '大阪ガス' },
        // 建設・住宅
        { keys: ['コムシス', 'comsis', '1721'], symbol: '1721.T', name: 'コムシスホールディングス' },
        { keys: ['大林組', 'obayashi', '1802'], symbol: '1802.T', name: '大林組' },
        { keys: ['清水建設', 'shimizu', 'shimz', '1803'], symbol: '1803.T', name: '清水建設' },
        { keys: ['鹿島', '鹿島建設', 'kajima', '1812'], symbol: '1812.T', name: '鹿島建設' },
        { keys: ['大和ハウス', '大和ハウス工業', 'daiwa house', '1925'], symbol: '1925.T', name: '大和ハウス工業' },
        { keys: ['積水ハウス', 'sekisui house', '1928'], symbol: '1928.T', name: '積水ハウス' },
        { keys: ['jgc', 'jgchd', '日揮', '1963'], symbol: '1963.T', name: 'JGCホールディングス' },
        { keys: ['一条工務店', '9618'], symbol: '9618.T', name: '一条工務店ホールディングス' },
        // 食品・飲料
        { keys: ['日清製粉', 'nisshin seifun', '2002'], symbol: '2002.T', name: '日清製粉グループ本社' },
        { keys: ['山崎製パン', 'yamazaki', 'ヤマザキ', '2009'], symbol: '2009.T', name: '山崎製パン' },
        { keys: ['森永製菓', 'morinaga', '2201'], symbol: '2201.T', name: '森永製菓' },
        { keys: ['グリコ', '江崎グリコ', 'glico', '2206'], symbol: '2206.T', name: '江崎グリコ' },
        { keys: ['森永乳業', 'morinaga milk', '2264'], symbol: '2264.T', name: '森永乳業' },
        { keys: ['丸大食品', 'marudai', '2288'], symbol: '2288.T', name: '丸大食品' },
        { keys: ['伊藤ハム', '伊藤ハム米久', 'itoham', '2296'], symbol: '2296.T', name: '伊藤ハム米久ホールディングス' },
        { keys: ['サッポロ', 'sapporo', '2501'], symbol: '2501.T', name: 'サッポロホールディングス' },
        { keys: ['宝HD', 'タカラ', 'takara', '2531'], symbol: '2531.T', name: '宝ホールディングス' },
        { keys: ['コカコーラ', 'コカ・コーラ ボトラーズ', 'ccbji', '2579'], symbol: '2579.T', name: 'コカ・コーラ ボトラーズジャパン' },
        { keys: ['ダイドー', 'dydo', '2590'], symbol: '2590.T', name: 'ダイドーグループホールディングス' },
        { keys: ['日清オイリオ', 'nisshin oillio', '2602'], symbol: '2602.T', name: '日清オイリオグループ' },
        { keys: ['キッコーマン', 'kikkoman', '2801'], symbol: '2801.T', name: 'キッコーマン' },
        { keys: ['ニチレイ', 'nichirei', '2871'], symbol: '2871.T', name: 'ニチレイ' },
        { keys: ['日清食品', 'nissin foods', '2897'], symbol: '2897.T', name: '日清食品ホールディングス' },
        // 流通・小売
        { keys: ['ローソン', 'lawson', '2651'], symbol: '2651.T', name: 'ローソン' },
        { keys: ['アスクル', 'askul', '2678'], symbol: '2678.T', name: 'アスクル' },
        { keys: ['マクドナルド', '日本マクドナルド', 'mcd', '2702'], symbol: '2702.T', name: '日本マクドナルドホールディングス' },
        { keys: ['双日', 'sojitz', '2768'], symbol: '2768.T', name: '双日' },
        { keys: ['ビックカメラ', 'bic camera', '3048'], symbol: '3048.T', name: 'ビックカメラ' },
        { keys: ['jフロント', 'j.フロント', 'j front retailing', '3086'], symbol: '3086.T', name: 'J.フロントリテイリング' },
        { keys: ['三越伊勢丹', 'isetan mitsukoshi', '3099'], symbol: '3099.T', name: '三越伊勢丹ホールディングス' },
        { keys: ['ウエルシア', 'welcia', '3141'], symbol: '3141.T', name: 'ウエルシアホールディングス' },
        { keys: ['すかいらーく', 'skylark', '3197'], symbol: '3197.T', name: 'すかいらーくホールディングス' },
        { keys: ['良品計画', '無印良品', 'muji', '7453'], symbol: '7453.T', name: '良品計画' },
        { keys: ['髙島屋', '高島屋', 'takashimaya', '8233'], symbol: '8233.T', name: '髙島屋' },
        { keys: ['丸井', '丸井グループ', 'marui', '8252'], symbol: '8252.T', name: '丸井グループ' },
        // 不動産
        { keys: ['野村不動産', 'nomura real estate', '3231'], symbol: '3231.T', name: '野村不動産ホールディングス' },
        { keys: ['東急不動産', 'tokyu fudosan', '3289'], symbol: '3289.T', name: '東急不動産ホールディングス' },
        { keys: ['飯田グループ', 'iida group', '3291'], symbol: '3291.T', name: '飯田グループホールディングス' },
        { keys: ['住友不動産', 'sumitomo realty', '8830'], symbol: '8830.T', name: '住友不動産' },
        // 繊維・紙
        { keys: ['東洋紡', 'toyobo', '3101'], symbol: '3101.T', name: '東洋紡' },
        { keys: ['日清紡', 'nisshinbo', '3105'], symbol: '3105.T', name: '日清紡ホールディングス' },
        { keys: ['ダイワボウ', 'daiwabo', '3107'], symbol: '3107.T', name: 'ダイワボウホールディングス' },
        { keys: ['トヨタ紡織', 'toyota boshoku', '3116'], symbol: '3116.T', name: 'トヨタ紡織' },
        { keys: ['日本製紙', 'nippon paper', '3863'], symbol: '3863.T', name: '日本製紙' },
        { keys: ['三菱製紙', 'mitsubishi paper', '3864'], symbol: '3864.T', name: '三菱製紙' },
        { keys: ['北越コーポ', '北越コーポレーション', 'hokuetsu', '3865'], symbol: '3865.T', name: '北越コーポレーション' },
        // ゲーム・エンタメ
        { keys: ['ネクソン', 'nexon', '3659'], symbol: '3659.T', name: 'ネクソン' },
        { keys: ['ガンホー', 'gungho', '3765'], symbol: '3765.T', name: 'ガンホー・オンライン・エンターテイメント' },
        // 化学
        { keys: ['レゾナック', 'resonac', '4004'], symbol: '4004.T', name: 'レゾナック・ホールディングス' },
        { keys: ['日産化学', 'nissan chemical', '4021'], symbol: '4021.T', name: '日産化学' },
        { keys: ['東ソー', 'tosoh', '4042'], symbol: '4042.T', name: '東ソー' },
        { keys: ['トクヤマ', 'tokuyama', '4043'], symbol: '4043.T', name: 'トクヤマ' },
        { keys: ['デンカ', 'denka', '4061'], symbol: '4061.T', name: 'デンカ' },
        { keys: ['協和キリン', 'kyowa kirin', '4151'], symbol: '4151.T', name: '協和キリン' },
        { keys: ['三井化学', 'mitsui chemicals', '4183'], symbol: '4183.T', name: '三井化学' },
        { keys: ['三菱ケミカル', 'mitsubishi chemical', '4188'], symbol: '4188.T', name: '三菱ケミカルグループ' },
        { keys: ['ダイセル', 'daicel', '4202'], symbol: '4202.T', name: 'ダイセル' },
        { keys: ['積水化学', 'sekisui chemical', '4204'], symbol: '4204.T', name: '積水化学工業' },
        { keys: ['日本化薬', 'nippon kayaku', '4272'], symbol: '4272.T', name: '日本化薬' },
        { keys: ['日本ペイント', 'nippon paint', '4612'], symbol: '4612.T', name: '日本ペイントホールディングス' },
        { keys: ['関西ペイント', 'kansai paint', '4613'], symbol: '4613.T', name: '関西ペイント' },
        { keys: ['dic'], symbol: '4631.T', name: 'DIC' },
        { keys: ['住友ファーマ', 'sumitomo pharma', '4506'], symbol: '4506.T', name: '住友ファーマ' },
        { keys: ['参天製薬', 'santen', '4536'], symbol: '4536.T', name: '参天製薬' },
        { keys: ['ライオン', 'lion', '4912'], symbol: '4912.T', name: 'ライオン' },
        { keys: ['小林製薬', 'kobayashi pharma', '4967'], symbol: '4967.T', name: '小林製薬' },
        // IT・サービス
        { keys: ['野村総研', '野村総合研究所', 'nri', '4307'], symbol: '4307.T', name: '野村総合研究所' },
        { keys: ['パーソル', 'persol', '4489'], symbol: '4489.T', name: 'パーソルホールディングス' },
        { keys: ['オービック', 'obic', '4684'], symbol: '4684.T', name: 'オービック' },
        { keys: ['lyホールディングス', 'ly', 'yahoo japan', 'ヤフー', '4689'], symbol: '4689.T', name: 'LYホールディングス' },
        { keys: ['トレンドマイクロ', 'trend micro', '4704'], symbol: '4704.T', name: 'トレンドマイクロ' },
        { keys: ['大塚商会', 'otsuka shokai', '4768'], symbol: '4768.T', name: '大塚商会' },
        { keys: ['エレコム', 'elecom', '6750'], symbol: '6750.T', name: 'エレコム' },
        { keys: ['ベイカレント', 'baycurrent', '6532'], symbol: '6532.T', name: 'ベイカレント・コンサルティング' },
        { keys: ['scsk', '9719'], symbol: '9719.T', name: 'SCSK' },
        { keys: ['スカパー', 'skyperfect', '9412'], symbol: '9412.T', name: 'スカパーJSATホールディングス' },
        // ゴム
        { keys: ['横浜ゴム', 'yokohama rubber', '5101'], symbol: '5101.T', name: '横浜ゴム' },
        { keys: ['toyo tire', 'トーヨータイヤ', '5105'], symbol: '5105.T', name: 'TOYO TIRE' },
        { keys: ['住友ゴム', 'sumitomo rubber', '5110'], symbol: '5110.T', name: '住友ゴム工業' },
        // ガラス・土石
        { keys: ['日本電気硝子', 'neg', '5214'], symbol: '5214.T', name: '日本電気硝子' },
        { keys: ['太平洋セメント', 'taiheiyo cement', '5233'], symbol: '5233.T', name: '太平洋セメント' },
        { keys: ['東海カーボン', 'tokai carbon', '5301'], symbol: '5301.T', name: '東海カーボン' },
        { keys: ['toto', '5332'], symbol: '5332.T', name: 'TOTO' },
        { keys: ['日本ガイシ', 'ngk insulators', '5333'], symbol: '5333.T', name: '日本ガイシ' },
        { keys: ['日本特殊陶業', 'ngk spark plug', '5334'], symbol: '5334.T', name: '日本特殊陶業' },
        // 鉄鋼・非鉄金属
        { keys: ['神戸製鋼', '神戸製鋼所', 'kobelco', '5406'], symbol: '5406.T', name: '神戸製鋼所' },
        { keys: ['大同特殊鋼', 'daido steel', '5471'], symbol: '5471.T', name: '大同特殊鋼' },
        { keys: ['プロテリアル', 'proterial', '日立金属', '5486'], symbol: '5486.T', name: 'プロテリアル' },
        { keys: ['日本軽金属', 'nikkeikin', '5703'], symbol: '5703.T', name: '日本軽金属ホールディングス' },
        { keys: ['三菱マテリアル', 'mitsubishi materials', '5706'], symbol: '5706.T', name: '三菱マテリアル' },
        { keys: ['dowa', 'どわ', '5714'], symbol: '5714.T', name: 'DOWAホールディングス' },
        { keys: ['古河電工', '古河電気工業', 'furukawa electric', '5801'], symbol: '5801.T', name: '古河電気工業' },
        { keys: ['住友電工', '住友電気工業', 'sumitomo electric', '5802'], symbol: '5802.T', name: '住友電気工業' },
        { keys: ['フジクラ', 'fujikura', '5803'], symbol: '5803.T', name: 'フジクラ' },
        // 機械
        { keys: ['住友重機', '住友重機械', 'sumitomo heavy', '6302'], symbol: '6302.T', name: '住友重機械工業' },
        { keys: ['日立建機', 'hitachi construction', '6305'], symbol: '6305.T', name: '日立建機' },
        { keys: ['荏原製作所', 'ebara', '6328'], symbol: '6328.T', name: '荏原製作所' },
        { keys: ['栗田工業', 'kurita', '6370'], symbol: '6370.T', name: '栗田工業' },
        { keys: ['タダノ', 'tadano', '6395'], symbol: '6395.T', name: 'タダノ' },
        { keys: ['フジテック', 'fujitec', '6406'], symbol: '6406.T', name: 'フジテック' },
        { keys: ['平和', 'heiwa', '6412'], symbol: '6412.T', name: '平和' },
        { keys: ['アマノ', 'amano', '6436'], symbol: '6436.T', name: 'アマノ' },
        { keys: ['ブラザー', 'brother', '6448'], symbol: '6448.T', name: 'ブラザー工業' },
        { keys: ['グローリー', 'glory', '6457'], symbol: '6457.T', name: 'グローリー' },
        { keys: ['ホシザキ', 'hoshizaki', '6465'], symbol: '6465.T', name: 'ホシザキ' },
        { keys: ['日本精工', 'nsk', '6471'], symbol: '6471.T', name: '日本精工' },
        { keys: ['ntn', '6472'], symbol: '6472.T', name: 'NTN' },
        { keys: ['ジェイテクト', 'jtekt', '6473'], symbol: '6473.T', name: 'ジェイテクト' },
        { keys: ['不二越', 'nachi', '6474'], symbol: '6474.T', name: '不二越' },
        { keys: ['ナブテスコ', 'nabtesco', '6477'], symbol: '6477.T', name: 'ナブテスコ' },
        { keys: ['ミネベアミツミ', 'minebea mitsumi', '6479'], symbol: '6479.T', name: 'ミネベアミツミ' },
        { keys: ['thk', '6481'], symbol: '6481.T', name: 'THK' },
        { keys: ['安川電機', 'yaskawa', '6506'], symbol: '6506.T', name: '安川電機' },
        { keys: ['富士電機', 'fuji electric', '6504'], symbol: '6504.T', name: '富士電機' },
        { keys: ['ニデック', '日本電産', 'nidec', '6594'], symbol: '6594.T', name: 'ニデック' },
        { keys: ['オムロン', 'omron', '6645'], symbol: '6645.T', name: 'オムロン' },
        { keys: ['三菱重工', '三菱重工業', 'mitsubishi heavy', 'mhi', '7011'], symbol: '7011.T', name: '三菱重工業' },
        { keys: ['川崎重工', '川崎重工業', 'kawasaki heavy', '7012'], symbol: '7012.T', name: '川崎重工業' },
        { keys: ['ihi', '石川島播磨', '7013'], symbol: '7013.T', name: 'IHI' },
        { keys: ['三井e&s', '三井造船', '7003'], symbol: '7003.T', name: '三井E&Sホールディングス' },
        { keys: ['日立造船', 'hitachi zosen', '7004'], symbol: '7004.T', name: '日立造船' },
        // 電機・電子
        { keys: ['ソシオネクスト', 'socionext', '6526'], symbol: '6526.T', name: 'ソシオネクスト' },
        { keys: ['エプソン', 'epson', 'セイコーエプソン', '6724'], symbol: '6724.T', name: 'セイコーエプソン' },
        { keys: ['シャープ', 'sharp', '6753'], symbol: '6753.T', name: 'シャープ' },
        { keys: ['アンリツ', 'anritsu', '6754'], symbol: '6754.T', name: 'アンリツ' },
        { keys: ['アルプスアルパイン', 'alps alpine', '6770'], symbol: '6770.T', name: 'アルプスアルパイン' },
        { keys: ['ヒロセ電機', 'hirose', '6806'], symbol: '6806.T', name: 'ヒロセ電機' },
        { keys: ['横河電機', 'yokogawa', '6841'], symbol: '6841.T', name: '横河電機' },
        { keys: ['アズビル', 'azbil', '6845'], symbol: '6845.T', name: 'アズビル' },
        { keys: ['horiba', 'ホリバ', '6856'], symbol: '6856.T', name: 'HORIBA' },
        { keys: ['スタンレー電気', 'stanley electric', '6923'], symbol: '6923.T', name: 'スタンレー電気' },
        { keys: ['ウシオ電機', 'ushio', '6925'], symbol: '6925.T', name: 'ウシオ電機' },
        { keys: ['日本電子', 'jeol', '6951'], symbol: '6951.T', name: '日本電子' },
        { keys: ['カシオ', 'casio', '6952'], symbol: '6952.T', name: 'カシオ計算機' },
        { keys: ['ローム', 'rohm', '6963'], symbol: '6963.T', name: 'ローム' },
        { keys: ['浜松ホトニクス', 'hamamatsu photonics', '6965'], symbol: '6965.T', name: '浜松ホトニクス' },
        { keys: ['三井ハイテック', 'mitsui high-tec', '6966'], symbol: '6966.T', name: '三井ハイテック' },
        { keys: ['太陽誘電', 'taiyo yuden', '6976'], symbol: '6976.T', name: '太陽誘電' },
        { keys: ['sumco', 'サムコ', '3436'], symbol: '3436.T', name: 'SUMCO' },
        { keys: ['disco', 'ディスコ', '7735'], symbol: '7735.T', name: 'DISCO' },
        // 自動車・輸送機器
        { keys: ['いすゞ', 'isuzu', '7202'], symbol: '7202.T', name: 'いすゞ自動車' },
        { keys: ['スズキ', 'suzuki', '7269'], symbol: '7269.T', name: 'スズキ' },
        { keys: ['ヤマハ発動機', 'yamaha motor', '7272'], symbol: '7272.T', name: 'ヤマハ発動機' },
        { keys: ['シマノ', 'shimano', '7309'], symbol: '7309.T', name: 'シマノ' },
        // 精密機器
        { keys: ['オリンパス', 'olympus', '7733'], symbol: '7733.T', name: 'オリンパス' },
        { keys: ['リコー', 'ricoh', '7752'], symbol: '7752.T', name: 'リコー' },
        { keys: ['シチズン', '市民時計', 'citizen', '7762'], symbol: '7762.T', name: 'シチズン時計' },
        // 印刷
        { keys: ['toppan', 'トッパン', '凸版印刷', '7911'], symbol: '7911.T', name: 'TOPPAN' },
        { keys: ['dnp', '大日本印刷', '7912'], symbol: '7912.T', name: '大日本印刷' },
        // 商社
        { keys: ['豊田通商', 'toyota tsusho', '8015'], symbol: '8015.T', name: '豊田通商' },
        // 生活用品
        { keys: ['ユニチャーム', 'ユニ・チャーム', 'unicharm', '8113'], symbol: '8113.T', name: 'ユニ・チャーム' },
        { keys: ['サンリオ', 'sanrio', '8136'], symbol: '8136.T', name: 'サンリオ' },
        // 金融（クレジット・信託）
        { keys: ['クレディセゾン', 'credit saison', '8253'], symbol: '8253.T', name: 'クレディセゾン' },
        { keys: ['三井住友トラスト', 'smth', '8309'], symbol: '8309.T', name: '三井住友トラスト・ホールディングス' },
        // 地方銀行
        { keys: ['千葉銀行', 'chiba bank', '8331'], symbol: '8331.T', name: '千葉銀行' },
        { keys: ['コンコルディア', 'concordia', '横浜銀行', '8332'], symbol: '8332.T', name: 'コンコルディア・フィナンシャルグループ' },
        { keys: ['ふくおかfg', 'fukuoka fg', '8354'], symbol: '8354.T', name: 'ふくおかフィナンシャルグループ' },
        { keys: ['静岡銀行', 'shizuoka bank', '8355'], symbol: '8355.T', name: '静岡銀行' },
        { keys: ['八十二銀行', '82bank', '8359'], symbol: '8359.T', name: '八十二銀行' },
        { keys: ['京都銀行', 'kyoto bank', '8369'], symbol: '8369.T', name: '京都銀行' },
        { keys: ['ほくほくfg', 'hokuhoku', '北陸銀行', '8377'], symbol: '8377.T', name: 'ほくほくフィナンシャルグループ' },
        { keys: ['ひろぎん', '広島銀行', 'hiroshima bank', '8379'], symbol: '8379.T', name: 'ひろぎんホールディングス' },
        { keys: ['山陰合同銀行', 'gogin', '8381'], symbol: '8381.T', name: '山陰合同銀行' },
        { keys: ['中国銀行', 'chugoku bank', '8382'], symbol: '8382.T', name: '中国銀行' },
        // 保険
        { keys: ['sompo', 'そんぽ', '損保ジャパン', '8630'], symbol: '8630.T', name: 'SOMPOホールディングス' },
        { keys: ['ms&ad', 'msad', '三井住友海上', '8725'], symbol: '8725.T', name: 'MS&ADインシュアランスグループホールディングス' },
        { keys: ['第一生命', 'dai-ichi life', '8750'], symbol: '8750.T', name: '第一生命ホールディングス' },
        { keys: ['太陽生命', 'taiyo life', '8795'], symbol: '8795.T', name: '太陽生命保険' },
        // 鉄道・交通
        { keys: ['東武', '東武鉄道', 'tobu', '9001'], symbol: '9001.T', name: '東武鉄道' },
        { keys: ['東急', 'tokyu', '9005'], symbol: '9005.T', name: '東急' },
        { keys: ['京急', '京浜急行', 'keikyu', '9006'], symbol: '9006.T', name: '京浜急行電鉄' },
        { keys: ['小田急', 'odakyu', '9007'], symbol: '9007.T', name: '小田急電鉄' },
        { keys: ['京王', 'keio', '9008'], symbol: '9008.T', name: '京王電鉄' },
        { keys: ['京成', 'keisei', '9009'], symbol: '9009.T', name: '京成電鉄' },
        // 物流
        { keys: ['日本通運', 'nittsu', 'ntt logistics', '9062'], symbol: '9062.T', name: '日本通運' },
        { keys: ['ヤマト', 'yamato', '9064'], symbol: '9064.T', name: 'ヤマトホールディングス' },
        { keys: ['三菱倉庫', 'mitsubishi logistics', '9301'], symbol: '9301.T', name: '三菱倉庫' },
      ];
      window.STOCK_ALIASES = STOCK_ALIASES; // エージェントscriptブロックから参照するため公開

      function loadCustomStocks() {
        try {
          const parsed = JSON.parse(localStorage.getItem(CUSTOM_STOCKS_KEY) || '[]');
          customStocks = Array.isArray(parsed) ? parsed : [];
        } catch (e) {
          customStocks = [];
        }
      }

      function saveCustomStocks() {
        localStorage.setItem(CUSTOM_STOCKS_KEY, JSON.stringify(customStocks));
      }

      async function searchStockCandidates(query) {
        const raw = String(query || '').trim();
        if (!raw) return [];
        const normalized = raw.toLowerCase().replace(/[ \u3000]/g, '');

        const aliasMatches = STOCK_ALIASES.filter((item) =>
          item.keys.some((k) => {
            const nk = String(k).toLowerCase().replace(/[ \u3000]/g, '');
            return nk.includes(normalized) || normalized.includes(nk);
          })
        );
        if (aliasMatches.length) return aliasMatches;

        if (/^\d{4}$/.test(raw)) return [{ symbol: `${raw}.T`, name: `${raw}.T` }];

        const maybeSymbol = raw.toUpperCase();
        if (/^[\^A-Z0-9.\-]{1,12}$/.test(maybeSymbol)) {
          try { await fetchStock(maybeSymbol); return [{ symbol: maybeSymbol, name: raw }]; }
          catch (e) { /* fall through */ }
        }

        // Yahoo Finance Japan autoc（日本語会社名に最適化）
        const jpUrl = `https://autoc.finance.yahoo.co.jp/autoc?query=${encodeURIComponent(raw)}&region=1&lang=ja-JP`;
        const jpPayload = await fetchJsonWithProxies(jpUrl).catch(() => null);
        const jpResults = (jpPayload?.ResultSet?.Result || [])
          .filter(r => r.type === 'S')
          .map(r => ({ symbol: /^\d+$/.test(r.symbol) ? r.symbol + '.T' : r.symbol, name: r.name }));
        if (jpResults.length) return jpResults.slice(0, 7);

        // Yahoo Finance US search（英語・米株フォールバック）
        const searchUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(raw)}&lang=ja-JP&region=JP&quotesCount=10&newsCount=0`;
        const payload = await fetchJsonWithProxies(searchUrl).catch(() => null);
        // finance.result[0].quotes または quotes（旧フォーマット）に対応
        const quotes = payload?.finance?.result?.[0]?.quotes || payload?.quotes || [];
        const equities = quotes.filter((q) => q?.symbol && q.quoteType === 'EQUITY');
        const pool = equities.length ? equities : quotes.filter((q) => q?.symbol);
        return pool.slice(0, 7).map((q) => ({
          symbol: String(q.symbol),
          name: String(q.shortname || q.longname || q.symbol),
        }));
      }

      const stockCandidatesEl = document.getElementById('home-stock-candidates');

      function showStockCandidates(candidates) {
        stockCandidatesEl.innerHTML = candidates.map((c) =>
          `<li><button type="button" class="stock-candidate-btn" data-symbol="${escHtml(c.symbol)}" data-name="${escHtml(c.name)}">` +
          `${escHtml(c.name)} <small>(${escHtml(c.symbol)})</small></button></li>`
        ).join('');
        stockCandidatesEl.classList.add('active');
      }

      function hideStockCandidates() {
        stockCandidatesEl.classList.remove('active');
        stockCandidatesEl.innerHTML = '';
      }

      async function addStockItem(resolved) {
        const exists = customStocks.some(
          (s) => String(s.symbol).toUpperCase() === String(resolved.symbol).toUpperCase()
        );
        if (!exists) {
          customStocks.push({ id: Date.now() + Math.floor(Math.random() * 1000), name: resolved.name, symbol: resolved.symbol });
          saveCustomStocks();
        }
      }

      async function renderCustomStocks() {
        const seq = ++customRenderSeq;
        if (!customStocks.length) {
          stockCustomList.innerHTML = '<li class="dashboard-mini-item"><span>追加銘柄なし</span></li>';
          return;
        }

        stockCustomList.innerHTML = '<li class="dashboard-mini-item"><span>追加銘柄を取得中…</span></li>';
        const results = await Promise.allSettled(
          customStocks.map(async (item) => {
            const quote = await fetchStock(item.symbol);
            return { item, quote };
          })
        );
        if (seq !== customRenderSeq) return;

        stockCustomList.innerHTML = results.map((r, i) => {
          const item = customStocks[i];
          const url = COMPANY_URLS[item.symbol];
          const nameHtml = url
            ? `<a href="${url}" target="_blank" rel="noopener noreferrer" class="stock-company-link">${escHtml(item.name)}</a>`
            : escHtml(item.name);
          if (r.status === 'fulfilled') {
            const current = Number(r.value.quote.price);
            const prev = Number(r.value.quote.prev);
            const change = current - prev;
            const pct = prev ? (change / prev) * 100 : 0;
            const cls = change >= 0 ? 'dash-market-up' : 'dash-market-down';
            const dir = change >= 0 ? 'up' : 'down';
            const sign = change >= 0 ? '+' : '';
            const q = r.value.quote;
            const mcap = fmtMarketCap(q.marketCap, item.symbol);
            const industryJa = q.industry ? (INDUSTRY_JA[q.industry] || q.industry) : null;
            const shares = fmtShares(q.sharesOutstanding);
            const divYield = q.dividendYield ? (q.dividendYield * 100).toFixed(2) + '%' : null;
            const isTSE = /\.T$/i.test(item.symbol);
            const code = item.symbol.replace(/\.T$/i, '');
            const yutaiHtml = isTSE
              ? `<a class="sdc-yutai" href="https://kabutan.jp/stock/?code=${encodeURIComponent(code)}" target="_blank" rel="noopener noreferrer">株主優待↗</a>`
              : '';
            const detailChips = [
              industryJa ? `<span class="sdc-chip">業種 <b>${escHtml(industryJa)}</b></span>` : '',
              mcap       ? `<span class="sdc-chip">時価総額 <b>${escHtml(mcap)}</b></span>` : '',
              shares     ? `<span class="sdc-chip">発行済 <b>${escHtml(shares)}</b></span>` : '',
              divYield   ? `<span class="sdc-chip">配当 <b>${escHtml(divYield)}</b></span>` : '',
              yutaiHtml,
            ].join('');
            return `<li class="dashboard-mini-item col">
              <span style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">
                ${nameHtml} <small>(${escHtml(item.symbol)})</small>
              </span>
              <span style="display:flex;align-items:center;flex-wrap:wrap;gap:4px">
                <canvas class="stock-custom-sparkline" data-symbol="${escHtml(item.symbol)}" data-dir="${dir}"></canvas>
                <strong class="stock-val-flip">${fmtNum(current, 2)}</strong>
                <small class="${cls}">${sign}${fmtNum(change, 2)} (${sign}${pct.toFixed(2)}%)</small>
                <button class="dash-todo-btn" type="button" data-chart-stock="${escHtml(item.symbol)}" data-chart-name="${escHtml(item.name)}">📊</button>
                <button class="dash-todo-btn" type="button" data-remove-stock="${escHtml(String(item.id))}">削除</button>
                <span class="stock-detail-chips">${detailChips}</span>
              </span>
            </li>`;
          }
          return `<li class="dashboard-mini-item">
            <span>${nameHtml} <small>(${escHtml(item.symbol)})</small></span>
            <span><small>取得失敗</small> <button class="dash-todo-btn" type="button" data-remove-stock="${escHtml(String(item.id))}">削除</button></span>
          </li>`;
        }).join('');

        // ウォッチリスト スパークライン描画
        stockCustomList.querySelectorAll('canvas.stock-custom-sparkline').forEach(async cv => {
          const sym = cv.dataset.symbol, dir = cv.dataset.dir;
          const pts = await fetchStockHistoryMulti(sym, '1mo').catch(() => null);
          if (pts && pts.length >= 2) drawSparkline(cv, pts.slice(-7), dir);
        });
      }

      async function initStockCard() {
        const indices = [
          { symbol: '^GSPC', name: 'S&P500' },
          { symbol: '^N225', name: '日経225' },
          { symbol: '^DJI',  name: 'NYダウ' },
          { symbol: '^IXIC', name: 'NASDAQ' },
        ];

        // キャッシュを即時表示
        try {
          const cached = JSON.parse(localStorage.getItem(STOCK_SNAPSHOT_KEY) || 'null');
          if (cached && Array.isArray(cached.rows) && cached.rows.length) {
            renderStockRows(cached.rows, stockList);
            const updated = cached.updatedAt ? new Date(cached.updatedAt).toLocaleString('ja-JP') : '不明';
            stockTime.textContent = `前回: ${updated} / 更新中…`;
          } else {
            stockList.innerHTML = '<div class="stock-index-card"><div class="sic-name">読み込み中…</div></div>';
          }
        } catch (e) {
          stockList.innerHTML = '<div class="stock-index-card"><div class="sic-name">読み込み中…</div></div>';
        }

        const results = await Promise.allSettled(indices.map((item) => fetchStock(item.symbol)));
        const rows = [];

        results.forEach((result, i) => {
          if (result.status === 'fulfilled') {
            rows.push({
              name: indices[i].name,
              symbol: indices[i].symbol,
              price: result.value.price,
              prev: result.value.prev,
              marketCap: result.value.marketCap || null,
            });
          }
        });

        if (rows.length > 0) {
          renderStockRows(rows, stockList);
          localStorage.setItem(STOCK_SNAPSHOT_KEY, JSON.stringify({
            updatedAt: new Date().toISOString(),
            rows,
          }));
          const hhmm = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
          stockTime.textContent = `最終更新: ${hhmm}`;
          stockRetryBtn.style.display = 'none';
          return;
        }

        try {
          const cached = JSON.parse(localStorage.getItem(STOCK_SNAPSHOT_KEY) || 'null');
          if (cached && Array.isArray(cached.rows) && cached.rows.length) {
            renderStockRows(cached.rows, stockList);
            const updated = cached.updatedAt ? new Date(cached.updatedAt).toLocaleString('ja-JP') : '不明';
            stockTime.textContent = `最新取得失敗 / 前回データ: ${updated}`;
            stockRetryBtn.style.display = 'block';
            return;
          }
        } catch (e) { /* no-op */ }

        stockList.innerHTML = '<div class="stock-index-card"><div class="sic-name">株価指数の取得に失敗しました</div></div>';
        stockTime.textContent = '取得失敗';
        stockRetryBtn.style.display = 'block';
      }

      stockRetryBtn.addEventListener('click', () => {
        stockRetryBtn.style.display = 'none';
        stockRetryBtn.disabled = true;
        stockTime.textContent = '再取得中…';
        initStockCard().finally(() => { stockRetryBtn.disabled = false; });
      });

      updateMarketStatusBadges();
      setInterval(updateMarketStatusBadges, 60000);

      document.getElementById('home-stock-refresh-btn')?.addEventListener('click', async () => {
        const btn = document.getElementById('home-stock-refresh-btn');
        if (!btn || btn.disabled) return;
        btn.textContent = '⏳'; btn.disabled = true;
        const idxSymbols = ['^GSPC', '^N225', '^DJI', '^IXIC'];
        [...idxSymbols, ...customStocks.map(s => s.symbol)].forEach(sym => {
          localStorage.removeItem('dashboard-stock-quote-' + sym);
        });
        await initStockCard();
        btn.textContent = '🔄'; btn.disabled = false;
      });

      // 比較チャートのレンジタブ
      document.getElementById('home-compare-tabs')?.addEventListener('click', e => {
        const btn = e.target.closest('[data-crange]');
        if (!btn) return;
        compareRange = btn.dataset.crange;
        document.querySelectorAll('#home-compare-tabs .stock-tab-btn').forEach(b => b.classList.toggle('active', b === btn));
        renderCompareChart();
      });

      // リサイズ時に比較チャートを再描画（キャッシュデータから即時再描画）
      let compareResizeTimer = null;
      window.addEventListener('resize', () => {
        clearTimeout(compareResizeTimer);
        compareResizeTimer = setTimeout(() => {
          const canvas = document.getElementById('home-stock-compare-canvas');
          if (!canvas || !canvas._lastSeries) return;
          drawCompareChart(canvas, canvas._lastSeries);
        }, 200);
      });

      stockForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const query = stockInput.value.trim();
        if (!query) return;
        hideStockCandidates();
        const prevLabel = stockTime.textContent;
        stockTime.textContent = '銘柄を検索中…';
        stockInput.disabled = true;
        try {
          const candidates = await searchStockCandidates(query);
          if (!candidates.length) throw new Error('stock-search-not-found');
          if (candidates.length === 1) {
            await addStockItem(candidates[0]);
            stockInput.value = '';
            await renderCustomStocks();
            stockTime.textContent = `更新: ${new Date().toLocaleTimeString('ja-JP')}`;
          } else {
            showStockCandidates(candidates);
            stockTime.textContent = '候補を選択してください';
          }
        } catch (e) {
          stockTime.textContent = '銘柄が見つかりませんでした（会社名またはティッカーを確認）';
          setTimeout(() => {
            stockTime.textContent = prevLabel;
          }, 3000);
        } finally {
          stockInput.disabled = false;
        }
      });

      stockCandidatesEl.addEventListener('click', async (event) => {
        const btn = event.target.closest('.stock-candidate-btn');
        if (!btn) return;
        hideStockCandidates();
        await addStockItem({ symbol: btn.dataset.symbol, name: btn.dataset.name });
        stockInput.value = '';
        await renderCustomStocks();
        stockTime.textContent = `更新: ${new Date().toLocaleTimeString('ja-JP')}`;
      });

      document.addEventListener('click', (event) => {
        if (!stockCandidatesEl.classList.contains('active')) return;
        if (!stockForm.contains(event.target) && !stockCandidatesEl.contains(event.target)) {
          hideStockCandidates();
        }
      });

      stockCustomList.addEventListener('click', async (event) => {
        const target = event.target;
        if (!(target instanceof HTMLButtonElement)) return;

        if (target.dataset.chartStock) {
          const sym = target.dataset.chartStock;
          const nm = target.dataset.chartName || sym;
          if (activeChartSymbol === sym) {
            const chartArea = document.getElementById('home-stock-chart-area');
            if (chartArea) chartArea.style.display = 'none';
            activeChartSymbol = null;
          } else {
            renderStockChart(sym, nm, activeChartRange);
          }
          return;
        }

        const id = Number(target.dataset.removeStock);
        if (!id) return;
        customStocks = customStocks.filter((s) => Number(s.id) !== id);
        saveCustomStocks();
        if (activeChartSymbol) {
          const removed = !customStocks.some((s) => s.symbol === activeChartSymbol);
          if (removed) {
            const chartArea = document.getElementById('home-stock-chart-area');
            if (chartArea) chartArea.style.display = 'none';
            activeChartSymbol = null;
          }
        }
        await renderCustomStocks();
      });

      document.getElementById('home-stock-chart-area')?.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLButtonElement) || !target.dataset.range) return;
        activeChartRange = target.dataset.range;
        if (activeChartSymbol) renderStockChart(activeChartSymbol, activeChartName, activeChartRange);
      });

      function parseGasStations(rawHtml) {
        // gogo.gs HTML structure:
        //   <div class="price">150</div>
        //   <a class="shop-name" href="/shop/...">セルフ三郷前川SS / (有)浜島商店</a>
        const stations = [];
        const seen = new Set();
        const src = String(rawHtml || '');

        // Strategy 1a: price → shop-name (距離 1500 chars)
        const classPattern = /class="[^"]*\bprice\b[^"]*"[^>]*>\s*(\d{2,3})\s*<\/div>[\s\S]{0,1500}?class="[^"]*\bshop-name\b[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
        let m;
        while ((m = classPattern.exec(src)) !== null) {
          const price = Number(m[1]);
          if (price < 100 || price > 280) continue;
          const rawName = m[2].replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, '').trim();
          const name = rawName.split(/\s*[/／]\s*/)[0].trim();
          if (name.length >= 2 && !seen.has(name)) {
            seen.add(name);
            stations.push({ name, price });
          }
        }

        // Strategy 1b: shop-name → price（逆順パターン）
        if (stations.length < 3) {
          stations.length = 0;
          seen.clear();
          const revPattern = /class="[^"]*\bshop-name\b[^"]*"[^>]*>([\s\S]*?)<\/a>[\s\S]{0,1500}?class="[^"]*\bprice\b[^"]*"[^>]*>\s*(\d{2,3})\s*<\/div>/gi;
          while ((m = revPattern.exec(src)) !== null) {
            const price = Number(m[2]);
            if (price < 100 || price > 280) continue;
            const rawName = m[1].replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, '').trim();
            const name = rawName.split(/\s*[/／]\s*/)[0].trim();
            if (name.length >= 2 && !seen.has(name)) {
              seen.add(name);
              stations.push({ name, price });
            }
          }
        }

        // Strategy 2: text-based fallback
        if (stations.length < 3) {
          stations.length = 0;
          seen.clear();

          const text = src
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<\/(?:div|p|li|tr|td|a)>/gi, '\n')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&[a-z#0-9]+;/gi, ' ')
            .replace(/[ \t\u3000]+/g, ' ')
            .replace(/\n[ \t]*/g, '\n')
            .replace(/\n{3,}/g, '\n\n');

          const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
          const isName = c =>
            c.length >= 3 && c.length <= 60 &&
            /[ァ-ヶーぁ-ん一-龯a-zA-Zａ-ｚ]/.test(c) &&
            !/^\d+$/.test(c) &&
            !c.includes('更新') && !c.includes('時点') &&
            !c.includes('平均') && !c.includes('http');

          for (let i = 0; i < lines.length - 1; i++) {
            if (!/^\d{2,3}$/.test(lines[i])) continue;
            const price = Number(lines[i]);
            if (price < 100 || price > 280) continue;

            // 価格の後ろ12行以内で店舗名を探す
            for (let j = i + 1; j <= Math.min(lines.length - 1, i + 12); j++) {
              if (isName(lines[j])) {
                const name = lines[j].split(/\s*[/／]\s*/)[0].trim();
                if (name.length >= 2 && !seen.has(name)) {
                  seen.add(name);
                  stations.push({ name, price });
                }
                break;
              }
            }
          }

          // Strategy 2b: 店舗名が価格より前に来るパターン
          if (stations.length < 3) {
            stations.length = 0;
            seen.clear();
            for (let i = 0; i < lines.length - 1; i++) {
              if (!isName(lines[i])) continue;
              // 名前の後ろ12行以内で価格を探す
              for (let j = i + 1; j <= Math.min(lines.length - 1, i + 12); j++) {
                if (/^\d{2,3}$/.test(lines[j])) {
                  const price = Number(lines[j]);
                  if (price < 100 || price > 280) continue;
                  const name = lines[i].split(/\s*[/／]\s*/)[0].trim();
                  if (name.length >= 2 && !seen.has(name)) {
                    seen.add(name);
                    stations.push({ name, price });
                  }
                  break;
                }
              }
            }
          }
        }

        return stations.sort((a, b) => a.price - b.price).slice(0, 5);
      }

      function parseGasSnapshot(rawText) {
        const text = String(rawText || '')
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/gi, ' ')
          .replace(/&amp;/gi, '&')
          .replace(/&lt;/gi, '<')
          .replace(/&gt;/gi, '>')
          .replace(/\r/g, '\n')
          .replace(/[ \t\u3000]+/g, ' ')
          .replace(/\n+/g, '\n');

        const asOfRaw = text.match(/([0-9]{4}年[0-9]{1,2}月[0-9]{1,2}日[^ \n]*)\s*時点の平均価格/);
        const priceRaw = text.match(/時点の平均価格\s*([0-9]+(?:\.[0-9]+)?)/);
        const deltaRaw = text.match(/時点の平均価格\s*[0-9]+(?:\.[0-9]+)?\s*([+\-−]\s*[0-9]+(?:\.[0-9]+)?)/);
        const coverageRaw = text.match(/価格情報カバー率\s*([0-9]+(?:\.[0-9]+)?%)\s*([0-9]+\s*\/\s*[0-9]+)/);

        if (!asOfRaw || !priceRaw) return null;
        const delta = deltaRaw ? deltaRaw[1].replace(/\s+/g, '').replace('−', '-') : null;
        return {
          asOf: `${asOfRaw[1]}時点の平均価格`,
          price: priceRaw[1],
          delta,
          coverageRate: coverageRaw ? coverageRaw[1] : null,
          coverageCount: coverageRaw ? coverageRaw[2].replace(/\s+/g, '') : null,
        };
      }

      function renderGasSnapshot(snapshot, stale) {
        const deltaNum = snapshot.delta ? Number(snapshot.delta) : 0;
        const deltaCls = deltaNum > 0 ? 'dash-market-up' : deltaNum < 0 ? 'dash-market-down' : '';

        gasList.innerHTML = `
          <li class="dashboard-mini-item"><span>平均価格</span><strong>${escHtml(snapshot.price)} 円/L</strong></li>
          <li class="dashboard-mini-item"><span>前回比</span><small class="${deltaCls}">${snapshot.delta ? escHtml(snapshot.delta) : '—'} 円</small></li>
          <li class="dashboard-mini-item"><span>カバー率</span><small>${snapshot.coverageRate ? escHtml(snapshot.coverageRate) : '—'} ${snapshot.coverageCount ? `(${escHtml(snapshot.coverageCount)})` : ''}</small></li>
        `;

        gasTime.textContent = stale
          ? `最新取得失敗 / 前回データ表示: ${snapshot.asOf}`
          : `${snapshot.asOf} / 出典: gogo.gs`;
      }

      async function fetchGasHtml(muniCd) {
        const code = muniCd || '11237';
        const target = `https://gogo.gs/${code}?device=sp`;
        const enc = encodeURIComponent(target);
        const tryRaw = (url, timeout) =>
          fetchWithTimeout(url, timeout)
            .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
            .then(b => { if (!b || b.length < 300) throw new Error('short'); return b; });
        const tryJson = (url, timeout) =>
          fetchWithTimeout(url, timeout)
            .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(d => { const b = String(d.contents || ''); if (b.length < 300) throw new Error('short'); return b; });
        return Promise.any([
          tryRaw(`https://corsproxy.io/?${enc}`, 12000),
          tryJson(`https://api.allorigins.win/get?url=${enc}`, 12000),
          tryRaw(`https://api.allorigins.win/raw?url=${enc}`, 12000),
          tryRaw(`https://api.codetabs.com/v1/proxy?quest=${target}`, 12000),
          tryRaw(`https://thingproxy.freeboard.io/fetch/${target}`, 12000),
        ]);
      }

      const GAS_HISTORY_KEY = 'gas-price-history-v1';

      function getGasPriceHistory() {
        try { return JSON.parse(localStorage.getItem(GAS_HISTORY_KEY) || '{}'); }
        catch (e) { return {}; }
      }

      function saveGasPriceToHistory(priceStr) {
        const price = parseFloat(String(priceStr).replace(/[^\d.]/g, ''));
        if (!price) return;
        const today = toDateKey(new Date());
        const hist = getGasPriceHistory();
        hist[today] = price;
        // 最大180日分保持
        const keys = Object.keys(hist).sort();
        if (keys.length > 180) keys.slice(0, keys.length - 180).forEach(k => delete hist[k]);
        localStorage.setItem(GAS_HISTORY_KEY, JSON.stringify(hist));
      }

      function buildGasChartData(period) {
        const hist = getGasPriceHistory();
        const allDates = Object.keys(hist).sort();

        if (period === 'daily') {
          const slice = allDates.slice(-30);
          return {
            labels: slice.map(d => d.slice(5).replace('-', '/')),
            values: slice.map(d => hist[d]),
          };
        }

        // 月集計
        const byMonth = {};
        allDates.forEach(d => {
          const m = d.slice(0, 7);
          if (!byMonth[m]) byMonth[m] = [];
          byMonth[m].push(hist[d]);
        });
        const limit = period === '6month' ? 6 : 12;
        const months = Object.keys(byMonth).sort().slice(-limit);
        return {
          labels: months.map(m => m.slice(5) + '月'),
          values: months.map(m => {
            const arr = byMonth[m];
            return arr.reduce((a, b) => a + b, 0) / arr.length;
          }),
        };
      }

      function renderGasChart(period) {
        const canvas = document.getElementById('home-gas-chart');
        const msg = document.getElementById('home-gas-chart-msg');
        if (!canvas || !msg) return;

        const { labels, values } = buildGasChartData(period);

        if (values.length === 0) {
          canvas.style.display = 'none';
          msg.style.display = '';
          return;
        }
        canvas.style.display = '';
        msg.style.display = values.length === 1 ? '' : 'none';
        if (values.length === 1) msg.textContent = '本日分を記録しました。翌日以降に折れ線グラフになります';

        const dpr = window.devicePixelRatio || 1;
        const W = canvas.offsetWidth || 280;
        const H = 100;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        const pad = { top: 16, bottom: 22, left: 44, right: 10 };
        const cW = W - pad.left - pad.right;
        const cH = H - pad.top - pad.bottom;
        const n = values.length;

        const minV = Math.min(...values);
        const maxV = Math.max(...values);
        const margin = (maxV - minV) * 0.15 || 1;
        const lo = minV - margin;
        const hi = maxV + margin;

        const xOf = i => pad.left + (n === 1 ? cW / 2 : (i / (n - 1)) * cW);
        const yOf = v => pad.top + (1 - (v - lo) / (hi - lo)) * cH;

        ctx.clearRect(0, 0, W, H);

        // グリッド
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        [0.33, 0.66].forEach(t => {
          const y = pad.top + t * cH;
          ctx.beginPath();
          ctx.moveTo(pad.left, y);
          ctx.lineTo(pad.left + cW, y);
          ctx.stroke();
        });
        ctx.restore();

        // グラデーション塗り
        const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + cH);
        grad.addColorStop(0, 'rgba(249,115,22,0.22)');
        grad.addColorStop(1, 'rgba(249,115,22,0)');
        ctx.beginPath();
        values.forEach((v, i) => {
          if (i === 0) ctx.moveTo(xOf(i), yOf(v));
          else {
            const cpx = (xOf(i - 1) + xOf(i)) / 2;
            ctx.bezierCurveTo(cpx, yOf(values[i - 1]), cpx, yOf(v), xOf(i), yOf(v));
          }
        });
        ctx.lineTo(xOf(n - 1), pad.top + cH);
        ctx.lineTo(xOf(0), pad.top + cH);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        // ライン
        ctx.beginPath();
        values.forEach((v, i) => {
          if (i === 0) ctx.moveTo(xOf(i), yOf(v));
          else {
            const cpx = (xOf(i - 1) + xOf(i)) / 2;
            ctx.bezierCurveTo(cpx, yOf(values[i - 1]), cpx, yOf(v), xOf(i), yOf(v));
          }
        });
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#f97316';
        ctx.shadowBlur = 6;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // 最新点
        ctx.beginPath();
        ctx.arc(xOf(n - 1), yOf(values[n - 1]), 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#f97316';
        ctx.fill();

        // Y軸ラベル
        ctx.fillStyle = 'rgba(120,140,160,0.85)';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`${maxV.toFixed(1)}`, pad.left - 3, pad.top + 8);
        ctx.fillText(`${minV.toFixed(1)}`, pad.left - 3, pad.top + cH);
        ctx.fillStyle = 'rgba(120,140,160,0.55)';
        ctx.font = '8px sans-serif';
        ctx.fillText('円/L', pad.left - 3, pad.top + cH / 2 + 4);

        // X軸ラベル（最初・最後）
        ctx.fillStyle = 'rgba(120,140,160,0.7)';
        ctx.font = '8px sans-serif';
        if (n === 1) {
          ctx.textAlign = 'center';
          ctx.fillText(labels[0], xOf(0), H - 5);
          // 価格ラベル
          ctx.fillStyle = '#f97316';
          ctx.font = 'bold 11px sans-serif';
          ctx.fillText(`${values[0].toFixed(1)} 円/L`, xOf(0), yOf(values[0]) - 8);
        } else {
          ctx.textAlign = 'left';
          ctx.fillText(labels[0], pad.left, H - 5);
          ctx.textAlign = 'right';
          ctx.fillText(labels[n - 1], pad.left + cW, H - 5);
        }
      }

      // タブ切り替え
      document.querySelectorAll('.gas-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.gas-tab-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          renderGasChart(btn.dataset.gasPeriod);
        });
      });

      // 📍 現在地ボタン: キャッシュをクリアして再取得
      document.getElementById('gas-locate-btn')?.addEventListener('click', () => {
        const btn = document.getElementById('gas-locate-btn');
        if (btn) { btn.disabled = true; btn.textContent = '取得中…'; }
        initGasCard(true).finally(() => {
          if (btn) { btn.disabled = false; btn.textContent = '📍 現在地'; }
        });
      });

      // gogo.gs HTML のスクリプトタグから価格履歴配列を抽出
      function parseGasHistory(rawHtml) {
        const scriptRe = /<script[^>]*>([\s\S]*?)<\/script>/gi;
        let allScript = '';
        let m;
        while ((m = scriptRe.exec(rawHtml)) !== null) allScript += m[1] + '\n';

        const candidates = [];
        // 100〜260 円の範囲の数値が4つ以上連続する配列を探す
        const arrayRe = /\[([12][0-9]{2}(?:\.[0-9]+)?(?:\s*,\s*[12][0-9]{2}(?:\.[0-9]+)?){3,})\]/g;
        while ((m = arrayRe.exec(allScript)) !== null) {
          try {
            const arr = JSON.parse(`[${m[1]}]`);
            if (arr.length >= 4 && arr.every(v => v >= 100 && v <= 260)) candidates.push(arr);
          } catch (e) {}
        }
        if (!candidates.length) return null;
        // 最もデータ点数が多い配列を採用
        return candidates.sort((a, b) => b.length - a.length)[0];
      }

      // 月次価格配列から localStorage へシード（実測値は上書きしない）
      function seedGasPriceHistory(prices) {
        const hist = getGasPriceHistory();
        const now = new Date();
        prices.forEach((price, i) => {
          const offset = prices.length - 1 - i;
          const d = new Date(now.getFullYear(), now.getMonth() - offset, 15);
          const key = toDateKey(d);
          if (!(key in hist)) hist[key] = Number(price);
        });
        const trimmed = {};
        Object.keys(hist).sort().slice(-180).forEach(k => { trimmed[k] = hist[k]; });
        localStorage.setItem(GAS_HISTORY_KEY, JSON.stringify(trimmed));
      }

      // ── 位置情報 → 市区町村コード（国土地理院逆ジオコーダ）──────
      const GAS_AREA_CACHE_KEY = 'gas-area-cache-v1';

      async function detectGasArea(forceDetect) {
        // 1時間キャッシュ（muniCd の形式も検証してから使用）
        try {
          const c = JSON.parse(localStorage.getItem(GAS_AREA_CACHE_KEY) || 'null');
          if (!forceDetect && c && Date.now() - c.ts < 60 * 60 * 1000
              && /^\d{5,6}$/.test(c.muniCd || '')) return c;
        } catch (e) { /* ignore */ }

        const loc = await detectDashboardArea(forceDetect);
        const result = { muniCd: loc.muniCd, cityName: loc.city, ts: Date.now() };
        try { localStorage.setItem(GAS_AREA_CACHE_KEY, JSON.stringify(result)); } catch (e) { /* ignore */ }
        return result;
      }

      // gogo.gs HTML からページタイトルの市区町村名を抽出（確認用）
      function parseCityNameFromGasHtml(html) {
        const h1M = String(html).match(/<h1[^>]*>([\s\S]{0,100}?)<\/h1>/i);
        if (h1M) {
          const text = h1M[1].replace(/<[^>]+>/g, '');
          const m = text.match(/([^\s　]{2,6}[市区町村])/);
          if (m) return m[1];
        }
        const titleM = String(html).match(/<title[^>]*>([\s\S]{0,80}?)<\/title>/i);
        if (titleM) {
          const m = titleM[1].replace(/<[^>]+>/g, '').match(/([^\s　]{2,6}[市区町村])/);
          if (m) return m[1];
        }
        // フォールバック: 住所内の「都道府県＋市区町村名」パターンで抽出
        const addrM = String(html).match(/[都道府県]([^\s<>]{2,5}[市区町村])/);
        if (addrM) return addrM[1];
        return '';
      }

      // ── ガソリン価格ランキング ──────────────────────────────
      // gogo.gs の HTML 構造: class="shop-name" → class="address" → class="price"
      function parseGasRankingHtml(html) {
        const src = String(html || '');
        const stations = [];
        const seen = new Set();
        const stripTags = s => s.replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
          .replace(/&[a-z#0-9]+;/gi, '').trim();

        // shop-name → address(p.address) → price の順で抽出
        const shopRe = /class="shop-name"[^>]*>([\s\S]*?)<\/a>([\s\S]{0,600}?)class="price"[^>]*>\s*(\d{2,3})\s*</gi;
        let m;
        while ((m = shopRe.exec(src)) !== null) {
          const rawName = stripTags(m[1]);
          if (!rawName || rawName.length < 2) continue;
          const price = Number(m[3]);
          if (price < 100 || price > 250) continue;
          const name = rawName.split(/\s*[/／]\s*/)[0].trim();
          if (seen.has(name)) continue;

          // class="address" から住所を抽出
          const addrM = m[2].match(/class="address"[^>]*>([\s\S]*?)<\/p>/i);
          const address = addrM ? stripTags(addrM[1]) : '';

          seen.add(name);
          stations.push({ name: rawName, address, price });
          if (stations.length >= 8) break;
        }

        return stations.sort((a, b) => a.price - b.price).slice(0, 5);
      }

      function renderGasRanking(stations, note) {
        const el = document.getElementById('home-gas-ranking');
        if (!el) return;
        if (!stations || !stations.length) {
          // textContent で安全に書き込む（innerHTML XSS を回避）
          const div = document.createElement('div');
          div.style.cssText = 'font-size:0.75rem;color:var(--muted)';
          div.textContent = note || 'ランキングデータなし';
          el.replaceChildren(div);
          return;
        }
        const rankClass = i => ['r1', 'r2', 'r3', '', ''][i] || '';
        el.innerHTML = stations.map((s, i) => `
          <div class="gas-rank-item" style="cursor:pointer"
               data-name="${escHtml(s.name)}"
               data-addr="${escHtml(s.address || '')}">
            <div class="gas-rank-num ${rankClass(i)}">${i + 1}</div>
            <div class="gas-rank-body">
              <div class="gas-rank-name">${escHtml(s.name)}</div>
              ${s.address ? `<div class="gas-rank-addr">${escHtml(s.address)}</div>` : ''}
            </div>
            <div class="gas-rank-price">
              <span class="gas-rank-badge">現金</span><span class="gas-rank-yen">${escHtml(String(s.price))}</span>
            </div>
          </div>`).join('');
        el.querySelectorAll('.gas-rank-item').forEach(item => {
          item.addEventListener('click', () => {
            const q = encodeURIComponent([item.dataset.name, item.dataset.addr].filter(Boolean).join(' '));
            window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank', 'noopener');
          });
        });
      }

      async function initGasCard(forceDetect) {
        const titleEl  = document.getElementById('gas-card-title');
        const statusEl = document.getElementById('gas-location-status');
        const linkEl   = document.getElementById('gas-detail-link');
        gasList.innerHTML = '<li class="dashboard-mini-item"><span>読み込み中…</span></li>';

        // 位置情報から市区町村を特定
        let muniCd = '11237', cityName = '三郷市';
        if (statusEl) statusEl.textContent = '📍 現在地を取得中…';
        try {
          if (forceDetect) {
            try { localStorage.removeItem(GAS_AREA_CACHE_KEY); } catch (e) { /* ignore */ }
          }
          const area = await detectGasArea(forceDetect);
          muniCd   = area.muniCd;
          cityName = area.cityName;
          if (statusEl) statusEl.textContent = `📍 ${cityName} の価格を表示中`;
        } catch (e) {
          const msg = e?.code === 1 ? '位置情報の許可が必要です（三郷市で表示）'
                    : e?.message === 'no-geolocation' ? '位置情報非対応（三郷市で表示）'
                    : '現在地取得失敗（三郷市で表示）';
          if (statusEl) statusEl.textContent = msg;
        }

        if (titleEl)  titleEl.textContent  = `⛽ ${cityName}のガソリン相場`;
        if (linkEl) {
          linkEl.href = `https://gogo.gs/${muniCd}?device=sp`;
        }

        // キャッシュキーはエリアコードごとに分離
        const snapKey = `dashboard-gas-snapshot-${muniCd}`;
        const rankKey = `gas-ranking-${muniCd}`;

        try {
          const html = await fetchGasHtml(muniCd);
          // gogo.gs HTML から市区町村名を確定（Nominatim より正確）
          const confirmedCity = parseCityNameFromGasHtml(html);
          if (confirmedCity && confirmedCity !== cityName) {
            cityName = confirmedCity;
            if (titleEl)  titleEl.textContent  = `⛽ ${cityName}のガソリン相場`;
            if (statusEl) statusEl.textContent = `📍 ${cityName}`;
            // キャッシュ更新
            try {
              const c = JSON.parse(localStorage.getItem(GAS_AREA_CACHE_KEY) || 'null');
              if (c) { c.cityName = cityName; localStorage.setItem(GAS_AREA_CACHE_KEY, JSON.stringify(c)); }
            } catch (e) { /* ignore */ }
          }

          const snapshot = parseGasSnapshot(html);
          if (!snapshot) throw new Error('gas-parse');

          const ranking = parseGasRankingHtml(html);
          snapshot.stations = ranking;
          snapshot.muniCd   = muniCd;
          snapshot.cityName = cityName;
          localStorage.setItem(snapKey, JSON.stringify(snapshot));
          if (ranking.length) {
            try { localStorage.setItem(rankKey, JSON.stringify({ ts: Date.now(), stations: ranking })); } catch (e) { /* ignore */ }
          }

          const histPrices = parseGasHistory(html);
          if (histPrices && histPrices.length >= 2) seedGasPriceHistory(histPrices);
          saveGasPriceToHistory(snapshot.price);

          renderGasSnapshot(snapshot, false);
          renderGasChart('daily');
          renderGasRanking(ranking, ranking.length ? '' : 'ランキングデータなし');
          if (statusEl) statusEl.textContent = `📍 ${cityName}`;
        } catch (e) {
          try {
            const cached = JSON.parse(localStorage.getItem(snapKey) || 'null');
            if (cached && cached.price) {
              renderGasSnapshot(cached, true);
              renderGasChart('daily');
              const rc = JSON.parse(localStorage.getItem(rankKey) || 'null');
              renderGasRanking(rc?.stations || [], rc?.stations?.length ? '' : 'ランキングデータなし');
              return;
            }
          } catch (ignore) { /* no-op */ }
          gasList.innerHTML = '<li class="dashboard-mini-item"><span>相場の取得に失敗しました</span></li>';
          gasTime.textContent = '更新時刻: 取得失敗（リンク先で確認してください）';
          renderGasRanking([], 'データ取得失敗');
        }
      }

      let todos = [];
      let editingTodoId = null;
      const priorityRank = { high: 0, normal: 1, later: 2 };
      const dashCopy = {
        ja: {
          add: '追加',
          update: '更新',
          emptyTitle: 'タスクなし',
          emptySub: '追加して使い始めましょう',
          active: '未完了',
          done: '完了',
          count: (n) => `未完了 ${n}`,
          more: (n) => `ほか ${n} 件`,
          high: '高',
          normal: '中',
          later: '後で',
          edit: '編集',
          remove: '削除',
          unsaved: '未保存',
          saved: '保存済み',
          savedAt: (time) => `保存済み ${time}`,
          memoConverted: (n) => `${n}件をTODOに追加しました`,
          memoNoLines: 'TODO化できる行がありません',
          voiceTodoLabel: 'TODOを音声入力',
          voiceMemoLabel: 'メモを音声入力',
          voicePreparing: 'マイクを確認中…',
          voiceListening: '聞き取り中…',
          voiceWaiting: '音声入力を待機中…話してください',
          voiceDone: '音声入力を反映しました',
          voiceNoResult: '聞き取れませんでした',
          voiceUnsupported: '音声入力はこのブラウザでは使えません',
          voiceError: '音声入力を開始できませんでした',
          voiceSecure: '音声入力はHTTPSまたはlocalhostで開いてください',
          voicePermission: 'マイクの許可を確認してください',
          voiceNoMic: 'マイクが見つかりません',
          voiceNetwork: '音声認識サービスに接続できません',
          voiceNoSpeech: 'マイク入力を検出できません。入力デバイスを確認してください',
          voiceRetry: '音声入力を待機中…もう一度話してください',
          voiceMicUnavailable: 'ブラウザのマイク利用を許可してください',
          voiceBusy: '音声入力を停止しました',
          voiceDetail: (detail) => `音声入力を開始できませんでした（${detail}）`
        },
        en: {
          add: 'Add',
          update: 'Update',
          emptyTitle: 'No tasks',
          emptySub: 'Add one to get started',
          active: 'Active',
          done: 'Done',
          count: (n) => `${n} active`,
          more: (n) => `${n} more`,
          high: 'High',
          normal: 'Med',
          later: 'Later',
          edit: 'Edit',
          remove: 'Delete',
          unsaved: 'Not saved',
          saved: 'Saved',
          savedAt: (time) => `Saved ${time}`,
          memoConverted: (n) => `Added ${n} task${n === 1 ? '' : 's'}`,
          memoNoLines: 'No memo lines to convert',
          voiceTodoLabel: 'Dictate TODO',
          voiceMemoLabel: 'Dictate memo',
          voicePreparing: 'Checking microphone...',
          voiceListening: 'Listening...',
          voiceWaiting: 'Waiting for speech...',
          voiceDone: 'Voice input added',
          voiceNoResult: 'Could not hear that',
          voiceUnsupported: 'Voice input is not available in this browser',
          voiceError: 'Could not start voice input',
          voiceSecure: 'Open this page over HTTPS or localhost for voice input',
          voicePermission: 'Please allow microphone access',
          voiceNoMic: 'No microphone found',
          voiceNetwork: 'Speech service is unavailable',
          voiceNoSpeech: 'No microphone input detected. Check your input device',
          voiceRetry: 'Waiting for speech. Please speak again...',
          voiceMicUnavailable: 'Please allow browser microphone access',
          voiceBusy: 'Voice input stopped',
          voiceDetail: (detail) => `Could not start voice input (${detail})`
        }
      };

      function dashLang() {
        return localStorage.getItem('site-lang') === 'en' ? 'en' : 'ja';
      }

      function dc(key, ...args) {
        const val = dashCopy[dashLang()][key];
        return typeof val === 'function' ? val(...args) : val;
      }

      function normalizeTodo(item) {
        const priority = ['high', 'normal', 'later'].includes(item?.priority) ? item.priority : 'normal';
        return {
          id: Number(item?.id) || Date.now() + Math.random(),
          text: String(item?.text || '').slice(0, 80),
          done: Boolean(item?.done),
          priority,
          createdAt: item?.createdAt || null,
          updatedAt: item?.updatedAt || null
        };
      }

      function formatMemoSavedAt(value) {
        if (!value) return dc('unsaved');
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return dc('saved');
        return dc('savedAt', date.toLocaleTimeString(dashLang() === 'ja' ? 'ja-JP' : 'en-US', {
          hour: '2-digit',
          minute: '2-digit'
        }));
      }

      function updateMemoStatus(text) {
        if (!memoStatus) return;
        memoStatus.textContent = text || formatMemoSavedAt(localStorage.getItem(MEMO_SAVED_KEY));
      }

      function saveMemoValue(statusText) {
        localStorage.setItem(MEMO_KEY, memoBox.value);
        const now = new Date().toISOString();
        localStorage.setItem(MEMO_SAVED_KEY, now);
        updateMemoStatus(statusText || formatMemoSavedAt(now));
      }

      function setVoiceStatus(text) {
        if (voiceStatus) voiceStatus.textContent = text || '';
      }

      function setVoiceLabels() {
        if (todoVoiceBtn) {
          const reason = todoVoiceBtn.dataset.voiceDisabledReason;
          const label = reason ? dc(reason) : dc('voiceTodoLabel');
          todoVoiceBtn.title = label;
          todoVoiceBtn.setAttribute('aria-label', label);
        }
        if (memoVoiceBtn) {
          const reason = memoVoiceBtn.dataset.voiceDisabledReason;
          const label = reason ? dc(reason) : dc('voiceMemoLabel');
          memoVoiceBtn.title = label;
          memoVoiceBtn.setAttribute('aria-label', label);
        }
      }

      function resetTodoForm() {
        editingTodoId = null;
        todoInput.value = '';
        if (todoPriority) todoPriority.value = 'normal';
        if (todoSubmitBtn) todoSubmitBtn.textContent = dc('add');
      }

      function loadTodos() {
        try {
          const parsed = JSON.parse(localStorage.getItem(TODO_KEY) || '[]');
          todos = Array.isArray(parsed) ? parsed.map(normalizeTodo).filter((todo) => todo.text) : [];
        } catch (e) {
          todos = [];
        }
      }

      function saveTodos() {
        localStorage.setItem(TODO_KEY, JSON.stringify(todos));
      }

      function renderTodos() {
        const activeCount = todos.filter((todo) => !todo.done).length;
        if (todoCount) todoCount.textContent = dc('count', activeCount);
        if (!todos.length) {
          todoList.innerHTML = `<li class="dashboard-mini-item"><span>${dc('emptyTitle')}</span><small>${dc('emptySub')}</small></li>`;
          return;
        }
        const sorted = todos.slice().sort((a, b) => {
          const doneDiff = Number(Boolean(a.done)) - Number(Boolean(b.done));
          if (doneDiff) return doneDiff;
          return (priorityRank[a.priority] ?? 1) - (priorityRank[b.priority] ?? 1);
        });
        const shown = sorted.slice(0, 4);
        const html = shown.map((todo) => `
          <li class="dashboard-mini-item${todo.done ? ' dash-todo-done' : ''}">
            <label class="dash-todo-check">
              <input type="checkbox" data-id="${todo.id}" ${todo.done ? 'checked' : ''}>
              <span class="dash-todo-text">${escHtml(todo.text || '')}</span>
            </label>
            <span class="dash-todo-meta">
              <span class="dash-priority-badge dash-priority-${todo.priority}">${dc(todo.priority)}</span>
              <small>${todo.done ? dc('done') : dc('active')}</small>
              <button class="dash-icon-btn" type="button" data-edit-todo="${todo.id}" title="${dc('edit')}" aria-label="${dc('edit')}">✎</button>
              <button class="dash-icon-btn" type="button" data-delete-todo="${todo.id}" title="${dc('remove')}" aria-label="${dc('remove')}">×</button>
            </span>
          </li>`).join('');
        const hiddenCount = sorted.length - shown.length;
        todoList.innerHTML = hiddenCount > 0
          ? `${html}<li class="dashboard-mini-item"><span>${dc('more', hiddenCount)}</span><small>dashboard.html</small></li>`
          : html;
      }

      todoForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const text = todoInput.value.trim();
        if (!text) return;
        const now = new Date().toISOString();
        if (editingTodoId !== null) {
          const todo = todos.find((item) => Number(item.id) === Number(editingTodoId));
          if (todo) {
            todo.text = text;
            todo.priority = todoPriority?.value || 'normal';
            todo.updatedAt = now;
          }
        } else {
          todos.push({ id: Date.now(), text, done: false, priority: todoPriority?.value || 'normal', createdAt: now, updatedAt: now });
        }
        resetTodoForm();
        saveTodos();
        renderTodos();
      });

      todoList.addEventListener('change', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement) || target.type !== 'checkbox') return;
        const id = Number(target.dataset.id);
        const todo = todos.find((item) => Number(item.id) === id);
        if (!todo) return;
        todo.done = target.checked;
        todo.updatedAt = new Date().toISOString();
        saveTodos();
        renderTodos();
      });

      todoList.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const editBtn = target.closest('[data-edit-todo]');
        const deleteBtn = target.closest('[data-delete-todo]');
        if (editBtn) {
          const todo = todos.find((item) => Number(item.id) === Number(editBtn.dataset.editTodo));
          if (!todo) return;
          editingTodoId = todo.id;
          todoInput.value = todo.text;
          if (todoPriority) todoPriority.value = todo.priority || 'normal';
          if (todoSubmitBtn) todoSubmitBtn.textContent = dc('update');
          todoInput.focus();
          return;
        }
        if (deleteBtn) {
          const id = Number(deleteBtn.dataset.deleteTodo);
          todos = todos.filter((item) => Number(item.id) !== id);
          if (Number(editingTodoId) === id) resetTodoForm();
          saveTodos();
          renderTodos();
        }
      });

      memoBox.value = localStorage.getItem(MEMO_KEY) || '';
      updateMemoStatus();
      memoBox.addEventListener('input', () => {
        saveMemoValue();
      });

      (function initVoiceInput() {
        setVoiceLabels();
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
          [todoVoiceBtn, memoVoiceBtn].forEach((btn) => {
            if (!btn) return;
            btn.disabled = true;
            btn.dataset.voiceDisabledReason = 'voiceUnsupported';
          });
          setVoiceLabels();
          setVoiceStatus(dc('voiceUnsupported'));
          return;
        }

        if (!window.isSecureContext) {
          [todoVoiceBtn, memoVoiceBtn].forEach((btn) => {
            if (!btn) return;
            btn.disabled = true;
            btn.dataset.voiceDisabledReason = 'voiceSecure';
          });
          setVoiceLabels();
          setVoiceStatus(dc('voiceSecure'));
          return;
        }

        let recognition = null;
        let voiceTarget = null;
        let voiceBaseText = '';
        let voiceText = '';
        let voiceHadResult = false;
        let voiceHadError = false;
        let voiceErrorCode = '';
        let voiceRetryCount = 0;
        let voiceStream = null;
        let voiceKeepListening = false;
        let voiceStopRequested = false;

        function setListening(active) {
          [todoVoiceBtn, memoVoiceBtn].forEach((btn) => {
            if (!btn) return;
            btn.classList.toggle('is-listening', active);
            btn.setAttribute('aria-pressed', active ? 'true' : 'false');
          });
        }

        function stopVoiceStream() {
          if (!voiceStream) return;
          voiceStream.getTracks().forEach((track) => track.stop());
          voiceStream = null;
        }

        async function prepareMicrophone() {
          if (!navigator.mediaDevices?.getUserMedia) return true;
          try {
            stopVoiceStream();
            voiceStream = await navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
              }
            });
            stopVoiceStream();
            return true;
          } catch (e) {
            console.warn('Microphone permission failed:', e);
            voiceHadError = voiceErrorMessage(e?.name || e?.message || '');
            setVoiceStatus(voiceHadError || dc('voiceMicUnavailable'));
            return false;
          }
        }

        function voiceErrorMessage(errorName) {
          if (errorName === 'not-allowed' || errorName === 'service-not-allowed' || errorName === 'SecurityError' || errorName === 'NotAllowedError') {
            return dc('voicePermission');
          }
          if (errorName === 'audio-capture' || errorName === 'NotFoundError') return dc('voiceNoMic');
          if (errorName === 'network') return dc('voiceNetwork');
          if (errorName === 'no-speech') return dc('voiceNoSpeech');
          if (errorName === 'aborted') return dc('voiceBusy');
          if (errorName) return dc('voiceDetail', errorName);
          return dc('voiceError');
        }

        function applyVoiceText(transcript) {
          if (!transcript) return;
          voiceHadResult = true;
          voiceText = transcript;
          if (voiceTarget === 'memo') {
            const separator = !voiceBaseText || voiceBaseText.endsWith('\n') ? '' : '\n';
            memoBox.value = `${voiceBaseText}${separator}${transcript}`.slice(0, Number(memoBox.maxLength) || 280);
          } else {
            todoInput.value = `${voiceBaseText ? `${voiceBaseText} ` : ''}${transcript}`.slice(0, Number(todoInput.maxLength) || 80);
          }
        }

        function finishVoice() {
          const retryTarget = voiceTarget;
          const shouldRetry = voiceErrorCode === 'no-speech' && !voiceHadResult && voiceKeepListening && !voiceStopRequested && voiceRetryCount < 12;
          if (voiceText) applyVoiceText(voiceText);
          if (voiceTarget === 'memo' && voiceHadResult) saveMemoValue(dc('voiceDone'));
          setVoiceStatus(shouldRetry ? dc('voiceRetry') : (voiceStopRequested ? dc('voiceBusy') : (voiceHadError ? voiceHadError : (voiceHadResult ? dc('voiceDone') : dc('voiceNoResult')))));
          voiceTarget = null;
          voiceBaseText = '';
          voiceText = '';
          recognition = null;
          setListening(false);
          stopVoiceStream();
          if (shouldRetry) {
            voiceRetryCount++;
            window.setTimeout(() => beginVoice(retryTarget, true), 900);
          } else {
            voiceRetryCount = 0;
            voiceKeepListening = false;
            voiceStopRequested = false;
          }
        }

        function createRecognition() {
          const rec = new SpeechRecognition();
          rec.continuous = false;
          rec.interimResults = true;
          rec.maxAlternatives = 1;
          rec.lang = dashLang() === 'ja' ? 'ja-JP' : 'en-US';
          rec.onstart = () => {
            setListening(true);
            setVoiceStatus(dc('voiceListening'));
          };
          rec.onresult = (event) => {
            let transcript = '';
            for (let i = 0; i < event.results.length; i++) {
              const result = event.results[i];
              if (result && result[0] && result[0].transcript) {
                transcript += result[0].transcript;
              }
            }
            transcript = transcript.trim();
            if (!transcript && voiceText) return;
            applyVoiceText(transcript || voiceText);
          };
          rec.onerror = (event) => {
            voiceErrorCode = event?.error || '';
            voiceHadError = voiceErrorMessage(voiceErrorCode);
            if (event?.error) console.warn('SpeechRecognition error:', event.error);
            setVoiceStatus(voiceErrorCode === 'no-speech' && voiceKeepListening ? dc('voiceRetry') : voiceHadError);
          };
          rec.onend = finishVoice;
          return rec;
        }

        async function beginVoice(target, isRetry = false) {
          if (voiceTarget) {
            voiceKeepListening = false;
            voiceStopRequested = true;
            try { recognition?.abort?.(); recognition?.stop?.(); } catch (e) { /* ignore */ }
            setVoiceStatus(dc('voiceBusy'));
            return;
          }
          voiceTarget = target;
          voiceBaseText = target === 'memo' ? memoBox.value : todoInput.value.trim();
          voiceText = '';
          voiceHadResult = false;
          voiceHadError = false;
          voiceErrorCode = '';
          voiceStopRequested = false;
          if (!isRetry) {
            voiceRetryCount = 0;
            voiceKeepListening = true;
          }
          setVoiceStatus(isRetry ? dc('voiceRetry') : dc('voicePreparing'));
          const micReady = await prepareMicrophone();
          if (!micReady) {
            voiceTarget = null;
            voiceBaseText = '';
            voiceText = '';
            setListening(false);
            return;
          }
          recognition = createRecognition();
          try {
            recognition.start();
            if (isRetry) setVoiceStatus(dc('voiceWaiting'));
          } catch (e) {
            const detail = e?.name || e?.message || '';
            console.warn('SpeechRecognition start failed:', e);
            voiceHadError = voiceErrorMessage(detail);
            voiceTarget = null;
            recognition = null;
            voiceKeepListening = false;
            voiceStopRequested = false;
            setListening(false);
            stopVoiceStream();
            setVoiceStatus(voiceHadError);
          }
        }

        todoVoiceBtn?.addEventListener('click', () => beginVoice('todo'));
        memoVoiceBtn?.addEventListener('click', () => beginVoice('memo'));
      })();

      memoToTodoBtn?.addEventListener('click', () => {
        const lines = memoBox.value
          .split(/\r?\n/)
          .map((line) => line.trim())
          .map((line) => line.replace(/^(?:[-*・]|□|\[ \])\s*/, '').trim())
          .filter(Boolean);
        const existing = new Set(todos.map((todo) => todo.text));
        const additions = lines.filter((line) => !existing.has(line)).slice(0, 8);
        if (!additions.length) {
          updateMemoStatus(dc('memoNoLines'));
          return;
        }
        const now = new Date().toISOString();
        additions.forEach((text, index) => {
          todos.push({
            id: Date.now() + index,
            text: text.slice(0, 80),
            done: false,
            priority: 'normal',
            createdAt: now,
            updatedAt: now
          });
        });
        saveTodos();
        renderTodos();
        updateMemoStatus(dc('memoConverted', additions.length));
      });

      window.addEventListener('site-lang-change', () => {
        renderTodos();
        updateMemoStatus();
        setVoiceLabels();
        const voiceReason = todoVoiceBtn?.dataset.voiceDisabledReason || memoVoiceBtn?.dataset.voiceDisabledReason;
        if (voiceReason) setVoiceStatus(dc(voiceReason));
        if (todoSubmitBtn) todoSubmitBtn.textContent = editingTodoId !== null ? dc('update') : dc('add');
      });

      let schedules = [];
      function loadSchedules() {
        try {
          const parsed = JSON.parse(localStorage.getItem(SCHEDULE_KEY) || '[]');
          schedules = Array.isArray(parsed) ? parsed : [];
        } catch (e) {
          schedules = [];
        }
      }

      function saveSchedules() {
        localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedules));
      }

      function renderCalendar() {
        const now = new Date();
        const base = new Date(now.getFullYear(), now.getMonth() + calendarOffset, 1);
        const year = base.getFullYear();
        const month = base.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const todayKey = toDateKey(now);

        const marks = new Set(
          schedules
            .filter((s) => typeof s.date === 'string' && s.date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}-`))
            .map((s) => s.date)
        );

        calendarLabel.textContent = `${year}年${month + 1}月`;
        calendarToday.textContent = `今日: ${todayKey.replace(/-/g, '/')}`;

        const dow = ['日', '月', '火', '水', '木', '金', '土'];
        let html = dow.map((d) => `<div class="dash-cal-cell dash-cal-dow">${d}</div>`).join('');

        for (let i = 0; i < firstDay; i++) {
          html += '<div class="dash-cal-cell dash-cal-empty"></div>';
        }
        for (let d = 1; d <= daysInMonth; d++) {
          const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const isToday = key === todayKey;
          const hasEvent = marks.has(key);
          html += `<div class="dash-cal-cell${isToday ? ' dash-cal-today' : ''}">${d}${hasEvent ? ' •' : ''}</div>`;
        }
        calendarGrid.innerHTML = html;
      }

      function renderSchedules() {
        if (!schedules.length) {
          scheduleList.innerHTML = '<li class="dashboard-mini-item"><span>予定なし</span></li>';
          return;
        }
        const todayKey = toDateKey(new Date());
        const shown = schedules
          .slice()
          .sort((a, b) => String(a.date).localeCompare(String(b.date)))
          .filter((s) => String(s.date) >= todayKey)
          .slice(0, 5);
        const rows = shown.length ? shown : schedules.slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(0, 5);

        scheduleList.innerHTML = rows.map((s) => {
          const gcalUrl = buildGCalUrl(String(s.date), s.text || '');
          return `
          <li class="dashboard-mini-item">
            <span>${escHtml(String(s.date).replace(/-/g, '/'))} ${escHtml(s.text || '')}</span>
            <span style="display:flex;align-items:center;gap:6px;flex-shrink:0">
              <a href="${gcalUrl}" target="_blank" rel="noopener noreferrer" title="Googleカレンダーで開く" style="font-size:0.72rem;color:var(--blue);text-decoration:none;border:1px solid var(--blue);border-radius:8px;padding:2px 7px;opacity:0.85">G📅</a>
              <button class="dash-todo-btn" type="button" data-delete-schedule="${s.id}">削除</button>
            </span>
          </li>`;
        }).join('');
      }

      function buildGCalUrl(date, text) {
        // 時間パターン: "16:00～17:30" / "16:00~17:30" / "16:00-17:30"
        const timeRe = /(\d{1,2}):(\d{2})(?:[～〜~\-](\d{1,2}):(\d{2}))?/;
        const m = text.match(timeRe);
        const d = date.replace(/-/g, ''); // YYYYMMDD
        const title = text.replace(timeRe, '').replace(/\s+/g, ' ').trim() || text;

        let startDt, endDt;
        if (m) {
          const sh = String(m[1]).padStart(2, '0');
          const sm = String(m[2]).padStart(2, '0');
          startDt = `${d}T${sh}${sm}00`;
          if (m[3] && m[4]) {
            endDt = `${d}T${String(m[3]).padStart(2, '0')}${String(m[4]).padStart(2, '0')}00`;
          } else {
            // 終了時刻がなければ1時間後
            const eh = (parseInt(m[1], 10) + 1) % 24;
            endDt = `${d}T${String(eh).padStart(2, '0')}${sm}00`;
          }
        } else {
          // 時間なし → 終日イベント
          const next = new Date(date);
          next.setDate(next.getDate() + 1);
          startDt = d;
          endDt = next.toISOString().slice(0, 10).replace(/-/g, '');
        }

        return `https://calendar.google.com/calendar/r/eventedit?text=${encodeURIComponent(title)}&dates=${startDt}/${endDt}`;
      }

      // ─── ダッシュボードカード表示制御 ────────────────────────
      function applyDashboardVisibility() {
        try {
          const settings = JSON.parse(localStorage.getItem('admin_settings_dashboard') || '{}');
          ['visit','weather','fx','stock','gas','updates','todo','calendar','train','pomodoro','quake','worldclock'].forEach(key => {
            const card = document.getElementById(`dash-card-${key}`);
            if (card && settings[key] === false) card.style.display = 'none';
          });
        } catch {}
      }

      function initGCalSync() {
        function tryInit() {
          if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
            setTimeout(tryInit, 500);
            return;
          }
          const tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: GCAL_CLIENT_ID,
            scope: 'https://www.googleapis.com/auth/calendar.readonly',
            callback: (resp) => {
              if (resp.error) {
                gcalSyncStatus.textContent = '認証失敗: ' + resp.error;
                return;
              }
              syncFromGCal(resp.access_token);
            },
          });
          gcalSyncBtn.addEventListener('click', () => {
            if (GCAL_CLIENT_ID.startsWith('YOUR_CLIENT_ID')) {
              gcalSyncStatus.textContent = '⚠️ Google Client IDを設定してください';
              return;
            }
            gcalSyncStatus.textContent = '認証中…';
            tokenClient.requestAccessToken({ prompt: '' });
          });
        }
        tryInit();
      }

      async function syncFromGCal(accessToken) {
        gcalSyncStatus.textContent = '取得中…';
        const now = new Date();
        const timeMin = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const timeMax = new Date(now.getFullYear(), now.getMonth() + 3, 1).toISOString();
        const params = new URLSearchParams({
          timeMin,
          timeMax,
          singleEvents: 'true',
          orderBy: 'startTime',
          maxResults: '250',
        });
        try {
          const res = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          const items = (data.items || []).filter((e) => e.status !== 'cancelled');

          schedules = schedules.filter((s) => !s.gcal_id);

          let count = 0;
          items.forEach((item, idx) => {
            const startDate = item.start.date || (item.start.dateTime || '').slice(0, 10);
            if (!startDate) return;
            let text = item.summary || '(無題)';
            if (item.start.dateTime) {
              const toHHMM = (dt) => dt.slice(11, 16);
              const st = toHHMM(item.start.dateTime);
              const et = item.end && item.end.dateTime ? toHHMM(item.end.dateTime) : null;
              text = et ? `${text} ${st}～${et}` : `${text} ${st}`;
            }
            schedules.push({ id: Date.now() + idx, gcal_id: item.id, date: startDate, text });
            count++;
          });

          saveSchedules();
          renderCalendar();
          renderSchedules();
          gcalSyncStatus.textContent = `✅ ${count}件を同期しました`;
          setTimeout(() => { gcalSyncStatus.textContent = ''; }, 5000);
        } catch (e) {
          gcalSyncStatus.textContent = `同期失敗: ${e.message}`;
        }
      }

      scheduleForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const date = scheduleDateInput.value;
        const text = scheduleTextInput.value.trim();
        if (!date || !text) return;
        schedules.push({ id: Date.now(), date, text });
        scheduleTextInput.value = '';
        saveSchedules();
        renderCalendar();
        renderSchedules();
        // Google カレンダーへ連携
        window.open(buildGCalUrl(date, text), '_blank', 'noreferrer');
      });

      scheduleList.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLButtonElement)) return;
        const id = Number(target.dataset.deleteSchedule);
        if (!id) return;
        schedules = schedules.filter((s) => Number(s.id) !== id);
        saveSchedules();
        renderCalendar();
        renderSchedules();
      });

      calPrevBtn.addEventListener('click', () => { calendarOffset--; renderCalendar(); });
      calNextBtn.addEventListener('click', () => { calendarOffset++; renderCalendar(); });

      scheduleDateInput.value = toDateKey(new Date());

      // localStorage 操作は即座実行（ネットワーク不要）
      loadTodos();
      renderTodos();
      loadCustomStocks();
      renderUpdates();

      // よく使うリンク
      (function renderQuickLinks() {
        const DEFAULT_LINKS = [
          { label: 'Google', icon: '🔍', url: 'https://www.google.co.jp' },
          { label: 'YouTube', icon: '▶️', url: 'https://www.youtube.com' },
          { label: 'GitHub', icon: '🐙', url: 'https://github.com' },
          { label: 'Gmail', icon: '✉️', url: 'https://mail.google.com' },
          { label: 'Maps', icon: '🗺️', url: 'https://maps.google.co.jp' },
          { label: 'Amazon', icon: '📦', url: 'https://www.amazon.co.jp' },
        ];
        const grid = document.getElementById('home-quicklinks-grid');
        if (!grid) return;
        grid.innerHTML = DEFAULT_LINKS.map(l => `
          <a href="${l.url}" target="_blank" rel="noopener noreferrer"
             style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 4px;border-radius:10px;background:#fff;border:1px solid var(--line);text-decoration:none;color:var(--text)"
             onmouseover="this.style.borderColor='var(--blue)'" onmouseout="this.style.borderColor='var(--line)'">
            <span style="font-size:1.5rem">${l.icon}</span>
            <span style="font-size:0.65rem;color:var(--muted);font-weight:600">${escHtml(l.label)}</span>
          </a>`).join('');
      })();

      loadSchedules();
      (function cleanPastSchedules() {
        const todayKey = toDateKey(new Date());
        const before = schedules.length;
        schedules = schedules.filter(s => s.date >= todayKey);
        if (schedules.length !== before) saveSchedules();
      })();
      renderCalendar();
      renderSchedules();
      initGCalSync();
      applyDashboardVisibility();
      // お知らせバナー
      (function() {
        try {
          const a = JSON.parse(localStorage.getItem('admin_announcement') || '{}');
          if (a.enabled && a.text) {
            const el = document.getElementById('announcement-banner');
            el.textContent = '📢 ' + a.text;
            el.style.display = '';
          }
        } catch {}
      })();

      // ─── 電車遅延情報 ─────────────────────────────────────────
      const TRAIN_AREA_BASE = 'https://transit.yahoo.co.jp/traininfo/area/';
      const TRAIN_CACHE_KEY = 'train-area-cache';
      const TRAIN_DEFAULT_AREA = { code: 4, name: '関東' };
      const TRAIN_PROXIES = [
        u => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
        u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
        u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
      ];
      const TRAIN_PREF_TO_AREA = {
        '北海道': { code: 1, name: '北海道' },
        '青森県': { code: 2, name: '東北' }, '岩手県': { code: 2, name: '東北' },
        '宮城県': { code: 2, name: '東北' }, '秋田県': { code: 2, name: '東北' },
        '山形県': { code: 2, name: '東北' }, '福島県': { code: 2, name: '東北' },
        '茨城県': { code: 4, name: '関東' }, '栃木県': { code: 4, name: '関東' },
        '群馬県': { code: 4, name: '関東' }, '埼玉県': { code: 4, name: '関東' },
        '千葉県': { code: 4, name: '関東' }, '東京都': { code: 4, name: '関東' },
        '神奈川県': { code: 4, name: '関東' },
        '新潟県': { code: 3, name: '関東甲信越' }, '長野県': { code: 3, name: '関東甲信越' },
        '山梨県': { code: 3, name: '関東甲信越' },
        '静岡県': { code: 5, name: '中部' }, '愛知県': { code: 5, name: '中部' },
        '岐阜県': { code: 5, name: '中部' }, '三重県': { code: 5, name: '中部' },
        '富山県': { code: 5, name: '中部' }, '石川県': { code: 5, name: '中部' },
        '福井県': { code: 5, name: '中部' },
        '大阪府': { code: 6, name: '近畿' }, '京都府': { code: 6, name: '近畿' },
        '兵庫県': { code: 6, name: '近畿' }, '奈良県': { code: 6, name: '近畿' },
        '滋賀県': { code: 6, name: '近畿' }, '和歌山県': { code: 6, name: '近畿' },
        '鳥取県': { code: 7, name: '中国・四国' }, '島根県': { code: 7, name: '中国・四国' },
        '岡山県': { code: 7, name: '中国・四国' }, '広島県': { code: 7, name: '中国・四国' },
        '山口県': { code: 7, name: '中国・四国' }, '徳島県': { code: 7, name: '中国・四国' },
        '香川県': { code: 7, name: '中国・四国' }, '愛媛県': { code: 7, name: '中国・四国' },
        '高知県': { code: 7, name: '中国・四国' },
        '福岡県': { code: 8, name: '九州・沖縄' }, '佐賀県': { code: 8, name: '九州・沖縄' },
        '長崎県': { code: 8, name: '九州・沖縄' }, '熊本県': { code: 8, name: '九州・沖縄' },
        '大分県': { code: 8, name: '九州・沖縄' }, '宮崎県': { code: 8, name: '九州・沖縄' },
        '鹿児島県': { code: 8, name: '九州・沖縄' }, '沖縄県': { code: 8, name: '九州・沖縄' },
      };

      function trainStatusColor(s) {
        if (/運休|見合わせ/.test(s)) return '#ef4444';
        if (/遅延|乱れ|障害/.test(s)) return '#f97316';
        if (/運転状況/.test(s)) return '#0ea5e9';
        return '#6b7280';
      }

      async function detectTrainRegion() {
        const cached = JSON.parse(localStorage.getItem(TRAIN_CACHE_KEY) || 'null');
        if (cached && Date.now() - cached.ts < 10 * 60 * 1000) return cached.area;
        try {
          const pos = await new Promise((resolve, reject) => {
            if (!navigator.geolocation) { reject(new Error('no geo')); return; }
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000, maximumAge: 300000 });
          });
          const { latitude: lat, longitude: lon } = pos.coords;
          const res = await fetchWithTimeout(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ja`,
            6000
          );
          const data = await res.json();
          const pref = data.address?.state || data.address?.province || '';
          const area = TRAIN_PREF_TO_AREA[pref] || TRAIN_DEFAULT_AREA;
          localStorage.setItem(TRAIN_CACHE_KEY, JSON.stringify({ area, ts: Date.now() }));
          return area;
        } catch {
          return TRAIN_DEFAULT_AREA;
        }
      }

      window.initTrainCard = async function initTrainCard() {
        const list = document.getElementById('home-train-list');
        const timeEl = document.getElementById('home-train-time');
        const titleEl = document.getElementById('home-train-title');
        if (!list) return;
        list.innerHTML = '<li class="dashboard-mini-item"><span style="color:var(--muted)">📍 位置情報取得中…</span></li>';

        const area = await detectTrainRegion();
        const TRAIN_TARGET = TRAIN_AREA_BASE + area.code + '/';

        list.innerHTML = '<li class="dashboard-mini-item"><span style="color:var(--muted)">取得中…</span></li>';

        let html = null;
        for (const makeProxy of TRAIN_PROXIES) {
          try {
            const res = await fetchWithTimeout(makeProxy(TRAIN_TARGET), 9000);
            if (!res.ok) continue;
            const ct = res.headers.get('content-type') || '';
            const body = ct.includes('json') ? (await res.json()) : { contents: await res.text() };
            const candidate = body.contents || body;
            if (typeof candidate === 'string' && candidate.length > 200) { html = candidate; break; }
          } catch { continue; }
        }

        if (!html) {
          list.innerHTML = `<li class="dashboard-mini-item" style="flex-direction:column;gap:6px;">
            <span style="color:var(--muted);font-size:0.8rem;">自動取得できませんでした</span>
            <a href="${TRAIN_TARGET}" target="_blank" rel="noopener noreferrer" style="font-size:0.78rem;color:var(--blue,#0ea5e9)">Yahoo路線情報で確認する →</a>
          </li>`;
          if (timeEl) timeEl.textContent = '';
          return;
        }

        for (const marker of ['主要鉄道', '利用者が多い路線', 'elmMajorLine']) {
          const idx = html.indexOf(marker);
          if (idx > 500) { html = html.slice(0, idx); break; }
        }

        const doc2 = new DOMParser().parseFromString(html, 'text/html');
        const DISRUPTION_RE = /遅延|見合わせ|運休|乱れ|障害/;
        const disruptions = [];

        doc2.querySelectorAll('tr').forEach(row => {
          const cells = [...row.querySelectorAll('td')];
          if (cells.length < 2) return;
          const name   = cells[0].textContent.trim();
          const status = cells[1].textContent.trim();
          const detail = cells.length >= 3 ? cells[2].textContent.trim().replace(/\s+/g, ' ') : '';
          if (name && DISRUPTION_RE.test(status) && name.length < 25 && !/路線|状況|詳細/.test(name)) {
            disruptions.push({ name, status: status.replace(/\s+/g, ''), detail });
          }
        });

        if (!disruptions.length) {
          doc2.querySelectorAll('a').forEach(a => {
            const parent = a.closest('tr, li');
            if (!parent || !DISRUPTION_RE.test(parent.textContent)) return;
            const name = a.textContent.trim();
            if (name.length >= 2 && name.length < 25) {
              const m = parent.textContent.match(/遅延|見合わせ|運休|乱れ/);
              disruptions.push({ name, status: m ? m[0] : '遅延', detail: '' });
            }
          });
        }

        if (titleEl) {
          titleEl.textContent = `🚃 電車遅延情報（${area.name}）`;
          if (disruptions.length > 0) {
            titleEl.insertAdjacentHTML('beforeend',
              `<span style="font-size:0.72rem;background:#f97316;color:#fff;border-radius:9999px;padding:1px 7px;margin-left:6px;font-weight:700">${disruptions.length}件</span>`
            );
          }
        }
        if (!disruptions.length) {
          list.innerHTML = '<li class="dashboard-mini-item"><span style="color:#22c55e;font-weight:600">🟢 現在、遅延情報はありません</span></li>';
        } else {
          list.innerHTML = disruptions.map(d =>
            `<li class="dashboard-mini-item" style="flex-direction:column;align-items:flex-start;gap:4px;">
              <div style="display:flex;align-items:center;gap:8px;width:100%">
                <span>⚠️</span>
                <span style="flex:1;font-size:0.85rem;font-weight:600">${escHtml(d.name)}</span>
                <strong style="font-size:0.72rem;color:${trainStatusColor(d.status)};white-space:nowrap">${escHtml(d.status)}</strong>
              </div>
              ${d.detail ? `<p style="margin:0;padding-left:26px;font-size:0.72rem;color:var(--muted);line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${escHtml(d.detail)}</p>` : ''}
            </li>`
          ).join('');
        }
        list.innerHTML += `<li class="dashboard-mini-item" style="margin-top:4px;">
          <a href="${TRAIN_TARGET}" target="_blank" rel="noopener noreferrer" style="font-size:0.72rem;color:var(--blue,#0ea5e9)">Yahoo路線情報で詳細確認 →</a>
        </li>`;
        if (timeEl) timeEl.textContent = `${area.name} 更新: ` + new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
      }
      setInterval(initTrainCard, 5 * 60 * 1000);

      // ─── ポモドーロタイマー ────────────────────────────────────
      (function() {
        // D: カスタム時間をlocalStorageから復元
        const customDur = JSON.parse(localStorage.getItem('pomo-custom-durations') || 'null');
        let MODES = [
          { label: '集中',     duration: (customDur?.[0] || 25) * 60, color: '#6366f1' },
          { label: '短い休憩', duration: (customDur?.[1] || 5)  * 60, color: '#22c55e' },
          { label: '長い休憩', duration: (customDur?.[2] || 15) * 60, color: '#0ea5e9' },
        ];
        const CIRC = 2 * Math.PI * 52;
        let modeIdx = 0, remaining = MODES[0].duration, running = false, timerHandle = null;

        function pomoKey() { return 'pomo-count-' + new Date().toDateString(); }
        function getCount() { return parseInt(localStorage.getItem(pomoKey()) || '0'); }
        function incCount() {
          localStorage.setItem(pomoKey(), getCount() + 1);
          updatePomoHistory(); // E
          renderPomo();
        }

        // C: チャイム音
        function playPomoChime() {
          try {
            const ac = new (window.AudioContext || window.webkitAudioContext)();
            [[523.25, 0], [659.25, 0.3], [783.99, 0.6]].forEach(([freq, delay]) => {
              const osc = ac.createOscillator(), gain = ac.createGain();
              osc.connect(gain); gain.connect(ac.destination);
              osc.type = 'sine'; osc.frequency.value = freq;
              gain.gain.setValueAtTime(0.3, ac.currentTime + delay);
              gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + delay + 0.8);
              osc.start(ac.currentTime + delay);
              osc.stop(ac.currentTime + delay + 0.8);
            });
          } catch {}
        }

        // E: 週間履歴更新
        function updatePomoHistory() {
          const today = new Date().toDateString();
          let hist = JSON.parse(localStorage.getItem('pomo-history') || '[]');
          const idx = hist.findIndex(h => h.date === today);
          if (idx >= 0) hist[idx].count = getCount();
          else hist.push({ date: today, count: getCount() });
          localStorage.setItem('pomo-history', JSON.stringify(hist.slice(-7)));
        }

        // E: スパークライン描画
        function renderPomoSparkline() {
          const el = document.getElementById('pomo-sparkline');
          if (!el) return;
          const hist = JSON.parse(localStorage.getItem('pomo-history') || '[]');
          if (hist.length < 2) { el.innerHTML = ''; return; }
          const counts = hist.map(h => h.count);
          const max = Math.max(...counts, 1);
          const W = 160, H = 28, barW = Math.floor(W / 7) - 2;
          const bars = counts.map((c, i) => {
            const bh = Math.max(3, Math.round((c / max) * (H - 6)));
            const x = i * (barW + 2);
            const isToday = hist[i].date === new Date().toDateString();
            return `<rect x="${x}" y="${H - bh}" width="${barW}" height="${bh}" rx="2"
              fill="${isToday ? 'var(--blue,#0ea5e9)' : 'rgba(14,165,233,0.35)'}">
              <title>${hist[i].date.slice(4, 10)}: ${c}セット</title></rect>`;
          }).join('');
          el.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;margin:0 auto">${bars}</svg>`;
        }

        function renderPomo() {
          const m = String(Math.floor(remaining / 60)).padStart(2, '0');
          const s = String(remaining % 60).padStart(2, '0');
          const timeEl = document.getElementById('pomo-time');
          const modeEl = document.getElementById('pomo-mode');
          const ring   = document.getElementById('pomo-ring');
          const btn    = document.getElementById('pomo-btn');
          const cnt    = document.getElementById('pomo-count');
          if (timeEl) timeEl.textContent = m + ':' + s;
          if (modeEl) modeEl.textContent = MODES[modeIdx].label;
          if (ring) {
            ring.style.strokeDasharray  = CIRC;
            ring.style.strokeDashoffset = CIRC * (remaining / MODES[modeIdx].duration);
            ring.style.stroke           = MODES[modeIdx].color;
          }
          if (btn) btn.textContent = running ? '⏸ 一時停止' : '▶ 開始';
          // B: 累計集中時間
          if (cnt) {
            const totalMin = getCount() * (MODES[0].duration / 60);
            const h = Math.floor(totalMin / 60), mi = totalMin % 60;
            const timeStr = h > 0 ? `${h}時間${mi > 0 ? mi + '分' : ''}` : `${mi}分`;
            cnt.textContent = getCount() + ' セット（' + timeStr + ' 集中）';
          }
          // A: 進捗ドット
          const dotsEl = document.getElementById('pomo-dots');
          if (dotsEl) {
            const done = getCount() % 4;
            dotsEl.innerHTML = Array.from({length: 4}, (_, i) =>
              `<span class="pomo-dot${i < done ? ' done' : ''}"></span>`
            ).join('');
          }
          // E: スパークライン
          renderPomoSparkline();
        }

        function nextMode() {
          playPomoChime(); // C
          if (modeIdx === 0) { incCount(); modeIdx = (getCount() % 4 === 0) ? 2 : 1; }
          else modeIdx = 0;
          remaining = MODES[modeIdx].duration;
          running = false;
          clearInterval(timerHandle);
          renderPomo();
          if (Notification.permission === 'granted')
            new Notification('ポモドーロ', { body: MODES[modeIdx].label + ' の時間です！' });
        }

        window.pomodoroToggle = function() {
          if (!running) {
            if (Notification.permission === 'default') Notification.requestPermission();
            running = true;
            timerHandle = setInterval(() => { remaining--; renderPomo(); if (remaining <= 0) nextMode(); }, 1000);
          } else {
            running = false;
            clearInterval(timerHandle);
          }
          renderPomo();
        };
        window.pomodoroReset = function() {
          running = false;
          clearInterval(timerHandle);
          remaining = MODES[modeIdx].duration;
          renderPomo();
        };

        // D: 設定トグル
        window.pomoToggleSetting = function() {
          const s = document.getElementById('pomo-settings');
          if (s) s.style.display = s.style.display === 'none' ? 'block' : 'none';
        };
        window.pomoApplySetting = function() {
          const f = parseInt(document.getElementById('pomo-set-focus')?.value) || 25;
          const sh = parseInt(document.getElementById('pomo-set-short')?.value) || 5;
          const lo = parseInt(document.getElementById('pomo-set-long')?.value) || 15;
          MODES[0].duration = Math.max(1, Math.min(90, f)) * 60;
          MODES[1].duration = Math.max(1, Math.min(30, sh)) * 60;
          MODES[2].duration = Math.max(1, Math.min(60, lo)) * 60;
          localStorage.setItem('pomo-custom-durations', JSON.stringify([f, sh, lo]));
          running = false; clearInterval(timerHandle);
          remaining = MODES[modeIdx].duration;
          const s = document.getElementById('pomo-settings');
          if (s) s.style.display = 'none';
          renderPomo();
        };

        // D: タスクメモ復元と保存
        const taskEl = document.getElementById('pomo-task');
        if (taskEl) {
          taskEl.value = localStorage.getItem('pomo-task') || '';
          taskEl.addEventListener('input', () => localStorage.setItem('pomo-task', taskEl.value));
        }
        // D: 設定値を入力欄に反映
        if (customDur) {
          const fi = document.getElementById('pomo-set-focus');
          const si = document.getElementById('pomo-set-short');
          const li = document.getElementById('pomo-set-long');
          if (fi) fi.value = customDur[0];
          if (si) si.value = customDur[1];
          if (li) li.value = customDur[2];
        }

        renderPomo();
      })();

      // ─── 地震・防災情報 ────────────────────────────────────────
      const QUAKE_SCALE = { 10:'1', 20:'2', 30:'3', 40:'4', 45:'5弱', 50:'5強', 55:'6弱', 60:'6強', 70:'7' };
      const TSUNAMI_GRADE = {
        'Checking':     ['調査中',         '#eab308'],
        'NonEffective': ['若干の海面変動', '#eab308'],
        'Watch':        ['津波注意報',     '#f97316'],
        'Warning':      ['津波警報',       '#ef4444'],
        'MajorWarning': ['大津波警報',     '#ef4444'],
      };
      function quakeColor(s) { return s >= 60 ? '#ef4444' : s >= 50 ? '#f97316' : s >= 40 ? '#eab308' : 'var(--muted)'; }
      window.initQuakeCard = async function initQuakeCard() {
        const list      = document.getElementById('home-quake-list');
        const timeLabel = document.getElementById('home-quake-time-label');
        const eewEl     = document.getElementById('home-quake-eew');
        const tsunamiEl = document.getElementById('home-quake-tsunami');
        if (!list) return;
        try {
          const [quakeRes, tsunamiRes, eewRes] = await Promise.allSettled([
            fetchWithTimeout('https://api.p2pquake.net/v2/history?codes=551&limit=5', 8000),
            fetchWithTimeout('https://api.p2pquake.net/v2/history?codes=552&limit=1', 5000),
            fetchWithTimeout('https://api.p2pquake.net/v2/history?codes=556&limit=1', 5000),
          ]);
          // EEW
          if (eewEl) {
            let showEew = false;
            if (eewRes.status === 'fulfilled' && eewRes.value.ok) {
              const eewData = await eewRes.value.json();
              if (eewData.length) {
                const eew = eewData[0];
                const ageMs = Date.now() - new Date(eew.time || 0).getTime();
                if (ageMs < 30 * 60 * 1000) {
                  const sc = eew.earthquake?.maxScale || 0;
                  eewEl.textContent = `🚨 緊急地震速報 — ${escHtml(eew.earthquake?.hypocenter?.name || '不明')} 推定震度${QUAKE_SCALE[sc] || '?'}`;
                  showEew = true;
                }
              }
            }
            eewEl.style.display = showEew ? 'block' : 'none';
          }
          // 津波
          if (tsunamiEl) {
            let tsInfo = null;
            if (tsunamiRes.status === 'fulfilled' && tsunamiRes.value.ok) {
              const tsData = await tsunamiRes.value.json();
              if (tsData.length) {
                const gradeOrder = ['MajorWarning','Warning','Watch','NonEffective','Checking'];
                const maxGrade = (tsData[0].areas || []).reduce((best, a) => {
                  const bi = gradeOrder.indexOf(best), ai = gradeOrder.indexOf(a.grade);
                  return ai >= 0 && (bi < 0 || ai < bi) ? a.grade : best;
                }, '');
                tsInfo = TSUNAMI_GRADE[maxGrade] || null;
              }
            }
            if (tsInfo) {
              tsunamiEl.textContent = `🌊 ${tsInfo[0]}`;
              tsunamiEl.style.background = tsInfo[1];
              tsunamiEl.style.display = 'block';
            } else {
              tsunamiEl.style.display = 'none';
            }
          }
          // 地震リスト
          if (quakeRes.status !== 'fulfilled' || !quakeRes.value.ok) throw new Error();
          const data = await quakeRes.value.json();
          if (!data.length) { list.innerHTML = '<li class="dashboard-mini-item"><span>地震情報なし</span></li>'; return; }
          list.innerHTML = data.map(d => {
            const eq  = d.earthquake || {};
            const h   = eq.hypocenter || {};
            const sc  = d.scale || eq.maxScale || 0;
            const dt  = new Date(eq.time || d.time || Date.now());
            const dtStr = dt.toLocaleString('ja-JP', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' });
            const depth = h.depth != null && h.depth >= 0 ? `・深さ${h.depth}km` : '';
            const tsKey = eq.domesticTsunami;
            const tsLabel = TSUNAMI_GRADE[tsKey]
              ? `<span style="color:${TSUNAMI_GRADE[tsKey][1]};font-size:0.7rem;margin-left:4px">🌊${TSUNAMI_GRADE[tsKey][0]}</span>`
              : '';
            return `<li class="dashboard-mini-item" style="flex-direction:column;align-items:flex-start;gap:2px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.06)">
              <div style="display:flex;gap:8px;align-items:center;width:100%">
                <span style="color:${quakeColor(sc)};font-weight:700;min-width:44px">震度${QUAKE_SCALE[sc] || '不明'}</span>
                <span style="flex:1;font-size:0.85rem">${escHtml(h.name || '不明')}</span>
                <span style="font-size:0.72rem;color:var(--muted)">M${h.magnitude ?? '?'}</span>
              </div>
              <div style="font-size:0.72rem;color:var(--muted)">${dtStr}${depth}${tsLabel}</div>
            </li>`;
          }).join('');
          if (timeLabel) timeLabel.textContent = '更新: ' + new Date().toLocaleTimeString('ja-JP', { hour:'2-digit', minute:'2-digit' });
        } catch {
          list.innerHTML = '<li class="dashboard-mini-item"><span style="color:var(--muted)">取得失敗 — 更新ボタンで再試行</span></li>';
        }
      }
      setInterval(initQuakeCard, 10 * 60 * 1000);

      // ─── Leaflet 遅延読み込み（地図が必要になった時のみCDNから取得）──
      let leafletPromise = null;
      function loadLeaflet() {
        if (window.L) return Promise.resolve();
        if (leafletPromise) return leafletPromise;
        leafletPromise = new Promise((resolve, reject) => {
          const css = document.createElement('link');
          css.rel = 'stylesheet';
          css.href = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
          css.integrity = 'sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H';
          css.crossOrigin = '';
          document.head.appendChild(css);
          const js = document.createElement('script');
          js.src = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
          js.integrity = 'sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH';
          js.crossOrigin = '';
          js.onload = resolve;
          js.onerror = () => { leafletPromise = null; reject(new Error('Leaflet load failed')); };
          document.head.appendChild(js);
        });
        return leafletPromise;
      }

      // ─── 交通情報マップ（Leaflet + 国土地理院タイル + JARTIC交通量API）──
      window.initJarticCanvasMap = async function(lat, lon) {
        const mapDiv  = document.getElementById('traffic-leaflet-map');
        const loading = document.getElementById('traffic-map-loading');
        if (!mapDiv) return;
        try {
          await loadLeaflet();
        } catch {
          if (loading) loading.textContent = '地図の読み込みに失敗しました';
          return;
        }
        mapDiv.style.display = 'block';
        if (loading) loading.style.display = 'none';

        // 再呼び出し時は位置を更新してデータ再取得
        if (mapDiv._leafletMap) {
          mapDiv._leafletMap.setView([lat, lon], 14);
          if (mapDiv._jarticLayer) mapDiv._jarticLayer.clearLayers();
          fetchJarticTrafficData(mapDiv._leafletMap, mapDiv, lat, lon);
          return;
        }

        const map = L.map(mapDiv, { zoomControl: true, scrollWheelZoom: false })
                     .setView([lat, lon], 14);
        mapDiv._leafletMap = map;

        L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png', {
          maxZoom: 18,
          attribution: '© <a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener noreferrer">国土地理院</a> | <a href="https://www.jartic-open-traffic.org/" target="_blank" rel="noopener noreferrer">JARTIC</a>'
        }).addTo(map);

        L.circleMarker([lat, lon], {
          radius: 9, fillColor: '#00c8ff', color: '#ffffff',
          weight: 2.5, opacity: 1, fillOpacity: 0.85
        }).addTo(map).bindPopup('📍 現在地').openPopup();

        mapDiv._jarticLayer = L.layerGroup().addTo(map);
        fetchJarticTrafficData(map, mapDiv, lat, lon);
      };

      // JARTIC 交通量API（直轄国道 5分間交通量・APIキー不要）
      function fetchJarticTrafficData(map, mapDiv, lat, lon) {
        // JST (UTC+9) で25分前を5分刻み切り捨て（API処理遅延考慮）
        const jst = new Date(Date.now() + 9 * 3600000 - 25 * 60000);
        jst.setUTCMinutes(Math.floor(jst.getUTCMinutes() / 5) * 5, 0, 0);
        const jstEnd = new Date(jst.getTime() + 5 * 60000);
        const p2  = n => String(n).padStart(2, '0');
        const fmt = d => `${d.getUTCFullYear()}${p2(d.getUTCMonth()+1)}${p2(d.getUTCDate())}${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}`;
        const tc1 = fmt(jst), tc2 = fmt(jstEnd);

        const mg  = 0.15; // ±0.15度 ≈ 15km
        const cql = `道路種別='3' AND 時間コード>='${tc1}' AND 時間コード<='${tc2}' AND BBOX(ジオメトリ,${lon-mg},${lat-mg},${lon+mg},${lat+mg},'EPSG:4326')`;
        const url = 'https://api.jartic-open-traffic.org/geoserver/ows?' + new URLSearchParams({
          service: 'WFS', version: '2.0.0', request: 'GetFeature',
          typeNames: 't_travospublic_measure_5m',
          outputFormat: 'application/json',
          cql_filter: cql
        });

        const timeEl = document.getElementById('home-traffic-time');
        const congEl = document.getElementById('home-traffic-congestion');
        const nowStr = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

        fetchWithTimeout(url, null, 8000)
          .then(r => r.ok ? r.json() : Promise.reject(r.status))
          .then(data => {
            const features = data.features || [];
            const layer = mapDiv._jarticLayer;
            let redCnt = 0, orgCnt = 0;

            for (const f of features) {
              const pr = f.properties;
              const [flon, flat] = f.geometry.coordinates;
              const vol = (pr['上り・小型交通量']||0) + (pr['上り・大型交通量']||0) + (pr['上り・車種判別不能交通量']||0)
                        + (pr['下り・小型交通量']||0) + (pr['下り・大型交通量']||0) + (pr['下り・車種判別不能交通量']||0);
              const color  = vol > 400 ? '#ef4444' : vol > 150 ? '#f97316' : '#22c55e';
              const status = vol > 400 ? '渋滞' : vol > 150 ? '混雑' : '順調';
              if (vol > 400) redCnt++; else if (vol > 150) orgCnt++;
              L.circleMarker([flat, flon], {
                radius: 7, fillColor: color, color: '#fff', weight: 1.5, fillOpacity: 0.85
              }).addTo(layer)
                .bindPopup(`<b>交通量観測点</b><br>5分間: <b>${vol}</b>台<br>状態: <span style="color:${color};font-weight:bold">${status}</span>`);
            }

            if (timeEl) timeEl.textContent = `© JARTIC — ${nowStr} 現在 (${features.length}観測点)`;
            if (congEl && features.length > 0) {
              const lbl = redCnt > 0 ? `🔴 渋滞 ${redCnt}箇所`
                        : orgCnt  > 0 ? `🟠 混雑 ${orgCnt}箇所`
                        : '🟢 全観測点 順調';
              const bg  = redCnt > 0 ? 'rgba(239,68,68,0.12)' : orgCnt > 0 ? 'rgba(249,115,22,0.12)' : 'rgba(34,197,94,0.12)';
              const col = redCnt > 0 ? '#ef4444' : orgCnt > 0 ? '#f97316' : '#22c55e';
              congEl.textContent = lbl;
              Object.assign(congEl.style, { background: bg, color: col, display: 'block' });
            }
          })
          .catch(() => {
            if (timeEl) timeEl.textContent = `© JARTIC — ${nowStr} 現在`;
          });
      }

      // ─── 交通情報 ─────────────────────────────────────────────
      function initTrafficCard() {
        const timeEl = document.getElementById('home-traffic-time');
        const congEl = document.getElementById('home-traffic-congestion');
        const titleEl = document.getElementById('home-traffic-title');

        // 時間帯ヒューリスティック
        const h = parseInt(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo', hour: 'numeric', hour12: false }), 10);
        let label, bg, col;
        if ((h >= 7 && h <= 9) || (h >= 17 && h <= 20)) {
          label = '⚠️ ラッシュ時間帯 — 混雑しやすい';
          bg = 'rgba(234,179,8,0.15)'; col = '#eab308';
        } else if (h >= 23 || h <= 5) {
          label = '✅ 深夜・早朝 — 空いている傾向';
          bg = 'rgba(34,197,94,0.12)'; col = '#22c55e';
        } else {
          label = '🟡 通常時間帯';
          bg = 'rgba(0,200,255,0.10)'; col = 'var(--accent-cyan)';
        }
        if (congEl) {
          congEl.textContent = label;
          Object.assign(congEl.style, { background: bg, color: col, display: 'block' });
        }
        if (timeEl) timeEl.textContent = '地図を読み込み中…';

        return (async () => {
          let lat = 35.9185, lon = 139.7775, city = '三郷市';
          try {
            const loc = await getWeatherLocation();
            lat = loc.lat; lon = loc.lon; city = loc.city;
          } catch {}
          if (titleEl) titleEl.textContent = `🚦 交通情報（${city}周辺）`;
          if (timeEl) timeEl.textContent = '© JARTIC — ' + new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) + ' 現在';
          window.initJarticCanvasMap(lat, lon);
        })();
      }

      // ─── 人口・世帯数（統計ダッシュボードAPI）────────────────
      const STAT_DASH_BASE = 'https://dashboard.e-stat.go.jp/api/1.0/Json/getData';
      const STAT_IND_POP_TOTAL = '0201010000000010000';
      const STAT_IND_HOUSEHOLDS = '0202000000000010000';
      const DEMO_CACHE_KEY = 'dashboard-demographics-v1';
      const DEFAULT_AREA = { lat: 35.83, lon: 139.87, muniCd: '11237', city: '三郷市', prefecture: '埼玉県' };
      const DEMO_FALLBACK_BY_MUNI = {
        // 三郷市公式「令和2年国勢調査人口等基本集計結果」
        // https://www.city.misato.lg.jp/soshiki/somu/somu/3/1/2230.html
        '11237': {
          area: { lat: 35.83, lon: 139.87, muniCd: '11237', city: '三郷市', prefecture: '埼玉県' },
          households: [
            { year: 2000, value: 45626 },
            { year: 2005, value: 47195 },
            { year: 2010, value: 51132 },
            { year: 2015, value: 55288 },
            { year: 2020, value: 60829 }
          ],
          popTrend: [
            { year: 2000, value: 131047 },
            { year: 2005, value: 128278 },
            { year: 2010, value: 131415 },
            { year: 2015, value: 136521 },
            { year: 2020, value: 142145 }
          ]
        }
      };
      const PYR_AGE_CODES = [
        ['0〜4', '0010'], ['5〜9', '0020'], ['10〜14', '0030'], ['15〜19', '0040'],
        ['20〜24', '0050'], ['25〜29', '0060'], ['30〜34', '0070'], ['35〜39', '0080'],
        ['40〜44', '0090'], ['45〜49', '0100'], ['50〜54', '0110'], ['55〜59', '0120'],
        ['60〜64', '0130'], ['65〜69', '0140'], ['70〜74', '0150'], ['75〜79', '0160'],
        ['80〜84', '0170'], ['85〜89', '0180'], ['90〜94', '0190'], ['95〜99', '0200'],
        ['100以上', '1000']
      ];

      async function getDashboardAreaOrDefault(forceDetect) {
        try {
          return await detectDashboardArea(forceDetect);
        } catch (e) {
          return Object.assign({ ts: Date.now(), fallback: true }, DEFAULT_AREA);
        }
      }

      function statValueRows(data) {
        const obj = data?.GET_STATS?.STATISTICAL_DATA?.DATA_INF?.DATA_OBJ || [];
        return (Array.isArray(obj) ? obj : [obj])
          .map(row => row?.VALUE)
          .filter(Boolean);
      }

      function statRegionName(data) {
        const objs = data?.GET_STATS?.STATISTICAL_DATA?.CLASS_INF?.CLASS_OBJ;
        const arr = Array.isArray(objs) ? objs : (objs ? [objs] : []);
        const regionObj = arr.find(o => o?.['@id'] === 'regionCode');
        const cls = regionObj?.CLASS;
        const row = Array.isArray(cls) ? cls[0] : cls;
        return row?.['@name'] || '';
      }

      async function fetchStatData(params, timeoutMs) {
        const qs = new URLSearchParams(Object.assign({
          Lang: 'JP',
          Cycle: '3',
          RegionalRank: '4',
          IsSeasonalAdjustment: '1',
          MetaGetFlg: 'Y'
        }, params));
        const res = await fetchWithTimeout(STAT_DASH_BASE + '?' + qs.toString(), timeoutMs || 9000);
        if (!res.ok) throw new Error('stat-http-' + res.status);
        const data = await res.json();
        const status = data?.GET_STATS?.RESULT?.status;
        if (status && status !== '0') throw new Error(data?.GET_STATS?.RESULT?.errorMsg || 'stat-error');
        return data;
      }

      async function fetchStatSeries(indicatorCode, muniCd, timeParams) {
        const data = await fetchStatData(Object.assign({
          IndicatorCode: indicatorCode,
          RegionCode: muniCd
        }, timeParams || {}), 9000);
        const values = statValueRows(data).map(v => ({
          year: Number(String(v['@time'] || '').slice(0, 4)),
          value: Number(v.$)
        })).filter(v => Number.isFinite(v.year) && Number.isFinite(v.value))
          .sort((a, b) => a.year - b.year);
        if (!values.length) throw new Error('stat-empty-' + indicatorCode);
        return { values, regionName: statRegionName(data) };
      }

      async function fetchPyramidGroups(muniCd) {
        const codes = [];
        PYR_AGE_CODES.forEach(age => {
          codes.push('020101012000001' + age[1]);
          codes.push('020101022000001' + age[1]);
        });
        const batches = [];
        for (let i = 0; i < codes.length; i += 5) batches.push(codes.slice(i, i + 5));
        const rows = [];
        for (const batch of batches) {
          const data = await fetchStatData({
            IndicatorCode: batch.join(','),
            RegionCode: muniCd,
            Time: '2020CY00',
            MetaGetFlg: 'N'
          }, 10000);
          rows.push(...statValueRows(data));
        }
        const map = new Map(rows.map(v => [v['@indicator'], Number(v.$ || 0)]));
        return PYR_AGE_CODES.map(age => {
          const male = map.get('020101012000001' + age[1]) || 0;
          const female = map.get('020101022000001' + age[1]) || 0;
          return [age[0], male, female];
        }).reverse();
      }

      function drawHouseholdChart(trend) {
        const canvas = document.getElementById('home-household-chart');
        if (!canvas || !trend?.length) return;

        if (canvas._householdMoveHandler) canvas.removeEventListener('mousemove', canvas._householdMoveHandler);
        if (canvas._householdLeaveHandler) canvas.removeEventListener('mouseleave', canvas._householdLeaveHandler);

        const dpr = window.devicePixelRatio || 1;
        const W = canvas.offsetWidth || 300;
        const H = 130;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, W, H);

        const pad = { top: 12, right: 12, bottom: 22, left: 34 };
        const cW = W - pad.left - pad.right;
        const cH = H - pad.top - pad.bottom;
        const max = Math.max(...trend.map(d => d.value));
        const top = Math.ceil(max / 10000) * 10000;
        const step = cW / trend.length;
        const barW = Math.max(10, step * 0.68);

        [0, top / 2, top].forEach(v => {
          const y = pad.top + cH * (1 - v / top);
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(4,120,87,0.16)';
          ctx.moveTo(pad.left, y);
          ctx.lineTo(pad.left + cW, y);
          ctx.stroke();
          ctx.fillStyle = '#064e3b';
          ctx.font = '10px Consolas, monospace';
          ctx.textAlign = 'right';
          ctx.fillText(Math.round(v / 1000), pad.left - 5, y + 3);
        });

        const bars = [];
        trend.forEach((d, i) => {
          const x = pad.left + i * step + (step - barW) / 2;
          const h = Math.max(2, cH * d.value / top);
          const y = pad.top + cH - h;
          bars.push({ x, y, w: barW, h, year: d.year, value: d.value });
          ctx.fillStyle = i === trend.length - 1 ? '#4f46e5' : '#4338ca';
          ctx.fillRect(x, y, barW, h);
          ctx.strokeStyle = 'rgba(30,64,175,0.65)';
          ctx.strokeRect(x, y, barW, h);
        });

        ctx.fillStyle = '#111827';
        ctx.font = '10px Consolas, monospace';
        ctx.textAlign = 'center';
        const first = trend[0], mid = trend[Math.floor(trend.length / 2)], last = trend[trend.length - 1];
        [[first, 0], [mid, Math.floor(trend.length / 2)], [last, trend.length - 1]].forEach(([d, i]) => {
          const x = pad.left + i * step + step / 2;
          ctx.fillText(d.year, x, H - 5);
        });

        let tooltip = document.getElementById('home-household-tooltip');
        if (!tooltip) {
          tooltip = document.createElement('div');
          tooltip.id = 'home-household-tooltip';
          tooltip.className = 'household-tooltip';
          document.body.appendChild(tooltip);
        }

        canvas._householdMoveHandler = (e) => {
          const rect = canvas.getBoundingClientRect();
          const mx = e.clientX - rect.left;
          const my = e.clientY - rect.top;
          const hit = bars.find(b => mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h);
          if (hit) {
            tooltip.textContent = `${hit.year}年: ${hit.value.toLocaleString('ja-JP')} 世帯`;
            tooltip.style.display = 'block';
            tooltip.style.left = (e.clientX + 14) + 'px';
            tooltip.style.top = (e.clientY - 36) + 'px';
            canvas.style.cursor = 'crosshair';
          } else {
            tooltip.style.display = 'none';
            canvas.style.cursor = '';
          }
        };
        canvas._householdLeaveHandler = () => {
          tooltip.style.display = 'none';
          canvas.style.cursor = '';
        };
        canvas.addEventListener('mousemove', canvas._householdMoveHandler);
        canvas.addEventListener('mouseleave', canvas._householdLeaveHandler);
      }

      function renderHouseholds(area, households) {
        const title = document.getElementById('home-household-title');
        const label = document.getElementById('home-household-label');
        const kpi = document.getElementById('home-household-kpi');
        const meta = document.getElementById('home-household-meta');
        const time = document.getElementById('home-household-time');
        const last = households?.[households.length - 1];
        if (title) title.textContent = `${area.city} 世帯数`;
        if (label) label.textContent = '世帯数（総数）';
        if (kpi) kpi.textContent = last ? last.value.toLocaleString('ja-JP') : '--';
        if (meta) meta.textContent = `${area.city}　${last?.year || 2020}年`;
        if (time) time.textContent = '統計ダッシュボードAPI / 国勢調査';
        drawHouseholdChart(households);
      }

      async function initDemographicsCard(forceDetect) {
        const area = await getDashboardAreaOrDefault(forceDetect);
        const popTitle = document.querySelector('#local-pop-canvas')?.closest('.local-pop-card')?.querySelector('.local-pop-title');
        const popSub = document.querySelector('#local-pop-canvas')?.closest('.local-pop-card')?.querySelector('.local-pop-sub');
        const pyrTitle = document.querySelector('#local-pyr-canvas')?.closest('.local-pyr-card')?.querySelector('.local-pop-title');
        const pyrSub = document.querySelector('#local-pyr-canvas')?.closest('.local-pyr-card')?.querySelector('.local-pop-sub');
        if (popTitle) popTitle.textContent = `${area.city} 人口推移`;
        if (popSub) popSub.textContent = '総人口（国勢調査 1980〜2020）';
        if (pyrTitle) pyrTitle.textContent = `${area.city} 人口ピラミッド`;
        if (pyrSub) pyrSub.textContent = `${area.prefecture || ''}${area.city} 2020年（国勢調査）`;

        try {
          const [popResult, householdResult, groups] = await Promise.all([
            fetchStatSeries(STAT_IND_POP_TOTAL, area.muniCd, { TimeFrom: '1980CY00', TimeTo: '2020CY00' }),
            fetchStatSeries(STAT_IND_HOUSEHOLDS, area.muniCd, { TimeFrom: '1980CY00', TimeTo: '2020CY00' }),
            fetchPyramidGroups(area.muniCd)
          ]);
          if (popResult.regionName && popResult.regionName !== area.city) area.city = popResult.regionName;
          renderHouseholds(area, householdResult.values);
          try {
            localStorage.setItem(DEMO_CACHE_KEY, JSON.stringify({
              ts: Date.now(),
              area,
              popTrend: popResult.values,
              households: householdResult.values,
              pyramid: groups
            }));
          } catch {}
          if (window.updateLocalPopulationTrend) {
            window.updateLocalPopulationTrend(area.city, popResult.values);
          } else {
            window.pendingLocalPopulationTrend = { city: area.city, trend: popResult.values };
          }
          if (window.updateLocalPyramidChart) {
            window.updateLocalPyramidChart(area.city, area.prefecture, groups);
          } else {
            window.pendingLocalPyramid = { city: area.city, prefecture: area.prefecture, groups };
          }
        } catch (e) {
          try {
            const cached = JSON.parse(localStorage.getItem(DEMO_CACHE_KEY) || 'null');
            if (cached?.popTrend?.length && cached?.households?.length && cached?.pyramid?.length) {
              renderHouseholds(cached.area, cached.households);
              window.updateLocalPopulationTrend?.(cached.area.city, cached.popTrend);
              window.updateLocalPyramidChart?.(cached.area.city, cached.area.prefecture, cached.pyramid);
              const time = document.getElementById('home-household-time');
              if (time) time.textContent = '統計データ取得失敗 — キャッシュを表示中';
              return;
            }
          } catch {}
          const fallback = DEMO_FALLBACK_BY_MUNI[area.muniCd] || (area.city === '三郷市' ? DEMO_FALLBACK_BY_MUNI['11237'] : null);
          if (fallback?.households?.length) {
            renderHouseholds(fallback.area, fallback.households);
            if (window.updateLocalPopulationTrend) {
              window.updateLocalPopulationTrend(fallback.area.city, fallback.popTrend);
            } else {
              window.pendingLocalPopulationTrend = { city: fallback.area.city, trend: fallback.popTrend };
            }
            const time = document.getElementById('home-household-time');
            if (time) time.textContent = '統計API取得失敗 — 三郷市公式データを表示中';
            return;
          }
          const time = document.getElementById('home-household-time');
          if (time) time.textContent = '世帯数の取得に失敗しました';
        }
      }

      // ─── 世界時計 ──────────────────────────────────────────────
      (function() {
        const CITIES = [
          { label: '東京', tz: 'Asia/Tokyo', flag: '🇯🇵', mkt: { name: '東証', oh: 9, om: 0, ch: 15, cm: 30 } },
          { label: 'NY', tz: 'America/New_York', flag: '🇺🇸', mkt: { name: 'NYSE', oh: 9, om: 30, ch: 16, cm: 0 } },
          { label: 'ロンドン', tz: 'Europe/London', flag: '🇬🇧', mkt: { name: 'LSE', oh: 8, om: 0, ch: 16, cm: 30 } },
        ];
        const DAY_NAMES = ['日','月','火','水','木','金','土'];

        // B: timezone offset minutes relative to Tokyo
        function getRelativeToTokyo(tz) {
          if (tz === 'Asia/Tokyo') return '';
          const now = new Date();
          const getMin = (t) => { const s = now.toLocaleString('en-US', { timeZone: t, hour12: false, hour: '2-digit', minute: '2-digit' }); const [h, m] = s.split(':').map(Number); return h * 60 + m; };
          let diff = getMin(tz) - getMin('Asia/Tokyo');
          if (diff > 720) diff -= 1440;
          if (diff < -720) diff += 1440;
          const sign = diff >= 0 ? '+' : '';
          const h = diff / 60;
          return '東京' + sign + (Number.isInteger(h) ? h : h.toFixed(1)) + 'h';
        }

        // C: remaining / next open time string
        function fmtMarketRemaining(mkt, tot, mktOpen, isWd) {
          const openMin = mkt.oh * 60 + mkt.om, closeMin = mkt.ch * 60 + mkt.cm;
          if (mktOpen) {
            const rem = closeMin - tot;
            return 'あと' + (rem >= 60 ? Math.floor(rem / 60) + 'h' : '') + (rem % 60) + 'm';
          }
          if (isWd && tot < openMin) {
            const rem = openMin - tot;
            return '開場まで' + (rem >= 60 ? Math.floor(rem / 60) + 'h' : '') + (rem % 60) + 'm';
          }
          return '';
        }

        function renderCity(city) {
          const now = new Date();
          const parts = now.toLocaleString('en-US', { timeZone: city.tz, hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }).split(':').map(Number);
          const [hh, mm, ss] = parts;
          const hDeg = (hh % 12 + mm / 60) * 30;
          const mDeg = (mm + ss / 60) * 6;
          const subSec = (Date.now() % 1000) / 1000;
          const sDeg = (ss + subSec) * 6;
          const dow = new Date(now.toLocaleString('en-US', { timeZone: city.tz })).getDay();
          const isWd = dow > 0 && dow < 6;
          const tot = hh * 60 + mm;
          const mktOpen = isWd && tot >= city.mkt.oh * 60 + city.mkt.om && tot < city.mkt.ch * 60 + city.mkt.cm;
          // A: glow ring on open markets
          const rimStroke = mktOpen ? '#22c55e' : 'rgba(148,163,184,0.2)';
          const rimWidth = mktOpen ? '2.5' : '2';
          const glowId = 'wcglow-' + city.label;
          const rimFilter = mktOpen ? 'filter="url(#' + glowId + ')"' : '';
          const ticks = [0,30,60,90,120,150,180,210,240,270,300,330].map(a => {
            const r = a * Math.PI / 180, r1 = a % 90 === 0 ? 22 : 24;
            return `<line x1="${30+r1*Math.sin(r)}" y1="${30-r1*Math.cos(r)}" x2="${30+26*Math.sin(r)}" y2="${30-26*Math.cos(r)}" stroke="rgba(148,163,184,0.5)" stroke-width="${a%90===0?2:1}"/>`;
          }).join('');
          const hand = (deg, len, w, col) => { const r = deg * Math.PI / 180; return `<line x1="30" y1="30" x2="${(30+len*Math.sin(r)).toFixed(2)}" y2="${(30-len*Math.cos(r)).toFixed(2)}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`; };
          const sR = sDeg * Math.PI / 180;
          const sx2 = (30 + 22 * Math.sin(sR)).toFixed(2), sy2 = (30 - 22 * Math.cos(sR)).toFixed(2);
          // B: date label and relative offset
          const dateStr = now.toLocaleString('en-US', { timeZone: city.tz, month: 'numeric', day: 'numeric' });
          const relTokyo = getRelativeToTokyo(city.tz);
          const dayNight = (hh >= 6 && hh < 19) ? '☀️' : '🌙';
          // C: remaining time + progress bar
          const remStr = fmtMarketRemaining(city.mkt, tot, mktOpen, isWd);
          const openMin = city.mkt.oh * 60 + city.mkt.om, closeMin = city.mkt.ch * 60 + city.mkt.cm;
          const pct = mktOpen ? Math.max(0, Math.min(100, (tot - openMin) / (closeMin - openMin) * 100)).toFixed(1) : 0;
          const progressInner = mktOpen ? '<div style="width:' + pct + '%;height:100%;background:var(--green);border-radius:2px"></div>' : '';
          const glowDef = mktOpen ? '<defs><filter id="' + glowId + '"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' : '';
          return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
            <div style="font-size:0.72rem;font-weight:600">${city.flag} ${city.label} ${dayNight}</div>
            <svg viewBox="0 0 60 60" width="56" height="56">
              ${glowDef}
              <circle cx="30" cy="30" r="28" fill="none" stroke="${rimStroke}" stroke-width="${rimWidth}" ${rimFilter}/>
              ${ticks}
              ${hand(hDeg, 14, 2.5, 'currentColor')}
              ${hand(mDeg, 20, 1.5, 'currentColor')}
              <line id="wc-sec-${city.label}" x1="30" y1="30" x2="${sx2}" y2="${sy2}" stroke="#ef4444" stroke-width="1" stroke-linecap="round"/>
              <circle cx="30" cy="30" r="2" fill="#ef4444"/>
            </svg>
            <div style="font-size:0.88rem;font-weight:700;letter-spacing:1px;font-variant-numeric:tabular-nums">${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}</div>
            <div style="font-size:0.62rem;color:var(--muted)">${dateStr} ${DAY_NAMES[dow]}${relTokyo ? ' <span style="color:var(--blue);opacity:0.85">' + relTokyo + '</span>' : ''}</div>
            <div style="font-size:0.6rem;padding:1px 5px;border-radius:8px;font-weight:600;background:${mktOpen?'rgba(34,197,94,0.15)':'rgba(100,116,139,0.12)'};color:${mktOpen?'#22c55e':'var(--muted)'}">
              ${city.mkt.name} ${mktOpen?'開場中':'閉場'}${remStr?' · '+remStr:''}
            </div>
            <div style="width:100%;height:3px;background:rgba(100,116,139,0.15);border-radius:2px;overflow:hidden;margin-top:1px">${progressInner}</div>
          </div>`;
        }

        let lastSec = -1;
        function updateWorldClock() {
          const grid = document.getElementById('home-worldclock-grid');
          if (!grid) return;
          const sec = Math.floor(Date.now() / 1000);
          if (sec !== lastSec) {
            // Full render every second (updates all elements)
            lastSec = sec;
            grid.innerHTML = CITIES.map(c => renderCity(c)).join('');
          } else {
            // D: smooth second hand – update only x2/y2 at 100ms intervals
            const now = new Date();
            const sub = (Date.now() % 1000) / 1000;
            CITIES.forEach(city => {
              const el = document.getElementById('wc-sec-' + city.label);
              if (!el) return;
              const s = now.toLocaleString('en-US', { timeZone: city.tz, hour12: false, second: '2-digit' });
              const sDeg = (parseInt(s, 10) + sub) * 6;
              const r = sDeg * Math.PI / 180;
              el.setAttribute('x2', (30 + 22 * Math.sin(r)).toFixed(2));
              el.setAttribute('y2', (30 - 22 * Math.cos(r)).toFixed(2));
            });
          }
        }
        updateWorldClock();
        setInterval(updateWorldClock, 100);
      })();

      // ─── ダッシュボード表示・並び替え設定（ユーザーごとにlocalStorage保存） ─────
      (function initDashboardLayoutSettings() {
        const grid = document.getElementById('dashboard-grid');
        const panel = document.getElementById('dashboard-layout-panel');
        const list = document.getElementById('dashboard-layout-list');
        const toggleBtn = document.getElementById('dashboard-layout-toggle');
        const resetBtn = document.getElementById('dashboard-layout-reset');
        if (!grid || !panel || !list || !toggleBtn || !resetBtn) return;

        const STORAGE_KEY = 'home-dashboard-layout-v1';
        const CARD_DEFS = [
          { id: 'dash-card-visit', ja: 'サイト訪問数', en: 'Site Visits' },
          { id: 'dash-card-weather', ja: '天気', en: 'Weather' },
          { id: 'dash-card-fx', ja: '円相場', en: 'Yen Rate' },
          { id: 'dash-card-stock', ja: '株価指数', en: 'Stock Index' },
          { id: 'dash-card-gas', ja: 'ガソリン相場', en: 'Gasoline Price' },
          { id: 'dash-card-traffic', ja: '交通情報', en: 'Traffic' },
          { id: 'dash-card-household', ja: '世帯数', en: 'Households' },
          { id: 'dash-card-updates', ja: '更新履歴', en: 'Update Log' },
          { id: 'dash-card-game-history', ja: 'ゲーム履歴', en: 'Game History' },
          { id: 'dash-card-todo', ja: 'TODO / メモ', en: 'TODO / Notes' },
          { id: 'dash-card-calendar', ja: '予定カレンダー', en: 'Calendar' },
          { id: 'dash-card-train', ja: '電車遅延情報', en: 'Train Delays' },
          { id: 'dash-card-population', ja: '人口推移', en: 'Population Trend' },
          { id: 'dash-card-pyramid', ja: '人口ピラミッド', en: 'Population Pyramid' },
          { id: 'dash-card-pomodoro', ja: 'ポモドーロタイマー', en: 'Pomodoro Timer' },
          { id: 'dash-card-quake', ja: '地震・防災情報', en: 'Earthquake Info' },
          { id: 'dash-card-worldclock', ja: '世界時計', en: 'World Clock' },
          { id: 'dash-card-news', ja: '最新ニュース', en: 'Latest News' },
          { id: 'dash-card-quicklinks', ja: 'よく使うリンク', en: 'Quick Links' },
        ].filter(def => document.getElementById(def.id));
        const defaultOrder = CARD_DEFS.map(def => def.id);

        function readConfig() {
          try {
            const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            const savedOrder = Array.isArray(parsed.order) ? parsed.order.filter(id => defaultOrder.includes(id)) : [];
            const order = [...savedOrder, ...defaultOrder.filter(id => !savedOrder.includes(id))];
            const hidden = Array.isArray(parsed.hidden) ? parsed.hidden.filter(id => defaultOrder.includes(id)) : [];
            return { order, hidden };
          } catch {
            return { order: [...defaultOrder], hidden: [] };
          }
        }

        function saveConfig(config) {
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch {}
        }

        function lang() {
          return localStorage.getItem('site-lang') === 'en' ? 'en' : 'ja';
        }

        function labelFor(id) {
          const def = CARD_DEFS.find(item => item.id === id);
          return def ? def[lang()] : id;
        }

        function applyLayout(config) {
          config.order.forEach(id => {
            const card = document.getElementById(id);
            if (card) grid.appendChild(card);
          });
          defaultOrder.forEach(id => {
            const card = document.getElementById(id);
            if (card) card.classList.toggle('dashboard-hidden', config.hidden.includes(id));
          });
        }

        function renderPanel() {
          const config = readConfig();
          applyLayout(config);
          list.innerHTML = config.order.map((id, index) => {
            const hidden = config.hidden.includes(id);
            const disabledUp = index === 0 ? 'disabled' : '';
            const disabledDown = index === config.order.length - 1 ? 'disabled' : '';
            return `
              <div class="dashboard-layout-item" data-card-id="${id}">
                <input type="checkbox" ${hidden ? '' : 'checked'} aria-label="${labelFor(id)}を表示">
                <span class="dashboard-layout-name">${labelFor(id)}</span>
                <button class="dashboard-move-btn" type="button" data-move="up" ${disabledUp} aria-label="${labelFor(id)}を上へ">↑</button>
                <button class="dashboard-move-btn" type="button" data-move="down" ${disabledDown} aria-label="${labelFor(id)}を下へ">↓</button>
              </div>
            `;
          }).join('');
          window.dispatchEvent(new Event('dashboard-layout-changed'));
        }

        function updateConfig(mutator) {
          const config = readConfig();
          mutator(config);
          config.order = config.order.filter(id => defaultOrder.includes(id));
          config.hidden = config.hidden.filter(id => defaultOrder.includes(id));
          saveConfig(config);
          renderPanel();
        }

        list.addEventListener('change', event => {
          const input = event.target.closest('input[type="checkbox"]');
          if (!input) return;
          const item = input.closest('.dashboard-layout-item');
          const id = item?.dataset.cardId;
          if (!id) return;
          updateConfig(config => {
            if (input.checked) {
              config.hidden = config.hidden.filter(hiddenId => hiddenId !== id);
              return;
            }
            const visibleCount = config.order.filter(cardId => !config.hidden.includes(cardId)).length;
            if (visibleCount <= 1) {
              input.checked = true;
              return;
            }
            if (!config.hidden.includes(id)) config.hidden.push(id);
          });
        });

        list.addEventListener('click', event => {
          const button = event.target.closest('[data-move]');
          if (!button) return;
          const id = button.closest('.dashboard-layout-item')?.dataset.cardId;
          if (!id) return;
          updateConfig(config => {
            const index = config.order.indexOf(id);
            const next = button.dataset.move === 'up' ? index - 1 : index + 1;
            if (index < 0 || next < 0 || next >= config.order.length) return;
            [config.order[index], config.order[next]] = [config.order[next], config.order[index]];
          });
        });

        toggleBtn.addEventListener('click', () => {
          const open = !panel.classList.contains('open');
          panel.classList.toggle('open', open);
          panel.setAttribute('aria-hidden', String(!open));
          toggleBtn.setAttribute('aria-expanded', String(open));
          if (open) renderPanel();
        });

        resetBtn.addEventListener('click', () => {
          saveConfig({ order: [...defaultOrder], hidden: [] });
          renderPanel();
        });

        window.addEventListener('site-lang-change', renderPanel);
        renderPanel();
      })();

      // ── テーマカラー ──────────────────────────────────────────
      (function initDashboardTheme() {
        const THEME_KEY = 'home-dashboard-theme';
        const THEMES = [
          { id: 'sky',    label: 'スカイ',   color: '#0ea5e9', vars: { '--blue':'#0ea5e9', '--blue-soft':'rgba(14,165,233,0.12)',  '--bg':'#fffbf5', '--surface-warm':'#fff3e6', '--line':'rgba(28,25,23,0.08)', '--card-tint':'white',                    '--card-border':'rgba(14,165,233,0.18)' }},
          { id: 'purple', label: 'パープル', color: '#a855f7', vars: { '--blue':'#a855f7', '--blue-soft':'rgba(168,85,247,0.12)', '--bg':'#fffbf5', '--surface-warm':'#fff3e6', '--line':'rgba(28,25,23,0.08)', '--card-tint':'rgba(168,85,247,0.06)', '--card-border':'rgba(168,85,247,0.22)' }},
          { id: 'green',  label: 'グリーン', color: '#22c55e', vars: { '--blue':'#22c55e', '--blue-soft':'rgba(34,197,94,0.12)',   '--bg':'#fffbf5', '--surface-warm':'#fff3e6', '--line':'rgba(28,25,23,0.08)', '--card-tint':'rgba(34,197,94,0.06)',   '--card-border':'rgba(34,197,94,0.22)'  }},
          { id: 'orange', label: 'オレンジ', color: '#f97316', vars: { '--blue':'#f97316', '--blue-soft':'rgba(249,115,22,0.12)',  '--bg':'#fffbf5', '--surface-warm':'#fff3e6', '--line':'rgba(28,25,23,0.08)', '--card-tint':'rgba(249,115,22,0.06)',  '--card-border':'rgba(249,115,22,0.22)' }},
          { id: 'rose',   label: 'ローズ',   color: '#f43f5e', vars: { '--blue':'#f43f5e', '--blue-soft':'rgba(244,63,94,0.12)',   '--bg':'#fffbf5', '--surface-warm':'#fff3e6', '--line':'rgba(28,25,23,0.08)', '--card-tint':'rgba(244,63,94,0.06)',   '--card-border':'rgba(244,63,94,0.22)'  }},
        ];

        const container = document.getElementById('dashboard-theme-swatches');
        if (!container) return;

        function applyTheme(id) {
          const theme = THEMES.find(t => t.id === id) || THEMES[0];
          const root = document.documentElement;
          Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
          container.querySelectorAll('.dashboard-theme-swatch').forEach(el =>
            el.classList.toggle('active', el.dataset.themeId === theme.id)
          );
          try { localStorage.setItem(THEME_KEY, theme.id); } catch {}
        }

        container.innerHTML = THEMES.map(t =>
          `<button class="dashboard-theme-swatch" data-theme-id="${t.id}" title="${t.label}"
            style="background:${t.color}" aria-label="テーマ: ${t.label}" type="button"></button>`
        ).join('');

        container.addEventListener('click', e => {
          const btn = e.target.closest('.dashboard-theme-swatch');
          if (btn) applyTheme(btn.dataset.themeId);
        });

        const saved = (() => { try { return localStorage.getItem(THEME_KEY); } catch { return null; } })();
        applyTheme(saved || 'sky');
      })();

      // ── カードドラッグ＆ドロップ ──────────────────────────────
      (function initCardDragDrop() {
        const grid = document.getElementById('dashboard-grid');
        if (!grid) return;

        let dragSrc = null;

        function makeDraggable() {
          grid.querySelectorAll('.dashboard-card').forEach(card => card.setAttribute('draggable', 'true'));
        }
        makeDraggable();
        new MutationObserver(makeDraggable).observe(grid, { childList: true });

        grid.addEventListener('dragstart', e => {
          const card = e.target.closest('.dashboard-card');
          if (!card) return;
          dragSrc = card;
          e.dataTransfer.effectAllowed = 'move';
          setTimeout(() => card.classList.add('card-dragging'), 0);
        });

        grid.addEventListener('dragend', () => {
          grid.querySelectorAll('.dashboard-card').forEach(c => c.classList.remove('card-dragging', 'card-dragover'));
          dragSrc = null;
          saveDragOrder();
        });

        grid.addEventListener('dragover', e => {
          e.preventDefault();
          const card = e.target.closest('.dashboard-card');
          if (!card || card === dragSrc || !dragSrc) return;
          grid.querySelectorAll('.dashboard-card').forEach(c => c.classList.remove('card-dragover'));
          card.classList.add('card-dragover');
          const rect = card.getBoundingClientRect();
          if (e.clientY < rect.top + rect.height / 2) grid.insertBefore(dragSrc, card);
          else grid.insertBefore(dragSrc, card.nextSibling);
        });

        grid.addEventListener('drop', e => {
          e.preventDefault();
          grid.querySelectorAll('.dashboard-card').forEach(c => c.classList.remove('card-dragover', 'card-dragging'));
          saveDragOrder();
        });

        function saveDragOrder() {
          const order = [...grid.querySelectorAll('.dashboard-card')].map(c => c.id).filter(Boolean);
          try {
            const existing = JSON.parse(localStorage.getItem('home-dashboard-layout-v1') || '{}');
            existing.order = order;
            localStorage.setItem('home-dashboard-layout-v1', JSON.stringify(existing));
          } catch {}
        }
      })();

      // ── ダッシュボード説明文 動的更新 ─────────────────────────
      (function initDashboardDesc() {
        const CARD_LABELS = {
          'dash-card-visit':      { ja: 'アクセス数',        en: 'Site Visits' },
          'dash-card-weather':    { ja: '天気',              en: 'Weather' },
          'dash-card-fx':         { ja: '円相場',            en: 'Yen Rate' },
          'dash-card-stock':      { ja: '株価指数',          en: 'Stock Index' },
          'dash-card-gas':        { ja: 'ガソリン相場',      en: 'Gasoline Price' },
          'dash-card-traffic':    { ja: '交通情報',          en: 'Traffic' },
          'dash-card-household':  { ja: '世帯数',            en: 'Households' },
          'dash-card-updates':    { ja: '更新履歴',          en: 'Update Log' },
          'dash-card-todo':       { ja: 'TODO・メモ',        en: 'TODO/Notes' },
          'dash-card-calendar':   { ja: '予定カレンダー',    en: 'Calendar' },
          'dash-card-train':      { ja: '電車遅延情報',      en: 'Train Delays' },
          'dash-card-population': { ja: '人口推移',          en: 'Population Trend' },
          'dash-card-pyramid':    { ja: '人口ピラミッド',    en: 'Population Pyramid' },
          'dash-card-pomodoro':   { ja: 'ポモドーロタイマー', en: 'Pomodoro Timer' },
          'dash-card-quake':      { ja: '地震・防災情報',    en: 'Earthquake Info' },
          'dash-card-worldclock': { ja: '世界時計',          en: 'World Clock' },
          'dash-card-news':       { ja: '最新ニュース',      en: 'Latest News' },
          'dash-card-quicklinks': { ja: 'よく使うリンク',    en: 'Quick Links' },
        };
        const ALL_IDS = Object.keys(CARD_LABELS);

        function getLang() { return localStorage.getItem('site-lang') === 'en' ? 'en' : 'ja'; }

        function getCity() {
          try {
            const loc = JSON.parse(localStorage.getItem('dashboard-location-v2') || 'null');
            return loc?.city || '三郷市';
          } catch { return '三郷市'; }
        }

        function update(overrideCity) {
          const el = document.getElementById('dash-desc-dynamic');
          if (!el) return;
          const lang = getLang();
          let order = [...ALL_IDS], hidden = [];
          try {
            const cfg = JSON.parse(localStorage.getItem('home-dashboard-layout-v1') || '{}');
            if (Array.isArray(cfg.order)) {
              const saved = cfg.order.filter(id => ALL_IDS.includes(id));
              order = [...saved, ...ALL_IDS.filter(id => !saved.includes(id))];
            }
            if (Array.isArray(cfg.hidden)) hidden = cfg.hidden.filter(id => ALL_IDS.includes(id));
          } catch {}

          const labels = order
            .filter(id => !hidden.includes(id) && document.getElementById(id))
            .map(id => CARD_LABELS[id]?.[lang] || id);

          const city = overrideCity || getCity();
          el.removeAttribute('data-i18n'); // 静的翻訳キーを外す
          if (lang === 'en') {
            el.textContent = `${city} — ${labels.join(' · ')}`;
          } else {
            el.textContent = `${city} ／ ${labels.join('・')}`;
          }
        }

        window.addEventListener('dashboard-layout-changed', () => update());
        window.addEventListener('dashboard-location-updated', e => update(e.detail?.city));
        window.addEventListener('site-lang-change', () => update());
        setTimeout(update, 200);
      })();

      // API 系はダッシュボードが視野に入るまで遅延ロード
      let dashboardAPIsReady = false;

      async function refreshLocationDashboards(forceDetect) {
        const btn = document.getElementById('dashboard-locate-btn');
        if (btn) {
          btn.disabled = true;
          btn.textContent = '取得中…';
        }
        try {
          if (forceDetect) {
            try {
              localStorage.removeItem(DASHBOARD_LOC_KEY);
              localStorage.removeItem(GAS_AREA_CACHE_KEY);
            } catch {}
            try { await detectDashboardArea(true); } catch {}
          }
          await Promise.allSettled([
            initWeatherCard(),
            initGasCard(false),
            initTrafficCard(),
            initDemographicsCard(false)
          ]);
        } finally {
          if (btn) {
            btn.disabled = false;
            btn.textContent = localStorage.getItem('site-lang') === 'en' ? '📍 Locate' : '📍 現在地';
          }
        }
      }

      document.getElementById('dashboard-locate-btn')?.addEventListener('click', () => {
        if (!dashboardAPIsReady) {
          initDashboardAPIs();
        }
        refreshLocationDashboards(true);
      });

      window.initNewsCard = async function initNewsCard() {
        const list = document.getElementById('home-news-list');
        const timeEl = document.getElementById('home-news-time');
        if (!list) return;
        list.innerHTML = '<li class="dashboard-mini-item"><span style="color:var(--muted)">取得中…</span></li>';

        const NEWS_SOURCES = [
          'https://www3.nhk.or.jp/rss/news/cat0.xml',
          'https://b.hatena.ne.jp/hotentry.rss',
        ];
        const NEWS_PROXIES = [
          u => `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(u)}&count=7`,
          u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
          u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
          u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
          u => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
        ];

        function parseRSSXml(xml) {
          const doc = new DOMParser().parseFromString(xml, 'text/xml');
          return [...doc.querySelectorAll('item')].slice(0, 7).map(item => ({
            title: item.querySelector('title')?.textContent?.trim() || '',
            link: item.querySelector('link')?.textContent?.trim() || '#',
          })).filter(i => i.title);
        }

        function renderItems(items) {
          list.innerHTML = items.map(item => {
            const safeLink = /^https?:\/\//i.test(item.link) ? item.link : '#';
            return `<li class="dashboard-mini-item" style="padding:6px 10px;">
              <a href="${safeLink}" target="_blank" rel="noopener noreferrer"
                 style="color:inherit;text-decoration:none;font-size:0.82rem;line-height:1.4;flex:1">
                ${escHtml(item.title)}
              </a>
            </li>`;
          }).join('');
          if (timeEl) timeEl.textContent = '更新: ' + new Date().toLocaleTimeString('ja-JP', {hour:'2-digit',minute:'2-digit'});
        }

        for (const src of NEWS_SOURCES) {
          for (const makeProxy of NEWS_PROXIES) {
            try {
              const url = makeProxy(src);
              const res = await fetchWithTimeout(url, 9000);
              if (!res.ok) continue;
              // rss2json returns JSON; other proxies return raw XML or {contents}
              const ct = res.headers.get('content-type') || '';
              if (ct.includes('json') || url.includes('rss2json')) {
                const data = await res.json();
                // rss2json format
                if (data.status === 'ok' && data.items?.length) { renderItems(data.items); return; }
                // allorigins/get format
                const items = parseRSSXml(data.contents || '');
                if (items.length) { renderItems(items); return; }
              } else {
                const xml = await res.text();
                const items = parseRSSXml(xml);
                if (items.length) { renderItems(items); return; }
              }
            } catch {}
          }
        }

        list.innerHTML = `<li class="dashboard-mini-item" style="flex-direction:column;gap:6px;">
          <span style="color:var(--muted);font-size:0.8rem;">ニュースを取得できませんでした</span>
          <a href="https://www3.nhk.or.jp/news/" target="_blank" rel="noopener noreferrer" style="font-size:0.78rem;color:var(--blue,#0ea5e9)">NHKニュースを確認する →</a>
        </li>`;
      };
      setInterval(initNewsCard, 30 * 60 * 1000);

      window.initAINewsCard = async function initAINewsCard() {
        const list = document.getElementById('home-ai-news-list');
        const timeEl = document.getElementById('home-ai-news-time');
        if (!list) return;
        list.innerHTML = '<li class="dashboard-mini-item"><span style="color:var(--muted)">取得中…</span></li>';

        const AI_SOURCES = [
          'https://rss.itmedia.co.jp/rss/2.0/ait.xml',
          'https://venturebeat.com/category/ai/feed/',
          'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
        ];
        const AI_PROXIES = [
          u => `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(u)}&count=5`,
          u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
          u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
          u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
          u => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
        ];

        function parseAIRSSXml(xml) {
          const doc = new DOMParser().parseFromString(xml, 'text/xml');
          return [...doc.querySelectorAll('item')].slice(0, 5).map(item => ({
            title: item.querySelector('title')?.textContent?.trim() || '',
            link: item.querySelector('link')?.textContent?.trim() || '#',
            pubDate: item.querySelector('pubDate')?.textContent?.trim() || '',
          })).filter(i => i.title);
        }

        async function fetchAISource(src) {
          for (const makeProxy of AI_PROXIES) {
            try {
              const url = makeProxy(src);
              const res = await fetchWithTimeout(url, 9000);
              if (!res.ok) continue;
              const ct = res.headers.get('content-type') || '';
              if (ct.includes('json') || url.includes('rss2json')) {
                const data = await res.json();
                if (data.status === 'ok' && data.items?.length) {
                  return data.items.slice(0, 5).map(i => ({ title: i.title || '', link: i.link || '#', pubDate: i.pubDate || '' })).filter(i => i.title);
                }
                const items = parseAIRSSXml(data.contents || '');
                if (items.length) return items;
              } else {
                const xml = await res.text();
                const items = parseAIRSSXml(xml);
                if (items.length) return items;
              }
            } catch {}
          }
          return [];
        }

        const results = await Promise.allSettled(AI_SOURCES.map(fetchAISource));
        const allItems = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);

        allItems.sort((a, b) => {
          const da = a.pubDate ? new Date(a.pubDate) : 0;
          const db = b.pubDate ? new Date(b.pubDate) : 0;
          return db - da;
        });

        const deduped = [];
        const seen = new Set();
        for (const item of allItems) {
          const key = item.title.slice(0, 40);
          if (!seen.has(key)) { seen.add(key); deduped.push(item); }
          if (deduped.length >= 8) break;
        }

        if (deduped.length > 0) {
          list.innerHTML = deduped.map(item => {
            const safeLink = /^https?:\/\//i.test(item.link) ? item.link : '#';
            return `<li class="dashboard-mini-item" style="padding:6px 10px;">
              <a href="${safeLink}" target="_blank" rel="noopener noreferrer"
                 style="color:inherit;text-decoration:none;font-size:0.82rem;line-height:1.4;flex:1">
                ${escHtml(item.title)}
              </a>
            </li>`;
          }).join('');
        } else {
          list.innerHTML = `<li class="dashboard-mini-item" style="flex-direction:column;gap:6px;">
            <span style="color:var(--muted);font-size:0.8rem;">ニュースを取得できませんでした</span>
            <a href="https://venturebeat.com/category/ai/" target="_blank" rel="noopener noreferrer" style="font-size:0.78rem;color:var(--blue,#0ea5e9)">VentureBeat AIを確認する →</a>
          </li>`;
        }
        if (timeEl) timeEl.textContent = '更新: ' + new Date().toLocaleTimeString('ja-JP', {hour:'2-digit',minute:'2-digit'});
      };
      setInterval(initAINewsCard, 30 * 60 * 1000);


      function initDashboardAPIs() {
        if (dashboardAPIsReady) return;
        dashboardAPIsReady = true;
        (async () => {
          try { await detectDashboardArea(false); } catch {}
          await Promise.allSettled([
            initVisitCard(),
            initWeatherCard(),
            initFxCard(),
            initStockCard(),
            renderCustomStocks(),
            renderCompareChart(),
            initGasCard(),
            initDemographicsCard(),
            initTrainCard(),
            initQuakeCard(),
            initTrafficCard(),
            initNewsCard(),
            initAINewsCard(),
          ]);
        })().catch(() => {});
      }

      const dashboardSection = document.getElementById('dashboard');
      if (dashboardSection && 'IntersectionObserver' in window) {
        const observer = new IntersectionObserver(
          (entries) => {
            if (entries[0].isIntersecting) {
              initDashboardAPIs();
              observer.disconnect();
            }
          },
          { rootMargin: '200px' }  // 200px手前からプリロード開始
        );
        observer.observe(dashboardSection);
      } else {
        initDashboardAPIs();
      }
    })();

    // My ブログ：最新3件を blogs.json から動的表示（フォールバック: localStorage）
    (async function() {
      const COVER = ['cover-orange','cover-blue','cover-green','cover-purple','cover-pink'];
      function fmtDate(iso) {
        const d = new Date(iso);
        return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
      }
      function escH(s) {
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      }
      const grid = document.getElementById('indexBlogGrid');
      let allBlogs;
      try {
        const resp = await fetch('./blogs.json?_=' + Date.now());
        if (resp.ok) allBlogs = await resp.json();
      } catch {}
      if (!allBlogs) allBlogs = JSON.parse(localStorage.getItem('admin_blogs') || '[]');
      const blogs = allBlogs.sort((a,b) => (b.updated_at > a.updated_at ? 1 : -1)).slice(0, 3);
      if (!blogs.length) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:48px 0;color:#aaa;font-size:0.9rem;">まだ記事がありません</div>';
        return;
      }
      grid.innerHTML = blogs.map((b, i) =>
        `<a href="blog-post.html?id=${encodeURIComponent(b.id)}" style="text-decoration:none;color:inherit;background:#fff;border:1.5px solid #e7e5e4;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,0.06);overflow:hidden;display:flex;flex-direction:column;transition:transform 0.2s,box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-4px)';this.style.boxShadow='0 10px 32px rgba(0,0,0,0.1)';" onmouseout="this.style.transform='';this.style.boxShadow='0 2px 12px rgba(0,0,0,0.06)';">
          <div class="blog-card-cover ${COVER[i % COVER.length]}"></div>
          <div style="padding:20px 22px 22px;display:flex;flex-direction:column;gap:8px;flex:1;">
            <span style="font-size:0.7rem;color:#78716c;">${fmtDate(b.updated_at)}</span>
            <h3 style="font-size:0.98rem;font-weight:700;line-height:1.5;color:#1c1917;">${escH(b.title)}</h3>
            <span style="font-size:0.78rem;color:#f97316;font-weight:600;margin-top:4px;">続きを読む →</span>
          </div>
        </a>`
      ).join('');
    })();

    // 三郷市イベントカレンダー
    (function() {
      function escH(s) {
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      }
      const EVENTS = [
        { emoji:'⛩️', month:1, day:1, endMonth:1, endDay:7,
          name:'七福神巡り', location:'市内24寺院（3コース）', desc:'スタンプ台紙500円。全寺院制覇でタオルプレゼント。',
          nameEn:'Seven Lucky Gods Pilgrimage', locationEn:'24 temples in the city (3 routes)', descEn:'Stamp card ¥500. Complete all temples and win a towel gift.',
          url:'https://misato-city.com/?program=%E4%B8%83%E7%A6%8F%E7%A5%9E%E3%82%81%E3%81%90%E3%82%8A' },
        { emoji:'🐍', month:1, day:10, endMonth:1, endDay:10,
          name:'オビジャ（大広戸の蛇祭り）', location:'大広戸香取神社', desc:'1月10日開催。藁で作った大蛇を奉納する三郷独自の伝統行事。',
          nameEn:'Obija — Ohirodo Snake Festival', locationEn:'Ohirodo Katori Shrine', descEn:'Jan 10. A unique Misato tradition: offering a straw serpent at the shrine.',
          url:'https://misato-city.com/' },
        { emoji:'🏃', month:2, day:8, endMonth:2, endDay:8,
          name:'みさとシティハーフマラソン', location:'三郷市内', desc:'2月第2日曜開催。市内を走る本格マラソン大会。',
          nameEn:'Misato City Half Marathon', locationEn:'Throughout Misato City', descEn:'2nd Sunday of Feb. A full-scale half marathon through the city.',
          url:'https://misato-city.com/' },
        { emoji:'🎨', month:2, day:22, endMonth:2, endDay:22,
          name:'三郷文化協会祭', location:'文化会館', desc:'2月下旬開催。市民文化団体による芸術・文化の祭典。',
          nameEn:'Misato Cultural Association Festival', locationEn:'Cultural Hall', descEn:'Late Feb. A festival of art and culture by civic organizations.',
          url:'' },
        { emoji:'🌸', month:3, day:14, endMonth:4, endDay:15,
          name:'ちょうちんで彩る川辺の桜', location:'におどり公園・大場川沿い', desc:'夜桜×ちょうちんイルミネーション。18〜21時。',
          nameEn:'Riverside Sakura with Paper Lanterns', locationEn:'Niodori Park / Oba River', descEn:'Night cherry blossoms & lantern illuminations. 6–9 PM.',
          url:'https://www.city.misato.lg.jp/soshiki/machizukuri_suishin/machizukurijigyo/4/10266.html' },
        { emoji:'🎪', month:5, day:3, endMonth:5, endDay:4,
          name:'みさと船着場フェスティバル', location:'三郷緊急船着場（江戸川河川敷）', desc:'5月上旬開催。江戸川河川敷の船着場で開催される屋外フェスティバル。',
          nameEn:'Misato Funatsukiba Festival', locationEn:'Misato Boat Dock (Edogawa Riverbank)', descEn:'Early May. An outdoor festival at the riverside boat dock.',
          url:'https://misato-city.com/' },
        { emoji:'🌺', month:5, day:17, endMonth:5, endDay:18,
          name:'さつき展', location:'水の輪市民センター', desc:'',
          nameEn:'Satsuki (Azalea) Exhibition', locationEn:'Mizunowa Civic Center', descEn:'',
          url:'' },
        { emoji:'🦁', month:6, day:5, endMonth:6, endDay:7,
          name:'三匹の獅子舞（戸ヶ崎）', location:'戸ヶ崎香取神社', desc:'400年以上続く伝統行事。6月第1日曜を含む金〜日開催。',
          nameEn:'Three Lions Dance (Togasaki)', locationEn:'Togasaki Katori Shrine', descEn:'A 400-year-old tradition. Held Fri–Sun including the 1st Sunday of June.',
          url:'https://www.city.misato.lg.jp/soshiki/syogaigakusyu/shogaigakushu/shogaigakushuinfo/8478.html' },
        { emoji:'🏮', month:7, day:11, endMonth:7, endDay:11,
          name:'大般若経祭り', location:'迎攝院・神明神社（番匠免）', desc:'7月8日前後の土曜開催。地域の伝統行事。',
          nameEn:'Daihanya-kyo Ceremony', locationEn:'Goshoin / Shimmei Shrine (Banshoumen)', descEn:'Saturday around July 8. A local traditional religious ceremony.',
          url:'' },
        { emoji:'🥁', month:7, day:12, endMonth:7, endDay:12,
          name:'二郷半囃子・里神楽', location:'上口香取神社', desc:'7月第2土曜開催。伝統の囃子・神楽の奉納。',
          nameEn:'Nigohan Hayashi & Satokagura', locationEn:'Kamiguchi Katori Shrine', descEn:'2nd Saturday of July. Traditional hayashi music & kagura dance dedication.',
          url:'' },
        { emoji:'🏮', month:8, day:16, endMonth:8, endDay:17,
          name:'盆踊り（ららぽーと新三郷）', location:'ららぽーと新三郷 みどりの広場', desc:'17:30〜20:00。',
          nameEn:'Bon Odori (LaLaport Shin-Misato)', locationEn:'LaLaport Shin-Misato (Green Square)', descEn:'5:30–8:00 PM.',
          url:'https://mitsui-shopping-park.com/lalaport/shinmisato/' },
        { emoji:'🌿', month:9, day:27, endMonth:9, endDay:27,
          name:'環境フェスタ・生活安全フェア', location:'市役所市民広場・勤労者体育館', desc:'環境・防犯をテーマにした市民参加型イベント。9月下旬開催。',
          nameEn:'Environment Festa & Safety Fair', locationEn:'City Hall Plaza / Workers Gymnasium', descEn:'A civic event on environment & crime prevention. Late September.',
          url:'' },
        { emoji:'🎆', month:10, day:4, endMonth:10, endDay:4,
          name:'MISATO HANABI ga NIGHT', location:'江戸川運動公園', desc:'約12,000発。17:00開場 / 18:00打ち上げ。',
          nameEn:'MISATO HANABI ga NIGHT', locationEn:'Edogawa Sports Park', descEn:'About 12,000 fireworks. Gates 5 PM / Launch 6 PM.',
          url:'https://www.city.misato.lg.jp/soshiki/chiikishinko/shokokanko/4/8420.html' },
        { emoji:'🚒', month:10, day:5, endMonth:10, endDay:5,
          name:'緊急車両大集合', location:'におどり公園', desc:'自衛隊・警察・消防の車両展示＆乗車体験。',
          nameEn:'Emergency Vehicle Expo', locationEn:'Niodori Park', descEn:'JSDF, police & fire vehicle displays with ride-on experiences.',
          url:'' },
        { emoji:'🎡', month:10, day:11, endMonth:10, endDay:11,
          name:'misato style', location:'におどり公園', desc:'三郷市の魅力を発信する大型市民イベント。10月中旬開催。',
          nameEn:'misato style', locationEn:'Niodori Park', descEn:'A large civic event showcasing the charms of Misato. Mid-October.',
          url:'https://misato-city.com/' },
        { emoji:'🏃', month:10, day:12, endMonth:10, endDay:12,
          name:'みさとスポーツフェスティバル', location:'セナリオハウスフィールド三郷', desc:'市内最大のスポーツイベント。各種競技体験あり。10月中旬開催。',
          nameEn:'Misato Sports Festival', locationEn:'Scenario House Field Misato', descEn:"The city's largest sports event. Various sport experiences. Mid-October.",
          url:'' },
        { emoji:'🦁', month:10, day:18, endMonth:10, endDay:18,
          name:'幸房・岩野木の獅子舞', location:'富足神社（岩野木）', desc:'10月15日前後の日曜開催。伝統の獅子舞奉納。',
          nameEn:'Kobo & Iwanoki Lions Dance', locationEn:'Tomitari Shrine (Iwanoki)', descEn:'Sunday around Oct 15. Traditional lion dance dedication.',
          url:'' },
        { emoji:'🌸', month:10, day:22, endMonth:10, endDay:28,
          name:'三郷市菊花展', location:'市役所1階フロア', desc:'市民が丹精込めた菊の展示会。10月下旬開催。',
          nameEn:'Misato Chrysanthemum Exhibition', locationEn:'City Hall 1F', descEn:'A display of chrysanthemums grown by residents. Late October.',
          url:'' },
        { emoji:'🎭', month:10, day:24, endMonth:10, endDay:25,
          name:'三郷市民文化祭', location:'文化会館他', desc:'音楽・演劇・美術など市民の芸術文化の発表の場。10月下旬開催。',
          nameEn:"Misato Citizens' Cultural Festival", locationEn:'Cultural Hall & other venues', descEn:'Music, theater & visual arts showcase by residents. Late October.',
          url:'' },
        { emoji:'🎃', month:10, day:26, endMonth:10, endDay:26,
          name:'三郷ハロウィンフェス', location:'TX三郷中央駅前・につどりプラザ', desc:'仮装パレード＆コンテスト。11:00〜16:00。',
          nameEn:'Misato Halloween Fest', locationEn:'TX Misato Chuo Sta. / Nitsudori Plaza', descEn:'Costume parade & contest. 11 AM–4 PM.',
          url:'https://www.city.misato.lg.jp/soshiki/machizukuri_suishin/machizukurijigyo/4/2563.html' },
        { emoji:'🌾', month:11, day:15, endMonth:11, endDay:16,
          name:'産業フェスタ', location:'市役所南駐車場・勤労市民体育館', desc:'物産展・農産物販売・ステージショー。10:00〜。',
          nameEn:'Industry & Agriculture Festa', locationEn:'City Hall South Parking / Labor Gymnasium', descEn:'Local products, farm produce & stage shows. From 10 AM.',
          url:'https://www.city.misato.lg.jp/soshiki/chiikishinko/nogyoshinko/nogyoinfo/9735.html' },
        { emoji:'✨', month:12, day:6, endMonth:12, endDay:31,
          name:'におどり公園イルミネーション', location:'におどり公園', desc:'12月上旬〜2月下旬。冬の夜を彩る光のイベント（翌年2月まで開催）。',
          nameEn:'Niodori Park Illumination', locationEn:'Niodori Park', descEn:'Early Dec – late Feb. Winter illumination lighting up the night.',
          url:'https://misato-city.com/' },
      ];

      const MONTHS_JA = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
      const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

      function renderMisatoEvents(lang) {
        const grid = document.getElementById('misato-events-grid');
        if (!grid) return;
        const isEn = lang === 'en';

        const now = new Date();
        const yr = now.getFullYear();
        const sorted = EVENTS.slice().sort((a, b) => a.month !== b.month ? a.month - b.month : a.day - b.day);

        let nextUpIdx = -1;
        for (let i = 0; i < sorted.length; i++) {
          const ev = sorted[i];
          if (new Date(yr, ev.endMonth - 1, ev.endDay, 23, 59) >= now) { nextUpIdx = i; break; }
        }

        grid.innerHTML = sorted.map((ev, i) => {
          const endDate = new Date(yr, ev.endMonth - 1, ev.endDay, 23, 59);
          const isPast = endDate < now;
          const isNext = i === nextUpIdx;

          let dateStr;
          if (isEn) {
            const sameEnd = ev.endDay === ev.day && ev.endMonth === ev.month;
            dateStr = sameEnd
              ? `${MONTHS_EN[ev.month-1]} ${ev.day}`
              : ev.endMonth !== ev.month
                ? `${MONTHS_EN[ev.month-1]} ${ev.day} – ${MONTHS_EN[ev.endMonth-1]} ${ev.endDay}`
                : `${MONTHS_EN[ev.month-1]} ${ev.day}–${ev.endDay}`;
          } else {
            const sameEnd = ev.endDay === ev.day && ev.endMonth === ev.month;
            dateStr = sameEnd
              ? `${MONTHS_JA[ev.month-1]}${ev.day}日`
              : ev.endMonth !== ev.month
                ? `${MONTHS_JA[ev.month-1]}${ev.day}日〜${MONTHS_JA[ev.endMonth-1]}${ev.endDay}日`
                : `${MONTHS_JA[ev.month-1]}${ev.day}日〜${ev.endDay}日`;
          }

          let badge = '';
          if (isNext) {
            badge = '<span class="event-item-badge badge-next">NEXT</span>';
          } else if (!isPast) {
            const daysUntil = Math.ceil((new Date(yr, ev.month - 1, ev.day) - now) / 86400000);
            if (daysUntil <= 30) badge = isEn
              ? `<span class="event-item-badge badge-soon">In ${daysUntil}d</span>`
              : `<span class="event-item-badge badge-soon">あと${daysUntil}日</span>`;
          }

          const name     = isEn ? ev.nameEn     : ev.name;
          const location = isEn ? ev.locationEn : ev.location;
          const desc     = isEn ? ev.descEn     : ev.desc;
          const yearStr  = isEn ? String(yr) : `${yr}年`;

          const cls = isPast ? 'past' : isNext ? 'next-up' : 'upcoming';
          const inner = `${badge}
            <div class="event-item-emoji">${escH(ev.emoji)}</div>
            <div class="event-item-date">${escH(yearStr)} ${escH(dateStr)}</div>
            <div class="event-item-name">${escH(name)}</div>
            <div class="event-item-location">📍 ${escH(location)}</div>
            ${desc ? `<div class="event-item-desc">${escH(desc)}</div>` : ''}`;

          return ev.url
            ? `<a href="${escH(ev.url)}" target="_blank" rel="noopener noreferrer" class="event-item ${cls}">${inner}</a>`
            : `<div class="event-item ${cls}">${inner}</div>`;
        }).join('');
      }

      renderMisatoEvents(localStorage.getItem('site-lang') || 'ja');
      window.addEventListener('site-lang-change', function(e) {
        renderMisatoEvents(e.detail.lang);
      });
    })();

    // 三郷市 人口推移グラフ
    (function () {
      let DATA = [
        { year: 1980, pop: 98223 },
        { year: 1985, pop: 107964 },
        { year: 1990, pop: 128376 },
        { year: 1995, pop: 133600 },
        { year: 2000, pop: 131047 },
        { year: 2005, pop: 128278 },
        { year: 2010, pop: 131415 },
        { year: 2015, pop: 136521 },
        { year: 2020, pop: 142145 },
      ];

      function formatPopulation(pop) {
        return Math.round(pop).toLocaleString('ja-JP') + '人';
      }

      function nicePopScale(maxPeople) {
        const maxThousands = Math.max(1, maxPeople / 1000);
        const step = maxThousands <= 80 ? 20 : maxThousands <= 160 ? 40 : maxThousands <= 400 ? 100 : 200;
        return Math.ceil(maxThousands / step) * step;
      }

      function drawTooltip(ctx, W, H, x, y, lines) {
        ctx.save();
        ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
        const padX = 9;
        const padY = 7;
        const lineH = 16;
        const tw = Math.max.apply(null, lines.map(function (line) {
          return ctx.measureText(line).width;
        })) + padX * 2;
        const th = lineH * lines.length + padY * 2 - 3;
        let tx = x + 12;
        let ty = y - th - 12;
        if (tx + tw > W - 6) tx = x - tw - 12;
        if (tx < 6) tx = 6;
        if (ty < 6) ty = y + 14;
        if (ty + th > H - 6) ty = H - th - 6;

        ctx.fillStyle = 'rgba(6, 12, 24, 0.92)';
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.42)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(tx, ty, tw, th, 8);
        } else {
          const r = 8;
          ctx.moveTo(tx + r, ty);
          ctx.lineTo(tx + tw - r, ty);
          ctx.quadraticCurveTo(tx + tw, ty, tx + tw, ty + r);
          ctx.lineTo(tx + tw, ty + th - r);
          ctx.quadraticCurveTo(tx + tw, ty + th, tx + tw - r, ty + th);
          ctx.lineTo(tx + r, ty + th);
          ctx.quadraticCurveTo(tx, ty + th, tx, ty + th - r);
          ctx.lineTo(tx, ty + r);
          ctx.quadraticCurveTo(tx, ty, tx + r, ty);
        }
        ctx.fill();
        ctx.stroke();

        lines.forEach(function (line, i) {
          ctx.fillStyle = i === 0 ? '#eaf7ff' : 'rgba(210,225,240,0.92)';
          ctx.fillText(line, tx + padX, ty + padY + 11 + i * lineH);
        });
        ctx.restore();
      }

      function draw(hoverIndex, pointer) {
        const canvas = document.getElementById('local-pop-canvas');
        if (!canvas) return;
        const dpr = window.devicePixelRatio || 1;
        const W = canvas.offsetWidth || 400;
        const H = 160;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        const pad = { top: 20, bottom: 28, left: 44, right: 12 };
        const cW = W - pad.left - pad.right;
        const cH = H - pad.top - pad.bottom;
        const n = DATA.length;
        const maxPop = nicePopScale(Math.max.apply(null, DATA.map(d => d.pop)));
        const barGap = cW / n;
        const barW = barGap * 0.65;
        const hitAreas = [];

        ctx.clearRect(0, 0, W, H);

        const scaleStep = maxPop / 4;
        [0, scaleStep, scaleStep * 2, scaleStep * 3, maxPop].forEach(function (v) {
          const y = pad.top + cH * (1 - v / maxPop);
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(0,229,255,0.12)';
          ctx.lineWidth = 1;
          ctx.moveTo(pad.left, y);
          ctx.lineTo(pad.left + cW, y);
          ctx.stroke();
          ctx.fillStyle = 'rgba(176,192,210,0.7)';
          ctx.font = '9px Consolas, monospace';
          ctx.textAlign = 'right';
          ctx.fillText(Math.round(v), pad.left - 4, y + 4);
        });

        DATA.forEach(function (d, i) {
          const x = pad.left + i * barGap + (barGap - barW) / 2;
          const barH = cH * ((d.pop / 1000) / maxPop);
          const y = pad.top + cH - barH;
          const isLast = i === n - 1;
          const isHover = i === hoverIndex;

          const grad = ctx.createLinearGradient(0, y, 0, y + barH);
          grad.addColorStop(0, isLast ? 'rgba(0,229,255,1)' : 'rgba(0,180,255,0.85)');
          grad.addColorStop(1, isLast ? 'rgba(0,150,255,0.8)' : 'rgba(0,80,180,0.6)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.rect(x, y, barW, barH);
          ctx.fill();
          if (isHover) {
            ctx.save();
            ctx.strokeStyle = 'rgba(234,247,255,0.95)';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x - 1, y - 1, barW + 2, barH + 2);
            ctx.fillStyle = 'rgba(255,255,255,0.12)';
            ctx.fillRect(x, y, barW, barH);
            ctx.restore();
          }
          hitAreas.push({
            index: i,
            x: x,
            y: y,
            w: barW,
            h: barH,
            labelX: x + barW / 2,
            labelY: y
          });

          ctx.fillStyle = 'rgba(176,192,210,0.85)';
          ctx.font = '8px Consolas, monospace';
          ctx.textAlign = 'center';
          ctx.fillText(d.year, x + barW / 2, pad.top + cH + 16);
        });

        const last = DATA[n - 1];
        const lx = pad.left + (n - 1) * barGap + barGap / 2;
        const ly = pad.top + cH * (1 - (last.pop / 1000) / maxPop) - 4;
        ctx.fillStyle = '#00e5ff';
        ctx.font = 'bold 9px Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.fillText((last.pop / 1000).toFixed(1) + '千人', lx, ly);

        canvas._popHitAreas = hitAreas;
        if (hoverIndex != null && hitAreas[hoverIndex]) {
          const d = DATA[hoverIndex];
          const pos = pointer || { x: hitAreas[hoverIndex].labelX, y: hitAreas[hoverIndex].labelY };
          ctx.textAlign = 'left';
          drawTooltip(ctx, W, H, pos.x, pos.y, [
            d.year + '年',
            formatPopulation(d.pop)
          ]);
        }
      }

      function setupHover() {
        const canvas = document.getElementById('local-pop-canvas');
        if (!canvas || canvas._popHoverReady) return;
        canvas._popHoverReady = true;
        canvas.addEventListener('mousemove', function (ev) {
          const rect = canvas.getBoundingClientRect();
          const pointer = {
            x: ev.clientX - rect.left,
            y: ev.clientY - rect.top
          };
          const areas = canvas._popHitAreas || [];
          const hit = areas.find(function (a) {
            return pointer.x >= a.x && pointer.x <= a.x + a.w && pointer.y >= a.y && pointer.y <= a.y + a.h;
          });
          canvas.style.cursor = hit ? 'pointer' : 'default';
          draw(hit ? hit.index : null, pointer);
        });
        canvas.addEventListener('mouseleave', function () {
          canvas.style.cursor = 'default';
          draw();
        });
      }

      window.updateLocalPopulationTrend = function (city, trend) {
        if (Array.isArray(trend) && trend.length) {
          DATA = trend.map(d => ({ year: Number(d.year), pop: Number(d.value ?? d.pop) }))
            .filter(d => Number.isFinite(d.year) && Number.isFinite(d.pop));
        }
        const card = document.getElementById('local-pop-canvas')?.closest('.local-pop-card');
        const title = card?.querySelector('.local-pop-title');
        if (title && city) title.textContent = `${city} 人口推移`;
        draw();
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
          draw();
          setupHover();
          if (window.pendingLocalPopulationTrend) {
            window.updateLocalPopulationTrend(window.pendingLocalPopulationTrend.city, window.pendingLocalPopulationTrend.trend);
            window.pendingLocalPopulationTrend = null;
          }
        });
      } else {
        draw();
        setupHover();
        if (window.pendingLocalPopulationTrend) {
          window.updateLocalPopulationTrend(window.pendingLocalPopulationTrend.city, window.pendingLocalPopulationTrend.trend);
          window.pendingLocalPopulationTrend = null;
        }
      }
      window.addEventListener('resize', function () { draw(); });
    })();

    // 三郷市 人口ピラミッド（e-Stat 国勢調査2020 推計値）
    (function () {
      // [age-label, male, female]  単位: 人
      let GROUPS = [
        ['100以上',    40,   200],
        ['95〜99',    180,   550],
        ['90〜94',    500,  1300],
        ['85〜89',   1200,  2200],
        ['80〜84',   1900,  2800],
        ['75〜79',   2700,  3500],
        ['70〜74',   3900,  4400],
        ['65〜69',   3700,  4000],
        ['60〜64',   3200,  3400],
        ['55〜59',   3800,  3900],
        ['50〜54',   4100,  4200],
        ['45〜49',   4800,  4700],
        ['40〜44',   4600,  4500],
        ['35〜39',   4200,  4000],
        ['30〜34',   3600,  3500],
        ['25〜29',   3200,  3100],
        ['20〜24',   2800,  2700],
        ['15〜19',   2700,  2600],
        ['10〜14',   2600,  2500],
        ['5〜9',    2500,  2400],
        ['0〜4',    2300,  2200],
      ];

      function formatPeople(value) {
        return value.toLocaleString('ja-JP') + '人';
      }

      function drawTooltip(ctx, W, H, x, y, lines) {
        ctx.save();
        ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
        const padX = 9;
        const padY = 7;
        const lineH = 16;
        const tw = Math.max.apply(null, lines.map(function (line) {
          return ctx.measureText(line).width;
        })) + padX * 2;
        const th = lineH * lines.length + padY * 2 - 3;
        let tx = x + 12;
        let ty = y - th - 12;
        if (tx + tw > W - 6) tx = x - tw - 12;
        if (tx < 6) tx = 6;
        if (ty < 6) ty = y + 14;
        if (ty + th > H - 6) ty = H - th - 6;

        ctx.fillStyle = 'rgba(6, 12, 24, 0.92)';
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.42)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(tx, ty, tw, th, 8);
        } else {
          const r = 8;
          ctx.moveTo(tx + r, ty);
          ctx.lineTo(tx + tw - r, ty);
          ctx.quadraticCurveTo(tx + tw, ty, tx + tw, ty + r);
          ctx.lineTo(tx + tw, ty + th - r);
          ctx.quadraticCurveTo(tx + tw, ty + th, tx + tw - r, ty + th);
          ctx.lineTo(tx + r, ty + th);
          ctx.quadraticCurveTo(tx, ty + th, tx, ty + th - r);
          ctx.lineTo(tx, ty + r);
          ctx.quadraticCurveTo(tx, ty, tx + r, ty);
        }
        ctx.fill();
        ctx.stroke();

        lines.forEach(function (line, i) {
          ctx.fillStyle = i === 0 ? '#eaf7ff' : 'rgba(210,225,240,0.92)';
          ctx.fillText(line, tx + padX, ty + padY + 11 + i * lineH);
        });
        ctx.restore();
      }

      function draw(hoverIndex, pointer) {
        const canvas = document.getElementById('local-pyr-canvas');
        if (!canvas) return;
        const dpr = window.devicePixelRatio || 1;
        const W = canvas.offsetWidth || 500;
        const H = 360;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, W, H);

        const n = GROUPS.length;
        const padTop = 28, padBot = 24, padLeft = 8, padRight = 8;
        const labelW = 52;
        const cH = H - padTop - padBot;
        const rowH = cH / n;
        const halfW = (W - labelW - padLeft - padRight) / 2;
        const rawMax = Math.max.apply(null, GROUPS.flatMap(g => [Number(g[1]) || 0, Number(g[2]) || 0]));
        const maxStep = rawMax <= 6000 ? 2000 : rawMax <= 20000 ? 5000 : rawMax <= 60000 ? 10000 : 25000;
        const maxVal = Math.max(maxStep, Math.ceil(rawMax / maxStep) * maxStep);
        const cx = padLeft + halfW;
        const hitAreas = [];

        // legend
        ctx.fillStyle = 'rgba(100,160,255,0.9)';
        ctx.fillRect(cx - 52, 8, 12, 10);
        ctx.fillStyle = 'rgba(176,192,210,0.85)';
        ctx.font = '10px Consolas, monospace';
        ctx.textAlign = 'left';
        ctx.fillText('男性', cx - 38, 17);

        ctx.fillStyle = 'rgba(255,120,180,0.9)';
        ctx.fillRect(cx + labelW + 26, 8, 12, 10);
        ctx.fillStyle = 'rgba(176,192,210,0.85)';
        ctx.fillText('女性', cx + labelW + 40, 17);

        // scale lines
        [0, maxVal / 3, maxVal * 2 / 3, maxVal].forEach(function (v) {
          const xM = cx - (v / maxVal) * halfW;
          const xF = cx + labelW + (v / maxVal) * halfW;
          [xM, xF].forEach(function (x) {
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(0,229,255,0.10)';
            ctx.lineWidth = 1;
            ctx.moveTo(x, padTop);
            ctx.lineTo(x, padTop + cH);
            ctx.stroke();
          });
          if (v > 0) {
            ctx.fillStyle = 'rgba(176,192,210,0.55)';
            ctx.font = '8px Consolas, monospace';
            ctx.textAlign = 'center';
            ctx.fillText(Math.round(v), xM, padTop + cH + 14);
            ctx.fillText(Math.round(v), xF, padTop + cH + 14);
          }
        });

        // bars & labels
        GROUPS.forEach(function (g, i) {
          const label = g[0], male = g[1], female = g[2];
          const y = padTop + i * rowH;
          const bH = rowH * 0.72;
          const by = y + (rowH - bH) / 2;
          const isHover = i === hoverIndex;

          // male (left)
          const mW = (male / maxVal) * halfW;
          const gradM = ctx.createLinearGradient(cx - mW, 0, cx, 0);
          gradM.addColorStop(0, 'rgba(80,140,255,0.75)');
          gradM.addColorStop(1, 'rgba(100,180,255,0.95)');
          ctx.fillStyle = gradM;
          ctx.fillRect(cx - mW, by, mW, bH);

          // female (right)
          const fW = (female / maxVal) * halfW;
          const gradF = ctx.createLinearGradient(cx + labelW, 0, cx + labelW + fW, 0);
          gradF.addColorStop(0, 'rgba(255,120,180,0.95)');
          gradF.addColorStop(1, 'rgba(255,80,150,0.75)');
          ctx.fillStyle = gradF;
          ctx.fillRect(cx + labelW, by, fW, bH);
          if (isHover) {
            ctx.save();
            ctx.strokeStyle = 'rgba(234,247,255,0.9)';
            ctx.lineWidth = 1.3;
            ctx.strokeRect(cx - mW - 1, by - 1, mW + 1, bH + 2);
            ctx.strokeRect(cx + labelW, by - 1, fW + 1, bH + 2);
            ctx.fillStyle = 'rgba(255,255,255,0.10)';
            ctx.fillRect(cx - mW, by, mW, bH);
            ctx.fillRect(cx + labelW, by, fW, bH);
            ctx.restore();
          }
          hitAreas.push({
            index: i,
            x: cx - mW,
            y: by,
            w: mW + labelW + fW,
            h: bH
          });

          // age label
          ctx.fillStyle = 'rgba(176,192,210,0.85)';
          ctx.font = '8px Consolas, monospace';
          ctx.textAlign = 'center';
          ctx.fillText(label, cx + labelW / 2, by + bH / 2 + 3);
        });

        // center divider
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0,229,255,0.25)';
        ctx.lineWidth = 1;
        ctx.moveTo(cx, padTop);
        ctx.lineTo(cx, padTop + cH);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + labelW, padTop);
        ctx.lineTo(cx + labelW, padTop + cH);
        ctx.stroke();

        canvas._pyrHitAreas = hitAreas;
        if (hoverIndex != null && GROUPS[hoverIndex]) {
          const group = GROUPS[hoverIndex];
          const pos = pointer || {
            x: cx + labelW / 2,
            y: hitAreas[hoverIndex].y
          };
          ctx.textAlign = 'left';
          drawTooltip(ctx, W, H, pos.x, pos.y, [
            group[0] + '歳',
            '男性 ' + formatPeople(group[1]),
            '女性 ' + formatPeople(group[2]),
            '合計 ' + formatPeople(group[1] + group[2])
          ]);
        }
      }

      function setupHover() {
        const canvas = document.getElementById('local-pyr-canvas');
        if (!canvas || canvas._pyrHoverReady) return;
        canvas._pyrHoverReady = true;
        canvas.addEventListener('mousemove', function (ev) {
          const rect = canvas.getBoundingClientRect();
          const pointer = {
            x: ev.clientX - rect.left,
            y: ev.clientY - rect.top
          };
          const areas = canvas._pyrHitAreas || [];
          const hit = areas.find(function (a) {
            return pointer.x >= a.x && pointer.x <= a.x + a.w && pointer.y >= a.y && pointer.y <= a.y + a.h;
          });
          canvas.style.cursor = hit ? 'pointer' : 'default';
          draw(hit ? hit.index : null, pointer);
        });
        canvas.addEventListener('mouseleave', function () {
          canvas.style.cursor = 'default';
          draw();
        });
      }

      window.updateLocalPyramidChart = function (city, prefecture, groups) {
        if (Array.isArray(groups) && groups.length) {
          GROUPS = groups.map(g => [String(g[0]), Number(g[1]) || 0, Number(g[2]) || 0]);
        }
        const card = document.getElementById('local-pyr-canvas')?.closest('.local-pyr-card');
        const title = card?.querySelector('.local-pop-title');
        const sub = card?.querySelector('.local-pop-sub');
        if (title && city) title.textContent = `${city} 人口ピラミッド`;
        if (sub && city) sub.textContent = `${prefecture || ''}${city} 2020年（国勢調査）`;
        draw();
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
          draw();
          setupHover();
          if (window.pendingLocalPyramid) {
            window.updateLocalPyramidChart(window.pendingLocalPyramid.city, window.pendingLocalPyramid.prefecture, window.pendingLocalPyramid.groups);
            window.pendingLocalPyramid = null;
          }
        });
      } else {
        draw();
        setupHover();
        if (window.pendingLocalPyramid) {
          window.updateLocalPyramidChart(window.pendingLocalPyramid.city, window.pendingLocalPyramid.prefecture, window.pendingLocalPyramid.groups);
          window.pendingLocalPyramid = null;
        }
      }
      window.addEventListener('resize', function () { draw(); });
    })();

    (function () {
      const TRANS = {
        ja: {
          'skip-to-main': '本文へスキップ',
          'nav-privacy': 'プライバシーポリシー',
          'nav-local': '地域情報',
          'nav-gourmet': 'グルメまとめ',
          'nav-hobby': '趣味',
          'nav-pet': 'ペット',
          'nav-blog': 'ブログ',
          'nav-tools': 'Claudeツール',
          'nav-dashboard': 'ダッシュボード',
          'nav-works': 'ゲーム',
          'hero-badge': '埼玉県 三郷市 在住',
          'hero-h1-suffix': ' です👋<br>ゆるく発信中',
          'hero-desc': '三郷市在住。<strong>Claude AI</strong> とペアプログラミングしながら、ブラウザゲーム 24 本・各種ツールを開発中。インストール不要でブラウザだけで遊べます。',
          'hero-btn-tools': 'Claudeで作ったもの',
          'hero-btn-dashboard': 'ダッシュボードを見る',
          'hero-chip-local': ' 三郷市民',
          'hero-chip-game': ' ゲーム開発',
          'hero-chip-claude': ' Claude愛用',
          'hero-chip-pet': ' ペット飼い',
          'hero-chip-shogi': ' 将棋好き',
          'hero-chip-cafe': ' カフェ好き',
          'sec-label-local': 'Local',
          'sec-title-local': '🏙️ 三郷市のこと',
          'sec-desc-local': '埼玉県三郷市在住。東京から近くて住みやすいこの街のことをすこし紹介します。',
          'sec-label-hobby': 'Hobbies',
          'sec-title-hobby': '🎯 趣味のこと',
          'sec-desc-hobby': '好きなことを好きなだけ、のんびりやっています。',
          'sec-label-pet': 'Pet',
          'sec-title-pet': '🐾 うちのこの紹介',
          'sec-desc-pet': '家族の一員です。毎日癒してもらっています。',
          'sec-label-blog': 'Blog',
          'sec-title-blog': '✏️ My ブログ',
          'sec-desc-blog': '日々の気づき・開発メモ・失敗談などを書いています。',
          'sec-label-tools': 'Claude Tools',
          'sec-title-tools': '🤖 Claude で作ったゲーム・ツール・エージェント',
          'sec-desc-tools': 'Claude Code を使って作ったゲーム・ツール・AIエージェントの一覧です。',
          'sec-label-dashboard': 'Dashboard',
          'sec-title-dashboard': '📊 ホームダッシュボード',
          'sec-desc-dashboard': 'アクセス数・更新履歴・TODO/メモ・予定カレンダー・天気・円相場・株価・三郷市ガソリン相場・周辺交通情報をまとめて確認できます。',
          'sec-label-works': 'Works',
          'sec-title-works': '🕹️ ブラウザで遊べるゲーム',
          'sec-desc-works': 'インストール不要、ブラウザですぐ遊べます。',
          'sec-label-slides': 'AI Slides',
          'sec-title-slides': '📑 AIと僕の仕事場',
          'sec-desc-slides': 'Claude Code / CLAUDE.md / Skills / エージェントハーネスをわかりやすく解説したスライドです。',
          'slides-card-title': 'Claude Code × ハーネス設計',
          'slides-card-desc': 'AIツールとエージェント構成をスライド形式で解説。キーボード操作・スワイプ対応。全10枚。',
          'slides-card-btn': 'スライドを見る →',
          'contact-title': '📬 連絡先 / リンク',
          'contact-desc': 'お気軽にどうぞ。GitHubのリポジトリもぜひ見てみてください。',
          'contact-mail': '✉️ メール',
          'footer-copy': '© 2025 hide — 三郷市からのんびり発信中 🏠',
          'footer-credit': 'Claude AI と共同制作',
          'nav-slides': '📑 AI解説',
          'nav-learn': '📚 学習',
          'nav-locate': '📍 現在地',
          'local-hero-h3': '三郷市ってどんなとこ？',
          'local-hero-p': '埼玉県の南東端、東京・千葉に隣接するコンパクトな市。江戸川と中川に挟まれた水辺の町で、東京都心まで電車で約20〜30分とアクセス抜群。ららぽーとやコストコがあり、ショッピングも充実しています。静かで暮らしやすく、個人的に気に入っています。',
          'spot-lala-name': 'ららぽーと新三郷',
          'spot-lala-desc': '三郷市の定番スポット。広くてごはん屋さんも多く、週末によく行きます。駐車場も広いのが助かる。',
          'spot-lala-tag': 'ショッピング →',
          'spot-edogawa-name': '江戸川サイクリングロード',
          'spot-edogawa-desc': '江戸川沿いに続く自転車道。天気のいい日に走ると気持ちよくてリフレッシュできます。緑も多くておすすめ。',
          'spot-edogawa-tag': 'アウトドア →',
          'spot-costco-name': 'コストコ新三郷',
          'spot-costco-desc': '大容量でコスパ抜群なコストコ。まとめ買い派にはありがたい存在。フードコートのホットドッグがお気に入り。',
          'spot-costco-tag': 'お気に入り →',
          'spot-park-name': 'におどり公園',
          'spot-park-desc': '地元の緑地。ペットの散歩にもよく使います。整備されていて子どもから大人まで過ごしやすいエリア。',
          'spot-park-tag': '公園 →',
          'spot-gourmet-name': '新三郷グルメ情報',
          'spot-gourmet-desc': 'ラーメン屋・定食屋が充実。ロードサイド店が多く車での外食に便利。個人的なお気に入りは随時更新予定。',
          'spot-gourmet-tag': 'グルメまとめ →',
          'pop-chart-title': '三郷市 人口推移',
          'pop-chart-sub': '総人口（国勢調査 1980〜2020）',
          'pyr-chart-title': '三郷市 人口ピラミッド',
          'pyr-chart-sub': '埼玉県三郷市 2020年（国勢調査）',
          'event-cal-title': '三郷市イベントカレンダー',
          'event-cal-desc': '市内で開催されるお祭り・イベント情報 / Local Events',
          'event-cal-btn': '公式カレンダー →',
          // hobbies
          'hobby-shogi-name': '将棋',
          'hobby-shogi-desc': 'ゆる〜く指しています。詰将棋を解くのが特に好き。ゲーム開発のきっかけにもなりました。',
          'hobby-gamedev-name': 'ゲーム開発',
          'hobby-gamedev-desc': 'バニラJS & Canvas API でブラウザゲームをコツコツ作っています。ローグライクとRPGが特に好き。',
          'hobby-ai-name': 'AI・Claude活用',
          'hobby-ai-desc': 'Claude Code を使った開発が最近のブーム。プロンプト設計やエージェント構築が楽しすぎる。',
          'hobby-drive-name': 'ドライブ',
          'hobby-drive-desc': '現在はトヨタ シエンタに乗っています。以前はホンダ フィット、その前は三菱 ランサーセディアワゴンで峠道をよく走っていました。最近は家族が増えてロングドライブはご無沙汰ですが、昔の峠走りはいい思い出です。',
          'hobby-manga-name': '漫画',
          'hobby-manga-desc': '単行本派。魁!!男塾、ダイの大冒険、ジョジョの奇妙な冒険、鬼滅の刃、呪術廻戦など。熱くてクセの強い作品が好きです。',
          'hobby-game-name': 'ゲーム',
          'hobby-game-desc': 'RPGやアドベンチャー系が好き。ゲームからインスピレーションを受けて開発に活かすことも多いです。',
          // pet
          'pet-name': 'ゆうた',
          'pet-breed': '🐶 ポメラニアン',
          'pet-desc': '毎日の散歩のお供。江戸川の河川敷や近所の公園をよく一緒に歩いています。元気いっぱいで、家に帰るとすぐ飛びついてきます。疲れていても癒されます。最近のお気に入りはおやつのとりきさみです。',
          'pet-stat-walk': '散歩毎日',
          'pet-stat-love': '溺愛度 MAX',
          'pet-stat-spot': '江戸川散歩',
          // tools
          'claude-badge': '🤖 Claude製',
          'tool-link-play': '遊んでみる →',
          'tool-link-open': '使ってみる →',
          'tool-photobooth-desc': '撮影 or 手持ちの写真を読み込んで編集。消しゴムマジック（写り込んだ不要物をブラシで消すコンテンツ認識塗りつぶし）・明るさ/色調整・落書き/テキスト/スタンプ・セルフタイマー/連写ストリップ・リアルタイムフィルター。完全ブラウザ内処理・画像は外部送信なし。',
          'ttag-photobooth': '画像編集',
          'tool-colorscanner-desc': 'カメラで映したものの色をその場で採取し、HEX/RGB/HSLで表示。静止してタップ採色、パレット保存、CSS変数・JSON書き出しに対応。完全ブラウザ内処理・映像は外部送信なし。',
          'ttag-colorscanner': 'カラー抽出',
          'tool-qrscanner-desc': 'カメラでQRコードをその場でデコード。URLはワンタップで開け、読み取り履歴も残せる。jsQRをローカル同梱（CDN不使用）・完全ブラウザ内処理・映像は外部送信なし。',
          'ttag-qrscanner': 'QR読み取り',
          'tool-heartrate-desc': 'スマホのカメラとライトに指先をあてて心拍数を推定（rPPG）。脈波グラフをリアルタイム表示し、15秒でBPMを計測。完全ブラウザ内処理・映像は外部送信なし。※医療機器ではありません。',
          'ttag-heartrate': '脈拍推定 rPPG',
          'tool-thermo-desc': '実物の赤外線センサーは使わず、カメラ映像の明るさをヒートマップ色（Iron/Rainbow/White-Hot）に変換して疑似的な熱源探知を演出。最も明るい場所を熱源マーカーで自動表示、感度調整、PNG保存に対応。完全ブラウザ内処理・映像は外部送信なし。実際の温度は計測しません。',
          'ttag-thermo': '疑似熱源探知',
          'tool-health-desc': '加速度センサーで歩数・ケイデンス・活動判定、GPSで距離・速度・ペース・獲得標高・ルートを計測。消費カロリーも推定し、記録は端末内に保存。完全ブラウザ内処理・位置情報は外部送信なし。※医療機器ではありません。',
          'ttag-health': '歩数・ルート計測',
          'tool-vocal-synth-desc': 'ひらがなの歌詞を入力すると、フォルマント合成のボーカルエンジンがブラウザ内で歌います。再生中の曲・マイク・音声ファイルからメロディを採譜（YIN法のピッチ追跡＋テンポ/キー推定）して歌わせることも可能。コード進行と確率モデルによる自動作曲、ピアノロールでの音符編集、ハモリ・伴奏・WAV書き出しに対応。Web Audio API のみ・APIキー不要・外部送信ゼロ。',
          'ttag-vocal-synth': '歌声合成 × 採譜 × 自動作曲',
          'tool-synth-eq-desc': '10バンド（31Hz〜16kHz）のグラフィックイコライザーと減算合成シンセサイザーを1ページに統合。シンセ・音声ファイル・マイクの音をリアルタイムでEQ処理し、スペクトラムとEQカーブを重ねて表示します。プリセット8種・アルペジエーター・ディレイ/リバーブ・WAV書き出し対応。Web Audio API のみ・APIキー不要・外部送信ゼロ。',
          'ttag-synth-eq': '10バンドEQ × シンセ × 可視化',
          'tool-zero1mobile-desc': 'WebGPUでローカルLLMを端末内実行するAIアシスタント。モデルは初回だけ取得し、以後は圏外でも使えます。音声入力・読み上げ対応。カメラに指をかざして操作する「エアタッチ」も搭載。会話も映像も一切外部へ送信しません。',
          'ttag-zero1mobile': '端末内AI',
          'ttag-airtouch': 'エアタッチ',
          'tool-aegis-desc': 'パスワード強度診断・安全な生成・ハッシュ計算・AES-256-GCM暗号化・フィッシングURL診断・TOTP(2FA)・自己診断の7ツールを1ページに統合。Web Crypto API使用・完全ブラウザ内処理・外部送信ゼロ。',
          'ttag-aegis': 'セキュリティ 7-in-1',
          'tool-sengoku-desc': '全国64洲を攻め取る戦国シミュレーション。信長の野望と差別化した独自要素——城・忍者・水軍の《支配圏》に侵入すると迎撃・攪乱・一揆で土地が反応、野心武将の《謀叛・寝返り》で起こる下剋上、《陣形》の相性で決まる合戦、征夷大将軍→惣無事令で挑む《天下静謐》エンド、陣容のURL共有。GameKit製・Canvasのみ・データは端末内。',
          'ttag-sengoku': '戦国SLG × 下剋上×陣形',
          'tool-sanguo-desc': '184年黄巾の乱から223年五路侵攻まで、8つの時代から始める三国志戦略シミュレーション。魏・蜀・呉・董卓軍ら10勢力から君主を選び、内政・武将登用・外交・計略で版図を広げる。1巡に打てる手は政務ポイントで限られ、兵糧と増援が戦線を支える。合戦は戦場背景に展開するヘックス戦（野戦・攻城戦）で、天候・士気・名乗りを上げての一騎打ちが戦況を左右する。GPT-image2製の中国地図・武将肖像194枚・戦場背景収録。Canvas API製・データは端末内。',
          'ttag-sanguo': '中国戦略SLG × 群雄割拠',
          'tool-genpei-desc': '1180年以仁王の令旨から1189年奥州合戦まで、治承・寿永の乱を5シナリオで描く歴史シミュレーション。平氏・鎌倉・木曽・甲斐・奥州の5勢力から選び、全国66令制国・拠点270を舞台に争う。12世紀にはまだ城がなく、土地は京の権門が持ち、武士は御恩と奉公で結ばれる——だから中核資源は兵力でも石高でもなく《名分》（院宣・宣旨・官位・三種の神器）。名分が高ければ戦わずに門が開き（無血開城）、朝敵に認定されれば味方の武士団が離れていく。合戦は騎射の間合いと士気で決するヘックス戦で、名乗りを上げての一騎討ちもある。Canvas API製・肖像と家紋も手続き的描画・データは端末内。',
          'ttag-genpei': '源平SLG × 名分',
          'tool-bakumatsu-desc': '嘉永6年の黒船来航から明治元年の戊辰戦争まで6シナリオを収録した幕末歴史シミュレーション。徳川幕府・薩摩藩・長州藩などを率い、内政・外交・軍事と近代化を進めて激動の政局を戦い抜く。Canvas API製・データは端末内。',
          'ttag-bakumatsu': '幕末SLG × 近代化',
          'tool-loto6-desc': '過去1,000回超のロト6当選番号を出現頻度・ホット&コールド・ペア共起ヒートマップ・合計値分布などで統計可視化。統計重み付き抽選の数字ピッカー付き。CSV取込・手動追記対応、データは端末内に保存・外部送信なし。',
          'ttag-loto6': '確率・統計分析',
          'tool-aivideo-desc': 'プロンプトを1つ入れるだけで、台本・動く映像・BGMを自動生成し、動画ファイル(.webm)として書き出せるツール。ブラウザ完結・APIキー不要。YouTube用のタイトル/説明/タグも自動生成。',
          'ttag-video-gen': '動画自動生成',
          'tool-packet-desc': '5Gなのに「パケづまり」する回線を、ブラウザだけでリアルタイム計測・可視化するツール。RTT・ジッタ・パケットロスを計測し、詰まりの瞬間をCanvasで見える化。CSV書き出し対応・外部送信なし。',
          'ttag-network-viz': 'ネットワーク可視化',
          'tool-ukabi-title': 'うかぶ？しずむ？',
          'tool-ukabi-desc': '野菜・果物を水に入れて浮くか沈むかを当てる物理パズルゲーム。水位を管理しながら目標個数を達成しよう。ミッション・実績・AI対戦モードあり。',
          'ttag-physics': '物理パズル',
          'ttag-ai-battle': 'AI対戦',
          'tool-shogirpg-desc': '将棋の駒の動きとRPGの育成を組み合わせた実験作。将棋を知らなくても楽しめる設計になっています。',
          'ttag-shogi-rpg': '将棋 × RPG',
          'tool-gradius-desc': '横スクロールシューティングをバニラJSで実装。レトロゲームの雰囲気を現代ブラウザで再現しました。',
          'ttag-shooting': 'シューティング',
          'tool-aishogi-desc': 'ブラウザで遊べる本格将棋。AI電竜・AI幻石の棋風を再現したAIと対局できます。インストール不要。',
          'ttag-shogi': '将棋',
          'ttag-ai-match': 'AI対局',
          'tool-horror-desc': 'Unityホラーゲームのプロジェクトテンプレート。プレイヤー操作・幽霊AI・フラッシュライト・ドア開閉・ノート収集など一通り実装済みのキット。',
          'ttag-horror': 'ホラー',
          'ttag-template': 'テンプレート',
          'tool-portfolio-title': 'このポートフォリオサイト',
          'tool-portfolio-desc': 'このサイト自体もClaude Codeと一緒に設計・実装しました。GitHub Pages でホスティング、ビルドツール不使用の素のHTML/CSS/JS構成。',
          'tool-github-link': 'GitHubを見る →',
          'tool-engteacher-title': '英語先生エージェント',
          'tool-engteacher-desc': 'ブラウザの音声合成・音声認識で、ネイティブ英語の先生と「声」で会話・発音練習・リスニングができる英語学習ツール。日英バイリンガル・キー不要・無料。',
          'tool-engteacher-usage': '🎙️ 音声で会話する',
          'ttag-english': '英語学習',
          // dashboard
          'dash-layout-toggle': '表示・並び替え',
          'dash-layout-reset': '初期配置に戻す',
          'dash-layout-title': 'ダッシュボードの表示設定',
          'dash-layout-note': 'チェックで表示/非表示を切り替え、上下ボタンでカードの位置を変更できます。この設定はこのブラウザに保存されます。',
          'dash-visit-title': '👁️ サイト訪問数',
          'dash-visit-link': '詳細ダッシュボードを開く →',
          'dash-fx-title': '💴 円相場（JPY）',
          'dash-fx-chart-label': '📉 過去30日間の対円レート推移（前月比%）',
          'dash-weather-temp-label': '🌡 今日の時間別気温',
          'dash-stock-title': '📈 株価指数',
          'dash-stock-compare-label': '主要指数 騰落率比較',
          'dash-stock-input-ph': '会社名 or ティッカー（例: トヨタ / AAPL / 7203.T）',
          'dash-add-btn': '追加',
          'gas-card-title': '⛽ ガソリン相場',
          'dash-gas-rank-title': '💰 価格ランキング（安い順）',
          'dash-gas-daily': '日毎',
          'dash-gas-monthly': '月毎',
          'dash-gas-6month': '6ヶ月',
          'home-traffic-title': '🚦 交通情報（現在地周辺）',
          'household-card-title': '世帯数',
          'dash-updates-title': '📰 更新履歴',
          'dash-todo-title': '✅ TODO / メモ',
          'dash-todo-input-ph': 'タスクを追加…',
          'dash-todo-priority-normal': '中',
          'dash-todo-priority-high': '高',
          'dash-todo-priority-later': '後で',
          'dash-memo-ph': 'メモ（自動保存）',
          'dash-memo-to-todo-btn': 'メモからTODO化',
          'dash-todo-detail-link': '詳細TODOを開く →',
          'dash-calendar-title': '📅 予定カレンダー',
          'dash-cal-sync-btn': 'Googleから同期',
          'dash-schedule-ph': '例: 打ち合わせ 14:00～15:00',
          'dash-register-btn': '登録',
          'dash-cal-note': '📅 時間を含めると <strong style="color:var(--blue)">Google カレンダー</strong> に自動連携します',
          'dash-train-title': '🚃 電車遅延情報（関東）',
          'dash-refresh-btn': '更新',
          'dash-pomo-title': '⏱️ ポモドーロタイマー',
          'dash-pomo-reset': 'リセット',
          'dash-quake-title': '🌍 地震・防災情報',
          'dash-worldclock-title': '🌐 世界時計',
          'dash-news-title': '📰 最新ニュース',
          'dash-ai-news-title': '🤖 AI最新ニュース',
          'dash-quicklinks-title': '🔖 よく使うリンク',
          // works
          'kicker-board-ai': 'ボードゲーム × AI',
          'kicker-physics': '物理パズル',
          'kicker-action': 'アクションゲーム',
          'kicker-shogi-rpg': '将棋 × RPG',
          'kicker-shooting': 'シューティング',
          'kicker-sim': 'シミュレーション',
          'work-sengoku-kicker': '戦国歴史シミュレーション / Sengoku Strategy',
          'work-sengoku-title': '戦国風雲記',
          'work-sengoku-desc': '1550～1582年の6シナリオから大名を選び、内政・外交・調略・野戦・攻城戦を駆使して天下静謐を目指す本格戦国シミュレーション。',
          'work-sanguo-kicker': '三国志歴史シミュレーション / Three Kingdoms Strategy',
          'work-sanguo-title': '三国志・天下三分',
          'work-sanguo-desc': '184年黄巾の乱から223年五路侵攻まで8シナリオ・10勢力。内政・武将登用・外交・計略・増援を指揮し、天候と士気の絡むヘックス戦で中華統一を目指す三国志戦略シミュレーション。',
          'work-genpei-kicker': '源平歴史シミュレーション / Genpei War Strategy',
          'work-genpei-title': '源平争乱記',
          'work-genpei-desc': '1180年以仁王の令旨から1189年奥州合戦まで5シナリオ・5勢力。中核資源は兵力ではなく《名分》——院宣と官位で門を開かせ、朝敵認定で敵の武士団を剥がす源平合戦シミュレーション。',
          'work-taihei-kicker': '南北朝歴史シミュレーション / Nanboku-chō Strategy',
          'work-taihei-title': '太平風雲記',
          'work-taihei-desc': '1331年元弘の乱から1392年南北朝合一まで、南朝・北朝・地方勢力から陣営を選ぶ歴史シミュレーション。朝廷への働きかけ・恩賞・悪党の調略で、武将個々の忠誠と正統性の奪い合いを制する。',
          'work-bakumatsu-kicker': '幕末歴史シミュレーション / Bakumatsu Strategy',
          'work-bakumatsu-title': '幕末風雲記',
          'work-bakumatsu-desc': '嘉永6年の黒船来航から明治元年の戊辰戦争まで6シナリオ。徳川幕府・薩摩藩・長州藩などを率い、内政・外交・軍事と近代化を進めて激動の時代を生き抜く幕末戦略シミュレーション。',
          'kicker-board-sim': 'ボードゲーム × 歴史シミュレーション',
          'kicker-board-strategy': 'ボードゲーム × 資産戦略',
          'work-fixer-title': '影の権力者',
          'work-fixer-desc': '偉人を裏から動かし、恩義と悪名を管理して歴史の勝ち馬を操る戦略ボードゲーム。',
          'work-cardgames-desc': 'ブラックジャック・ポーカー・ソリティア・フリーセル・ババ抜き・神経衰弱・七並べの7種類をブラウザで無料プレイ。',
          'work-catan-desc': 'HEXLAN完全実装。1人vsAI3体。資源収集・開拓地建設・開発カード・最長道路・最大軍勢でVP10点を目指す。',
          'work-backgammon-desc': 'バックギャモン対AI戦。Easy / Normal / Hard の3段階難易度。Canvas API描画のモダンデザイン。',
          'work-estate-desc': '東京23区を巡り、物件独占で区を支配する不動産すごろく風ボードゲーム。Canvas API描画。',
          'work-ludo-desc': 'GPT-image-2で描いた盤面・コマ・サイコロを取り込み、Canvas APIで赤対黄の対AI戦にしました。',
          'work-chinese-checkers-desc': 'フリー素材の盤面を取り込み、連続ジャンプで陣地を目指すチャイニーズチェッカー対AI戦にしました。',
          'work-checkers-desc': '強制ジャンプ・連続ジャンプ・キングに対応したクラシックチェッカー。3段階AIとブラウザで対戦できます。',
          'work-go-desc': 'UCT-MCTSを搭載したAIと対戦できる囲碁。9路盤・13路盤、難易度3段階対応。',
          'work-othello-desc': 'ミニマックスAIと対戦できるオセロ。難易度3段階・石をひっくり返すアニメーション付き。',
          'work-chess-desc': 'ブラウザで遊べるAIチェス。難易度・待った・盤面反転、キャスリング/アンパッサン/昇格に対応。',
          'work-mahjong-desc': 'ロン・ツモ・ポン・チー・カン・立直・役・点数計算まで本格ルールでAIと対局できます。',
          'work-hanafuda-desc': 'こいこい形式の花札対AI戦。場札合わせ、山札めくり、役判定、役図解、AIのこいこい判断までブラウザで遊べます。',
          'work-hyakunin-desc': '100首の歌を上の句→下の句の取り札で楽しむかるたゲーム。難易度4段階・Web Speech API読み上げ対応。',
          'work-no-luck-poker-desc': '5×5グリッドから戦略的にカードを取得してポーカー役を作る陣取り×AI対戦ゲーム。運なし、読み合いだけで勝負。',
          'work-dots-desc': '線を引いて箱を完成させる陣取りボードゲーム。CPU対戦、難易度切替、ヒント機能つき。',
          'work-blokus-desc': '20×20マスにポリオミノを配置するAI対戦ボードゲーム。角タッチルールで陣地を拡大せよ。',
          'work-trigon-title': 'トライ陣地',
          'work-trigon-desc': '三角形ピースをひし形の盤面に敷き詰めるAI対戦ゲーム。角タッチルールで陣地を広げよ。',
          'work-hex-desc': '六角形のマスをつないで自分の辺同士をつなげるボードゲーム。CPU対戦、難易度切替、ヒント機能つき。',
          'work-conhex-desc': '穴に石を置いてセルを獲得し、自分の辺同士をつなげる抽象ボードゲーム。CPU対戦、難易度切替、ヒント機能つき。',
          'work-indigo-desc': 'ラインナー・クニツィアのヘックスタイル配置ゲーム。宝石を自分のゲートへ誘導して得点を競う。Canvas API描画。',
          'work-carrom-desc': '南アジア発祥のフィンガービリヤード。ストライカーでキャロムメンをポケットへ。物理シミュレーション × AI対戦3難易度。',
          'work-momentum-desc': '弾の軌跡が陣地と壁になる物理陣取りゲーム。ラインは時間で薄れ、衝突で削れるため進路の読み合いが勝負です。',
          'work-mahjong-sol-desc': '144枚の牌を同種ペアで取り除く上海パズル。ヒント・アンドゥ・シャッフル機能つき。',
          'work-shogi-desc': 'AI電竜・AI幻石の棋風を再現したAIと対局できる本格将棋。難易度3段階、インストール不要。',
          'work-float-desc': '野菜・果物を水に入れて水位を管理する物理パズル。ミッション・実績・AI対戦モード搭載。',
          'work-shogirpg-desc': '将棋の駒の動きとRPGの育成・バトルを組み合わせたジャンル混合の挑戦作。',
          'work-bubble-desc': '泡の中のアイテムを小人たちと協力して救出するパズルゲーム。泡をタップして割り、梯子を配置して小人を誘導しよう！Canvas APIのみで実装。',
          'work-galactic-desc': 'SVGスプライト・7ステージ・7ボス・6種パワーアップ・Web Audio BGM搭載の本格横スクロールシューター。Canvas APIのみで実装。スマホD-pad対応。',
          'work-kart-desc': 'オリジナルキャラのカートで3周レース！カート背後からの三人称（擬似3D）視点。ドリフトでミニターボを発動し、ニトロカプセル・オイル缶・スターショットなどのアイテムを駆使してライバル5台を抜き去ろう。GameKit（Canvas API）で実装、スマホD-pad対応。',
          'work-city-desc': '道路・住宅・商業・工業・公園・発電所を配置して街を発展させるシムシティ風ブラウザゲーム。建物は電力と道路接続で成長。',
          'work-corridor-title': 'ウォールチェイス',
          'work-corridor-desc': '9×9盤で相手より先にゴールへ到達する戦略ゲーム。壁を置いてCPUの進路を封鎖せよ。',
          'work-play-now': '今すぐ遊ぶ →',
          'work-try-it': '遊んでみる →',
          'agent-fab-label': 'AIエージェント',
          'agent-title': 'hideの案内エージェント',
          'agent-subtitle': 'サイト案内・ゲーム起動・データ取得',
          'agent-input-ph': '質問を入力…（例：ゲーム何ある？）',
          'agent-thinking': '考えています…',
          'agent-welcome': 'こんにちは！hideのポートフォリオへようこそ 👋 ゲーム紹介・サイト案内・為替や天気の取得ができます。下のチップからどうぞ。',
          'agent-fallback': 'ごめんなさい、その質問にはまだ対応していません 🙏 下のチップから選ぶか、別の言い方で試してみてください。',
          'agent-quick-1': '🎮 ゲーム何ある？',
          'agent-quick-2': '✨ おすすめは？',
          'agent-quick-3': '☀️ 三郷市の天気',
          'agent-quick-4': '💴 ドル円教えて',
          'agent-action-play': '遊ぶ →',
          'agent-action-open-section': '移動する →',
          'agent-action-copy': 'コピー',
          'agent-action-retry': '再試行',
          'agent-action-close': '閉じる',
          'agent-action-clear': 'リセット',
          'agent-tool-loading': '取得中…',
          'agent-tool-error': '取得できませんでした。時間をおいて再試行してください。',
          'agent-clear-confirm': '会話履歴をリセットしました。',
          'agent-disambig': '次のどれのことですか？',
          'agent-more': 'もっと見る',
        },
        en: {
          'skip-to-main': 'Skip to main content',
          'nav-privacy': 'Privacy Policy',
          'nav-local': 'Local',
          'nav-gourmet': 'Gourmet',
          'nav-hobby': 'Hobbies',
          'nav-pet': 'Pet',
          'nav-blog': 'Blog',
          'nav-tools': 'Claude Tools',
          'nav-dashboard': 'Dashboard',
          'nav-works': 'Games',
          'hero-badge': 'Living in Misato, Saitama',
          'hero-h1-suffix': ' is here 👋<br>just sharing casually',
          'hero-desc': 'Based in Misato, Saitama. Pair-programming with <strong>Claude AI</strong> to build 29 browser games &amp; tools — playable instantly, no install needed.',
          'hero-btn-tools': 'Built with Claude',
          'hero-btn-dashboard': 'View Dashboard',
          'hero-chip-local': ' Misato Local',
          'hero-chip-game': ' Game Dev',
          'hero-chip-claude': ' Claude Fan',
          'hero-chip-pet': ' Pet Owner',
          'hero-chip-shogi': ' Shogi Lover',
          'hero-chip-cafe': ' Café Lover',
          'sec-label-local': 'Local',
          'sec-title-local': '🏙️ About Misato',
          'sec-desc-local': 'I live in Misato, Saitama — close to Tokyo and easy to live in. Here\'s a little about my town.',
          'sec-label-hobby': 'Hobbies',
          'sec-title-hobby': '🎯 My Hobbies',
          'sec-desc-hobby': 'Doing what I love, at my own pace.',
          'sec-label-pet': 'Pet',
          'sec-title-pet': '🐾 Meet My Pet',
          'sec-desc-pet': 'A member of the family. Always keeping me sane.',
          'sec-label-blog': 'Blog',
          'sec-title-blog': '✏️ My Blog',
          'sec-desc-blog': 'Daily thoughts, dev notes, and the occasional failure story.',
          'sec-label-tools': 'Claude Tools',
          'sec-title-tools': '🤖 Games, Tools & Agents Built with Claude',
          'sec-desc-tools': 'A collection of games, tools, and AI agents created using Claude Code.',
          'sec-label-dashboard': 'Dashboard',
          'sec-title-dashboard': '📊 Home Dashboard',
          'sec-desc-dashboard': 'All in one: visits, updates, todos, calendar, weather, forex, stocks, gas prices, and local traffic.',
          'sec-label-works': 'Works',
          'sec-title-works': '🕹️ Browser Games',
          'sec-desc-works': 'No install needed — play right in your browser.',
          'sec-label-slides': 'AI Slides',
          'sec-title-slides': '📑 AI & My Workflow',
          'sec-desc-slides': 'Slides explaining Claude Code, CLAUDE.md, Skills, and agent harness design.',
          'slides-card-title': 'Claude Code × Harness Design',
          'slides-card-desc': 'AI tools and agent configuration explained in slide format. Keyboard & swipe supported. 10 slides total.',
          'slides-card-btn': 'View Slides →',
          'contact-title': '📬 Contact / Links',
          'contact-desc': 'Feel free to reach out. Check out my GitHub repos too!',
          'contact-mail': '✉️ Email',
          'footer-copy': '© 2025 hide — Sharing casually from Misato 🏠',
          'footer-credit': 'Co-created with Claude AI',
          'nav-slides': '📑 AI Slides',
          'nav-learn': '📚 Learn',
          'nav-locate': '📍 Locate',
          'local-hero-h3': 'What\'s Misato Like?',
          'local-hero-p': 'A compact city on the southeast edge of Saitama, right next to Tokyo and Chiba. Nestled between the Edogawa and Nakagawa rivers, it\'s about 20–30 min by train to central Tokyo. With LaLaport and Costco nearby, shopping is great. Quiet and easy to live in — I love it here.',
          'spot-lala-name': 'LaLaport Shin-Misato',
          'spot-lala-desc': 'The go-to spot in Misato. Huge mall with tons of restaurants — I\'m here most weekends. The parking is a lifesaver.',
          'spot-lala-tag': 'Shopping →',
          'spot-edogawa-name': 'Edogawa Cycling Road',
          'spot-edogawa-desc': 'A cycling path along the Edogawa river. Great for a refreshing ride on a nice day — lots of greenery too.',
          'spot-edogawa-tag': 'Outdoors →',
          'spot-costco-name': 'Costco Shin-Misato',
          'spot-costco-desc': 'Bulk buying paradise with great value. The food court hot dogs are my favorite.',
          'spot-costco-tag': 'Favorites →',
          'spot-park-name': 'Niodori Park',
          'spot-park-desc': 'A local green space. Great for walks with my pet. Well-maintained and easy to enjoy for all ages.',
          'spot-park-tag': 'Park →',
          'spot-gourmet-name': 'Shin-Misato Gourmet',
          'spot-gourmet-desc': 'Plenty of ramen shops and set-meal restaurants. Lots of roadside spots — convenient for dining out by car. My favorites updated as I find them.',
          'spot-gourmet-tag': 'Gourmet Guide →',
          'pop-chart-title': 'Misato Population Trend',
          'pop-chart-sub': 'Total population (Census 1980–2020)',
          'pyr-chart-title': 'Misato Population Pyramid',
          'pyr-chart-sub': 'Saitama Misato City, 2020 (Census)',
          'event-cal-title': 'Misato Event Calendar',
          'event-cal-desc': 'Festivals & local events in Misato',
          'event-cal-btn': 'Official Calendar →',
          // hobbies
          'hobby-shogi-name': 'Shogi',
          'hobby-shogi-desc': 'Playing casually. Solving tsume-shogi (checkmate puzzles) is my favorite. It was actually the spark that got me into game dev.',
          'hobby-gamedev-name': 'Game Dev',
          'hobby-gamedev-desc': 'Building browser games with Vanilla JS & Canvas API. Especially into roguelikes and RPGs.',
          'hobby-ai-name': 'AI & Claude',
          'hobby-ai-desc': 'Been on a Claude Code development kick lately. Designing prompts and building agent systems is just too fun.',
          'hobby-drive-name': 'Driving',
          'hobby-drive-desc': 'Currently driving a Toyota Sienta. Previously had a Honda Fit, and before that a Mitsubishi Lancer Cedia Wagon for mountain roads. Family grew so long drives are rarer now, but those touge runs are great memories.',
          'hobby-manga-name': 'Manga',
          'hobby-manga-desc': 'Collect tankobons. Favorites: Sakigake!! Otokojuku, Dragon Quest: Dai no Daibouken, JoJo\'s Bizarre Adventure, Demon Slayer, Jujutsu Kaisen. Love intense, quirky stories.',
          'hobby-game-name': 'Gaming',
          'hobby-game-desc': 'Into RPGs and adventure games. Games often inspire my own development projects.',
          // pet
          'pet-name': 'Yuuta',
          'pet-breed': '🐶 Pomeranian',
          'pet-desc': 'My daily walking buddy. We often walk along the Edogawa riverbank and nearby parks. Super energetic — jumps on me the moment I get home. Always cheers me up no matter how tired I am. Lately obsessed with shredded chicken treats.',
          'pet-stat-walk': 'Daily Walks',
          'pet-stat-love': 'Love: MAX',
          'pet-stat-spot': 'Edogawa Walks',
          // tools
          'claude-badge': '🤖 By Claude',
          'tool-link-play': 'Try it →',
          'tool-link-open': 'Open it →',
          'tool-photobooth-desc': 'Snap or upload a photo, then edit it: magic eraser (content-aware fill that brushes away unwanted objects), brightness/color adjust, doodle/text/stamps, self-timer/photo strip and live filters. 100% client-side — no image ever leaves your device.',
          'ttag-photobooth': 'Photo Editor',
          'tool-colorscanner-desc': 'Point your camera at anything and grab its color as HEX/RGB/HSL. Freeze then tap to sample, save a palette, export CSS variables or JSON. 100% client-side — no video ever leaves your device.',
          'ttag-colorscanner': 'Color Picker',
          'tool-qrscanner-desc': 'Decode QR codes live with your camera. Open URLs in one tap and keep a scan history. jsQR is bundled locally (no CDN), 100% client-side — no video ever leaves your device.',
          'ttag-qrscanner': 'QR Reader',
          'tool-heartrate-desc': 'Estimate your pulse by covering the rear camera & flashlight with a fingertip (rPPG). Live waveform plus a 15-second BPM measurement. 100% client-side. Not a medical device.',
          'ttag-heartrate': 'Pulse / rPPG',
          'tool-thermo-desc': 'No real infrared sensor — colorizes camera brightness into a heatmap (Iron / Rainbow / White-Hot) for a playful "heat source" effect. Auto-marks the brightest spot, adjustable sensitivity, PNG export. 100% client-side — no video ever leaves your device. Does not measure real temperature.',
          'ttag-thermo': 'Pseudo heat-source scan',
          'tool-health-desc': 'Track steps, cadence and activity from your motion sensor, plus distance, speed, pace, elevation gain and route from GPS. Estimates calories and saves sessions on your device. 100% client-side — your location never leaves your phone. Not a medical device.',
          'ttag-health': 'Steps / Route',
          'tool-vocal-synth-desc': 'Type kana lyrics and a formant-synthesis voice sings them right in your browser. It can also transcribe a melody from tab audio, your mic or an audio file (YIN pitch tracking with tempo and key estimation) and sing that back. Auto-composes melodies from chord progressions, lets you edit notes on a piano roll, and adds harmony, backing and reverb — then exports a WAV. Web Audio API only, no API key, nothing uploaded.',
          'ttag-vocal-synth': 'Transcribe × sing × compose',
          'tool-synth-eq-desc': 'A 10-band graphic equalizer (31 Hz–16 kHz) and a subtractive synthesizer in one page. Shape the synth, an audio file or your mic in real time while the spectrum and the EQ response curve are drawn on the same log-frequency graph. Eight synth presets, ten EQ presets, arpeggiator, delay and reverb, plus WAV export. Web Audio API only, no API key, nothing uploaded.',
          'ttag-synth-eq': '10-band EQ × synth × analyzer',
          'tool-zero1mobile-desc': 'An AI assistant that runs a local LLM on your phone via WebGPU. The model downloads once, then works offline. Voice input and read-aloud included, plus Air Touch — point your finger at the camera to control the screen. Neither your conversations nor the camera feed ever leave the device.',
          'ttag-zero1mobile': 'On-device AI',
          'ttag-airtouch': 'Air touch',
          'tool-aegis-desc': 'Seven security tools in one page: password strength analyzer, CSPRNG generator, hash calculator, AES-256-GCM encryption, phishing URL heuristics, TOTP (2FA) codes, and a security checkup. Web Crypto API, 100% client-side, zero data sent.',
          'ttag-aegis': 'Security 7-in-1',
          'tool-sengoku-desc': "A Sengoku strategy game with mechanics that set it apart from Nobunaga's Ambition: castles, ninja and navies hold zones of control that strike back (interception, sabotage, uprisings) when invaded; ambitious retainers stage coups and defections (gekokujo); battle formations with rock-paper-scissors matchups; a non-conquest 'Realm at Peace' victory via Shogun appointment and the Sobuji decree; and shareable setups via URL. GameKit + Canvas only, fully client-side.",
          'ttag-sengoku': 'Sengoku SLG × Gekokujo',
          'tool-sanguo-desc': 'A Three Kingdoms strategy sim spanning eight starting eras, from the Yellow Turban Rebellion (184 CE) to the Five-Route Invasion (223 CE). Choose a lord from 10 factions and expand through development, recruitment, diplomacy and stratagems. Each turn your moves are limited by action points, while grain and reinforcements hold the front together. Battles play out as hex combat (field & siege) over painted battlefields, where weather, morale and formal single combat swing the outcome. GPT-image2 China map, 194 general portraits & battlefields. Canvas API, fully client-side.',
          'ttag-sanguo': 'China Strategy SLG × Warlords',
          'tool-genpei-desc': "A historical strategy sim covering the Genpei War (1180-1189) in five scenarios, from Prince Mochihito's call to arms to the Oshu campaign. Pick one of five houses — Taira, Kamakura, Kiso, Kai or Oshu — and contest 66 provinces and 270 sites. Twelfth-century Japan had no castles: the land belonged to the capital's noble houses, and warriors were bound by fief and service. So the core resource is neither troops nor rice but *meibun* — legitimacy, granted through imperial edicts, court rank and the Three Sacred Treasures. High legitimacy opens gates without a fight; being branded an enemy of the court peels your own warrior bands away. Battles are hex combat decided by mounted-archery range and morale, with formal single combat after an exchange of names. Canvas API, procedurally drawn portraits and crests, fully client-side.",
          'ttag-genpei': 'Genpei SLG × Legitimacy',
          'tool-bakumatsu-desc': 'A Bakumatsu historical strategy simulation with six scenarios, from the arrival of the Black Ships in 1853 to the Boshin War in 1868. Lead the Tokugawa shogunate, Satsuma, Choshu or another domain through domestic policy, diplomacy, military campaigns and modernization. Canvas API, fully client-side.',
          'ttag-bakumatsu': 'Bakumatsu SLG × Modernization',
          'tool-loto6-desc': 'Visualize 1,000+ past LOTO6 draws with frequency stats, hot & cold numbers, a pair co-occurrence heatmap, and sum distributions. Includes a statistically weighted number picker for fun. CSV import & manual entry, all data stays on your device.',
          'ttag-loto6': 'Probability & Stats',
          'tool-aivideo-desc': 'Type a single prompt and it auto-generates a script, animated visuals, and BGM, then exports a video file (.webm). Runs entirely in the browser, no API key. Also generates a YouTube title, description, and tags.',
          'ttag-video-gen': 'Auto Video Gen',
          'tool-packet-desc': 'Even on 5G, lines can stall ("pakezumari"). This tool measures and visualizes RTT, jitter, and packet loss in real time — right in your browser — and shows the moment of congestion on a Canvas. CSV export, 100% client-side.',
          'ttag-network-viz': 'Network Viz',
          'tool-ukabi-title': 'Float or Sink?',
          'tool-ukabi-desc': 'A physics puzzle game — drop veggies and fruits in water and guess if they float or sink. Manage water level to hit your target. Missions, achievements, and AI battle mode included.',
          'ttag-physics': 'Physics Puzzle',
          'ttag-ai-battle': 'vs AI',
          'tool-shogirpg-desc': 'An experimental mashup of shogi piece movement and RPG leveling. Designed to be enjoyed even if you don\'t know shogi.',
          'ttag-shogi-rpg': 'Shogi × RPG',
          'tool-gradius-desc': 'A side-scrolling shooter built in Vanilla JS. Recreating that retro game feel in a modern browser.',
          'ttag-shooting': 'Shooter',
          'tool-aishogi-desc': 'Full-featured shogi in your browser. Play against AI modeled after Fujii Sota and Habu Yoshiharu\'s styles. No install needed.',
          'ttag-shogi': 'Shogi',
          'ttag-ai-match': 'vs AI',
          'tool-horror-desc': 'A Unity horror game project template. Player control, ghost AI, flashlight, door mechanics, note collection — all implemented and ready to use.',
          'ttag-horror': 'Horror',
          'ttag-template': 'Template',
          'tool-portfolio-title': 'This Portfolio Site',
          'tool-portfolio-desc': 'Designed and built together with Claude Code. Hosted on GitHub Pages — pure HTML/CSS/JS, no build tools.',
          'tool-github-link': 'View on GitHub →',
          'tool-engteacher-title': 'English Teacher Agent',
          'tool-engteacher-desc': 'Talk out loud with a native English teacher right in your browser — conversation roleplay, pronunciation practice, and listening quizzes using the Web Speech API. Bilingual, no API key, free.',
          'tool-engteacher-usage': '🎙️ Talk with Voice',
          'ttag-english': 'English Learning',
          // dashboard
          'dash-layout-toggle': 'Show / Reorder',
          'dash-layout-reset': 'Reset Layout',
          'dash-layout-title': 'Dashboard Display Settings',
          'dash-layout-note': 'Use checkboxes to show or hide cards, and arrow buttons to change their order. This layout is saved in this browser.',
          'dash-visit-title': '👁️ Site Visits',
          'dash-visit-link': 'Open Full Dashboard →',
          'dash-fx-title': '💴 Yen Rate (JPY)',
          'dash-fx-chart-label': '📉 30-Day JPY Rate Trend (MoM%)',
          'dash-weather-temp-label': '🌡 Today\'s Hourly Temperature',
          'dash-stock-title': '📈 Stock Index',
          'dash-stock-compare-label': 'Major Indices Performance',
          'dash-stock-input-ph': 'Company or Ticker (e.g. Toyota / AAPL / 7203.T)',
          'dash-add-btn': 'Add',
          'gas-card-title': '⛽ Gasoline Price',
          'dash-gas-rank-title': '💰 Price Ranking (Lowest First)',
          'dash-gas-daily': 'Daily',
          'dash-gas-monthly': 'Monthly',
          'dash-gas-6month': '6 Months',
          'home-traffic-title': '🚦 Traffic (Near You)',
          'household-card-title': 'Households',
          'dash-updates-title': '📰 Update Log',
          'dash-todo-title': '✅ TODO / Notes',
          'dash-todo-input-ph': 'Add a task…',
          'dash-todo-priority-normal': 'Med',
          'dash-todo-priority-high': 'High',
          'dash-todo-priority-later': 'Later',
          'dash-memo-ph': 'Notes (auto-saved)',
          'dash-memo-to-todo-btn': 'Convert notes to TODOs',
          'dash-todo-detail-link': 'Open Full TODO →',
          'dash-calendar-title': '📅 Calendar',
          'dash-cal-sync-btn': 'Sync from Google',
          'dash-schedule-ph': 'e.g. Meeting 14:00–15:00',
          'dash-register-btn': 'Save',
          'dash-cal-note': '📅 Entries with a time are automatically synced to <strong style="color:var(--blue)">Google Calendar</strong>',
          'dash-train-title': '🚃 Train Delays (Kanto)',
          'dash-refresh-btn': 'Refresh',
          'dash-pomo-title': '⏱️ Pomodoro Timer',
          'dash-pomo-reset': 'Reset',
          'dash-quake-title': '🌍 Earthquake Info',
          'dash-worldclock-title': '🌐 World Clock',
          'dash-news-title': '📰 Latest News',
          'dash-ai-news-title': '🤖 AI Latest News',
          'dash-quicklinks-title': '🔖 Bookmarks',
          // works
          'kicker-board-ai': 'Board Game × AI',
          'kicker-physics': 'Physics Puzzle',
          'kicker-action': 'Action Game',
          'kicker-shogi-rpg': 'Shogi × RPG',
          'kicker-shooting': 'Shooter',
          'kicker-sim': 'Simulation',
          'work-sengoku-kicker': 'Sengoku Historical Strategy',
          'work-sengoku-title': 'Sengoku Fuunki',
          'work-sengoku-desc': 'Choose a clan in one of six scenarios from 1550 to 1582, then use domestic policy, diplomacy, intrigue, field battles, and sieges to bring peace to the realm.',
          'work-sanguo-kicker': 'Three Kingdoms Historical Strategy',
          'work-sanguo-title': 'Three Kingdoms: Realm Divide',
          'work-sanguo-desc': 'Eight scenarios and ten factions, from the Yellow Turban Rebellion to the Five-Route Invasion. Command domestic policy, recruitment, diplomacy, stratagems and reinforcements, and win hex battles shaped by weather and morale to unite China.',
          'work-genpei-kicker': 'Genpei War Historical Strategy',
          'work-genpei-title': 'Genpei Souranki',
          'work-genpei-desc': "Five scenarios and five houses, from Prince Mochihito's call to arms in 1180 to the Oshu campaign of 1189. The core resource is legitimacy, not troops: imperial edicts and court rank open gates without a fight, while branding a rival an enemy of the court strips his warrior bands away.",
          'work-taihei-kicker': 'Nanboku-chō Historical Strategy',
          'work-taihei-title': 'Taihei Fuunki',
          'work-taihei-desc': "From the Genkō War of 1331 to the reunification of the courts in 1392, choose a side among the Southern Court, Northern Court, or neutral regional houses. Court petitions, rewards, and bandit intrigue decide the fight for each general's loyalty and the throne's legitimacy.",
          'work-bakumatsu-kicker': 'Bakumatsu Historical Strategy',
          'work-bakumatsu-title': 'Bakumatsu Fuunki',
          'work-bakumatsu-desc': 'Six scenarios from the arrival of the Black Ships in 1853 to the Boshin War in 1868. Lead the Tokugawa shogunate, Satsuma, Choshu or another domain through domestic policy, diplomacy, military campaigns and modernization.',
          'kicker-board-sim': 'Board Game / History Sim',
          'kicker-board-strategy': 'Board Game / Asset Strategy',
          'work-fixer-title': 'Fixer of History',
          'work-fixer-desc': 'Manipulate historical heroes from the shadows, balancing favors and infamy to back the winning side.',
          'work-cardgames-desc': 'Play 7 classic card games in your browser — Blackjack, Poker, Solitaire, FreeCell, Old Maid, Concentration, and Sevens.',
          'work-catan-desc': 'Full HEXLAN. 1P vs 3 AIs. Collect resources, build settlements, use dev cards, longest road, largest army — race to 10 VP.',
          'work-backgammon-desc': 'Backgammon against AI. Three difficulty levels: Easy / Normal / Hard. Modern-style Canvas API graphics.',
          'work-estate-desc': 'A Tokyo 23 wards real-estate board game: buy lots, monopolize wards, and collect rent. Rendered with Canvas API.',
          'work-ludo-desc': 'Red-vs-yellow Ludo game against AI, using GPT-image-2 board, token and dice assets with Canvas API.',
          'work-chinese-checkers-desc': 'Chinese Checkers against AI, using a free board asset and chain-jump movement toward the opposite camp.',
          'work-checkers-desc': 'Classic checkers with forced jumps, chain captures, kings, and three AI difficulty levels.',
          'work-go-desc': 'Go with UCT-MCTS AI. Supports 9×9 and 13×13 boards, three difficulty levels.',
          'work-othello-desc': 'Reversi against a minimax AI. Three difficulty levels with flip animations.',
          'work-chess-desc': 'AI chess in the browser. Difficulty levels, undo, board flip, castling, en passant, and promotion all supported.',
          'work-mahjong-desc': 'Full-rule mahjong against AI — ron, tsumo, pon, chi, kan, riichi, yaku, and scoring all implemented.',
          'work-hanafuda-desc': 'Hanafuda Koi-Koi against AI, with field matching, deck draws, illustrated yaku scoring, and AI Koi-Koi decisions.',
          'work-hyakunin-desc': 'Karuta card game with all 100 Hyakunin Isshu poems. Match the upper verse to the correct lower-verse card. 4 difficulty levels, Web Speech API narration.',
          'work-no-luck-poker-desc': 'Abstract strategy meets poker: claim cards from a 5×5 grid to build the strongest hand. No luck, pure tactics.',
          'work-dots-desc': 'Claim boxes by drawing lines between dots. Includes CPU play, difficulty levels, and hints.',
          'work-blokus-desc': 'Tile-placement board game on a 20×20 grid. Expand your territory with corner-touch polyomino rules against AI.',
          'work-trigon-title': 'Tri Territory',
          'work-trigon-desc': 'Place triangular pieces on a rhombus board. Expand territory using corner-touch rules against AI.',
          'work-hex-desc': 'Connect your two sides across a hex board. Includes CPU play, difficulty levels, and hints.',
          'work-conhex-desc': 'Place stones in holes, claim cells, and connect your two sides. Includes CPU play, difficulty levels, and hints.',
          'work-indigo-desc': 'Hex tile-placement by Reiner Knizia. Guide gems to your gateways to score. Canvas API rendered.',
          'work-carrom-desc': 'Finger billiards from South Asia. Flick the striker to pocket carrom men. Physics simulation with 3 AI difficulty levels.',
          'work-momentum-desc': 'Physics territory game where bullet trails become both territory and walls. Trails fade over time and break on impact, so route prediction matters.',
          'work-mahjong-sol-desc': 'Shanghai puzzle with 144 tiles – remove matching pairs. Hint, undo, and shuffle included.',
          'work-shogi-desc': 'Full shogi game against AI modeled after Fujii Sota and Habu Yoshiharu. Three difficulty levels, no install.',
          'work-float-desc': 'Physics puzzle: drop fruits and veggies in water and manage the level. Missions, achievements, and AI battle mode.',
          'work-shogirpg-desc': 'A genre-mashup combining shogi piece movement with RPG leveling and battles.',
          'work-bubble-desc': 'A puzzle game — rescue items trapped in bubbles with your tiny crew. Pop bubbles, place ladders, guide them to safety! Canvas API only.',
          'work-galactic-desc': 'Full-featured side-scrolling shooter: SVG sprites, 7 stages, 7 bosses, 6 power-ups, Web Audio BGM. Canvas API only. Mobile D-pad support.',
          'work-kart-desc': 'A 3-lap kart race with original characters, in a behind-the-kart third-person (pseudo-3D) view! Trigger mini-turbos by drifting, and use items like Nitro Capsules, Oil Cans, and Star Shots to overtake 5 rivals. Built with GameKit (Canvas API), mobile D-pad support.',
          'work-city-desc': 'SimCity-style browser game — place roads, homes, commercial, industrial, parks, and power plants to grow your city. Buildings evolve with power and road connections.',
          'work-corridor-title': 'Wall Chase',
          'work-corridor-desc': 'Race to the opposite side on a 9×9 board. Place walls to block your opponent\'s path — but you can\'t seal them off completely.',
          'work-play-now': 'Play Now →',
          'work-try-it': 'Try it →',
          'agent-fab-label': 'AI Agent',
          'agent-title': "hide's Site Agent",
          'agent-subtitle': 'Navigate the site, launch games, fetch data',
          'agent-input-ph': 'Ask me anything (e.g. what games?)',
          'agent-thinking': 'Thinking…',
          'agent-welcome': "Hi! Welcome to hide's portfolio 👋 I can introduce games, navigate the site, and fetch live data. Try a chip below.",
          'agent-fallback': "Sorry, I haven't learned that yet 🙏 Try a chip below or rephrase your question.",
          'agent-quick-1': '🎮 What games are here?',
          'agent-quick-2': '✨ Recommend one',
          'agent-quick-3': '☀️ Misato weather',
          'agent-quick-4': '💴 USD/JPY rate',
          'agent-action-play': 'Play →',
          'agent-action-open-section': 'Go there →',
          'agent-action-copy': 'Copy',
          'agent-action-retry': 'Retry',
          'agent-action-close': 'Close',
          'agent-action-clear': 'Reset',
          'agent-tool-loading': 'Fetching…',
          'agent-tool-error': 'Could not fetch. Please try again later.',
          'agent-clear-confirm': 'Conversation history cleared.',
          'agent-disambig': 'Which one did you mean?',
          'agent-more': 'See more',
        },
      };

      const LANG_KEY = 'site-lang';
      let currentLang = localStorage.getItem(LANG_KEY) || 'ja';

      function applyLang(lang) {
        const dict = TRANS[lang];
        document.querySelectorAll('[data-i18n]').forEach(el => {
          const key = el.dataset.i18n;
          if (dict[key] !== undefined) el.innerHTML = dict[key];
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
          const key = el.dataset.i18nPlaceholder;
          if (dict[key] !== undefined) el.placeholder = dict[key];
        });
        const btn = document.getElementById('lang-toggle-btn');
        if (btn) {
          btn.textContent = lang === 'ja' ? 'EN' : 'JP';
          btn.dataset.active = lang;
        }
        document.documentElement.lang = lang === 'ja' ? 'ja' : 'en';
        currentLang = lang;
        localStorage.setItem(LANG_KEY, lang);
        window.dispatchEvent(new CustomEvent('site-lang-change', { detail: { lang } }));
      }

      const btn = document.getElementById('lang-toggle-btn');
      if (btn) btn.addEventListener('click', () => applyLang(currentLang === 'ja' ? 'en' : 'ja'));

      if (currentLang !== 'ja') applyLang(currentLang);
    })();

    // ── ゲームシェアボタン（動的生成） ──
    (function() {
      const BASE = 'https://hifukasawa77-lgtm.github.io/main/';
      document.querySelectorAll('.work-card[data-category]').forEach(card => {
        const title = card.querySelector('h3')?.textContent?.trim() || 'ゲーム';
        const href = card.getAttribute('href') || '';
        const pageUrl = href.startsWith('http') ? href : BASE + href;
        const tweet = encodeURIComponent(`「${title}」ブラウザで無料プレイ！ #hideの部屋\n`);
        const tweetUrl = `https://twitter.com/intent/tweet?text=${tweet}&url=${encodeURIComponent(pageUrl)}`;
        const btn = document.createElement('button');
        btn.className = 'work-share-btn';
        btn.setAttribute('aria-label', `${title}をXでシェア`);
        btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.734-8.857L1.254 2.25H8.08l4.257 5.629L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>シェア';
        btn.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          window.open(tweetUrl, '_blank', 'noopener,noreferrer,width=560,height=360');
        });
        const body = card.querySelector('.work-body');
        if (body) body.appendChild(btn);
      });
    })();

    // ── ゲームカテゴリフィルター ──
    (function() {
      const filterBtns = document.querySelectorAll('.works-filter-btn');
      const cards = document.querySelectorAll('.work-card[data-category]');
      filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          filterBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const filter = btn.dataset.filter;
          cards.forEach(card => {
            card.classList.toggle('hidden', filter !== 'all' && card.dataset.category !== filter);
          });
        });
      });
    })();

    /* 案内エージェントは assets/js/agent-data.js + assets/js/agent.js に分離（このファイルの後に defer で読み込み） */

  /* ── Sports Section ── */
  (function () {
    const SPORTS_API = 'https://www.thesportsdb.com/api/v1/json/3';
    const NPB_RESULT_API = 'https://npb-result.ant-npb.workers.dev';
    const LEAGUES = {
      npb: { id: '4591', season: '2026' },
      j1:  { id: '4633', season: '2026' },
      j2:  { id: '4824', season: '2026' },
      j3:  { id: '4967', season: '2026' }
    };
    const NPB_JP = {
      'Chiba Lotte Marines':'千葉ロッテマリーンズ',
      'Chunichi Dragons':'中日ドラゴンズ',
      'Fukuoka SoftBank Hawks':'福岡ソフトバンクホークス',
      'Hanshin Tigers':'阪神タイガース',
      'Hiroshima Toyo Carp':'広島東洋カープ',
      'Hokkaido Nippon-Ham Fighters':'北海道日本ハムファイターズ',
      'Orix Buffaloes':'オリックス・バファローズ',
      'Saitama Seibu Lions':'埼玉西武ライオンズ',
      'Tohoku Rakuten Golden Eagles':'東北楽天ゴールデンイーグルス',
      'Tokyo Yakult Swallows':'東京ヤクルトスワローズ',
      'Yokohama DeNA BayStars':'横浜DeNAベイスターズ',
      'Yomiuri Giants':'読売ジャイアンツ',
      'Giants':'読売ジャイアンツ',
      'Tigers':'阪神タイガース',
      'Carp':'広島東洋カープ',
      'Swallows':'東京ヤクルトスワローズ',
      'BayStars':'横浜DeNAベイスターズ',
      'Dragons':'中日ドラゴンズ',
      'Hawks':'福岡ソフトバンクホークス',
      'Buffaloes':'オリックス・バファローズ',
      'Eagles':'東北楽天ゴールデンイーグルス',
      'Marines':'千葉ロッテマリーンズ',
      'Lions':'埼玉西武ライオンズ',
      'Fighters':'北海道日本ハムファイターズ',
      'Nippon Ham Fighters':'北海道日本ハムファイターズ'
    };
    const J1_JP = {
      'Albirex Niigata':'アルビレックス新潟',
      'Avispa Fukuoka':'アビスパ福岡',
      'Cerezo Osaka':'セレッソ大阪',
      'Consadole Sapporo':'北海道コンサドーレ札幌',
      'FC Tokyo':'FC東京',
      'Gamba Osaka':'ガンバ大阪',
      'Jubilo Iwata':'ジュビロ磐田',
      'Kashima Antlers':'鹿島アントラーズ',
      'Kawasaki Frontale':'川崎フロンターレ',
      'Kyoto Sanga':'京都サンガF.C.',
      'Machida Zelvia':'FC町田ゼルビア',
      'Nagoya Grampus':'名古屋グランパス',
      'Sanfrecce Hiroshima':'サンフレッチェ広島',
      'Sagan Tosu':'サガン鳥栖',
      'Shonan Bellmare':'湘南ベルマーレ',
      'Urawa Red Diamonds':'浦和レッズ',
      'Vissel Kobe':'ヴィッセル神戸',
      'Yokohama F Marinos':'横浜F・マリノス',
      'Yokohama F. Marinos':'横浜F・マリノス',
      'Kashiwa Reysol':'柏レイソル',
      'Vegalta Sendai':'ベガルタ仙台',
      'FC Machida Zelvia':'FC町田ゼルビア',
      'Hokkaido Consadole Sapporo':'北海道コンサドーレ札幌',
      'Gamba Osaka F.C.':'ガンバ大阪',
      'Cerezo Osaka F.C.':'セレッソ大阪',
      'Sagan Tosu F.C.':'サガン鳥栖',
      'Yokohama FM':'横浜F・マリノス',
      'Kawasaki F.C.':'川崎フロンターレ',
      'Urawa Reds':'浦和レッズ',
      'Kashima':'鹿島アントラーズ',
      'Tokyo Verdy':'東京ヴェルディ',
      'Tokyo Verdy 1969':'東京ヴェルディ',
      'Shimizu S-Pulse':'清水エスパルス',
      'Shimizu S Pulse':'清水エスパルス',
      'Omiya Ardija':'大宮アルディージャ'
    };
    const J2_JP = {
      'Albirex Niigata':'アルビレックス新潟',
      'Blaublitz Akita':'ブラウブリッツ秋田',
      'Fagiano Okayama':'ファジアーノ岡山',
      'FC Ryukyu':'FC琉球',
      'Fujieda MYFC':'藤枝MYFC',
      'Grulla Morioka':'いわてグルージャ盛岡',
      'Iwate Grulla Morioka':'いわてグルージャ盛岡',
      'JEF United Ichihara Chiba':'ジェフユナイテッド市原・千葉',
      'JEF United Ichihara-Chiba':'ジェフユナイテッド市原・千葉',
      'JEF United':'ジェフユナイテッド市原・千葉',
      'Kataller Toyama':'カターレ富山',
      'Mito HollyHock':'水戸ホーリーホック',
      'Mito Hollyhock':'水戸ホーリーホック',
      'Montedio Yamagata':'モンテディオ山形',
      'Oita Trinita':'大分トリニータ',
      'Omiya Ardija':'大宮アルディージャ',
      'Renofa Yamaguchi':'レノファ山口FC',
      'Roasso Kumamoto':'ロアッソ熊本',
      'SC Sagamihara':'SC相模原',
      'Shimizu S-Pulse':'清水エスパルス',
      'Shimizu S Pulse':'清水エスパルス',
      'Thespa Kusatsu Gunma':'ザスパ群馬',
      'Tochigi SC':'栃木SC',
      'Tokushima Vortis':'徳島ヴォルティス',
      'Tokyo Verdy':'東京ヴェルディ',
      'Tokyo Verdy 1969':'東京ヴェルディ',
      'V-Varen Nagasaki':'V・ファーレン長崎',
      'Vanraure Hachinohe':'ヴァンラーレ八戸',
      'Tegevajaro Miyazaki':'テゲバジャーロ宮崎',
      'Ventforet Kofu':'ヴァンフォーレ甲府',
      'Vegalta Sendai':'ベガルタ仙台',
      'Yokohama FC':'横浜FC',
      'Zweigen Kanazawa':'ツエーゲン金沢'
    };
    const J3_JP = {
      'AC Nagano Parceiro':'AC長野パルセイロ',
      'Azul Claro Numazu':'アスルクラロ沼津',
      'FC Gifu':'FC岐阜',
      'FC Imabari':'FC今治',
      'FC Osaka':'FC大阪',
      'Fukushima United FC':'福島ユナイテッドFC',
      'Gainare Tottori':'ガイナーレ鳥取',
      'Giravanz Kitakyushu':'ギラヴァンツ北九州',
      'Kamatamare Sanuki':'カマタマーレ讃岐',
      'Kataller Toyama':'カターレ富山',
      'Matsumoto Yamaga FC':'松本山雅FC',
      'Matsumoto Yamaga':'松本山雅FC',
      'Nara Club':'奈良クラブ',
      'Okinawa SV':'沖縄SV',
      'SC Sagamihara':'SC相模原',
      'Tegevajaro Miyazaki':'テゲバジャーロ宮崎',
      'Vanraure Hachinohe':'ヴァンラーレ八戸',
      'YSCC Yokohama':'Y.S.C.C.横浜',
      'Y.S.C.C. Yokohama':'Y.S.C.C.横浜'
    };

    const _loaded = {};

    // ESPN公開APIを使った順位表取得（J1/J2/J3用）
    const ESPN_SLUGS = { j1: 'jpn.1', j2: 'jpn.2', j3: 'jpn.3' };
    const ESPN_URLS = [
      'https://site.api.espn.com/apis/site/v2/sports/soccer/{slug}/standings',
      'https://site.api.espn.com/apis/v2/sports/soccer/{slug}/standings'
    ];

    function parseESPNEntries(data) {
      let entries = [];
      if (data.standings?.entries?.length) {
        entries = data.standings.entries;
      } else if (Array.isArray(data.children)) {
        for (const child of data.children) {
          if (child.standings?.entries?.length) {
            entries = entries.concat(child.standings.entries);
          }
          if (Array.isArray(child.children)) {
            for (const gc of child.children) {
              if (gc.standings?.entries?.length) {
                entries = entries.concat(gc.standings.entries);
              }
            }
          }
        }
      }
      if (!entries.length && data.items) entries = data.items;
      return entries;
    }

    async function fetchESPNStandings(sport) {
      const slug = ESPN_SLUGS[sport];
      if (!slug) return null;
      for (const urlTpl of ESPN_URLS) {
        const url = urlTpl.replace(/{slug}/g, slug);
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);
        try {
          const r = await fetch(url, { signal: ctrl.signal });
          clearTimeout(timer);
          if (!r.ok) continue;
          const data = await r.json();
          const entries = parseESPNEntries(data);
          if (!entries.length) continue;
          const rows = entries.map((entry, idx) => {
            const sm = {};
            (entry.stats || []).forEach(s => { sm[s.name] = s.displayValue || String(s.value ?? ''); });
            return {
              intRank: sm.rank || String(idx + 1),
              strTeam: entry.team?.displayName || entry.team?.shortDisplayName || '',
              intPlayed: sm.gamesPlayed || sm.played || '0',
              intWin: sm.wins || '0',
              intLoss: sm.losses || '0',
              intDraw: sm.ties || sm.draws || '0',
              intPoints: sm.points || '0',
              strTeamBadge: entry.team?.logos?.[0]?.href || ''
            };
          });
          rows.sort((a, b) => parseInt(a.intRank) - parseInt(b.intRank));
          rows.forEach((row, i) => { row.intRank = String(i + 1); });
          return rows;
        } catch (e) {
          clearTimeout(timer);
        }
      }
      return null;
    }

    function parseESPNGrouped(data) {
      if (!Array.isArray(data.children) || data.children.length < 2) return null;
      const groups = [];
      for (const child of data.children) {
        let entries = [];
        if (child.standings?.entries?.length) {
          entries = child.standings.entries;
        } else if (Array.isArray(child.children)) {
          for (const gc of child.children) {
            if (gc.standings?.entries?.length) entries = entries.concat(gc.standings.entries);
          }
        }
        if (!entries.length) continue;
        const rows = entries.map((entry, idx) => {
          const sm = {};
          (entry.stats || []).forEach(s => { sm[s.name] = s.displayValue || String(s.value ?? ''); });
          return {
            intRank: sm.rank || String(idx + 1),
            strTeam: entry.team?.displayName || entry.team?.shortDisplayName || '',
            intPlayed: sm.gamesPlayed || sm.played || '0',
            intWin: sm.wins || '0',
            intDraw: sm.ties || sm.draws || '0',
            intLoss: sm.losses || '0',
            intPoints: sm.points || '0',
            goalsFor: sm.pointsFor || '',
            goalsAgainst: sm.pointsAgainst || '',
            goalDiff: sm.pointDifferential || '',
            strTeamBadge: entry.team?.logos?.[0]?.href || ''
          };
        });
        rows.sort((a, b) => parseInt(a.intRank) - parseInt(b.intRank));
        rows.forEach((row, i) => { row.intRank = String(i + 1); });
        const rawName = child.name || child.abbreviation || '';
        const groupName = rawName.replace(/^J[123]\s*[-–—]\s*/i, '').replace(/^Group\s+/i, 'グループ ')
          || ('グループ ' + String.fromCharCode(65 + groups.length));
        groups.push({ name: groupName, rows });
      }
      return groups.length >= 2 ? groups : null;
    }

    function parseESPNStandings(data) {
      let entries = [];
      const groups = Array.isArray(data.standings) ? data.standings : [];
      for (const grp of groups) {
        const sub = grp.standings;
        if (sub && Array.isArray(sub.entries)) {
          entries = entries.concat(sub.entries);
        } else if (Array.isArray(grp.entries)) {
          entries = entries.concat(grp.entries);
        }
      }
      if (!entries.length && Array.isArray(data.children)) {
        for (const child of data.children) {
          if (child.standings && Array.isArray(child.standings.entries)) {
            entries = entries.concat(child.standings.entries);
          }
        }
      }
      return entries.map((entry, idx) => {
        const sm = {};
        (entry.stats || []).forEach(s => { sm[s.name] = s.value; });
        return {
          intRank: String(idx + 1),
          strTeam: (entry.team && entry.team.displayName) || '',
          intPlayed: String(Math.round(sm.gamesPlayed || sm.played || 0)),
          intWin: String(Math.round(sm.wins || 0)),
          intLoss: String(Math.round(sm.losses || 0)),
          intDraw: String(Math.round(sm.ties || sm.draws || 0)),
          intPoints: String(Math.round(sm.points || 0)),
          strTeamBadge: (entry.team && entry.team.logos && entry.team.logos[0]) ? entry.team.logos[0].href : ''
        };
      });
    }

    async function fetchESPNScoreboard(sport) {
      const slug = ESPN_SLUGS[sport];
      const now = new Date();
      const past = new Date(now); past.setDate(past.getDate() - 21);
      const future = new Date(now); future.setDate(future.getDate() + 14);
      const fmt = d => d.toISOString().slice(0, 10).replace(/-/g, '');
      const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${fmt(past)}-${fmt(future)}&limit=50`;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      try {
        const res = await fetch(url, {signal: ctrl.signal});
        clearTimeout(timer);
        if (!res.ok) return {results: [], upcoming: []};
        return parseESPNScoreboard(await res.json(), now);
      } catch(e) { clearTimeout(timer); return {results: [], upcoming: []}; }
    }

    function parseESPNScoreboard(data, now) {
      const events = data.events || [];
      const results = [], upcoming = [];
      for (const ev of events) {
        const comp = ev.competitions && ev.competitions[0];
        if (!comp) continue;
        const home = comp.competitors && comp.competitors.find(c => c.homeAway === 'home');
        const away = comp.competitors && comp.competitors.find(c => c.homeAway === 'away');
        if (!home || !away) continue;
        const completed = ev.status && ev.status.type && ev.status.type.completed === true;
        const item = {
          date: ev.date,
          homeName: (home.team && home.team.displayName) || '',
          awayName: (away.team && away.team.displayName) || '',
          homeLogo: (home.team && home.team.logo) || '',
          awayLogo: (away.team && away.team.logo) || '',
          homeScore: completed ? (home.score != null ? home.score : '') : '',
          awayScore: completed ? (away.score != null ? away.score : '') : '',
          venue: (comp.venue && comp.venue.fullName) || '',
          completed
        };
        if (completed) results.push(item);
        else upcoming.push(item);
      }
      return {results: results.slice(-3), upcoming: upcoming.slice(0, 3)};
    }

    async function fetchNPBResultStandings(league) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      try {
        const r = await fetch(NPB_RESULT_API + '/api/' + league, { signal: ctrl.signal });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return await r.json();
      } finally {
        clearTimeout(timer);
      }
    }

    // 英語チーム名 → NPB_TEAM_MARK の短縮キー（TheSportsDB・ESPN両方に対応）
    const NPB_EN_SHORT = {
      'Hanshin Tigers':'阪神',   'Tigers':'阪神',
      'Yomiuri Giants':'巨人',   'Giants':'巨人',
      'Hiroshima Toyo Carp':'広島', 'Carp':'広島',
      'Tokyo Yakult Swallows':'ヤクルト', 'Swallows':'ヤクルト', 'Yakult Swallows':'ヤクルト',
      'Yokohama DeNA BayStars':'DeNA', 'BayStars':'DeNA', 'DeNA BayStars':'DeNA',
      'Chunichi Dragons':'中日', 'Dragons':'中日',
      'Fukuoka SoftBank Hawks':'ソフトバンク', 'SoftBank Hawks':'ソフトバンク', 'Hawks':'ソフトバンク',
      'Tohoku Rakuten Golden Eagles':'楽天', 'Golden Eagles':'楽天', 'Eagles':'楽天',
      'Chiba Lotte Marines':'ロッテ', 'Marines':'ロッテ', 'Lotte Marines':'ロッテ',
      'Orix Buffaloes':'オリックス', 'Buffaloes':'オリックス',
      'Saitama Seibu Lions':'西武', 'Lions':'西武', 'Seibu Lions':'西武',
      'Hokkaido Nippon-Ham Fighters':'日本ハム', 'Fighters':'日本ハム', 'Nippon-Ham Fighters':'日本ハム',
    };

    // 球場名 英語 → 日本語
    const NPB_VENUE_JP = {
      'Tokyo Dome':                         '東京ドーム',
      'Yokohama Stadium':                   '横浜スタジアム',
      'Jingu Stadium':                      '明治神宮野球場',
      'Meiji Jingu Stadium':                '明治神宮野球場',
      'Mazda Zoom-Zoom Stadium Hiroshima':  'マツダスタジアム',
      'Mazda Stadium Hiroshima':            'マツダスタジアム',
      'Mazda Stadium':                      'マツダスタジアム',
      'Vantelin Dome Nagoya':               'バンテリンドームナゴヤ',
      'Nagoya Dome':                        'バンテリンドームナゴヤ',
      'Kyocera Dome Osaka':                 '京セラドーム大阪',
      'Osaka Dome':                         '京セラドーム大阪',
      'ZOZO Marine Stadium':                'ZOZOマリンスタジアム',
      'ZOZO Marine Stadium Chiba':          'ZOZOマリンスタジアム',
      'ES CON Field Hokkaido':              'エスコンフィールド北海道',
      'Sapporo Dome':                       'エスコンフィールド北海道',
      'Rakuten Mobile Park Miyagi':         '楽天モバイルパーク宮城',
      'Miyagi Baseball Stadium':            '楽天モバイルパーク宮城',
      'PayPay Dome':                        'みずほPayPayドーム',
      'Fukuoka PayPay Dome':               'みずほPayPayドーム',
      'Belluna Dome':                       'ベルーナドーム',
      'Seibu Dome':                         'ベルーナドーム',
      'Hotto Motto Field Kobe':             'ほっともっとフィールド神戸',
    };

    function venueJP(str) {
      if (!str) return '';
      for (const [en, jp] of Object.entries(NPB_VENUE_JP)) {
        if (str === en || str.startsWith(en)) return jp;
      }
      return str;
    }

    // TheSportsDB NPB チームロゴURL (eventsday に strHomeTeamBadge がない場合のフォールバック)
    const NPB_TEAM_LOGO_URL = {
      '巨人':       'https://www.thesportsdb.com/images/media/team/badge/vvpywu1425555973.png',
      '阪神':       'https://www.thesportsdb.com/images/media/team/badge/xvqsyt1425556073.png',
      '広島':       'https://www.thesportsdb.com/images/media/team/badge/wqxsru1425556192.png',
      'DeNA':       'https://www.thesportsdb.com/images/media/team/badge/tvpqyx1425556302.png',
      'ヤクルト':   'https://www.thesportsdb.com/images/media/team/badge/srqpxv1425556418.png',
      '中日':       'https://www.thesportsdb.com/images/media/team/badge/ruqpwt1425556510.png',
      'ソフトバンク':'https://www.thesportsdb.com/images/media/team/badge/qrpwsu1425556598.png',
      '楽天':       'https://www.thesportsdb.com/images/media/team/badge/pqwvrt1425556685.png',
      'ロッテ':     'https://www.thesportsdb.com/images/media/team/badge/opvwqr1425556770.png',
      'オリックス': 'https://www.thesportsdb.com/images/media/team/badge/novwrp1425556858.png',
      '西武':       'https://www.thesportsdb.com/images/media/team/badge/mnwvop1425556942.png',
      '日本ハム':   'https://www.thesportsdb.com/images/media/team/badge/lmvwno1425557032.png',
    };

    let _npbTodayTimer = null;

    // ESPN NPB Baseball スコアボードからイニング付きの全試合を取得
    async function fetchESPNNPBToday(dateStr) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      try {
        const r = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/baseball/npb/scoreboard?dates=${dateStr}&limit=20`,
          { signal: ctrl.signal }
        );
        if (!r.ok) return null;
        const data = await r.json();
        return (data.events && data.events.length) ? data.events : null;
      } catch { return null; } finally { clearTimeout(timer); }
    }

    // ESPN イベント → 統一ゲームオブジェクトへ変換
    function parseESPNNPBEvent(ev) {
      const comp = ev.competitions && ev.competitions[0];
      if (!comp) return null;
      const home = comp.competitors && comp.competitors.find(c => c.homeAway === 'home');
      const away = comp.competitors && comp.competitors.find(c => c.homeAway === 'away');
      if (!home || !away) return null;

      const st     = ev.status || {};
      const stType = st.type || {};
      const state  = stType.state || 'pre';  // 'pre' | 'in' | 'post'
      const completed = stType.completed === true || state === 'post';

      // イニング表示（ESPN shortDetail: "Top 2nd", "Bot 3rd", "Final" etc.）
      let statusCls = 'pre', statusText = '試合前';
      if (completed) {
        statusCls = 'fin'; statusText = '終了';
      } else if (state === 'in') {
        statusCls = 'live';
        const detail = (stType.shortDetail || '').toLowerCase();
        const period = st.period || 0;
        const isBot  = detail.includes('bot') || detail.includes('end') || detail.includes('b ');
        statusText = period ? `${period}回${isBot ? '裏' : '表'}` : '試合中';
      }

      // スコア（試合中・終了はスコアあり）
      const hs = (state === 'in' || completed) && home.score != null ? String(home.score) : null;
      const as = (state === 'in' || completed) && away.score != null ? String(away.score) : null;

      // 開始時刻をJSTに変換
      let timeLocal = '18:00';
      if (ev.date) {
        const dt = new Date(ev.date);
        timeLocal = `${String((dt.getUTCHours() + 9) % 24).padStart(2,'0')}:${String(dt.getUTCMinutes()).padStart(2,'0')}`;
      }

      const homeEN = (home.team && home.team.displayName) || '';
      const awayEN = (away.team && away.team.displayName) || '';
      const homeShort = NPB_EN_SHORT[homeEN] || homeEN;
      const awayShort = NPB_EN_SHORT[awayEN] || awayEN;

      return {
        homeEN, awayEN, homeShort, awayShort,
        homeJP: NPB_JP[homeEN] || homeShort,
        awayJP: NPB_JP[awayEN] || awayShort,
        homeScore: hs, awayScore: as,
        statusCls, statusText,
        timeLocal,
        venue: venueJP((comp.venue && comp.venue.fullName) || ''),
        homeLogo: (home.team && home.team.logos && home.team.logos[0] && home.team.logos[0].href) || '',
        awayLogo: (away.team && away.team.logos && away.team.logos[0] && away.team.logos[0].href) || '',
        isLive: statusCls === 'live',
        isFinished: statusCls === 'fin',
      };
    }

    // TheSportsDB eventsday → 統一ゲームオブジェクトへ変換
    function parseTSDBEvent(ev) {
      const homeEN   = ev.strHomeTeam || '';
      const awayEN   = ev.strAwayTeam || '';
      const homeShort = NPB_EN_SHORT[homeEN] || homeEN;
      const awayShort = NPB_EN_SHORT[awayEN] || awayEN;

      const isFin = ['FT','Match Finished','AOT','PEN'].includes(ev.strStatus);
      const hs = ev.intHomeScore != null ? String(ev.intHomeScore) : null;
      const as = ev.intAwayScore != null ? String(ev.intAwayScore) : null;
      const hasScore = hs !== null && as !== null;

      let statusCls = 'pre', statusText = '試合前';
      if (isFin) { statusCls = 'fin'; statusText = '終了'; }
      else if (hasScore) { statusCls = 'live'; statusText = '試合中'; }
      else if (ev.strTimeLocal && ev.dateEvent) {
        try {
          const gameMs = new Date(`${ev.dateEvent}T${ev.strTimeLocal}`).getTime();
          const nowJst = new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Tokyo'})).getTime();
          if (nowJst - gameMs > 20 * 60 * 1000) { statusCls = 'live'; statusText = '試合中?'; }
        } catch { /* ignore */ }
      }

      return {
        homeEN, awayEN, homeShort, awayShort,
        homeJP: teamJP(homeEN, 'npb') || homeEN,
        awayJP: teamJP(awayEN, 'npb') || awayEN,
        homeScore: hs, awayScore: as,
        statusCls, statusText,
        timeLocal: ev.strTimeLocal ? ev.strTimeLocal.slice(0, 5) : '18:00',
        venue: venueJP(ev.strVenue || ''),
        homeLogo: ev.strHomeTeamBadge || NPB_TEAM_LOGO_URL[homeShort] || '',
        awayLogo: ev.strAwayTeamBadge || NPB_TEAM_LOGO_URL[awayShort] || '',
        isLive: statusCls === 'live',
        isFinished: statusCls === 'fin',
      };
    }

    async function fetchNPBToday() {
      const jst  = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
      const yyyy = jst.getFullYear();
      const mm   = String(jst.getMonth() + 1).padStart(2, '0');
      const dd   = String(jst.getDate()).padStart(2, '0');
      const dateEl = document.getElementById('sports-npb-today-date');
      if (dateEl) dateEl.textContent = `${jst.getMonth() + 1}/${jst.getDate()}`;

      // ESPN を優先（全試合・リアルタイムスコア・イニング）
      const espnDate = `${yyyy}${mm}${dd}`;
      const espnEvents = await fetchESPNNPBToday(espnDate);
      if (espnEvents && espnEvents.length) {
        return espnEvents.map(parseESPNNPBEvent).filter(Boolean);
      }

      // フォールバック: TheSportsDB eventsday
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      try {
        const r = await fetch(`${SPORTS_API}/eventsday.php?l=4591&d=${dateStr}`, { signal: ctrl.signal });
        if (!r.ok) return [];
        const data = await r.json();
        return (data.events || []).map(parseTSDBEvent);
      } catch { return []; } finally { clearTimeout(timer); }
    }

    function renderNPBTodayGames(games) {
      const container = document.getElementById('sports-npb-today');
      const legacy    = document.getElementById('sports-npb-legacy');
      if (!container) return;
      container.innerHTML = '';

      if (!games || !games.length) {
        container.innerHTML = '<p class="sports-error-msg" style="text-align:left;padding:10px 0">本日の試合情報はありません</p>';
        if (legacy) legacy.style.display = '';
        return;
      }
      if (legacy) legacy.style.display = 'none';

      // 外部プロキシ由来の文字列を innerHTML へ展開するため HTML/属性エスケープを徹底（XSS防御）
      const esc = s => String(s ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      // ロゴURLは http(s) のみ許可。それ以外は空にしてバッジへフォールバック
      const safeUrl = u => /^https?:\/\//i.test(String(u || '')) ? esc(u) : '';

      games.forEach(g => {
        const homeMark = NPB_TEAM_MARK[g.homeShort] || { bg:'#444', fg:'#fff', abbr: esc(String(g.homeShort).slice(0,2)) };
        const awayMark = NPB_TEAM_MARK[g.awayShort] || { bg:'#444', fg:'#fff', abbr: esc(String(g.awayShort).slice(0,2)) };

        const makeLogo = (url, mark, name) => safeUrl(url)
          ? `<img class="npb-team-logo" src="${safeUrl(url)}" alt="${esc(name)}" loading="lazy" onerror="this.outerHTML='<span class=npb-team-badge style=background:${encodeURIComponent(mark.bg)};color:${encodeURIComponent(mark.fg)}>${esc(mark.abbr)}</span>'">`
          : `<span class="npb-team-badge" style="background:${esc(mark.bg)};color:${esc(mark.fg)}">${esc(mark.abbr)}</span>`;

        const hasScore = g.homeScore !== null && g.awayScore !== null;
        const scoreHtml = hasScore
          ? `<div class="npb-score-box">${esc(g.homeScore)} - ${esc(g.awayScore)}</div>`
          : `<div class="npb-score-box kick">${esc(g.timeLocal)}</div>`;

        const row = document.createElement('div');
        row.className = 'npb-game-row';
        row.innerHTML =
          makeLogo(g.homeLogo, homeMark, g.homeJP) +
          `<span class="npb-team-name home">${esc(g.homeJP)}</span>` +
          scoreHtml +
          `<span class="npb-team-name">${esc(g.awayJP)}</span>` +
          makeLogo(g.awayLogo, awayMark, g.awayJP) +
          `<span class="npb-status-badge ${esc(g.statusCls)}">${esc(g.statusText)}</span>` +
          `<span class="npb-game-venue">${esc(g.venue)}</span>`;
        container.appendChild(row);
      });
    }

    function scheduleNPBAutoRefresh(games) {
      if (_npbTodayTimer) { clearInterval(_npbTodayTimer); _npbTodayTimer = null; }
      const jst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
      const h = jst.getHours();
      if (h < 17 || h >= 24) return;
      const hasActive = games && games.some(g => !g.isFinished);
      if (!hasActive) return;
      const hasLive = games.some(g => g.isLive);
      _npbTodayTimer = setInterval(async () => {
        try {
          const gs = await fetchNPBToday();
          renderNPBTodayGames(gs);
          const timeEl = document.getElementById('sports-npb-time');
          if (timeEl) timeEl.textContent = '最終更新: ' + new Date().toLocaleTimeString('ja-JP');
          scheduleNPBAutoRefresh(gs);
        } catch (e) { /* silent */ }
      }, hasLive ? 30000 : 60000);
    }

    const NPB_TEAM_MARK = {
      // セ・リーグ
      'ヤクルト':   { bg: '#002d72', fg: '#fff',    abbr: 'S' },
      '阪神':       { bg: '#ffcc00', fg: '#000',    abbr: '神' },
      '巨人':       { bg: '#f97709', fg: '#fff',    abbr: 'G' },
      'DeNA':       { bg: '#003087', fg: '#fff',    abbr: 'DB' },
      '広島':       { bg: '#e00000', fg: '#fff',    abbr: 'C' },
      '中日':       { bg: '#003087', fg: '#7dc6ff', abbr: 'D' },
      // パ・リーグ
      'ソフトバンク': { bg: '#ffd700', fg: '#000',  abbr: 'H' },
      'ロッテ':     { bg: '#1b1b1b', fg: '#c9a227', abbr: 'M' },
      '楽天':       { bg: '#860000', fg: '#ffd700', abbr: 'E' },
      'オリックス': { bg: '#000033', fg: '#00aeef', abbr: 'B' },
      '日本ハム':   { bg: '#001489', fg: '#fff',    abbr: 'F' },
      '西武':       { bg: '#002b7f', fg: '#fff',    abbr: 'L' },
    };

    function renderNPBStandings(rows, id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = '';
      const table = document.createElement('table');
      table.className = 'sports-standings-table';
      const thead = document.createElement('thead');
      const headRow = document.createElement('tr');
      ['#', 'チーム', '試', '勝', '負', '分', '勝率', 'GB'].forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        headRow.appendChild(th);
      });
      thead.appendChild(headRow);
      table.appendChild(thead);
      const tbody = document.createElement('tbody');
      rows.forEach(row => {
        const tr = document.createElement('tr');
        const cells = [
          row.rank,
          null,
          row.playGameCount,
          row.win,
          row.lose,
          row.draw,
          row.pct != null ? row.pct.toFixed(3) : '-',
          row.gamesBehind || '-'
        ];
        cells.forEach((val, i) => {
          const td = document.createElement('td');
          if (i === 1) {
            const mark = NPB_TEAM_MARK[row.name];
            if (mark) {
              const badge = document.createElement('span');
              badge.textContent = mark.abbr;
              badge.style.cssText = `display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:${mark.bg};color:${mark.fg};font-size:10px;font-weight:700;margin-right:6px;vertical-align:middle;flex-shrink:0;`;
              const nameSpan = document.createElement('span');
              nameSpan.textContent = row.name;
              nameSpan.style.verticalAlign = 'middle';
              td.style.whiteSpace = 'nowrap';
              td.appendChild(badge);
              td.appendChild(nameSpan);
            } else {
              td.textContent = row.name;
            }
          } else {
            td.textContent = val ?? '';
          }
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      el.appendChild(table);
    }

    async function sportsFetch(path) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      try {
        const r = await fetch(SPORTS_API + path, { signal: ctrl.signal });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return await r.json();
      } finally {
        clearTimeout(timer);
      }
    }

    function teamJP(name, sport) {
      if (sport === 'npb') return NPB_JP[name] || name;
      if (sport === 'j2') return J2_JP[name] || J1_JP[name] || J3_JP[name] || name;
      if (sport === 'j3') return J3_JP[name] || J2_JP[name] || name;
      return J1_JP[name] || J2_JP[name] || J3_JP[name] || name;
    }

    function fmtDate(d, t) {
      if (!d) return '';
      const dt = new Date(d + 'T' + (t || '00:00:00'));
      const days = ['日','月','火','水','木','金','土'];
      return (dt.getMonth()+1) + '/' + dt.getDate() + '（' + days[dt.getDay()] + '）' +
             (t ? ' ' + t.slice(0,5) : '');
    }

    function showSkeleton(id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = '';
      for (let i = 0; i < 4; i++) {
        const d = document.createElement('div');
        d.className = 'sports-skeleton-row';
        d.style.width = (60 + Math.random() * 35) + '%';
        el.appendChild(d);
      }
    }

    function renderGroupedStandings(groups, id, sport) {
      const el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = '';
      groups.forEach(group => {
        const hdr = document.createElement('div');
        hdr.className = 'sports-group-header';
        hdr.textContent = group.name;
        el.appendChild(hdr);
        const table = document.createElement('table');
        table.className = 'sports-standings-table';
        const thead = document.createElement('thead');
        const headRow = document.createElement('tr');
        ['クラブ', '試', '勝', '分', '負', '得点', '失点', '差', '勝点'].forEach(h => {
          const th = document.createElement('th');
          th.textContent = h;
          headRow.appendChild(th);
        });
        thead.appendChild(headRow);
        table.appendChild(thead);
        const tbody = document.createElement('tbody');
        group.rows.forEach(row => {
          const tr = document.createElement('tr');
          const tdTeam = document.createElement('td');
          if (row.strTeamBadge) {
            const img = document.createElement('img');
            img.className = 'sports-team-logo';
            img.alt = '';
            img.src = row.strTeamBadge;
            img.onerror = function() { this.style.display = 'none'; };
            tdTeam.appendChild(img);
          }
          const nameSpan = document.createElement('span');
          nameSpan.textContent = teamJP(row.strTeam, sport);
          tdTeam.appendChild(nameSpan);
          tr.appendChild(tdTeam);
          [row.intPlayed, row.intWin, row.intDraw, row.intLoss,
           row.goalsFor || '—', row.goalsAgainst || '—', row.goalDiff || '—', row.intPoints].forEach((val, ci) => {
            const td = document.createElement('td');
            td.textContent = val ?? '';
            if (ci === 7) td.style.fontWeight = '700';
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        el.appendChild(table);
      });
    }

    function renderStandings(rows, id, sport) {
      const el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = '';
      const table = document.createElement('table');
      table.className = 'sports-standings-table';
      const thead = document.createElement('thead');
      const headRow = document.createElement('tr');
      const headers = ['#', 'チーム', '試', '勝', '負', '分', 'PT'];
      headers.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        headRow.appendChild(th);
      });
      thead.appendChild(headRow);
      table.appendChild(thead);
      const tbody = document.createElement('tbody');
      rows.forEach(row => {
        const tr = document.createElement('tr');
        const cells = [
          row.intRank,
          null, // チーム（特別処理）
          row.intPlayed,
          row.intWin,
          row.intLoss,
          row.intDraw,
          row.intPoints
        ];
        cells.forEach((val, i) => {
          const td = document.createElement('td');
          if (i === 1) {
            if (row.strTeamBadge) {
              const img = document.createElement('img');
              img.className = 'sports-team-logo';
              img.alt = '';
              img.src = row.strTeamBadge;
              img.onerror = function() { this.style.display = 'none'; };
              td.appendChild(img);
            }
            const nameSpan = document.createElement('span');
            nameSpan.textContent = teamJP(row.strTeam, sport);
            td.appendChild(nameSpan);
          } else {
            td.textContent = val || '';
          }
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      el.appendChild(table);
    }

    function renderMatchCard(ev, sport) {
      const card = document.createElement('div');
      card.className = 'sports-match-card';
      const dateBadge = document.createElement('div');
      dateBadge.className = 'sports-date-badge';
      dateBadge.textContent = fmtDate(ev.dateEvent, ev.strTimeLocal);
      card.appendChild(dateBadge);
      const teams = document.createElement('div');
      teams.className = 'sports-match-teams';
      function makeTeam(name, badge) {
        const div = document.createElement('div');
        div.className = 'sports-match-team';
        if (badge) {
          const img = document.createElement('img');
          img.className = 'sports-team-logo-lg';
          img.alt = '';
          img.src = badge;
          img.onerror = function() { this.style.display = 'none'; };
          div.appendChild(img);
        }
        const span = document.createElement('span');
        span.textContent = teamJP(name, sport);
        div.appendChild(span);
        return div;
      }
      teams.appendChild(makeTeam(ev.strHomeTeam, ev.strHomeTeamBadge));
      const vs = document.createElement('div');
      vs.className = 'sports-match-vs';
      const isFinished = ev.strStatus === 'FT' || ev.strStatus === 'Match Finished';
      if (isFinished && ev.intHomeScore !== null && ev.intAwayScore !== null) {
        vs.textContent = ev.intHomeScore + ' - ' + ev.intAwayScore;
        vs.classList.add('sports-match-score');
        vs.style.fontSize = '1.3rem';
      } else {
        vs.textContent = 'vs';
      }
      teams.appendChild(vs);
      teams.appendChild(makeTeam(ev.strAwayTeam, ev.strAwayTeamBadge));
      card.appendChild(teams);
      if (ev.strVenue) {
        const venue = document.createElement('div');
        venue.className = 'sports-venue';
        venue.textContent = ev.strVenue;
        card.appendChild(venue);
      }
      return card;
    }

    function renderESPNMatchCard(item, sport) {
      const card = document.createElement('div');
      card.className = 'sports-match-card';
      const date = new Date(item.date);
      const dateStr = date.toLocaleDateString('ja-JP', {month: 'numeric', day: 'numeric', weekday: 'short'});
      const timeStr = date.toLocaleTimeString('ja-JP', {hour: '2-digit', minute: '2-digit'});
      const dateBadge = document.createElement('div');
      dateBadge.className = 'sports-date-badge';
      dateBadge.textContent = item.completed ? dateStr : dateStr + ' ' + timeStr;
      card.appendChild(dateBadge);
      const teams = document.createElement('div');
      teams.className = 'sports-match-teams';
      function makeESPNTeam(name, logo, align) {
        const div = document.createElement('div');
        div.className = 'sports-match-team';
        div.style.cssText = 'display:flex;align-items:center;gap:4px;flex:1;' + (align === 'right' ? 'justify-content:flex-end;' : '');
        if (logo) {
          const img = document.createElement('img');
          img.className = 'sports-team-logo-lg';
          img.alt = '';
          img.src = logo;
          img.onerror = function() { this.style.display = 'none'; };
          if (align === 'right') div.appendChild(document.createElement('span'));
          div.insertBefore(img, align === 'right' ? div.lastChild : null);
        }
        const span = document.createElement('span');
        span.textContent = teamJP(name, sport) || name;
        div.appendChild(span);
        return div;
      }
      const homeDiv = document.createElement('div');
      homeDiv.className = 'sports-match-team';
      homeDiv.style.cssText = 'display:flex;align-items:center;gap:4px;flex:1;justify-content:flex-end;';
      const homeSpan = document.createElement('span');
      homeSpan.textContent = teamJP(item.homeName, sport) || item.homeName;
      homeDiv.appendChild(homeSpan);
      if (item.homeLogo) {
        const img = document.createElement('img');
        img.className = 'sports-team-logo-lg';
        img.alt = '';
        img.src = item.homeLogo;
        img.onerror = function() { this.style.display = 'none'; };
        homeDiv.appendChild(img);
      }
      teams.appendChild(homeDiv);
      const vs = document.createElement('div');
      vs.className = 'sports-match-vs';
      if (item.completed && item.homeScore !== '' && item.awayScore !== '') {
        vs.textContent = item.homeScore + ' - ' + item.awayScore;
        vs.classList.add('sports-match-score');
        vs.style.fontSize = '1.3rem';
      } else {
        vs.textContent = 'vs';
      }
      teams.appendChild(vs);
      const awayDiv = document.createElement('div');
      awayDiv.className = 'sports-match-team';
      awayDiv.style.cssText = 'display:flex;align-items:center;gap:4px;flex:1;';
      if (item.awayLogo) {
        const img = document.createElement('img');
        img.className = 'sports-team-logo-lg';
        img.alt = '';
        img.src = item.awayLogo;
        img.onerror = function() { this.style.display = 'none'; };
        awayDiv.appendChild(img);
      }
      const awaySpan = document.createElement('span');
      awaySpan.textContent = teamJP(item.awayName, sport) || item.awayName;
      awayDiv.appendChild(awaySpan);
      teams.appendChild(awayDiv);
      card.appendChild(teams);
      if (item.venue) {
        const venue = document.createElement('div');
        venue.className = 'sports-venue';
        venue.textContent = item.venue;
        card.appendChild(venue);
      }
      return card;
    }

    function showNoData(id, msg) {
      const el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = '';
      const p = document.createElement('p');
      p.className = 'sports-error-msg';
      p.textContent = msg;
      el.appendChild(p);
    }

    async function loadSports(sport) {
      if (_loaded[sport]) return;
      _loaded[sport] = true;
      const lg = LEAGUES[sport];

      if (sport === 'npb') {
        showSkeleton('sports-npb-standings-cl');
        showSkeleton('sports-npb-standings-pl');
        showSkeleton('sports-npb-results');
        showSkeleton('sports-npb-upcoming');
        showSkeleton('sports-npb-today');

        const [clRes, plRes, pastRes, nextRes, todayRes] = await Promise.allSettled([
          fetchNPBResultStandings('cl'),
          fetchNPBResultStandings('pl'),
          sportsFetch('/eventspastleague.php?id=' + lg.id),
          sportsFetch('/eventsnextleague.php?id=' + lg.id),
          fetchNPBToday()
        ]);

        const clRows = clRes.status === 'fulfilled' ? clRes.value : null;
        if (Array.isArray(clRows) && clRows.length) {
          renderNPBStandings(clRows, 'sports-npb-standings-cl');
        } else {
          showNoData('sports-npb-standings-cl', 'データを取得できませんでした');
        }

        const plRows = plRes.status === 'fulfilled' ? plRes.value : null;
        if (Array.isArray(plRows) && plRows.length) {
          renderNPBStandings(plRows, 'sports-npb-standings-pl');
        } else {
          showNoData('sports-npb-standings-pl', 'データを取得できませんでした');
        }

        if (pastRes.status === 'fulfilled' && pastRes.value && pastRes.value.events && pastRes.value.events.length) {
          const evts = pastRes.value.events.slice(-3).reverse();
          const container = document.getElementById('sports-npb-results');
          if (container) {
            container.innerHTML = '';
            evts.forEach(ev => container.appendChild(renderMatchCard(ev, 'npb')));
          }
        } else {
          showNoData('sports-npb-results', 'データを取得できませんでした');
        }

        if (nextRes.status === 'fulfilled' && nextRes.value && nextRes.value.events && nextRes.value.events.length) {
          const evts = nextRes.value.events.slice(0, 3);
          const container = document.getElementById('sports-npb-upcoming');
          if (container) {
            container.innerHTML = '';
            evts.forEach(ev => container.appendChild(renderMatchCard(ev, 'npb')));
          }
        } else {
          showNoData('sports-npb-upcoming', '予定データなし');
        }

        // 本日の試合
        const todayEvts = todayRes.status === 'fulfilled' ? todayRes.value : null;
        if (todayEvts) {
          renderNPBTodayGames(todayEvts);
          scheduleNPBAutoRefresh(todayEvts);
        } else {
          const el = document.getElementById('sports-npb-today');
          if (el) el.innerHTML = '<p class="sports-error-msg" style="text-align:left;padding:10px 0">本日の試合データを取得できませんでした</p>';
          const legacy = document.getElementById('sports-npb-legacy');
          if (legacy) legacy.style.display = '';
        }

      } else {
        showSkeleton('sports-' + sport + '-standings');
        showSkeleton('sports-' + sport + '-results');
        showSkeleton('sports-' + sport + '-upcoming');

        // J2: ESPNからRAWデータを取得してグループ形式を試みる
        if (sport === 'j2') {
          const [rawResult, sbResult] = await Promise.allSettled([
            (async () => {
              for (const urlTpl of ESPN_URLS) {
                const ctrl = new AbortController();
                const timer = setTimeout(() => ctrl.abort(), 8000);
                try {
                  const r = await fetch(urlTpl.replace(/{slug}/g, ESPN_SLUGS.j2), { signal: ctrl.signal });
                  clearTimeout(timer);
                  if (r.ok) return await r.json();
                } catch (e) { clearTimeout(timer); }
              }
              return null;
            })(),
            fetchESPNScoreboard('j2')
          ]);
          const rawData = rawResult.status === 'fulfilled' ? rawResult.value : null;
          const groups = rawData ? parseESPNGrouped(rawData) : null;
          if (groups) {
            renderGroupedStandings(groups, 'sports-j2-standings', 'j2');
          } else {
            let rows = [];
            if (rawData) {
              rows = parseESPNEntries(rawData).map((entry, idx) => {
                const sm = {};
                (entry.stats || []).forEach(s => { sm[s.name] = s.displayValue || String(s.value ?? ''); });
                return { intRank: sm.rank || String(idx + 1), strTeam: entry.team?.displayName || '', intPlayed: sm.gamesPlayed || '0', intWin: sm.wins || '0', intLoss: sm.losses || '0', intDraw: sm.ties || sm.draws || '0', intPoints: sm.points || '0', strTeamBadge: entry.team?.logos?.[0]?.href || '' };
              });
              rows.sort((a, b) => parseInt(a.intRank) - parseInt(b.intRank));
            }
            if (!rows.length) {
              const seasons = [lg.season, String(parseInt(lg.season) - 1)];
              for (const s of seasons) {
                try {
                  const res = await sportsFetch('/lookuptable.php?l=' + lg.id + '&s=' + s);
                  if (res?.table?.length) {
                    rows = res.table.slice().sort((a, b) => parseInt(b.intPoints || 0) - parseInt(a.intPoints || 0)).map((r, i) => ({ ...r, intRank: String(i + 1) }));
                    try { const tr = await sportsFetch('/lookup_all_teams.php?l=' + lg.id); if (tr?.teams) { const bm = {}; tr.teams.forEach(t => { bm[t.strTeam] = t.strTeamBadge || ''; }); rows = rows.map(r => ({ ...r, strTeamBadge: bm[r.strTeam] || r.strTeamBadge || '' })); } } catch (e) {}
                    break;
                  }
                } catch (e) {}
              }
            }
            if (rows.length) renderStandings(rows, 'sports-j2-standings', 'j2');
            else showNoData('sports-j2-standings', '順位表データを取得できませんでした');
          }
          const sb2 = sbResult.status === 'fulfilled' ? sbResult.value : { results: [], upcoming: [] };
          const resEl2 = document.getElementById('sports-j2-results');
          if (resEl2) { resEl2.innerHTML = ''; if (sb2.results.length) sb2.results.forEach(i => resEl2.appendChild(renderESPNMatchCard(i, 'j2'))); else showNoData('sports-j2-results', 'データを取得できませんでした'); }
          const upEl2 = document.getElementById('sports-j2-upcoming');
          if (upEl2) { upEl2.innerHTML = ''; if (sb2.upcoming.length) sb2.upcoming.forEach(i => upEl2.appendChild(renderESPNMatchCard(i, 'j2'))); else showNoData('sports-j2-upcoming', '予定データなし'); }
        } else {
          const [standResult, scoreboardResult] = await Promise.allSettled([
            fetchESPNStandings(sport),
            fetchESPNScoreboard(sport)
          ]);

          let rows = standResult.status === 'fulfilled' ? standResult.value : null;

          // J3: ESPN失敗時はTheSportsDBにフォールバック（2026→2025）
          if ((!rows || !rows.length) && sport === 'j3') {
            const seasons = [lg.season, String(parseInt(lg.season) - 1)];
            for (const s of seasons) {
              try {
                const res = await sportsFetch('/lookuptable.php?l=' + lg.id + '&s=' + s);
                if (res?.table?.length) {
                  rows = res.table
                    .slice()
                    .sort((a, b) => parseInt(b.intPoints || 0) - parseInt(a.intPoints || 0))
                    .map((r, i) => ({ ...r, intRank: String(i + 1) }));
                  try {
                    const teamsRes = await sportsFetch('/lookup_all_teams.php?l=' + lg.id);
                    if (teamsRes?.teams) {
                      const badgeMap = {};
                      teamsRes.teams.forEach(t => { badgeMap[t.strTeam] = t.strTeamBadge || ''; });
                      rows = rows.map(r => ({ ...r, strTeamBadge: badgeMap[r.strTeam] || r.strTeamBadge || '' }));
                    }
                  } catch (e) {}
                  break;
                }
              } catch (e) {}
            }
          }

          if (rows && rows.length) {
            renderStandings(rows, 'sports-' + sport + '-standings', sport);
          } else {
            showNoData('sports-' + sport + '-standings', '順位表データを取得できませんでした');
          }

          const sb = scoreboardResult.status === 'fulfilled' ? scoreboardResult.value : {results: [], upcoming: []};

          const resultsEl = document.getElementById('sports-' + sport + '-results');
          if (resultsEl) {
            resultsEl.innerHTML = '';
            if (sb.results.length) {
              sb.results.forEach(item => resultsEl.appendChild(renderESPNMatchCard(item, sport)));
            } else {
              showNoData('sports-' + sport + '-results', 'データを取得できませんでした');
            }
          }

          const upcomingEl = document.getElementById('sports-' + sport + '-upcoming');
          if (upcomingEl) {
            upcomingEl.innerHTML = '';
            if (sb.upcoming.length) {
              sb.upcoming.forEach(item => upcomingEl.appendChild(renderESPNMatchCard(item, sport)));
            } else {
              showNoData('sports-' + sport + '-upcoming', '予定データなし');
            }
          }
        }
      }

      const timeEl = document.getElementById('sports-' + sport + '-time');
      if (timeEl) {
        const now = new Date();
        timeEl.textContent = '最終更新: ' + now.toLocaleTimeString('ja-JP');
      }
    }

    function switchTab(tab) {
      document.querySelectorAll('.sports-tab-btn').forEach(btn => {
        const active = btn.dataset.tab === tab;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-selected', active);
      });
      document.querySelectorAll('.sports-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === 'sports-panel-' + tab);
      });
      loadSports(tab);
    }

    function initSports() {
      const section = document.getElementById('sports');
      if (!section) return;
      document.querySelectorAll('.sports-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
      });
      // 今日の試合 手動更新ボタン
      document.addEventListener('click', async (e) => {
        const btn = e.target.closest('#sports-npb-refresh-btn');
        if (!btn) return;
        btn.classList.add('spinning');
        btn.disabled = true;
        try {
          const evts = await fetchNPBToday();
          renderNPBTodayGames(evts);
          scheduleNPBAutoRefresh(evts);
          const timeEl = document.getElementById('sports-npb-time');
          if (timeEl) timeEl.textContent = '最終更新: ' + new Date().toLocaleTimeString('ja-JP');
        } catch (e) { /* silent */ } finally {
          btn.classList.remove('spinning');
          btn.disabled = false;
        }
      });
      const obs = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) {
          loadSports('npb');
          obs.disconnect();
        }
      }, { threshold: 0.1 });
      obs.observe(section);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initSports);
    } else {
      initSports();
    }
  })();

    /* ── スクロール進行インジケーター ── */
    (function () {
      const bar = document.getElementById('scroll-progress-bar');
      if (!bar) return;
      let ticking = false;
      function updateBar() {
        const scrolled = document.documentElement.scrollTop || document.body.scrollTop;
        const total = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        bar.style.width = (total > 0 ? (scrolled / total) * 100 : 0) + '%';
        ticking = false;
      }
      window.addEventListener('scroll', () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(updateBar);
        }
      }, { passive: true });
      updateBar();
    })();

    /* ── ナビ現在地ハイライト（Intersection Observer） ── */
    (function () {
      const sectionIds = ['local', 'hobby', 'pet', 'blog', 'tools', 'sports', 'dashboard', 'works'];
      const navLinks = {};
      sectionIds.forEach(id => {
        const link = document.querySelector(`.site-nav a[href="#${id}"]`);
        if (link) navLinks[id] = link;
      });

      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          const id = entry.target.id;
          if (navLinks[id]) {
            navLinks[id].classList.toggle('nav-active', entry.isIntersecting);
          }
        });
      }, { threshold: 0.25 });

      sectionIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) observer.observe(el);
      });
    })();
