/* ============================================================
 *  사진 → 도트 그림 변환기
 *
 *    node tools/photo2pixel.js 사진.jpg --size=96 --colors=24 \
 *         --crop=0.30,0.05,0.45,0.60 --out=tools/out/nayul96.png
 *
 *  --size    : 결과 도트 크기 (가로=세로). 기본 96
 *  --colors  : 색을 몇 개로 줄일지. 기본 24 (도트답게 보이려면 16~32)
 *  --crop    : 원본에서 잘라낼 영역. x,y,가로,세로 를 0~1 비율로
 *  --sat     : 채도 배수. 기본 1.25 (사진은 밋밋해서 조금 올립니다)
 *  --contrast: 대비 배수. 기본 1.12
 *  --out     : 저장할 PNG 경로 (1배). 옆에 _x6 확대본도 같이 저장합니다
 *  --code    : 붙이면 도트 코드(글자 그리드)와 팔레트도 출력합니다
 *
 *  색 줄이기는 median cut(색 상자를 계속 반으로 쪼개는 방법)을 씁니다.
 * ========================================================== */
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
if (!file) { console.error('쓰는 법: node tools/photo2pixel.js 사진.jpg --size=96'); process.exit(1); }
const opt = (n, d) => { const a = args.find((x) => x.startsWith('--' + n + '=')); return a ? a.split('=')[1] : d; };
const has = (n) => args.includes('--' + n);

const SIZE = parseInt(opt('size', '96'), 10);
const COLORS = parseInt(opt('colors', '24'), 10);
const SAT = parseFloat(opt('sat', '1.25'));
const CONTRAST = parseFloat(opt('contrast', '1.12'));
const OUT = path.resolve(opt('out', 'tools/out/pixel.png'));
const crop = opt('crop', '') ? opt('crop').split(',').map(Number) : null;

/* ── median cut 으로 색 줄이기 ── */
function medianCut(pixels, n) {
  let boxes = [pixels];
  while (boxes.length < n) {
    let bi = -1, bestRange = -1;
    boxes.forEach((b, i) => {
      if (b.length < 2) return;
      for (let ch = 0; ch < 3; ch++) {
        let lo = 255, hi = 0;
        for (const p of b) { if (p[ch] < lo) lo = p[ch]; if (p[ch] > hi) hi = p[ch]; }
        const range = (hi - lo) * (ch === 1 ? 1.2 : 1);   // 초록(밝기) 쪽을 조금 더 중시
        if (range > bestRange) { bestRange = range; bi = i; }
      }
    });
    if (bi < 0 || bestRange <= 0) break;
    const box = boxes[bi];
    let ch = 0, best = -1;
    for (let c = 0; c < 3; c++) {
      let lo = 255, hi = 0;
      for (const p of box) { if (p[c] < lo) lo = p[c]; if (p[c] > hi) hi = p[c]; }
      if (hi - lo > best) { best = hi - lo; ch = c; }
    }
    box.sort((a, b) => a[ch] - b[ch]);
    const mid = box.length >> 1;
    boxes.splice(bi, 1, box.slice(0, mid), box.slice(mid));
  }
  return boxes.filter((b) => b.length).map((b) => {
    const s = [0, 0, 0];
    for (const p of b) { s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; }
    return [Math.round(s[0] / b.length), Math.round(s[1] / b.length), Math.round(s[2] / b.length)];
  });
}
const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const b64 = fs.readFileSync(path.resolve(file)).toString('base64');
  const ext = path.extname(file).slice(1).toLowerCase();
  const mime = ext === 'png' ? 'image/png' : 'image/jpeg';

  const res = await page.evaluate(async ({ b64, mime, SIZE, crop, SAT, CONTRAST }) => {
    const img = new Image();
    img.src = 'data:' + mime + ';base64,' + b64;
    await img.decode();
    const sx = crop ? Math.round(img.width * crop[0]) : 0;
    const sy = crop ? Math.round(img.height * crop[1]) : 0;
    const sw = crop ? Math.round(img.width * crop[2]) : img.width;
    const sh = crop ? Math.round(img.height * crop[3]) : img.height;

    const c = document.createElement('canvas');
    c.width = SIZE; c.height = SIZE;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = true;
    x.imageSmoothingQuality = 'high';
    x.drawImage(img, sx, sy, sw, sh, 0, 0, SIZE, SIZE);

    const d = x.getImageData(0, 0, SIZE, SIZE);
    const px = d.data;
    for (let i = 0; i < px.length; i += 4) {
      let [r, g, b] = [px[i], px[i + 1], px[i + 2]];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      r = lum + (r - lum) * SAT; g = lum + (g - lum) * SAT; b = lum + (b - lum) * SAT;
      r = (r - 128) * CONTRAST + 128; g = (g - 128) * CONTRAST + 128; b = (b - 128) * CONTRAST + 128;
      px[i] = Math.max(0, Math.min(255, r));
      px[i + 1] = Math.max(0, Math.min(255, g));
      px[i + 2] = Math.max(0, Math.min(255, b));
    }
    return { w: img.width, h: img.height, data: Array.from(px) };
  }, { b64, mime, SIZE, crop, SAT, CONTRAST });

  console.error(`원본 ${res.w} x ${res.h} → ${SIZE} x ${SIZE}`);

  const pixels = [];
  for (let i = 0; i < res.data.length; i += 4) pixels.push([res.data[i], res.data[i + 1], res.data[i + 2]]);
  const palette = medianCut(pixels.map((p) => p.slice()), COLORS);

  const idx = pixels.map(([r, g, b]) => {
    let best = 0, bd = Infinity;
    palette.forEach((p, i) => {
      const d = (p[0] - r) ** 2 * 0.5 + (p[1] - g) ** 2 * 0.7 + (p[2] - b) ** 2 * 0.3;
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  });

  /* PNG 로 저장 (1배 + 6배 확대) */
  const png = await page.evaluate(({ SIZE, idx, palette }) => {
    const out = {};
    [1, 6].forEach((s) => {
      const c = document.createElement('canvas');
      c.width = SIZE * s; c.height = SIZE * s;
      const x = c.getContext('2d');
      for (let i = 0; i < idx.length; i++) {
        const p = palette[idx[i]];
        x.fillStyle = 'rgb(' + p[0] + ',' + p[1] + ',' + p[2] + ')';
        x.fillRect((i % SIZE) * s, Math.floor(i / SIZE) * s, s, s);
      }
      out[s] = c.toDataURL('image/png').split(',')[1];
    });
    return out;
  }, { SIZE, idx, palette });
  await browser.close();

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, Buffer.from(png[1], 'base64'));
  const big = OUT.replace(/\.png$/, '_x6.png');
  fs.writeFileSync(big, Buffer.from(png[6], 'base64'));
  console.error(`저장: ${OUT}\n저장: ${big}\n색 ${palette.length}종`);

  if (has('code')) {
    const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()[]{}<>+=~?';
    console.log('const PHOTO_PAL = {');
    palette.forEach((p, i) => console.log(`  ${JSON.stringify(letters[i])}: '${hex(p)}',`));
    console.log('};\n');
    console.log('const PHOTO = [');
    for (let y = 0; y < SIZE; y++) {
      let row = '';
      for (let x = 0; x < SIZE; x++) row += letters[idx[y * SIZE + x]];
      console.log(`  '${row}',`);
    }
    console.log('];');
  }
})();
