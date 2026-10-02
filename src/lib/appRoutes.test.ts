import { describe, expect, it } from 'vitest';
import { isKnownAppPath } from './appRoutes';

describe('isKnownAppPath', () => {
  it('keeps current and legacy routes working', () => {
    for (const path of ['/', '/index.html', '/@juoncxl', '/@juoncxl/', '/work/asset_abc', '/work/asset_abc/edit', '/schedule',
      '/creator/juoncxl', '/vault', '/creator-space/']) {
      expect(isKnownAppPath(path), path).toBe(true);
    }
  });

  it('treats anything else as not found', () => {
    for (const path of ['/abc', '/work', '/work/a/b', '/@juoncxl/extra', '/schedule/x', '/settings', '/api']) {
      expect(isKnownAppPath(path), path).toBe(false);
    }
  });
});
