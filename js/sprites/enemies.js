/* ============================================================
 *  적 도트
 *  밤톨이(걸어다니는 적), 날개새(날아다니는 적)
 * ========================================================== */

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
