/**
 * Accès base (Drizzle + libSQL). Connexion **paresseuse** : rien n'est ouvert à l'import
 * (le build SvelteKit analyse les modules serveur sans base disponible).
 * Usage : `const db = await getDb();`
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import { env } from '$env/dynamic/private';
import * as schema from './schema';
import { runMigrations } from './migrate';

export type Db = LibSQLDatabase<typeof schema>;

let client: Client | null = null;
let db: Db | null = null;
let ready: Promise<void> | null = null;

function open(): { client: Client; db: Db } {
	if (!client || !db) {
		const url = env.DATABASE_URL || 'file:local.db';
		if (url.startsWith('file:')) {
			// Crée le dossier parent (ex. /app/data) si besoin.
			const path = url.slice('file:'.length).replace(/^\/\/\//, '/');
			mkdirSync(dirname(resolve(path)), { recursive: true });
		}
		client = createClient({ url, authToken: env.DATABASE_AUTH_TOKEN || undefined });
		db = drizzle(client, { schema });
	}
	return { client, db };
}

async function ensureReady(): Promise<{ client: Client; db: Db }> {
	const conn = open();
	if (!ready) {
		ready = runMigrations(conn.client).catch((e) => {
			ready = null;
			throw e;
		});
	}
	await ready;
	return conn;
}

export async function getDb(): Promise<Db> {
	return (await ensureReady()).db;
}

/** Client libSQL brut (requêtes hors Drizzle : `VACUUM INTO` des sauvegardes). */
export async function getClient(): Promise<Client> {
	return (await ensureReady()).client;
}

export { schema };
