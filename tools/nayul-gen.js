/* ============================================================
 *  나율이 도트 생성기
 *
 *  96칸짜리 좌표계에 캐릭터를 그린 뒤, 3배 크기로 렌더링 →
 *  목표 크기로 축소 → 팔레트 색으로 스냅(양자화) 합니다.
 *  덕분에 곡선이 도트 계단으로 정리되고, 같은 그림에서
 *  96x96(타이틀용)과 24x28(게임용)을 동시에 뽑을 수 있습니다.
 *
 *  색은 실제 사진에서 뽑은 값을 기준으로 잡았습니다.
 *
 *    node tools/nayul-gen.js                 96x96 + 미리보기 PNG
 *    node tools/nayul-gen.js --size=96 --code > out.js
 * ========================================================== */
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');

const args = process.argv.slice(2);
const opt = (n, d) => { const a = args.find((x) => x.startsWith('--' + n + '=')); return a ? a.split('=')[1] : d; };
const SIZE = parseInt(opt('size', '96'), 10);
const SS = parseInt(opt('ss', '3'), 10);            // 몇 배로 그린 뒤 줄일지
const OUT = opt('out', 'tools/out/nayul96.png');

/* ── 팔레트: 사진에서 뽑은 머리색·피부색 기준 ── */
const PAL96 = {
  F: '#ffe0c6', S: '#f5ba97', s: '#e5a884', d: '#b2765a',   /* 피부 (사진 기준) */
  H: '#45291c', K: '#2f1f1b', k: '#1a1211', x: '#0b0708',   /* 머리 — 사진처럼 거의 검정 */
  Q: '#ffd3e4', P: '#ff9cc2', p: '#d15f8e', q: '#87385c',   /* 원피스 */
  W: '#ffffff', B: '#e9ecf6', b: '#a9aec6',                  /* 흰옷 · 신발 */
  R: '#ff7a72', r: '#cf2038',                                /* 머리끈 */
  E: '#0b0708', C: '#ff8fa4', M: '#c33a4f',                  /* 눈 · 볼 · 입 */
};

/* 외곽선은 검정 하나가 아니라 "그 부위의 가장 어두운 색"으로 두릅니다 */
const OUTLINE = {
  F: 'd', S: 'd', s: 'd', d: 'd',
  H: 'x', K: 'x', k: 'x', x: 'x',
  Q: 'q', P: 'q', p: 'q', q: 'q',
  W: 'b', B: 'b', b: 'b',
  R: 'r', r: 'r',
  E: 'E', C: 'd', M: 'M',
};

/* ── 캐릭터 그리기 (96칸 좌표계) ────────────────────────────
 * pose: { legL, legR, armL, armR, bodyY, squash, eyes, mouth, arms }
 */
const DRAW = `
function rr(x, r, w, h, rad) {}
function drawNayul(g, P) {
  const C = PAL;
  const bodyY = P.bodyY || 0;

  /* ── 다리 ── */
  function leg(cx, off) {
    g.fillStyle = C.S;
    g.beginPath(); g.roundRect(cx - 4, 74 + bodyY, 8, 16 + off, 3); g.fill();
    g.fillStyle = C.s;
    g.beginPath(); g.roundRect(cx + 1, 74 + bodyY, 3, 14 + off, 2); g.fill();
    /* 신발 */
    g.fillStyle = C.W;
    g.beginPath(); g.roundRect(cx - 7, 86 + bodyY + off, 14, 9, 4); g.fill();
    g.fillStyle = C.b;
    g.beginPath(); g.roundRect(cx - 7, 91 + bodyY + off, 14, 4, 2); g.fill();
  }
  leg(40 + (P.legL || 0), P.legLY || 0);
  leg(57 + (P.legR || 0), P.legRY || 0);

  /* ── 뒷머리 ── */
  g.fillStyle = C.k;
  g.beginPath(); g.roundRect(24, 14 + bodyY, 48, 44, 20); g.fill();

  /* ── 원피스 ── */
  g.fillStyle = C.P;
  g.beginPath();
  g.moveTo(34, 56 + bodyY); g.lineTo(62, 56 + bodyY);
  g.lineTo(72, 79 + bodyY); g.lineTo(24, 79 + bodyY);
  g.closePath(); g.fill();
  /* 치마 그늘 */
  g.fillStyle = C.p;
  g.beginPath();
  g.moveTo(56, 56 + bodyY); g.lineTo(62, 56 + bodyY);
  g.lineTo(72, 79 + bodyY); g.lineTo(60, 79 + bodyY);
  g.closePath(); g.fill();
  g.fillStyle = C.q;
  g.beginPath(); g.roundRect(24, 76 + bodyY, 48, 4, 2); g.fill();
  /* 흰 옷깃 */
  g.fillStyle = C.W;
  g.beginPath(); g.roundRect(36, 53 + bodyY, 24, 6, 3); g.fill();
  g.fillStyle = C.B;
  g.beginPath(); g.roundRect(36, 57 + bodyY, 24, 2, 1); g.fill();
  /* 소매 단 */
  g.fillStyle = C.Q;
  g.beginPath(); g.roundRect(32, 58 + bodyY, 8, 6, 3); g.fill();
  g.beginPath(); g.roundRect(56, 58 + bodyY, 8, 6, 3); g.fill();
  /* 가슴 리본 */
  g.fillStyle = C.r;
  g.beginPath(); g.arc(48, 63 + bodyY, 3, 0, 7); g.fill();
  g.fillStyle = C.R;
  g.beginPath(); g.arc(47, 62 + bodyY, 1.1, 0, 7); g.fill();
  /* 치마 물방울 무늬 (작은 크기에서는 생략) */
  if (!P.small) {
    g.fillStyle = C.Q;
    [[38, 71], [48, 74], [58, 71], [43, 77], [53, 77]].forEach(function (v) {
      g.beginPath(); g.arc(v[0], v[1] + bodyY, 1.4, 0, 7); g.fill();
    });
  }

  /* ── 팔 ── */
  function arm(sx, sy, ex, ey) {
    g.strokeStyle = C.S; g.lineWidth = 7; g.lineCap = 'round';
    g.beginPath(); g.moveTo(sx, sy + bodyY); g.lineTo(ex, ey + bodyY); g.stroke();
    /* 손: 팔과 같은 피부색. 예전에는 가장 밝은 색이라 손만 하얗게 떠 보였습니다 */
    g.fillStyle = C.S;
    g.beginPath(); g.arc(ex, ey + bodyY, 4, 0, 7); g.fill();
    if (!P.small) {                    /* 큰 그림에서만 손등에 작은 빛 */
      g.fillStyle = C.F;
      g.beginPath(); g.arc(ex - 1.1, ey - 1.4 + bodyY, 1.5, 0, 7); g.fill();
    }
  }
  arm(34, 60, P.armLX !== undefined ? P.armLX : 27, P.armLY !== undefined ? P.armLY : 74);
  arm(62, 60, P.armRX !== undefined ? P.armRX : 69, P.armRY !== undefined ? P.armRY : 74);

  /* 목 그늘 */
  g.fillStyle = C.s;
  g.beginPath(); g.roundRect(43, 53 + bodyY, 10, 4, 2); g.fill();

  /* ── 얼굴 ── */
  g.fillStyle = C.S;
  g.beginPath(); g.roundRect(28, 18 + bodyY, 40, 40, 17); g.fill();
  /* 얼굴 그늘 (오른쪽 아래) */
  g.fillStyle = C.s;
  g.save(); g.beginPath(); g.roundRect(28, 18 + bodyY, 40, 40, 17); g.clip();
  g.beginPath(); g.moveTo(66, 24 + bodyY); g.lineTo(68, 24 + bodyY);
  g.lineTo(68, 58 + bodyY); g.lineTo(64, 58 + bodyY); g.closePath(); g.fill();
  g.restore();

  /* ── 앞머리 ── */
  g.fillStyle = C.K;
  g.save();
  g.beginPath(); g.roundRect(24, 12 + bodyY, 48, 46, 20); g.clip();
  g.beginPath();
  g.moveTo(24, 12 + bodyY); g.lineTo(72, 12 + bodyY); g.lineTo(72, 34 + bodyY);
  /* 앞머리 끝 삐죽삐죽 */
  g.lineTo(67, 31 + bodyY); g.lineTo(63, 38 + bodyY); g.lineTo(59, 30 + bodyY);
  g.lineTo(54, 37 + bodyY); g.lineTo(50, 29 + bodyY); g.lineTo(45, 37 + bodyY);
  g.lineTo(41, 29 + bodyY); g.lineTo(36, 36 + bodyY); g.lineTo(32, 30 + bodyY);
  g.lineTo(24, 33 + bodyY);
  g.closePath(); g.fill();
  /* 옆머리 (턱선까지) */
  g.fillStyle = C.K;
  g.beginPath(); g.roundRect(22, 20 + bodyY, 10, 36, 5); g.fill();
  g.beginPath(); g.roundRect(64, 20 + bodyY, 10, 36, 5); g.fill();
  /* 머리카락 결 (앞머리에 몇 가닥) — 작은 크기에서는 생략 */
  if (!P.small) {
  g.strokeStyle = C.k; g.lineWidth = 1.2;
  [[34, 14, 32, 28], [41, 13, 40, 30], [49, 13, 50, 27], [57, 14, 58, 30], [64, 15, 65, 27]]
    .forEach(function (v) {
      g.beginPath(); g.moveTo(v[0], v[1] + bodyY); g.lineTo(v[2], v[3] + bodyY); g.stroke();
    });
  }
  /* 머리 하이라이트 (왼쪽 위, 좁게) */
  g.fillStyle = C.H;
  g.globalAlpha = 0.65;
  g.beginPath(); g.ellipse(37, 18 + bodyY, 6, 1.8, -0.32, 0, 7); g.fill();
  g.globalAlpha = 1;
  g.restore();

  /* ── 정수리 꽁지머리 ── */
  g.fillStyle = C.K;
  g.beginPath();
  g.moveTo(44, 16 + bodyY); g.lineTo(46, 4 + bodyY); g.lineTo(52, 3 + bodyY);
  g.lineTo(54, 9 + bodyY); g.lineTo(53, 16 + bodyY);
  g.closePath(); g.fill();
  g.fillStyle = C.k;
  g.beginPath(); g.moveTo(50, 15 + bodyY); g.lineTo(54, 6 + bodyY);
  g.lineTo(54, 16 + bodyY); g.closePath(); g.fill();
  /* 빨간 머리끈 */
  g.fillStyle = C.r;
  g.beginPath(); g.roundRect(43, 11 + bodyY, 12, 5, 2.5); g.fill();
  g.fillStyle = C.R;
  g.beginPath(); g.roundRect(44, 12 + bodyY, 10, 2, 1); g.fill();

  /* ── 눈썹 ── */
  g.strokeStyle = C.K; g.lineWidth = P.small ? 3.2 : 2.4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(35, 34 + bodyY); g.lineTo(42, 33 + bodyY); g.stroke();
  g.beginPath(); g.moveTo(54, 33 + bodyY); g.lineTo(61, 34 + bodyY); g.stroke();

  /* ── 눈 ── */
  if (P.eyes === 'closed') {
    g.strokeStyle = C.E; g.lineWidth = 2.6;
    g.beginPath(); g.arc(39, 41 + bodyY, 4.5, 3.6, 5.8); g.stroke();
    g.beginPath(); g.arc(57, 41 + bodyY, 4.5, 3.6, 5.8); g.stroke();
  } else if (P.eyes === 'hurt') {
    g.strokeStyle = C.E; g.lineWidth = 2.6;
    [[39, 41], [57, 41]].forEach(function (p) {
      g.beginPath(); g.moveTo(p[0] - 4, p[1] - 4 + bodyY); g.lineTo(p[0] + 4, p[1] + 4 + bodyY); g.stroke();
      g.beginPath(); g.moveTo(p[0] + 4, p[1] - 4 + bodyY); g.lineTo(p[0] - 4, p[1] + 4 + bodyY); g.stroke();
    });
  } else {
    [[39, 41], [57, 41]].forEach(function (p) {
      const er = P.small ? 6.5 : 5, eh = P.small ? 7.5 : 6;
      g.fillStyle = C.E;
      g.beginPath(); g.ellipse(p[0], p[1] + bodyY, er, eh, 0, 0, 7); g.fill();
      g.fillStyle = C.W;
      g.beginPath(); g.arc(p[0] - 1.8, p[1] - 2.6 + bodyY, P.small ? 2.6 : 1.9, 0, 7); g.fill();
      if (!P.small) { g.beginPath(); g.arc(p[0] + 2, p[1] + 2.4 + bodyY, 1, 0, 7); g.fill(); }
    });
  }

  /* ── 볼 ── */
  g.fillStyle = C.C;
  g.globalAlpha = 0.85;
  g.beginPath(); g.ellipse(32, 48 + bodyY, 4.2, 2.8, 0, 0, 7); g.fill();
  g.beginPath(); g.ellipse(64, 48 + bodyY, 4.2, 2.8, 0, 0, 7); g.fill();
  g.globalAlpha = 1;

  /* ── 입 ── */
  g.fillStyle = C.M;
  if (P.mouth === 'open') {
    g.beginPath(); g.ellipse(48, 51 + bodyY, 3.4, 3.6, 0, 0, 7); g.fill();
  } else {
    g.strokeStyle = C.M; g.lineWidth = P.small ? 3 : 2; g.lineCap = 'round';
    g.beginPath(); g.arc(48, 48 + bodyY, P.small ? 4.5 : 4, 0.6, 2.54); g.stroke();
  }
}
`;

const POSES = {
  idle:  {},
  blink: { eyes: 'closed' },
  walk1: { bodyY: 0, legL: -3, legR: 3, legLY: -1, legRY: 0, armLX: 24, armLY: 70, armRX: 72, armRY: 76 },
  walk2: { bodyY: -2, legL: 0, legR: 0, legLY: -2, legRY: -1, armLX: 28, armLY: 74, armRX: 68, armRY: 74 },
  walk3: { bodyY: 0, legL: 3, legR: -3, legLY: 0, legRY: -1, armLX: 30, armLY: 76, armRX: 66, armRY: 70 },
  walk4: { bodyY: -2, legL: 0, legR: 0, legLY: -1, legRY: -2, armLX: 28, armLY: 74, armRX: 68, armRY: 74 },
  jump:  { bodyY: -1, legL: -2, legR: 2, legLY: -4, legRY: -2, armLX: 22, armLY: 48, armRX: 74, armRY: 48 },
  fall:  { bodyY: 0, legL: -3, legR: 3, legLY: -2, legRY: -5, armLX: 20, armLY: 54, armRX: 76, armRY: 54, mouth: 'open' },
  hurt:  { bodyY: 1, legL: -4, legR: 4, legLY: 0, legRY: 0, armLX: 22, armLY: 50, armRX: 74, armRY: 50, eyes: 'hurt', mouth: 'open' },
};

const LETTERS = Object.keys(PAL96);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const result = await page.evaluate(async ({ PAL96, DRAW, POSES, SIZE, SS }) => {
    const PAL = PAL96;
    eval(DRAW);
    const out = {};
    const hi = SIZE * SS;
    for (const name of Object.keys(POSES)) {
      const c = document.createElement('canvas');
      c.width = hi; c.height = hi;
      const g = c.getContext('2d');
      g.scale(hi / 96, hi / 96);
      drawNayul(g, Object.assign({ small: SIZE <= 40 }, POSES[name]));

      /* 목표 크기로 축소 */
      const small = document.createElement('canvas');
      small.width = SIZE; small.height = SIZE;
      const sg = small.getContext('2d');
      sg.imageSmoothingEnabled = true;
      sg.imageSmoothingQuality = 'high';
      sg.drawImage(c, 0, 0, SIZE, SIZE);
      out[name] = Array.from(sg.getImageData(0, 0, SIZE, SIZE).data);
    }
    return out;
  }, { PAL96, DRAW, POSES, SIZE, SS });

  /* 팔레트 색으로 스냅 */
  const pal = LETTERS.map((ch) => {
    const h = PAL96[ch];
    return { ch, r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) };
  });
  function snap(r, g, b) {
    let best = pal[0], bd = Infinity;
    for (const p of pal) {
      const d = (p.r - r) ** 2 * 0.5 + (p.g - g) ** 2 * 0.7 + (p.b - b) ** 2 * 0.3;
      if (d < bd) { bd = d; best = p; }
    }
    return best.ch;
  }

  /* 바깥 테두리 픽셀을 그 재질의 최암부로 바꿔 실루엣을 또렷하게 */
  function addOutline(rows) {
    const h = rows.length, w = rows[0].length;
    const out = rows.map((r) => r.split(''));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ch = rows[y][x];
        if (ch === '.') continue;
        const edge = [[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => {
          const nx = x + dx, ny = y + dy;
          return nx < 0 || nx >= w || ny < 0 || ny >= h || rows[ny][nx] === '.';
        });
        if (edge) out[y][x] = OUTLINE[ch] || ch;
      }
    }
    return out.map((r) => r.join(''));
  }

  const grids = {};
  for (const name of Object.keys(result)) {
    const px = result[name];
    const rows = [];
    for (let y = 0; y < SIZE; y++) {
      let row = '';
      for (let x = 0; x < SIZE; x++) {
        const i = (y * SIZE + x) * 4;
        row += px[i + 3] < 110 ? '.' : snap(px[i], px[i + 1], px[i + 2]);
      }
      rows.push(row);
    }
    grids[name] = addOutline(rows);
  }

  /* PNG 저장 */
  const page2 = await browser.newPage();
  const pngs = await page2.evaluate(({ grids, PAL96, SIZE }) => {
    const names = Object.keys(grids);
    const out = {};
    [1, 4].forEach((s) => {
      const c = document.createElement('canvas');
      c.width = SIZE * s * names.length; c.height = SIZE * s;
      const g = c.getContext('2d');
      names.forEach((n, ni) => {
        grids[n].forEach((row, y) => {
          for (let x = 0; x < row.length; x++) {
            const ch = row[x];
            if (ch === '.') continue;
            g.fillStyle = PAL96[ch];
            g.fillRect((ni * SIZE + x) * s, y * s, s, s);
          }
        });
      });
      out[s] = c.toDataURL('image/png').split(',')[1];
    });
    return out;
  }, { grids, PAL96, SIZE });
  await browser.close();

  fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true });
  fs.writeFileSync(path.resolve(OUT), Buffer.from(pngs[1], 'base64'));
  fs.writeFileSync(path.resolve(OUT).replace(/\.png$/, '_x4.png'), Buffer.from(pngs[4], 'base64'));
  console.error(`${SIZE}x${SIZE}, ${Object.keys(grids).length}프레임 저장: ${OUT}`);

  if (args.includes('--code')) {
    console.log('const PAL96 = ' + JSON.stringify(PAL96, null, 2).replace(/"/g, "'") + ';\n');
    console.log('const NAYUL96 = {');
    for (const n of Object.keys(grids)) {
      console.log('  ' + n + ': [');
      grids[n].forEach((r) => console.log("    '" + r + "',"));
      console.log('  ],');
    }
    console.log('};');
  }
})();
