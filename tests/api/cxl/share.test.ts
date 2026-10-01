import { describe, expect, it } from 'vitest';
import { injectShareMeta, shareImageUrl, shareMeta } from '../../../api/cxl/share';

const ORIGIN = 'https://cxl.example';
const SHELL = `<!doctype html><html><head>
    <title>CXL Studio</title>
    <meta name="description" content="default" />
    <meta property="og:title" content="CXL Studio" />
    <meta name="twitter:card" content="summary_large_image" />
    <script type="module" src="/assets/index.js"></script>
  </head><body><div id="root"></div></body></html>`;

describe('Work share previews', () => {
  it('uses the public proxy for a proxied cover', () => {
    const work = { id: 'asset_a', previewImage: 'media:cover1', media: [{ id: 'cover1', delivery: 'vercel_proxy' }] };
    expect(shareImageUrl(work, ORIGIN)).toBe(`${ORIGIN}/api/cxl/media?workId=asset_a&ref=media%3Acover1&scope=public`);
  });

  it('falls back to the site icon without a cover or image icon', () => {
    expect(shareImageUrl({ id: 'asset_a', icon: { type: 'emoji', value: '✨' } }, ORIGIN)).toBe(`${ORIGIN}/icon-512.png`);
  });

  it('escapes Work text and replaces the default tags once', () => {
    const work = { id: 'asset_a', title: 'Hi "<b>"', shortDescription: 'A & B', authorName: 'X' };
    const html = injectShareMeta(SHELL, shareMeta(work, ORIGIN, `${ORIGIN}/work/asset_a`));
    expect(html).toContain('<meta property="og:title" content="Hi &quot;&lt;b&quot; · CXL Studio" />');
    expect(html).toContain('<meta property="og:description" content="A &amp; B" />');
    expect(html.match(/<title>/g)).toHaveLength(1);
    expect(html.match(/twitter:card/g)).toHaveLength(1);
    expect(html).not.toContain('content="default"');
    expect(html).toContain('<script type="module" src="/assets/index.js"></script>');
  });

  it('keeps site defaults for a private or missing Work', () => {
    const html = injectShareMeta(SHELL, shareMeta(null, ORIGIN, `${ORIGIN}/work/asset_x`));
    expect(html).toContain('<title>CXL Studio</title>');
    expect(html).toContain(`content="${ORIGIN}/icon-512.png"`);
  });
});
