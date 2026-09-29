<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		open = $bindable(false),
		title,
		width = '480px',
		children,
		actions
	}: {
		open?: boolean;
		title: string;
		width?: string;
		children: Snippet;
		actions?: Snippet;
	} = $props();

	function onkeydown(e: KeyboardEvent) {
		if (open && e.key === 'Escape') open = false;
	}
</script>

<svelte:window {onkeydown} />

{#if open}
	<div
		class="backdrop"
		role="presentation"
		onclick={(e) => e.target === e.currentTarget && (open = false)}
	>
		<div class="modal" role="dialog" aria-modal="true" aria-label={title} style:width>
			<header><h2>{title}</h2></header>
			<div class="body">{@render children()}</div>
			{#if actions}<footer>{@render actions()}</footer>{/if}
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 100;
		display: grid;
		place-items: center;
		background: rgba(16, 24, 40, 0.35);
	}
	.modal {
		max-width: calc(100vw - 32px);
		max-height: calc(100vh - 64px);
		display: flex;
		flex-direction: column;
		background: var(--c-surface);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow);
	}
	header {
		padding: var(--sp-4) var(--sp-4) var(--sp-2);
	}
	.body {
		padding: var(--sp-2) var(--sp-4);
		overflow: auto;
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
	}
	footer {
		display: flex;
		justify-content: flex-end;
		gap: var(--sp-2);
		padding: var(--sp-3) var(--sp-4) var(--sp-4);
	}
</style>
