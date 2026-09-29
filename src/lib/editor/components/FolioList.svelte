<script lang="ts">
	import { addFolio, addPanelFolio, addStripsFolio, deleteFolio, moveFolio } from '$lib/model/edit';
	import { duplicateFolio } from '$lib/model/fragments';
	import { folioNumber } from '$lib/model/layout';
	import type { PanelKind } from '$lib/model/types';
	import { Button, ContextMenu } from '$lib/ui';
	import {
		ChevronDown,
		ChevronUp,
		Copy,
		DoorClosed,
		Cable,
		LayoutGrid,
		Plus,
		Trash
	} from '@lucide/svelte';
	import type { Editor } from '../editor.svelte';

	let { editor }: { editor: Editor } = $props();

	const folios = $derived(editor.project.folios);
	const current = $derived(editor.folioIndex);

	function add(kind: PanelKind | null = null) {
		let id = '';
		editor.transact(
			kind === 'implantation'
				? 'Ajouter un folio d’implantation'
				: kind === 'facade'
					? 'Ajouter un folio de façade'
					: 'Ajouter un folio',
			(p) => (id = (kind ? addPanelFolio(p, current, kind) : addFolio(p, current)).id)
		);
		editor.setFolio(id);
	}

	function addStrips() {
		let id = '';
		editor.transact('Ajouter un folio borniers', (p) => (id = addStripsFolio(p, current).id));
		editor.setFolio(id);
	}

	/** Menu « nouveau folio » : schéma, implantation, façade, borniers. */
	let addMenu: { x: number; y: number } | null = $state(null);

	function duplicate() {
		let id = '';
		editor.transact(
			'Dupliquer le folio',
			(p) => (id = duplicateFolio(p, editor.folio.id)?.id ?? '')
		);
		if (id) editor.setFolio(id);
	}

	function remove() {
		if (folios.length <= 1) return;
		const f = editor.folio;
		const count = f.symbols.length + f.wires.length;
		if (count && !confirm(`Supprimer le folio « ${f.title} » et ses ${count} éléments ?`)) return;
		const next = folios[current + 1] ?? folios[current - 1];
		editor.transact('Supprimer le folio', (p) => deleteFolio(p, f.id));
		editor.setFolio(next.id);
	}

	/** Folio en cours de renommage (double-clic sur son titre). */
	let renaming: string | null = $state(null);

	function rename(id: string, title: string) {
		renaming = null;
		const clean = title.trim();
		const folio = folios.find((f) => f.id === id);
		if (!folio || !clean || clean === folio.title) return;
		editor.transact('Renommer le folio', (p) => {
			const f = p.folios.find((x) => x.id === id);
			if (f) f.title = clean;
		});
	}

	function focusSelect(node: HTMLInputElement) {
		node.focus();
		node.select();
	}

	function move(delta: number) {
		editor.transact('Déplacer le folio', (p) => moveFolio(p, current, current + delta));
	}
</script>

<div class="folios">
	<div class="actions">
		<Button
			size="sm"
			variant="ghost"
			title="Nouveau folio (schéma, implantation, façade)"
			onclick={(e: MouseEvent) => {
				const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
				addMenu = { x: r.left, y: r.bottom + 2 };
			}}
			disabled={editor.readonly}><Plus size={14} /> Folio</Button
		>
		<span class="spacer"></span>
		<Button
			size="sm"
			variant="ghost"
			title="Dupliquer (repères renumérotés)"
			onclick={duplicate}
			disabled={editor.readonly}><Copy size={14} /></Button
		>
		<Button
			size="sm"
			variant="ghost"
			title="Monter"
			onclick={() => move(-1)}
			disabled={editor.readonly || current === 0}><ChevronUp size={14} /></Button
		>
		<Button
			size="sm"
			variant="ghost"
			title="Descendre"
			onclick={() => move(1)}
			disabled={editor.readonly || current === folios.length - 1}><ChevronDown size={14} /></Button
		>
		<Button
			size="sm"
			variant="ghost"
			title="Supprimer le folio"
			onclick={remove}
			disabled={editor.readonly || folios.length <= 1}><Trash size={14} /></Button
		>
	</div>
	<ol>
		{#each folios as f, i (f.id)}
			<li>
				{#if renaming === f.id}
					<div class="rename">
						<span class="num">{folioNumber(i)}</span>
						<input
							value={f.title}
							use:focusSelect
							onblur={(e) => rename(f.id, e.currentTarget.value)}
							onkeydown={(e) => {
								if (e.key === 'Enter') rename(f.id, e.currentTarget.value);
								if (e.key === 'Escape') renaming = null;
							}}
						/>
					</div>
				{:else}
					<button
						class:active={i === current}
						title="Double-clic : renommer"
						onclick={() => editor.setFolio(f.id)}
						ondblclick={() => !editor.readonly && (renaming = f.id)}
					>
						<span class="num">{folioNumber(i)}</span>
						<span class="title">{f.title || 'Sans titre'}</span>
						{#if f.panel?.kind === 'implantation'}
							<span class="kind" title="Folio d’implantation"><LayoutGrid size={12} /></span>
						{:else if f.panel?.kind === 'facade'}
							<span class="kind" title="Folio de façade"><DoorClosed size={12} /></span>
						{:else if f.strips}
							<span class="kind" title="Folio borniers (automatique)"><Cable size={12} /></span>
						{/if}
					</button>
				{/if}
			</li>
		{/each}
	</ol>
</div>

{#if addMenu}
	<ContextMenu
		x={addMenu.x}
		y={addMenu.y}
		onclose={() => (addMenu = null)}
		items={[
			{ label: 'Folio de schéma', action: () => add() },
			{ label: 'Folio d’implantation (armoire)', action: () => add('implantation') },
			{ label: 'Folio de façade (porte)', action: () => add('facade') },
			{ label: 'Folio borniers (dessin automatique)', action: () => addStrips() }
		]}
	/>
{/if}

<style>
	.folios {
		display: flex;
		flex-direction: column;
		min-height: 0;
		flex: 1;
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 2px;
		padding: var(--sp-2) var(--sp-2) var(--sp-1);
	}
	.spacer {
		flex: 1;
	}
	ol {
		list-style: none;
		margin: 0;
		padding: 0 var(--sp-2) var(--sp-2);
		overflow-y: auto;
	}
	li button {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		width: 100%;
		padding: 6px var(--sp-2);
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		text-align: left;
		cursor: pointer;
	}
	li button:hover {
		background: var(--c-surface-2);
	}
	li button.active {
		background: var(--c-primary-soft);
		color: var(--c-primary);
	}
	.rename {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		padding: 3px var(--sp-2);
	}
	.rename input {
		flex: 1;
		min-width: 0;
		height: 26px;
		padding: 0 var(--sp-1);
		border: 1px solid var(--c-primary);
		border-radius: var(--radius-sm);
		font-size: var(--fs-sm);
	}
	.num {
		font-variant-numeric: tabular-nums;
		font-weight: var(--fw-bold);
		font-size: var(--fs-sm);
	}
	.kind {
		display: inline-flex;
		margin-left: auto;
		color: var(--c-text-muted);
	}
	.title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--fs-sm);
	}
</style>
