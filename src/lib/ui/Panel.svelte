<script lang="ts">
	/** Section titrée d'un panneau latéral. */
	import type { Snippet } from 'svelte';

	let { title, actions, children }: { title?: string; actions?: Snippet; children: Snippet } =
		$props();
</script>

<section class="panel">
	{#if title || actions}
		<header>
			{#if title}<h3>{title}</h3>{/if}
			{#if actions}<div class="actions">{@render actions()}</div>{/if}
		</header>
	{/if}
	<div class="content">{@render children()}</div>
</section>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		min-height: 0;
		border-bottom: 1px solid var(--c-border);
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-2);
		padding: var(--sp-2) var(--sp-3);
	}
	h3 {
		font-size: var(--fs-xs);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--c-text-muted);
	}
	.actions {
		display: flex;
		gap: 2px;
	}
	.content {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		padding: 0 var(--sp-3) var(--sp-3);
		min-height: 0;
	}
</style>
