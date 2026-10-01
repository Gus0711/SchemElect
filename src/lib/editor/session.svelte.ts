/**
 * Session d'édition : verrou (un seul éditeur par projet) et sauvegarde automatique.
 */
import { acquireLock, ApiError, releaseLock, saveProject, type LockInfo } from '$lib/api/client';
import type { Editor } from './editor.svelte';

export type SaveStatus =
	| 'connecting'
	| 'saved'
	| 'pending'
	| 'saving'
	| 'error'
	| 'readonly'
	/** Consultation d'une version de l'historique (aucune sauvegarde). */
	| 'archive';

const SAVE_DELAY = 1200;
const HEARTBEAT = 30_000;

export class EditSession {
	status: SaveStatus = $state('connecting');
	lock: LockInfo | null = $state(null);
	error = $state('');

	private timer: ReturnType<typeof setTimeout> | null = null;
	private heartbeat: ReturnType<typeof setInterval> | null = null;
	private savedRevision = 0;
	private saving: Promise<void> | null = null;
	/** Plus aucune sauvegarde (restauration en cours, consultation d'une version). */
	private suspended = false;

	constructor(
		private projectId: string,
		private editor: Editor
	) {}

	/** Tente d'obtenir le verrou ; sinon l'éditeur passe en lecture seule. */
	async start() {
		await this.refreshLock();
		this.heartbeat = setInterval(() => this.refreshLock(), HEARTBEAT);
	}

	private async refreshLock() {
		try {
			const res = await acquireLock(this.projectId);
			this.lock = res.lock;
			const readonly = !res.owned;
			if (readonly !== this.editor.readonly) this.editor.readonly = readonly;
			if (readonly) this.status = 'readonly';
			else if (this.status === 'readonly' || this.status === 'connecting') this.status = 'saved';
		} catch {
			/* réseau indisponible : on réessaiera au prochain battement */
		}
	}

	/** À appeler quand `editor.revision` change. */
	schedule(revision: number) {
		if (this.suspended || this.editor.readonly || revision === this.savedRevision) return;
		this.status = 'pending';
		if (this.timer) clearTimeout(this.timer);
		this.timer = setTimeout(() => this.flush(), SAVE_DELAY);
	}

	async flush() {
		if (this.timer) clearTimeout(this.timer);
		this.timer = null;
		if (this.suspended || this.editor.readonly) return;
		if (this.saving) await this.saving;
		const revision = this.editor.revision;
		if (revision === this.savedRevision) return;
		this.status = 'saving';
		this.saving = (async () => {
			try {
				await saveProject(this.projectId, $state.snapshot(this.editor.project));
				this.savedRevision = revision;
				this.error = '';
				this.status = this.editor.revision === revision ? 'saved' : 'pending';
				if (this.status === 'pending') this.schedule(this.editor.revision);
			} catch (e) {
				this.status = 'error';
				this.error =
					e instanceof ApiError && e.status === 409
						? 'Le projet est verrouillé par un autre utilisateur.'
						: 'Échec de l’enregistrement. Nouvel essai automatique…';
				if (e instanceof ApiError && e.status === 409) await this.refreshLock();
				else this.timer = setTimeout(() => this.flush(), 5000);
			} finally {
				this.saving = null;
			}
		})();
		await this.saving;
	}

	get dirty() {
		return !this.suspended && this.editor.revision !== this.savedRevision;
	}

	/**
	 * Arrête les sauvegardes (avant une restauration : le document du serveur va changer
	 * et la page être rechargée). Le verrou reste tenu jusqu'à `stop()`.
	 */
	suspend() {
		this.suspended = true;
		if (this.timer) clearTimeout(this.timer);
		this.timer = null;
	}

	/** Reprend les sauvegardes après `suspend()` (restauration refusée). */
	resume() {
		this.suspended = false;
		this.schedule(this.editor.revision);
	}

	/** Consultation d'une version : lecture seule, sans verrou ni sauvegarde. */
	archive() {
		this.suspended = true;
		this.status = 'archive';
		this.editor.readonly = true;
	}

	stop() {
		if (this.heartbeat) clearInterval(this.heartbeat);
		if (this.timer) clearTimeout(this.timer);
		if (!this.editor.readonly && this.status !== 'archive') releaseLock(this.projectId);
	}
}
