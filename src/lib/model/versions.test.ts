import { describe, expect, it } from 'vitest';
import { addSymbol } from './edit';
import { createProject } from './project';
import {
	addedRevisions,
	canRestore,
	duplicateDocument,
	shouldAutoVersion,
	versionContent,
	versionsToPrune,
	versionSummary
} from './versions';

const H = 3600 * 1000;
const now = Date.parse('2026-10-15T12:00:00Z');
const ago = (ms: number) => new Date(now - ms).toISOString();

describe('versions : quand en créer', () => {
	it('version automatique toutes les 15 min, jamais sans changement', () => {
		expect(shouldAutoVersion(undefined, 'h', now)).toBe(true);
		expect(shouldAutoVersion({ createdAt: ago(20 * 60_000), hash: 'a' }, 'b', now)).toBe(true);
		expect(shouldAutoVersion({ createdAt: ago(5 * 60_000), hash: 'a' }, 'b', now)).toBe(false);
		expect(shouldAutoVersion({ createdAt: ago(5 * H), hash: 'a' }, 'a', now)).toBe(false);
	});

	it('le contenu ignore la date de modification', () => {
		const p = createProject('A');
		const before = versionContent(p);
		p.meta.modifiedAt = 'autre';
		expect(versionContent(p)).toBe(before);
		p.meta.name = 'B';
		expect(versionContent(p)).not.toBe(before);
	});

	it('détecte les nouveaux indices de révision', () => {
		const a = createProject('A');
		a.revisions = [{ indice: 'A', description: 'Création', date: '' }];
		const b = structuredClone(a);
		b.revisions.push({ indice: 'B', description: 'Ajout pompe', date: '' });
		b.revisions.push({ indice: ' ', description: 'vide', date: '' });
		expect(addedRevisions(a, b).map((r) => r.indice)).toEqual(['B']);
		expect(addedRevisions(null, a).map((r) => r.indice)).toEqual(['A']);
		expect(addedRevisions(b, b)).toEqual([]);
	});

	it('résumé : folios et appareils', () => {
		const p = createProject('A');
		addSymbol(p, p.folios[0], 'bobine-contacteur', { x: 100, y: 50 });
		addSymbol(p, p.folios[0], 'borne-p', { x: 60, y: 150 });
		expect(versionSummary(p)).toEqual({ folios: 1, devices: 1 });
	});
});

describe('versions : conservation', () => {
	it('tout sur 48 h, puis la dernière de chaque jour sur 30 jours, nommées toujours', () => {
		const v = [
			{ id: 'recent1', kind: 'auto' as const, createdAt: ago(1 * H) },
			{ id: 'recent2', kind: 'auto' as const, createdAt: ago(40 * H) },
			// Même jour, il y a 5 jours : seule la plus récente reste.
			{ id: 'j5-soir', kind: 'auto' as const, createdAt: '2026-10-10T18:00:00Z' },
			{ id: 'j5-matin', kind: 'auto' as const, createdAt: '2026-10-10T08:00:00Z' },
			{ id: 'vieux', kind: 'auto' as const, createdAt: ago(40 * 24 * H) },
			{ id: 'indice-A', kind: 'named' as const, createdAt: ago(400 * 24 * H) }
		];
		expect(versionsToPrune(v, now).sort()).toEqual(['j5-matin', 'vieux']);
	});
});

describe('versions : droits et duplication', () => {
	it('restauration : admin ou intervenant', () => {
		expect(canRestore({ id: 'u1', role: 'admin' }, [])).toBe(true);
		expect(canRestore({ id: 'u2', role: 'user' }, ['u1', 'u2'])).toBe(true);
		expect(canRestore({ id: 'u3', role: 'user' }, ['u1', 'u2'])).toBe(false);
	});

	it('duplique pour une nouvelle affaire', () => {
		const p = createProject('Chaufferie A');
		p.meta.affaireNumber = 'DW1';
		p.revisions = [{ indice: 'A', description: 'Création', date: '' }];
		addSymbol(p, p.folios[0], 'bobine-contacteur', { x: 100, y: 50 });
		const at = new Date('2026-10-20T08:00:00Z');
		const copy = duplicateDocument(
			p,
			{ name: ' Chaufferie B ', affaireNumber: 'DW2', resetRevisions: true, author: 'Gus' },
			at
		);
		expect(copy.meta).toMatchObject({
			name: 'Chaufferie B',
			affaireNumber: 'DW2',
			author: 'Gus',
			createdAt: at.toISOString()
		});
		expect(copy.revisions).toEqual([]);
		expect(Object.keys(copy.devices)).toHaveLength(1);
		// La source n'est pas modifiée.
		expect(p.meta.name).toBe('Chaufferie A');
		expect(duplicateDocument(p, { name: '' }).meta.name).toBe('Chaufferie A (copie)');
		expect(duplicateDocument(p, { name: 'X' }).revisions).toHaveLength(1);
	});
});
