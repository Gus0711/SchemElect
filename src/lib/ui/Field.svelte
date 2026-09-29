<script lang="ts">
	/** Champ de formulaire : libellé + input / select / textarea (via `children`) ou input simple. */
	import type { Snippet } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';

	let {
		label,
		hint,
		value = $bindable(),
		children,
		...rest
	}: HTMLInputAttributes & { label: string; hint?: string; children?: Snippet } = $props();
</script>

<label class="field">
	<span class="label">{label}</span>
	{#if children}
		{@render children()}
	{:else}
		<input class="control" bind:value {...rest} />
	{/if}
	{#if hint}<span class="hint">{hint}</span>{/if}
</label>

<style>
	.field {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
	}
	.label {
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		color: var(--c-text-muted);
	}
	.hint {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}
	/* Style partagé des contrôles (aussi pour les <select>/<textarea> passés en children). */
	.field :global(.control),
	.field :global(select),
	.field :global(textarea) {
		width: 100%;
		height: var(--control-h);
		padding: 0 var(--sp-2);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		background: var(--c-surface);
		font-size: var(--fs-md);
	}
	.field :global(textarea) {
		height: auto;
		min-height: 60px;
		padding: var(--sp-1) var(--sp-2);
		resize: vertical;
	}
	.field :global(.control:focus),
	.field :global(select:focus),
	.field :global(textarea:focus) {
		outline: 2px solid var(--c-primary-soft);
		border-color: var(--c-primary);
	}
</style>
