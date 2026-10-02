import { createClient } from '@libsql/client';
import { describe, expect, it } from 'vitest';
import { FIRST_ORG_ID, runMigrations } from './migrate';

describe('migration multi-société', () => {
	it('rattache une base existante à « Dumortier » et promeut le 1er administrateur', async () => {
		const db = createClient({ url: ':memory:' });
		// Base d'avant le multi-société (colonnes d'origine).
		await db.executeMultiple(`
			CREATE TABLE users (id TEXT PRIMARY KEY, login TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
				password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', created_at TEXT NOT NULL);
			CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, affaire_number TEXT NOT NULL DEFAULT '',
				data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT,
				locked_by TEXT, locked_at TEXT);
			CREATE TABLE catalog (id TEXT PRIMARY KEY, ref_key TEXT NOT NULL UNIQUE, reference TEXT NOT NULL,
				manufacturer TEXT NOT NULL DEFAULT '', data TEXT NOT NULL, created_by TEXT,
				created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
			INSERT INTO users VALUES ('u1', 'gus', 'Gus', 'x', 'admin', '2026-01-01');
			INSERT INTO users VALUES ('u2', 'bob', 'Bob', 'x', 'admin', '2026-02-01');
			INSERT INTO users VALUES ('u3', 'eve', 'Eve', 'x', 'user', '2026-03-01');
			INSERT INTO projects (id, name, data, created_at, updated_at) VALUES ('p1', 'A', '{}', 'x', 'x');
			INSERT INTO catalog (id, ref_key, reference, data, created_at, updated_at)
				VALUES ('c1', 'LC1D09B7', 'LC1D09B7', '{}', 'x', 'x');
		`);
		await runMigrations(db);
		await runMigrations(db); // idempotente

		const orgs = await db.execute('SELECT id, name FROM organizations');
		expect(orgs.rows.map((r) => [r.id, r.name])).toEqual([[FIRST_ORG_ID, 'Dumortier']]);
		const users = await db.execute('SELECT id, role, organization_id FROM users ORDER BY id');
		expect(users.rows.map((r) => [r.id, r.role, r.organization_id])).toEqual([
			['u1', 'superadmin', FIRST_ORG_ID],
			['u2', 'admin', FIRST_ORG_ID],
			['u3', 'user', FIRST_ORG_ID]
		]);
		const p = await db.execute('SELECT organization_id FROM projects');
		expect(p.rows[0].organization_id).toBe(FIRST_ORG_ID);
		const c = await db.execute('SELECT ref_key FROM catalog');
		expect(c.rows[0].ref_key).toBe(`${FIRST_ORG_ID}|LC1D09B7`);
	});

	it('base neuve : tables créées, aucune société avant le premier lancement', async () => {
		const db = createClient({ url: ':memory:' });
		await runMigrations(db);
		const orgs = await db.execute('SELECT COUNT(*) AS n FROM organizations');
		expect(Number(orgs.rows[0].n)).toBe(0);
		const cols = await db.execute('PRAGMA table_info(templates)');
		expect(cols.rows.some((r) => r.name === 'organization_id')).toBe(true);
	});
});
