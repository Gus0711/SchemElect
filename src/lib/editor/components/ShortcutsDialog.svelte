<script lang="ts">
	/** Aide des raccourcis clavier et gestes souris (touche ? ou F1). */
	import { Modal } from '$lib/ui';
	import { Search } from '@lucide/svelte';
	import { SHORTCUTS } from '../shortcuts';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	let query = $state('');
	let input: HTMLInputElement | undefined = $state();

	$effect(() => {
		if (!open) return;
		query = '';
		queueMicrotask(() => input?.focus());
	});

	const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

	const groups = $derived.by(() => {
		const q = normalize(query.trim());
		if (!q) return SHORTCUTS;
		return SHORTCUTS.map((g) => ({
			...g,
			items: g.items.filter((s) =>
				normalize([s.label, s.hint ?? '', ...s.keys.flat(), g.title].join(' ')).includes(q)
			)
		})).filter((g) => g.items.length);
	});
</script>

<Modal bind:open title="Raccourcis clavier" width="880px">
	<label class="search">
		<Search size={14} />
		<input
			bind:this={input}
			bind:value={query}
			placeholder="Chercher (fil, zoom, copier, Ctrl…)"
			aria-label="Chercher un raccourci"
		/>
	</label>
	<div class="groups">
		{#each groups as g (g.title)}
			<section>
				<h4>{g.title}</h4>
				<dl>
					{#each g.items as s (s.label)}
						<dt>
							{#each s.keys as combo, i (i)}
								{#if i > 0}<span class="or">ou</span>{/if}
								{#each combo as key, j (j)}
									{#if j > 0}<span class="plus">+</span>{/if}
									<kbd>{key}</kbd>
								{/each}
							{/each}
						</dt>
						<dd>
							{s.label}
							{#if s.hint}<span class="hint">{s.hint}</span>{/if}
						</dd>
					{/each}
				</dl>
			</section>
		{:else}
			<p class="muted">Aucun raccourci ne correspond.</p>
		{/each}
	</div>
</Modal>

<style>
	.search {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		padding: 0 var(--sp-2);
		height: var(--control-h);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		color: var(--c-text-muted);
		background: var(--c-surface);
	}
	.search input {
		flex: 1;
		min-width: 0;
		border: none;
		outline: none;
		background: transparent;
		color: var(--c-text);
		font-size: var(--fs-sm);
	}
	.groups {
		columns: 2;
		column-gap: var(--sp-5, 24px);
		max-height: 64vh;
		overflow-y: auto;
		margin-top: var(--sp-2);
	}
	section {
		break-inside: avoid;
		margin-bottom: var(--sp-3);
	}
	h4 {
		margin: var(--sp-2) 0 var(--sp-1);
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
		color: var(--c-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 6px var(--sp-3);
		margin: 0;
		align-items: baseline;
	}
	dt {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 3px;
		justify-content: flex-end;
		white-space: nowrap;
	}
	dd {
		margin: 0;
		font-size: var(--fs-sm);
	}
	kbd {
		display: inline-block;
		min-width: 20px;
		padding: 1px 6px;
		border: 1px solid var(--c-border-strong);
		border-bottom-width: 2px;
		border-radius: var(--radius-sm);
		background: var(--c-surface-2);
		color: var(--c-text);
		font-family: inherit;
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		text-align: center;
	}
	.plus,
	.or {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}
	.hint {
		display: block;
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}
</style>
