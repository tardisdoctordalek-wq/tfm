/* ============================================================
 *  도트(픽셀) 스프라이트 — 이미지 파일 없이 점 하나하나를 찍어 그립니다.
 *  아래 글자 한 칸이 도트 한 개입니다. 글자만 바꾸면 그림이 바뀝니다.
 * ========================================================== */

/* 팔레트: 글자 → 색 */
const PAL = {
  '.': null,               // 투명
  X: '#1a1220',            // 외곽선
  K: '#241b1c',            // 머리(검정에 가까운 짙은 갈색)
  k: '#3b2c27',            // 머리 중간톤
  H: '#5d4638',            // 머리 하이라이트
  R: '#e23b4f',            // 빨간 머리끈
  S: '#ffd9b9',            // 피부
  s: '#e8b998',            // 피부 그늘
  E: '#241a2a',            // 눈동자
  W: '#ffffff',            // 눈 반짝임
  C: '#ff9fb0',            // 볼터치
  M: '#c4415a',            // 입
  P: '#ff8fb3',            // 분홍 원피스
  p: '#d9648f',            // 원피스 그늘
  L: '#fff4f8',            // 흰 장식
  B: '#f7f7fc',            // 신발
  b: '#c5c8d8',            // 신발 그늘
  Y: '#ffd451',            // 코인 노랑
  y: '#e2a221',            // 코인 그늘
  N: '#9a5f2c',            // 밤톨이 몸
  n: '#75461f',            // 밤톨이 그늘
  V: '#9b7ce0',            // 새 몸
  v: '#6f53ad',            // 새 그늘
  O: '#ffb43a',            // 부리
  G: '#ff4f7b',            // 하트
  g: '#d63057',            // 하트 그늘
};

/* 도트 그림을 화면에 찍습니다 */
function drawPixels(ctx, grid, x, y, scale, flip) {
  ctx.save();
  if (flip) {
    ctx.translate(Math.round(x) + grid[0].length * scale, Math.round(y));
    ctx.scale(-1, 1);
  } else {
    ctx.translate(Math.round(x), Math.round(y));
  }
  for (let r = 0; r < grid.length; r++) {
    const line = grid[r];
    for (let c = 0; c < line.length; c++) {
      const col = PAL[line[c]];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(c * scale, r * scale, scale, scale);
    }
  }
  ctx.restore();
}

/* ─────────────────────────────────────────────
 *  나율이 (20 × 24 도트)
 *  앞머리 단발 + 정수리 꽁지머리(빨간 머리끈) + 분홍 원피스
 *  외곽선(X)과 음영을 넣은 RPG풍 도트 스타일입니다.
 * ───────────────────────────────────────────── */
const NAYUL = {
    idle: [
      '.........XX.........',
      '........XkKX........',
      '........XKKX........',
      '.......XXRRXX.......',
      '......XKKKKKKX......',
      '.....XKKKKKKKKX.....',
      '....XKKHKKKKKKKX....',
      '....XKKKKKKKKKKX....',
      '....XKSSSSSSSSKX....',
      '....XKSEWSSEWSKX....',
      '....XKSEESSEESKX....',
      '....XKSCSSSSCSKX....',
      '.....XSSSMMSSSX.....',
      '......XXSSSSXX......',
      '........XSSX........',
      '.....XPPPPPPPPX.....',
      '...XSSPPPPPPPPSSX...',
      '...XSSPPPPPPPPSSX...',
      '...XSPPPPPPPPPPSX...',
      '..XPPPPPPPPPPPPPPX..',
      '..XppppppppppppppX..',
      '.....XSSX..XSSX.....',
      '.....XSSX..XSSX.....',
      '....XBBBX..XBBBX....',
    ],
    walk1: [
      '.........XX.........',
      '........XkKX........',
      '........XKKX........',
      '.......XXRRXX.......',
      '......XKKKKKKX......',
      '.....XKKKKKKKKX.....',
      '....XKKHKKKKKKKX....',
      '....XKKKKKKKKKKX....',
      '....XKSSSSSSSSKX....',
      '....XKSEWSSEWSKX....',
      '....XKSEESSEESKX....',
      '....XKSCSSSSCSKX....',
      '.....XSSSMMSSSX.....',
      '......XXSSSSXX......',
      '........XSSX........',
      '.....XPPPPPPPPX.....',
      '..XSSXPPPPPPPPXSSX..',
      '..XSSPPPPPPPPPPSSX..',
      '...XXPPPPPPPPPPXX...',
      '..XPPPPPPPPPPPPPPX..',
      '..XppppppppppppppX..',
      '....XSSX....XSSX....',
      '....XSSX....XSSX....',
      '...XBBBX....XBBBX...',
    ],
    walk2: [
      '.........XX.........',
      '........XkKX........',
      '........XKKX........',
      '.......XXRRXX.......',
      '......XKKKKKKX......',
      '.....XKKKKKKKKX.....',
      '....XKKHKKKKKKKX....',
      '....XKKKKKKKKKKX....',
      '....XKSSSSSSSSKX....',
      '....XKSEWSSEWSKX....',
      '....XKSEESSEESKX....',
      '....XKSCSSSSCSKX....',
      '.....XSSSMMSSSX.....',
      '......XXSSSSXX......',
      '........XSSX........',
      '.....XPPPPPPPPX.....',
      '....XSPPPPPPPPSX....',
      '...XSSPPPPPPPPSSX...',
      '...XSSPPPPPPPPSSX...',
      '..XPPPPPPPPPPPPPPX..',
      '..XppppppppppppppX..',
      '......XSSXXSSX......',
      '......XSSXXSSX......',
      '.....XBBBXXBBBX.....',
    ],
    jump: [
      '.........XX.........',
      '........XkKX........',
      '........XKKX........',
      '.......XXRRXX.......',
      '......XKKKKKKX......',
      '.....XKKKKKKKKX.....',
      '....XKKHKKKKKKKX....',
      '....XKKKKKKKKKKX....',
      '....XKSSSSSSSSKX....',
      '....XKSEWSSEWSKX....',
      '....XKSEESSEESKX....',
      '....XKSCSSSSCSKX....',
      '.....XSSSMMSSSX.....',
      '......XXSSSSXX......',
      '........XSSX........',
      '.....XPPPPPPPPX.....',
      'XSSXXXPPPPPPPPXXXSSX',
      '.XSSXXPPPPPPPPXXSSX.',
      '...XXPPPPPPPPPPXX...',
      '..XPPPPPPPPPPPPPPX..',
      '..XppppppppppppppX..',
      '....XSSX....XSSX....',
      '...XSSX......XSSX...',
      '..XBBBX......XBBBX..',
    ],
    hurt: [
      '.........XX.........',
      '........XkKX........',
      '........XKKX........',
      '.......XXRRXX.......',
      '......XKKKKKKX......',
      '.....XKKKKKKKKX.....',
      '....XKKHKKKKKKKX....',
      '....XKKKKKKKKKKX....',
      '....XKSSSSSSSSKX....',
      '....XKSXSSSSXSKX....',
      '....XKSSXSSXSSKX....',
      '....XKSCSSSSCSKX....',
      '.....XSSSMMSSSX.....',
      '......XXSMMSXX......',
      '........XSSX........',
      '.....XPPPPPPPPX.....',
      'XSSXXXPPPPPPPPXXXSSX',
      '.XSSXXPPPPPPPPXXSSX.',
      '...XXPPPPPPPPPPXX...',
      '..XPPPPPPPPPPPPPPX..',
      '..XppppppppppppppX..',
      '...XSSX......XSSX...',
      '...XSSX......XSSX...',
      '..XBBBX......XBBBX..',
    ],
};

/* 눈 감기(깜빡임) 처리 */
function blinkGrid(grid) {
  const g = grid.slice();
  g[9]  = '....XKSSSSSSSSKX....';
  g[10] = '....XKSXXSSXXSKX....';
  return g;
}

/*
 * o = { facing, state('idle'|'run'|'jump'|'hurt'), t, big, blink }
 * (x, y, w, h) 는 충돌 상자. 도트 그림은 그 상자 가운데/바닥에 맞춰 그립니다.
 */
function drawNayul(ctx, x, y, w, h, o) {
  const scale = Math.max(2, Math.round(h / 24));
  let grid;
  if (o.state === 'hurt') grid = NAYUL.hurt;
  else if (o.state === 'jump') grid = NAYUL.jump;
  else if (o.state === 'run') grid = (Math.floor(o.t / 7) % 4 === 1) ? NAYUL.walk1
    : (Math.floor(o.t / 7) % 4 === 3) ? NAYUL.walk2 : NAYUL.idle;
  else grid = NAYUL.idle;
  if (o.blink && o.state !== 'hurt') grid = blinkGrid(grid);

  const sw = grid[0].length * scale;
  const sh = grid.length * scale;
  const px = x + w / 2 - sw / 2;
  const py = y + h - sh;

  /* 그림자 */
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h, w * 0.5, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  drawPixels(ctx, grid, px, py, scale, o.facing < 0);

  /* 아이템 먹어 커졌을 때: 머리 위 반짝이는 별 */
  if (o.big) {
    drawStar(ctx, x + w / 2, py - 6 + Math.sin(o.t * 0.12) * 2, 6, '#ffe66d');
  }
}

/* ─────────── 밤톨이 (걸어다니는 적, 12 × 12) ─────────── */
const WALKER = [
  [
    '....NNNN....',
    '..NNNNNNNN..',
    '.NNNNNNNNNN.',
    '.NNNNNNNNNN.',
    '.NWWNNNNWWN.',
    '.NWEWNNWEWN.',
    '.NNNNNNNNNN.',
    '..NNXXXXNN..',
    '.nnnnnnnnnn.',
    '..nnnnnnnn..',
    '.XX......XX.',
    '.XX......XX.',
  ],
  [
    '....NNNN....',
    '..NNNNNNNN..',
    '.NNNNNNNNNN.',
    '.NNNNNNNNNN.',
    '.NWWNNNNWWN.',
    '.NWEWNNWEWN.',
    '.NNNNNNNNNN.',
    '..NNXXXXNN..',
    '.nnnnnnnnnn.',
    '..nnnnnnnn..',
    '..XX....XX..',
    '..XX....XX..',
  ],
];

const WALKER_FLAT = [
  '............',
  '............',
  '............',
  '............',
  '............',
  '............',
  '....NNNN....',
  '..NNNNNNNN..',
  '.NNNNXXNNNN.',
  '.nnnnnnnnnn.',
  '.XXnnnnnnXX.',
  '.XX......XX.',
];

function drawWalker(ctx, x, y, w, h, t, dir, squashed) {
  const grid = squashed ? WALKER_FLAT : WALKER[Math.floor(t / 10) % 2];
  const scale = Math.max(2, Math.round(h / 12));
  const sw = grid[0].length * scale;
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h, w * 0.45, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  drawPixels(ctx, grid, x + w / 2 - sw / 2, y + h - grid.length * scale, scale, dir < 0);
}

/* ─────────── 날개새 (날아다니는 적, 14 × 11) ─────────── */
const FLYER = [
  [
    '..v........v..',
    '.vv........vv.',
    '.vvv.VVVV.vvv.',
    '..vvVVVVVVvv..',
    '...VVVVVVVV...',
    '...VVWWVVVV...',
    '...VVWEVVVV.O.',
    '...VVVVVVVOOO.',
    '....VVVVVV.O..',
    '.....VVVV.....',
    '.....v..v.....',
  ],
  [
    '..............',
    '..............',
    '.....VVVV.....',
    'vvvvVVVVVVvvvv',
    '.vvVVVVVVVVvv.',
    '...VVWWVVVV...',
    '...VVWEVVVV.O.',
    '...VVVVVVVOOO.',
    '....VVVVVV.O..',
    '.....VVVV.....',
    '.....v..v.....',
  ],
];

function drawFlyer(ctx, x, y, w, h, t, dir) {
  const grid = FLYER[Math.floor(t / 8) % 2];
  const scale = Math.max(2, Math.round(h / 11));
  const sw = grid[0].length * scale;
  const sh = grid.length * scale;
  drawPixels(ctx, grid, x + w / 2 - sw / 2, y + h / 2 - sh / 2, scale, dir < 0);
}

/* ─────────── 코인(별동전) 10 × 10 ─────────── */
const COIN = [
  '...YYYY...',
  '..YYYYYY..',
  '.YYyyyyYY.',
  '.YyYYYYyY.',
  'YYyYYYYyYY',
  'YYyYYYYyYY',
  '.YyYYYYyY.',
  '.YYyyyyYY.',
  '..YYYYYY..',
  '...YYYY...',
];

function drawCoin(ctx, cx, cy, r, t) {
  const squeeze = Math.max(0.16, Math.abs(Math.cos(t * 0.07)));
  const scale = Math.max(2, Math.round((r * 2) / 10));
  const sw = 10 * scale;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(squeeze, 1);
  drawPixels(ctx, COIN, -sw / 2, -sw / 2, scale, false);
  ctx.restore();
}

/* ─────────── 하트 아이템 11 × 9 ─────────── */
const HEART = [
  '..GG...GG..',
  '.GGGGGGGGG.',
  'GGWGGGGGGGG',
  'GGWGGGGGGGG',
  'gGGGGGGGGGg',
  '.gGGGGGGGg.',
  '..gGGGGGg..',
  '...gGGGg...',
  '....gGg....',
];

function drawHeart(ctx, cx, cy, r, t) {
  const scale = Math.max(2, Math.round((r * 2) / 11));
  const bob = Math.sin(t * 0.12) * 2;
  drawPixels(ctx, HEART, cx - (11 * scale) / 2, cy - (9 * scale) / 2 + bob, scale, false);
}

/* ─────────── 도형 보조 함수 ─────────── */
function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function circle(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawStar(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = cx + Math.cos(ang) * rad;
    const py = cy + Math.sin(ang) * rad;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

/* ─────────── 타일 ─────────── */
const THEME = {
  day:  { sky1: '#6ec0ff', sky2: '#bfe9ff', dirt: '#a8622f', dirtDark: '#8a4c21', grass: '#5fbf4a', grassDark: '#3f9a33', stone: '#9fb0c2', hill: '#57b94a' },
  cave: { sky1: '#1b1436', sky2: '#3a2a63', dirt: '#5a4a6e', dirtDark: '#443758', grass: '#7d6bb0', grassDark: '#5c4d8a', stone: '#8a94b8', hill: '#2a2048' },
  sky:  { sky1: '#8fd0ff', sky2: '#ffd9ec', dirt: '#c9a3e8', dirtDark: '#a97fd0', grass: '#ffffff', grassDark: '#dcd0ff', stone: '#c7d6ff', hill: '#c9b6ff' },
};

function drawTile(ctx, ch, px, py, th, t) {
  const c = THEME[th] || THEME.day;
  switch (ch) {
    case '#':
      ctx.fillStyle = c.dirt;
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = c.dirtDark;
      ctx.fillRect(px + 4, py + 12, 6, 6);
      ctx.fillRect(px + 20, py + 20, 6, 6);
      break;
    case '=':
      ctx.fillStyle = c.stone;
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.fillRect(px + 2, py + 2, TILE - 4, 4);
      ctx.fillStyle = 'rgba(0,0,0,.22)';
      ctx.fillRect(px + 2, py + TILE - 6, TILE - 4, 4);
      break;
    case 'B':
      ctx.fillStyle = '#c0562f';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.strokeStyle = 'rgba(0,0,0,.30)';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
      ctx.beginPath();
      ctx.moveTo(px, py + 16); ctx.lineTo(px + TILE, py + 16);
      ctx.moveTo(px + 16, py); ctx.lineTo(px + 16, py + 16);
      ctx.moveTo(px + 8, py + 16); ctx.lineTo(px + 8, py + TILE);
      ctx.moveTo(px + 24, py + 16); ctx.lineTo(px + 24, py + TILE);
      ctx.stroke();
      break;
    case '?':
    case '!': {
      const glow = 0.5 + Math.sin(t * 0.1) * 0.5;
      ctx.fillStyle = ch === '?' ? '#e8a02a' : '#e86a2a';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = `rgba(255,255,255,${0.22 + glow * 0.3})`;
      ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
      ctx.fillStyle = ch === '?' ? '#7a4a10' : '#8a2f10';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ch === '?' ? '?' : '★', px + TILE / 2, py + TILE / 2 + 1);
      break;
    }
    case 'X':
      ctx.fillStyle = '#8a6a4a';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = 'rgba(0,0,0,.20)';
      ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
      break;
    case '-':
      ctx.fillStyle = '#b5793f';
      ctx.fillRect(px, py, TILE, 10);
      ctx.fillStyle = '#e0a96a';
      ctx.fillRect(px, py, TILE, 4);
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.fillRect(px + 6, py + 10, 4, 4);
      ctx.fillRect(px + 22, py + 10, 4, 4);
      break;
    case '^':
      ctx.fillStyle = '#c8ccd8';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(px + i * 11 + 1, py + TILE);
        ctx.lineTo(px + i * 11 + 6, py + 8);
        ctx.lineTo(px + i * 11 + 11, py + TILE);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = '#7e8596';
      ctx.fillRect(px, py + TILE - 5, TILE, 5);
      break;
    case 'c':
      circle(ctx, px + 10, py + 20, 12, 'rgba(255,255,255,.92)');
      circle(ctx, px + 26, py + 16, 16, 'rgba(255,255,255,.92)');
      circle(ctx, px + 44, py + 21, 12, 'rgba(255,255,255,.92)');
      ctx.fillStyle = 'rgba(255,255,255,.92)';
      ctx.fillRect(px + 10, py + 20, 36, 12);
      break;
    case 't':
      circle(ctx, px + 8, py + 26, 9, '#3f9a33');
      circle(ctx, px + 20, py + 22, 12, '#4fb040');
      circle(ctx, px + 32, py + 26, 9, '#3f9a33');
      ctx.fillStyle = '#3f9a33';
      ctx.fillRect(px + 4, py + 26, 30, 6);
      break;
    default:
      break;
  }
}

function drawGrassTop(ctx, px, py, th) {
  const c = THEME[th] || THEME.day;
  ctx.fillStyle = c.grass;
  ctx.fillRect(px, py, TILE, 9);
  ctx.fillStyle = c.grassDark;
  ctx.fillRect(px, py + 7, TILE, 3);
}

function drawGoal(ctx, px, py, t) {
  const poleX = px + TILE / 2;
  const top = py - TILE * 4;
  ctx.fillStyle = '#cfd6e2';
  ctx.fillRect(poleX - 3, top, 6, TILE * 5);
  circle(ctx, poleX, top, 7, '#ffd451');
  ctx.fillStyle = '#ff5d8f';
  const wave = Math.sin(t * 0.08) * 4;
  ctx.beginPath();
  ctx.moveTo(poleX + 3, top + 8);
  ctx.lineTo(poleX + 48 + wave, top + 21);
  ctx.lineTo(poleX + 3, top + 34);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('GOAL', poleX + 21, top + 21);
  ctx.fillStyle = '#8a5a2a';
  ctx.fillRect(px + 2, py + TILE - 6, TILE - 4, 6);
}

function drawBackground(ctx, camX, th, t) {
  const c = THEME[th] || THEME.day;
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, c.sky1);
  g.addColorStop(1, c.sky2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  if (th === 'cave') {
    for (let i = 0; i < 60; i++) {
      const x = ((i * 137) - camX * 0.2) % 1400;
      const y = (i * 71) % VIEW_H;
      const a = 0.25 + ((i * 13) % 10) / 20;
      circle(ctx, (x + 1400) % 1400, y, 1.6, `rgba(255,255,255,${a})`);
    }
  } else if (th === 'sky') {
    for (let i = 0; i < 14; i++) {
      const x = (i * 260 - camX * 0.25) % 2600;
      const xx = (x + 2600) % 2600 - 200;
      circle(ctx, xx, 90 + (i % 4) * 60, 40, 'rgba(255,255,255,.45)');
      circle(ctx, xx + 40, 90 + (i % 4) * 60, 52, 'rgba(255,255,255,.38)');
    }
  }

  ctx.fillStyle = th === 'cave' ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.28)';
  for (let i = 0; i < 10; i++) {
    const x = (i * 340 - camX * 0.35) % 3400;
    const xx = (x + 3400) % 3400 - 300;
    ctx.beginPath();
    ctx.arc(xx, VIEW_H - 60, 150, Math.PI, 0);
    ctx.fill();
  }
  ctx.fillStyle = th === 'cave' ? 'rgba(0,0,0,.25)' : c.hill;
  for (let i = 0; i < 12; i++) {
    const x = (i * 280 - camX * 0.55) % 3360;
    const xx = (x + 3360) % 3360 - 260;
    ctx.beginPath();
    ctx.arc(xx, VIEW_H - 30, 110, Math.PI, 0);
    ctx.fill();
  }
}
