<script lang="ts">
	import '@fontsource-variable/manrope';
	import favicon from '$lib/assets/favicon.svg';
	import '$lib/styles/global.css';
	import { theme } from '$lib/ui/theme.svelte';
	import { onMount } from 'svelte';

	let { children } = $props();

	onMount(() => theme.init());
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>SchemElect</title>
</svelte:head>

{@render children()}
