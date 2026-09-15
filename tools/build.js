/* ============================================================
 *  빌드: 흩어져 있는 파일들을 한 개의 HTML로 합칩니다.
 *    node tools/build.js
 *  결과물
 *    dist/나율이의대모험.html  — 더블클릭하면 바로 실행되는 한 파일 게임
 *    dist/artifact.html        — 웹에 올릴 때 쓰는 본문 전용 버전
 * ========================================================== */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const css = read('css/style.css');
const scripts = [
  'js/config.js',
  'js/audio.js',
  'js/input.js',
  'js/levels.js',
  'js/sprites/palette.js',
  'js/sprites/core.js',
  'js/sprites/tiles.js',
  'js/sprites/items.js',
  'js/sprites/enemies.js',
  'js/sprites/player.js',
  'js/powers.js',
  'js/entities.js',
  'js/game.js',
];
const js = scripts.map((f) => `/* ===== ${f} ===== */\n${read(f)}`).join('\n\n');

const html = read('index.html');
const bodyMatch = html.match(/<body>([\s\S]*?)<\/body>/);
let body = bodyMatch[1].replace(/\s*<script src="[^"]*"><\/script>/g, '');

const page = `<title>나율이의 대모험</title>
<style>
${css}
</style>
${body.trim()}
<script>
${js}
</script>
`;

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/artifact.html'), page);
fs.writeFileSync(path.join(root, 'dist/나율이의대모험.html'),
  `<!DOCTYPE html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n` +
  `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">\n` +
  page.replace('<title>', '<title>') + `</html>\n`);

console.log('빌드 완료:');
console.log('  dist/나율이의대모험.html  (' + Math.round(fs.statSync(path.join(root, 'dist/나율이의대모험.html')).size / 1024) + ' KB)');
console.log('  dist/artifact.html');
