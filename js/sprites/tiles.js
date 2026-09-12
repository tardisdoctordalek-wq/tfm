/* ============================================================
 *  타일과 배경
 *  한 타일은 32 x 32 픽셀입니다.
 *  THEME 은 스테이지별(들판/동굴/하늘) 색 묶음입니다.
 * ========================================================== */

const THEME = {
  day:  { sky1: '#6ec0ff', sky2: '#bfe9ff', dirt: '#a8622f', dirtDark: '#8a4c21', grass: '#5fbf4a', grassDark: '#3f9a33', stone: '#9fb0c2', hill: '#57b94a' },
  cave: { sky1: '#1b1436', sky2: '#3a2a63', dirt: '#5a4a6e', dirtDark: '#443758', grass: '#7d6bb0', grassDark: '#5c4d8a', stone: '#8a94b8', hill: '#2a2048' },
  sky:  { sky1: '#8fd0ff', sky2: '#ffd9ec', dirt: '#c9a3e8', dirtDark: '#a97fd0', grass: '#ffffff', grassDark: '#dcd0ff', stone: '#c7d6ff', hill: '#c9b6ff' },
};

function drawTile(ctx, ch, px, py, th, t) {
  const c = THEME[th] || THEME.day;
  switch (ch) {
    case '#':
      ctx.fillStyle = c.dirt;
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = c.dirtDark;
      ctx.fillRect(px + 4, py + 12, 6, 6);
      ctx.fillRect(px + 20, py + 20, 6, 6);
      break;
    case '=':
      ctx.fillStyle = c.stone;
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.fillRect(px + 2, py + 2, TILE - 4, 4);
      ctx.fillStyle = 'rgba(0,0,0,.22)';
      ctx.fillRect(px + 2, py + TILE - 6, TILE - 4, 4);
      break;
    case 'B':
      ctx.fillStyle = '#c0562f';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.strokeStyle = 'rgba(0,0,0,.30)';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
      ctx.beginPath();
      ctx.moveTo(px, py + 16); ctx.lineTo(px + TILE, py + 16);
      ctx.moveTo(px + 16, py); ctx.lineTo(px + 16, py + 16);
      ctx.moveTo(px + 8, py + 16); ctx.lineTo(px + 8, py + TILE);
      ctx.moveTo(px + 24, py + 16); ctx.lineTo(px + 24, py + TILE);
      ctx.stroke();
      break;
    case '?':
    case '!': {
      const glow = 0.5 + Math.sin(t * 0.1) * 0.5;
      ctx.fillStyle = ch === '?' ? '#e8a02a' : '#e86a2a';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = `rgba(255,255,255,${0.22 + glow * 0.3})`;
      ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
      ctx.fillStyle = ch === '?' ? '#7a4a10' : '#8a2f10';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ch === '?' ? '?' : '★', px + TILE / 2, py + TILE / 2 + 1);
      break;
    }
    case 'X':
      ctx.fillStyle = '#8a6a4a';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = 'rgba(0,0,0,.20)';
      ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
      break;
    case '-':
      ctx.fillStyle = '#b5793f';
      ctx.fillRect(px, py, TILE, 10);
      ctx.fillStyle = '#e0a96a';
      ctx.fillRect(px, py, TILE, 4);
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.fillRect(px + 6, py + 10, 4, 4);
      ctx.fillRect(px + 22, py + 10, 4, 4);
      break;
    case '^':
      ctx.fillStyle = '#c8ccd8';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(px + i * 11 + 1, py + TILE);
        ctx.lineTo(px + i * 11 + 6, py + 8);
        ctx.lineTo(px + i * 11 + 11, py + TILE);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = '#7e8596';
      ctx.fillRect(px, py + TILE - 5, TILE, 5);
      break;
    case 'c':
      circle(ctx, px + 10, py + 20, 12, 'rgba(255,255,255,.92)');
      circle(ctx, px + 26, py + 16, 16, 'rgba(255,255,255,.92)');
      circle(ctx, px + 44, py + 21, 12, 'rgba(255,255,255,.92)');
      ctx.fillStyle = 'rgba(255,255,255,.92)';
      ctx.fillRect(px + 10, py + 20, 36, 12);
      break;
    case 't':
      circle(ctx, px + 8, py + 26, 9, '#3f9a33');
      circle(ctx, px + 20, py + 22, 12, '#4fb040');
      circle(ctx, px + 32, py + 26, 9, '#3f9a33');
      ctx.fillStyle = '#3f9a33';
      ctx.fillRect(px + 4, py + 26, 30, 6);
      break;
    default:
      break;
  }
}

function drawGrassTop(ctx, px, py, th) {
  const c = THEME[th] || THEME.day;
  ctx.fillStyle = c.grass;
  ctx.fillRect(px, py, TILE, 9);
  ctx.fillStyle = c.grassDark;
  ctx.fillRect(px, py + 7, TILE, 3);
}

function drawGoal(ctx, px, py, t) {
  const poleX = px + TILE / 2;
  const top = py - TILE * 4;
  ctx.fillStyle = '#cfd6e2';
  ctx.fillRect(poleX - 3, top, 6, TILE * 5);
  circle(ctx, poleX, top, 7, '#ffd451');
  ctx.fillStyle = '#ff5d8f';
  const wave = Math.sin(t * 0.08) * 4;
  ctx.beginPath();
  ctx.moveTo(poleX + 3, top + 8);
  ctx.lineTo(poleX + 48 + wave, top + 21);
  ctx.lineTo(poleX + 3, top + 34);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('GOAL', poleX + 21, top + 21);
  ctx.fillStyle = '#8a5a2a';
  ctx.fillRect(px + 2, py + TILE - 6, TILE - 4, 6);
}

function drawBackground(ctx, camX, th, t) {
  const c = THEME[th] || THEME.day;
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, c.sky1);
  g.addColorStop(1, c.sky2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  if (th === 'cave') {
    for (let i = 0; i < 60; i++) {
      const x = ((i * 137) - camX * 0.2) % 1400;
      const y = (i * 71) % VIEW_H;
      const a = 0.25 + ((i * 13) % 10) / 20;
      circle(ctx, (x + 1400) % 1400, y, 1.6, `rgba(255,255,255,${a})`);
    }
  } else if (th === 'sky') {
    for (let i = 0; i < 14; i++) {
      const x = (i * 260 - camX * 0.25) % 2600;
      const xx = (x + 2600) % 2600 - 200;
      circle(ctx, xx, 90 + (i % 4) * 60, 40, 'rgba(255,255,255,.45)');
      circle(ctx, xx + 40, 90 + (i % 4) * 60, 52, 'rgba(255,255,255,.38)');
    }
  }

  ctx.fillStyle = th === 'cave' ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.28)';
  for (let i = 0; i < 10; i++) {
    const x = (i * 340 - camX * 0.35) % 3400;
    const xx = (x + 3400) % 3400 - 300;
    ctx.beginPath();
    ctx.arc(xx, VIEW_H - 60, 150, Math.PI, 0);
    ctx.fill();
  }
  ctx.fillStyle = th === 'cave' ? 'rgba(0,0,0,.25)' : c.hill;
  for (let i = 0; i < 12; i++) {
    const x = (i * 280 - camX * 0.55) % 3360;
    const xx = (x + 3360) % 3360 - 260;
    ctx.beginPath();
    ctx.arc(xx, VIEW_H - 30, 110, Math.PI, 0);
    ctx.fill();
  }
}
