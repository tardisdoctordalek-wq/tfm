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

function drawWalker(ctx, x, y, w, h, t, dir, squashed) {
  const g = squashed ? WALKER_FLAT : WALKER[Math.floor(t / 12) % WALKER.length];
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

function drawFlyer(ctx, x, y, w, h, t, dir) {
  const g = FLYER[Math.floor(t / 10) % FLYER.length];
  const s = 2;
  drawPixels(ctx, g, x + w / 2 - (g[0].length * s) / 2, y + h / 2 - (g.length * s) / 2, s, dir < 0);
}
