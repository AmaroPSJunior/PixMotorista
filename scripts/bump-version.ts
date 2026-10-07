import fs from 'node:fs';
import path from 'node:path';

type BumpType = 'patch' | 'minor' | 'major';

const type = (process.argv[2] || 'patch') as BumpType;
if (!['patch', 'minor', 'major'].includes(type)) {
  throw new Error('Use: patch, minor ou major.');
}

const packagePath = path.resolve(process.cwd(), 'package.json');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const match = String(pkg.version || '').match(/^(\d+)\.(\d+)\.(\d+)$/);

if (!match) {
  throw new Error(`Versão atual inválida: ${pkg.version}`);
}

let major = Number(match[1]);
let minor = Number(match[2]);
let patch = Number(match[3]);

if (type === 'major') {
  major += 1;
  minor = 0;
  patch = 0;
} else if (type === 'minor') {
  minor += 1;
  patch = 0;
} else {
  patch += 1;
}

pkg.version = `${major}.${minor}.${patch}`;
fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`Versão atualizada para v${pkg.version} (${type}).`);
