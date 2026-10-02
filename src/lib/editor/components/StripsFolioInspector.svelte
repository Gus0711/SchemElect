<script lang="ts">
	/**
	 * Inspecteur d'un folio borniers automatique : titre, borniers affichés (filtre), rang
	 * dans la série et ajout de la suite quand la série manque de folios.
	 */
	import { projectStrips } from '$lib/model/analysis';
	import { addStripsFolio } from '$lib/model/edit';
	import { stripFolioPage, stripsKey } from '$lib/model/stripDrawing';
	import { Button, Field, Panel } from '$lib/ui';
	import { Plus } from '@lucide/svelte';
	import type { Editor } from '../editor.svelte';

	let { editor }: { editor: Editor } = $props();

	const ro = $derived(editor.readonly);
	const folio = $derived(editor.folio);
	const strips = $derived(projectStrips(editor.project, editor.analysis));
	const info = $derived(stripFolioPage(editor.project, folio, strips));
	const selected = $derived(folio.strips?.prefixes ?? []);

	function toggle(prefix: string, on: boolean) {
		const next = on ? [...selected, prefix] : selected.filter((p) => p !== prefix);
		editor.transact('Borniers affichés', (_, f) => {
			if (f.strips) f.strips.prefixes = next;
		});
	}

	/** Ajoute le folio suivant de la série, juste après le dernier folio de la série. */
	function addNext() {
		const key = stripsKey(folio);
		const prefixes = [...selected];
		let id = '';
		editor.transact('Ajouter la suite des borniers', (p) => {
			const last = p.folios.findLastIndex((f) => f.strips && stripsKey(f) === key);
			const f = addStripsFolio(p, last, prefixes);
			f.title = folio.title;
			id = f.id;
		});
		editor.setFolio(id);
	}
</script>

<Panel title="Folio borniers (automatique)">
	<Field label="Titre du folio">
		<input
			class="control"
			value={folio.title}
			disabled={ro}
			onchange={(e) => {
				const v = e.currentTarget.value;
				editor.transact('Renommer le folio', (_, f) => (f.title = v));
			}}
		/>
	</Field>

	<div class="group">
		<span class="label">Borniers affichés</span>
		{#if strips.length}
			<label class="check">
				<input
					type="checkbox"
					checked={!selected.length}
					disabled={ro || !selected.length}
					onchange={() =>
						editor.transact('Borniers affichés', (_, f) => {
							if (f.strips) f.strips.prefixes = [];
						})}
				/>
				Tous
			</label>
			{#each strips as s (s.prefix)}
				<label class="check">
					<input
						type="checkbox"
						checked={selected.includes(s.prefix)}
						disabled={ro}
						onchange={(e) => toggle(s.prefix, e.currentTarget.checked)}
					/>
					Bornier {s.prefix} <span class="muted">({s.rows.length} bornes)</span>
				</label>
			{/each}
		{:else}
			<p class="muted small">Aucune borne (P, C, X…) dans le schéma pour l’instant.</p>
		{/if}
	</div>

	<p class="small">
		Page {info.index + 1} sur {Math.max(info.pages, 1)}
		{#if info.folios > 1}· {info.folios} folios dans cette série{/if}
	</p>
	{#if info.pages > info.folios}
		<p class="warn small">
			Les borniers demandent {info.pages} pages : il manque {info.pages - info.folios} folio(s).
		</p>
		<Button size="sm" variant="primary" disabled={ro} onclick={addNext}
			><Plus size={14} /> Ajouter la suite</Button
		>
	{/if}
	<p class="muted small">
		Le dessin se met à jour tout seul avec le schéma. Double-clic sur une borne : aller à son
		symbole.
	</p>
</Panel>

<style>
	.group {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.label {
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		color: var(--c-text-muted);
	}
	.check {
		display: flex;
		align-items: center;
		gap: var(--sp-1);
		font-size: var(--fs-sm);
	}
	.small {
		font-size: var(--fs-sm);
		margin: 0;
	}
	.warn {
		color: var(--c-danger);
		font-weight: var(--fw-medium);
	}
</style>
