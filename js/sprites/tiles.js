/* ============================================================
 *  타일과 배경 — 슈퍼마리오 월드풍
 *
 *  ─ 타일 한 개는 16 x 16 도트를 배율 2로 그려 화면 32 x 32 가 됩니다.
 *    (캐릭터와 도트 크기를 맞추기 위해서입니다)
 *  ─ 숫자는 색이 아니라 "톤 번호"입니다.
 *      1 2 3 4 = 주 재질의 밝음 / 기본 / 그늘 / 최암부(테두리)
 *      5 6 7 8 = 보조 재질(잔디 등)
 *    테마(들판/동굴/하늘)마다 다른 색을 넣어 같은 그림을 재활용합니다.
 *  ─ 마리오 월드 느낌의 핵심: 굵은 어두운 테두리 + 위쪽 밝은 베벨 +
 *    아래·오른쪽 그늘. 그래서 블록 하나하나가 튀어나와 보입니다.
 * ========================================================== */

const T_DIRT = [
  '4444444444444444',
  '4111111111111334',
  '4111111111111334',
  '4112222222222334',
  '4112222223322334',
  '4112332222222334',
  '4112222222222334',
  '4112222222222334',
  '4112222222222334',
  '4112223322222334',
  '4112222222233334',
  '4112322222222334',
  '4112222222222334',
  '4333333333333334',
  '4333333333333334',
  '4444444444444444',
];

const T_GRASS = [
  '55..5555..555.55',
  '5555555555555555',
  '6666666666666666',
  '6666666666666666',
  '6666666666666666',
  '7777777777777777',
  '8888888888888888',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];

const T_STONE = [
  '4444444444444444',
  '4111111111111114',
  '4111111111111114',
  '4112222222222334',
  '4112222222222334',
  '4112222222222334',
  '4112211222222334',
  '4112222222222334',
  '4112222222222334',
  '4112222223322334',
  '4112222222222334',
  '4112222222222334',
  '4112222222222334',
  '4333333333333334',
  '4333333333333334',
  '4444444444444444',
];

const T_BRICK = [
  '4444444444444444',
  '4111111411111114',
  '4111111111111114',
  '4222222422222224',
  '4222222422222224',
  '4222222422222224',
  '4222222422222224',
  '4444444444444444',
  '4224222222242224',
  '4111111111111114',
  '4224222222242224',
  '4224222222242224',
  '4224222222242224',
  '4224222222242224',
  '4334333333343334',
  '4444444444444444',
];

const T_QUESTION = [
  'oooooooooooooooo',
  'oaaaaaaaaaaaaaao',
  'oaoaaaaaaaaaaoao',
  'oaabbbwwwwbbbcco',
  'oaabbwbbbbwbbcco',
  'oaabbbbbbbwbbcco',
  'oaabbbbwwwbbbcco',
  'oaabbbbwbbbbbcco',
  'oaabbbbbbbbbbcco',
  'oaabbbbwbbbbbcco',
  'oaabbbbbbbbbbcco',
  'oaabbbbbbbbbbcco',
  'oaabbbbbbbbbbcco',
  'ococcccccccccoco',
  'occcccccccccccco',
  'oooooooooooooooo',
];

const T_ITEM = [
  'oooooooooooooooo',
  'oaaaaaaaaaaaaaao',
  'oaoaaaaaaaaaaoao',
  'oaabbbbwwbbbbcco',
  'oaabbbwwwwbbbcco',
  'oaabwwwwwwwwbcco',
  'oaabbwwwwwwbbcco',
  'oaabbbwwwwbbbcco',
  'oaabbwwbbwwbbcco',
  'oaabwwbbbbwwbcco',
  'oaabbbbbbbbbbcco',
  'oaabbbbbbbbbbcco',
  'oaabbbbbbbbbbcco',
  'ococcccccccccoco',
  'occcccccccccccco',
  'oooooooooooooooo',
];

const T_USED = [
  '4444444444444444',
  '4111111111111114',
  '4111111111111114',
  '4224222222224334',
  '4222222222222334',
  '4222222222222334',
  '4222222222222334',
  '4222222222222334',
  '4222222222222334',
  '4222222222222334',
  '4222222222222334',
  '4222222222222334',
  '4224222222224334',
  '4333333333333334',
  '4333333333333334',
  '4444444444444444',
];

const T_PLATFORM = [
  '4444444444444444',
  '1111111111111111',
  '2223222232223222',
  '3333333333333333',
  '4444444444444444',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];

const T_SPIKE = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '..1....1....1...',
  '..1....1....1...',
  '.123..123..123..',
  '.123..123..123..',
  '122231222312223.',
  '1222312223122231',
  '2222222222222222',
  '4444444444444444',
];

const T_CLOUD = [
  '........................',
  '..........BBBBBBBBB.....',
  '.........BWWWWWWWWWB....',
  '....BBBBBWWWWWWWWWWWB...',
  '..BBWWWWWWWWWWWWWWWWW...',
  '..WWWWWWWWWWWWWWWWWWWBB.',
  '..WWWWWWWWWWWWWWWWWWWWWB',
  '..WWWWWWWWWWWWWWWWWWWWWW',
  '..bbWWWWWWWWWWWWWWWWWWWb',
  '....bbbbbbbbbbbbbbWWWbb.',
  '..................bbb...',
  '........................',
];

const T_BUSH = [
  '........................',
  '........................',
  '.........5555555........',
  '....55555666666655555...',
  '...5666666666666666665..',
  '..566666666666666666665.',
  '..766666666666666666666.',
  '..766666666666666666666.',
  '..766666666666666666666.',
  '..766666666666666666666.',
];


/* 물음표·아이템 블록은 테마와 상관없이 늘 같은 색입니다 */
const PAL_QUESTION = { '.': null, o: '#2a1a08', a: '#ffe066', b: '#ffc022', c: '#d18a10', w: '#ffffff', d: '#8a5a08' };
const PAL_QUESTION_ON = { '.': null, o: '#2a1a08', a: '#fff4b0', b: '#ffd451', c: '#e0a020', w: '#ffffff', d: '#8a5a08' };
const PAL_ITEM = { '.': null, o: '#2a1208', a: '#ffb070', b: '#ff7a2a', c: '#c94a12', w: '#fff0a8', d: '#8a3a08' };
const PAL_ITEM_ON = { '.': null, o: '#2a1208', a: '#ffd0a0', b: '#ff9a4a', c: '#e06020', w: '#ffffff', d: '#8a3a08' };
const PAL_CLOUD = { '.': null, W: '#ffffff', B: '#ffffff', b: '#c8d8f0' };

/* 스테이지 테마 — 재질마다 4단 램프 */
const THEME = {
  day: {
    dirt:  ['#f0b46a', '#cf7f38', '#96501f', '#2e1608'],
    grass: ['#b6f05e', '#6ec62e', '#3f8f1c', '#1a3f0c'],
    stone: ['#f0f4ff', '#bcc8dc', '#7b8aa6', '#242c3c'],
    brick: ['#f09a6a', '#cf5f34', '#93381a', '#2c1008'],
    wood:  ['#f0c07a', '#c98a3c', '#8a5620', '#2c1808'],
    spike: ['#f0f4ff', '#aab6cc', '#6a7590', '#20283a'],
    bush:  ['#b6f05e', '#6ec62e', '#3f8f1c', '#1a3f0c'],
    sky:   ['#2f8fff', '#4c9fff', '#6fb4ff', '#98caff', '#c4e2ff'],
    hill:  ['#49a832', '#388a28', '#245f19'],
  },
  cave: {
    dirt:  ['#9b7fd0', '#6a55a0', '#43336c', '#160f24'],
    grass: ['#c8a8ff', '#8f6fd6', '#5b459c', '#241a3c'],
    stone: ['#dfe6ff', '#9aa6cc', '#64708f', '#1c2233'],
    brick: ['#b57fd0', '#8a4fa0', '#5a2c6c', '#1c0c24'],
    wood:  ['#c9a06a', '#966a34', '#5e4018', '#1e1206'],
    spike: ['#e8eeff', '#98a4c4', '#5a6484', '#141a2a'],
    bush:  ['#a88fd8', '#6f57a8', '#463672', '#1a1230'],
    sky:   ['#150e28', '#1c1332', '#251a42', '#2f2152', '#392962'],
    hill:  ['#3a2a66', '#2a1e4c', '#1c1436'],
  },
  sky: {
    dirt:  ['#ffd8f4', '#e6a8e0', '#b072bc', '#3f2450'],
    grass: ['#ffffff', '#e2dcff', '#aea6dc', '#4c4676'],
    stone: ['#e8f0ff', '#b9c8f0', '#7f8fc0', '#2a3050'],
    brick: ['#ffc2e2', '#e07ab4', '#a44a80', '#341a30'],
    wood:  ['#ffd8a8', '#e0a86a', '#a8703a', '#3a2010'],
    spike: ['#ffffff', '#c8d4f0', '#8f9cc0', '#2a3050'],
    bush:  ['#ffffff', '#dcd4ff', '#a89ee0', '#4a4478'],
    sky:   ['#7fd0ff', '#9adcff', '#bde8ff', '#e8dcff', '#ffdcee'],
    hill:  ['#c3aef0', '#a48ddc', '#7a68a8'],
  },
};

const TS = 2;   /* 타일 도트 배율 — 캐릭터와 같은 크기를 유지합니다 */

function drawTile(ctx, ch, px, py, th, t) {
  const c = THEME[th] || THEME.day;
  switch (ch) {
    case '#': drawPixels(ctx, T_DIRT, px, py, TS, false, tonePal(c.dirt, c.grass)); break;
    case '=': drawPixels(ctx, T_STONE, px, py, TS, false, tonePal(c.stone)); break;
    case 'B': drawPixels(ctx, T_BRICK, px, py, TS, false, tonePal(c.brick)); break;
    case '?': drawPixels(ctx, T_QUESTION, px, py, TS, false,
                Math.floor(t / 26) % 2 ? PAL_QUESTION_ON : PAL_QUESTION); break;
    case '!': drawPixels(ctx, T_ITEM, px, py, TS, false,
                Math.floor(t / 20) % 2 ? PAL_ITEM_ON : PAL_ITEM); break;
    case 'X': drawPixels(ctx, T_USED, px, py, TS, false, tonePal(c.brick)); break;
    case '-': drawPixels(ctx, T_PLATFORM, px, py, TS, false, tonePal(c.wood)); break;
    case '^': drawPixels(ctx, T_SPIKE, px, py, TS, false, tonePal(c.spike)); break;
    case 'c': drawPixels(ctx, T_CLOUD, px, py, TS, false, PAL_CLOUD); break;
    case 't': drawPixels(ctx, T_BUSH, px, py + TILE - T_BUSH.length * TS, TS, false, tonePal(c.dirt, c.bush)); break;
    default: break;
  }
}

/* 흙 위가 비어 있으면 잔디를 덮습니다 */
function drawGrassTop(ctx, px, py, th) {
  const c = THEME[th] || THEME.day;
  drawPixels(ctx, T_GRASS, px, py, TS, false, tonePal(c.dirt, c.grass));
}

/* 골 깃발 */
function drawGoal(ctx, px, py, t) {
  const poleX = px + TILE / 2;
  const top = py - TILE * 4;
  ctx.fillStyle = '#20283a';
  ctx.fillRect(poleX - 4, top, 8, TILE * 5);
  ctx.fillStyle = '#bcc8dc';
  ctx.fillRect(poleX - 2, top + 2, 4, TILE * 5 - 2);
  ctx.fillStyle = '#ffc022';
  ctx.fillRect(poleX - 8, top - 8, 16, 8);
  ctx.fillStyle = '#2a1a08';
  ctx.fillRect(poleX - 8, top - 10, 16, 2);

  const wave = Math.round(Math.sin(t * 0.07) * 3) * 2;
  ctx.fillStyle = '#2a1020';
  ctx.fillRect(poleX + 4, top + 10, 44 + wave, 26);
  ctx.fillStyle = '#ff5fa8';
  ctx.fillRect(poleX + 6, top + 12, 40 + wave, 22);
  ctx.fillStyle = '#ffc2de';
  ctx.fillRect(poleX + 6, top + 12, 40 + wave, 4);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('GOAL', poleX + 26 + wave / 2, top + 24);
}

/* 배경 — 그라디언트 대신 색 계단 + 디더링, 테두리 있는 언덕 */
function drawBackground(ctx, camX, th, t) {
  const c = THEME[th] || THEME.day;
  const bands = c.sky;
  const h = Math.ceil(VIEW_H / bands.length);
  for (let i = 0; i < bands.length; i++) {
    ctx.fillStyle = bands[i];
    ctx.fillRect(0, i * h, VIEW_W, h);
    /* 경계에 체크무늬를 깔아 색 계단을 부드럽게 */
    if (i > 0) {
      ctx.fillStyle = bands[i - 1];
      for (let x = 0; x < VIEW_W; x += 8) {
        ctx.fillRect(x, i * h, 4, 4);
        ctx.fillRect(x + 4, i * h + 4, 4, 4);
      }
    }
  }

  /* 먼 언덕 */
  function hills(color, line, spacing, rad, yBase, speed) {
    const span = spacing * 8;
    for (let i = 0; i < 9; i++) {
      const x = (i * spacing - camX * speed) % span;
      const xx = ((x + span) % span) - spacing;
      ctx.fillStyle = line;
      ctx.beginPath(); ctx.arc(xx, yBase + 4, rad + 4, Math.PI, 0); ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(xx, yBase + 4, rad, Math.PI, 0); ctx.fill();
    }
  }
  /* 땅(잔디)보다 위에서 끝나게 해서 지면이 묻히지 않도록 합니다 */
  const ground = VIEW_H - TILE * 2;
  hills(c.hill[2], c.hill[2], 360, 120, ground - 44, 0.25);
  hills(c.hill[1], c.hill[2], 300, 92, ground - 18, 0.45);
  hills(c.hill[0], c.hill[2], 260, 62, ground - 2, 0.7);

  /* 배경 구름 */
  if (th !== 'cave') {
    for (let i = 0; i < 6; i++) {
      const span = 2400;
      const x = (i * 400 - camX * 0.18) % span;
      drawPixels(ctx, T_CLOUD, ((x + span) % span) - 120, 40 + (i % 3) * 52, TS, false, PAL_CLOUD);
    }
  } else {
    for (let i = 0; i < 40; i++) {
      const span = 1600;
      const x = (i * 137 - camX * 0.2) % span;
      const y = (i * 71) % (VIEW_H - 60);
      ctx.fillStyle = i % 3 ? 'rgba(200,180,255,.5)' : 'rgba(255,255,255,.7)';
      ctx.fillRect(((x + span) % span), y, 2, 2);
    }
  }
}
