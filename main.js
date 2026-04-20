/* ===================================================
   PIPESORT - Enhanced Game Engine
   Features: 6 levels, undo, hints, timer, confetti,
   particles, localStorage, win detection, progress bar
   =================================================== */
'use strict';

// ─── CONFIG ─────────────────────────────────────────────────────────────────
const COLORS = [
  'red','blue','yellow','green','purple',
  'lightgreen','lightblue','orange','brown','pink','teal','lime'
];

const COLOR_DISPLAY = {
  red:       '#f43f5e', blue:      '#3b82f6', yellow:    '#facc15',
  green:     '#22c55e', purple:    '#a855f7', lightgreen:'#4ade80',
  lightblue: '#00f7ff', orange:    '#f97316', brown:     '#b45309',
  pink:      '#ec4899', teal:      '#14b8a6', lime:      '#a3e635',
  transparent: 'transparent',
};

const LEVELS = {
  easy:   { name:'EASY',      colors:3,  extra:2, maxHints:3, parMoves:12  },
  medium: { name:'MEDIUM',    colors:4,  extra:2, maxHints:3, parMoves:18  },
  hard:   { name:'HARD',      colors:5,  extra:2, maxHints:3, parMoves:26  },
  vhard:  { name:'VERY HARD', colors:6,  extra:2, maxHints:2, parMoves:34  },
  expert: { name:'EXPERT',    colors:8,  extra:2, maxHints:2, parMoves:50  },
  legend: { name:'LEGENDARY', colors:10, extra:2, maxHints:1, parMoves:70  },
};

const LEVEL_ORDER = ['easy','medium','hard','vhard','expert','legend'];

// ─── STATE ───────────────────────────────────────────────────────────────────
let currentLevel = null;
let water        = [];   // current state  [tube][layer 0=bottom..3=top]
let waterOrig    = [];   // snapshot to restart
let undoStack    = [];   // array of water snapshots
let clicked      = [];
let transferring = false;
let moves        = 0;
let hintsLeft    = 3;
let timerSec     = 0;
let timerIntvl   = null;
let gameActive   = false;

// ─── DOM REFS (set in init) ──────────────────────────────────────────────────
let $tubesArea, $hud, $hudMoves, $hudTimer, $hintCount,
    $progressBar, $progressLabel, $hudLevelTag;

// ─── PARTICLE SYSTEM ────────────────────────────────────────────────────────
(function ParticleSystem() {
  const canvas = document.getElementById('particles-canvas');
  if (!canvas) return;
  const ctx  = canvas.getContext('2d');
  let W, H, particles = [];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  class Particle {
    constructor() { this.reset(true); }
    reset(init) {
      this.x  = Math.random() * W;
      this.y  = init ? Math.random() * H : H + 10;
      this.r  = Math.random() * 1.5 + 0.5;
      this.vy = -(Math.random() * 0.4 + 0.1);
      this.vx = (Math.random() - 0.5) * 0.2;
      this.alpha = Math.random() * 0.5 + 0.1;
      const hues = [180, 270, 200, 320];
      this.hue = hues[Math.floor(Math.random() * hues.length)];
    }
    update() {
      this.x += this.vx; this.y += this.vy;
      if (this.y < -10) this.reset(false);
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${this.hue},100%,70%,${this.alpha})`;
      ctx.fill();
    }
  }

  for (let i = 0; i < 120; i++) particles.push(new Particle());

  function loop() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(loop);
  }
  loop();
})();

// ─── CONFETTI SYSTEM ─────────────────────────────────────────────────────────
function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx  = canvas.getContext('2d');
  const cols = ['#00f7ff','#a855f7','#f43f5e','#facc15','#22c55e','#f97316'];
  let pieces = [];
  for (let i = 0; i < 140; i++) {
    pieces.push({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height,
      w: Math.random() * 12 + 5,
      h: Math.random() * 6 + 3,
      color: cols[Math.floor(Math.random() * cols.length)],
      vy: Math.random() * 4 + 2,
      vx: (Math.random() - 0.5) * 3,
      rot: Math.random() * 360,
      rspeed: (Math.random() - 0.5) * 6,
      alpha: 1,
    });
  }
  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      p.y += p.vy; p.x += p.vx; p.rot += p.rspeed;
      if (frame > 100) p.alpha -= 0.01;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
      ctx.restore();
    });
    frame++;
    if (frame < 200) requestAnimationFrame(draw);
  }
  draw();
}

// ─── TOAST ───────────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg, duration = 2000) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), duration);
}

// ─── LOCAL STORAGE ────────────────────────────────────────────────────────────
function getLS(key, def) {
  try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : def; }
  catch { return def; }
}
function setLS(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

function loadStats() {
  const wins    = getLS('pg_wins', 0);
  const totalMv = getLS('pg_total_moves', 0);
  const bestLvl = getLS('pg_best_level', null);

  const $w = document.getElementById('stat-wins');
  const $m = document.getElementById('stat-moves');
  const $l = document.getElementById('stat-best-level');
  if ($w) $w.textContent = wins;
  if ($m) $m.textContent = totalMv;
  if ($l) $l.textContent = bestLvl ? LEVELS[bestLvl]?.name || bestLvl : '—';

  LEVEL_ORDER.forEach(lvl => {
    const best = getLS(`pg_best_${lvl}`, null);
    const el = document.getElementById(`best-${lvl}`);
    if (el) el.textContent = best ? `Best: ${best} moves` : 'Best: —';
  });
}

window.ResetStats = function() {
  if (!confirm('Reset all stats and best scores?')) return;
  ['pg_wins','pg_total_moves','pg_best_level'].forEach(k => localStorage.removeItem(k));
  LEVEL_ORDER.forEach(lvl => localStorage.removeItem(`pg_best_${lvl}`));
  loadStats();
  showToast('📊 Stats reset!');
};

// ─── TIMER ────────────────────────────────────────────────────────────────────
function startTimer() {
  stopTimer();
  timerSec = 0;
  timerIntvl = setInterval(() => {
    timerSec++;
    if ($hudTimer) {
      const m = Math.floor(timerSec / 60);
      const s = timerSec % 60;
      $hudTimer.textContent = `${m}:${s.toString().padStart(2,'0')}`;
    }
  }, 1000);
}
function stopTimer() {
  if (timerIntvl) { clearInterval(timerIntvl); timerIntvl = null; }
}
function formatTime(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${s.toString().padStart(2,'0')}`;
}

// ─── SHUFFLE ─────────────────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── OPEN LEVEL ──────────────────────────────────────────────────────────────
window.OpenLevel = function(lvlKey) {
  const cfg = LEVELS[lvlKey];
  if (!cfg) return;
  currentLevel = lvlKey;
  moves = 0;
  hintsLeft = cfg.maxHints;
  clicked = [];
  transferring = false;
  undoStack = [];
  water = [];

  // Build tubes
  let allColors = [];
  for (let i = 0; i < cfg.colors; i++)
    for (let j = 0; j < 4; j++)
      allColors.push(COLORS[i]);
  allColors = shuffle(allColors);

  let idx = 0;
  for (let i = 0; i < cfg.colors; i++) {
    water[i] = [];
    for (let j = 0; j < 4; j++) water[i].push(allColors[idx++]);
  }
  for (let i = 0; i < cfg.extra; i++)
    water.push(['transparent','transparent','transparent','transparent']);

  waterOrig = water.map(t => [...t]);

  // Show game screen
  document.getElementById('menu').style.display = 'none';
  document.getElementById('level').style.display = 'block';
  document.getElementById('win-screen').style.display = 'none';

  // HUD
  $tubesArea    = document.getElementById('tubes-area');
  $hud          = document.getElementById('hud');
  $hudMoves     = document.getElementById('hud-moves');
  $hudTimer     = document.getElementById('hud-timer');
  $hintCount    = document.getElementById('hint-count');
  $progressBar  = document.getElementById('progress-bar');
  $progressLabel= document.getElementById('progress-label');
  $hudLevelTag  = document.getElementById('hud-level-tag');

  if ($hudLevelTag) $hudLevelTag.textContent = cfg.name;
  if ($hintCount)   $hintCount.textContent   = hintsLeft;
  if ($hudMoves)    $hudMoves.textContent     = '0';
  if ($hudTimer)    $hudTimer.textContent     = '0:00';

  gameActive = true;
  startTimer();
  renderTubes();
  updateProgress();
};

// ─── RENDER TUBES ────────────────────────────────────────────────────────────
function renderTubes() {
  if (!$tubesArea) return;
  $tubesArea.innerHTML = '';

  water.forEach((tube, ti) => {
    const wrap = document.createElement('div');
    wrap.className = 'test-tube-wrap';
    wrap.id = `tube-${ti}`;
    wrap.onclick = () => handleClick(ti);

    // top cap
    const top = document.createElement('div');
    top.className = 'tube-top';

    // body
    const body = document.createElement('div');
    body.className = 'tube-body';

    // layers (index 0 = bottom displayed last visually = flex-end)
    // tube[0]=bottom, tube[3]=top. We display from bottom up.
    for (let l = 3; l >= 0; l--) {
      const layer = document.createElement('div');
      layer.className = `tube-layer layer-${tube[l]}`;
      if (tube[l] === 'transparent') {
        layer.style.background = 'transparent';
        layer.style.boxShadow = 'none';
      } else {
        layer.style.background = COLOR_DISPLAY[tube[l]] || tube[l];
      }
      body.appendChild(layer);
    }

    wrap.appendChild(top);
    wrap.appendChild(body);

    // Mark complete tubes
    if (isTubeComplete(tube)) {
      wrap.classList.add('complete');
    }

    $tubesArea.appendChild(wrap);
  });
}

function isTubeComplete(tube) {
  if (tube[0] === 'transparent') return true; // empty = done
  return tube.every(l => l === tube[0] && l !== 'transparent');
}

// ─── CLICK HANDLER ───────────────────────────────────────────────────────────
function handleClick(tubeIdx) {
  if (transferring || !gameActive) return;

  if (clicked.length === 0) {
    // First click — select
    if (water[tubeIdx].every(l => l === 'transparent')) {
      showToast('Empty tube — select a source first!');
      return;
    }
    clicked.push(tubeIdx);
    document.getElementById(`tube-${tubeIdx}`)?.classList.add('selected');
  } else {
    const from = clicked[0];
    clicked = [];
    document.getElementById(`tube-${from}`)?.classList.remove('selected');

    if (from === tubeIdx) return; // deselect

    if (tryPour(from, tubeIdx)) {
      moves++;
      if ($hudMoves) $hudMoves.textContent = moves;
      // NOTE: tryPour already pushed the snapshot — no extra push needed

      setTimeout(() => {
        renderTubes();
        updateProgress();
        checkWin();
      }, 400);
    } else {
      showToast('❌ Invalid move!');
    }
  }
}

// ─── POUR LOGIC ──────────────────────────────────────────────────────────────
function tryPour(from, to) {
  // Can't pour into a full tube
  if (!water[to].includes('transparent')) return false;
  // Can't pour from empty tube
  if (water[from].every(l => l === 'transparent')) return false;

  // Top color of source
  const topFrom = getTopColor(water[from]);
  if (!topFrom) return false;

  // Top color of dest (if any)
  const topTo = getTopColor(water[to]);
  if (topTo && topTo !== topFrom) return false;

  // Find the actual top-most non-transparent index in 'from'
  let topFromIdx = -1;
  for (let i = 3; i >= 0; i--) {
    if (water[from][i] !== 'transparent') { topFromIdx = i; break; }
  }
  if (topFromIdx === -1) return false;

  // Count consecutive matching colors downward from topFromIdx
  let countFrom = 0;
  for (let i = topFromIdx; i >= 0; i--) {
    if (water[from][i] === topFrom) countFrom++;
    else break;
  }

  // Available slots in 'to'
  const emptySlots = water[to].filter(l => l === 'transparent').length;
  if (emptySlots === 0) return false;

  // Save snapshot for undo BEFORE mutating state
  const snap = water.map(t => [...t]);
  undoStack.push(snap);

  // How many layers to pour
  const pour = Math.min(countFrom, emptySlots);
  if (pour === 0) { undoStack.pop(); return false; }

  // Remove from 'from' starting at topFromIdx going down
  let removed = 0;
  for (let i = topFromIdx; i >= 0 && removed < pour; i--) {
    if (water[from][i] === topFrom) { water[from][i] = 'transparent'; removed++; }
    else break;
  }

  // Add to 'to' (fill from bottom transparent up)
  let added = 0;
  for (let i = 0; i < 4 && added < pour; i++) {
    if (water[to][i] === 'transparent') { water[to][i] = topFrom; added++; }
  }

  animatePour(from, to, topFrom);
  return true;
}

function getTopColor(tube) {
  for (let i = 3; i >= 0; i--) {
    if (tube[i] !== 'transparent') return tube[i];
  }
  return null;
}

function animatePour(from, to, color) {
  transferring = true;
  const fromEl = document.getElementById(`tube-${from}`);
  const toEl   = document.getElementById(`tube-${to}`);

  if (fromEl) {
    fromEl.style.transition = 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)';
    fromEl.style.transform  = 'translateY(-10px) rotate(-8deg)';
    setTimeout(() => {
      fromEl.style.transform = '';
      fromEl.style.transition = '';
    }, 300);
  }
  if (toEl) {
    setTimeout(() => {
      toEl.style.transition = 'transform 0.2s';
      toEl.style.transform  = 'scale(1.04)';
      setTimeout(() => { toEl.style.transform = ''; toEl.style.transition = ''; }, 200);
    }, 200);
  }
  setTimeout(() => { transferring = false; }, 420);
}

// ─── UNDO ────────────────────────────────────────────────────────────────────
window.UndoMove = function() {
  if (!gameActive) return;
  if (undoStack.length === 0) { showToast('Nothing to undo!'); return; }
  const snap = undoStack.pop();
  if (!snap) { return; } // sentinel
  water = snap.map(t => [...t]);
  if (moves > 0) moves--;
  if ($hudMoves) $hudMoves.textContent = moves;
  clicked = [];
  renderTubes();
  updateProgress();
  showToast('↩ Undone!');
};

// ─── HINT ────────────────────────────────────────────────────────────────────
window.UseHint = function() {
  if (!gameActive) return;
  if (hintsLeft <= 0) { showToast('No hints left! 💡'); return; }

  // Find a valid move
  for (let a = 0; a < water.length; a++) {
    for (let b = 0; b < water.length; b++) {
      if (a === b) continue;
      if (isValidPour(a, b)) {
        // Flash both tubes
        const elA = document.getElementById(`tube-${a}`);
        const elB = document.getElementById(`tube-${b}`);
        [elA, elB].forEach(el => { if (el) el.classList.add('hint-glow'); });
        setTimeout(() => {
          [elA, elB].forEach(el => { if (el) el.classList.remove('hint-glow'); });
        }, 2600);

        hintsLeft--;
        if ($hintCount) $hintCount.textContent = hintsLeft;
        showToast(`💡 Hint: pour tube ${a+1} → tube ${b+1}`, 2500);
        return;
      }
    }
  }
  showToast('No valid moves found — try restarting!', 2500);
};

function isValidPour(from, to) {
  if (!water[to].includes('transparent')) return false;
  if (water[from].every(l => l === 'transparent')) return false;
  const topFrom = getTopColor(water[from]);
  if (!topFrom) return false;
  const topTo = getTopColor(water[to]);
  if (topTo && topTo !== topFrom) return false;
  return true;
}

// ─── RESTART / HOME ──────────────────────────────────────────────────────────
window.RestartLevel = function() {
  if (!currentLevel) return;
  stopTimer();
  water = waterOrig.map(t => [...t]);
  moves = 0;
  clicked = [];
  undoStack = [];
  transferring = false;
  hintsLeft = LEVELS[currentLevel].maxHints;
  if ($hudMoves)    $hudMoves.textContent    = '0';
  if ($hintCount)   $hintCount.textContent   = hintsLeft;
  document.getElementById('win-screen').style.display = 'none';
  document.getElementById('level').style.display = 'block';
  gameActive = true;
  startTimer();
  renderTubes();
  updateProgress();
  showToast('🔄 Level restarted!');
};

window.ShowMenu = function() {
  stopTimer();
  gameActive = false;
  clicked = [];
  document.getElementById('level').style.display = 'none';
  document.getElementById('win-screen').style.display = 'none';
  document.getElementById('menu').style.display = 'block';
  loadStats();
};

// ─── NEXT LEVEL ──────────────────────────────────────────────────────────────
window.NextLevel = function() {
  const idx = LEVEL_ORDER.indexOf(currentLevel);
  if (idx < LEVEL_ORDER.length - 1) {
    document.getElementById('win-screen').style.display = 'none';
    OpenLevel(LEVEL_ORDER[idx + 1]);
  } else {
    document.getElementById('win-screen').style.display = 'none';
    ShowMenu();
    showToast('🏆 You\'ve beaten ALL levels! You\'re a legend!', 4000);
  }
};

// ─── WIN CHECK ───────────────────────────────────────────────────────────────
function checkWin() {
  const solved = water.every(tube => isTubeComplete(tube));
  if (!solved) return;

  stopTimer();
  gameActive = false;

  // Update stats
  const prevWins  = getLS('pg_wins', 0);
  const prevTotal = getLS('pg_total_moves', 0);
  const prevBest  = getLS(`pg_best_${currentLevel}`, null);
  const prevBestLvl = getLS('pg_best_level', null);

  setLS('pg_wins',       prevWins + 1);
  setLS('pg_total_moves', prevTotal + moves);

  if (!prevBest || moves < prevBest) {
    setLS(`pg_best_${currentLevel}`, moves);
  }

  // Best level = highest index cleared
  const curIdx      = LEVEL_ORDER.indexOf(currentLevel);
  const prevBestIdx = prevBestLvl ? LEVEL_ORDER.indexOf(prevBestLvl) : -1;
  if (curIdx > prevBestIdx) setLS('pg_best_level', currentLevel);

  const bestMoves = getLS(`pg_best_${currentLevel}`, moves);

  // Rating
  const par = LEVELS[currentLevel].parMoves;
  let stars = '⭐';
  if (moves <= par * 0.7)       stars = '⭐⭐⭐';
  else if (moves <= par)         stars = '⭐⭐';

  // Show win screen
  setTimeout(() => {
    document.getElementById('win-screen').style.display = 'flex';
    document.getElementById('win-moves').textContent  = moves;
    document.getElementById('win-time').textContent   = formatTime(timerSec);
    document.getElementById('win-best').textContent   = bestMoves;
    document.getElementById('win-rating').textContent = stars;

    // Hide next button if on last level
    const nextBtn = document.querySelector('.win-btn-primary');
    if (nextBtn) {
      const isLast = LEVEL_ORDER.indexOf(currentLevel) === LEVEL_ORDER.length - 1;
      nextBtn.textContent = isLast ? '🏆 All Done!' : 'Next Level ▶';
    }

    launchConfetti();
  }, 600);
}

// ─── PROGRESS BAR ────────────────────────────────────────────────────────────
function updateProgress() {
  if (!$progressBar || !$progressLabel) return;
  const total   = water.length;
  const complete = water.filter(t => isTubeComplete(t)).length;
  const pct = Math.round((complete / total) * 100);
  $progressBar.style.setProperty('--pct', pct + '%');
  // Hack: update ::after width via a real element
  $progressBar.innerHTML = `<div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--neon-cyan),var(--neon-purple));border-radius:10px;transition:width 0.5s cubic-bezier(0.34,1.56,0.64,1);box-shadow:0 0 10px var(--neon-cyan)"></div>`;
  $progressLabel.textContent = pct + '%';
}

// ─── RULES ───────────────────────────────────────────────────────────────────
window.ShowRules = function() {
  const page = document.getElementById('rules-page');
  if (page) page.style.display = 'flex';
};

window.HideRules = function() {
  const page = document.getElementById('rules-page');
  if (page) page.style.display = 'none';
};

// ─── KEYBOARD SHORTCUTS ──────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  switch (e.key) {
    case 'z': case 'Z': UndoMove(); break;
    case 'h': case 'H': UseHint(); break;
    case 'r': case 'R': if (gameActive) RestartLevel(); break;
    case 'Escape':
      if (document.getElementById('rules-page').style.display !== 'none') HideRules();
      else if (gameActive) ShowMenu();
      break;
  }
});

// ─── INIT ─────────────────────────────────────────────────────────────────────
window.addEventListener('load', () => {
  loadStats();

  // Close rules on backdrop click
  document.getElementById('rules-page')?.addEventListener('click', function(e) {
    if (e.target === this) HideRules();
  });

  // Prevent context menu on mobile long-press
  document.addEventListener('contextmenu', e => e.preventDefault());
});