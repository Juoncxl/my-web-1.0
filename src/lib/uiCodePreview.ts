export interface ParsedUiCode {
  html: string;
  css: string;
}

/** Parse the single-source UI Code format without treating CSS as body text. */
export function parseUiCode(source: string): ParsedUiCode {
  const input = source || '';
  const delimiter = /\/\*\s*CSS\s*\*\//i;
  const delimiterParts = input.split(delimiter);
  let html = delimiterParts[0] || '';
  let css = delimiterParts.slice(1).join('/* CSS */');

  // Creator examples may use a normal <style> block instead of the legacy
  // delimiter. Pull those rules into the isolated stylesheet and keep only
  // markup in the preview body.
  html = html.replace(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi, (_match, rules: string) => {
    css = `${css}\n${rules}`.trim();
    return '';
  });

  return { html: html.trim(), css: css.trim() };
}

export function sanitizeUiHtml(html: string): string {
  return (html || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<script\b[^>]*>/gi, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe\s*>/gi, '')
    .replace(/<object\b[^>]*>[\s\S]*?<\/object\s*>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .replace(/<form\b[^>]*>[\s\S]*?<\/form\s*>/gi, '')
    .replace(/\s(?:href|src|action)\s*=\s*(?:"|')\s*(?:javascript|vbscript|data\s*:\s*text\/html):[\s\S]*?(?:"|')/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/vbscript\s*:/gi, '')
    .replace(/data\s*:\s*text\/html/gi, 'about:blank');
}

export function buildSafeUiPreviewDocument(source: string): string {
  const parsed = parseUiCode(source);
  const safeHtml = sanitizeUiHtml(parsed.html);
  const safeCss = (parsed.css || '').replace(/<\/style/gi, '<\\/style');
  const csp = "default-src 'none'; style-src 'unsafe-inline'; img-src data: blob: https:; font-src data: https:; script-src 'none'; connect-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${csp}"><style>html,body{margin:0;min-height:100%;background:transparent}*{box-sizing:border-box}</style><style>${safeCss}</style></head><body>${safeHtml}</body></html>`;
}
