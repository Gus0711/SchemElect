<script lang="ts">
	import type { Editor } from '../editor.svelte';
	import DevicesPanel from './DevicesPanel.svelte';
	import FolioList from './FolioList.svelte';
	import MacroPanel from './MacroPanel.svelte';
	import PanelDevices from './PanelDevices.svelte';
	import SymbolPalette from './SymbolPalette.svelte';

	let { editor }: { editor: Editor } = $props();

	const TABS = [
		{ id: 'folios', label: 'Folios' },
		{ id: 'symbols', label: 'Symboles' },
		{ id: 'macros', label: 'Macros' },
		{ id: 'devices', label: 'Appareils' }
	] as const;

	let tab: (typeof TABS)[number]['id'] = $state('symbols');

	// Touche / : afficher la recherche de symboles (la palette prend le focus).
	$effect(() => {
		if (editor.focusRequest?.field === 'symbolSearch') tab = 'symbols';
	});
</script>

<aside class="sidebar">
	<nav>
		{#each TABS as t (t.id)}
			<button class:active={tab === t.id} onclick={() => (tab = t.id)}
				>{t.id === 'symbols' && editor.panel ? 'À placer' : t.label}</button
			>
		{/each}
	</nav>
	{#if tab === 'folios'}
		<FolioList {editor} />
	{:else if tab === 'devices'}
		<DevicesPanel {editor} />
	{:else if tab === 'symbols' && editor.stripsFolio}
		<p class="note">
			Folio borniers automatique : il se dessine seul à partir des bornes du schéma. Réglages
			(borniers affichés, suite) dans le panneau de droite ; double-clic sur une borne pour aller à
			son symbole.
		</p>
	{:else if tab === 'symbols' && editor.panel}
		<!-- Folio d'implantation / de façade : appareils du schéma à poser. -->
		<PanelDevices {editor} />
	{:else if tab === 'symbols'}
		<SymbolPalette {editor} />
	{:else}
		<MacroPanel {editor} />
	{/if}
</aside>

<style>
	.sidebar {
		width: var(--sidebar-w);
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		min-height: 0;
		background: var(--c-surface);
		border-right: 1px solid var(--c-border);
	}
	.note {
		margin: var(--sp-3);
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
	}
	nav {
		display: flex;
		border-bottom: 1px solid var(--c-border);
	}
	nav button {
		flex: 1;
		padding: var(--sp-2);
		border: none;
		border-bottom: 2px solid transparent;
		background: transparent;
		color: var(--c-text-muted);
		font-weight: var(--fw-medium);
		cursor: pointer;
	}
	nav button.active {
		color: var(--c-primary);
		border-bottom-color: var(--c-primary);
	}
</style>
