/* ============================================================
 *  PNG → 도트 코드 변환기
 *
 *  Piskel, Aseprite, 포토샵 등 어떤 프로그램에서 그리든
 *  PNG 로 내보내기만 하면 게임에 쓰는 글자 그리드로 바꿔 줍니다.
 *
 *    node tools/png2sprite.js 그림.png                  낱장
 *    node tools/png2sprite.js 시트.png --frames=5       가로로 이어 붙인 시트
 *    node tools/png2sprite.js 시트.png --frames=5 \
 *         --names=idle,walk1,walk2,jump,hurt
 *
 *  ─ 색은 팔레트(js/sprites/palette.js)에서 가장 가까운 색으로 자동으로 맞춥니다.
 *    그래서 안티에일리어싱이 섞여 있어도 팔레트 안으로 정리됩니다.
 *  ─ 완전 투명(알파 128 미만) 은 빈 칸('.') 이 됩니다.
 * ========================================================== */
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
if (!file) {
  console.error('쓰는 법: node tools/png2sprite.js 그림.png [--frames=4] [--names=idle,walk1]');
  process.exit(1);
}
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith('--' + name + '='));
  return a ? a.split('=')[1] : def;
};
const frameCount = parseInt(opt('frames', '1'), 10);
const names = opt('names', '').split(',').filter(Boolean);

/* 팔레트 읽기 */
const palSrc = fs.readFileSync(path.join(__dirname, '../js/sprites/palette.js'), 'utf8');
const PAL = {};
for (const m of palSrc.matchAll(/^\s{2}(?:'([^']+)'|([A-Za-z]))\s*:\s*'(#[0-9a-fA-F]{6})'/gm)) {
  PAL[m[1] || m[2]] = m[3];
}
const entries = Object.entries(PAL).map(([ch, hex]) => ({
  ch,
  r: parseInt(hex.slice(1, 3), 16),
  g: parseInt(hex.slice(3, 5), 16),
  b: parseInt(hex.slice(5, 7), 16),
}));

/* 사람 눈에 가깝게 거리 계산 (밝기에 가중치) */
function nearest(r, g, b) {
  let best = entries[0], bestD = Infinity;
  for (const e of entries) {
    const dr = (e.r - r) * 0.5, dg = (e.g - g) * 0.7, db = (e.b - b) * 0.3;
    const d = dr * dr + dg * dg + db * db;
    if (d < bestD) { bestD = d; best = e; }
  }
  return best.ch;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const data = fs.readFileSync(path.resolve(file)).toString('base64');
  const px = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height);
    return { w: c.width, h: c.height, data: Array.from(d.data) };
  }, data);
  await browser.close();

  const fw = Math.floor(px.w / frameCount);
  const grids = [];
  for (let f = 0; f < frameCount; f++) {
    const rows = [];
    for (let y = 0; y < px.h; y++) {
      let row = '';
      for (let x = 0; x < fw; x++) {
        const i = ((y * px.w) + (f * fw + x)) * 4;
        const a = px.data[i + 3];
        row += a < 128 ? '.' : nearest(px.data[i], px.data[i + 1], px.data[i + 2]);
      }
      rows.push(row);
    }
    grids.push(rows);
  }

  console.log(`/* ${path.basename(file)} → ${fw} x ${px.h} 도트, ${frameCount}프레임 */`);
  grids.forEach((g, i) => {
    const name = names[i] || ('frame' + (i + 1));
    console.log(`  ${name}: [`);
    g.forEach((r) => console.log(`    '${r}',`));
    console.log('  ],');
  });

  const used = new Set(grids.flat().join('').split('').filter((c) => c !== '.'));
  console.error(`\n변환 완료: ${fw}x${px.h}, ${frameCount}프레임, 사용된 색 ${used.size}종`);
  if (fw > 40 || px.h > 40) console.error('⚠️  도트가 큽니다. 주인공 기준 24x28 정도가 적당합니다.');
})();
