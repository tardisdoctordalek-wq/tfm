/* 도트 그림 규칙 검사
 *   node tools/lint-sprites.js
 * 검사 항목
 *   1) 한 그림 안의 줄 길이가 다른가
 *   2) 팔레트에 없는 글자를 썼는가
 *   3) 주변과 완전히 떨어진 외톨이 1칸(노이즈)이 있는가
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const palSrc = fs.readFileSync(path.join(root, 'js/sprites/palette.js'), 'utf8');
const known = new Set([...palSrc.matchAll(/^\s*(?:'([^']+)'|([A-Za-z]))\s*:/gm)]
  .map((m) => m[1] || m[2]).filter((c) => c.length === 1));
['1', '2', '3', '4'].forEach((c) => known.add(c));   // 타일 톤 번호

const files = ['player.js', 'enemies.js', 'items.js', 'tiles.js']
  .map((f) => path.join(root, 'js/sprites', f)).filter(fs.existsSync);

let errors = 0, warnings = 0;

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const name = path.basename(file);
  /* 문자열 배열 덩어리를 찾습니다: 따옴표 문자열이 3줄 이상 연속된 곳 */
  const blocks = [...src.matchAll(/(?:^[ \t]*'[^']*',[ \t]*\r?\n){3,}/gm)];
  for (const b of blocks) {
    const rows = [...b[0].matchAll(/'([^']*)'/g)].map((m) => m[1]);
    const line = src.slice(0, b.index).split('\n').length;
    const widths = [...new Set(rows.map((r) => r.length))];
    if (widths.length > 1) {
      console.log(`❌ ${name}:${line} 줄 길이가 다릅니다 (${widths.join(', ')})`);
      errors++;
      continue;
    }
    const bad = new Set();
    rows.forEach((r) => r.split('').forEach((c) => { if (!known.has(c)) bad.add(c); }));
    if (bad.size) {
      console.log(`❌ ${name}:${line} 팔레트에 없는 글자: ${[...bad].join(' ')}`);
      errors++;
    }
    /* 외톨이 픽셀 */
    let lonely = 0;
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        const ch = rows[r][c];
        if (ch === '.' || ch === 'W' || ch === 'X') continue;   // 눈 반짝임 등은 예외
        const near = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
          .filter(([rr, cc]) => rows[rr] && rows[rr][cc] === ch);
        if (near.length === 0) lonely++;
      }
    }
    if (lonely > 2) {
      console.log(`⚠️  ${name}:${line} 외톨이 1칸이 ${lonely}개 있습니다 (노이즈로 보일 수 있음)`);
      warnings++;
    }
  }
}

console.log(errors || warnings
  ? `\n오류 ${errors}건, 경고 ${warnings}건`
  : '\n✅ 도트 규칙 검사 통과');
process.exit(errors ? 1 : 0);
