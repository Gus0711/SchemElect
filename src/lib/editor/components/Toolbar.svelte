<script lang="ts">
	import { Button } from '$lib/ui';
	import {
		ArrowLeft,
		Cable,
		Check,
		FileDown,
		LoaderCircle,
		Lock,
		Maximize,
		Minus,
		MousePointer2,
		Redo2,
		Settings,
		Spline,
		Square,
		TriangleAlert,
		Type,
		Undo2,
		ZoomIn,
		ZoomOut
	} from '@lucide/svelte';
	import type { Editor } from '../editor.svelte';
	import type { EditSession } from '../session.svelte';

	let {
		editor,
		session,
		onproject,
		onstrips,
		onexport
	}: {
		editor: Editor;
		session: EditSession;
		onproject: () => void;
		onstrips: () => void;
		onexport: () => void;
	} = $props();

	const tool = $derived(editor.tool.kind);
	const vp = $derived(editor.viewport);
	let barPotential = $state('L1');

	const statusText = $derived(
		{
			connecting: 'Connexion…',
			saved: 'Enregistré',
			pending: 'Modifications…',
			saving: 'Enregistrement…',
			error: session.error || 'Erreur',
			readonly: `Lecture seule — ouvert par ${session.lock?.userName ?? 'un autre utilisateur'}`
		}[session.status]
	);
</script>

<header class="toolbar">
	<Button variant="ghost" href="/" title="Retour aux projets"><ArrowLeft size={16} /></Button>
	<div class="name">
		<strong>{editor.project.meta.name}</strong>
		<span class="muted">{editor.project.meta.planNumber}</span>
	</div>

	<span class="status {session.status}" title={statusText}>
		{#if session.status === 'saving' || session.status === 'pending' || session.status === 'connecting'}<LoaderCircle
				size={14}
				class="spin"
			/>
		{:else if session.status === 'error'}<TriangleAlert size={14} />
		{:else if session.status === 'readonly'}<Lock size={14} />
		{:else}<Check size={14} />{/if}
		<span class="label">{statusText}</span>
	</span>

	<div class="sep"></div>

	<div class="group">
		<Button
			variant="ghost"
			size="sm"
			title="Annuler (Ctrl+Z)"
			onclick={() => editor.undo()}
			disabled={!editor.canUndo || editor.readonly}><Undo2 size={16} /></Button
		>
		<Button
			variant="ghost"
			size="sm"
			title="Rétablir (Ctrl+Y)"
			onclick={() => editor.redo()}
			disabled={!editor.canRedo || editor.readonly}><Redo2 size={16} /></Button
		>
	</div>

	<div class="sep"></div>

	<div class="group" role="toolbar" aria-label="Outils">
		<Button
			variant="ghost"
			size="sm"
			active={tool === 'select'}
			title="Sélection (S)"
			onclick={() => editor.setTool({ kind: 'select' })}><MousePointer2 size={16} /></Button
		>
		<Button
			variant="ghost"
			size="sm"
			active={tool === 'wire'}
			title="Fil (W) — Espace : inverser le coude, Entrée : terminer"
			onclick={() => editor.setTool({ kind: 'wire' })}
			disabled={editor.readonly}><Spline size={16} /> Fil</Button
		>
		<Button
			variant="ghost"
			size="sm"
			active={tool === 'text'}
			title="Texte (T)"
			onclick={() => editor.setTool({ kind: 'text' })}
			disabled={editor.readonly}><Type size={16} /></Button
		>
		<Button
			variant="ghost"
			size="sm"
			active={tool === 'rect'}
			title="Cadre (C)"
			onclick={() => editor.setTool({ kind: 'rect' })}
			disabled={editor.readonly}><Square size={16} /></Button
		>
		<div class="bar-tool">
			<Button
				variant="ghost"
				size="sm"
				active={tool === 'bar'}
				title="Barre de potentiel"
				onclick={() => editor.setTool({ kind: 'bar', potentialId: barPotential })}
				disabled={editor.readonly}><Minus size={16} /> Barre</Button
			>
			<select
				bind:value={barPotential}
				title="Potentiel de la barre"
				disabled={editor.readonly}
				onchange={() => editor.setTool({ kind: 'bar', potentialId: barPotential })}
			>
				{#each editor.project.potentials as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
			</select>
		</div>
	</div>

	<div class="spacer"></div>

	<div class="group">
		<Button variant="ghost" size="sm" title="Zoom arrière" onclick={() => vp.zoomBy(1 / 1.25)}
			><ZoomOut size={16} /></Button
		>
		<button class="zoom" title="Taille réelle" onclick={() => vp.actualSize()}
			>{vp.zoomPercent}%</button
		>
		<Button variant="ghost" size="sm" title="Zoom avant" onclick={() => vp.zoomBy(1.25)}
			><ZoomIn size={16} /></Button
		>
		<Button variant="ghost" size="sm" title="Page entière (F)" onclick={() => vp.fit()}
			><Maximize size={16} /></Button
		>
	</div>

	<div class="sep"></div>

	<Button variant="ghost" size="sm" title="Borniers" onclick={onstrips}
		><Cable size={16} /> Borniers</Button
	>
	<Button variant="ghost" size="sm" title="Propriétés du dossier" onclick={onproject}
		><Settings size={16} /></Button
	>
	<Button variant="primary" size="sm" onclick={onexport}><FileDown size={16} /> Exporter</Button>
</header>

<style>
	.toolbar {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		height: var(--topbar-h);
		padding: 0 var(--sp-2);
		background: var(--c-surface);
		border-bottom: 1px solid var(--c-border);
	}
	.name {
		display: flex;
		flex-direction: column;
		line-height: 1.2;
		min-width: 0;
		max-width: 260px;
	}
	.name strong,
	.name span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.name span {
		font-size: var(--fs-xs);
	}
	.status {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-1);
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		max-width: 280px;
	}
	.status .label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.status.saved {
		color: var(--c-success);
	}
	.status.error {
		color: var(--c-danger);
	}
	.status.readonly {
		color: var(--c-warning);
	}
	.status :global(.spin) {
		animation: spin 1s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	.group {
		display: flex;
		align-items: center;
		gap: 2px;
	}
	.sep {
		width: 1px;
		height: 24px;
		background: var(--c-border);
	}
	.spacer {
		flex: 1;
	}
	.bar-tool {
		display: flex;
		align-items: center;
		gap: 2px;
	}
	.bar-tool select {
		height: 26px;
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		background: var(--c-surface);
		font-size: var(--fs-sm);
	}
	.zoom {
		min-width: 48px;
		border: none;
		background: transparent;
		font-size: var(--fs-sm);
		font-variant-numeric: tabular-nums;
		cursor: pointer;
	}
</style>
