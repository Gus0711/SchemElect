// Démarre le serveur de dev sur une base SQLite neuve (tests de bout en bout).
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';

const port = process.argv[2] ?? '4299';
mkdirSync('test-results', { recursive: true });
for (const f of ['e2e.db', 'e2e.db-shm', 'e2e.db-wal'])
	rmSync(`test-results/${f}`, { force: true });
rmSync('test-results/backups', { recursive: true, force: true });

const child = spawn('npx', ['vite', 'dev', '--port', port, '--strictPort'], {
	stdio: 'inherit',
	shell: true,
	env: { ...process.env, DATABASE_URL: 'file:test-results/e2e.db', BACKUP_INTERVAL_HOURS: '0' }
});
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
child.on('exit', (code) => process.exit(code ?? 0));
