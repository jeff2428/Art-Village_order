import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const FILES = [
  'config.js',
  'utils.js',
  'liff-auth.js',
  'api.js',
  'menu.js',
  'customization.js',
  'reservation.js',
  'announcement.js',
  'order-submit.js'
];

async function build() {
  mkdirSync(join(__dirname, 'dist'), { recursive: true });

  const sources = FILES.map(f => readFileSync(join(__dirname, f), 'utf-8'));
  const combined = sources.join('\n');

  const result = await esbuild.transform(combined, {
    minify: true,
    target: 'es2015',
  });

  writeFileSync(join(__dirname, 'dist', 'bundle.js'), result.code, 'utf-8');
  console.log('✓ dist/bundle.js built');
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
