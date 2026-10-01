<script lang="ts">
	/**
	 * Historique du dossier : versions automatiques et nommées (indices, « Envoyé au
	 * client »…). Voir (lecture seule, PDF), restaurer, dupliquer.
	 */
	import { createVersion, listVersions, restoreVersion } from '$lib/api/client';
	import type { VersionInfo } from '$lib/model/versions';
	import { Alert, Button, Modal } from '$lib/ui';
	import { BookmarkPlus, Copy, Eye, History, RotateCcw } from '@lucide/svelte';
	import type { Editor } from '../editor.svelte';
	import type { EditSession } from '../session.svelte';

	let {
		open = $bindable(false),
		projectId,
		editor,
		session,
		onduplicate
	}: {
		open?: boolean;
		projectId: string;
		editor: Editor;
		session: EditSession;
		/** Dupliquer une version (ou l'état actuel si absente). */
		onduplicate: (version?: VersionInfo) => void;
	} = $props();

	let versions: VersionInfo[] = $state([]);
	let allowed = $state(false);
	let loading = $state(false);
	let pending = $state(false);
	let error = $state('');
	let info = $state('');
	let label = $state('');

	const fmt = new Intl.DateTimeFormat('fr-FR', {
		weekday: 'short',
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
	const when = (iso: string) => fmt.format(new Date(iso));

	async function load() {
		loading = true;
		error = '';
		try {
			const res = await listVersions(projectId);
			versions = res.versions;
			allowed = res.canRestore;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Historique indisponible';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (open) {
			info = '';
			load();
		}
	});

	async function save() {
		pending = true;
		error = '';
		try {
			// La version porte sur l'état enregistré : enregistrer d'abord les modifications.
			await session.flush();
			await createVersion(projectId, label.trim());
			info = `Version « ${label.trim() || 'Version enregistrée'} » créée.`;
			label = '';
			await load();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Enregistrement impossible';
		} finally {
			pending = false;
		}
	}

	async function restore(v: VersionInfo) {
		if (
			!confirm(
				`Remettre le dossier dans l’état du ${when(v.createdAt)}${v.label ? ` (${v.label})` : ''} ?\n\nL’état actuel est d’abord enregistré dans l’historique (« Avant restauration… ») : la restauration peut être annulée en le restaurant.`
			)
		)
			return;
		pending = true;
		error = '';
		try {
			await session.flush();
			session.suspend();
			await restoreVersion(projectId, v.id);
			// Le document a changé sur le serveur : recharger l'éditeur.
			location.reload();
		} catch (e) {
			session.resume();
			error = e instanceof Error ? e.message : 'Restauration impossible';
			pending = false;
		}
	}

	const title = (v: VersionInfo) =>
		v.label || (v.kind === 'auto' ? 'Enregistrement automatique' : 'Version');
</script>

<Modal bind:open title="Historique du dossier" width="760px">
	<form
		class="new"
		onsubmit={(e) => {
			e.preventDefault();
			save();
		}}
	>
		<input
			class="control"
			bind:value={label}
			placeholder="Commentaire : Envoyé au client, Avant modif chaufferie…"
			aria-label="Commentaire de la version"
			disabled={editor.readonly || pending}
		/>
		<Button type="submit" variant="primary" disabled={editor.readonly || pending}
			><BookmarkPlus size={14} /> Enregistrer une version</Button
		>
	</form>
	<p class="muted small">
		Versions automatiques toutes les 15 min de travail et à la fermeture (gardées 48 h, puis une par
		jour pendant 30 jours). Versions nommées et indices de révision : gardées sans limite.
		{#if !allowed}Restauration réservée à l’administrateur et aux intervenants du dossier.{/if}
	</p>
	{#if error}<Alert>{error}</Alert>{/if}
	{#if info}<Alert variant="success">{info}</Alert>{/if}

	<div class="list">
		{#if loading && !versions.length}
			<p class="muted small">Chargement…</p>
		{/if}
		{#each versions as v, i (v.id)}
			<div class="version" class:named={v.kind === 'named'}>
				<div class="icon">
					{#if v.kind === 'named'}<BookmarkPlus size={16} />{:else}<History size={16} />{/if}
				</div>
				<div class="text">
					<div class="title">
						<span>{title(v)}</span>
						{#if i === 0}<span class="badge">la plus récente</span>{/if}
					</div>
					<div class="muted small">
						{when(v.createdAt)} · {v.createdByName ?? '—'} · {v.summary.folios} folio(s), {v.summary
							.devices} appareil(s)
					</div>
				</div>
				<div class="actions">
					<Button
						size="sm"
						variant="ghost"
						href="/projets/{projectId}/versions/{v.id}"
						title="Ouvrir en lecture seule (consultation, export PDF)"
						><Eye size={14} /> Voir</Button
					>
					<Button
						size="sm"
						variant="ghost"
						title="Nouveau dossier à partir de cette version"
						onclick={() => onduplicate(v)}><Copy size={14} /></Button
					>
					{#if allowed && !editor.readonly}
						<Button
							size="sm"
							variant="ghost"
							title="Remettre le dossier dans cet état"
							disabled={pending}
							onclick={() => restore(v)}><RotateCcw size={14} /> Restaurer</Button
						>
					{/if}
				</div>
			</div>
		{:else}
			{#if !loading}<p class="muted small">Aucune version pour l’instant.</p>{/if}
		{/each}
	</div>

	{#snippet actions()}
		<Button onclick={() => onduplicate()}><Copy size={14} /> Dupliquer le dossier…</Button>
		<Button variant="ghost" onclick={() => (open = false)}>Fermer</Button>
	{/snippet}
</Modal>

<style>
	.new {
		display: flex;
		gap: var(--sp-2);
	}
	.new input {
		flex: 1;
		min-width: 0;
		height: var(--control-h);
		padding: 0 var(--sp-2);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		background: var(--c-surface);
	}
	.small {
		margin: 0;
		font-size: var(--fs-sm);
	}
	.list {
		display: flex;
		flex-direction: column;
		max-height: 55vh;
		overflow-y: auto;
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
	}
	.version {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		padding: var(--sp-2) var(--sp-3);
		border-bottom: 1px solid var(--c-border);
	}
	.version:last-child {
		border-bottom: none;
	}
	.version.named {
		background: var(--c-primary-soft);
	}
	.icon {
		display: flex;
		color: var(--c-text-muted);
	}
	.version.named .icon {
		color: var(--c-accent);
	}
	.text {
		flex: 1;
		min-width: 0;
	}
	.title {
		font-weight: var(--fw-bold);
	}
	.version:not(.named) .title {
		font-weight: var(--fw-medium);
	}
	.badge {
		margin-left: var(--sp-2);
		padding: 0 6px;
		border-radius: 999px;
		background: var(--c-surface-2);
		color: var(--c-text-muted);
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		white-space: nowrap;
	}
	.actions {
		display: flex;
		gap: 2px;
		flex-shrink: 0;
	}
</style>
