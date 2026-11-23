// Why: the SpaRewrite CloudFront Function is the only thing that sends the old CloudFront address to the
// app's hostname, and it lives as a YAML literal inside each template, where nothing else runs it. This test
// pulls that literal out, fills the !Sub variables (Hostname, DocSlugs) the way CloudFormation does, and runs `handler`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const infra = join(import.meta.dirname, '../..');

// Returns the JS under `SpaRewrite: ... FunctionCode: !Sub` / `- |` (the first list item of the Sub).
function extractFunctionCode(file) {
  const lines = readFileSync(join(infra, file), 'utf8').split('\n');
  const at = (re, from) => {
    const i = lines.findIndex((l, n) => n >= from && re.test(l));
    assert.notEqual(i, -1, `${file}: ${re}`);
    return i;
  };
  const res = at(/^ {2}SpaRewrite:$/, 0);
  const code = at(/^ {6}FunctionCode: !Sub$/, res);
  const start = at(/^ {8}- \|$/, code) + 1;
  const body = [];
  for (let i = start; i < lines.length; i++) {
    if (lines[i] !== '' && !lines[i].startsWith(' '.repeat(10))) break;
    body.push(lines[i].slice(10));
  }
  const js = body.join('\n');
  assert.ok(js.includes('${Hostname}'), `${file}: the Hostname placeholder`);
  assert.ok(js.includes('${DocSlugs}'), `${file}: the DocSlugs placeholder`);
  assert.equal(js.replaceAll('${Hostname}', '').replaceAll('${DocSlugs}', '').includes('${'), false, `${file}: no other \${ in the code`);
  return js;
}

function handlerFor(file, hostname, slugs = '') {
  const js = extractFunctionCode(file).replaceAll('${Hostname}', hostname).replaceAll('${DocSlugs}', slugs);
  return new Function(`${js}\nreturn handler;`)();
}

const event = (host, uri, querystring = {}) => ({ request: { uri, querystring, headers: { host: { value: host } } } });

for (const file of ['template.yaml']) {
  test(`${file}: another host is redirected, path and every query value kept`, () => {
    const out = handlerFor(file, 'authgatehq.com')(
      event('d3d49hg6rb8ylx.cloudfront.net', '/docs/step-up', {
        a: { value: '1', multiValue: [{ value: '1' }, { value: '2' }] },
        q: { value: 'a b' },
      }),
    );
    assert.equal(out.statusCode, 301);
    assert.equal(out.statusDescription, 'Moved Permanently');
    assert.equal(out.headers.location.value, 'https://authgatehq.com/docs/step-up?a=1&a=2&q=a%20b');
  });

  test(`${file}: a query value comes out percent-encoded once, whether it arrives encoded or decoded`, () => {
    const h = handlerFor(file, 'authgatehq.com');
    for (const value of ['a%20b', 'a b']) {
      const out = h(event('d3d49hg6rb8ylx.cloudfront.net', '/', { q: { value } }));
      assert.equal(out.headers.location.value, 'https://authgatehq.com/?q=a%20b', value);
    }
  });

  test(`${file}: a malformed percent sequence stays encoded and does not throw`, () => {
    const out = handlerFor(file, 'authgatehq.com')(event('d3d49hg6rb8ylx.cloudfront.net', '/', { q: { value: '%E0%A4%A' } }));
    assert.equal(out.headers.location.value, 'https://authgatehq.com/?q=%25E0%25A4%25A');
  });

  test(`${file}: no query string gives no question mark`, () => {
    const out = handlerFor(file, 'authgatehq.com')(event('d3d49hg6rb8ylx.cloudfront.net', '/'));
    assert.equal(out.headers.location.value, 'https://authgatehq.com/');
  });

  test(`${file}: the app host still gets the SPA rewrite`, () => {
    const out = handlerFor(file, 'authgatehq.com')(event('authgatehq.com', '/docs/step-up'));
    assert.equal(out.statusCode, undefined);
    assert.equal(out.uri, '/index.html');
  });

  test(`${file}: an asset on the app host is unchanged`, () => {
    const out = handlerFor(file, 'authgatehq.com')(event('authgatehq.com', '/assets/a.js'));
    assert.equal(out.uri, '/assets/a.js');
  });

  test(`${file}: an empty hostname never redirects`, () => {
    const h = handlerFor(file, '');
    for (const host of ['d3d49hg6rb8ylx.cloudfront.net', 'authgatehq.com']) {
      const out = h(event(host, '/docs/step-up'));
      assert.equal(out.statusCode, undefined, host);
      assert.equal(out.uri, '/index.html', host);
    }
  });
}

test('template.yaml: a mixed-case Host is the app host, so no redirect', () => {
  const out = handlerFor('template.yaml', 'authgatehq.com')(event('AuthGateHQ.com', '/docs/step-up'));
  assert.equal(out.statusCode, undefined);
  assert.equal(out.uri, '/index.html');
});

// The prerendered pages: CloudFront maps a clean URL to the folder's index.html.
test('template.yaml: prerendered pages map to their own index.html, everything else to the SPA shell', () => {
  const h = handlerFor('template.yaml', 'authgatehq.com', 'what-it-is,step-up');
  const uri = (u) => h(event('authgatehq.com', u)).uri;
  assert.equal(uri('/'), '/landing/index.html');
  assert.equal(uri('/vi'), '/vi/index.html');
  assert.equal(uri('/vi/'), '/vi/index.html');
  assert.equal(uri('/docs/step-up'), '/docs/step-up/index.html');
  assert.equal(uri('/docs/step-up/'), '/docs/step-up/index.html');
  assert.equal(uri('/vi/docs/step-up'), '/vi/docs/step-up/index.html');
  assert.equal(uri('/vi/docs/step-up/'), '/vi/docs/step-up/index.html');
  assert.equal(uri('/docs/nope'), '/index.html');
  assert.equal(uri('/vi/docs/nope'), '/index.html');
  assert.equal(uri('/app/login'), '/index.html');
  assert.equal(uri('/assets/x.js'), '/assets/x.js');
  assert.equal(uri('/robots.txt'), '/robots.txt');
  assert.equal(uri('/sitemap.xml'), '/sitemap.xml');
});

test('template.yaml: with no slugs, docs paths fall through to the shell; the landing still maps', () => {
  const h = handlerFor('template.yaml', 'authgatehq.com', '');
  assert.equal(h(event('authgatehq.com', '/docs/step-up')).uri, '/index.html');
  assert.equal(h(event('authgatehq.com', '/vi/docs/step-up')).uri, '/index.html');
  assert.equal(h(event('authgatehq.com', '/vi')).uri, '/vi/index.html');
});

test('template.yaml: the foreign-host redirect still comes first', () => {
  const out = handlerFor('template.yaml', 'authgatehq.com', 'step-up')(event('x.cloudfront.net', '/vi'));
  assert.equal(out.statusCode, 301);
  assert.equal(out.headers.location.value, 'https://authgatehq.com/vi');
});
