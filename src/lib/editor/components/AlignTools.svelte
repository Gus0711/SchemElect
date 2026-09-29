<script lang="ts">
	/** Alignement / répartition de la sélection (référence = premier élément sélectionné). */
	import type { AlignMode } from '$lib/model/edit';
	import { Button } from '$lib/ui';
	import {
		AlignCenterVertical,
		AlignEndHorizontal,
		AlignEndVertical,
		AlignHorizontalDistributeCenter,
		AlignStartHorizontal,
		AlignStartVertical,
		AlignCenterHorizontal,
		AlignVerticalDistributeCenter
	} from '@lucide/svelte';
	import type { Editor } from '../editor.svelte';

	let { editor }: { editor: Editor } = $props();

	const ro = $derived(editor.readonly);
	const n = $derived(editor.selection.filter((r) => r.kind !== 'wire' && r.kind !== 'bar').length);

	const ALIGN: { mode: AlignMode; title: string; icon: typeof AlignStartVertical }[] = [
		{ mode: 'left', title: 'Aligner à gauche', icon: AlignStartVertical },
		{
			mode: 'axis',
			title: 'Aligner sur l’axe (même conducteur vertical)',
			icon: AlignCenterVertical
		},
		{ mode: 'right', title: 'Aligner à droite', icon: AlignEndVertical },
		{ mode: 'top', title: 'Aligner en haut', icon: AlignStartHorizontal },
		{ mode: 'middle', title: 'Centrer verticalement', icon: AlignCenterHorizontal },
		{ mode: 'bottom', title: 'Aligner en bas', icon: AlignEndHorizontal }
	];
</script>

<div class="tools">
	{#each ALIGN as a (a.mode)}
		<Button
			size="sm"
			variant="ghost"
			title={a.title}
			disabled={ro || n < 2}
			onclick={() => editor.align(a.mode)}
		>
			<a.icon size={16} />
		</Button>
	{/each}
	<span class="sep"></span>
	<Button
		size="sm"
		variant="ghost"
		title="Répartir horizontalement"
		disabled={ro || n < 3}
		onclick={() => editor.distribute('horizontal')}
		><AlignHorizontalDistributeCenter size={16} /></Button
	>
	<Button
		size="sm"
		variant="ghost"
		title="Répartir verticalement"
		disabled={ro || n < 3}
		onclick={() => editor.distribute('vertical')}
		><AlignVerticalDistributeCenter size={16} /></Button
	>
</div>
<p class="hint">Référence : le premier élément sélectionné.</p>

<style>
	.tools {
		display: flex;
		flex-wrap: wrap;
		gap: 2px;
		align-items: center;
	}
	.sep {
		width: 1px;
		height: 20px;
		margin: 0 var(--sp-1);
		background: var(--c-border);
	}
	.hint {
		margin: 0;
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}
</style>
