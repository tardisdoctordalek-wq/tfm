/* ============================================================
 *  아이템 도트 — 코인, 하트
 *  마리오 월드풍으로 굵은 테두리와 또렷한 명암을 넣었습니다.
 *  코인은 눌러서 회전을 흉내내지 않고, 회전 프레임을 직접 그립니다.
 * ========================================================== */

/* 코인 회전 4프레임 (12 x 12) */
const COIN = [
  [
    '............',
    '....oooo....',
    '..ooyaayoo..',
    '..oaaaaaao..',
    '.oyaaaaaayo.',
    '.oaaaaaaaao.',
    '.oyaccccayo.',
    '.oyccccccyo.',
    '..occcccco..',
    '..ooyyyyoo..',
    '....oooo....',
    '............',
  ],
  [
    '............',
    '.....oo.....',
    '....oaao....',
    '...oyaayo...',
    '...oaaaao...',
    '...oaaaao...',
    '...oaccao...',
    '...occcco...',
    '...oyccyo...',
    '....oyyo....',
    '.....oo.....',
    '............',
  ],
  [
    '............',
    '.....oo.....',
    '.....oo.....',
    '....oaao....',
    '....oaao....',
    '....oaao....',
    '....oaao....',
    '....oaao....',
    '....oyyo....',
    '.....oo.....',
    '.....oo.....',
    '............',
  ],
  [
    '............',
    '.....oo.....',
    '....oaao....',
    '...oyaayo...',
    '...oaaaao...',
    '...oaaaao...',
    '...oaccao...',
    '...occcco...',
    '...oyccyo...',
    '....oyyo....',
    '.....oo.....',
    '............',
  ],
];

function drawCoin(ctx, cx, cy, r, t) {
  const g = COIN[Math.floor(t / 7) % COIN.length];
  const s = 2;
  drawPixels(ctx, g, cx - (g[0].length * s) / 2, cy - (g.length * s) / 2, s, false);
}

/* 하트 (12 x 11) */
const HEART = [
  '............',
  '..uuu..uuu..',
  '.utTTuutttu.',
  'uttTTTtttttu',
  'uttTTttttttu',
  '.uttttttttu.',
  '..uttttttu..',
  '...uttttu...',
  '....uttu....',
  '.....uu.....',
  '.....uu.....',
];

function drawHeart(ctx, cx, cy, r, t) {
  const s = 2;
  const bob = Math.round(Math.sin(t * 0.1)) * 2;
  drawPixels(ctx, HEART, cx - (HEART[0].length * s) / 2, cy - (HEART.length * s) / 2 + bob, s, false);
}
