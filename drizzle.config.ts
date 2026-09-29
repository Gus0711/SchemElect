import { defineConfig } from 'drizzle-kit';

// Utilisé par les scripts `npm run db:*`. Au runtime, les tables sont créées
// automatiquement par src/lib/server/db/migrate.ts.
export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	dialect: 'turso',
	dbCredentials: {
		url: process.env.DATABASE_URL ?? 'file:local.db',
		authToken: process.env.DATABASE_AUTH_TOKEN
	},
	verbose: true,
	strict: true
});
