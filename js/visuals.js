// Thornroad — original visual showcase pass: zone banners (SVG line-art in the
// same style as the title mark) shown above the story text, and a small dice-fx
// module that animates the engine's *actual* roll results for luck/charm checks
// and combat rounds. No copyrighted art anywhere — pure geometric/silhouette
// shapes drawn in code, all animation gated behind prefers-reduced-motion.
(function (global) {
  'use strict';

  // ---------------- ZONE BANNERS ----------------
  // Every node id maps to one of five zones so the banner above the story text
  // tracks where the player actually is in the world.
  const ZONE_FOR_NODE = {
    n1: 'forest', n2: 'forest', lc_rockslide: 'forest', lc_rockslide_hurt: 'forest',
    n3: 'forest', n7: 'forest', n8: 'forest', n6: 'forest', n9: 'forest',
    n10: 'forest', n10_win: 'forest', n11: 'forest', n11_win: 'forest',
    n15: 'forest', n16: 'forest', lc_camp: 'forest', n16_rest: 'forest', n17: 'forest',

    n18: 'river', n20: 'river', n25: 'river', n25_caught: 'river', n28: 'river',

    n30: 'courtyard', n33: 'courtyard', n33_sneak: 'courtyard', n33_wake: 'courtyard',
    n33_loot: 'courtyard', n34: 'courtyard', n34_win: 'courtyard', n34_lose: 'courtyard',
    n30_back: 'courtyard', n32: 'courtyard', n32_bluff: 'courtyard', n32_bluff_fail: 'courtyard',
    n32_fight: 'courtyard',

    n40: 'dungeon', n41: 'dungeon', n41_read: 'dungeon', n44: 'dungeon', n44_safe: 'dungeon',
    n44_hurt: 'dungeon', n40_back: 'dungeon', n43: 'dungeon', n45: 'dungeon', n45_locket: 'dungeon',
    lc_flagstone: 'dungeon', lc_flagstone_hurt: 'dungeon', n46: 'dungeon', n46_lens: 'dungeon',
    n46_left: 'dungeon', n46_right: 'dungeon', n46_mid: 'dungeon',

    n50: 'sanctum', n50_talk: 'sanctum', n50_stalled: 'sanctum', n50_flee: 'sanctum',
    n51: 'sanctum', n60: 'sanctum', ending_death: 'sanctum'
  };

  const SVG_NS = 'http://www.w3.org/2000/svg';

  const ZONE_BANNERS = {
    forest: `
      <svg viewBox="0 0 400 96" preserveAspectRatio="xMidYMid meet" class="zone-svg zone-forest" aria-hidden="true">
        <circle cx="336" cy="26" r="13" class="zb-moon"/>
        <g class="zb-pines-back">
          <polygon points="20,88 44,40 68,88"/>
          <polygon points="70,88 96,34 122,88"/>
          <polygon points="230,88 254,42 278,88"/>
          <polygon points="270,88 300,36 330,88"/>
        </g>
        <g class="zb-pines-front">
          <polygon points="-10,90 26,52 62,90"/>
          <polygon points="130,90 166,46 202,90"/>
          <polygon points="190,90 220,56 250,90"/>
          <polygon points="330,90 368,48 406,90"/>
        </g>
        <g class="zb-mist">
          <ellipse cx="90" cy="70" rx="120" ry="9"/>
          <ellipse cx="300" cy="78" rx="140" ry="10"/>
        </g>
      </svg>`,
    river: `
      <svg viewBox="0 0 400 96" preserveAspectRatio="xMidYMid meet" class="zone-svg zone-river" aria-hidden="true">
        <g class="zb-sparks">
          <circle cx="60" cy="12" r="1.2" class="zb-spark zb-spark-a"/>
          <circle cx="140" cy="8" r="1.4" class="zb-spark zb-spark-c"/>
          <circle cx="230" cy="14" r="1.1" class="zb-spark zb-spark-b"/>
        </g>
        <g class="zb-spire-far">
          <path d="M300 66 L308 24 L316 66 M314 66 L324 14 L334 66 M332 66 L340 30 L348 66"/>
        </g>
        <path d="M40 40 L60 50 L40 60" class="zb-bridge-post"/>
        <path d="M360 40 L340 50 L360 60" class="zb-bridge-post"/>
        <line x1="60" y1="50" x2="340" y2="50" class="zb-bridge-rail"/>
        <g class="zb-water">
          <path d="M-20 70 Q 30 62 80 70 T 180 70 T 280 70 T 420 70" class="zb-wave zb-wave-a"/>
          <path d="M-20 82 Q 40 76 90 82 T 190 82 T 290 82 T 420 82" class="zb-wave zb-wave-b"/>
        </g>
      </svg>`,
    courtyard: `
      <svg viewBox="0 0 400 96" preserveAspectRatio="xMidYMid meet" class="zone-svg zone-courtyard" aria-hidden="true">
        <g class="zb-sparks">
          <circle cx="150" cy="6" r="1.1" class="zb-spark zb-spark-b"/>
          <circle cx="200" cy="4" r="1.3" class="zb-spark zb-spark-d"/>
          <circle cx="250" cy="7" r="1" class="zb-spark zb-spark-a"/>
        </g>
        <g class="zb-wall">
          <rect x="0" y="46" width="400" height="44"/>
          <rect x="30" y="10" width="34" height="40"/>
          <rect x="336" y="10" width="34" height="40"/>
          <rect x="0" y="40" width="18" height="8"/><rect x="24" y="40" width="18" height="8"/>
          <rect x="48" y="40" width="18" height="8"/><rect x="72" y="40" width="18" height="8"/>
          <rect x="96" y="40" width="18" height="8"/><rect x="120" y="40" width="18" height="8"/>
          <rect x="144" y="40" width="18" height="8"/><rect x="168" y="40" width="18" height="8"/>
          <rect x="192" y="40" width="18" height="8"/><rect x="216" y="40" width="18" height="8"/>
          <rect x="240" y="40" width="18" height="8"/><rect x="264" y="40" width="18" height="8"/>
          <rect x="288" y="40" width="18" height="8"/><rect x="312" y="40" width="18" height="8"/>
          <rect x="336" y="40" width="18" height="8"/><rect x="360" y="40" width="18" height="8"/>
          <rect x="384" y="40" width="18" height="8"/>
        </g>
        <g class="zb-torch" transform="translate(60,58)">
          <line x1="0" y1="0" x2="0" y2="22" class="zb-torch-stick"/>
          <path d="M-5 -2 Q0 -16 5 -2 Q2 -6 0 -2 Q-2 -6 -5 -2 Z" class="zb-flame"/>
        </g>
        <g class="zb-torch" transform="translate(340,58)">
          <line x1="0" y1="0" x2="0" y2="22" class="zb-torch-stick"/>
          <path d="M-5 -2 Q0 -16 5 -2 Q2 -6 0 -2 Q-2 -6 -5 -2 Z" class="zb-flame zb-flame-b"/>
        </g>
      </svg>`,
    dungeon: `
      <svg viewBox="0 0 400 96" preserveAspectRatio="xMidYMid meet" class="zone-svg zone-dungeon" aria-hidden="true">
        <g class="zb-bars">
          <rect x="40" y="0" width="6" height="96"/><rect x="70" y="0" width="6" height="96"/>
          <rect x="100" y="0" width="6" height="96"/><rect x="130" y="0" width="6" height="96"/>
          <rect x="270" y="0" width="6" height="96"/><rect x="300" y="0" width="6" height="96"/>
          <rect x="330" y="0" width="6" height="96"/><rect x="360" y="0" width="6" height="96"/>
        </g>
        <circle cx="200" cy="46" r="10" class="zb-candle-glow"/>
        <line x1="200" y1="40" x2="200" y2="58" class="zb-candle-stick"/>
        <g class="zb-motes">
          <circle cx="150" cy="70" r="1.6" class="zb-mote zb-mote-a"/>
          <circle cx="210" cy="80" r="1.2" class="zb-mote zb-mote-b"/>
          <circle cx="250" cy="66" r="1.8" class="zb-mote zb-mote-c"/>
          <circle cx="180" cy="60" r="1.3" class="zb-mote zb-mote-d"/>
        </g>
      </svg>`,
    sanctum: `
      <svg viewBox="0 0 400 96" preserveAspectRatio="xMidYMid meet" class="zone-svg zone-sanctum" aria-hidden="true">
        <defs>
          <radialGradient id="zbDaisGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="var(--rust)" stop-opacity="0.55"/>
            <stop offset="100%" stop-color="var(--rust)" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <ellipse cx="200" cy="60" rx="150" ry="18" fill="url(#zbDaisGlow)" class="zb-dais-glow"/>
        <ellipse cx="200" cy="60" rx="90" ry="10" class="zb-dais-rim"/>
        <g class="zb-cracks">
          <path d="M200 60 L170 30"/><path d="M200 60 L232 24"/><path d="M200 60 L150 60"/>
          <path d="M200 60 L250 66"/><path d="M200 60 L196 20"/>
        </g>
        <g class="zb-sparks">
          <circle cx="120" cy="30" r="1.4" class="zb-spark zb-spark-a"/>
          <circle cx="280" cy="24" r="1.6" class="zb-spark zb-spark-b"/>
          <circle cx="330" cy="50" r="1.2" class="zb-spark zb-spark-c"/>
          <circle cx="70" cy="52" r="1.3" class="zb-spark zb-spark-d"/>
        </g>
      </svg>`
  };

  function zoneFor(nodeId) { return ZONE_FOR_NODE[nodeId] || 'forest'; }

  // ---------------- ENDING PLATES ----------------
  // One original illustration per ending type, shown as the book-plate on the
  // ending screen instead of reusing a zone banner.
  const ENDING_BANNERS = {
    victory: `
      <svg viewBox="0 0 350 140" preserveAspectRatio="xMidYMid meet" class="zone-svg zone-ending zone-ending-victory" aria-hidden="true">
        <defs>
          <radialGradient id="zbDawnGlow" cx="50%" cy="62%" r="55%">
            <stop offset="0%" stop-color="var(--gold)" stop-opacity="0.5"/>
            <stop offset="100%" stop-color="var(--gold)" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <ellipse cx="175" cy="95" rx="170" ry="55" fill="url(#zbDawnGlow)" class="zb-dawn-pulse"/>
        <g class="zb-dawn-rays">
          <line x1="175" y1="95" x2="175" y2="20"/>
          <line x1="175" y1="95" x2="110" y2="35"/>
          <line x1="175" y1="95" x2="240" y2="35"/>
          <line x1="175" y1="95" x2="60" y2="60"/>
          <line x1="175" y1="95" x2="290" y2="60"/>
        </g>
        <path d="M100 140 L118 70 L136 140 M130 140 L150 55 L170 140 M164 140 L184 70 L204 140" class="zb-spire-far zb-spire-gold"/>
        <path d="M20 130 C 60 110, 80 132, 120 118 C 150 108, 170 128, 210 116 C 250 106, 270 126, 330 112" class="zb-bloom-vine"/>
        <circle cx="60" cy="118" r="2.4" class="zb-bloom"/>
        <circle cx="150" cy="112" r="2" class="zb-bloom"/>
        <circle cx="240" cy="110" r="2.2" class="zb-bloom"/>
        <circle cx="300" cy="106" r="1.8" class="zb-bloom"/>
      </svg>`,
    retreat: `
      <svg viewBox="0 0 350 140" preserveAspectRatio="xMidYMid meet" class="zone-svg zone-ending zone-ending-retreat" aria-hidden="true">
        <circle cx="290" cy="30" r="14" class="zb-moon"/>
        <g class="zb-pines-back">
          <polygon points="10,140 40,80 70,140"/>
          <polygon points="270,140 300,76 330,140"/>
        </g>
        <path d="M175 140 C 165 110, 190 90, 175 60 C 160 40, 185 25, 175 8" class="zb-retreat-path"/>
        <g class="zb-mist">
          <ellipse cx="90" cy="118" rx="130" ry="10"/>
          <ellipse cx="260" cy="128" rx="150" ry="11"/>
        </g>
      </svg>`,
    death: `
      <svg viewBox="0 0 350 140" preserveAspectRatio="xMidYMid meet" class="zone-svg zone-ending zone-ending-death" aria-hidden="true">
        <g class="zb-cracks zb-cracks-wide">
          <path d="M175 140 L150 100"/><path d="M175 140 L205 95"/><path d="M175 140 L175 80"/>
          <path d="M175 140 L120 130"/><path d="M175 140 L235 132"/>
        </g>
        <line x1="175" y1="36" x2="175" y2="80" class="zb-candle-stick"/>
        <circle cx="175" cy="30" r="12" class="zb-candle-glow zb-candle-glow-dim"/>
        <path d="M171 26 Q175 12 179 26 Q177 20 175 26 Q173 20 171 26 Z" class="zb-flame zb-flame-dying"/>
        <path d="M60 140 C 80 132, 70 118, 90 112 C 105 108, 95 96, 112 92" class="zb-wilt-vine"/>
        <path d="M290 140 C 270 132, 280 118, 260 112 C 245 108, 255 96, 238 92" class="zb-wilt-vine"/>
      </svg>`
  };

  // ---------------- DICE FX ----------------
  // Pip layouts for a standard d6 face, 1-6.
  const PIPS = {
    1: [[50, 50]],
    2: [[28, 28], [72, 72]],
    3: [[28, 28], [50, 50], [72, 72]],
    4: [[28, 28], [72, 28], [28, 72], [72, 72]],
    5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
    6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]]
  };

  function dieFaceSVG(value, extraClass) {
    const pips = PIPS[Math.max(1, Math.min(6, value))] || PIPS[1];
    const dots = pips.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7"/>`).join('');
    return `<svg viewBox="0 0 100 100" class="die-face ${extraClass || ''}"><rect x="4" y="4" width="92" height="92" rx="16"/>${dots}</svg>`;
  }

  function prefersReducedMotion() {
    try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
  }

  // Rolls one animated d6 that settles on `finalValue`. Resolves when done.
  function rollDie(container, finalValue, opts) {
    opts = opts || {};
    const label = opts.label;
    return new Promise(resolve => {
      const wrap = document.createElement('div');
      wrap.className = 'dice-stage';
      if (label) {
        const l = document.createElement('div');
        l.className = 'dice-label';
        l.textContent = label;
        wrap.appendChild(l);
      }
      const dieHost = document.createElement('div');
      dieHost.className = 'die-host';
      wrap.appendChild(dieHost);
      container.appendChild(wrap);

      if (prefersReducedMotion()) {
        dieHost.innerHTML = dieFaceSVG(finalValue, 'die-settled');
        setTimeout(() => resolve(wrap), 150);
        return;
      }

      let tick = 0;
      const totalTicks = 9;
      const interval = setInterval(() => {
        tick++;
        const face = tick >= totalTicks ? finalValue : (1 + Math.floor(Math.random() * 6));
        dieHost.innerHTML = dieFaceSVG(face, tick >= totalTicks ? 'die-settled' : 'die-tumbling');
        if (tick >= totalTicks) {
          clearInterval(interval);
          setTimeout(() => resolve(wrap), 200);
        }
      }, 70);
    });
  }

  // Rolls two animated d6 side by side, settling on `a` and `b`. Resolves when done.
  function rollTwoDice(container, a, b, opts) {
    opts = opts || {};
    return new Promise(resolve => {
      const wrap = document.createElement('div');
      wrap.className = 'dice-stage';
      if (opts.label) {
        const l = document.createElement('div');
        l.className = 'dice-label';
        l.textContent = opts.label;
        wrap.appendChild(l);
      }
      const pair = document.createElement('div');
      pair.className = 'die-pair';
      const hostA = document.createElement('div'); hostA.className = 'die-host';
      const hostB = document.createElement('div'); hostB.className = 'die-host';
      pair.appendChild(hostA); pair.appendChild(hostB);
      wrap.appendChild(pair);
      container.appendChild(wrap);

      if (prefersReducedMotion()) {
        hostA.innerHTML = dieFaceSVG(a, 'die-settled');
        hostB.innerHTML = dieFaceSVG(b, 'die-settled');
        setTimeout(() => resolve(wrap), 150);
        return;
      }

      let tick = 0;
      const totalTicks = 9;
      const interval = setInterval(() => {
        tick++;
        const done = tick >= totalTicks;
        hostA.innerHTML = dieFaceSVG(done ? a : (1 + Math.floor(Math.random() * 6)), done ? 'die-settled' : 'die-tumbling');
        hostB.innerHTML = dieFaceSVG(done ? b : (1 + Math.floor(Math.random() * 6)), done ? 'die-settled' : 'die-tumbling');
        if (done) {
          clearInterval(interval);
          setTimeout(() => resolve(wrap), 200);
        }
      }, 70);
    });
  }

  // Combat "power clash": ticks up to the real playerPower/enemyPower numbers
  // (each = 1 die * 2 + skill, the engine's real combat-roll formula) and
  // flashes whichever side actually won that exchange.
  function rollPowerClash(container, playerPower, enemyPower, opts) {
    opts = opts || {};
    return new Promise(resolve => {
      const wrap = document.createElement('div');
      wrap.className = 'clash-stage';
      const you = document.createElement('div'); you.className = 'clash-tile clash-you';
      const vs = document.createElement('div'); vs.className = 'clash-vs'; vs.textContent = opts.vsLabel || 'vs';
      const foe = document.createElement('div'); foe.className = 'clash-tile clash-foe';
      wrap.appendChild(you); wrap.appendChild(vs); wrap.appendChild(foe);
      container.appendChild(wrap);

      const settle = () => {
        you.textContent = playerPower;
        foe.textContent = enemyPower;
        if (playerPower > enemyPower) you.classList.add('clash-win');
        else if (enemyPower > playerPower) foe.classList.add('clash-win');
        else { you.classList.add('clash-tie'); foe.classList.add('clash-tie'); }
      };

      if (prefersReducedMotion()) { settle(); setTimeout(() => resolve(wrap), 120); return; }

      let tick = 0;
      const totalTicks = 7;
      const interval = setInterval(() => {
        tick++;
        if (tick >= totalTicks) {
          clearInterval(interval);
          settle();
          setTimeout(() => resolve(wrap), 260);
        } else {
          you.textContent = 2 + Math.floor(Math.random() * 16);
          foe.textContent = 2 + Math.floor(Math.random() * 16);
        }
      }, 55);
    });
  }

  global.Thornroad = global.Thornroad || {};
  global.Thornroad.ZONE_FOR_NODE = ZONE_FOR_NODE;
  global.Thornroad.ZONE_BANNERS = ZONE_BANNERS;
  global.Thornroad.ENDING_BANNERS = ENDING_BANNERS;
  global.Thornroad.zoneFor = zoneFor;
  global.Thornroad.DiceFX = { rollDie, rollTwoDice, rollPowerClash, prefersReducedMotion };
})(window);
