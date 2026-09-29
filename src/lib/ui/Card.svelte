<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, children, actions }: { title?: string; children: Snippet; actions?: Snippet } =
		$props();
</script>

<div class="card">
	{#if title || actions}
		<header>
			{#if title}<h2>{title}</h2>{/if}
			{#if actions}<div class="actions">{@render actions()}</div>{/if}
		</header>
	{/if}
	{@render children()}
</div>

<style>
	.card {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		padding: var(--sp-4);
		background: var(--c-surface);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-sm);
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-2);
	}
	.actions {
		display: flex;
		gap: var(--sp-2);
	}
</style>
