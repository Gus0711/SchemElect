<script lang="ts">
	/** Réglage de la grille d'affichage (barre d'état) : afficher, type, pas, visibilité. */
	import { Grid3x3 } from '@lucide/svelte';
	import { GRID_KINDS, GRID_STEPS } from '../grid';
	import type { Editor } from '../editor.svelte';

	let { editor }: { editor: Editor } = $props();

	let open = $state(false);
	let root: HTMLDivElement | undefined = $state();

	const grid = $derived(editor.grid);
	const label = $derived(
		grid.show ? (GRID_KINDS.find((k) => k.kind === grid.kind)?.label ?? '') : 'masquée'
	);
	const fmtStep = (s: number) => String(s).replace('.', ',');
</script>

<svelte:window
	onpointerdown={(e) => open && !root?.contains(e.target as Node) && (open = false)}
	onkeydown={(e) => open && e.key === 'Escape' && (open = false)}
/>

<div class="grid-control" bind:this={root}>
	<button
		class="trigger"
		class:off={!grid.show}
		title="Grille d’affichage (G : afficher / masquer)"
		aria-expanded={open}
		onclick={() => (open = !open)}><Grid3x3 size={13} /> Grille : {label} ▾</button
	>

	{#if open}
		<div class="panel" role="dialog" aria-label="Grille d’affichage">
			<label class="row switch">
				<input
					type="checkbox"
					checked={grid.show}
					onchange={(e) => editor.setGrid({ show: e.currentTarget.checked })}
				/>
				Afficher la grille <kbd>G</kbd>
			</label>

			<div class="seg" role="group" aria-label="Type de grille">
				{#each GRID_KINDS as k (k.kind)}
					<button
						class:active={grid.show && grid.kind === k.kind}
						onclick={() => editor.setGrid({ kind: k.kind, show: true })}>{k.label}</button
					>
				{/each}
			</div>

			{#if grid.kind !== 'cases'}
				<div class="row">
					<span class="label">Pas</span>
					<div class="seg small" role="group" aria-label="Pas de la grille">
						{#each GRID_STEPS as s (s)}
							<button
								class:active={grid.step === s}
								onclick={() => editor.setGrid({ step: s, show: true })}>{fmtStep(s)} mm</button
							>
						{/each}
					</div>
				</div>
			{:else}
				<p class="note">Suit les colonnes A–Q et les lignes 1–11 du cadre.</p>
			{/if}

			<label class="row">
				<span class="label">Visibilité</span>
				<input
					type="range"
					min="0.1"
					max="1"
					step="0.05"
					value={grid.opacity}
					oninput={(e) => editor.setGrid({ opacity: Number(e.currentTarget.value), show: true })}
				/>
				<span class="value">{Math.round(grid.opacity * 100)} %</span>
			</label>

			<label class="row">
				<input
					type="checkbox"
					checked={grid.print}
					onchange={(e) => editor.setGrid({ print: e.currentTarget.checked })}
				/>
				Imprimer la grille dans le PDF
			</label>
		</div>
	{/if}
</div>

<style>
	.grid-control {
		position: relative;
	}
	.trigger {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 1px 6px;
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		background: var(--c-surface-2);
		color: var(--c-text);
		font-size: var(--fs-xs);
		white-space: nowrap;
		cursor: pointer;
	}
	.trigger.off {
		color: var(--c-text-muted);
	}
	.trigger:hover {
		border-color: var(--c-primary);
	}
	.panel {
		position: absolute;
		right: 0;
		bottom: calc(100% + 6px);
		z-index: 20;
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		width: 290px;
		padding: var(--sp-3);
		border: 1px solid var(--c-border);
		border-radius: var(--radius);
		background: var(--c-surface);
		box-shadow: var(--shadow);
		color: var(--c-text);
		font-size: var(--fs-sm);
	}
	.row {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
	}
	.switch {
		font-weight: var(--fw-medium);
	}
	.label {
		width: 62px;
		color: var(--c-text-muted);
		font-size: var(--fs-xs);
	}
	.row input[type='range'] {
		flex: 1;
	}
	.value {
		width: 38px;
		text-align: right;
		font-variant-numeric: tabular-nums;
		font-size: var(--fs-xs);
	}
	.seg {
		display: flex;
		flex: 1;
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		overflow: hidden;
	}
	.seg button {
		flex: 1;
		padding: 5px 4px;
		border: none;
		border-right: 1px solid var(--c-border);
		background: var(--c-surface);
		color: var(--c-text);
		font-size: var(--fs-xs);
		cursor: pointer;
	}
	.seg button:last-child {
		border-right: none;
	}
	.seg button:hover {
		background: var(--c-surface-2);
	}
	.seg button.active {
		background: var(--c-primary);
		color: var(--c-on-primary);
	}
	kbd {
		margin-left: auto;
		padding: 0 5px;
		border: 1px solid var(--c-border-strong);
		border-radius: 3px;
		font-family: inherit;
		font-size: 10px;
		color: var(--c-text-muted);
	}
	.note {
		margin: 0;
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}
</style>
