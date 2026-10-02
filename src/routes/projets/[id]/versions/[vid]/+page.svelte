<script lang="ts">
	/** Consultation d'une version de l'historique (lecture seule, export PDF, duplication). */
	import EditorApp from '$lib/editor/components/EditorApp.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>{data.data.meta.name} (version) — SchemElect</title>
</svelte:head>

{#key data.version.id}
	<EditorApp
		projectId={data.projectId}
		project={data.data}
		version={data.version}
		viewer={data.viewer}
	/>
{/key}
