import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./AssetCard.tsx', import.meta.url), 'utf8');

describe('AssetCard public icon rendering', () => {
  it('lazy loads card icons and resets to the existing category fallback if the image fails', () => {
    expect(source).toContain('loading="lazy" decoding="async"');
    expect(source).toContain('onError={() => setIconFailed(true)}');
    expect(source).toContain('!iconFailed && isValidWorkIcon(asset.icon)');
    expect(source).toContain(': categoryMeta.emoji}</div>');
  });

  it('replaces failed legacy cover images with the existing gradient and title fallback', () => {
    expect(source).toContain('onError={() => setCoverFailed(true)}');
    expect(source).toContain("mainImage && !coverFailed ? 'has-image' : 'has-fallback'");
    expect(source).toContain('{mainImage && !coverFailed ? (');
    expect(source).toContain('cv-card-fallback cv-fallback-');
  });
});

