/* ============================================================
 *  물리 / 충돌 / 등장인물
 * ========================================================== */

/* ─────────── 타일 판정 ─────────── */
function tileChar(level, col, row) {
  if (row < 0 || row >= level.h || col < 0 || col >= level.w) return ' ';
  return level.grid[row][col];
}

function isSolid(level, col, row) {
  if (col < 0 || col >= level.w) return true;   // 화면 좌우 끝은 벽
  if (row < 0 || row >= level.h) return false;  // 위/아래는 뚫려 있음
  return SOLID.indexOf(level.grid[row][col]) >= 0;
}

function isOneWay(level, col, row) {
  return tileChar(level, col, row) === ONEWAY;
}

/* 가로 이동 후 벽 밀어내기 */
function collideX(e, level) {
  const EPS = 0.01;   /* 1px 을 빼면 벽과 바닥에 그만큼 틈이 생겨 떨립니다 */
  const r0 = Math.floor(e.y / TILE);
  const r1 = Math.floor((e.y + e.h - EPS) / TILE);
  if (e.vx > 0) {
    const c = Math.floor((e.x + e.w - EPS) / TILE);
    for (let r = r0; r <= r1; r++) {
      if (isSolid(level, c, r)) {
        e.x = c * TILE - e.w;
        e.vx = 0;
        return true;
      }
    }
  } else if (e.vx < 0) {
    const c = Math.floor(e.x / TILE);
    for (let r = r0; r <= r1; r++) {
      if (isSolid(level, c, r)) {
        e.x = (c + 1) * TILE;
        e.vx = 0;
        return true;
      }
    }
  }
  return false;
}

/* 세로 이동 후 바닥/천장 처리. onBump(col,row) 은 머리로 블록을 칠 때 호출 */
function collideY(e, level, prevBottom, opts) {
  const o = opts || {};
  const EPS = 0.01;
  const c0 = Math.floor(e.x / TILE);
  const c1 = Math.floor((e.x + e.w - EPS) / TILE);
  e.onGround = false;

  if (e.vy > 0) {
    const r = Math.floor((e.y + e.h - EPS) / TILE);
    for (let c = c0; c <= c1; c++) {
      const landsOnSolid = isSolid(level, c, r);
      const landsOnPlatform = !o.ignoreOneWay && isOneWay(level, c, r) && prevBottom <= r * TILE + 2;
      if (landsOnSolid || landsOnPlatform) {
        e.y = r * TILE - e.h;
        e.vy = 0;
        e.onGround = true;
        return 'ground';
      }
    }
  } else if (e.vy < 0) {
    const r = Math.floor(e.y / TILE);
    for (let c = c0; c <= c1; c++) {
      if (isSolid(level, c, r)) {
        e.y = (r + 1) * TILE;
        e.vy = 0;
        if (o.onBump) o.onBump(c, r);
        return 'ceil';
      }
    }
  }

  /* 발이 바닥에 딱 맞게 놓인 프레임에는 위 검사가 아무것도 못 찾아서
     "공중에 떠 있다"고 잘못 판정됩니다. 그래서 평지를 걷는데도 한 프레임씩
     점프 자세가 섞여 나왔습니다. 발 바로 아래 한 칸을 확인해 바로잡습니다. */
  if (!e.onGround && e.vy >= 0) {
    const r = Math.floor((e.y + e.h + 1) / TILE);
    for (let c = c0; c <= c1; c++) {
      const platform = !o.ignoreOneWay && isOneWay(level, c, r) && (e.y + e.h) <= r * TILE + 2;
      if (isSolid(level, c, r) || platform) {
        e.onGround = true;
        e.y = r * TILE - e.h;   /* 바닥에 딱 붙입니다 */
        e.vy = 0;               /* 안 그러면 매 프레임 조금씩 가라앉았다 올라와 떨립니다 */
        break;
      }
    }
  }
  return null;
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/* ─────────────────────────────────────────────
 *  주인공 나율이
 * ───────────────────────────────────────────── */
class Player {
  constructor(x, y) {
    this.big = false;
    this.power = null;     /* 'vacuum' 같은 파워업 종류. 없으면 null */
    this.actionOn = false; /* 액션 버튼을 누르고 있는 중인가 */
    this.w = 24; this.h = 56;
    this.x = x; this.y = y - this.h;
    this.vx = 0; this.vy = 0;
    this.facing = 1;
    this.onGround = false;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.jumping = false;
    this.invuln = 0;
    this.animT = 0;        /* 걸어간 거리. 발 바꾸는 속도를 여기에 맞춥니다 */
    this.skidding = false; /* 달리다 반대 방향을 눌러 미끄러지는 중 */
    this.moved = 0;        /* 이번 프레임에 실제로 움직인 거리 */
    this.t = 0;
    this.blinkTimer = 120 + Math.random() * 180;
    this.dying = false;
    this.dieTimer = 0;
    this.controllable = true;
  }

  setBig(big) {
    const bottom = this.y + this.h;
    this.big = big;
    this.w = big ? 28 : 24;
    this.h = big ? 64 : 56;
    this.y = bottom - this.h;
  }

  /* 파워업을 얻거나(kind) 잃습니다(null).
     마리오 불꽃과 같이 파워를 얻으면 큰 상태도 함께 됩니다. */
  setPower(kind) {
    this.power = kind || null;
    if (kind) this.setBig(true);
    else if (this.actionOn) { Sound.vacuumOff(); this.actionOn = false; }
    const def = kind ? POWERS[kind] : null;
    if (typeof Input !== 'undefined' && Input.setActionLabel) {
      Input.setActionLabel(def ? def.name : '액션');
    }
  }

  get state() {
    if (this.dying) return 'hurt';
    if (!this.onGround) return 'jump';
    if (this.skidding) return 'skid';          /* 달리다 반대로 꺾을 때 */
    if (this.moved > 0.2) return 'run';        /* 실제로 움직였을 때만 걷기 */
    return 'idle';
  }

  update(level, game) {
    this.t++;
    this.blinkTimer--;
    if (this.blinkTimer < -8) this.blinkTimer = 120 + Math.random() * 200;
    if (this.invuln > 0) this.invuln--;

    /* 죽는 중: 위로 튀었다가 아래로 떨어지는 연출 */
    if (this.dying) {
      this.moved = 0;
      this.dieTimer++;
      if (this.dieTimer > 20) {
        this.vy = Math.min(this.vy + PHYS.GRAVITY, PHYS.MAX_FALL);
        this.y += this.vy;
      }
      return;
    }

    const dir = (Input.down.right ? 1 : 0) - (Input.down.left ? 1 : 0);
    const running = Input.down.run;
    const maxSpeed = running ? PHYS.MAX_RUN : PHYS.MAX_WALK;
    const accel = this.onGround ? PHYS.ACCEL : PHYS.AIR_ACCEL;

    /* 가던 방향과 반대를 누르면 미끄러집니다 (마리오의 돌아서기) */
    this.skidding = this.onGround && dir !== 0 && Math.abs(this.vx) > 1.2 &&
      Math.sign(this.vx) !== dir;

    if (this.controllable && dir !== 0) {
      this.vx += dir * accel;
      this.facing = dir;
      if (Math.abs(this.vx) > maxSpeed) this.vx = maxSpeed * Math.sign(this.vx);
    } else {
      this.vx *= this.onGround ? PHYS.FRICTION : 0.985;
      if (Math.abs(this.vx) < 0.05) this.vx = 0;
    }

    /* 점프: 코요테 타임 + 입력 버퍼 (어린이도 쉽게 조작되도록) */
    if (this.controllable && Input.pressed.jump) this.jumpBuf = PHYS.JUMP_BUFFER;
    else this.jumpBuf--;
    this.coyote = this.onGround ? PHYS.COYOTE : this.coyote - 1;

    if (this.jumpBuf > 0 && this.coyote > 0) {
      this.vy = PHYS.JUMP;
      this.jumpBuf = 0;
      this.coyote = 0;
      this.onGround = false;
      this.jumping = true;
      Sound.jump();
    }
    if (this.jumping && !Input.down.jump && this.vy < PHYS.JUMP_CUT) {
      this.vy = PHYS.JUMP_CUT;
      this.jumping = false;
    }
    if (this.vy > 0) this.jumping = false;

    /* 가로 이동 */
    const prevX = this.x;
    this.x += this.vx;
    if (this.x < 0) { this.x = 0; this.vx = 0; }
    collideX(this, level);

    /* 걷기 그림은 "실제로 움직인 거리" 에 맞춰 넘깁니다.
       속도(vx)가 아니라 실제 이동량을 쓰는 이유: 벽에 막혀 제자리걸음일 때
       속도는 있는데 움직이지는 않아서, 그림만 미친 듯이 넘어가 버립니다. */
    this.moved = Math.abs(this.x - prevX);
    if (this.moved < 0.2) this.animT = 0;
    else this.animT += this.moved;

    /* 세로 이동 */
    const prevBottom = this.y + this.h;
    this.prevBottom = prevBottom;
    this.vy = Math.min(this.vy + PHYS.GRAVITY, PHYS.MAX_FALL);
    this.y += this.vy;
    collideY(this, level, prevBottom, {
      ignoreOneWay: Input.down.crouch,
      onBump: (c, r) => game.hitBlock(c, r, this),
    });

    /* 파워업 사용 (청소기 흡입 등).
       적을 끌어당기는 처리가 여기서 일어나야 합니다. 이 뒤에 각 적의 update 가
       돌면서 끌려온 위치를 기준으로 움직이기 때문입니다. */
    const pw = this.power ? POWERS[this.power] : null;
    if (pw && pw.update) pw.update(this, game, Input.down.action);
    else if (this.actionOn) { Sound.vacuumOff(); this.actionOn = false; }

    /* 가시에 닿았는지 */
    const c0 = Math.floor((this.x + 4) / TILE);
    const c1 = Math.floor((this.x + this.w - 5) / TILE);
    const r0 = Math.floor((this.y + 4) / TILE);
    const r1 = Math.floor((this.y + this.h - 2) / TILE);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (tileChar(level, c, r) === HAZARD) { game.hurtPlayer(); return; }
      }
    }

    /* 화면 아래로 떨어짐 */
    if (this.y > VIEW_H + 80) game.killPlayer();
  }

  draw(ctx) {
    const pw = this.power ? POWERS[this.power] : null;
    /* 흡입 원뿔 같은 효과는 나율이보다 먼저 그려야 얼굴을 가리지 않습니다 */
    if (pw && pw.drawBehind) pw.drawBehind(ctx, this);

    /* 무적 중에는 깜빡입니다. 손에 든 물건도 같이 깜빡여야 따로 놀지 않습니다. */
    if (this.invuln > 0 && Math.floor(this.invuln / 4) % 2 === 1) return;

    drawNayul(ctx, this.x, this.y, this.w, this.h, {
      facing: this.facing,
      state: this.state,
      t: this.t,
      walkT: this.animT,
      vy: this.vy,
      big: this.big,
      blink: this.blinkTimer < 0,
    });
    if (pw && pw.drawHeld) pw.drawHeld(ctx, this);
  }
}

/* ─────────── 걸어다니는 적: 밤톨이 ─────────── */
class Walker {
  constructor(col, row, theme) {
    this.theme = theme;     /* 스테이지마다 도트가 다릅니다 (집=먼지뭉치) */
    this.w = 24; this.h = 24;
    this.x = col * TILE + 4;
    this.y = row * TILE + TILE - this.h;
    this.vx = -0.85;
    this.vy = 0;
    this.t = Math.floor(Math.random() * 20);
    this.dead = false;
    this.squash = 0;
    this.alive = true;
    this.sucked = false;   /* 청소기에 빨려 가는 중 */
  }

  update(level) {
    this.t++;
    if (this.dead) {
      this.squash--;
      if (this.squash <= 0) this.alive = false;
      return;
    }
    /* 청소기에 빨려 가는 중에는 스스로 걷지 않습니다.
       (이 update 가 청소기의 끌어당김 뒤에 돌기 때문에, 여기서 안 막으면
        끌어온 위치가 매 프레임 되돌려집니다) */
    if (this.sucked) return;

    this.x += this.vx;
    if (collideX(this, level)) this.vx = -Math.sign(this.vx || 1) * 0.85;

    const prevBottom = this.y + this.h;
    this.vy = Math.min(this.vy + PHYS.GRAVITY, PHYS.MAX_FALL);
    this.y += this.vy;
    collideY(this, level, prevBottom, {});

    /* 낭떠러지 앞에서는 돌아섭니다 (구덩이에 빠지지 않도록) */
    if (this.onGround) {
      const footCol = Math.floor((this.vx > 0 ? this.x + this.w + 2 : this.x - 2) / TILE);
      const footRow = Math.floor((this.y + this.h + 2) / TILE);
      if (!isSolid(level, footCol, footRow) && !isOneWay(level, footCol, footRow)) {
        this.vx = -this.vx;
      }
    }
    if (this.y > VIEW_H + 100) this.alive = false;
  }

  stomp() { this.dead = true; this.squash = 26; this.vx = 0; }

  draw(ctx) {
    drawWalker(ctx, this.x, this.y, this.w, this.h, this.t,
      Math.sign(this.vx) || 1, this.dead, this.theme);
  }
}

/* ─────────── 날아다니는 적: 날개새 ─────────── */
class Flyer {
  constructor(col, row, theme) {
    this.theme = theme;     /* 스테이지마다 도트가 다릅니다 (집=나방) */
    this.w = 26; this.h = 22;
    this.x = col * TILE + 3;
    this.baseY = row * TILE + 5;
    this.y = this.baseY;
    this.startX = this.x;
    this.range = TILE * 3;
    this.vx = -1.15;
    this.t = Math.floor(Math.random() * 40);
    this.dead = false;
    this.squash = 0;
    this.alive = true;
    this.vy = 0;
    this.sucked = false;   /* 청소기에 빨려 가는 중 */
  }

  update(level) {
    this.t++;
    if (this.dead) {
      this.vy += PHYS.GRAVITY;
      this.y += this.vy;
      this.squash--;
      if (this.squash <= 0 || this.y > VIEW_H + 60) this.alive = false;
      return;
    }
    if (this.sucked) return;   /* 청소기에 빨려 가는 중 */
    this.x += this.vx;
    if (Math.abs(this.x - this.startX) > this.range) this.vx = -this.vx;
    if (collideX(this, level)) this.vx = this.vx === 0 ? 1.15 : -Math.sign(this.vx) * 1.15;
    this.y = this.baseY + Math.sin(this.t * 0.05) * 20;
  }

  stomp() { this.dead = true; this.squash = 40; this.vy = -3; }

  draw(ctx) {
    if (this.dead) {
      ctx.save();
      ctx.globalAlpha = 0.7;
      drawFlyer(ctx, this.x, this.y, this.w, this.h, this.t, Math.sign(this.vx) || 1, this.theme);
      ctx.restore();
      return;
    }
    drawFlyer(ctx, this.x, this.y, this.w, this.h, this.t, Math.sign(this.vx) || 1, this.theme);
  }
}

/* ─────────── 코인 ─────────── */
class Coin {
  constructor(col, row) {
    this.w = 20; this.h = 20;
    this.x = col * TILE + 6;
    this.y = row * TILE + 6;
    this.t = Math.floor(Math.random() * 60);
    this.alive = true;
  }
  update() { this.t++; }
  draw(ctx) { drawCoin(ctx, this.x + this.w / 2, this.y + this.h / 2, 10, this.t); }
}

/* 블록에서 튀어나오는 코인 (점수만 주고 사라짐) */
class PopCoin {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.vy = -7.5;
    this.t = 0;
    this.alive = true;
  }
  update() {
    this.t++;
    this.vy += 0.5;
    this.y += this.vy;
    if (this.t > 34) this.alive = false;
  }
  draw(ctx) { drawCoin(ctx, this.x, this.y, 10, this.t * 2); }
}

/* ─────────── 하트 아이템 ─────────── */
class HeartItem {
  constructor(col, row) {
    this.w = 24; this.h = 22;
    this.x = col * TILE + 4;
    this.y = row * TILE + 5;
    this.targetY = this.y - TILE;
    this.t = 0;
    this.alive = true;
  }
  update() {
    this.t++;
    if (this.y > this.targetY) this.y -= 1.2;
  }
  draw(ctx) { drawHeart(ctx, this.x + this.w / 2, this.y + this.h / 2, 11, this.t); }
}

/* ─────────── 스테이지 파워업 아이템 (청소기 / 자동차 / 침) ───────────
 * 블록에서 나와 한 칸 떠오른 뒤 그 자리에 있습니다. HeartItem 과 같은 동작입니다. */
class PowerItem {
  constructor(col, row, kind) {
    this.kind = kind;
    this.w = 28; this.h = 28;
    this.x = col * TILE + 2;
    this.y = row * TILE + 4;
    this.targetY = this.y - TILE;
    this.t = 0;
    this.alive = true;
  }
  update() {
    this.t++;
    if (this.y > this.targetY) this.y -= 1.2;
  }
  draw(ctx) {
    const def = POWERS[this.kind];
    if (!def || !def.icon) return;
    const s = 2;
    const bob = Math.round(Math.sin(this.t * 0.09)) * 2;
    /* 반짝이는 뒷광 — 블록에서 나온 게 특별한 물건임을 알려 줍니다 */
    ctx.save();
    ctx.globalAlpha = 0.3 + Math.sin(this.t * 0.12) * 0.12;
    ctx.fillStyle = '#b8f4ff';
    ctx.beginPath();
    ctx.arc(this.x + this.w / 2, this.y + this.h / 2 + bob, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawPixels(ctx, def.icon,
      this.x + this.w / 2 - (def.icon[0].length * s) / 2,
      this.y + this.h / 2 - (def.icon.length * s) / 2 + bob, s, false);
  }
}

/* ─────────── 효과: 파편, 점수 글자 ─────────── */
class Particle {
  constructor(x, y, vx, vy, color, size, life) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.color = color; this.size = size || 5;
    this.life = life || 40;
    this.alive = true;
  }
  update() {
    this.vy += 0.42;
    this.x += this.vx;
    this.y += this.vy;
    if (--this.life <= 0) this.alive = false;
  }
  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.size, this.size);
  }
}

/* 청소기에 빨려 들어가는 먼지.
 * Particle 은 중력으로 아래로 떨어져서 "빨리는" 느낌이 안 납니다.
 * 그래서 목표 지점(노즐)으로 가속하며 날아가는 전용 효과를 따로 둡니다. */
class SuckDust {
  constructor(x, y, tx, ty) {
    this.x = x; this.y = y;
    this.tx = tx; this.ty = ty;
    this.life = 26;
    this.size = 2 + Math.floor(Math.random() * 3);
    this.alive = true;
  }
  update() {
    const dx = this.tx - this.x, dy = this.ty - this.y;
    const d = Math.max(1, Math.hypot(dx, dy));
    const sp = Math.min(9, 60 / d + 2.4);
    this.x += (dx / d) * sp;
    this.y += (dy / d) * sp;
    if (--this.life <= 0 || d < 8) this.alive = false;
  }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.75, this.life / 16);
    ctx.fillStyle = this.life % 4 < 2 ? '#e8f8ff' : '#b8f4ff';
    ctx.fillRect(Math.round(this.x), Math.round(this.y), this.size, this.size);
    ctx.restore();
  }
}

class FloatText {
  constructor(x, y, text, color) {
    this.x = x; this.y = y; this.text = text;
    this.color = color || '#fff';
    this.life = 50;
    this.alive = true;
  }
  update() {
    this.y -= 0.9;
    if (--this.life <= 0) this.alive = false;
  }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, this.life / 22);
    ctx.fillStyle = this.color;
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,.55)';
    ctx.lineWidth = 3;
    ctx.strokeText(this.text, this.x, this.y);
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}
