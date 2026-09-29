import { describe, expect, it } from 'vitest';
import { LOCK_TTL_MS, canAcquireLock, isLockActive, lockCutoff, toLockInfo } from './locks';

const now = Date.parse('2026-09-28T10:00:00.000Z');
const ago = (ms: number) => new Date(now - ms).toISOString();

describe('verrous d’édition', () => {
	it('libre si aucun détenteur', () => {
		expect(isLockActive({ lockedBy: null, lockedAt: null }, now)).toBe(false);
		expect(canAcquireLock({ lockedBy: null, lockedAt: null }, 'u2', now)).toBe(true);
	});

	it('actif pendant 2 min après le dernier rafraîchissement', () => {
		expect(LOCK_TTL_MS).toBe(120_000);
		expect(isLockActive({ lockedBy: 'u1', lockedAt: ago(30_000) }, now)).toBe(true);
		expect(isLockActive({ lockedBy: 'u1', lockedAt: ago(119_999) }, now)).toBe(true);
		expect(isLockActive({ lockedBy: 'u1', lockedAt: ago(120_000) }, now)).toBe(false);
	});

	it('un autre utilisateur ne peut pas prendre un verrou actif', () => {
		const state = { lockedBy: 'u1', lockedAt: ago(60_000) };
		expect(canAcquireLock(state, 'u1', now)).toBe(true);
		expect(canAcquireLock(state, 'u2', now)).toBe(false);
	});

	it('un verrou expiré peut être repris', () => {
		expect(canAcquireLock({ lockedBy: 'u1', lockedAt: ago(5 * 60_000) }, 'u2', now)).toBe(true);
	});

	it('date invalide = verrou inactif', () => {
		expect(isLockActive({ lockedBy: 'u1', lockedAt: 'n/a' }, now)).toBe(false);
	});

	it('seuil SQL cohérent (comparaison ISO lexicographique)', () => {
		const cutoff = lockCutoff(now);
		expect(ago(119_000) > cutoff).toBe(true);
		expect(ago(121_000) < cutoff).toBe(true);
	});

	it('toLockInfo', () => {
		expect(toLockInfo({ lockedBy: 'u1', lockedAt: ago(1000), userName: 'Alice' }, now)).toEqual({
			userId: 'u1',
			userName: 'Alice',
			at: ago(1000)
		});
		expect(
			toLockInfo({ lockedBy: 'u1', lockedAt: ago(LOCK_TTL_MS + 1), userName: 'Alice' }, now)
		).toBeNull();
	});
});
