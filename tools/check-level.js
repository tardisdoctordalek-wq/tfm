/* 스테이지 검사
 *   node tools/check-level.js
 *
 * 왜 필요한가 —
 *   작업기록 5-5 에 적힌 버그: 1스테이지에 깊이 128px 구덩이가 있었는데
 *   최대 점프 높이가 114px 이라 한 번 빠지면 나올 수 없었습니다.
 *   자동 플레이 봇이 거기서 시간 초과로 계속 죽었습니다.
 *   눈으로는 절대 못 찾습니다. 그래서 자동 검사로 만들어 둡니다.
 *
 * 검사 항목
 *   1) 물리값에서 계산한 최대 점프 높이보다 깊은 "빠져나올 수 없는 곳"
 *   2) 시작 위치 P 에서 골 G 까지 도달 가능한지 (타일 단위 근사)
 *   3) power 가 정해진 스테이지에 파워 블록 `*` 이 실제로 있는지
 *   4) P / G 가 하나씩 있는지, 적이 벽 속에 박혀 있지 않은지
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const load = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const { PHYS, TILE, ROWS, SOLID, ONEWAY, LEVELS } = new Function(
  load('js/config.js') + '\n' + load('js/levels.js') +
  '\nreturn { PHYS, TILE, ROWS, SOLID, ONEWAY, HAZARD, LEVELS };')();

/* ── 물리값에서 점프 성능을 계산합니다 (숫자를 적어 두면 config 를 고쳤을 때 거짓말이 됩니다) ── */
function jumpStats() {
  let vy = PHYS.JUMP, y = 0, up = 0, frames = 0;
  /* js/entities.js 의 Player.update 와 같은 순서: 중력을 먼저 더하고 움직입니다 */
  while (frames < 600) {
    vy = Math.min(vy + PHYS.GRAVITY, PHYS.MAX_FALL);
    y += vy;
    frames++;
    up = Math.min(up, y);
    if (y >= 0) break;           /* 원래 높이로 돌아옴 = 착지 */
  }
  return { height: -up, airFrames: frames };
}
/* 아래로 dropPx 만큼 떨어지는 데 걸리는 프레임 */
function fallFrames(dropPx) {
  let vy = 0, y = 0, f = 0;
  while (y < dropPx && f < 600) { vy = Math.min(vy + PHYS.GRAVITY, PHYS.MAX_FALL); y += vy; f++; }
  return f;
}

const J = jumpStats();
const MAX_UP_TILES = Math.floor(J.height / TILE);
const MAX_GAP_TILES = Math.floor((J.airFrames * PHYS.MAX_WALK) / TILE);
/* 아래로 떨어지면서는 체공 시간이 길어져 훨씬 멀리 갑니다.
   이걸 빼먹으면 "발판에서 뛰어내려 아래 바닥에 착지" 를 못 간다고 잘못 판정합니다. */
function reachTiles(dropTiles) {
  const frames = J.airFrames + (dropTiles > 0 ? fallFrames(dropTiles * TILE) : 0);
  return Math.floor((frames * PHYS.MAX_WALK) / TILE);
}

console.log(`물리값에서 계산한 성능 (js/config.js 의 PHYS 기준)`);
console.log(`  최대 점프 높이  ${J.height.toFixed(1)}px  = ${MAX_UP_TILES}타일`);
console.log(`  체공 시간       ${J.airFrames}프레임`);
console.log(`  걷기로 건널 수 있는 최대 폭  ${(J.airFrames * PHYS.MAX_WALK).toFixed(0)}px = ${MAX_GAP_TILES}타일`);
console.log('');

let errors = 0, warns = 0;
const err = (m) => { console.log('❌ ' + m); errors++; };
const warn = (m) => { console.log('⚠️  ' + m); warns++; };

for (let li = 0; li < LEVELS.length; li++) {
  const def = LEVELS[li];
  const W = Math.max(...def.rows.map((r) => r.length));
  const grid = [];
  for (let r = 0; r < ROWS; r++) grid.push((def.rows[r] || '').padEnd(W, ' ').split(''));

  const solid = (c, r) => (c < 0 || c >= W) ? true
    : (r < 0 || r >= ROWS) ? false : SOLID.indexOf(grid[r][c]) >= 0;
  const oneway = (c, r) => c >= 0 && c < W && r >= 0 && r < ROWS && grid[r][c] === ONEWAY;
  const stand = (c, r) => solid(c, r) || oneway(c, r);          /* 발을 디딜 수 있는 칸 */
  /* 나율이는 56px = 1.75타일. 서려면 발밑 칸 위로 두 칸이 비어 있어야 합니다. */
  const free = (c, r) => !solid(c, r) && r >= 0 && r < ROWS;
  const canStand = (c, r) => stand(c, r + 1) && free(c, r) && free(c, r - 1);

  console.log(`── ${li + 1}. ${def.name}  (${W}칸, theme=${def.theme}, power=${def.power || '없음'})`);

  /* 1) P / G */
  let start = null, goal = null, marks = { P: 0, G: 0 };
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < W; c++) {
    if (grid[r][c] === 'P') { marks.P++; start = { c, r }; }
    if (grid[r][c] === 'G') { marks.G++; goal = { c, r }; }
  }
  if (marks.P !== 1) err(`${def.name}: 시작 위치 P 가 ${marks.P}개입니다 (1개여야 합니다)`);
  if (marks.G !== 1) err(`${def.name}: 골 G 가 ${marks.G}개입니다 (1개여야 합니다)`);

  /* 2) 파워 블록 */
  const powerBlocks = grid.flat().filter((ch) => ch === '*').length;
  if (def.power && powerBlocks === 0) {
    err(`${def.name}: power="${def.power}" 인데 파워 블록 * 이 하나도 없습니다`);
  } else if (def.power) {
    console.log(`   파워 블록 * : ${powerBlocks}개`);
  }
  if (!def.power && powerBlocks > 0) {
    warn(`${def.name}: 파워 블록 * 이 ${powerBlocks}개 있는데 power 가 정해져 있지 않습니다 (하트가 나옵니다)`);
  }

  /* 3) 빠져나올 수 없는 한 칸 구멍 — 작업기록 5-5 의 버그 */
  for (let c = 0; c < W; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (!canStand(c, r)) continue;
      /* 양옆이 모두 벽이면 수직 통로입니다. 그 벽이 얼마나 높은지 봅니다. */
      let leftH = 0, rightH = 0;
      while (leftH < ROWS && solid(c - 1, r - leftH)) leftH++;
      while (rightH < ROWS && solid(c + 1, r - rightH)) rightH++;
      if (leftH === 0 || rightH === 0) continue;
      const depth = Math.min(leftH, rightH);
      if (depth > MAX_UP_TILES) {
        err(`${def.name}: ${c}칸 ${r}줄 — 양옆 벽이 ${depth}타일(${depth * TILE}px)이라 ` +
            `최대 점프 ${MAX_UP_TILES}타일(${J.height.toFixed(0)}px)로는 빠져나올 수 없습니다`);
      }
    }
  }

  /* 4) 시작 → 골 도달 가능성 (타일 단위 근사)
        걷기 / 떨어지기 / 점프 세 가지 이동만 봅니다. 실제 물리보다 너그럽게
        잡혀 있으므로, 여기서 "못 간다"고 나오면 실제로도 확실히 못 갑니다. */
  if (start && goal) {
    /* 시작 칸: P 가 놓인 줄에 서 있습니다 */
    const key = (c, r) => c + ',' + r;
    const seen = new Set();
    const q = [];
    const push = (c, r) => {
      if (c < 0 || c >= W || r < 0 || r >= ROWS) return;
      if (!canStand(c, r) || seen.has(key(c, r))) return;
      seen.add(key(c, r)); q.push({ c, r });
    };
    /* 시작점이 공중이면 떨어뜨립니다 */
    let sr = start.r;
    while (sr + 1 < ROWS && !stand(start.c, sr + 1)) sr++;
    push(start.c, sr);

    while (q.length) {
      const { c, r } = q.shift();
      /* 걷기 — 한 칸 오르내리기 포함 */
      for (const dc of [-1, 1]) for (const dr of [-1, 0, 1]) push(c + dc, r + dr);
      /* 점프 — 최대 점프 높이/폭 안에서 같은 높이이거나 위쪽인 칸 */
      for (let dc = -MAX_GAP_TILES; dc <= MAX_GAP_TILES; dc++) {
        for (let dr = -MAX_UP_TILES; dr <= 0; dr++) {
          if (dc === 0 && dr === 0) continue;
          /* 올라가는 만큼 멀리는 못 갑니다 */
          if (Math.abs(dc) + Math.abs(dr) * 1.6 > MAX_GAP_TILES + MAX_UP_TILES) continue;
          push(c + dc, r + dr);
        }
      }
      /* 뛰어내리기 — 옆 칸(또는 몇 칸 건너)의 가장 높은 발판에 착지합니다.
         떨어지는 동안에도 계속 앞으로 가기 때문에 평지 점프보다 훨씬 멀리 갑니다. */
      const maxReach = reachTiles(ROWS);
      for (let dc = -maxReach; dc <= maxReach; dc++) {
        if (dc === 0) continue;
        const cc = c + dc;
        if (cc < 0 || cc >= W) continue;
        let rr = r;
        while (rr + 1 < ROWS && !canStand(cc, rr)) rr++;   /* 처음 만나는 발판에 착지 */
        if (!canStand(cc, rr)) continue;
        if (rr < r) continue;                               /* 위로 가는 건 점프에서 처리했습니다 */
        if (Math.abs(dc) > reachTiles(rr - r)) continue;     /* 그만큼 멀리는 못 갑니다 */
        push(cc, rr);
      }
    }

    /* 골 근처(깃발/문은 세로로 길어서 아래 어디서든 닿습니다) */
    let reached = false;
    for (let dr = -4; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) if (seen.has(key(goal.c + dc, goal.r + dr))) reached = true;
    }
    if (!reached) err(`${def.name}: 시작 위치에서 골 G(${goal.c}칸)까지 갈 수 없습니다`);
    else console.log(`   도달 가능: 시작 ${start.c}칸 → 골 ${goal.c}칸 (닿을 수 있는 발판 ${seen.size}칸)`);
  }

  /* 5) 적이 벽 속에 박혀 있는지 */
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < W; c++) {
    const ch = grid[r][c];
    if (ch !== 'E' && ch !== 'F') continue;
    if (solid(c, r)) warn(`${def.name}: ${c}칸 ${r}줄 의 적 '${ch}' 이 블록 속에 있습니다`);
  }
  console.log('');
}

console.log(errors || warns ? `오류 ${errors}건, 경고 ${warns}건` : '✅ 모든 스테이지 이상 없음');
process.exit(errors ? 1 : 0);
