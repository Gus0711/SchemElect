<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		open = $bindable(false),
		title,
		width = '480px',
		height,
		dismissible = true,
		children,
		actions
	}: {
		open?: boolean;
		title: string;
		width?: string;
		/** Hauteur fixe (fenêtre de travail) ; le contenu occupe alors toute la hauteur. */
		height?: string;
		/** Faux : ni Échap ni un clic à côté ne ferment la fenêtre (travail en cours). */
		dismissible?: boolean;
		children: Snippet;
		actions?: Snippet;
	} = $props();

	function onkeydown(e: KeyboardEvent) {
		if (open && dismissible && e.key === 'Escape') open = false;
	}
</script>

<svelte:window {onkeydown} />

{#if open}
	<div
		class="backdrop"
		role="presentation"
		onclick={(e) => dismissible && e.target === e.currentTarget && (open = false)}
	>
		<div
			class="modal"
			class:fixed={!!height}
			role="dialog"
			aria-modal="true"
			aria-label={title}
			style:width
			style:height
		>
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
		background: var(--c-backdrop);
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
	.modal.fixed .body {
		flex: 1;
		min-height: 0;
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
