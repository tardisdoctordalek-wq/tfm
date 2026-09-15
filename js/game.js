/* ============================================================
 *  게임 본체 — 화면 상태, 진행, 그리기
 * ========================================================== */

const Game = {
  canvas: null,
  ctx: null,
  state: 'title',      // title | play | pause | dead | clear | gameover | win
  levelIndex: 0,
  level: null,
  player: null,
  entities: [],
  effects: [],
  bumps: {},
  camX: 0,
  t: 0,
  score: 0,
  coins: 0,
  lives: CONFIG.LIVES,
  timeLeft: 300,
  timeTick: 0,
  deadTimer: 0,
  clearTimer: 0,
  best: 0,

  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    Input.init();
    Sound.init();
    try { this.best = parseInt(localStorage.getItem('nayul_best') || '0', 10) || 0; } catch (e) {}
    this.loadLevel(0);
    this.state = 'title';
    requestAnimationFrame((ts) => this.loop(ts));
  },

  /* ── 레벨 불러오기 ───────────────────────── */
  loadLevel(index) {
    const def = LEVELS[index];
    const width = Math.max(...def.rows.map((r) => r.length));
    const grid = [];
    for (let r = 0; r < ROWS; r++) {
      const line = (def.rows[r] || '').padEnd(width, ' ');
      grid.push(line.split(''));
    }

    const level = {
      grid, w: width, h: ROWS,
      theme: def.theme, name: def.name,
      goal: { col: width - 4, row: 13 },
    };

    this.entities = [];
    this.effects = [];
    this.bumps = {};
    let start = { col: 3, row: 13 };

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < width; c++) {
        const ch = grid[r][c];
        if (ch === 'P') { start = { col: c, row: r }; grid[r][c] = ' '; }
        else if (ch === 'E') { this.entities.push(new Walker(c, r)); grid[r][c] = ' '; }
        else if (ch === 'F') { this.entities.push(new Flyer(c, r)); grid[r][c] = ' '; }
        else if (ch === 'o') { this.entities.push(new Coin(c, r)); grid[r][c] = ' '; }
        else if (ch === 'G') { level.goal = { col: c, row: r }; grid[r][c] = ' '; }
      }
    }

    this.level = level;
    this.levelIndex = index;
    this.player = new Player(start.col * TILE + 4, (start.row + 1) * TILE);
    this.camX = 0;
    this.timeLeft = def.time;
    this.timeTick = 0;
    this.deadTimer = 0;
    this.clearTimer = 0;
  },

  startGame() {
    this.score = 0;
    this.coins = 0;
    this.lives = CONFIG.LIVES;
    this.loadLevel(0);
    this.state = 'play';
    Sound.start();
    setTimeout(() => { if (this.state === 'play') Sound.startBgm(); }, 500);
  },

  /* ── 한 프레임 진행 ───────────────────────── */
  step() {
    this.t++;

    if (Input.pressed.mute) {
      const muted = Sound.toggleMute();
      this.effects.push(new FloatText(this.camX + VIEW_W / 2, 120, muted ? '소리 끔' : '소리 켬', '#ffd86b'));
    }

    switch (this.state) {
      case 'title':
        if (Input.pressed.jump || Input.pressed.tap) this.startGame();
        break;

      case 'play':
        if (Input.pressed.pause) { this.state = 'pause'; Sound.pauseBgm(); break; }
        if (Input.pressed.restart) { this.killPlayer(); break; }
        this.updatePlay();
        break;

      case 'pause':
        if (Input.pressed.pause || Input.pressed.tap) { this.state = 'play'; Sound.startBgm(); }
        break;

      case 'dead':
        this.player.update(this.level, this);
        this.entities.forEach((e) => e.update(this.level));
        this.effects.forEach((e) => e.update());
        this.deadTimer++;
        if (this.deadTimer > 110) {
          this.lives--;
          if (this.lives <= 0) {
            this.state = 'gameover';
            this.saveBest();
          } else {
            this.loadLevel(this.levelIndex);
            this.state = 'play';
            Sound.startBgm();
          }
        }
        break;

      case 'clear':
        this.clearTimer++;
        /* 남은 시간을 점수로 바꿔 줍니다 */
        if (this.timeLeft > 0 && this.clearTimer % 2 === 0) {
          const give = Math.min(this.timeLeft, 3);
          this.timeLeft -= give;
          this.score += give * SCORE.TIME_BONUS;
        }
        this.effects.forEach((e) => e.update());
        this.effects = this.effects.filter((e) => e.alive);
        if (this.clearTimer > 70 && (Input.pressed.jump || Input.pressed.tap)) {
          if (this.levelIndex + 1 < LEVELS.length) {
            this.loadLevel(this.levelIndex + 1);
            this.state = 'play';
            Sound.startBgm();
          } else {
            this.state = 'win';
            this.saveBest();
          }
        }
        break;

      case 'gameover':
      case 'win':
        if (Input.pressed.jump || Input.pressed.tap) {
          this.state = 'title';
          this.loadLevel(0);
        }
        break;
    }

    /* 블록 튕김 애니메이션 */
    Object.keys(this.bumps).forEach((k) => {
      if (--this.bumps[k] <= 0) delete this.bumps[k];
    });
  },

  updatePlay() {
    const p = this.player;
    p.update(this.level, this);
    if (this.state !== 'play') return;   // 도중에 죽었으면 중단

    this.entities.forEach((e) => e.update(this.level));
    this.effects.forEach((e) => e.update());

    /* 등장물과 부딪힘 */
    for (const e of this.entities) {
      if (!e.alive) continue;

      if (e instanceof Coin) {
        if (overlaps(p, e)) {
          e.alive = false;
          this.collectCoin(e.x + e.w / 2, e.y);
        }
      } else if (e instanceof HeartItem) {
        if (overlaps(p, e)) {
          e.alive = false;
          this.score += SCORE.POWERUP;
          Sound.powerup();
          if (!p.big) p.setBig(true);
          else p.invuln = Math.max(p.invuln, 60);
          this.effects.push(new FloatText(e.x + e.w / 2, e.y, '+' + SCORE.POWERUP, '#ff9ec4'));
          for (let i = 0; i < 10; i++) {
            this.effects.push(new Particle(e.x + 12, e.y + 10, (Math.random() - 0.5) * 4, -Math.random() * 4, '#ff9ec4', 4, 30));
          }
        }
      } else if (e instanceof Walker || e instanceof Flyer) {
        if (e.dead || !overlaps(p, e)) continue;
        /* 밟기 판정: 떨어지는 중이고, 이번 프레임 직전에 적보다 위에 있었으면 밟은 것 */
        const stomping = p.vy > 0.6 &&
          ((p.prevBottom !== undefined && p.prevBottom <= e.y + 10) ||
            (p.y + p.h) - e.y < e.h * 0.6);
        if (stomping) {
          e.stomp();
          p.vy = PHYS.STOMP_BOUNCE;
          p.jumping = true;
          this.score += SCORE.STOMP;
          Sound.stomp();
          this.effects.push(new FloatText(e.x + e.w / 2, e.y, '+' + SCORE.STOMP, '#ffe66d'));
        } else {
          this.hurtPlayer();
          if (this.state !== 'play') return;
        }
      }
    }

    this.entities = this.entities.filter((e) => e.alive);
    this.effects = this.effects.filter((e) => e.alive);

    /* 골 깃발 */
    const g = this.level.goal;
    const goalBox = { x: g.col * TILE - 6, y: (g.row - 4) * TILE, w: TILE + 12, h: TILE * 5 };
    if (overlaps(p, goalBox)) this.clearLevel();

    /* 시간 */
    this.timeTick++;
    if (this.timeTick >= 30) {
      this.timeTick = 0;
      this.timeLeft--;
      if (this.timeLeft <= 0) { this.timeLeft = 0; this.killPlayer(); return; }
    }

    /* 카메라 */
    const target = p.x + p.w / 2 - VIEW_W / 2;
    const maxX = this.level.w * TILE - VIEW_W;
    this.camX = Math.max(0, Math.min(maxX, target));
  },

  collectCoin(x, y) {
    this.coins++;
    this.score += SCORE.COIN;
    Sound.coin();
    this.effects.push(new FloatText(x, y, '+' + SCORE.COIN, '#ffd451'));
    if (this.coins > 0 && this.coins % 25 === 0) {
      this.lives++;
      this.effects.push(new FloatText(x, y - 20, '1UP!', '#8cff9b'));
    }
  },

  /* 머리로 블록 치기 */
  hitBlock(c, r, player) {
    const ch = this.level.grid[r][c];
    const key = c + ',' + r;
    const px = c * TILE + TILE / 2;
    const py = r * TILE;

    if (ch === '?') {
      this.level.grid[r][c] = 'X';
      this.bumps[key] = 10;
      this.effects.push(new PopCoin(px, py - 6));
      this.collectCoin(px, py - 10);
    } else if (ch === '!') {
      this.level.grid[r][c] = 'X';
      this.bumps[key] = 10;
      this.entities.push(new HeartItem(c, r - 1));
      Sound.powerup();
    } else if (ch === 'B') {
      if (player && player.big) {
        this.level.grid[r][c] = ' ';
        this.score += SCORE.BRICK;
        Sound.brick();
        for (let i = 0; i < 8; i++) {
          this.effects.push(new Particle(
            px, py + 14,
            (Math.random() - 0.5) * 6, -Math.random() * 6 - 1,
            i % 2 ? '#c0562f' : '#8f3d20', 6, 46
          ));
        }
      } else {
        this.bumps[key] = 8;
        Sound.bump();
      }
    } else {
      this.bumps[key] = 6;
      Sound.bump();
    }
  },

  hurtPlayer() {
    const p = this.player;
    if (p.invuln > 0 || p.dying) return;
    if (p.big) {
      p.setBig(false);
      p.invuln = PHYS.INVULN;
      Sound.hurt();
      this.effects.push(new FloatText(p.x + p.w / 2, p.y, '앗!', '#fff'));
    } else {
      this.killPlayer();
    }
  },

  killPlayer() {
    const p = this.player;
    if (p.dying) return;
    p.dying = true;
    p.dieTimer = 0;
    p.vy = -9.5;
    p.vx = 0;
    this.state = 'dead';
    this.deadTimer = 0;
    Sound.stopBgm();
    Sound.die();
  },

  clearLevel() {
    if (this.state !== 'play') return;
    this.state = 'clear';
    this.clearTimer = 0;
    this.player.controllable = false;
    this.player.vx = 0;
    Sound.stopBgm();
    Sound.clear();
    for (let i = 0; i < 30; i++) {
      this.effects.push(new Particle(
        this.player.x + 10, this.player.y,
        (Math.random() - 0.5) * 9, -Math.random() * 9,
        ['#ffd451', '#ff8fb3', '#8cff9b', '#8fd0ff'][i % 4], 5, 70
      ));
    }
  },

  saveBest() {
    if (this.score > this.best) {
      this.best = this.score;
      try { localStorage.setItem('nayul_best', String(this.best)); } catch (e) {}
    }
  },

  /* ── 그리기 ───────────────────────────────── */
  render() {
    const ctx = this.ctx;
    const lv = this.level;
    drawBackground(ctx, this.camX, lv.theme, this.t);

    ctx.save();
    ctx.translate(-Math.round(this.camX), 0);

    /* 타일 */
    const c0 = Math.max(0, Math.floor(this.camX / TILE) - 1);
    const c1 = Math.min(lv.w - 1, Math.ceil((this.camX + VIEW_W) / TILE) + 1);
    for (let r = 0; r < ROWS; r++) {
      for (let c = c0; c <= c1; c++) {
        const ch = lv.grid[r][c];
        if (ch === ' ') continue;
        const bump = this.bumps[c + ',' + r] || 0;
        const py = r * TILE - (bump > 0 ? Math.sin((bump / 10) * Math.PI) * 9 : 0);
        drawTile(ctx, ch, c * TILE, py, lv.theme, this.t);
        if (ch === '#' && (r === 0 || lv.grid[r - 1][c] === ' ')) {
          drawGrassTop(ctx, c * TILE, py, lv.theme);
        }
      }
    }

    /* 골 깃발 */
    drawGoal(ctx, lv.goal.col * TILE, lv.goal.row * TILE, this.t);

    /* 등장물 */
    this.entities.forEach((e) => e.draw(ctx));
    if (this.state !== 'title') this.player.draw(ctx);
    this.effects.forEach((e) => e.draw(ctx));

    ctx.restore();

    this.drawHUD();

    if (this.state === 'title') this.drawTitle();
    if (this.state === 'pause') this.drawPanel('잠깐 쉬는 중', ['P 키 또는 화면을 누르면 계속'], '#8fd0ff');
    if (this.state === 'clear') this.drawClear();
    if (this.state === 'gameover') this.drawPanel('게임 오버', [
      `점수 ${this.score}`,
      `최고 점수 ${this.best}`,
      '아무 키나 누르면 처음부터',
    ], '#ff8fb3');
    if (this.state === 'win') this.drawPanel(`${CONFIG.PLAYER_NAME}이가 해냈어요!`, [
      '모든 스테이지 클리어 🎉',
      `점수 ${this.score} · 코인 ${this.coins}`,
      `최고 점수 ${this.best}`,
      '아무 키나 누르면 다시 시작',
    ], '#ffd451');
  },

  drawHUD() {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(12,14,26,.55)';
    ctx.fillRect(0, 0, VIEW_W, 40);
    ctx.font = 'bold 18px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    ctx.fillStyle = '#fff';
    ctx.fillText(`${CONFIG.PLAYER_NAME}`, 16, 21);
    ctx.fillStyle = '#ffd451';
    ctx.fillText(`${this.score}`, 70, 21);

    drawCoin(ctx, 175, 20, 9, this.t);
    ctx.fillStyle = '#fff';
    ctx.fillText(`× ${this.coins}`, 190, 21);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#cfe4ff';
    ctx.fillText(`${this.levelIndex + 1}-${this.level.name}`, VIEW_W / 2, 21);

    ctx.textAlign = 'right';
    ctx.fillStyle = this.timeLeft <= 30 ? '#ff7b7b' : '#fff';
    ctx.fillText(`TIME ${this.timeLeft}`, VIEW_W - 16, 21);

    for (let i = 0; i < Math.min(this.lives, 6); i++) {
      drawHeart(ctx, VIEW_W - 150 - i * 26, 20, 9, 0);
    }
    ctx.restore();
  },

  drawTitle() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(10,12,24,.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const blinking = Math.floor(this.t / 22) % 9 === 0;
    const art = blinking && NAYUL96.blink ? NAYUL96.blink : NAYUL96.idle;
    drawPixels(ctx, art, VIEW_W / 2 - 96, 46, 2, false);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 52px sans-serif';
    ctx.strokeStyle = 'rgba(0,0,0,.5)';
    ctx.lineWidth = 8;
    ctx.strokeText(CONFIG.TITLE, VIEW_W / 2, 300);
    ctx.fillText(CONFIG.TITLE, VIEW_W / 2, 300);

    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = '#ffd451';
    const blink = Math.floor(this.t / 30) % 2 === 0;
    if (blink) ctx.fillText('스페이스 키 (또는 화면 터치) 로 시작!', VIEW_W / 2, 352);

    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#cfd3e6';
    ctx.fillText('← → 이동 · 스페이스 점프 · Shift 달리기 · 적은 밟으면 이겨요!', VIEW_W / 2, 400);
    ctx.fillText(`최고 점수 ${this.best}`, VIEW_W / 2, 426);
  },

  drawClear() {
    const last = this.levelIndex + 1 >= LEVELS.length;
    this.drawPanel(`${this.levelIndex + 1}단계 성공!`, [
      `남은 시간 보너스  ${this.timeLeft}`,
      `점수 ${this.score} · 코인 ${this.coins}`,
      this.clearTimer > 70 ? (last ? '아무 키나 누르면 마지막 축하 화면으로' : '아무 키나 누르면 다음 스테이지') : '',
    ], '#8cff9b');
  },

  drawPanel(title, lines, color) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(10,12,24,.62)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const w = 560, h = 240;
    const x = (VIEW_W - w) / 2, y = (VIEW_H - h) / 2;
    ctx.fillStyle = 'rgba(24,26,44,.95)';
    rr(ctx, x, y, w, h, 18);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    rr(ctx, x, y, w, h, 18);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText(title, VIEW_W / 2, y + 62);

    ctx.fillStyle = '#e6e9f5';
    ctx.font = '18px sans-serif';
    lines.filter(Boolean).forEach((line, i) => {
      ctx.fillText(line, VIEW_W / 2, y + 108 + i * 32);
    });
    ctx.restore();
  },

  /* ── 메인 루프 (60프레임 고정) ─────────────── */
  loop(ts) {
    if (!this._last) this._last = ts;
    let dt = (ts - this._last) / 1000;
    this._last = ts;
    if (dt > 0.25) dt = 0.25;
    this._acc = (this._acc || 0) + dt;

    let steps = 0;
    while (this._acc >= 1 / 60 && steps < 5) {
      this.step();
      Input.endFrame();
      this._acc -= 1 / 60;
      steps++;
    }

    this.render();
    requestAnimationFrame((t) => this.loop(t));
  },
};

window.addEventListener('load', () => Game.init());
