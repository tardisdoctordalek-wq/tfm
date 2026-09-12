/* ============================================================
 *  아이템 도트
 *  코인(별동전), 하트
 * ========================================================== */

const COIN = [
  '...YYYY...',
  '..YYYYYY..',
  '.YYyyyyYY.',
  '.YyYYYYyY.',
  'YYyYYYYyYY',
  'YYyYYYYyYY',
  '.YyYYYYyY.',
  '.YYyyyyYY.',
  '..YYYYYY..',
  '...YYYY...',
];

function drawCoin(ctx, cx, cy, r, t) {
  const squeeze = Math.max(0.16, Math.abs(Math.cos(t * 0.07)));
  const scale = Math.max(2, Math.round((r * 2) / 10));
  const sw = 10 * scale;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(squeeze, 1);
  drawPixels(ctx, COIN, -sw / 2, -sw / 2, scale, false);
  ctx.restore();
}

const HEART = [
  '..GG...GG..',
  '.GGGGGGGGG.',
  'GGWGGGGGGGG',
  'GGWGGGGGGGG',
  'gGGGGGGGGGg',
  '.gGGGGGGGg.',
  '..gGGGGGg..',
  '...gGGGg...',
  '....gGg....',
];

function drawHeart(ctx, cx, cy, r, t) {
  const scale = Math.max(2, Math.round((r * 2) / 11));
  const bob = Math.sin(t * 0.12) * 2;
  drawPixels(ctx, HEART, cx - (11 * scale) / 2, cy - (9 * scale) / 2 + bob, scale, false);
}
