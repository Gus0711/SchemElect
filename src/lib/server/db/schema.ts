/**
 * Schéma Drizzle de la base SchemElect (SQLite / libSQL).
 * Toute modification doit être répercutée dans `migrate.ts` (SQL embarqué, idempotent).
 * Dates : chaînes ISO 8601 (UTC), sauf `sessions.expires_at` (ms epoch).
 */
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	login: text('login').notNull().unique(),
	name: text('name').notNull(),
	passwordHash: text('password_hash').notNull(),
	role: text('role', { enum: ['admin', 'user'] })
		.notNull()
		.default('user'),
	createdAt: text('created_at').notNull()
});

export const sessions = sqliteTable('sessions', {
	/** SHA-256 hex du jeton envoyé en cookie (le jeton brut n'est jamais stocké). */
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: integer('expires_at').notNull()
});

export const projects = sqliteTable('projects', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	affaireNumber: text('affaire_number').notNull().default(''),
	/** Document `Project` sérialisé en JSON. */
	data: text('data').notNull(),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull(),
	updatedBy: text('updated_by'),
	lockedBy: text('locked_by'),
	lockedAt: text('locked_at')
});

export const macros = sqliteTable('macros', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	category: text('category').notNull().default(''),
	/** `Fragment` sérialisé en JSON. */
	data: text('data').notNull(),
	createdBy: text('created_by'),
	createdAt: text('created_at').notNull()
});

/** Symboles maison (image + bornes, blocs) : bibliothèque partagée. */
export const customSymbols = sqliteTable('custom_symbols', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	category: text('category').notNull().default(''),
	/** `SymbolDef` sérialisé en JSON. */
	def: text('def').notNull(),
	createdBy: text('created_by'),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull()
});

export type CustomSymbolRow = typeof customSymbols.$inferSelect;

export type UserRow = typeof users.$inferSelect;
export type ProjectRow = typeof projects.$inferSelect;
export type MacroRow = typeof macros.$inferSelect;
