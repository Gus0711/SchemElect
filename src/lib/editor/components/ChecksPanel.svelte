<script lang="ts">
	/** Contrôles de cohérence du dossier (calculés en continu, voir `model/checks.ts`). */
	import { CircleAlert, Check } from '@lucide/svelte';
	import type { Editor } from '../editor.svelte';

	let { editor }: { editor: Editor } = $props();

	const issues = $derived(editor.issues);
</script>

<div class="checks">
	{#if issues.length}
		<ul>
			{#each issues as issue, i (i)}
				<li>
					<button onclick={() => issue.folioId && editor.setFolio(issue.folioId)}>
						<CircleAlert size={14} />
						<span>{issue.text}</span>
					</button>
				</li>
			{/each}
		</ul>
		<label class="toggle">
			<input type="checkbox" bind:checked={editor.showOpenTerminals} /> Marquer les bornes non raccordées
		</label>
	{:else}
		<p class="ok"><Check size={14} /> Aucun problème détecté.</p>
	{/if}
</div>

<style>
	.checks {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		padding: var(--sp-2) var(--sp-3);
		overflow-y: auto;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	button {
		display: flex;
		gap: var(--sp-2);
		align-items: flex-start;
		width: 100%;
		padding: 4px 0;
		border: none;
		background: transparent;
		color: var(--c-warning);
		font-size: var(--fs-sm);
		text-align: left;
		cursor: pointer;
	}
	button span {
		color: var(--c-text);
	}
	.ok {
		display: flex;
		align-items: center;
		gap: var(--sp-1);
		margin: 0;
		color: var(--c-success);
		font-size: var(--fs-sm);
	}
	.toggle {
		display: flex;
		gap: var(--sp-1);
		align-items: center;
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}
</style>
