<script lang="ts">
	/** Application d'édition complète : barre d'outils, panneaux, canvas, dialogues. */
	import ExportDialog from '$lib/export/ExportDialog.svelte';
	import type { Project } from '$lib/model/types';
	import type { VersionInfo } from '$lib/model/versions';
	import { Button } from '$lib/ui';
	import { ArrowLeft, Copy, FileDown, History } from '@lucide/svelte';
	import { onDestroy, onMount } from 'svelte';
	import { Editor } from '../editor.svelte';
	import { Interaction } from '../interaction.svelte';
	import { EditSession } from '../session.svelte';
	import Canvas from './Canvas.svelte';
	import CustomSymbolDialog from './CustomSymbolDialog.svelte';
	import DuplicateDialog from './DuplicateDialog.svelte';
	import FolioTabs from './FolioTabs.svelte';
	import NomenclatureDialog from './NomenclatureDialog.svelte';
	import HistoryDialog from './HistoryDialog.svelte';
	import Inspector from './Inspector.svelte';
	import ProjectDialog from './ProjectDialog.svelte';
	import SearchDialog from './SearchDialog.svelte';
	import ShortcutsDialog from './ShortcutsDialog.svelte';
	import Sidebar from './Sidebar.svelte';
	import StatusBar from './StatusBar.svelte';
	import StripsDialog from './StripsDialog.svelte';
	import Toolbar from './Toolbar.svelte';

	let {
		projectId,
		project,
		version
	}: {
		projectId: string;
		project: Project;
		/** Consultation d'une version de l'historique (lecture seule, sans verrou). */
		version?: VersionInfo;
	} = $props();

	// L'éditeur est créé une fois pour la page (le projet initial vient du serveur).
	// svelte-ignore state_referenced_locally
	const editor = new Editor(project, true);
	const interaction = new Interaction(editor);
	// svelte-ignore state_referenced_locally
	const session = new EditSession(projectId, editor);

	let projectOpen = $state(false);
	let stripsOpen = $state(false);
	let exportOpen = $state(false);
	let historyOpen = $state(false);
	let duplicateOpen = $state(false);
	/** Version à dupliquer (absente : état actuel du dossier). */
	let duplicateSource: VersionInfo | undefined = $state();

	const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'short' });

	function openDuplicate(v?: VersionInfo) {
		duplicateSource = v ?? version;
		historyOpen = false;
		duplicateOpen = true;
	}

	$effect(() => session.schedule(editor.revision));

	onMount(() => {
		if (version) session.archive();
		else session.start();
		editor.loadCustomLibrary();
		editor.loadCatalog();
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
		// Ctrl+F : recherche dans le dossier (à la place de celle du navigateur).
		if (mod && e.key.toLowerCase() === 'f' && !projectOpen && !stripsOpen && !exportOpen) {
			e.preventDefault();
			editor.searchOpen = true;
			return;
		}
		if (
			editor.searchOpen ||
			isTyping(e) ||
			projectOpen ||
			stripsOpen ||
			exportOpen ||
			historyOpen ||
			duplicateOpen ||
			editor.nomenclatureOpen ||
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
	{#if version}
		<div class="archive">
			<History size={16} />
			<span
				><strong>Version du {dateFmt.format(new Date(version.createdAt))}</strong>
				{version.label ? `— ${version.label}` : ''} · lecture seule</span
			>
			<Button size="sm" href="/projets/{projectId}"
				><ArrowLeft size={14} /> Retour au dossier</Button
			>
			<Button size="sm" onclick={() => (exportOpen = true)}
				><FileDown size={14} /> PDF de cette version</Button
			>
			<Button size="sm" onclick={() => openDuplicate(version)}
				><Copy size={14} /> Nouveau dossier à partir de cette version</Button
			>
		</div>
	{/if}
	<Toolbar
		{editor}
		{session}
		onproject={() => (projectOpen = true)}
		onstrips={() => (stripsOpen = true)}
		onexport={() => (exportOpen = true)}
		onhistory={version ? undefined : () => (historyOpen = true)}
		onnomenclature={() => (editor.nomenclatureOpen = true)}
		onduplicate={version ? undefined : () => openDuplicate()}
	/>
	<div class="main">
		<Sidebar {editor} />
		<Canvas {editor} {interaction} />
		<Inspector {editor} />
	</div>
	<FolioTabs {editor} />
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
<NomenclatureDialog bind:open={editor.nomenclatureOpen} {editor} />
{#if !version}
	<HistoryDialog
		bind:open={historyOpen}
		{projectId}
		{editor}
		{session}
		onduplicate={openDuplicate}
	/>
{/if}
<DuplicateDialog
	bind:open={duplicateOpen}
	{projectId}
	meta={editor.project.meta}
	versionId={duplicateSource?.id}
	versionLabel={duplicateSource
		? `version du ${dateFmt.format(new Date(duplicateSource.createdAt))}`
		: undefined}
/>
<ShortcutsDialog bind:open={editor.shortcutsOpen} />
<SearchDialog {editor} />
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
	.archive {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		padding: var(--sp-2) var(--sp-3);
		background: var(--c-primary-soft);
		border-bottom: 1px solid var(--c-border);
		font-size: var(--fs-sm);
	}
	.archive span {
		flex: 1;
	}
	.main {
		display: flex;
		flex: 1;
		min-height: 0;
	}
</style>
