import { defineConfig } from '@playwright/test';

/**
 * Tests de bout en bout : serveur de dev sur une base jetable.
 * Navigateur : Microsoft Edge installé sur le poste (pas de téléchargement de navigateur).
 * Lancer : npm run test:e2e
 */
const PORT = 4299;

export default defineConfig({
	testDir: 'tests/e2e',
	timeout: 60_000,
	fullyParallel: false,
	workers: 1,
	use: {
		baseURL: `http://127.0.0.1:${PORT}`,
		channel: 'msedge',
		viewport: { width: 1600, height: 950 },
		acceptDownloads: true
	},
	webServer: {
		command: `node scripts/e2e-server.mjs ${PORT}`,
		url: `http://127.0.0.1:${PORT}/login`,
		reuseExistingServer: false,
		timeout: 120_000
	}
});
