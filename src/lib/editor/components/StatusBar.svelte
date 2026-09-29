<script lang="ts">
	import { columnAt, folioNumber, rowAt } from '$lib/model/layout';
	import { Keyboard } from '@lucide/svelte';
	import type { Editor } from '../editor.svelte';
	import GridControl from './GridControl.svelte';

	let { editor }: { editor: Editor } = $props();

	const HINTS: Record<string, string> = {
		select:
			'Clic : sélectionner · Glisser : déplacer / sélection rectangle · Double-clic : repère (renvoi, contact : y aller) · Clic droit : menu · Molette : zoom · Clic droit glissé / Espace : déplacer la vue',
		wire: 'Clic : point de départ puis coudes · Arrivée sur une borne ou un fil : terminé · Espace : inverser le coude · Entrée / double-clic / clic droit : terminer · Échap : annuler',
		place: 'Clic : poser (répétable) · R : pivoter · X : miroir · Échap : terminer',
		paste: 'Clic : coller à cet endroit · Échap : annuler',
		bar: 'Clic : placer la barre de potentiel',
		text: 'Clic : placer un texte',
		rect: 'Glisser : dessiner un cadre (boîte d’équipement)'
	};

	const c = $derived(editor.cursor);
</script>

<footer class="statusbar">
	<span class="pos">
		Folio {folioNumber(editor.folioIndex)}
		{#if c}· {columnAt(c.x)}{rowAt(c.y)} · {c.x.toFixed(1)} ; {c.y.toFixed(1)} mm{/if}
	</span>
	<span class="hint">{HINTS[editor.tool.kind]}</span>
	<button
		class="help"
		title="Voir tous les raccourcis clavier"
		onclick={() => (editor.shortcutsOpen = true)}
		><Keyboard size={13} /> Tous les raccourcis <kbd>?</kbd></button
	>
	<GridControl {editor} />
</footer>

<style>
	.statusbar {
		display: flex;
		align-items: center;
		gap: var(--sp-4);
		height: 26px;
		padding: 0 var(--sp-3);
		background: var(--c-surface);
		border-top: 1px solid var(--c-border);
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}
	.pos {
		min-width: 200px;
		font-variant-numeric: tabular-nums;
	}
	.hint {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.help {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		flex-shrink: 0;
		padding: 1px 6px;
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		background: var(--c-surface-2);
		color: var(--c-text);
		font-size: var(--fs-xs);
		cursor: pointer;
	}
	.help:hover {
		border-color: var(--c-primary);
		color: var(--c-primary);
	}
	.help kbd {
		padding: 0 4px;
		border: 1px solid var(--c-border-strong);
		border-radius: 3px;
		font-family: inherit;
		font-size: 10px;
		line-height: 1.3;
	}
</style>
