<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

	let {
		variant = 'secondary',
		size = 'md',
		active = false,
		href,
		children,
		...rest
	}: HTMLButtonAttributes & {
		variant?: Variant;
		size?: 'sm' | 'md';
		active?: boolean;
		href?: string;
		children?: Snippet;
	} = $props();
</script>

{#if href}
	<a {href} class="btn {variant} {size}" class:active>{@render children?.()}</a>
{:else}
	<button type="button" {...rest} class="btn {variant} {size} {rest.class ?? ''}" class:active>
		{@render children?.()}
	</button>
{/if}

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--sp-1);
		height: var(--control-h);
		padding: 0 var(--sp-3);
		border: 1px solid transparent;
		border-radius: var(--radius);
		font-size: var(--fs-md);
		font-weight: var(--fw-medium);
		white-space: nowrap;
		cursor: pointer;
		text-decoration: none;
		transition:
			background 0.12s,
			border-color 0.12s,
			color 0.12s;
	}
	.btn:hover {
		text-decoration: none;
	}
	.btn:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.sm {
		height: 26px;
		padding: 0 var(--sp-2);
		font-size: var(--fs-sm);
	}
	.primary {
		background: var(--c-primary);
		color: var(--c-on-primary);
	}
	.primary:hover:not(:disabled) {
		background: var(--c-primary-hover);
	}
	.secondary {
		background: var(--c-surface);
		border-color: var(--c-border);
		color: var(--c-text);
	}
	.secondary:hover:not(:disabled) {
		border-color: var(--c-border-strong);
		background: var(--c-surface-2);
	}
	.ghost {
		background: transparent;
		color: var(--c-text);
	}
	.ghost:hover:not(:disabled) {
		background: var(--c-surface-2);
	}
	.danger {
		background: var(--c-danger);
		color: var(--c-on-primary);
	}
	.active {
		background: var(--c-primary-soft);
		color: var(--c-primary);
		border-color: transparent;
	}
</style>
