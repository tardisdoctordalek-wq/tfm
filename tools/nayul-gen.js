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
function drawNayul(g, P) {
  const C = PAL;
  const B = P.bodyY || 0;          /* 바운드: 양수면 몸 전체가 아래로 */

  /* 회전 기준점(피봇) — 팔은 어깨, 다리는 골반 */
  const shX = 57, shY = 61 + B;
  const hipX = 48, hipY = 71 + B;
  const LEG = 21, ARM = 13;

  /* 관절을 중심으로 회전하는 다리 (각도는 라디안, + 면 앞쪽) */
  function leg(ang, skin, shoe) {
    const fx = hipX + Math.sin(ang) * LEG;
    const fy = hipY + Math.cos(ang) * LEG;
    g.strokeStyle = skin; g.lineWidth = 9; g.lineCap = 'round';
    g.beginPath(); g.moveTo(hipX, hipY); g.lineTo(fx, fy); g.stroke();
    /* 신발은 바닥에 붙으므로 기울이지 않습니다 */
    g.fillStyle = shoe;
    g.beginPath(); g.roundRect(fx - 6, fy - 3, 15, 8, 4); g.fill();
  }

  function arm(ang, skin) {
    const ex = shX + Math.sin(ang) * ARM;
    const ey = shY + Math.cos(ang) * ARM;
    g.strokeStyle = skin; g.lineWidth = 7; g.lineCap = 'round';
    g.beginPath(); g.moveTo(shX, shY); g.lineTo(ex, ey); g.stroke();
    g.fillStyle = skin;
    g.beginPath(); g.arc(ex, ey, 4, 0, 7); g.fill();     /* 주먹 */
  }

  /* ── 1) 몸 안쪽(먼 쪽) 팔다리 — 어둡게 해서 다리 움직임이 보이게 ── */
  leg(P.legF || 0, C.s, C.b);
  arm(P.armF || 0, C.s);

  /* ── 2) 가까운 쪽 다리 ── */
  leg(P.legN || 0, C.S, C.W);

  /* ── 3) 원피스 (옆에서 본 모양) ── */
  g.fillStyle = C.P;
  g.beginPath();
  g.moveTo(39, 55 + B); g.lineTo(63, 55 + B);
  g.lineTo(69, 77 + B); g.lineTo(33, 77 + B);
  g.closePath(); g.fill();
  g.fillStyle = C.p;                     /* 뒤쪽(왼쪽)이 살짝 어둡게 */
  g.beginPath();
  g.moveTo(39, 55 + B); g.lineTo(44, 55 + B);
  g.lineTo(40, 77 + B); g.lineTo(33, 77 + B);
  g.closePath(); g.fill();
  g.fillStyle = C.q;
  g.beginPath(); g.roundRect(33, 74 + B, 36, 4, 2); g.fill();
  if (!P.small) {                        /* 치마 무늬 */
    g.fillStyle = C.Q;
    [[47, 66], [57, 63], [53, 71], [62, 69]].forEach(function (v) {
      g.beginPath(); g.arc(v[0], v[1] + B, 1.4, 0, 7); g.fill();
    });
  }
  /* 흰 옷깃 */
  g.fillStyle = C.W;
  g.beginPath(); g.roundRect(43, 53 + B, 20, 5, 2.5); g.fill();

  /* ── 4) 가까운 쪽 팔 (옷 위) ── */
  arm(P.armN || 0, C.S);

  /* ── 5) 머리 (오른쪽을 봅니다) ── */
  /* 뒷머리 · 옆머리 */
  g.fillStyle = C.K;
  g.beginPath(); g.roundRect(28, 14 + B, 41, 40, 17); g.fill();

  /* 얼굴 — 앞쪽(오른쪽)만 피부가 보입니다 */
  g.fillStyle = C.S;
  g.beginPath(); g.roundRect(50, 24 + B, 21, 27, 10); g.fill();
  /* 코 */
  g.beginPath(); g.moveTo(69, 38 + B); g.lineTo(72, 41 + B); g.lineTo(69, 43 + B);
  g.closePath(); g.fill();
  /* 턱선 아래 목 */
  g.fillStyle = C.S;
  g.beginPath(); g.roundRect(50, 48 + B, 11, 8, 3); g.fill();

  /* 앞머리 — 이마를 덮고 끝이 뾰족하게 */
  g.fillStyle = C.K;
  g.save();
  g.beginPath(); g.roundRect(27, 12 + B, 45, 42, 18); g.clip();
  g.beginPath();
  g.moveTo(27, 12 + B); g.lineTo(72, 12 + B); g.lineTo(72, 28 + B);
  g.lineTo(68, 34 + B); g.lineTo(64, 27 + B); g.lineTo(59, 33 + B);
  g.lineTo(55, 26 + B); g.lineTo(50, 32 + B); g.lineTo(46, 26 + B);
  g.lineTo(27, 30 + B);
  g.closePath(); g.fill();
  if (!P.small) {                        /* 머리카락 결 */
    g.strokeStyle = C.k; g.lineWidth = 1.2;
    [[37, 14, 34, 30], [45, 13, 43, 28], [53, 13, 52, 26], [61, 14, 61, 26]]
      .forEach(function (v) { g.beginPath(); g.moveTo(v[0], v[1] + B); g.lineTo(v[2], v[3] + B); g.stroke(); });
    g.fillStyle = C.H;                   /* 윤기 */
    g.globalAlpha = 0.6;
    g.beginPath(); g.ellipse(43, 18 + B, 7, 2, -0.2, 0, 7); g.fill();
    g.globalAlpha = 1;
  }
  g.restore();

  /* 정수리 꽁지머리 — 뒤로 살짝 눕습니다 */
  g.fillStyle = C.K;
  g.beginPath();
  g.moveTo(44, 16 + B); g.lineTo(41, 3 + B); g.lineTo(47, 1 + B);
  g.lineTo(51, 9 + B); g.lineTo(51, 16 + B);
  g.closePath(); g.fill();
  g.fillStyle = C.r;
  g.save(); g.translate(47, 12 + B); g.rotate(-0.28);
  g.beginPath(); g.roundRect(-5, -2, 10, 4.5, 2.2); g.fill();
  g.fillStyle = C.R;
  g.beginPath(); g.roundRect(-4, -1.2, 8, 1.6, 0.8); g.fill();
  g.restore();

  /* 눈썹 */
  g.strokeStyle = C.K; g.lineWidth = P.small ? 3 : 2.4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(56, 31 + B); g.lineTo(64, 32 + B); g.stroke();

  /* 눈 (옆모습이라 한쪽만) */
  if (P.eyes === 'closed') {
    g.strokeStyle = C.E; g.lineWidth = 2.6;
    g.beginPath(); g.arc(60, 38 + B, 4.5, 3.6, 5.8); g.stroke();
  } else if (P.eyes === 'hurt') {
    g.strokeStyle = C.E; g.lineWidth = 2.6;
    g.beginPath(); g.moveTo(57, 35 + B); g.lineTo(65, 43 + B); g.stroke();
    g.beginPath(); g.moveTo(65, 35 + B); g.lineTo(57, 43 + B); g.stroke();
  } else {
    const er = P.small ? 5.5 : 4.6, eh = P.small ? 6.5 : 6;
    g.fillStyle = C.E;
    g.beginPath(); g.ellipse(60, 38 + B, er, eh, 0, 0, 7); g.fill();
    g.fillStyle = C.W;
    g.beginPath(); g.arc(58.6, 35.6 + B, P.small ? 2.2 : 1.8, 0, 7); g.fill();
  }

  /* 볼 */
  g.fillStyle = C.C;
  g.globalAlpha = 0.85;
  g.beginPath(); g.ellipse(56, 44 + B, 3.4, 2.4, 0, 0, 7); g.fill();
  g.globalAlpha = 1;

  /* 입 */
  if (P.mouth === 'open') {
    g.fillStyle = C.M;
    g.beginPath(); g.ellipse(66, 47 + B, 3, 3.2, 0, 0, 7); g.fill();
  } else {
    g.strokeStyle = C.M; g.lineWidth = P.small ? 2.6 : 2; g.lineCap = 'round';
    g.beginPath(); g.arc(65, 45 + B, 3.2, 0.4, 2.1); g.stroke();
  }
}
`;

const POSES = {
  idle:  { legN: 0.05, legF: -0.06, armN: 0.05, armF: -0.05, bodyY: 0 },
  blink: { legN: 0.05, legF: -0.06, armN: 0.05, armF: -0.05, bodyY: 0, eyes: 'closed' },
  /* 걷기 — 블로그 가이드대로
     ① 다리 벌림(앞발이 가까운 쪽)  ② 모음(바운드로 몸이 위로)  ③ 다리 벌림(반대)
     walk4 는 ② 와 같은 그림이라 1-2-3-2 순서로 돕니다. */
  walk1: { legN:  0.40, legF: -0.40, armN: -0.34, armF:  0.34, bodyY: 1 },
  walk2: { legN:  0.06, legF: -0.14, armN:  0.04, armF: -0.04, bodyY: 0 },
  walk3: { legN: -0.40, legF:  0.40, armN:  0.34, armF: -0.34, bodyY: 1 },
  walk4: { legN:  0.06, legF: -0.14, armN:  0.04, armF: -0.04, bodyY: 0 },
  jump:  { legN: -0.30, legF:  0.34, armN: -1.10, armF: -1.30, bodyY: 0 },
  fall:  { legN:  0.34, legF: -0.18, armN: -1.35, armF: -1.55, bodyY: 0, mouth: 'open' },
  hurt:  { legN: -0.45, legF:  0.45, armN: -1.45, armF: -1.60, bodyY: 1, eyes: 'hurt', mouth: 'open' },
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
      const isSmall = SIZE <= 40;
      /* 바운드는 도트 한 칸의 정수배여야 합니다. 소수점만큼 올리면
         축소할 때 머리까지 다시 계산되어 몸 전체가 떨려 보입니다. */
      const dot = 96 / SIZE;
      const bounce = Math.max(1, Math.round(3.4 / dot)) * dot;
      /* 저해상도에서는 부분을 도트 한 칸의 정수배로만 움직여야 합니다.
         소수점만큼 움직이면 축소할 때 그림 전체가 다시 계산되어,
         다리가 아니라 몸 전체가 떠는 것처럼 보입니다. */
      const U = 96 / SIZE;
      const pose = POSES[name];
      drawNayul(g, Object.assign({}, pose, {
        small: isSmall,
        bodyY: (pose.bodyY || 0) * bounce,
      }));

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
