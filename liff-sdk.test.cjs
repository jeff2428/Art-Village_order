const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('LIFF edge SDK is not pinned to a stale integrity hash', () => {
  for (const relativePath of ['index.html', path.join('src', 'frontend', 'index.html')]) {
    const html = fs.readFileSync(path.join(__dirname, relativePath), 'utf8');
    const scriptTag = html.match(
      /<script\b[^>]*src=["']https:\/\/static\.line-scdn\.net\/liff\/edge\/2\/sdk\.js["'][^>]*>/i
    );

    assert.ok(scriptTag, `${relativePath} must load the LIFF SDK`);
    assert.doesNotMatch(scriptTag[0], /\bintegrity\s*=/i);
  }
});
