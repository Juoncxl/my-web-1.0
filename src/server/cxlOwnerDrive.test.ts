import { describe, expect, it } from 'vitest';
import { hasOwnerDriveScopes, openRefreshToken, sealRefreshToken } from './cxlOwnerDrive';

const secret = 'x'.repeat(48);

describe('Owner Drive credential sealing', () => {
  it('round-trips the refresh token and never stores it in clear text', () => {
    const sealed = sealRefreshToken('1//refresh-token-value', secret, 'owner@example.com', new Date('2026-09-30T00:00:00Z'));
    expect(sealed).not.toContain('refresh-token-value');
    expect(openRefreshToken(sealed, secret)).toEqual({ refreshToken: '1//refresh-token-value', email: 'owner@example.com', connectedAt: '2026-09-30T00:00:00.000Z' });
  });

  it('rejects a credential sealed with another secret or tampered with', () => {
    const sealed = sealRefreshToken('token', secret);
    expect(() => openRefreshToken(sealed, 'y'.repeat(48))).toThrow();
    const tampered = JSON.parse(sealed);
    tampered.data = Buffer.from('other').toString('base64url');
    expect(() => openRefreshToken(JSON.stringify(tampered), secret)).toThrow();
  });

  it('requires both Drive and Sheets scopes', () => {
    expect(hasOwnerDriveScopes('openid https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets')).toBe(true);
    expect(hasOwnerDriveScopes('openid https://www.googleapis.com/auth/drive')).toBe(false);
    expect(hasOwnerDriveScopes(undefined)).toBe(false);
  });
});
