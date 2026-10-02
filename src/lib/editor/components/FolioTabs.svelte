<script lang="ts">
	/**
	 * Folios en onglets sous le dessin (comme les feuilles d'un classeur) : clic pour y aller,
	 * double-clic pour renommer, glisser pour réordonner, clic droit pour le menu, « + » pour un
	 * nouveau folio (schéma, implantation, façade, borniers).
	 */
	import { folioNumber } from '$lib/model/layout';
	import type { Folio } from '$lib/model/types';
	import { ContextMenu, type MenuEntry } from '$lib/ui';
	import { Cable, DoorClosed, LayoutGrid, Plus } from '@lucide/svelte';
	import { tick } from 'svelte';
	import type { Editor } from '../editor.svelte';
	import {
		addFolioOf,
		duplicateFolioOf,
		moveFolioTo,
		removeFolio,
		renameFolio
	} from '../folioActions';

	let { editor }: { editor: Editor } = $props();

	const folios = $derived(editor.project.folios);
	const current = $derived(editor.folioIndex);
	const ro = $derived(editor.readonly);

	let strip: HTMLDivElement | undefined = $state();
	let renaming: string | null = $state(null);
	let menu: { x: number; y: number; items: MenuEntry[] } | null = $state(null);
	/** Glisser-déposer : onglet tiré, et position d'insertion visée. */
	let dragged: string | null = $state(null);
	let dropAt: number | null = $state(null);

	// L'onglet du folio courant reste visible (PgPréc / PgSuiv, navigation par renvois).
	$effect(() => {
		void editor.folioId;
		tick().then(() =>
			strip?.querySelector('.tab.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
		);
	});

	function addMenuAt(e: MouseEvent) {
		const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
		// Au-dessus du bouton (4 entrées d'environ 30 px).
		menu = {
			x: r.left,
			y: Math.max(4, r.top - 4 * 30 - 12),
			items: [
				{ label: 'Folio de schéma', action: () => addFolioOf(editor, 'schema') },
				{
					label: 'Folio d’implantation (armoire)',
					action: () => addFolioOf(editor, 'implantation')
				},
				{ label: 'Folio de façade (porte)', action: () => addFolioOf(editor, 'facade') },
				{ label: 'Folio borniers (dessin automatique)', action: () => addFolioOf(editor, 'strips') }
			]
		};
	}

	function tabMenu(e: MouseEvent, f: Folio, i: number) {
		e.preventDefault();
		editor.setFolio(f.id);
		menu = {
			x: e.clientX,
			y: e.clientY,
			items: [
				{ label: 'Renommer', action: () => (renaming = f.id), disabled: ro },
				{
					label: 'Dupliquer (repères renumérotés)',
					action: () => duplicateFolioOf(editor, f.id),
					disabled: ro
				},
				{ separator: true },
				{
					label: 'Déplacer à gauche',
					action: () => moveFolioTo(editor, f.id, i - 1),
					disabled: ro || i === 0
				},
				{
					label: 'Déplacer à droite',
					action: () => moveFolioTo(editor, f.id, i + 1),
					disabled: ro || i === folios.length - 1
				},
				{ separator: true },
				{
					label: 'Supprimer le folio',
					action: () => removeFolio(editor, f.id),
					disabled: ro || folios.length <= 1,
					danger: true
				}
			]
		};
	}

	function commitRename(id: string, value: string) {
		renaming = null;
		renameFolio(editor, id, value);
	}

	function focusSelect(node: HTMLInputElement) {
		node.focus();
		node.select();
	}

	function onDrop() {
		if (dragged && dropAt !== null) {
			const from = folios.findIndex((f) => f.id === dragged);
			// Insertion « avant i » : en tirant vers la droite, l'index visé recule d'un cran.
			const to = dropAt > from ? dropAt - 1 : dropAt;
			moveFolioTo(editor, dragged, Math.max(0, Math.min(folios.length - 1, to)));
		}
		dragged = null;
		dropAt = null;
	}
</script>

<div class="foliotabs" role="tablist" aria-label="Folios">
	<div class="strip" bind:this={strip}>
		{#each folios as f, i (f.id)}
			<div
				class="slot"
				class:drop-before={dropAt === i && dragged !== f.id}
				class:drop-after={dropAt === folios.length && i === folios.length - 1}
				role="presentation"
				ondragover={(e) => {
					if (!dragged) return;
					e.preventDefault();
					const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
					dropAt = e.clientX < r.left + r.width / 2 ? i : i + 1;
				}}
				ondrop={(e) => {
					e.preventDefault();
					onDrop();
				}}
			>
				{#if renaming === f.id}
					<div class="tab active editing">
						<span class="num">{folioNumber(i)}</span>
						<input
							value={f.title}
							aria-label="Titre du folio"
							use:focusSelect
							onblur={(e) => commitRename(f.id, e.currentTarget.value)}
							onkeydown={(e) => {
								e.stopPropagation();
								if (e.key === 'Enter') commitRename(f.id, e.currentTarget.value);
								if (e.key === 'Escape') renaming = null;
							}}
						/>
					</div>
				{:else}
					<button
						class="tab"
						class:active={i === current}
						class:dragging={dragged === f.id}
						role="tab"
						aria-selected={i === current}
						title="{folioNumber(i)} — {f.title ||
							'Sans titre'} · double-clic : renommer · clic droit : menu · glisser : déplacer"
						draggable={!ro}
						onclick={() => editor.setFolio(f.id)}
						ondblclick={() => !ro && (renaming = f.id)}
						oncontextmenu={(e) => tabMenu(e, f, i)}
						ondragstart={(e) => {
							dragged = f.id;
							e.dataTransfer?.setData('text/plain', f.id);
							if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
						}}
						ondragend={() => {
							dragged = null;
							dropAt = null;
						}}
					>
						<span class="num">{folioNumber(i)}</span>
						<span class="title">{f.title || 'Sans titre'}</span>
						{#if f.panel?.kind === 'implantation'}
							<LayoutGrid size={12} />
						{:else if f.panel?.kind === 'facade'}
							<DoorClosed size={12} />
						{:else if f.strips}
							<Cable size={12} />
						{/if}
					</button>
				{/if}
			</div>
		{/each}
		<button
			class="add"
			aria-label="Nouveau folio"
			title="Nouveau folio : schéma, implantation, façade, borniers"
			disabled={ro}
			onclick={addMenuAt}><Plus size={14} /></button
		>
	</div>
</div>

{#if menu}
	<ContextMenu x={menu.x} y={menu.y} items={menu.items} onclose={() => (menu = null)} />
{/if}

<style>
	.foliotabs {
		display: flex;
		align-items: stretch;
		height: 30px;
		background: var(--c-surface-2);
		border-top: 1px solid var(--c-border);
	}
	.strip {
		display: flex;
		flex: 1;
		min-width: 0;
		overflow-x: auto;
		scrollbar-width: thin;
	}
	.slot {
		display: flex;
		position: relative;
	}
	.slot.drop-before::before,
	.slot.drop-after::after {
		content: '';
		position: absolute;
		top: 4px;
		bottom: 4px;
		width: 2px;
		background: var(--c-primary);
	}
	.slot.drop-before::before {
		left: -1px;
	}
	.slot.drop-after::after {
		right: -1px;
	}
	.tab {
		display: flex;
		align-items: center;
		gap: var(--sp-1);
		max-width: 220px;
		padding: 0 var(--sp-3);
		border: none;
		border-right: 1px solid var(--c-border);
		border-top: 2px solid transparent;
		background: transparent;
		color: var(--c-text-muted);
		font-size: var(--fs-sm);
		white-space: nowrap;
		cursor: pointer;
	}
	.tab:hover {
		background: var(--c-surface);
		color: var(--c-text);
	}
	.tab.active {
		background: var(--c-surface);
		color: var(--c-text);
		border-top-color: var(--c-primary);
	}
	.tab.dragging {
		opacity: 0.4;
	}
	.tab :global(svg) {
		flex-shrink: 0;
		color: var(--c-text-muted);
	}
	.num {
		font-weight: var(--fw-bold);
		font-variant-numeric: tabular-nums;
	}
	.title {
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.editing input {
		width: 160px;
		height: 22px;
		padding: 0 var(--sp-1);
		border: 1px solid var(--c-primary);
		border-radius: var(--radius-sm);
		background: var(--c-surface);
		font-size: var(--fs-sm);
	}
	.add {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		flex-shrink: 0;
		border: none;
		border-right: 1px solid var(--c-border);
		background: transparent;
		color: var(--c-text-muted);
		cursor: pointer;
	}
	.add:hover:not(:disabled) {
		background: var(--c-surface);
		color: var(--c-primary);
	}
</style>
