<script lang="ts">
	/** Application d'édition complète : barre d'outils, panneaux, canvas, dialogues. */
	import ExportDialog from '$lib/export/ExportDialog.svelte';
	import type { Project } from '$lib/model/types';
	import { onDestroy, onMount } from 'svelte';
	import { Editor } from '../editor.svelte';
	import { Interaction } from '../interaction.svelte';
	import { EditSession } from '../session.svelte';
	import Canvas from './Canvas.svelte';
	import CustomSymbolDialog from './CustomSymbolDialog.svelte';
	import Inspector from './Inspector.svelte';
	import ProjectDialog from './ProjectDialog.svelte';
	import ShortcutsDialog from './ShortcutsDialog.svelte';
	import Sidebar from './Sidebar.svelte';
	import StatusBar from './StatusBar.svelte';
	import StripsDialog from './StripsDialog.svelte';
	import Toolbar from './Toolbar.svelte';

	let { projectId, project }: { projectId: string; project: Project } = $props();

	// L'éditeur est créé une fois pour la page (le projet initial vient du serveur).
	// svelte-ignore state_referenced_locally
	const editor = new Editor(project, true);
	const interaction = new Interaction(editor);
	// svelte-ignore state_referenced_locally
	const session = new EditSession(projectId, editor);

	let projectOpen = $state(false);
	let stripsOpen = $state(false);
	let exportOpen = $state(false);

	$effect(() => session.schedule(editor.revision));

	onMount(() => {
		session.start();
		editor.loadCustomLibrary();
		// Accès pour les tests de bout en bout (mode développement uniquement).
		if (import.meta.env.DEV)
			(window as unknown as Record<string, unknown>).__schemelect = { editor, session };
	});
	onDestroy(() => session.stop());

	const isTyping = (e: KeyboardEvent) => {
		const t = e.target as HTMLElement | null;
		return !!t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
	};

	function onkeydown(e: KeyboardEvent) {
		const mod = e.ctrlKey || e.metaKey;
		if (mod && e.key.toLowerCase() === 's') {
			e.preventDefault();
			session.flush();
			return;
		}
		if (
			isTyping(e) ||
			projectOpen ||
			stripsOpen ||
			exportOpen ||
			editor.shortcutsOpen ||
			interaction.menu ||
			editor.symbolEditor
		)
			return;
		if (e.key === '?' || e.key === 'F1') {
			e.preventDefault();
			editor.shortcutsOpen = true;
			return;
		}
		if (mod && e.key.toLowerCase() === 'e') {
			e.preventDefault();
			exportOpen = true;
			return;
		}
		if (interaction.keyDown(e)) e.preventDefault();
	}

	function onbeforeunload(e: BeforeUnloadEvent) {
		if (session.dirty && !editor.readonly) {
			session.flush();
			e.preventDefault();
		}
	}
</script>

<svelte:window
	{onkeydown}
	onkeyup={(e) => interaction.keyUp(e)}
	{onbeforeunload}
	onpagehide={() => session.stop()}
/>

<div class="editor">
	<Toolbar
		{editor}
		{session}
		onproject={() => (projectOpen = true)}
		onstrips={() => (stripsOpen = true)}
		onexport={() => (exportOpen = true)}
	/>
	<div class="main">
		<Sidebar {editor} />
		<Canvas {editor} {interaction} />
		<Inspector {editor} />
	</div>
	<StatusBar {editor} />
</div>

<ProjectDialog {editor} bind:open={projectOpen} />
<CustomSymbolDialog
	{editor}
	bind:open={() => !!editor.symbolEditor, (v) => !v && (editor.symbolEditor = null)}
	initial={editor.symbolEditor?.spec ?? null}
	onsaved={(defId, created) => {
		// Nouveau symbole : prêt à être posé.
		if (created && !editor.readonly)
			editor.setTool({ kind: 'place', defId, rotation: 0, mirror: false });
	}}
/>
<StripsDialog {editor} bind:open={stripsOpen} />
<ShortcutsDialog bind:open={editor.shortcutsOpen} />
<ExportDialog
	bind:open={exportOpen}
	project={editor.project}
	analysis={editor.analysis}
	grid={editor.grid}
	bind:printGrid={() => editor.grid.print, (v) => editor.setGrid({ print: v })}
/>

<style>
	.editor {
		display: flex;
		flex-direction: column;
		height: 100vh;
		overflow: hidden;
	}
	.main {
		display: flex;
		flex: 1;
		min-height: 0;
	}
</style>
