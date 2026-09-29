<script lang="ts">
	/**
	 * Folio d'implantation / de façade : appareils du schéma à poser (clic puis clic sur le
	 * folio), placement automatique, appareils déjà posés (clic : y aller).
	 */
	import {
		compareForDoor,
		compareForRails,
		panelCandidates,
		type Candidate
	} from '$lib/model/panel';
	import type { Mounting } from '$lib/model/types';
	import { Button } from '$lib/ui';
	import { Check, Search, WandSparkles } from '@lucide/svelte';
	import type { Editor } from '../editor.svelte';

	let { editor }: { editor: Editor } = $props();

	let query = $state('');
	let message = $state('');

	const panel = $derived(editor.panel!);
	const wanted: Mounting = $derived(panel.kind === 'implantation' ? 'rail' : 'porte');

	const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

	const all = $derived(
		panelCandidates(editor.project, panel.kind).sort(
			panel.kind === 'implantation' ? compareForRails : compareForDoor
		)
	);
	const visible = $derived.by(() => {
		const q = normalize(query.trim());
		return q ? all.filter((c) => normalize(`${c.tag} ${c.designation}`).includes(q)) : all;
	});
	const todo = $derived(visible.filter((c) => c.mounting === wanted && !c.placed));
	const done = $derived(visible.filter((c) => c.placed));
	const others = $derived(visible.filter((c) => c.mounting !== wanted && !c.placed));
	const remaining = $derived(all.filter((c) => c.mounting === wanted && !c.placed).length);

	const activeKey = $derived(editor.tool.kind === 'mount' ? editor.tool.candidate.key : null);

	function pick(c: Candidate) {
		if (c.placed) editor.goToMount(c.placed.folioId, c.placed.itemId);
		else if (!editor.readonly) editor.setTool({ kind: 'mount', candidate: c });
	}

	function auto() {
		const res = editor.autoPlace();
		if (!res) return;
		message = res.remaining.length
			? `${res.placed} posé(s) — pas de place pour : ${res.remaining.join(', ')}`
			: `${res.placed} posé(s).`;
	}

	const MOUNTING: Record<Mounting, string> = {
		rail: 'rail',
		porte: 'porte',
		externe: 'hors armoire'
	};
	const size = (c: Candidate) =>
		c.strip ? `${c.designation} · ${c.w} mm` : `${Math.round(c.w)} × ${Math.round(c.h)}`;
</script>

{#snippet row(c: Candidate, muted = false)}
	<li>
		<button
			class:active={activeKey === c.key}
			class:muted
			title={c.placed ? 'Déjà posé — clic : y aller' : 'Clic, puis clic sur le folio pour poser'}
			onclick={() => pick(c)}
		>
			<span class="tag">{c.tag}</span>
			<span class="designation">{c.strip ? '' : c.designation}</span>
			<span class="size">{muted ? MOUNTING[c.mounting] : size(c)}</span>
			{#if c.placed}<Check size={12} />{/if}
		</button>
	</li>
{/snippet}

<div class="devices">
	<div class="top">
		<label class="search">
			<Search size={14} />
			<input placeholder="Rechercher (KM3, voyant…)" bind:value={query} />
		</label>
	</div>
	<div class="auto">
		<Button
			size="sm"
			variant="primary"
			disabled={editor.readonly || !remaining}
			title={panel.kind === 'implantation'
				? 'Range les appareils sur les rails par type (protection, commande…), à la suite'
				: 'Une rangée par folio du schéma : voyants puis commutateurs'}
			onclick={auto}><WandSparkles size={14} /> Placer automatiquement ({remaining})</Button
		>
		{#if message}<p class="message">{message}</p>{/if}
	</div>
	<div class="list">
		<h4>À placer ({todo.length})</h4>
		<ul>
			{#each todo as c (c.key)}{@render row(c)}{:else}<li class="empty">Tout est posé.</li>{/each}
		</ul>
		{#if done.length}
			<h4>Posés ({done.length})</h4>
			<ul>
				{#each done as c (c.key)}{@render row(c)}{/each}
			</ul>
		{/if}
		{#if others.length}
			<details>
				<summary>Autres appareils ({others.length})</summary>
				<p class="hint">
					Montage différent ({panel.kind === 'implantation'
						? 'porte, hors armoire'
						: 'rail, hors armoire'}). Ils peuvent être posés quand même ; le montage se change dans
					l'inspecteur.
				</p>
				<ul>
					{#each others as c (c.key)}{@render row(c, true)}{/each}
				</ul>
			</details>
		{/if}
	</div>
</div>

<style>
	.devices {
		display: flex;
		flex-direction: column;
		min-height: 0;
		flex: 1;
	}
	.top {
		margin: var(--sp-2) var(--sp-2) var(--sp-1) var(--sp-3);
	}
	.search {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		padding: 0 var(--sp-2);
		height: var(--control-h);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		color: var(--c-text-muted);
		background: var(--c-surface);
	}
	.search input {
		flex: 1;
		min-width: 0;
		border: none;
		outline: none;
		background: transparent;
		font-size: var(--fs-sm);
	}
	.auto {
		padding: var(--sp-1) var(--sp-3);
	}
	.message {
		margin: var(--sp-1) 0 0;
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}
	.list {
		overflow-y: auto;
		padding: 0 var(--sp-2) var(--sp-3);
	}
	h4,
	summary {
		margin: var(--sp-3) var(--sp-1) var(--sp-1);
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
		color: var(--c-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		cursor: default;
	}
	summary {
		cursor: pointer;
	}
	.hint {
		margin: 0 var(--sp-1) var(--sp-1);
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	li button {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		width: 100%;
		padding: 4px var(--sp-1);
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: transparent;
		font-size: var(--fs-sm);
		text-align: left;
		cursor: pointer;
	}
	li button:hover {
		background: var(--c-surface-2);
	}
	li button.active {
		border-color: var(--c-primary);
		background: var(--c-primary-soft);
	}
	li button.muted {
		color: var(--c-text-muted);
	}
	.tag {
		font-weight: var(--fw-bold);
		white-space: nowrap;
	}
	.designation {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--c-text-muted);
	}
	.size {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}
	.empty {
		padding: 4px var(--sp-1);
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
	}
</style>
