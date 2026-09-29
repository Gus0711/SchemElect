/**
 * Migration embarquée, idempotente, exécutée une fois au premier accès à la base :
 * `npm run dev` fonctionne sans étape manuelle. Doit rester alignée sur `schema.ts`.
 */
import type { Client } from '@libsql/client';

export const SCHEMA_SQL = `
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
`;

export async function runMigrations(client: Client): Promise<void> {
	await client.executeMultiple(SCHEMA_SQL);
}
