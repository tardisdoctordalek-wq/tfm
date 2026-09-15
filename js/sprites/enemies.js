/* ============================================================
 *  적 도트 — 밤톨이(걷는 적), 날개새(나는 적)
 *  마리오 월드풍: 굵은 테두리 + 위쪽 밝은 면 + 아래 그늘
 * ========================================================== */

/* 밤톨이 걷기 2프레임 (16 x 16) */
const WALKER = [
  [
    '................',
    '................',
    '................',
    '.....jjjjjj.....',
    '....jUUUUUUj....',
    '...jUUUUUUUUj...',
    '..jUWUUUUUWUUj..',
    '..jWWWUUUWWWUj..',
    '.jNEEWUUUEEWNNj.',
    '.jNEEWUUUEEWNNj.',
    '..jNWNNNNNWNNj..',
    '..jNNNEEEENNNj..',
    '.jnnnnnnnnnnnnj.',
    '.jnnnnnnnnnnnjj.',
    '..jjjjjjjjjjj...',
    '..jjjj...jjjj...',
  ],
  [
    '................',
    '................',
    '................',
    '.....jjjjjj.....',
    '....jUUUUUUj....',
    '...jUUUUUUUUj...',
    '..jUWUUUUUWUUj..',
    '..jWWWUUUWWWUj..',
    '.jNWEEUUUWEENNj.',
    '.jNWEEUUUWEENNj.',
    '..jNWNNNNNWNNj..',
    '..jNNNEEEENNNj..',
    '.jnnnnnnnnnnnnj.',
    '.jjnnnnnnnnnjjj.',
    '...jjjjjjjjj....',
    '...jjjj.jjjj....',
  ],
];

/* 밟혀서 납작해진 모습 */
const WALKER_FLAT = [
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
  '....jjjjjjjj....',
  '..jjNNNNNNNNjj..',
  '.jNNNNNNNNNNNNj.',
  '..jnnnnnnnnnnj..',
  '..jjjjjjjjjjjj..',
];


/* ============================================================
 *  1스테이지(집) 적
 *   먼지뭉치 — 소파 밑에서 굴러 나온 먼지 덩어리 (걷는 적)
 *   나방     — 형광등에 붙어 있던 나방 (나는 적)
 *  밤톨이·날개새와 크기 규격이 같아서 충돌 상자를 그대로 씁니다.
 * ========================================================== */

/* 먼지뭉치 걷기 2프레임 (16 x 16).
   두 번째 프레임은 몸 전체가 1칸 위로 올라가 통통 튀어 보입니다
   (docs/PIXEL_STYLE.md 6번 규칙). */
const DUST = [
  [
    '................',
    '................',
    '...JJ..JJ..JJ...',
    '..JAAJJAAJJAAJ..',
    '..JAAAAAAAAAAJ..',
    '.JAAAAAAAAAAAAJ.',
    '.JADDDDDDDDDDAJ.',
    'JADDEEDDDDEEDDAJ',
    'JADDEEDDDDEEDDAJ',
    'JADDDDDWWDDDDDAJ',
    '.JDDDDDDDDDDDDJ.',
    '.JIIDDDDDDDDIIJ.',
    '.JJIIIIIIIIIIJJ.',
    '...JJIIIIIIJJ...',
    '.....JJ..JJ.....',
    '................',
  ],
  [
    '................',
    '...JJ..JJ..JJ...',
    '..JAAJJAAJJAAJ..',
    '..JAAAAAAAAAAJ..',
    '.JAAAAAAAAAAAAJ.',
    '.JADDDDDDDDDDAJ.',
    'JADDEEDDDDEEDDAJ',
    'JADDEEDDDDEEDDAJ',
    'JADDDDDWWDDDDDAJ',
    '.JDDDDDDDDDDDDJ.',
    '.JIIDDDDDDDDIIJ.',
    '.JJIIIIIIIIIIJJ.',
    '...JJIIIIIIJJ...',
    '....JJ..JJ......',
    '................',
    '................',
  ],
];

/* 밟혀서 납작해진 먼지뭉치 */
const DUST_FLAT = [
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
  '....JJJJJJJJ....',
  '..JJAADDDDAAJJ..',
  '..JDDDDDDDDDDJ..',
  '..JIIIIIIIIIIJ..',
  '..JJJJJJJJJJJJ..',
];

/* 나방 날갯짓 2프레임 (20 x 16). 좌우 대칭이라 반쪽을 뒤집어 만들었습니다. */
const MOTH = [
  [
    '....................',
    '......ll....ll......',
    '.......ll..ll.......',
    '........leel........',
    '....llllEeeEllll....',
    '.lllZZZlEeeElZZZlll.',
    '.lZZZZZleeeelZZZZZl.',
    'lZZffZZleeeelZZffZZl',
    'lZffffZlfeeflZffffZl',
    'lZZffZZlfeeflZZffZZl',
    '.lZZZZZleeeelZZZZZl.',
    '.llZZZZlfffflZZZZll.',
    '...llZZlfffflZZll...',
    '.....llllffllll.....',
    '........llll........',
    '....................',
  ],
  [
    '....................',
    '......ll....ll......',
    '.......ll..ll.......',
    '........leel........',
    '.....lllEeeElll.....',
    '...lllZlEeeElZlll...',
    '...lZZZleeeelZZZl...',
    '..llZZfleeeelfZZll..',
    '..lZZfflfeeflffZZl..',
    '..lZZfflfeeflffZZl..',
    '..llZZZleeeelZZZll..',
    '...lZZflfffflfZZl...',
    '...llZflfffflfZll...',
    '.....llllffllll.....',
    '........llll........',
    '....................',
  ],
];

/* ─────────── 테마별 적 도트 고르기 ───────────
 * 스테이지마다 적이 다릅니다. 도트만 갈아 끼우고 움직임(js/entities.js 의
 * Walker / Flyer)은 그대로 씁니다. */
const WALKER_SETS = {
  house: { walk: DUST, flat: DUST_FLAT },
};
const FLYER_SETS = {
  house: MOTH,
};

function drawWalker(ctx, x, y, w, h, t, dir, squashed, theme) {
  const set = WALKER_SETS[theme] || { walk: WALKER, flat: WALKER_FLAT };
  const g = squashed ? set.flat : set.walk[Math.floor(t / 12) % set.walk.length];
  const s = 2;
  const sw = g[0].length * s;
  ctx.fillStyle = 'rgba(0,0,0,.20)';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h, w * 0.45, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  drawPixels(ctx, g, x + w / 2 - sw / 2, y + h - g.length * s, s, dir < 0);
}

/* 날개새 날갯짓 2프레임 (20 x 16) */
const FLYER = [
  [
    '....................',
    '....................',
    '..zzzzz.............',
    '..zvvvvz............',
    '...zvvvvz...........',
    '....zvvvvzzz........',
    '.....zvvvvvVzz......',
    '......zvvvvWWVz.....',
    '......zvvvWWEEz.....',
    '......zVVVVWEVOzz...',
    '......zVVVVVVVOzzz..',
    '......zVVVVVVVz.....',
    '.......zzVVVzz......',
    '.........zzz........',
    '....................',
    '....................',
  ],
  [
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '.........zzz........',
    '.......zzVVVzz......',
    '......zVVVVWWVz.....',
    '......zVVVWWEEz.....',
    '.zzzzzvVVVVWEVOzz...',
    '.zvvvvvvVVVVVVOzzz..',
    '..zvvvvvvVVVVVz.....',
    '...zvvvvvvVVzz......',
    '....zvvvvvvz........',
    '.....zzzzzz.........',
    '....................',
  ],
];

function drawFlyer(ctx, x, y, w, h, t, dir, theme) {
  const set = FLYER_SETS[theme] || FLYER;
  const g = set[Math.floor(t / 10) % set.length];
  const s = 2;
  drawPixels(ctx, g, x + w / 2 - (g[0].length * s) / 2, y + h / 2 - (g.length * s) / 2, s, dir < 0);
}
