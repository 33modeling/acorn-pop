// 빌드: web/ 을 dist/ 로 복사하고, 모든 모듈이 문법 오류 없이 읽히는지·import 경로가 실제 파일인지 확인한다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'web'), out = path.join(root, 'dist');
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(src, out, { recursive: true });
let n = 0;
const errors = [];
for (const f of fs.readdirSync(path.join(out, 'js'))) {
  if (!f.endsWith('.js')) continue;
  const text = fs.readFileSync(path.join(out, 'js', f), 'utf8');
  for (const m of text.matchAll(/from '(\.[^']+)'/g)) {
    if (!fs.existsSync(path.join(out, 'js', m[1]))) errors.push(`${f}: ${m[1]} 없음`);
  }
  n++;
}
// DOM 이 필요 없는 모듈은 실제로 불러 본다
for (const f of ['grid.js', 'blast.js', 'items.js', 'enemies.js', 'levels.js', 'bot.js', 'game.js', 'save.js', 'rng.js']) {
  try { await import(pathToFileURL(path.join(out, 'js', f)).href); } catch (e) { errors.push(`${f}: ${e.message}`); }
}
const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
for (const m of html.matchAll(/(?:src|href)="([^"#:]+)"/g)) if (!fs.existsSync(path.join(out, m[1]))) errors.push(`index.html: ${m[1]} 없음`);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
const bytes = fs.readdirSync(out, { recursive: true }).map((f) => path.join(out, f)).filter((f) => fs.statSync(f).isFile()).reduce((a, f) => a + fs.statSync(f).size, 0);
console.log(`빌드 완료: dist/ (모듈 ${n}개, ${(bytes / 1024).toFixed(1)} KB)`);
