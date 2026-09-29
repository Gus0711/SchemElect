<script lang="ts">
	/** Message d'erreur / d'information dans un formulaire ou une page. */
	import type { Snippet } from 'svelte';

	let {
		variant = 'error',
		children
	}: { variant?: 'error' | 'info' | 'success'; children: Snippet } = $props();
</script>

<p class="alert {variant}" role={variant === 'error' ? 'alert' : 'status'}>{@render children()}</p>

<style>
	.alert {
		margin: 0;
		padding: var(--sp-2) var(--sp-3);
		border-radius: var(--radius-sm);
		font-size: var(--fs-sm);
	}
	.error {
		background: var(--c-danger-soft);
		color: var(--c-danger);
	}
	.info {
		background: var(--c-primary-soft);
		color: var(--c-primary);
	}
	.success {
		background: var(--c-surface-2);
		color: var(--c-success);
		border: 1px solid var(--c-border);
	}
</style>
