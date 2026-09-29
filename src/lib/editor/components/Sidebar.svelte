<script lang="ts">
	import type { Editor } from '../editor.svelte';
	import FolioList from './FolioList.svelte';
	import MacroPanel from './MacroPanel.svelte';
	import SymbolPalette from './SymbolPalette.svelte';

	let { editor }: { editor: Editor } = $props();

	const TABS = [
		{ id: 'folios', label: 'Folios' },
		{ id: 'symbols', label: 'Symboles' },
		{ id: 'macros', label: 'Macros' }
	] as const;

	let tab: (typeof TABS)[number]['id'] = $state('symbols');
</script>

<aside class="sidebar">
	<nav>
		{#each TABS as t (t.id)}
			<button class:active={tab === t.id} onclick={() => (tab = t.id)}>{t.label}</button>
		{/each}
	</nav>
	{#if tab === 'folios'}
		<FolioList {editor} />
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
