/* ============================================================
 *  주인공 나율이 도트
 *  앞머리 단발 + 정수리 꽁지머리(빨간 머리끈) + 분홍 원피스.
 *  작은 상태 : 24 x 28 도트 (화면에서는 2배 = 48 x 56)
 *  큰 상태   : 26 x 32 도트 (화면에서는 2배 = 52 x 64)
 *  자세한 규칙은 docs/PIXEL_STYLE.md 를 보세요.
 * ========================================================== */

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

const NAYUL_BIG = NAYUL;   /* 큰 상태 전용 그림이 생기면 여기에 넣습니다 */

/*
 * o = { facing, state('idle'|'run'|'jump'|'hurt'), t, big, blink }
 * (x, y, w, h) 는 충돌 상자. 도트 그림은 그 상자 가운데/바닥에 맞춰 그립니다.
 *
 * 프레임 세트에 넣을 수 있는 이름
 *   idle           서 있기 (필수)
 *   blink          눈 감은 서 있기 (없으면 깜빡이지 않습니다)
 *   walk1 ~ walk4  걷기 (있는 만큼 순서대로 돌립니다)
 *   jump           올라갈 때
 *   fall           내려올 때 (없으면 jump 를 씁니다)
 *   hurt           맞았을 때
 */
function drawNayul(ctx, x, y, w, h, o) {
  const set = (o.big && typeof NAYUL_BIG !== 'undefined') ? NAYUL_BIG : NAYUL;
  const walk = [set.walk1, set.walk2, set.walk3, set.walk4].filter(Boolean);

  let grid;
  if (o.state === 'hurt') grid = set.hurt || set.idle;
  else if (o.state === 'jump') grid = (o.vy > 1 && set.fall) ? set.fall : (set.jump || set.idle);
  else if (o.state === 'run' && walk.length) grid = walk[Math.floor(o.t / 6) % walk.length];
  else if (o.blink && set.blink) grid = set.blink;
  else grid = set.idle;

  const scale = Math.max(2, Math.round(h / set.idle.length));
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
  if (o.big && set === NAYUL) {
    drawStar(ctx, x + w / 2, py - 6 + Math.sin(o.t * 0.12) * 2, 6, '#ffe66d');
  }
}
