<script lang="ts">
	import { AppHeader } from '$lib/ui';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<div class="app">
	<AppHeader user={data.user} organizations={data.organizations} />
	<main>{@render children()}</main>
</div>

<style>
	.app {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}
	main {
		flex: 1;
		width: 100%;
		max-width: 1200px;
		margin: 0 auto;
		padding: var(--sp-5) var(--sp-4);
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
	}
</style>
