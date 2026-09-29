// Thornroad — 90s point-and-click style location art (think Legend of
// Kyrandia): every location is a small 320x140 "VGA" painting drawn in code
// with limited palettes, ordered (Bayer) dithering and hand-placed light, then
// scaled up with crisp pixels. Each scene has a few idle animations — torch
// flames, water shimmer, fireflies, blinking eyes — stepped at a low frame
// rate the way old adventure games animated. No image files, no copyrighted
// art: everything below is original and generated at runtime.
(function (global) {
  'use strict';

  const W = 320, H = 140;
  const FPS = 12;

  // ---------------- palette + dithering primitives ----------------
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]].map(r => r.map(v => (v + 0.5) / 16));
  const B = (x, y) => BAYER[y & 3][x & 3];
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

  function packed(hex) {
    const n = parseInt(hex.slice(1), 16);
    return (0xff << 24) | ((n & 0xff) << 16) | (n & 0xff00) | (n >> 16);
  }
  // Pick a colour from a ramp (dark → light) at v∈[0,1], dithering between neighbours.
  function rampPick(cols, v, x, y) {
    const t = clamp01(v) * (cols.length - 1);
    const i = Math.floor(t);
    return cols[Math.min(cols.length - 1, (t - i) > B(x, y) ? i + 1 : i)];
  }
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Painter: draws the static base layer into a 32-bit pixel buffer.
  function Painter(seed) {
    const buf = new Uint32Array(W * H);
    const R = rng(seed || 1);
    const P = {
      W, H, rand: R, buf,
      set(x, y, c) {
        x |= 0; y |= 0;
        if (x < 0 || y < 0 || x >= W || y >= H) return;
        buf[y * W + x] = typeof c === 'string' ? packed(c) : c;
      },
      rect(x, y, w, h, c) {
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) P.set(x + i, y + j, c);
      },
      // Fill a box with a dithered vertical gradient through a colour ramp.
      vgrad(x, y, w, h, cols) {
        for (let j = 0; j < h; j++) {
          const v = h > 1 ? j / (h - 1) : 0;
          for (let i = 0; i < w; i++) P.set(x + i, y + j, rampPick(cols, v, x + i, y + j));
        }
      },
      // Sparse "screen door" fill — the classic way VGA games faked translucency.
      dith(x, y, w, h, c, level) {
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
          if (B(x + i, y + j) < level) P.set(x + i, y + j, c);
        }
      },
      line(x0, y0, x1, y1, c) {
        x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
        const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        for (;;) {
          P.set(x0, y0, c);
          if (x0 === x1 && y0 === y1) break;
          const e2 = 2 * err;
          if (e2 >= dy) { err += dy; x0 += sx; }
          if (e2 <= dx) { err += dx; y0 += sy; }
        }
      },
      // Scanline polygon fill. `shade(x,y)` may return a colour per pixel.
      poly(pts, c) {
        let minY = Infinity, maxY = -Infinity;
        pts.forEach(p => { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); });
        for (let y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
          const yc = y + 0.5, xs = [];
          for (let i = 0; i < pts.length; i++) {
            const a = pts[i], b = pts[(i + 1) % pts.length];
            if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) {
              xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
            }
          }
          xs.sort((p, q) => p - q);
          for (let k = 0; k + 1 < xs.length; k += 2) {
            for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) {
              P.set(x, y, typeof c === 'function' ? c(x, y) : c);
            }
          }
        }
      },
      // Filled ellipse, optionally shaded as a lit sphere (light from upper-left).
      ellipse(cx, cy, rx, ry, c, ramp) {
        for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
          for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
            const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
            const d = nx * nx + ny * ny;
            if (d > 1) continue;
            if (ramp) {
              const v = 0.5 + (-nx * 0.45 - ny * 0.55) * 0.75 - d * 0.15;
              P.set(x, y, rampPick(ramp, v, x, y));
            } else P.set(x, y, c);
          }
        }
      },
      // Dithered light pool — dense in the centre, speckled at the edge.
      glow(cx, cy, rx, ry, c, strength) {
        ry = ry || rx; strength = strength == null ? 1 : strength;
        for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
          for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
            const nx = (x - cx) / rx, ny = (y - cy) / ry;
            const d = Math.sqrt(nx * nx + ny * ny);
            if (d >= 1) continue;
            if (Math.pow(1 - d, 1.6) * strength > B(x, y)) P.set(x, y, c);
          }
        }
      },
      // Sprinkle pixels of `c` over existing pixels in a box — bark, grain, moss.
      speckle(x, y, w, h, c, density) {
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (R() < density) P.set(x + i, y + j, c);
      }
    };
    return P;
  }

  // ---------------- reusable scenery pieces ----------------
  // Rolling silhouette line (hills, far treelines) filled down to `bottom`.
  function ridge(P, baseY, amp, freq, phase, cols, bottom, bumpy) {
    for (let x = 0; x < W; x++) {
      let h = Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 2.7 + phase * 1.9) * amp * 0.35;
      if (bumpy) h += Math.abs(Math.sin(x * 0.45 + phase * 3)) * bumpy;
      const top = Math.round(baseY - h);
      for (let y = top; y < bottom; y++) {
        const v = 1 - (y - top) / Math.max(1, bottom - top);
        P.set(x, y, rampPick(cols, v * 0.9, x, y));
      }
    }
  }

  // Tiered conifer, lit from the left.
  function pine(P, x, by, h, cols, trunk) {
    const trunkH = Math.max(2, Math.round(h * 0.12));
    P.rect(x - 1, by - trunkH, 2 + (h > 30 ? 1 : 0), trunkH, trunk || cols[0]);
    const top = by - h, bodyH = h - trunkH;
    const tiers = Math.max(3, Math.round(h / 10));
    for (let y = top; y < by - trunkH; y++) {
      const r = (y - top) / bodyH;
      const tierPos = (r * tiers) % 1;
      const hw = (0.35 + 0.65 * tierPos) * (1 + r * h * 0.26);
      const iw = Math.round(hw);
      for (let dx = -iw; dx <= iw; dx++) {
        const s = dx / (hw + 0.01);
        const v = 0.62 - s * 0.38 - tierPos * 0.32 + (r < 0.08 ? 0.2 : 0);
        P.set(x + dx, y, rampPick(cols, v, x + dx, y));
      }
    }
  }

  // Leafy canopy made of overlapping lit blobs.
  function canopy(P, cx, cy, spread, size, count, ramp) {
    for (let i = 0; i < count; i++) {
      const a = P.rand() * Math.PI * 2, d = P.rand() * spread;
      const r = size * (0.6 + P.rand() * 0.6);
      P.ellipse(cx + Math.cos(a) * d * 1.4, cy + Math.sin(a) * d * 0.7, r, r * 0.8, null, ramp);
    }
  }

  // A thick, knotted trunk with bark texture.
  function trunk(P, x, top, bottom, w, ramp) {
    for (let y = top; y < bottom; y++) {
      const flare = y > bottom - 8 ? (y - (bottom - 8)) * 0.7 : 0;
      const sway = Math.sin(y * 0.05 + x) * 1.2;
      const x0 = Math.round(x - w / 2 - flare + sway), x1 = Math.round(x + w / 2 + flare + sway);
      for (let i = x0; i <= x1; i++) {
        const s = (i - x0) / Math.max(1, x1 - x0);
        let v = 0.85 - s * 0.9 + (s < 0.18 ? 0.1 : 0);
        if (((i * 7 + y * 3) % 11 === 0) || P.rand() < 0.06) v -= 0.3;
        P.set(i, y, rampPick(ramp, v, i, y));
      }
    }
  }

  // Masonry with lit top-left and shaded bottom-right edges.
  function bricks(P, x, y, w, h, bw, bh, ramp, mortar) {
    for (let row = 0, by = y; by < y + h; row++, by += bh) {
      const off = (row % 2) * Math.floor(bw / 2);
      for (let bx = x - off; bx < x + w; bx += bw) {
        const tone = 0.3 + P.rand() * 0.25;
        for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
          const px = bx + i, py = by + j;
          if (px < x || px >= x + w || py >= y + h) continue;
          let c;
          if (j === bh - 1 || i === bw - 1) c = mortar;
          else if (j === 0 || i === 0) c = rampPick(ramp, tone + 0.35, px, py);
          else if (j === bh - 2 || i === bw - 2) c = rampPick(ramp, tone - 0.2, px, py);
          else c = rampPick(ramp, tone + (((px * 7 + py * 13) % 17) === 0 ? -0.15 : 0), px, py);
          P.set(px, py, c);
        }
      }
    }
  }

  function stars(P, count, maxY, cols) {
    for (let i = 0; i < count; i++) {
      P.set(P.rand() * W, P.rand() * maxY, cols[Math.floor(P.rand() * cols.length)]);
    }
  }

  function grassTufts(P, y0, y1, count, cols) {
    for (let i = 0; i < count; i++) {
      const x = Math.floor(P.rand() * W), y = Math.floor(y0 + P.rand() * (y1 - y0));
      const c = cols[Math.floor(P.rand() * cols.length)];
      P.set(x, y, c); P.set(x - 1, y + 1, c); P.set(x + 1, y + 1, c);
      if (P.rand() < 0.5) P.set(x, y - 1, c);
    }
  }

  function fern(P, x, y, len, dir, c1, c2) {
    for (let i = 0; i < len; i++) {
      const px = x + i * dir, py = y - Math.round(Math.sin(i / len * Math.PI) * len * 0.4);
      P.set(px, py, c1);
      if (i % 2 === 0 && i < len - 2) {
        P.set(px, py - 1, c2); P.set(px, py - 2, c2);
        P.set(px + dir, py + 1, c1); P.set(px + dir, py + 2, c1);
      }
    }
  }

  function torchBracket(P, x, y) {
    P.rect(x - 1, y, 3, 7, '#2a1c14');
    P.rect(x - 2, y - 1, 5, 2, '#4a3526');
    P.set(x - 2, y - 1, '#6e5238');
  }

  function door(P, x, y, w, h, ramp, arch) {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        if (arch) {
          const cx = w / 2 - 0.5, r = w / 2;
          if (j < r) { const dx = i - cx, dy = r - j; if (dx * dx + dy * dy > r * r) continue; }
        }
        const plank = i % 5 === 4;
        const v = plank ? 0.1 : 0.45 + ((i * 13 + j * 7) % 9 === 0 ? -0.15 : 0) - i / w * 0.2;
        P.set(x + i, y + j, rampPick(ramp, v, x + i, y + j));
      }
    }
    // iron bands + studs
    [Math.floor(h * 0.35), Math.floor(h * 0.75)].forEach(by => {
      P.rect(x, y + by, w, 2, '#1c1c24');
      for (let i = 1; i < w - 1; i += 4) P.set(x + i, y + by, '#5a5a6a');
    });
  }

  // ---------------- animation helpers (draw on the display canvas) ----------------
  function mkAnim(ctx) {
    const A = {
      px(x, y, c) { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, 1, 1); },
      rect(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w, h); },
      glow(cx, cy, rx, ry, c, strength) {
        ctx.fillStyle = c;
        for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
          for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
            const nx = (x - cx) / rx, ny = (y - cy) / ry;
            const d = Math.sqrt(nx * nx + ny * ny);
            if (d < 1 && Math.pow(1 - d, 1.6) * strength > B(x, y)) ctx.fillRect(x, y, 1, 1);
          }
        }
      },
      // A little licking flame: columns of heat that jitter each frame.
      flame(x, y, size, f, seed) {
        const cols = ['#7a1e0e', '#d2451c', '#f28a24', '#ffd35a', '#fff6c8'];
        const w = Math.max(2, Math.round(size * 0.6));
        for (let i = -w; i <= w; i++) {
          const n = Math.sin(f * 1.9 + i * 1.7 + seed) * 0.5 + Math.sin(f * 3.1 + i * 0.9 + seed * 2) * 0.5;
          const hgt = Math.max(1, Math.round(size * (1 - Math.abs(i) / (w + 1)) * (0.75 + n * 0.3)));
          for (let j = 0; j < hgt; j++) {
            const v = (1 - j / hgt) * (1 - Math.abs(i) / (w + 1.5));
            A.px(x + i, y - j, cols[Math.min(4, Math.floor(v * 5.2))]);
          }
        }
      }
    };
    return A;
  }

  // Deterministic per-particle pseudo-random so animations loop without state.
  const hash = n => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };

  function torchAnim(A, f, x, y, seed) {
    A.glow(x, y - 3, 16 + Math.sin(f * 0.9 + seed) * 2, 14, '#8a4a1e', 0.35);
    A.glow(x, y - 3, 8, 7, '#d27a2a', 0.45);
    A.flame(x, y, 6, f, seed);
  }

  function motes(A, f, n, box, cols, seed) {
    for (let i = 0; i < n; i++) {
      const sp = 0.15 + hash(i + seed) * 0.25;
      const x = box[0] + ((hash(i * 3 + seed) * box[2] + Math.sin(f * 0.07 + i) * 6 + f * sp * 0.4) % box[2]);
      const y = box[1] + ((hash(i * 7 + seed) * box[3] - f * sp) % box[3] + box[3]) % box[3];
      if (Math.sin(f * 0.2 + i * 2.3) > -0.3) A.px(x, y, cols[i % cols.length]);
    }
  }

  function fireflies(A, f, n, box, seed) {
    for (let i = 0; i < n; i++) {
      const x = box[0] + hash(i + seed) * box[2] + Math.sin(f * 0.05 + i * 1.3) * 10;
      const y = box[1] + hash(i * 5 + seed) * box[3] + Math.cos(f * 0.07 + i * 2.1) * 5;
      const on = Math.sin(f * 0.18 + i * 1.7);
      if (on > 0.1) {
        A.px(x, y, '#fff7a8');
        if (on > 0.6) { A.px(x - 1, y, '#9fbf3a'); A.px(x + 1, y, '#9fbf3a'); A.px(x, y - 1, '#9fbf3a'); A.px(x, y + 1, '#9fbf3a'); }
      }
    }
  }

  function blinkEyes(A, f, x, y, c, seed, gap) {
    const cycle = (f + seed * 13) % 60;
    if (cycle < 2) return; // blink
    if ((f + seed * 7) % 200 > 150) return; // sometimes they look away
    A.px(x, y, c); A.px(x + (gap || 3), y, c);
  }

  // ---------------- shared backdrops ----------------
  const R_LEAF = ['#0f2216', '#1d3a1f', '#2f5a28', '#4d8a34', '#86b848'];
  const R_LEAF_FAR = ['#1d3a3a', '#2a5048', '#3a6a58', '#5a8a6a'];
  const R_BARK = ['#1e120c', '#3a2418', '#5c3a24', '#86603c', '#a8844e'];
  const R_STONE = ['#1c1a24', '#34303e', '#4e4858', '#6e6878', '#9690a0'];
  const R_STONE_WARM = ['#1c1614', '#3a2e2a', '#5a4a40', '#7e6a58', '#a8927a'];

  function forestBackdrop(P, opts) {
    opts = opts || {};
    // sky glimpsed through the canopy
    P.vgrad(0, 0, W, 80, opts.sky || ['#2c5a70', '#4a8a8a', '#8ec0a0', '#d8e8a8']);
    // far haze trees
    ridge(P, 62, 6, 0.06, 1.3, R_LEAF_FAR, 100, 5);
    for (let i = 0; i < 9; i++) canopy(P, 18 + i * 36 + P.rand() * 12, 44 + P.rand() * 10, 10, 11, 5, R_LEAF_FAR);
    // light fog band
    P.dith(0, 66, W, 20, '#a8c8a8', 0.18);
    // ground
    P.vgrad(0, 92, W, 48, ['#5a8a34', '#3a6a28', '#244a1c', '#14301a']);
    grassTufts(P, 94, 140, 260, ['#6aa03a', '#86b848', '#1d3a1f']);
    // mid trunks
    const trunks = opts.trunks || [[44, 10], [118, 7], [212, 8], [276, 12]];
    trunks.forEach(t => trunk(P, t[0], 0, 98 + (t[1] > 9 ? 4 : 0), t[1], R_BARK));
    // canopy ceiling
    for (let i = 0; i < 14; i++) canopy(P, i * 24 + P.rand() * 10, 6 + P.rand() * 12, 12, 13, 6, R_LEAF);
  }

  function forestFrame(P) {
    // dark foreground framing, very Kyrandia: silhouettes cut the edges of the painting
    trunk(P, 6, 0, 140, 14, ['#07100a', '#0f1a10', '#1c2a18', '#2e3e22']);
    trunk(P, 314, 0, 140, 16, ['#07100a', '#0f1a10', '#1c2a18', '#2e3e22']);
    for (let i = 0; i < 6; i++) {
      fern(P, 4 + i * 5, 138 - i, 18 + i * 2, 1, '#0a1a0c', '#1d3a1f');
      fern(P, 316 - i * 5, 138 - i, 18 + i * 2, -1, '#0a1a0c', '#1d3a1f');
    }
    canopy(P, 0, 0, 12, 16, 6, ['#050c07', '#0f2216', '#1d3a1f']);
    canopy(P, 320, 4, 12, 16, 6, ['#050c07', '#0f2216', '#1d3a1f']);
  }

  function lightShafts(A, f, shafts) {
    shafts.forEach((s, k) => {
      const level = 0.1 + (Math.sin(f * 0.05 + k * 1.7) * 0.5 + 0.5) * 0.12;
      for (let y = 0; y < s[2]; y++) {
        const x0 = s[0] + y * s[3];
        for (let i = 0; i < s[1]; i++) if (B(x0 + i, y) < level * (1 - y / s[2] * 0.6)) A.px(x0 + i, y, '#f4f0b8');
      }
    });
  }

  function interiorWalls(P, ramp) {
    bricks(P, 0, 0, W, 110, 16, 8, ramp, '#0e0c12');
    P.vgrad(0, 104, W, 36, ['#2a2630', '#1c1a22', '#0e0c12']);
    for (let x = 0; x < W; x += 20) P.line(x, 104, x - (x - 160) * 0.35, 140, '#0e0c12');
    [110, 118, 128].forEach(y => P.line(0, y, W, y, '#0e0c12'));
  }

  // ---------------- the scenes ----------------
  const SCENES = {
    forest: {
      seed: 11,
      paint(P) {
        forestBackdrop(P);
        // winding dirt road
        P.poly([[146, 96], [174, 96], [210, 118], [250, 140], [96, 140], [134, 116]], (x, y) => rampPick(['#4a321e', '#6e4e2e', '#94704a', '#b89468'], 0.35 + (y - 96) / 80 + (x % 7 === 0 ? -0.2 : 0), x, y));
        P.speckle(100, 110, 140, 30, '#c8a878', 0.03);
        // boundary stone
        P.poly([[190, 104], [192, 90], [199, 88], [203, 104]], (x, y) => rampPick(R_STONE, 0.75 - (x - 190) / 14, x, y));
        P.dith(190, 88, 8, 5, '#4d8a34', 0.5);
        forestFrame(P);
      },
      anim(A, f) {
        lightShafts(A, f, [[70, 10, 100, 0.35], [150, 8, 96, 0.3], [236, 12, 100, 0.4]]);
        motes(A, f, 18, [40, 20, 240, 80], ['#f4f0b8', '#d8e8a8'], 3);
        // a falling leaf
        const t = f % 160, lx = 90 + t * 0.9 + Math.sin(t * 0.2) * 6, ly = t * 0.75;
        if (ly < 128) { A.px(lx, ly, '#c88a2e'); A.px(lx + 1, ly, '#a8641e'); }
      }
    },

    waystone: {
      seed: 23,
      paint(P) {
        forestBackdrop(P, { trunks: [[30, 9], [96, 7], [240, 7], [292, 11]] });
        // forked paths meeting at the stone
        P.poly([[150, 104], [170, 104], [196, 140], [124, 140]], '#6e4e2e');
        P.poly([[150, 104], [156, 104], [70, 96], [60, 98]], '#5c3e24');
        P.poly([[164, 104], [170, 104], [264, 98], [256, 96]], '#5c3e24');
        P.speckle(120, 100, 90, 40, '#94704a', 0.12);
        // the Waystone: a leaning slab with a worn face
        P.glow(160, 104, 40, 8, '#1d3a1f', 0.9);
        P.poly([[142, 106], [146, 58], [158, 50], [172, 54], [178, 106]], (x, y) => {
          const v = 0.78 - (x - 142) / 44 + ((x * 5 + y * 3) % 13 === 0 ? -0.15 : 0);
          return rampPick(R_STONE, v, x, y);
        });
        P.dith(144, 50, 24, 14, '#4d8a34', 0.45);
        P.dith(142, 60, 8, 40, '#2f5a28', 0.3);
        // carved face — sockets, nose, mouth
        P.rect(151, 70, 5, 3, '#1c1a24'); P.rect(163, 70, 5, 3, '#1c1a24');
        P.set(150, 69, '#6e6878'); P.set(162, 69, '#6e6878');
        P.line(159, 72, 158, 80, '#34303e'); P.line(160, 72, 160, 80, '#9690a0');
        P.rect(153, 86, 13, 2, '#1c1a24'); P.rect(155, 88, 9, 1, '#34303e');
        [96, 100].forEach(y => P.line(146, y, 176, y - 1, '#34303e'));
        forestFrame(P);
      },
      anim(A, f) {
        lightShafts(A, f, [[134, 16, 60, 0.25]]);
        const p = Math.sin(f * 0.12) * 0.5 + 0.5;
        A.glow(153, 71, 5, 3, '#c9a24b', 0.3 + p * 0.5);
        A.glow(165, 71, 5, 3, '#c9a24b', 0.3 + p * 0.5);
        if (p > 0.4) { A.px(153, 71, '#ffe08a'); A.px(165, 71, '#ffe08a'); }
        motes(A, f, 14, [60, 30, 200, 70], ['#f4f0b8'], 9);
      }
    },

    peddler: {
      seed: 37,
      paint(P) {
        forestBackdrop(P, { trunks: [[40, 9], [262, 10]] });
        P.poly([[0, 108], [320, 104], [320, 122], [0, 126]], '#6e4e2e');
        P.speckle(0, 104, W, 22, '#94704a', 0.12);
        // cart
        P.rect(206, 86, 60, 18, '#5c3a24'); P.rect(206, 86, 60, 2, '#86603c');
        for (let i = 210; i < 266; i += 8) P.rect(i, 88, 1, 16, '#3a2418');
        P.line(266, 100, 296, 108, '#3a2418');
        P.ellipse(222, 106, 9, 9, '#3a2418'); P.ellipse(222, 106, 7, 7, '#86603c'); P.ellipse(222, 106, 5, 5, '#1e120c');
        for (let a = 0; a < 6; a++) P.line(222, 106, 222 + Math.cos(a) * 6, 106 + Math.sin(a) * 6, '#86603c');
        P.ellipse(222, 106, 1.5, 1.5, '#a8844e');
        // striped awning on poles
        P.rect(92, 56, 2, 54, '#3a2418'); P.rect(186, 56, 2, 54, '#3a2418');
        P.poly([[84, 52], [196, 52], [204, 68], [76, 68]], (x) => (Math.floor((x - 76) / 10) % 2 ? '#e8dcb8' : '#b8342a'));
        P.line(84, 52, 196, 52, '#f8f0d8');
        for (let x = 76; x < 204; x += 10) P.ellipse(x + 5, 69, 5, 3, null, Math.floor((x - 76) / 10) % 2 ? ['#b8aa88', '#e8dcb8'] : ['#7a1e18', '#b8342a']);
        P.dith(90, 72, 100, 10, '#0f2216', 0.5);
        // folding table + goods
        P.rect(100, 90, 80, 4, '#86603c'); P.rect(100, 94, 80, 2, '#3a2418');
        P.rect(104, 96, 2, 14, '#3a2418'); P.rect(174, 96, 2, 14, '#3a2418');
        const goods = [['#3a6ac8', '#8ab0f0'], ['#2f8a4a', '#86d08a'], ['#b8342a', '#f08a6a'], ['#c9a24b', '#fff0a0'], ['#6a3a8a', '#b88ad8']];
        goods.forEach((g, i) => {
          const gx = 108 + i * 14;
          P.rect(gx, 81, 7, 9, g[0]); P.rect(gx + 1, 79, 5, 2, '#86603c'); P.rect(gx + 1, 82, 1, 5, g[1]);
        });
        P.ellipse(178, 86, 5, 4, null, ['#6e4e2e', '#94704a', '#c8a878']);
        // Pell, a round figure under the awning
        P.ellipse(142, 70 + 6, 7, 8, null, ['#2a1c30', '#4a3060', '#6a4a8a']);
        P.ellipse(142, 64 + 3, 4, 4, null, ['#8a5a3a', '#c88a5a', '#e8b080']);
        P.rect(137, 62, 11, 2, '#4a3060'); P.rect(139, 58, 7, 4, '#6a4a8a');
        forestFrame(P);
      },
      anim(A, f) {
        // hanging lantern
        const sw = Math.round(Math.sin(f * 0.15) * 1);
        A.rect(180 + sw, 70, 1, 4, '#3a2418');
        A.glow(180 + sw, 77, 12, 10, '#c9a24b', 0.35 + Math.sin(f * 0.8) * 0.05);
        A.rect(178 + sw, 74, 5, 6, '#ffd35a'); A.rect(179 + sw, 75, 3, 4, '#fff6c8');
        // pipe smoke from Pell
        for (let i = 0; i < 6; i++) {
          const t = (f * 0.5 + i * 8) % 48;
          A.px(148 + Math.sin(t * 0.2 + i) * 3 + t * 0.2, 66 - t, t < 30 ? '#d8d0c0' : '#8a8a80');
        }
        motes(A, f, 10, [40, 20, 240, 60], ['#f4f0b8'], 5);
      }
    },

    camp: {
      seed: 41,
      paint(P) {
        P.vgrad(0, 0, W, 90, ['#05060f', '#0a0e24', '#161c44', '#24285a']);
        stars(P, 90, 70, ['#8a90c0', '#c8d0f0', '#5a6090']);
        P.ellipse(252, 22, 9, 9, null, ['#8a8a9a', '#c8c8d0', '#f0f0e8']);
        P.set(249, 20, '#8a8a9a'); P.set(254, 25, '#a8a8b8');
        ridge(P, 70, 6, 0.05, 0.4, ['#0a1020', '#141c34', '#1e2848'], 100, 3);
        for (let i = 0; i < 16; i++) pine(P, 6 + i * 21 + P.rand() * 8, 94, 30 + P.rand() * 26, ['#050a10', '#0c1620', '#16263a'], '#050a10');
        P.vgrad(0, 92, W, 48, ['#101a14', '#0c140e', '#060a08']);
        grassTufts(P, 94, 140, 120, ['#1a2a1c', '#0a140c']);
        // warm pool of firelight on the ground
        P.glow(160, 116, 90, 22, '#2a2014', 0.95);
        P.glow(160, 116, 60, 15, '#4a3218', 0.85);
        P.glow(160, 116, 34, 9, '#7a4a1e', 0.8);
        // ring of stones + logs
        for (let a = 0; a < Math.PI * 2; a += 0.55) P.ellipse(160 + Math.cos(a) * 14, 118 + Math.sin(a) * 4, 3, 2, null, R_STONE);
        P.line(150, 118, 170, 114, '#3a2418'); P.line(150, 117, 170, 113, '#86603c');
        P.line(152, 113, 168, 119, '#3a2418'); P.line(152, 112, 168, 118, '#5c3a24');
        // bedroll + pack
        P.poly([[196, 124], [240, 122], [244, 130], [200, 132]], (x, y) => rampPick(['#2a1a28', '#5a2a3a', '#8a3a4a'], 0.8 - (y - 122) / 12, x, y));
        P.ellipse(110, 122, 7, 6, null, ['#2a1c14', '#5c3a24', '#86603c']);
        pine(P, 16, 140, 70, ['#020406', '#060a10'], '#020406');
        pine(P, 306, 140, 80, ['#020406', '#060a10'], '#020406');
      },
      anim(A, f) {
        const flick = Math.sin(f * 0.9) * 2 + Math.sin(f * 2.3);
        A.glow(160, 106, 26 + flick, 20 + flick, '#6a3a18', 0.35);
        A.glow(160, 108, 13, 10, '#c86a24', 0.4);
        A.flame(160, 115, 11, f, 0);
        A.flame(155, 116, 6, f, 2);
        A.flame(165, 116, 7, f, 4);
        for (let i = 0; i < 7; i++) {
          const t = (f * 1.2 + i * 11) % 60;
          A.px(160 + Math.sin(t * 0.15 + i * 2) * (4 + t * 0.2), 104 - t, t < 30 ? '#ffd35a' : '#c86a24');
        }
        for (let i = 0; i < 90; i += 9) if (Math.sin(f * 0.1 + i) > 0.7) A.px(hash(i + 1) * W, hash(i + 2) * 60, '#ffffff');
        // things watching from the treeline
        blinkEyes(A, f, 58, 98, '#e8d040', 1);
        blinkEyes(A, f, 266, 95, '#e8d040', 4);
        blinkEyes(A, f, 238, 101, '#c84030', 7, 2);
      }
    },

    river: {
      seed: 53,
      paint(P) {
        P.vgrad(0, 0, W, 72, ['#1a1030', '#3a1a48', '#7a2a52', '#c04a44', '#f08a44', '#ffc870']);
        stars(P, 20, 24, ['#8a70b0']);
        ridge(P, 60, 4, 0.03, 2.2, ['#1e1030', '#3a2048', '#5a3060'], 80, 0);
        // the Cinder Spire on its crag
        P.poly([[188, 80], [206, 54], [248, 50], [270, 80]], (x, y) => rampPick(['#0a0610', '#1a1020', '#2e1e34'], 0.6 - (x - 188) / 100, x, y));
        const spire = (x, w, top) => {
          P.rect(x, top, w, 60 - top, '#0e0a14');
          P.rect(x, top, 1, 60 - top, '#2e1e34');
          P.poly([[x - 1, top], [x + w / 2, top - w * 1.8], [x + w + 1, top]], '#0e0a14');
          P.line(x - 1, top, x + w / 2, top - w * 1.8, '#3a2440');
        };
        spire(214, 10, 20); spire(228, 8, 30); spire(204, 7, 34); spire(240, 6, 38);
        P.glow(219, 8, 10, 8, '#c04a44', 0.6);
        // far bank + near bank
        ridge(P, 82, 2, 0.08, 0.3, ['#0e1a14', '#1a2a1e', '#243a26'], 86, 2);
        P.vgrad(0, 84, W, 34, ['#3a2a50', '#4a3a6a', '#2a4a6a', '#1a3050', '#0e1a30']);
        // reflections of the sky
        for (let y = 86; y < 118; y += 3) for (let x = 0; x < W; x++) if (B(x, y) < 0.18 && Math.sin(x * 0.3 + y) > 0.2) P.set(x, y, '#8a4a5a');
        for (let y = 86; y < 104; y += 2) for (let x = 210; x < 250; x++) if (B(x, y) < 0.3) P.set(x, y, '#c86a44');
        // the stone bridge
        P.rect(40, 74, 240, 6, '#4e4858');
        bricks(P, 40, 74, 240, 6, 8, 3, R_STONE, '#1c1a24');
        for (let i = 0; i < 4; i++) {
          const ax = 58 + i * 60;
          P.rect(ax - 4, 80, 8, 22, '#34303e'); P.rect(ax - 4, 80, 2, 22, '#6e6878');
          P.rect(ax - 5, 100, 10, 3, '#1c1a24');
        }
        for (let x = 40; x < 280; x += 6) P.rect(x, 70, 2, 4, '#34303e');
        P.rect(40, 69, 240, 1, '#6e6878');
        // two Ashguard on the bridge, spears up
        [[150, 58], [172, 58]].forEach(([gx, gy]) => {
          P.rect(gx - 2, gy + 2, 5, 12, '#14101a'); P.rect(gx - 1, gy - 1, 3, 3, '#14101a');
          P.rect(gx - 2, gy + 2, 1, 10, '#3a3448');
          P.line(gx + 4, gy + 14, gx + 4, gy - 8, '#2a2430'); P.set(gx + 4, gy - 9, '#9690a0');
        });
        // near bank with reeds
        P.poly([[0, 112], [120, 118], [200, 116], [320, 110], [320, 140], [0, 140]], (x, y) => rampPick(['#0a140c', '#1a2a1a', '#2a4020', '#3a5a2a'], 0.9 - (y - 110) / 32, x, y));
        grassTufts(P, 118, 140, 90, ['#3a5a2a', '#4d6a34']);
        for (let i = 0; i < 26; i++) {
          const x = i < 13 ? 4 + i * 5 : 250 + (i - 13) * 5, h = 12 + (i * 7) % 14;
          P.line(x, 136, x + 2, 136 - h, '#1a2a1a'); P.rect(x + 1, 134 - h, 2, 5, '#5c3a24');
        }
      },
      anim(A, f) {
        for (let i = 0; i < 26; i++) {
          const y = 88 + (i % 9) * 3, len = 3 + (i % 4);
          const x = ((hash(i) * W + f * (0.6 + (i % 3) * 0.3)) % (W + 20)) - 10;
          const c = x > 200 && x < 256 && y < 104 ? '#ffc870' : '#9aa8d0';
          A.rect(x, y, len, 1, c);
        }
        // lit windows in the Spire
        [[218, 26], [218, 34], [231, 38], [207, 42], [243, 46], [222, 46]].forEach(([x, y], i) => {
          if (Math.sin(f * 0.13 + i * 2.1) > -0.6) A.rect(x, y, 2, 2, i % 2 ? '#f08a44' : '#ffd35a');
        });
        motes(A, f, 8, [180, 0, 80, 50], ['#f08a44', '#ffd35a'], 13);
      }
    },

    burrow: {
      seed: 61,
      paint(P) {
        P.vgrad(0, 0, W, H, ['#0a0806', '#1a120c', '#2a1e14', '#3a2a1c']);
        // massive root wall
        for (let i = 0; i < 22; i++) {
          const x0 = P.rand() * W, sl = (P.rand() - 0.5) * 0.8;
          for (let y = 0; y < 110; y++) {
            const x = x0 + y * sl + Math.sin(y * 0.1 + i) * 4, w = 3 + (i % 4);
            for (let k = 0; k < w; k++) P.set(x + k, y, rampPick(R_BARK, 0.7 - k / w * 0.7, x + k, y));
          }
        }
        bricks(P, 0, 70, W, 44, 22, 9, R_STONE_WARM, '#140e0a');
        P.vgrad(0, 112, W, 28, ['#3a2a1c', '#2a1e14', '#140e0a']);
        // the knee-high badger door, carved frame
        P.ellipse(160, 108, 18, 22, null, ['#1e120c', '#3a2418', '#5c3a24', '#86603c']);
        P.ellipse(160, 110, 12, 17, '#0a0604');
        P.rect(144, 110, 32, 4, '#140e0a');
        for (let a = 0; a < Math.PI; a += 0.35) P.set(160 + Math.cos(a) * 15, 106 - Math.sin(a) * 19, '#c9a24b');
        P.ellipse(158, 94, 2, 1.5, '#86603c'); P.ellipse(163, 94, 2, 1.5, '#86603c');
        P.rect(152, 112, 16, 2, '#86603c');
        // the coin gift on the threshold
        P.ellipse(160, 115, 2, 1, '#ffd35a');
        P.dith(0, 0, W, 60, '#050302', 0.5);
      },
      anim(A, f) {
        A.glow(160, 104, 10, 14, '#2a4a3a', 0.2 + Math.sin(f * 0.1) * 0.1);
        if (f % 40 < 20) A.px(161, 115, '#fff6c8');
        motes(A, f, 10, [100, 60, 120, 60], ['#86603c', '#a8844e'], 17);
        blinkEyes(A, f, 158, 104, '#c9e0a8', 21, 4);
      }
    },

    courtyard: {
      seed: 71,
      paint(P) {
        P.vgrad(0, 0, W, 50, ['#140c1c', '#2a1830', '#4a2438', '#6a3038']);
        stars(P, 30, 30, ['#8a6a90']);
        // keep behind, with its great door
        bricks(P, 90, 0, 140, 104, 14, 7, R_STONE, '#141218');
        for (let x = 0; x < W; x += 16) P.rect(x, 22, 10, 8, '#3a3448');
        bricks(P, 0, 30, W, 74, 18, 8, R_STONE, '#141218');
        bricks(P, 110, 0, 100, 80, 14, 7, R_STONE, '#141218');
        for (let x = 110; x < 210; x += 12) P.rect(x, 0, 7, 4, '#6e6878');
        P.rect(138, 42, 44, 62, '#141218');
        door(P, 140, 44, 40, 60, ['#1e120c', '#3a2418', '#5c3a24', '#86603c'], true);
        P.rect(159, 60, 2, 4, '#c9a24b');
        // banner with the thorn sigil
        [[122, 34], [192, 34]].forEach(([bx, by]) => {
          P.poly([[bx, by], [bx + 10, by], [bx + 10, by + 30], [bx + 5, by + 26], [bx, by + 30]], (x, y) => rampPick(['#3a0a10', '#6a1418', '#9a2020'], 0.8 - (x - bx) / 12, x, y));
          P.line(bx + 5, by + 6, bx + 5, by + 20, '#c9a24b'); P.line(bx + 2, by + 10, bx + 8, by + 16, '#c9a24b');
        });
        // shrine-house, left, moss-heavy sagging roof
        bricks(P, 8, 70, 72, 38, 12, 6, R_STONE_WARM, '#140e0a');
        P.poly([[0, 72], [44, 50], [90, 74], [86, 78], [44, 58], [4, 76]], (x, y) => rampPick(['#1d3a1f', '#2f5a28', '#4d8a34', '#86b848'], 0.9 - (y - 50) / 28 + (B(x, y) - 0.5) * 0.3, x, y));
        P.rect(36, 84, 14, 24, '#0e0a10'); P.rect(36, 84, 14, 1, '#6e6878');
        // barracks, right, with a lit window
        bricks(P, 244, 62, 76, 46, 12, 6, R_STONE, '#141218');
        P.poly([[236, 64], [280, 44], [324, 64]], (x, y) => rampPick(['#2a1418', '#4a2424', '#6a3430'], 0.7 - (y - 44) / 40, x, y));
        P.rect(266, 80, 10, 10, '#140e0a');
        P.rect(296, 86, 12, 22, '#140e0a');
        // cobbles
        P.vgrad(0, 104, W, 36, ['#4e4858', '#34303e', '#1c1a24']);
        for (let y = 106; y < 140; y += 4) for (let x = (y % 8) * 2; x < W; x += 9) P.ellipse(x, y, 3.2, 1.5, null, ['#1c1a24', '#4e4858', '#6e6878']);
        torchBracket(P, 130, 66); torchBracket(P, 190, 66);
        P.rect(0, 136, W, 4, '#0e0c12');
      },
      anim(A, f) {
        torchAnim(A, f, 130, 66, 0);
        torchAnim(A, f, 190, 66, 3);
        A.rect(267, 81, 8, 8, Math.sin(f * 0.3) > -0.8 ? '#e8a040' : '#b8702a');
        A.rect(270, 81, 1, 8, '#140e0a'); A.rect(267, 84, 8, 1, '#140e0a');
        A.glow(271, 94, 10, 4, '#6a4a28', 0.4);
      }
    },

    shrine: {
      seed: 83,
      paint(P) {
        interiorWalls(P, ['#120e0e', '#221a18', '#342a26', '#4a3c34', '#645244']);
        // high window slit
        P.rect(62, 14, 8, 24, '#c8c0a0'); P.rect(64, 16, 4, 20, '#f4f0d8');
        // stone figure where an altar should be
        P.rect(140, 88, 40, 18, '#3a2e2a'); bricks(P, 140, 88, 40, 18, 10, 6, R_STONE_WARM, '#140e0a');
        P.poly([[146, 88], [150, 50], [160, 38], [170, 50], [174, 88]], (x, y) => rampPick(R_STONE, 0.85 - (x - 146) / 30 + (y < 50 ? 0.1 : 0), x, y));
        P.ellipse(160, 38, 7, 8, null, R_STONE);
        P.rect(156, 38, 3, 2, '#1c1a24'); P.rect(162, 38, 3, 2, '#1c1a24');
        P.dith(146, 30, 28, 20, '#2f5a28', 0.25);
        // cobwebs
        for (let i = 0; i < 12; i++) { P.line(W - 1, 0, W - 1 - i * 3, i * 2.5, '#5a5250'); P.line(0, 0, i * 3, i * 2, '#5a5250'); }
        // floor dust
        P.speckle(0, 112, W, 28, '#5a4a40', 0.04);
      },
      anim(A, f) {
        const lv = 0.2 + Math.sin(f * 0.04) * 0.04;
        for (let y = 38; y < 130; y++) {
          const x0 = 64 + (y - 38) * 0.95;
          for (let i = 0; i < 10 + (y - 38) * 0.18; i++) if (B(x0 + i, y) < lv) A.px(x0 + i, y, '#d8c898');
        }
        motes(A, f, 20, [70, 40, 90, 80], ['#fff6c8', '#d8c898'], 31);
        [[134, 104], [186, 104], [128, 108]].forEach(([x, y], i) => {
          A.rect(x - 1, y, 3, 6, '#e8dcb8');
          A.glow(x, y - 4, 8, 7, '#6a4a28', 0.4);
          A.flame(x, y, 3, f, i * 3);
        });
      }
    },

    hall: {
      seed: 97,
      paint(P) {
        interiorWalls(P, ['#0e0c14', '#1a1822', '#2a2632', '#3c3846', '#56505e']);
        // three doorways
        [[112, 18], [150, 20], [196, 18]].forEach(([x, w]) => {
          P.rect(x - 2, 58, w + 4, 46, '#6e6878');
          P.ellipse(x + w / 2, 60, w / 2 + 2, 8, '#6e6878');
          P.rect(x, 60, w, 44, '#06060a'); P.ellipse(x + w / 2, 60, w / 2, 7, '#06060a');
        });
        // painting of a burning village
        P.rect(236, 34, 50, 34, '#c9a24b'); P.rect(237, 35, 48, 32, '#6a4a18');
        P.vgrad(239, 37, 44, 28, ['#2a0a0a', '#8a2a14', '#e0701e']);
        for (let i = 0; i < 5; i++) P.poly([[242 + i * 8, 64], [245 + i * 8, 56], [248 + i * 8, 64]], '#140606');
        // stair falling away on the left
        for (let s = 0; s < 8; s++) {
          const y = 96 + s * 5, x = 20 + s * 4;
          P.rect(x, y, 64 - s * 4, 5, rampPick(R_STONE, 0.7 - s * 0.09, x, y));
          P.rect(x, y, 64 - s * 4, 1, rampPick(R_STONE, 0.95 - s * 0.1, x, y));
        }
        P.dith(20, 96, 70, 44, '#040406', 0.55);
        // columns
        [[96, 8], [226, 8], [4, 12], [300, 14]].forEach(([x, w]) => {
          for (let y = 0; y < 140; y++) for (let i = 0; i < w; i++) {
            P.set(x + i, y, rampPick(R_STONE, 0.9 - i / w * 0.95, x + i, y));
          }
          P.rect(x - 2, 104, w + 4, 4, '#6e6878'); P.rect(x - 2, 0, w + 4, 3, '#6e6878');
        });
        torchBracket(P, 100, 50); torchBracket(P, 230, 50);
      },
      anim(A, f) {
        torchAnim(A, f, 100, 50, 1);
        torchAnim(A, f, 230, 50, 5);
        // the smoke in the painting moves
        for (let i = 0; i < 10; i++) {
          const t = (f * 0.3 + i * 5) % 26;
          A.px(242 + (i * 4) % 40 + Math.sin(t * 0.3) * 2, 62 - t, t < 14 ? '#4a3a3a' : '#2a1a1a');
        }
      }
    },

    cells: {
      seed: 101,
      paint(P) {
        P.vgrad(0, 0, W, H, ['#0a0c10', '#141a20', '#1c242a']);
        // corridor walls in rough perspective
        bricks(P, 0, 0, 120, 110, 14, 8, ['#141a1c', '#24302e', '#34443e', '#4e6258'], '#080a0a');
        bricks(P, 200, 0, 120, 110, 14, 8, ['#141a1c', '#24302e', '#34443e', '#4e6258'], '#080a0a');
        P.rect(120, 30, 80, 60, '#06080a');
        bricks(P, 132, 36, 56, 48, 8, 5, ['#0c1010', '#1a2220', '#24302e'], '#050606');
        P.rect(148, 46, 24, 38, '#020303');
        P.poly([[0, 110], [120, 90], [200, 90], [320, 110], [320, 140], [0, 140]], (x, y) => rampPick(['#0a0c0c', '#1a2220', '#2a3430'], (y - 90) / 50, x, y));
        // wet sheen
        for (let x = 100; x < 220; x++) if (B(x, 118) < 0.25) P.set(x, 118 + ((x * 3) % 5), '#4e6258');
        // cell bars on both sides
        for (let i = 0; i < 6; i++) {
          P.rect(18 + i * 16, 20 + i * 2, 3, 96 - i * 4, '#2a2a30'); P.rect(18 + i * 16, 20 + i * 2, 1, 96 - i * 4, '#6a6a78');
          P.rect(220 + i * 16, 30 - i * 2, 3, 86 + i * 4, '#2a2a30'); P.rect(220 + i * 16, 30 - i * 2, 1, 86 + i * 4, '#6a6a78');
        }
        P.rect(14, 22, 100, 3, '#2a2a30'); P.rect(216, 22, 100, 3, '#2a2a30');
        // straw and the great black hound in the last cell
        P.speckle(230, 100, 90, 14, '#8a7a3a', 0.35);
        P.ellipse(284, 102, 22, 8, null, ['#040406', '#0e0e14', '#1e1e28']);
        P.ellipse(266, 96, 7, 6, null, ['#040406', '#0e0e14', '#1e1e28']);
        P.poly([[262, 92], [264, 86], [267, 91]], '#0e0e14');
        torchBracket(P, 130, 22);
      },
      anim(A, f) {
        torchAnim(A, f, 130, 22, 2);
        blinkEyes(A, f, 263, 95, '#e8e8a0', 3, 4);
        // a slow drip into the puddle
        const t = f % 48;
        if (t < 30) A.px(170, 30 + t * 2.9, '#8ab0c0');
        else { const r = (t - 30) * 0.6; A.rect(170 - r, 118, 1, 1, '#8ab0c0'); A.rect(170 + r, 118, 1, 1, '#8ab0c0'); }
      }
    },

    doors: {
      seed: 113,
      paint(P) {
        bricks(P, 0, 0, W, 110, 16, 8, ['#0e0c14', '#1e1c26', '#302c3a', '#46404e', '#605a6a'], '#08070c');
        P.vgrad(0, 108, W, 32, ['#34303e', '#1c1a24', '#0e0c12']);
        const R_IRONWOOD = ['#10100e', '#2a2420', '#44382c', '#5c4c3a'];
        [70, 142, 214].forEach((x, i) => {
          P.rect(x - 3, 28, 42, 82, '#6e6878'); P.rect(x - 3, 28, 42, 2, '#9690a0');
          door(P, x, 32, 36, 78, R_IRONWOOD, true);
          P.rect(x + 28, 70, 3, 3, '#9690a0');
          if (i === 0) P.dith(x, 104, 36, 6, '#1a2a4a', 0.4);
        });
      },
      anim(A, f) {
        // right door: heat bleeding from under it
        const p = Math.sin(f * 0.25) * 0.5 + 0.5;
        A.glow(232, 110, 26, 6, '#c8501e', 0.4 + p * 0.3);
        A.rect(214, 108, 36, 1, p > 0.5 ? '#ffb040' : '#e0701e');
        // middle door: runes swim into view
        const runes = [[150, 50], [168, 48], [158, 64], [150, 82], [170, 80], [160, 96]];
        runes.forEach(([x, y], i) => {
          const a = Math.sin(f * 0.1 + i * 1.1);
          if (a > -0.2) {
            const c = a > 0.6 ? '#bff8f0' : '#3ac0b0';
            A.px(x, y, c); A.px(x + 1, y + 1, c); A.px(x - 1, y + 1, c); A.px(x, y + 2, c);
          }
        });
        // left door: cold draught
        motes(A, f, 6, [70, 96, 36, 14], ['#5a7ab0'], 41);
      }
    },

    sanctum: {
      seed: 127,
      paint(P) {
        P.vgrad(0, 0, W, H, ['#08040a', '#140810', '#240c14', '#34101a']);
        // ringed chamber wall
        for (let i = 0; i < 9; i++) {
          const x = 10 + i * 38, w = 14;
          for (let y = 0; y < 100; y++) for (let k = 0; k < w; k++) P.set(x + k, y, rampPick(['#08040a', '#1a0c14', '#2e1420'], 0.8 - k / w, x + k, y));
        }
        P.ellipse(160, 118, 150, 22, null, ['#0e060a', '#1a0a10', '#241018']);
        // black glass dais
        P.ellipse(160, 110, 70, 14, null, ['#040206', '#140a18', '#2a1a34', '#5a4a70']);
        P.ellipse(160, 106, 60, 10, null, ['#060308', '#1a0e20', '#3a2a4a']);
        // cracks
        [[160, 110, 110, 130], [160, 110, 214, 134], [160, 110, 60, 118], [160, 110, 270, 120]].forEach(l => P.line(l[0], l[1], l[2], l[3], '#5a1a1a'));
        // Wren, asleep on the dais
        P.ellipse(160, 102, 18, 3.5, null, ['#1a2a3a', '#3a5a6a', '#6a8a9a']);
        P.ellipse(141, 101, 3.5, 3, null, ['#6a4a3a', '#c89a7a']);
        P.dith(138, 98, 6, 3, '#8a4a2a', 0.8);
        // Vail Thorne, robed and waiting
        P.poly([[208, 104], [212, 64], [220, 58], [228, 64], [232, 104]], (x, y) => rampPick(['#0a080c', '#1a181e', '#2e2a34', '#4a4652'], 0.8 - (x - 208) / 26, x, y));
        P.ellipse(220, 56, 5, 6, null, ['#2a2230', '#6a5a6a', '#b8a8a0']);
        P.poly([[214, 58], [220, 48], [226, 58]], '#1a181e');
      },
      anim(A, f) {
        const p = Math.sin(f * 0.14) * 0.5 + 0.5;
        A.glow(160, 108, 76, 16, '#5a1818', 0.25 + p * 0.2);
        for (let a = 0; a < Math.PI * 2; a += 0.05) {
          if (Math.sin(a * 6 + f * 0.2) > 0.2) A.px(160 + Math.cos(a) * 62, 108 + Math.sin(a) * 11, p > 0.5 ? '#e0602a' : '#b8401e');
        }
        motes(A, f, 16, [40, 10, 240, 90], ['#e0602a', '#ffd35a'], 51);
        if (Math.sin(f * 0.07) > 0.9) { A.px(218, 55, '#e0602a'); A.px(222, 55, '#e0602a'); }
      }
    },

    // ---- title + endings ----
    title: {
      seed: 131,
      paint(P) {
        P.vgrad(0, 0, W, 96, ['#0c0818', '#1e1034', '#46204a', '#8a3048', '#d0603a', '#f0a050']);
        stars(P, 50, 44, ['#8a80b0', '#c8c0e0']);
        P.ellipse(70, 26, 11, 11, null, ['#8a8a9a', '#d8d4d0', '#fff8e8']);
        ridge(P, 76, 5, 0.04, 0.8, ['#1a0e24', '#2e1a38', '#442848'], 100, 0);
        const spire = (x, w, top) => {
          P.rect(x, top, w, 90 - top, '#0a0610');
          P.rect(x, top, 1, 90 - top, '#3a2440');
          P.poly([[x - 1, top], [x + w / 2, top - w * 2], [x + w + 1, top]], '#0a0610');
        };
        spire(196, 14, 26); spire(214, 10, 40); spire(184, 9, 46); spire(228, 8, 52);
        P.glow(203, 0, 16, 12, '#c04a44', 0.5);
        for (let i = 0; i < 20; i++) pine(P, i * 17 + P.rand() * 6, 108, 16 + P.rand() * 18, ['#05030a', '#0e0a18', '#1a1428'], '#05030a');
        P.vgrad(0, 104, W, 36, ['#0a0810', '#05040a']);
        // thorn vines creeping across the foreground
        const vine = (y0, amp, ph, c) => {
          for (let x = 0; x < W; x++) {
            const y = y0 + Math.sin(x * 0.05 + ph) * amp + Math.sin(x * 0.13 + ph) * 2;
            P.set(x, y, c); P.set(x, y + 1, '#05030a');
            if (x % 11 === 0) { P.set(x, y - 1, c); P.set(x + 1, y - 2, c); }
          }
        };
        vine(124, 6, 0, '#2a4020'); vine(130, 5, 2, '#3a5a2a');
      },
      anim(A, f) {
        [[200, 34], [204, 44], [217, 50], [188, 56], [231, 60], [201, 60]].forEach(([x, y], i) => {
          if (Math.sin(f * 0.11 + i * 1.9) > -0.5) A.rect(x, y, 2, 2, i % 2 ? '#f08a44' : '#ffd35a');
        });
        for (let i = 0; i < 3; i++) {
          const t = (f * 0.8 + i * 70) % 220, x = t * 1.6 - 20, y = 30 + i * 8 + Math.sin(t * 0.1) * 4;
          const wing = Math.floor(f / 2 + i) % 2;
          A.px(x, y, '#05030a'); A.px(x - 1, y - wing, '#05030a'); A.px(x + 1, y - wing, '#05030a');
          A.px(x - 2, y - 1 + wing, '#05030a'); A.px(x + 2, y - 1 + wing, '#05030a');
        }
        fireflies(A, f, 8, [10, 100, 300, 30], 61);
      }
    },

    victory: {
      seed: 149,
      paint(P) {
        P.vgrad(0, 0, W, 96, ['#4a6ab0', '#8aa0d0', '#f0c0a0', '#ffe0a0', '#fff4c8']);
        P.glow(160, 90, 90, 50, '#fff8e0', 0.7);
        P.ellipse(160, 88, 16, 16, null, ['#ffd35a', '#fff0a0', '#fffce8']);
        ridge(P, 86, 4, 0.05, 1.1, ['#4a5a7a', '#6a7a9a', '#8a9ab8'], 104, 0);
        const spire = (x, w, top) => { P.rect(x, top, w, 96 - top, '#3a3450'); P.poly([[x - 1, top], [x + w / 2, top - w * 1.6], [x + w + 1, top]], '#3a3450'); };
        spire(206, 8, 56); spire(218, 6, 64); spire(198, 5, 68);
        for (let i = 0; i < 18; i++) pine(P, i * 19 + P.rand() * 6, 110, 18 + P.rand() * 16, R_LEAF, R_BARK[1]);
        P.vgrad(0, 106, W, 34, ['#5a8a34', '#3a6a28', '#244a1c']);
        grassTufts(P, 108, 140, 180, ['#86b848', '#6aa03a']);
        for (let i = 0; i < 40; i++) {
          const x = P.rand() * W, y = 112 + P.rand() * 26;
          const c = ['#f0e070', '#f08aa0', '#ffffff', '#b88ad8'][i % 4];
          P.set(x, y, c); P.set(x - 1, y, c); P.set(x + 1, y, c); P.set(x, y - 1, c); P.set(x, y, '#ffd35a');
        }
      },
      anim(A, f) {
        for (let r = 0; r < 12; r++) {
          const a = Math.PI + (r + 0.5) / 12 * Math.PI;
          const on = Math.sin(f * 0.08 + r * 1.3) > 0;
          if (!on) continue;
          for (let d = 22; d < 90; d += 3) { const x = 160 + Math.cos(a) * d * 1.6, y = 88 + Math.sin(a) * d; if (B(x | 0, y | 0) < 0.25) A.px(x, y, '#fffce8'); }
        }
        for (let i = 0; i < 4; i++) {
          const t = (f * 0.7 + i * 50) % 240, x = 330 - t * 1.5, y = 30 + i * 6 + Math.sin(t * 0.08 + i) * 5;
          const wing = Math.floor(f / 3 + i) % 2;
          A.px(x, y, '#2a2a3a'); A.px(x - 1, y - wing, '#2a2a3a'); A.px(x + 1, y - wing, '#2a2a3a');
        }
      }
    },

    retreat: {
      seed: 157,
      paint(P) {
        P.vgrad(0, 0, W, 80, ['#070a18', '#101a34', '#1e2e50', '#34466a']);
        stars(P, 70, 60, ['#8a90c0', '#c8d0f0']);
        P.ellipse(240, 24, 12, 12, null, ['#8a8a9a', '#d8d8e0', '#fffff0']);
        P.glow(240, 24, 30, 30, '#34466a', 0.6);
        ridge(P, 74, 5, 0.05, 2.0, ['#0a1020', '#16223a', '#22304a'], 100, 4);
        for (let i = 0; i < 18; i++) pine(P, i * 19 + P.rand() * 8, 100, 24 + P.rand() * 22, ['#040810', '#0c1624', '#18283c'], '#040810');
        P.vgrad(0, 96, W, 44, ['#141e1a', '#0c1410', '#060a08']);
        // pale road winding away
        P.poly([[152, 98], [166, 98], [200, 140], [120, 140]], (x, y) => rampPick(['#141820', '#262c38', '#3a4252'], (y - 98) / 50, x, y));
        // two figures walking away, one leaning on the other
        P.rect(156, 104, 4, 10, '#05060a'); P.rect(157, 101, 2, 3, '#05060a');
        P.rect(161, 105, 4, 9, '#05060a'); P.rect(162, 102, 2, 3, '#05060a');
        P.line(159, 106, 162, 106, '#05060a');
        pine(P, 14, 140, 80, ['#020406', '#060a10'], '#020406');
        pine(P, 300, 140, 90, ['#020406', '#060a10'], '#020406');
      },
      anim(A, f) {
        for (let k = 0; k < 2; k++) {
          const off = Math.sin(f * 0.03 + k * 2) * 20;
          for (let x = 0; x < W; x++) {
            const xx = x + off, cy = 108 + k * 14 + Math.sin(xx * 0.03 + k) * 3;
            for (let y = Math.floor(cy - 4); y <= cy + 4; y++) {
              const lv = 0.16 * (0.6 + Math.sin(xx * 0.05 + k * 3) * 0.4) * (1 - Math.abs(y - cy) / 5);
              if (B(xx | 0, y) < lv) A.px(x, y, '#6a7a98');
            }
          }
        }
        for (let i = 0; i < 70; i += 7) if (Math.sin(f * 0.1 + i) > 0.8) A.px(hash(i + 3) * W, hash(i + 4) * 60, '#ffffff');
      }
    },

    death: {
      seed: 163,
      paint(P) {
        P.vgrad(0, 0, W, H, ['#020203', '#08060a', '#120a0e', '#1a0c10']);
        for (let i = 0; i < 12; i++) trunk(P, 10 + i * 28 + P.rand() * 10, 0, 110, 5 + P.rand() * 6, ['#020203', '#0a080c', '#16121a']);
        P.vgrad(0, 104, W, 36, ['#0e0a0c', '#060406']);
        // thorns closing in from both sides
        for (let s = 0; s < 2; s++) {
          for (let i = 0; i < 7; i++) {
            let x = s ? W : 0, y = 20 + i * 17;
            for (let k = 0; k < 60; k++) {
              x += s ? -1.4 : 1.4; y += Math.sin(k * 0.2 + i) * 0.9;
              P.set(x, y, '#2a0e12'); P.set(x, y + 1, '#12060a');
              if (k % 9 === 0) { P.set(x, y - 1, '#4a1a1e'); P.set(x + (s ? -1 : 1), y - 2, '#4a1a1e'); }
            }
          }
        }
        // the lantern left burning
        P.rect(156, 96, 9, 14, '#1a120c'); P.rect(157, 97, 7, 12, '#3a2a18');
        P.rect(155, 94, 11, 2, '#1a120c'); P.rect(158, 90, 5, 4, '#1a120c');
      },
      anim(A, f) {
        const gutter = Math.sin(f * 0.7) * Math.sin(f * 0.13);
        A.glow(160, 102, 30 + gutter * 4, 20, '#2a1408', 0.4);
        A.rect(158, 99, 5, 8, '#6a3a14');
        A.flame(160, 106, 4 + Math.round(gutter), f, 1);
        for (let i = 0; i < 6; i++) {
          const t = (f * 0.6 + i * 30) % 150, x = hash(i + 9) * W + Math.sin(t * 0.1) * 8, y = t;
          if (y < 136) A.px(x, y, '#3a3034');
        }
      }
    }
  };

  // Which painting each story node shows. Anything unlisted falls back to its zone.
  const SCENE_FOR_NODE = {
    n6: 'waystone', n9: 'waystone', n10: 'waystone', n10_win: 'waystone', n11: 'waystone', n11_win: 'waystone',
    n15: 'peddler',
    n16: 'camp', lc_camp: 'camp', n16_rest: 'camp', n17: 'camp',
    n28: 'burrow',
    n34: 'shrine', n34_win: 'shrine', n34_lose: 'shrine',
    n40: 'hall', n41: 'hall', n41_read: 'hall', n44: 'hall', n44_safe: 'hall', n44_hurt: 'hall', n40_back: 'hall',
    n46: 'doors', n46_lens: 'doors', n46_left: 'doors', n46_right: 'doors', n46_mid: 'doors'
  };
  const SCENE_FOR_ZONE = { forest: 'forest', river: 'river', courtyard: 'courtyard', dungeon: 'cells', sanctum: 'sanctum' };

  function sceneFor(nodeId) {
    if (SCENE_FOR_NODE[nodeId]) return SCENE_FOR_NODE[nodeId];
    const zone = global.Thornroad && global.Thornroad.zoneFor ? global.Thornroad.zoneFor(nodeId) : 'forest';
    return SCENE_FOR_ZONE[zone] || 'forest';
  }

  // ---------------- runtime: mount + stepped animation loop ----------------
  const baseCache = {};
  function baseFor(key) {
    if (baseCache[key]) return baseCache[key];
    const def = SCENES[key];
    const P = Painter(def.seed);
    P.rect(0, 0, W, H, '#000000');
    def.paint(P);
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const cx = c.getContext('2d');
    const img = cx.createImageData(W, H);
    new Uint32Array(img.data.buffer).set(P.buf);
    cx.putImageData(img, 0, 0);
    baseCache[key] = c;
    return c;
  }

  function reducedMotion() {
    try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  const live = new Set();
  let rafId = null, lastStep = 0, frame = 0;

  function drawScene(entry, f) {
    const { ctx, key } = entry;
    ctx.drawImage(baseFor(key), 0, 0);
    const def = SCENES[key];
    if (def.anim) def.anim(mkAnim(ctx), f);
  }

  function loop(ts) {
    rafId = null;
    if (ts - lastStep >= 1000 / FPS) {
      lastStep = ts;
      frame++;
      live.forEach(entry => {
        if (!entry.canvas.isConnected) { live.delete(entry); return; }
        if (entry.canvas.offsetParent === null) return; // on a hidden screen
        drawScene(entry, frame);
      });
    }
    if (live.size) rafId = requestAnimationFrame(loop);
  }

  const GEMS = ['gem-ruby', 'gem-emerald', 'gem-sapphire', 'gem-topaz'];

  // Paint `key` into `el` (replacing its contents) inside a carved frame.
  function mount(el, key) {
    if (!el || !SCENES[key]) return;
    live.forEach(entry => { if (el.contains(entry.canvas)) live.delete(entry); });
    el.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    canvas.className = 'scene-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    el.appendChild(canvas);
    GEMS.forEach((g, i) => {
      const s = document.createElement('span');
      s.className = 'scene-gem ' + g + ' sg-' + i;
      s.setAttribute('aria-hidden', 'true');
      el.appendChild(s);
    });
    const entry = { canvas, ctx: canvas.getContext('2d'), key };
    drawScene(entry, frame);
    if (reducedMotion()) return;
    live.add(entry);
    if (!rafId) rafId = requestAnimationFrame(loop);
  }

  // ---------------- UI chrome textures ----------------
  // A tile of carved blue-grey stone (the interface panel of every early-90s
  // adventure) and a small gold arrow cursor, generated once and exposed to CSS.
  function stoneTileURL() {
    const S = 48, c = document.createElement('canvas');
    c.width = S; c.height = S;
    const cx = c.getContext('2d'), R = rng(7);
    const ramp = ['#221e2c', '#2c2838', '#363244', '#403c50'];
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const n = Math.sin(x * 0.4) * Math.cos(y * 0.33) * 0.15 + (R() - 0.5) * 0.35;
      cx.fillStyle = rampPick(ramp, 0.45 + n, x, y);
      cx.fillRect(x, y, 1, 1);
    }
    cx.fillStyle = '#18141f';
    for (let i = 0; i < 5; i++) {
      let x = R() * S, y = R() * S;
      for (let k = 0; k < 10; k++) { cx.fillRect(x | 0, y | 0, 1, 1); x += R() * 2 - 0.6; y += R() * 2 - 1; }
    }
    return c.toDataURL();
  }

  function cursorURL() {
    const rows = [
      'K', 'KK', 'KGK', 'KGGK', 'KGYGK', 'KGYYGK', 'KGYYYGK', 'KGYYYYGK', 'KGYYYYYGK',
      'KGYYGKKKKK', 'KGGKGK', 'KGK KGK', 'KK  KGK', 'K    KGK', '     KK'
    ];
    const col = { K: '#1a1008', G: '#c9a24b', Y: '#fff0a0' };
    const c = document.createElement('canvas');
    c.width = 22; c.height = 32;
    const cx = c.getContext('2d');
    rows.forEach((r, y) => [...r].forEach((ch, x) => {
      if (col[ch]) { cx.fillStyle = col[ch]; cx.fillRect(x * 2, y * 2, 2, 2); }
    }));
    return c.toDataURL();
  }

  function installChrome() {
    try {
      const root = document.documentElement.style;
      root.setProperty('--stone-tile', `url(${stoneTileURL()})`);
      root.setProperty('--gold-cursor', `url(${cursorURL()}) 0 0`);
      document.documentElement.classList.add('has-scenes');
    } catch (e) { /* purely decorative */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installChrome);
  else installChrome();

  global.Thornroad = global.Thornroad || {};
  global.Thornroad.Scenes = { mount, sceneFor, keys: Object.keys(SCENES), W, H };
})(window);
