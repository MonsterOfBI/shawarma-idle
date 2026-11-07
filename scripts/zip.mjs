// Упаковывает dist/ в shawarma-idle.zip для загрузки в консоль Яндекс Игр.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { zipSync } from 'fflate';

const root = 'dist';
const files = {};
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else files[relative(root, p).split('\\').join('/')] = readFileSync(p);
  }
})(root);
writeFileSync('shawarma-idle.zip', zipSync(files, { level: 9 }));
console.log(`shawarma-idle.zip: ${Object.keys(files).length} файлов`);
