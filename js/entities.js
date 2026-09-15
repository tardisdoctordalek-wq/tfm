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
  const r0 = Math.floor(e.y / TILE);
  const r1 = Math.floor((e.y + e.h - 1) / TILE);
  if (e.vx > 0) {
    const c = Math.floor((e.x + e.w - 1) / TILE);
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
  const c0 = Math.floor(e.x / TILE);
  const c1 = Math.floor((e.x + e.w - 1) / TILE);
  e.onGround = false;

  if (e.vy > 0) {
    const r = Math.floor((e.y + e.h - 1) / TILE);
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

  get state() {
    if (this.dying) return 'hurt';
    if (!this.onGround) return 'jump';
    if (Math.abs(this.vx) > 0.35) return 'run';
    return 'idle';
  }

  update(level, game) {
    this.t++;
    this.animT += Math.abs(this.vx);
    this.blinkTimer--;
    if (this.blinkTimer < -8) this.blinkTimer = 120 + Math.random() * 200;
    if (this.invuln > 0) this.invuln--;

    /* 죽는 중: 위로 튀었다가 아래로 떨어지는 연출 */
    if (this.dying) {
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
    this.x += this.vx;
    if (this.x < 0) { this.x = 0; this.vx = 0; }
    collideX(this, level);

    /* 세로 이동 */
    const prevBottom = this.y + this.h;
    this.prevBottom = prevBottom;
    this.vy = Math.min(this.vy + PHYS.GRAVITY, PHYS.MAX_FALL);
    this.y += this.vy;
    collideY(this, level, prevBottom, {
      ignoreOneWay: Input.down.crouch,
      onBump: (c, r) => game.hitBlock(c, r, this),
    });

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
  }
}

/* ─────────── 걸어다니는 적: 밤톨이 ─────────── */
class Walker {
  constructor(col, row) {
    this.w = 24; this.h = 24;
    this.x = col * TILE + 4;
    this.y = row * TILE + TILE - this.h;
    this.vx = -0.85;
    this.vy = 0;
    this.t = Math.floor(Math.random() * 20);
    this.dead = false;
    this.squash = 0;
    this.alive = true;
  }

  update(level) {
    this.t++;
    if (this.dead) {
      this.squash--;
      if (this.squash <= 0) this.alive = false;
      return;
    }

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
    drawWalker(ctx, this.x, this.y, this.w, this.h, this.t, Math.sign(this.vx) || 1, this.dead);
  }
}

/* ─────────── 날아다니는 적: 날개새 ─────────── */
class Flyer {
  constructor(col, row) {
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
      drawFlyer(ctx, this.x, this.y, this.w, this.h, this.t, Math.sign(this.vx) || 1);
      ctx.restore();
      return;
    }
    drawFlyer(ctx, this.x, this.y, this.w, this.h, this.t, Math.sign(this.vx) || 1);
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
