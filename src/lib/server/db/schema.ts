/**
 * Schéma Drizzle de la base SchemElect (SQLite / libSQL).
 * Toute modification doit être répercutée dans `migrate.ts` (SQL embarqué, idempotent).
 * Dates : chaînes ISO 8601 (UTC), sauf `sessions.expires_at` (ms epoch).
 */
import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** Sociétés : chaque donnée (comptes, dossiers, bibliothèques) appartient à une société. */
export const organizations = sqliteTable('organizations', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	createdAt: text('created_at').notNull()
});

export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	login: text('login').notNull().unique(),
	name: text('name').notNull(),
	passwordHash: text('password_hash').notNull(),
	role: text('role', { enum: ['superadmin', 'admin', 'user', 'viewer'] })
		.notNull()
		.default('user'),
	/** Société du compte (le super-administrateur peut basculer sur une autre). */
	organizationId: text('organization_id').notNull().default(''),
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
	/** Société propriétaire. */
	organizationId: text('organization_id').notNull().default(''),
	name: text('name').notNull(),
	affaireNumber: text('affaire_number').notNull().default(''),
	/** Affaire de rattachement (miroir de `meta.affaireId` du document) ; null = non classé. */
	affaireId: text('affaire_id'),
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
	/** Société propriétaire. */
	organizationId: text('organization_id').notNull().default(''),
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
	/** Société propriétaire. */
	organizationId: text('organization_id').notNull().default(''),
	name: text('name').notNull(),
	category: text('category').notNull().default(''),
	/** `SymbolDef` sérialisé en JSON. */
	def: text('def').notNull(),
	createdBy: text('created_by'),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull()
});

/** Modèles de cartouche et de page de garde : bibliothèque partagée. */
export const templates = sqliteTable('templates', {
	id: text('id').primaryKey(),
	/** Société propriétaire. */
	organizationId: text('organization_id').notNull().default(''),
	name: text('name').notNull(),
	/** `DocTemplate` sérialisé en JSON. */
	data: text('data').notNull(),
	createdBy: text('created_by'),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull()
});

/** Catalogue matériel : une fiche par référence constructeur (bibliothèque partagée). */
export const catalog = sqliteTable('catalog', {
	id: text('id').primaryKey(),
	/** Société propriétaire. */
	organizationId: text('organization_id').notNull().default(''),
	/** `referenceKey(reference)` : unicité indépendante des espaces / de la casse. */
	refKey: text('ref_key').notNull().unique(),
	reference: text('reference').notNull(),
	manufacturer: text('manufacturer').notNull().default(''),
	/** `CatalogItem` sérialisé en JSON. */
	data: text('data').notNull(),
	createdBy: text('created_by'),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull()
});

/** Clients (saisis à la main, ou repris de l'ERP : `source = 'erp'`). */
export const clients = sqliteTable('clients', {
	id: text('id').primaryKey(),
	organizationId: text('organization_id').notNull().default(''),
	name: text('name').notNull(),
	/** `nameKey(name)` : un seul client de ce nom par société. */
	nameKey: text('name_key').notNull(),
	code: text('code').notNull().default(''),
	city: text('city').notNull().default(''),
	source: text('source', { enum: ['manual', 'erp'] })
		.notNull()
		.default('manual'),
	/** Identifiant dans l'ERP (connecteur, plus tard). */
	externalId: text('external_id'),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull()
});

/** Affaires : une par n° WhySoft, rattachée à un client ; regroupe un ou plusieurs schémas. */
export const affaires = sqliteTable('affaires', {
	id: text('id').primaryKey(),
	organizationId: text('organization_id').notNull().default(''),
	clientId: text('client_id')
		.notNull()
		.references(() => clients.id),
	whysoft: text('whysoft').notNull().default(''),
	number: text('number').notNull().default(''),
	label: text('label').notNull().default(''),
	year: integer('year').notNull(),
	status: text('status', { enum: ['en_cours', 'terminee', 'archivee'] })
		.notNull()
		.default('en_cours'),
	source: text('source', { enum: ['manual', 'erp'] })
		.notNull()
		.default('manual'),
	externalId: text('external_id'),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull()
});

/** Historique des versions d'un dossier (voir `model/versions.ts`). */
export const projectVersions = sqliteTable('project_versions', {
	id: text('id').primaryKey(),
	projectId: text('project_id')
		.notNull()
		.references(() => projects.id, { onDelete: 'cascade' }),
	createdAt: text('created_at').notNull(),
	createdBy: text('created_by'),
	kind: text('kind', { enum: ['auto', 'named'] }).notNull(),
	label: text('label').notNull().default(''),
	/** `VersionSummary` en JSON (folios, appareils). */
	summary: text('summary').notNull(),
	/** SHA-256 du contenu (sans la date de modification) : pas de version sans changement. */
	hash: text('hash').notNull(),
	/** Document `Project` en JSON, compressé gzip puis encodé en base64. */
	data: text('data').notNull()
});

/** Préférences par utilisateur (symboles favoris…) : valeur JSON par clé. */
export const userPrefs = sqliteTable(
	'user_prefs',
	{
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		key: text('key').notNull(),
		value: text('value').notNull(),
		updatedAt: text('updated_at').notNull()
	},
	(t) => [primaryKey({ columns: [t.userId, t.key] })]
);

export type CustomSymbolRow = typeof customSymbols.$inferSelect;

export type UserRow = typeof users.$inferSelect;
export type ProjectRow = typeof projects.$inferSelect;
export type MacroRow = typeof macros.$inferSelect;
