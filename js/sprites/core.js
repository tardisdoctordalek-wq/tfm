/* ============================================================
 *  도트 렌더링 핵심
 *  drawPixels(ctx, grid, x, y, scale, flip, pal)
 *    grid  : 글자 배열. 글자 한 개가 도트 한 개입니다.
 *    scale : 반드시 정수 배율만 사용하세요 (1, 2, 3...).
 *    pal   : 생략하면 공용 팔레트 PAL 을 씁니다.
 *            타일처럼 테마마다 색이 달라지는 그림은 자기 팔레트를 넘깁니다.
 * ========================================================== */

function drawPixels(ctx, grid, x, y, scale, flip, pal) {
  const p = pal || PAL;
  ctx.save();
  if (flip) {
    ctx.translate(Math.round(x) + grid[0].length * scale, Math.round(y));
    ctx.scale(-1, 1);
  } else {
    ctx.translate(Math.round(x), Math.round(y));
  }
  for (let r = 0; r < grid.length; r++) {
    const line = grid[r];
    for (let c = 0; c < line.length; c++) {
      const col = p[line[c]];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(c * scale, r * scale, scale, scale);
    }
  }
  ctx.restore();
}

/* ─────────── 도형 보조 함수 ─────────── */
function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function circle(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawStar(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = cx + Math.cos(ang) * rad;
    const py = cy + Math.sin(ang) * rad;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}
