<script lang="ts">
	/**
	 * Barre latérale gauche : une colonne d'icônes (Symboles, Macros, Appareils, Contrôles) et
	 * le panneau correspondant. Un clic sur l'icône active replie le panneau (plus de place
	 * pour le dessin). Les folios sont en onglets sous le dessin (`FolioTabs`).
	 */
	import { ListTree, Shapes, ShieldCheck, Sparkles, TriangleAlert, Package } from '@lucide/svelte';
	import type { Editor } from '../editor.svelte';
	import ChecksPanel from './ChecksPanel.svelte';
	import DevicesPanel from './DevicesPanel.svelte';
	import MacroPanel from './MacroPanel.svelte';
	import PanelDevices from './PanelDevices.svelte';
	import SymbolPalette from './SymbolPalette.svelte';

	let { editor }: { editor: Editor } = $props();

	type Tab = 'symbols' | 'macros' | 'devices' | 'checks';

	let tab: Tab = $state('symbols');
	let collapsed = $state(false);

	const issueCount = $derived(editor.issues.length);

	/** Libellé de l'onglet Symboles selon le folio (armoire : appareils à placer). */
	const symbolsLabel = $derived(editor.panel ? 'À placer' : 'Symboles');

	const TABS = $derived([
		{
			id: 'symbols' as const,
			label: symbolsLabel,
			icon: editor.panel ? Package : Shapes,
			hint: editor.panel
				? 'Appareils du schéma à poser sur le folio d’armoire'
				: 'Bibliothèque de symboles (touche /)'
		},
		{ id: 'macros' as const, label: 'Macros', icon: Sparkles, hint: 'Blocs réutilisables' },
		{
			id: 'devices' as const,
			label: 'Appareils',
			icon: ListTree,
			hint: 'Tous les repères, références, nomenclature et liste de commande'
		},
		{
			id: 'checks' as const,
			label: 'Contrôles',
			icon: issueCount ? TriangleAlert : ShieldCheck,
			hint: issueCount ? `${issueCount} problème(s) détecté(s)` : 'Aucun problème détecté'
		}
	]);

	function select(id: Tab) {
		if (tab === id && !collapsed) collapsed = true;
		else {
			tab = id;
			collapsed = false;
		}
	}

	// Touche / : afficher la recherche de symboles (la palette prend le focus).
	$effect(() => {
		if (editor.focusRequest?.field === 'symbolSearch') {
			tab = 'symbols';
			collapsed = false;
		}
	});

	const title = $derived(TABS.find((t) => t.id === tab)?.label ?? '');
</script>

<aside class="sidebar" class:collapsed>
	<nav class="rail" aria-label="Panneaux">
		{#each TABS as t (t.id)}
			<button
				class:active={tab === t.id && !collapsed}
				aria-label={t.label}
				aria-pressed={tab === t.id && !collapsed}
				title="{t.label} — {t.hint}{tab === t.id && !collapsed ? ' (clic : replier)' : ''}"
				onclick={() => select(t.id)}
			>
				<t.icon size={20} />
				<span class="label">{t.label}</span>
				{#if t.id === 'checks' && issueCount}
					<span class="badge" aria-hidden="true">{issueCount}</span>
				{/if}
			</button>
		{/each}
	</nav>
	{#if !collapsed}
		<div class="panel">
			<header>{title}</header>
			{#if tab === 'symbols' && editor.stripsFolio}
				<p class="note">
					Folio borniers automatique : il se dessine seul à partir des bornes du schéma. Réglages
					(borniers affichés, suite) dans le panneau de droite ; double-clic sur une borne pour
					aller à son symbole.
				</p>
			{:else if tab === 'symbols' && editor.panel}
				<!-- Folio d'implantation / de façade : appareils du schéma à poser. -->
				<PanelDevices {editor} />
			{:else if tab === 'symbols'}
				<SymbolPalette {editor} />
			{:else if tab === 'macros'}
				<MacroPanel {editor} />
			{:else if tab === 'devices'}
				<DevicesPanel {editor} />
			{:else}
				<ChecksPanel {editor} />
			{/if}
		</div>
	{/if}
</aside>

<style>
	.sidebar {
		display: flex;
		flex-shrink: 0;
		min-height: 0;
		background: var(--c-surface);
		border-right: 1px solid var(--c-border);
	}
	.rail {
		display: flex;
		flex-direction: column;
		gap: 2px;
		width: 64px;
		padding: var(--sp-1);
		border-right: 1px solid var(--c-border);
		background: var(--c-surface-2);
	}
	.sidebar.collapsed .rail {
		border-right: none;
	}
	.rail button {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding: var(--sp-2) 2px;
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--c-text-muted);
		cursor: pointer;
	}
	.rail button:hover {
		background: var(--c-surface);
		color: var(--c-text);
	}
	.rail button.active {
		background: var(--c-primary-soft);
		color: var(--c-primary);
	}
	.label {
		font-size: 10px;
		font-weight: var(--fw-medium);
		line-height: 1.1;
		text-align: center;
	}
	.badge {
		position: absolute;
		top: 2px;
		right: 6px;
		min-width: 16px;
		height: 16px;
		padding: 0 4px;
		border-radius: 999px;
		background: var(--c-danger);
		color: var(--c-surface);
		font-size: 10px;
		font-weight: var(--fw-bold);
		line-height: 16px;
		text-align: center;
	}
	.panel {
		display: flex;
		flex-direction: column;
		width: var(--sidebar-w);
		min-height: 0;
	}
	header {
		padding: var(--sp-2) var(--sp-3);
		border-bottom: 1px solid var(--c-border);
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--c-text-muted);
	}
	.note {
		margin: var(--sp-3);
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
	}
</style>
