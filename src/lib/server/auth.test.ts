import { describe, expect, it } from 'vitest';
import {
	SESSION_TTL_MS,
	generateSessionToken,
	hashPassword,
	hashToken,
	normalizeLogin,
	shouldRenewSession,
	verifyPassword
} from './auth';

describe('mots de passe (Argon2id)', () => {
	it('hache et vérifie', async () => {
		const h = await hashPassword('secret-123');
		expect(h.startsWith('$argon2id$')).toBe(true);
		expect(await verifyPassword(h, 'secret-123')).toBe(true);
		expect(await verifyPassword(h, 'mauvais')).toBe(false);
	});

	it('deux hachages du même mot de passe diffèrent (sel)', async () => {
		expect(await hashPassword('abc')).not.toBe(await hashPassword('abc'));
	});

	it('un hash invalide ne lève pas', async () => {
		expect(await verifyPassword('pas-un-hash', 'x')).toBe(false);
	});
});

describe('jetons de session', () => {
	it('32 octets en base64url', () => {
		const t = generateSessionToken();
		expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(generateSessionToken()).not.toBe(t);
	});

	it('hash SHA-256 hex déterministe', () => {
		expect(hashToken('abc')).toBe(
			'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
		);
		expect(hashToken('abc')).toMatch(/^[0-9a-f]{64}$/);
		expect(hashToken('abd')).not.toBe(hashToken('abc'));
	});

	it('expiration glissante : renouvelée au plus une fois par jour', () => {
		const now = 1_000_000_000_000;
		expect(shouldRenewSession(now + SESSION_TTL_MS, now)).toBe(false);
		expect(shouldRenewSession(now + SESSION_TTL_MS - 2 * 3600_000, now)).toBe(false);
		expect(shouldRenewSession(now + SESSION_TTL_MS - 25 * 3600_000, now)).toBe(true);
	});

	it('normalise les identifiants', () => {
		expect(normalizeLogin('  Augustin.D ')).toBe('augustin.d');
	});
});
