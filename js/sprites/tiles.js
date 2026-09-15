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


/* ============================================================
 *  1스테이지 — 집 안 타일
 *  기존 재질 슬롯을 집 물건으로 바꿔 씁니다.
 *    흙   → 마룻바닥      돌   → 벽 타일
 *    벽돌 → 서랍장        가시 → 레고 조각
 *    구름 → 벽시계        수풀 → 화분
 * ========================================================== */

/* 마룻바닥 (집 테마의 # 타일).
 * 처음엔 타일마다 세로 테두리 + 4도트 판자로 만들었더니 마루가 아니라
 * 벽돌 격자로 보였습니다(캡처로 확인). 판자를 8도트로 키우고 세로선을 빼고
 * 이음매를 엇갈리게 두니 마루로 읽힙니다. */
const T_FLOOR = [
  '3333333333333333',
  '1111311111111111',
  '2222322222222222',
  '2222322222222222',
  '2222322222222222',
  '2222322222222222',
  '2222322222222222',
  '2222322222222222',
  '3333333333333333',
  '1111111111131111',
  '2222222222232222',
  '2222222222232222',
  '2222222222232222',
  '2222222222232222',
  '2222222222232222',
  '2222222222232222',
];

/* 바닥 윗면 — 집에서는 잔디 대신 걸레받이 / 러그 테두리 */
const T_TRIM = [
  '5555555555555555',
  '5555555555555555',
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
  '................',
  '................',
];

/* 벽 타일 (집 테마의 = 타일) */
const T_WALLTILE = [
  '4444444444444444',
  '4111111111111114',
  '4111111111111114',
  '4122222222222234',
  '4122222222222234',
  '4122222222222234',
  '4122222222222234',
  '4122222222222234',
  '4122222222222234',
  '4122222222222234',
  '4122222222222234',
  '4122222222222234',
  '4122222222222234',
  '4133333333333334',
  '4333333333333334',
  '4444444444444444',
];

/* 서랍장 — 큰 나율이는 부술 수 있습니다 (집 테마의 B 타일) */
const T_DRAWER = [
  '4444444444444444',
  '4111111111111114',
  '4122222222222234',
  '4122244444222234',
  '4122222222222234',
  '4122222222222234',
  '4133333333333334',
  '4444444444444444',
  '4111111111111114',
  '4122222222222234',
  '4122244444222234',
  '4122222222222234',
  '4122222222222234',
  '4133333333333334',
  '4333333333333334',
  '4444444444444444',
];

/* 레고 조각 — 밟으면 아픕니다 (집 테마의 ^ 타일) */
const T_LEGO = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.11...11...11...',
  '.11...11...11...',
  '1111111111111111',
  '1222222222222221',
  '1222222222222221',
  '1333333333333331',
  '3333333333333333',
  '4444444444444444',
];

/* 파워업 블록 (* 타일). 네 귀퉁이 리벳은 ? · ! 블록과 같은 장식입니다 */
const T_POWER = [
  'oooooooooooooooo',
  'oaaaaaaaaaaaaaao',
  'oaoaaaaaaaaaaoao',
  'oaabbbbbwbbbbcco',
  'oaabbbbbwbbbbcco',
  'oaabbbwwwwwbbcco',
  'oaabbwwwwwwwbcco',
  'oaabwwwwwwwwwcco',
  'oaabbwwwwwwwbcco',
  'oaabbbwwwwwbbcco',
  'oaabbbbbwbbbbcco',
  'oaabbbbbwbbbbcco',
  'oaabbbbbbbbbbcco',
  'ococcccccccccoco',
  'occcccccccccccco',
  'oooooooooooooooo',
];

/* 벽시계 (집 테마의 c 장식). 원은 손으로 못 찍어서 계산으로 만들었습니다 */
const T_CLOCK = [
  '.......44.......',
  '....44444444....',
  '...4422222244...',
  '..442255552244..',
  '.44255588555244.',
  '.42255588555224.',
  '.42555588555524.',
  '4425555888885244',
  '4425555588885244',
  '.43555555555534.',
  '.43366666666334.',
  '.44366666666344.',
  '..443366663344..',
  '...4433333344...',
  '....44444444....',
  '.......44.......',
];

/* 화분 (집 테마의 t 장식). 좌우 대칭이라 반쪽을 뒤집어 만들었습니다 */
const T_PLANT = [
  '................',
  '......8888......',
  '....88555588....',
  '...8855555588...',
  '..885555555588..',
  '..855556655558..',
  '..855666666558..',
  '...8866666688...',
  '....88666688....',
  '.....887788.....',
  '......8778......',
  '..111111111111..',
  '..122222222221..',
  '..122222222221..',
  '..133333333331..',
  '..144444444441..',
];


/* 물음표·아이템 블록은 테마와 상관없이 늘 같은 색입니다 */
const PAL_QUESTION = { '.': null, o: '#2a1a08', a: '#ffe066', b: '#ffc022', c: '#d18a10', w: '#ffffff', d: '#8a5a08' };
const PAL_QUESTION_ON = { '.': null, o: '#2a1a08', a: '#fff4b0', b: '#ffd451', c: '#e0a020', w: '#ffffff', d: '#8a5a08' };
const PAL_ITEM = { '.': null, o: '#2a1208', a: '#ffb070', b: '#ff7a2a', c: '#c94a12', w: '#fff0a8', d: '#8a3a08' };
const PAL_ITEM_ON = { '.': null, o: '#2a1208', a: '#ffd0a0', b: '#ff9a4a', c: '#e06020', w: '#ffffff', d: '#8a3a08' };
const PAL_CLOUD = { '.': null, W: '#ffffff', B: '#ffffff', b: '#c8d8f0' };
/* 파워 블록은 민트색이라 노란 ? 블록·주황 ! 블록과 한눈에 구분됩니다 */
const PAL_POWER    = { '.': null, o: '#10283a', a: '#b8f4ff', b: '#4fc8e8', c: '#2a7fa8', w: '#ffffff' };
const PAL_POWER_ON = { '.': null, o: '#10283a', a: '#e8fdff', b: '#7fdcf2', c: '#3f9fc8', w: '#ffffff' };

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
  /* 1스테이지 — 집 안.
     아침 햇살이 든 거실 색입니다. 벽지는 연한 크림, 바닥은 따뜻한 나무. */
  house: {
    dirt:  ['#e8c48a', '#c99a5c', '#8f6434', '#3a2412'],   // 마룻바닥
    grass: ['#ffd9e4', '#f0a8bf', '#b0708a', '#3a2030'],   // 바닥 러그 테두리
    stone: ['#dff5ea', '#a8ddc4', '#6ba88c', '#22382e'],   // 수납장·싱크대 (연한 민트색 가구)
    brick: ['#ffd2b8', '#e89a72', '#a6613f', '#2e160c'],   // 서랍장
    wood:  ['#ffeec4', '#f5b95e', '#a86f18', '#241203'],   // 선반(얇은 발판) — 배경 가구보다 밝고 진하게
    spike: ['#ff9a9a', '#e64545', '#a01f1f', '#380c0c'],   // 레고 조각
    bush:  ['#bff09a', '#74c04e', '#417d2c', '#18300f'],   // 화분 잎
    sky:   ['#fff6e8', '#fdeedb', '#fae4cb', '#f6d9bb', '#f0cdaa'],   // 벽지
    hill:  ['#dcc3b2', '#c9ab97', '#ad8d79'],              // 배경 가구 (채도를 낮춰 뒤로 물러나게)
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
  const home = th === 'house';   /* 집에서는 같은 자리에 다른 물건이 놓입니다 */
  switch (ch) {
    case '#': drawPixels(ctx, home ? T_FLOOR : T_DIRT, px, py, TS, false, tonePal(c.dirt, c.grass)); break;
    case '=': drawPixels(ctx, home ? T_WALLTILE : T_STONE, px, py, TS, false, tonePal(c.stone)); break;
    case 'B': drawPixels(ctx, home ? T_DRAWER : T_BRICK, px, py, TS, false, tonePal(c.brick)); break;
    case '?': drawPixels(ctx, T_QUESTION, px, py, TS, false,
                Math.floor(t / 26) % 2 ? PAL_QUESTION_ON : PAL_QUESTION); break;
    case '!': drawPixels(ctx, T_ITEM, px, py, TS, false,
                Math.floor(t / 20) % 2 ? PAL_ITEM_ON : PAL_ITEM); break;
    case '*': drawPixels(ctx, T_POWER, px, py, TS, false,
                Math.floor(t / 14) % 2 ? PAL_POWER_ON : PAL_POWER); break;
    case 'X': drawPixels(ctx, T_USED, px, py, TS, false, tonePal(c.brick)); break;
    case '-': drawPixels(ctx, T_PLATFORM, px, py, TS, false, tonePal(c.wood)); break;
    case '^': drawPixels(ctx, home ? T_LEGO : T_SPIKE, px, py, TS, false, tonePal(c.spike)); break;
    case 'c':
      if (home) drawPixels(ctx, T_CLOCK, px, py, TS, false, tonePal(c.wood, c.stone));
      else drawPixels(ctx, T_CLOUD, px, py, TS, false, PAL_CLOUD);
      break;
    case 't':
      if (home) drawPixels(ctx, T_PLANT, px, py + TILE - T_PLANT.length * TS, TS, false, tonePal(c.dirt, c.bush));
      else drawPixels(ctx, T_BUSH, px, py + TILE - T_BUSH.length * TS, TS, false, tonePal(c.dirt, c.bush));
      break;
    default: break;
  }
}

/* 흙 위가 비어 있으면 잔디를 덮습니다 */
function drawGrassTop(ctx, px, py, th) {
  const c = THEME[th] || THEME.day;
  /* 집에서는 잔디가 아니라 평평한 걸레받이/러그 테두리가 올라옵니다 */
  drawPixels(ctx, th === 'house' ? T_TRIM : T_GRASS, px, py, TS, false, tonePal(c.dirt, c.grass));
}

/* 골 — 테마마다 다릅니다.
   집에서는 깃발이 아니라 현관문입니다. "아빠를 따라 집을 나선다"는
   이야기가 골에서 읽혀야 하기 때문입니다. */
function drawGoal(ctx, px, py, t, th) {
  if (th === 'house') { drawDoorGoal(ctx, px, py, t); return; }
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

/* 현관문 (1스테이지 골).
   바닥(py + TILE)에 서 있고 높이는 4타일입니다. 깃발과 같은 자리를 차지하도록
   맞춰 두었습니다 — 충돌 상자는 js/game.js 의 goalBox 가 정합니다. */
function drawDoorGoal(ctx, px, py, t) {
  const w = 60, h = TILE * 4;
  const x = px + TILE / 2 - w / 2;
  const y = py + TILE - h;

  /* 문 뒤에서 새어 나오는 아침 햇살 — 아이가 "여기로 가면 된다"를 알아보게 */
  ctx.save();
  ctx.globalAlpha = 0.18 + Math.sin(t * 0.05) * 0.06;
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(x - 14, y - 10, w + 28, h + 12);
  ctx.restore();

  ctx.fillStyle = '#3a2412';                      // 문틀 (최암부)
  ctx.fillRect(x - 6, y - 8, w + 12, h + 8);
  ctx.fillStyle = '#a07840';                      // 문틀 안쪽
  ctx.fillRect(x - 3, y - 5, w + 6, h + 5);
  ctx.fillStyle = '#c99a5c';                      // 문짝
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#e8c48a';                      // 위쪽 밝은 베벨
  ctx.fillRect(x, y, w, 4);
  ctx.fillRect(x, y, 4, h);
  ctx.fillStyle = '#8f6434';                      // 아래·오른쪽 그늘
  ctx.fillRect(x, y + h - 5, w, 5);
  ctx.fillRect(x + w - 5, y, 5, h);

  /* 문짝 패널 두 칸 */
  for (let i = 0; i < 2; i++) {
    const py2 = y + 14 + i * (h / 2 - 6);
    ctx.fillStyle = '#8f6434';
    ctx.fillRect(x + 10, py2, w - 20, h / 2 - 22);
    ctx.fillStyle = '#e8c48a';
    ctx.fillRect(x + 12, py2 + 2, w - 24, h / 2 - 26);
    ctx.fillStyle = '#c99a5c';
    ctx.fillRect(x + 14, py2 + 4, w - 28, h / 2 - 30);
  }

  /* 손잡이 */
  ctx.fillStyle = '#3a2412';
  ctx.beginPath(); ctx.arc(x + w - 12, y + h / 2, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd451';
  ctx.beginPath(); ctx.arc(x + w - 12, y + h / 2, 4, 0, Math.PI * 2); ctx.fill();

  /* 현관 매트 */
  ctx.fillStyle = '#3a2030';
  ctx.fillRect(x - 10, py + TILE - 8, w + 20, 8);
  ctx.fillStyle = '#f0a8bf';
  ctx.fillRect(x - 8, py + TILE - 6, w + 16, 5);

  /* 안내 글자 */
  ctx.save();
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = 'rgba(0,0,0,.55)';
  ctx.lineWidth = 4;
  ctx.fillStyle = '#fff';
  const label = '아빠한테 가자!';
  const ly = y - 20 + Math.round(Math.sin(t * 0.06) * 2);
  ctx.strokeText(label, x + w / 2, ly);
  ctx.fillText(label, x + w / 2, ly);
  ctx.restore();
}

/* ── 집 안 배경 ──
 * 언덕·구름 대신 벽지 / 액자 / 창문 / 가구 실루엣이 지나갑니다.
 * 멀리 있는 것일수록 천천히 움직이게 해서 깊이를 만듭니다. */
function drawHouseBackground(ctx, camX, c, t) {
  const bands = c.sky;
  const h = Math.ceil(VIEW_H / bands.length);
  for (let i = 0; i < bands.length; i++) {
    ctx.fillStyle = bands[i];
    ctx.fillRect(0, i * h, VIEW_W, h);
    if (i > 0) {
      ctx.fillStyle = bands[i - 1];
      for (let x = 0; x < VIEW_W; x += 8) {
        ctx.fillRect(x, i * h, 4, 4);
        ctx.fillRect(x + 4, i * h + 4, 4, 4);
      }
    }
  }

  const ground = VIEW_H - TILE * 2;

  /* 벽지 세로 줄무늬 */
  const stripeSpan = 96;
  ctx.fillStyle = 'rgba(214, 160, 120, .16)';
  for (let i = -1; i < VIEW_W / stripeSpan + 2; i++) {
    const x = i * stripeSpan - ((camX * 0.35) % stripeSpan);
    ctx.fillRect(x, 0, 22, ground);
  }

  /* 창문 — 밖은 이미 환합니다. 아빠가 벌써 나갔다는 뜻입니다. */
  const winSpan = 940;
  for (let i = 0; i < 3; i++) {
    const x = ((i * winSpan - camX * 0.3) % (winSpan * 3) + winSpan * 3) % (winSpan * 3) - 200;
    const y = 74, w = 150, hh = 130;
    ctx.fillStyle = '#7a5334'; ctx.fillRect(x - 6, y - 6, w + 12, hh + 12);
    ctx.fillStyle = '#c99a5c'; ctx.fillRect(x - 3, y - 3, w + 6, hh + 6);
    ctx.fillStyle = '#bfe6ff'; ctx.fillRect(x, y, w, hh);
    ctx.fillStyle = '#e8f6ff'; ctx.fillRect(x, y, w, hh / 2);
    ctx.fillStyle = '#7a5334';
    ctx.fillRect(x + w / 2 - 3, y, 6, hh);
    ctx.fillRect(x, y + hh / 2 - 3, w, 6);
  }

  /* 액자 */
  const frSpan = 330;
  for (let i = 0; i < 8; i++) {
    const span = frSpan * 8;
    const x = ((i * frSpan - camX * 0.3) % span + span) % span - 150;
    if (i % 3 === 1) continue;          /* 가끔 비워야 자연스럽습니다 */
    const w = i % 2 ? 62 : 46, hh = i % 2 ? 46 : 58;
    const y = 120 + (i % 3) * 26;
    ctx.fillStyle = '#5c3a1c'; ctx.fillRect(x, y, w, hh);
    ctx.fillStyle = '#e0b077'; ctx.fillRect(x + 3, y + 3, w - 6, hh - 6);
    ctx.fillStyle = ['#ffd0e0', '#cfe6ff', '#d8f0c0'][i % 3];
    ctx.fillRect(x + 7, y + 7, w - 14, hh - 14);
  }

  /* 가구 실루엣 — 바닥에 붙여 놓아야 방처럼 보입니다.
     전체를 반투명하게 깔아 "밟을 수 있는 것"과 확실히 구분합니다.
     (불투명하게 그렸더니 배경 식탁과 전경 선반이 똑같아 보였습니다) */
  ctx.save();
  ctx.globalAlpha = 0.5;
  const furSpan = 520;
  for (let i = 0; i < 8; i++) {
    const span = furSpan * 8;
    const x = ((i * furSpan - camX * 0.55) % span + span) % span - 260;
    const kind = i % 3;
    if (kind === 0) {
      /* 소파 */
      const w = 190, hh = 78, y = ground - hh;
      ctx.fillStyle = c.hill[2]; ctx.fillRect(x, y, w, hh);
      ctx.fillStyle = c.hill[0]; ctx.fillRect(x + 4, y + 4, w - 8, 26);
      ctx.fillStyle = c.hill[1]; ctx.fillRect(x + 4, y + 30, w - 8, hh - 34);
      ctx.fillStyle = c.hill[2];
      ctx.fillRect(x, y + 20, 22, hh - 20);
      ctx.fillRect(x + w - 22, y + 20, 22, hh - 20);
      ctx.fillRect(x + w / 2 - 2, y + 30, 4, hh - 34);
    } else if (kind === 1) {
      /* 책장 */
      const w = 120, hh = 160, y = ground - hh;
      ctx.fillStyle = c.hill[2]; ctx.fillRect(x, y, w, hh);
      ctx.fillStyle = c.hill[1]; ctx.fillRect(x + 5, y + 5, w - 10, hh - 10);
      for (let k = 0; k < 3; k++) {
        const sy = y + 12 + k * ((hh - 20) / 3);
        ctx.fillStyle = c.hill[2];
        ctx.fillRect(x + 5, sy + (hh - 20) / 3 - 6, w - 10, 6);
        for (let b = 0; b < 5; b++) {
          ctx.fillStyle = ['#d9a79c', '#9fb2cc', '#d8c9a0', '#a8c4ac', '#bfaacc'][(k + b) % 5];
          ctx.fillRect(x + 10 + b * 20, sy, 14, (hh - 20) / 3 - 8);
        }
      }
    } else {
      /* 식탁 */
      const w = 160, hh = 92, y = ground - hh;
      ctx.fillStyle = c.hill[2]; ctx.fillRect(x, y, w, 14);
      ctx.fillStyle = c.hill[0]; ctx.fillRect(x + 3, y + 2, w - 6, 6);
      ctx.fillStyle = c.hill[1];
      ctx.fillRect(x + 14, y + 14, 12, hh - 14);
      ctx.fillRect(x + w - 26, y + 14, 12, hh - 14);
    }
  }

  ctx.restore();

  /* 벽과 바닥이 만나는 걸레받이 */
  ctx.fillStyle = c.hill[2];
  ctx.fillRect(0, ground - 10, VIEW_W, 10);
  ctx.fillStyle = c.hill[0];
  ctx.fillRect(0, ground - 10, VIEW_W, 3);
}

/* 배경 — 그라디언트 대신 색 계단 + 디더링, 테두리 있는 언덕 */
function drawBackground(ctx, camX, th, t) {
  const c = THEME[th] || THEME.day;
  if (th === 'house') { drawHouseBackground(ctx, camX, c, t); return; }
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
