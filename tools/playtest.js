/* 게임을 실제로 띄워서 동작을 "측정"합니다.
 *   node tools/playtest.js
 *
 * 눈으로 보는 확인은 놓치는 게 많아서, 프레임을 직접 돌리며 상태를 찍습니다.
 * (작업기록 5절의 버그들도 전부 이런 식으로 찾았습니다)
 *
 * 확인하는 것
 *   1) 자바스크립트 오류 0건
 *   2) 파워 블록을 머리로 치면 파워업 아이템이 나오는가
 *   3) 그 아이템을 먹으면 player.power 가 설정되는가
 *   4) 청소기로 적을 빨아들이면 적이 사라지고 점수가 오르는가
 *   5) 빨아들이는 동안 나율이가 다치지 않는가  ← 제일 중요
 *   6) 맞으면 파워만 잃고 큰 상태는 유지되는가
 *   7) 2·3스테이지가 그대로 돌아가는가 (회귀)
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');

const outDir = path.join(__dirname, 'out');
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 980, height: 620 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('오류: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('콘솔 오류: ' + m.text()); });

  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await page.waitForTimeout(500);

  /* 프레임을 우리가 직접 돌립니다 (requestAnimationFrame 루프는 그리기만 하게) */
  await page.evaluate(() => {
    Game.loop = function (ts) { this.render(); requestAnimationFrame((t) => this.loop(t)); };
    window.KEYS = { left: 0, right: 0, jump: 0, run: 0, crouch: 0, action: 0 };
    window.prevKeys = {};
    window.frame = function (n) {
      for (let i = 0; i < (n || 1); i++) {
        Input.down = {};
        Input.pressed = {};
        for (const k in KEYS) {
          Input.down[k] = !!KEYS[k];
          if (KEYS[k] && !prevKeys[k]) Input.pressed[k] = true;
        }
        prevKeys = Object.assign({}, KEYS);
        Game.step();
      }
    };
  });

  const results = [];
  const check = (name, ok, detail) => {
    results.push({ name, ok, detail });
    console.log(`${ok ? '✅' : '❌'} ${name}${detail ? '  — ' + detail : ''}`);
  };

  /* ── 1스테이지 시작 ── */
  const lv = await page.evaluate(() => {
    Game.startGame();
    let star = null;
    for (let r = 0; r < Game.level.h; r++)
      for (let c = 0; c < Game.level.w; c++)
        if (Game.level.grid[r][c] === '*') star = { c, r };
    return { name: Game.level.name, theme: Game.level.theme, power: Game.level.power, star, state: Game.state };
  });
  check('1스테이지 진입', lv.state === 'play' && lv.theme === 'house',
    `${lv.name} / theme=${lv.theme} / power=${lv.power}`);
  check('파워 블록 * 이 레벨에 있음', !!lv.star, lv.star ? `${lv.star.c}칸 ${lv.star.r}줄` : '없음');

  /* ── 2) 블록을 머리로 쳐서 아이템 꺼내기 (실제로 점프해서) ── */
  const hit = await page.evaluate(({ star }) => {
    const p = Game.player;
    p.x = star.c * TILE + (TILE - p.w) / 2;
    p.y = (star.r + 4) * TILE - p.h;      /* 블록 아래 바닥에 세웁니다 */
    p.vx = 0; p.vy = 0;
    frame(2);
    const before = Game.level.grid[star.r][star.c];
    KEYS.jump = 1; frame(1); frame(20); KEYS.jump = 0; frame(20);
    const items = Game.entities.filter((e) => e instanceof PowerItem);
    return {
      before, after: Game.level.grid[star.r][star.c],
      itemCount: items.length, kind: items[0] ? items[0].kind : null,
    };
  }, { star: lv.star });
  check('점프로 파워 블록을 치면 아이템이 나옴',
    hit.before === '*' && hit.after === 'X' && hit.itemCount === 1 && hit.kind === 'vacuum',
    `블록 ${hit.before}→${hit.after}, 나온 아이템 ${hit.itemCount}개 (${hit.kind})`);

  /* ── 3) 아이템 먹기 ── */
  const got = await page.evaluate(() => {
    const item = Game.entities.find((e) => e instanceof PowerItem);
    const p = Game.player;
    p.x = item.x; p.y = item.y - 10; p.vx = 0; p.vy = 0;
    frame(6);
    return { power: p.power, big: p.big, score: Game.score, label: document.querySelector('.btn.act').textContent };
  });
  check('아이템을 먹으면 청소기를 갖게 됨', got.power === 'vacuum' && got.big === true,
    `power=${got.power}, big=${got.big}, 터치 버튼 글자="${got.label}"`);

  /* ── 4·5) 흡입: 적이 사라지는가 / 그동안 다치지 않는가 ── */
  const suck = await page.evaluate(() => {
    const p = Game.player;
    /* 평평한 바닥에 세우고 앞에 밤톨이(집 테마에서는 먼지뭉치)를 둡니다 */
    p.x = 6 * TILE; p.y = 14 * TILE - p.h; p.vx = 0; p.vy = 0;
    p.facing = 1; p.invuln = 0;
    Game.entities = Game.entities.filter((e) => !(e instanceof Walker || e instanceof Flyer));
    const foe = new Walker(9, 13, 'house');
    Game.entities.push(foe);
    frame(2);
    const before = { score: Game.score, lives: Game.lives, enemies: Game.entities.filter((e) => e instanceof Walker).length };
    KEYS.action = 1;
    let hurtSeen = false, minInvuln = 999, sawSucked = false;
    for (let i = 0; i < 90; i++) {
      frame(1);
      if (Game.player.invuln > 0) hurtSeen = true;
      minInvuln = Math.min(minInvuln, Game.player.invuln);
      if (foe.sucked) sawSucked = true;
      if (!foe.alive) break;
    }
    KEYS.action = 0; frame(2);
    return {
      before, sawSucked, hurtSeen,
      after: { score: Game.score, lives: Game.lives, enemies: Game.entities.filter((e) => e instanceof Walker).length },
      power: Game.player.power, state: Game.state,
    };
  });
  check('청소기로 적을 빨아들여 없앰',
    suck.sawSucked && suck.after.enemies === 0 && suck.after.score > suck.before.score,
    `적 ${suck.before.enemies}→${suck.after.enemies}마리, 점수 ${suck.before.score}→${suck.after.score}`);
  check('빨아들이는 동안 나율이가 다치지 않음',
    !suck.hurtSeen && suck.after.lives === suck.before.lives && suck.power === 'vacuum' && suck.state === 'play',
    `목숨 ${suck.before.lives}→${suck.after.lives}, 무적(피격) 발생 ${suck.hurtSeen ? '있음' : '없음'}, power=${suck.power}`);

  /* ── 6) 맞으면 파워만 잃고 큰 상태는 유지 ── */
  const hurt = await page.evaluate(() => {
    const p = Game.player;
    p.invuln = 0;
    const b = { power: p.power, big: p.big, h: p.h };
    Game.hurtPlayer();
    const m = { power: p.power, big: p.big, h: p.h };
    p.invuln = 0;
    Game.hurtPlayer();
    const s = { power: p.power, big: p.big, h: p.h };
    p.invuln = 0;
    const livesBefore = Game.lives;
    Game.hurtPlayer();
    return { b, m, s, died: Game.state === 'dead', livesBefore };
  });
  check('맞으면 파워 → 큰 나율 → 작은 나율 → 죽음 3단',
    hurt.b.power === 'vacuum' && hurt.m.power === null && hurt.m.big === true &&
    hurt.s.big === false && hurt.died,
    `파워(h=${hurt.b.h}) → 큰(h=${hurt.m.h}, power=${hurt.m.power}) → 작은(h=${hurt.s.h}) → ${hurt.died ? '죽음' : '안 죽음'}`);

  /* ── 7) 2·3스테이지 회귀 ── */
  for (const i of [1, 2]) {
    const r = await page.evaluate((idx) => {
      Game.loadLevel(idx);
      Game.state = 'play';
      KEYS.right = 1;
      frame(120);
      KEYS.right = 0;
      return { name: Game.level.name, theme: Game.level.theme, state: Game.state, x: Math.round(Game.player.x) };
    }, i);
    check(`${i + 1}스테이지 회귀 (120프레임)`, r.x > 0,
      `${r.name} / theme=${r.theme} / state=${r.state} / x=${r.x}`);
  }

  /* ── 화면 캡처 ── */
  await page.evaluate(() => {
    Game.startGame();
    Game.player.x = 8 * TILE; Game.player.y = 14 * TILE - Game.player.h;
    Game.player.setPower('vacuum');
    Game.player.facing = 1;
    KEYS.action = 1; frame(10);
    Game.camX = Math.max(0, Game.player.x - VIEW_W / 2);
    Game.render();
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(outDir, 'house-stage.png') });
  await page.evaluate(() => { Game.camX = 40 * TILE; Game.render(); });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(outDir, 'house-living.png') });

  /* 현관문(골) */
  await page.evaluate(() => {
    const g = Game.level.goal;
    Game.player.x = (g.col - 6) * TILE;
    Game.player.y = 14 * TILE - Game.player.h;
    Game.camX = Math.min(Game.level.w * TILE - VIEW_W, (g.col - 12) * TILE);
    Game.render();
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(outDir, 'house-goal.png') });

  check('자바스크립트 오류 0건', errors.length === 0, errors.join(' / ') || '없음');
  await browser.close();

  const failed = results.filter((r) => !r.ok).length;
  console.log('');
  console.log(`캡처: tools/out/house-stage.png, tools/out/house-living.png`);
  console.log(failed ? `❌ ${failed}건 실패` : `✅ ${results.length}건 모두 통과`);
  process.exit(failed ? 1 : 0);
})();
