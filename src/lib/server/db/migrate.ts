/**
 * Migration embarquée, idempotente, exécutée une fois au premier accès à la base :
 * `npm run dev` fonctionne sans étape manuelle. Doit rester alignée sur `schema.ts`.
 */
import type { Client } from '@libsql/client';

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS organizations (
	id TEXT PRIMARY KEY NOT NULL,
	name TEXT NOT NULL,
	created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
	id TEXT PRIMARY KEY NOT NULL,
	login TEXT NOT NULL UNIQUE,
	name TEXT NOT NULL,
	password_hash TEXT NOT NULL,
	role TEXT NOT NULL DEFAULT 'user',
	created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
	id TEXT PRIMARY KEY NOT NULL,
	user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE TABLE IF NOT EXISTS projects (
	id TEXT PRIMARY KEY NOT NULL,
	name TEXT NOT NULL,
	affaire_number TEXT NOT NULL DEFAULT '',
	data TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	updated_by TEXT,
	locked_by TEXT,
	locked_at TEXT
);
CREATE TABLE IF NOT EXISTS macros (
	id TEXT PRIMARY KEY NOT NULL,
	name TEXT NOT NULL,
	category TEXT NOT NULL DEFAULT '',
	data TEXT NOT NULL,
	created_by TEXT,
	created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS custom_symbols (
	id TEXT PRIMARY KEY NOT NULL,
	name TEXT NOT NULL,
	category TEXT NOT NULL DEFAULT '',
	def TEXT NOT NULL,
	created_by TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS templates (
	id TEXT PRIMARY KEY NOT NULL,
	name TEXT NOT NULL,
	data TEXT NOT NULL,
	created_by TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_versions (
	id TEXT PRIMARY KEY NOT NULL,
	project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
	created_at TEXT NOT NULL,
	created_by TEXT,
	kind TEXT NOT NULL,
	label TEXT NOT NULL DEFAULT '',
	summary TEXT NOT NULL,
	hash TEXT NOT NULL,
	data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS project_versions_project_idx ON project_versions(project_id, created_at);

CREATE TABLE IF NOT EXISTS user_prefs (
	user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	key TEXT NOT NULL,
	value TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	PRIMARY KEY (user_id, key)
);

CREATE TABLE IF NOT EXISTS catalog (
	id TEXT PRIMARY KEY NOT NULL,
	ref_key TEXT NOT NULL UNIQUE,
	reference TEXT NOT NULL,
	manufacturer TEXT NOT NULL DEFAULT '',
	data TEXT NOT NULL,
	created_by TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clients (
	id TEXT PRIMARY KEY NOT NULL,
	organization_id TEXT NOT NULL DEFAULT '',
	name TEXT NOT NULL,
	name_key TEXT NOT NULL,
	code TEXT NOT NULL DEFAULT '',
	city TEXT NOT NULL DEFAULT '',
	source TEXT NOT NULL DEFAULT 'manual',
	external_id TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS clients_org_idx ON clients(organization_id, name_key);

CREATE TABLE IF NOT EXISTS affaires (
	id TEXT PRIMARY KEY NOT NULL,
	organization_id TEXT NOT NULL DEFAULT '',
	client_id TEXT NOT NULL REFERENCES clients(id),
	whysoft TEXT NOT NULL DEFAULT '',
	number TEXT NOT NULL DEFAULT '',
	label TEXT NOT NULL DEFAULT '',
	year INTEGER NOT NULL,
	status TEXT NOT NULL DEFAULT 'en_cours',
	source TEXT NOT NULL DEFAULT 'manual',
	external_id TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS affaires_org_idx ON affaires(organization_id, client_id);
`;

/** Société créée pour les données d'avant le multi-société (et par le premier lancement). */
export const FIRST_ORG_ID = 'org_main';

/** Tables dont chaque ligne appartient à une société (colonne `organization_id`). */
const ORG_TABLES = [
	'users',
	'projects',
	'macros',
	'custom_symbols',
	'templates',
	'catalog',
	'clients',
	'affaires'
];

async function hasColumn(client: Client, table: string, column: string): Promise<boolean> {
	const res = await client.execute(`PRAGMA table_info(${table})`);
	return res.rows.some((r) => r.name === column);
}

export async function runMigrations(client: Client): Promise<void> {
	await client.executeMultiple(SCHEMA_SQL);

	// Multi-société (2026-10) : colonne organization_id ajoutée aux tables existantes.
	for (const table of ORG_TABLES)
		if (!(await hasColumn(client, table, 'organization_id')))
			await client.execute(
				`ALTER TABLE ${table} ADD COLUMN organization_id TEXT NOT NULL DEFAULT ''`
			);

	// Base existante sans société : tout est rattaché à la société « Dumortier », et le plus
	// ancien administrateur devient super-administrateur.
	const users = await client.execute('SELECT COUNT(*) AS n FROM users');
	const orgs = await client.execute('SELECT COUNT(*) AS n FROM organizations');
	if (Number(users.rows[0].n) > 0 && Number(orgs.rows[0].n) === 0)
		await client.execute({
			sql: 'INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)',
			args: [FIRST_ORG_ID, 'Dumortier', new Date().toISOString()]
		});
	for (const table of ORG_TABLES)
		await client.execute({
			sql: `UPDATE ${table} SET organization_id = ? WHERE organization_id = ''`,
			args: [FIRST_ORG_ID]
		});
	const supers = await client.execute("SELECT COUNT(*) AS n FROM users WHERE role = 'superadmin'");
	if (Number(supers.rows[0].n) === 0)
		await client.execute(
			"UPDATE users SET role = 'superadmin' WHERE id = (SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1)"
		);

	// Classement (2026-10) : affaire de rattachement des dossiers (null = non classé).
	if (!(await hasColumn(client, 'projects', 'affaire_id')))
		await client.execute('ALTER TABLE projects ADD COLUMN affaire_id TEXT');

	// Catalogue : une fiche par référence ET par société (clé « société|référence »).
	await client.execute(
		"UPDATE catalog SET ref_key = organization_id || '|' || ref_key WHERE instr(ref_key, '|') = 0"
	);
}
