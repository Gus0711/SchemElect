<script lang="ts">
	import EditorApp from '$lib/editor/components/EditorApp.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>{data.project.data.meta.name} — SchemElect</title>
</svelte:head>

{#key data.project.id}
	<EditorApp projectId={data.project.id} project={data.project.data} />
{/key}
