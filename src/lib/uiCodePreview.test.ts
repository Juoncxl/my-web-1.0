import { describe, expect, it } from 'vitest';
import { buildSafeUiPreviewDocument, parseUiCode, sanitizeUiHtml } from './uiCodePreview';

describe('ui code preview pipeline', () => {
  it('extracts style blocks and legacy CSS delimiter from one source', () => {
    const parsed = parseUiCode('<section class="card">Hi</section><style>.card{color:red}</style>');
    expect(parsed.html).toContain('<section class="card">Hi</section>');
    expect(parsed.html).not.toContain('<style>');
    expect(parsed.css).toContain('.card{color:red}');
  });

  it('keeps CSS in the stylesheet and applies it in the isolated document', () => {
    const document = buildSafeUiPreviewDocument('<p class="hero">Hi</p>\n<style>.hero{background:linear-gradient(red,blue)}</style>');
    expect(document).toContain('<style>.hero{background:linear-gradient(red,blue)}</style>');
    expect(document).toContain('<p class="hero">Hi</p>');
    expect(document.slice(document.indexOf('<body>'))).not.toContain('<style>');
  });

  it('removes executable scripts, handlers, and dangerous URLs', () => {
    const safe = sanitizeUiHtml('<script>alert(1)</script><button onclick="alert(1)">Go</button><a href="javascript:alert(1)">x</a>');
    expect(safe).not.toMatch(/script|onclick|javascript:/i);
    expect(buildSafeUiPreviewDocument('<script>alert(1)</script>')).toContain("script-src 'none'");
  });

  it('renders safe HTML and CSS while disabling script in an actual UI Code source', () => {
    const document = buildSafeUiPreviewDocument('<div class="safe-test">SAFE CONTENT</div><style>.safe-test{padding:24px;color:white}</style><script>alert("x")</script>');
    expect(document).toContain('<div class="safe-test">SAFE CONTENT</div>');
    expect(document).toContain('<style>.safe-test{padding:24px;color:white}</style>');
    expect(document).not.toContain('alert("x")');
    expect(document).toContain("script-src 'none'");
  });

  it('does not crash when the source is malformed', () => {
    expect(() => buildSafeUiPreviewDocument('<div><style>.broken { color: red')).not.toThrow();
    expect(buildSafeUiPreviewDocument('<div><style>.broken { color: red')).toContain('<body><div>');
  });
});
