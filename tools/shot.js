/* 도트 확인판(tools/spritelab.html)을 그림으로 저장합니다.
 *   node tools/shot.js [저장경로]        기본값 tools/out/spritelab.png
 * 저장된 PNG 를 직접 열어서 눈으로 확인하세요. */
const path = require('path');
const fs = require('fs');
const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');

const out = path.resolve(process.argv[2] || path.join(__dirname, 'out/spritelab.png'));
fs.mkdirSync(path.dirname(out), { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('오류: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('콘솔 오류: ' + m.text()); });
  await page.goto('file://' + path.join(__dirname, 'spritelab.html'));
  await page.waitForTimeout(600);
  await page.screenshot({ path: out, fullPage: true });
  await browser.close();
  console.log(errors.length ? errors.join('\n') : '오류 없음');
  console.log('저장: ' + out);
})();
