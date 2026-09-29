<script lang="ts">
	/** Page centrée (connexion, premier lancement) : logo + carte. */
	import type { Snippet } from 'svelte';
	import Card from './Card.svelte';

	let { title, subtitle, children }: { title: string; subtitle?: string; children: Snippet } =
		$props();
</script>

<main class="auth">
	<div class="box">
		<div class="brand">SchemElect</div>
		<Card>
			<div class="head">
				<h1>{title}</h1>
				{#if subtitle}<p class="muted">{subtitle}</p>{/if}
			</div>
			<div class="content">{@render children()}</div>
		</Card>
	</div>
</main>

<style>
	.auth {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: var(--sp-5);
	}
	.box {
		width: 100%;
		max-width: 380px;
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
	}
	.brand {
		text-align: center;
		font-size: var(--fs-xl);
		font-weight: var(--fw-bold);
		color: var(--c-primary);
	}
	.head {
		display: flex;
		flex-direction: column;
		gap: var(--sp-1);
	}
	.head p {
		margin: 0;
	}
	.content :global(form) {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		margin: 0;
	}
</style>
