/* ============================================================
 *  파워업 — 스테이지마다 다른 "기믹" (너구리마리오식)
 *
 *  스테이지 1 (집)      청소기 : 앞쪽 적을 빨아들여 없앱니다
 *  스테이지 2 (길거리)  자동차 : (다음 작업)
 *  스테이지 3 (한방병원) 침    : (다음 작업)
 *
 *  ─ 어떤 파워가 나올지는 js/levels.js 의 레벨 정의에 `power:` 로 적습니다.
 *    같은 `*` 블록이 스테이지마다 다른 물건을 내놓습니다.
 *  ─ 파워는 "맞으면 잃습니다". 마리오 불꽃과 같은 3단 구조입니다.
 *      파워 있는 나율  →(맞음)→  큰 나율  →(맞음)→  작은 나율  →(맞음)→  죽음
 *  ─ 주인공 도트(js/sprites/player.js) 는 건드리지 않습니다.
 *    1904줄짜리 생성물이라 손에 물건을 쥔 그림을 새로 뽑으면 걷기 4프레임 ×
 *    작은/큰 상태를 전부 다시 만들어야 합니다. 그래서 물건만 나율이 위에
 *    덧그립니다. 자동차·침도 같은 방식으로 붙일 수 있습니다.
 * ========================================================== */

/* ─────────── 청소기 도트 ───────────
 * 블록에서 나왔을 때 떠 있는 모습 (16 x 16, 배율 2 → 화면 32 x 32)
 * 위로 뻗은 관 + 바닥의 넓은 흡입구. 작은 크기에서도 청소기로 읽히는 실루엣입니다. */
const VACUUM = [
  '..........@@@...',
  '.........@ii@...',
  '.........@im@...',
  '........@iim@...',
  '........@im@....',
  '.......@iim@....',
  '.......@im@.....',
  '......@iim@.....',
  '.....@@im@@.....',
  '...@@@mmmm@@@...',
  '..@iimmmmmmmm@..',
  '..@immmmmmmmm@..',
  '..@+mm++++mm+@..',
  '..@++++++++++@..',
  '..@@@@@@@@@@@@..',
  '................',
];

/* 나율이가 손에 쥐고 있는 모습 (12 x 7, 배율 2 → 화면 24 x 14)
 * 기본은 오른쪽을 보는 그림이고, 왼쪽을 볼 때는 뒤집어 그립니다. */
const VACUUM_HELD = [
  '..@@@@@.....',
  '.@iimmm@....',
  '@immmmmm@@@.',
  '@immmmmmmm@@',
  '@+mm+++++mm@',
  '@+++++++++@@',
  '.@@@@@@@@@@.',
];

/* 흡입 성능 — 여기 숫자만 바꾸면 난이도가 조절됩니다 */
const VACUUM_RANGE = TILE * 3.2;   // 앞쪽으로 빨아들이는 거리 (약 102px)
const VACUUM_PULL = 2.6;           // 적이 끌려오는 속도 (px/프레임)
const VACUUM_EAT = 20;             // 이만큼 가까워지면 통 안으로 들어갑니다

/* 청소기 노즐 끝 좌표 — 흡입 범위와 그림이 같은 점을 기준으로 삼아야
   "빨리는 것처럼" 보입니다. 따로 계산하면 어긋납니다. */
function vacuumNozzle(p) {
  return {
    x: p.facing > 0 ? p.x + p.w + 10 : p.x - 10,
    y: p.y + p.h * 0.55,
  };
}

const POWERS = {
  vacuum: {
    name: '청소기',
    icon: VACUUM,

    /* 흡입 범위 (사각형). 세로는 나율이 키보다 조금 넉넉하게 잡아
       아이가 대충 겨눠도 빨립니다. */
    zone(p) {
      const h = p.h + 24;
      return {
        x: p.facing > 0 ? p.x + p.w : p.x - VACUUM_RANGE,
        y: p.y - 12,
        w: VACUUM_RANGE,
        h,
      };
    },

    /* 매 프레임 호출됩니다. pressing = 액션 버튼을 누르고 있는가 */
    update(p, game, pressing) {
      const on = !!pressing && !p.dying && p.controllable;

      if (on !== p.actionOn) {
        if (on) Sound.vacuumOn(); else Sound.vacuumOff();
        p.actionOn = on;
      }

      if (!on) {
        /* 버튼을 떼면 붙잡아 두었던 표시를 반드시 풀어야 합니다.
           안 풀면 적이 그 자리에 얼어붙은 채로 남습니다. */
        for (const e of game.entities) if (e.sucked) e.sucked = false;
        return;
      }

      const zone = this.zone(p);
      const noz = vacuumNozzle(p);
      const cx = p.x + p.w / 2;
      const cy = p.y + p.h * 0.55;

      for (const e of game.entities) {
        if (!e.alive) continue;
        const suckable = (e instanceof Walker || e instanceof Flyer) ? !e.dead
          : (e instanceof Coin);
        if (!suckable) continue;

        if (!overlaps(zone, e)) { e.sucked = false; continue; }
        e.sucked = true;

        const ex = e.x + e.w / 2, ey = e.y + e.h / 2;
        const dx = cx - ex, dy = cy - ey;
        const dist = Math.max(1, Math.hypot(dx, dy));

        if (dist < VACUUM_EAT) {
          /* 코인은 원래 충돌 처리에서 먹히므로 여기서는 끌어오기만 합니다 */
          if (e instanceof Coin) continue;
          e.alive = false;
          game.score += SCORE.SUCK;
          Sound.suck();
          game.effects.push(new FloatText(ex, ey, '+' + SCORE.SUCK, '#b8f4ff'));
          for (let i = 0; i < 5; i++) {
            game.effects.push(new Particle(
              noz.x, noz.y,
              (Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 2.4,
              i % 2 ? '#b8f4ff' : '#4fc8e8', 3, 16
            ));
          }
          continue;
        }

        e.x += (dx / dist) * VACUUM_PULL;
        e.y += (dy / dist) * VACUUM_PULL;
      }

      /* 빨려 들어가는 먼지 — 범위 안에서 노즐 쪽으로 흘러갑니다 */
      if (game.t % 3 === 0) {
        const far = p.facing > 0 ? zone.x + zone.w : zone.x;
        game.effects.push(new SuckDust(
          far - (Math.random() - 0.5) * 40,
          zone.y + Math.random() * zone.h,
          noz.x, noz.y
        ));
      }
    },

    /* 흡입 원뿔 — 나율이보다 뒤에 그려야 얼굴을 가리지 않습니다 */
    drawBehind(ctx, p) {
      if (!p.actionOn) return;
      const noz = vacuumNozzle(p);
      const dir = p.facing > 0 ? 1 : -1;
      const tip = noz.x + dir * VACUUM_RANGE;
      const spread = p.h * 0.5;
      ctx.save();
      for (let i = 0; i < 3; i++) {
        const k = (i + (p.t * 0.06) % 1) / 3;
        ctx.globalAlpha = 0.38 * (1 - k);
        ctx.fillStyle = i % 2 ? '#b8f4ff' : '#4fc8e8';
        ctx.beginPath();
        ctx.moveTo(noz.x, noz.y - 5);
        ctx.lineTo(noz.x + (tip - noz.x) * (0.4 + k * 0.6), noz.y - spread * (0.4 + k));
        ctx.lineTo(noz.x + (tip - noz.x) * (0.4 + k * 0.6), noz.y + spread * (0.4 + k));
        ctx.lineTo(noz.x, noz.y + 5);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    },

    /* 손에 쥔 청소기 */
    drawHeld(ctx, p) {
      const s = 2;
      const w = VACUUM_HELD[0].length * s;
      const shake = p.actionOn ? (p.t % 4 < 2 ? 1 : 0) : 0;
      const x = p.facing > 0 ? p.x + p.w - 10 : p.x - w + 10;
      const y = p.y + p.h * 0.45 + shake;
      drawPixels(ctx, VACUUM_HELD, x, y, s, p.facing < 0);
    },
  },
};
