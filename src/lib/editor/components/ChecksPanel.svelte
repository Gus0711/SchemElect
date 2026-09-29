<script lang="ts">
	/** Contrôles de cohérence du dossier (calculés en continu). */
	import { contactOverflows } from '$lib/model/crossrefs';
	import { folioNumber } from '$lib/model/layout';
	import { getSymbolDef } from '$lib/symbols';
	import { Panel } from '$lib/ui';
	import { CircleAlert, Check } from '@lucide/svelte';
	import type { Editor } from '../editor.svelte';

	let { editor }: { editor: Editor } = $props();

	const issues = $derived.by(() => {
		const out: { text: string; folioId?: string }[] = [];
		const a = editor.analysis;
		editor.project.folios.forEach((f, i) => {
			const open = a.nets.openTerminals.get(f.id) ?? [];
			if (open.length)
				out.push({
					text: `Folio ${folioNumber(i)} : ${open.length} borne(s) non raccordée(s)`,
					folioId: f.id
				});
		});
		for (const n of a.nets.nets)
			if (n.shortedPotentials.length) {
				const names = [n.potentialId, ...n.shortedPotentials]
					.map((id) => editor.project.potentials.find((p) => p.id === id)?.name ?? id)
					.join(' / ');
				out.push({ text: `Court-circuit : ${names}`, folioId: n.wires[0]?.folioId });
			}
		for (const o of contactOverflows(editor.project, a.crossRefs)) {
			const folio = editor.project.folios.find((f) =>
				f.symbols.some((s) => s.deviceId === o.deviceId)
			);
			out.push({
				text: `${o.tag} : ${o.no} NO / ${o.nc} NC dessinés pour ${o.avail.no} NO / ${o.avail.nc} NC disponibles`,
				folioId: folio?.id
			});
		}
		const links = new Map<string, number>();
		for (const f of editor.project.folios)
			for (const s of f.symbols)
				if (getSymbolDef(s.defId).role === 'link')
					links.set(s.deviceId, (links.get(s.deviceId) ?? 0) + 1);
		for (const [id, n] of links)
			if (n < 2)
				out.push({ text: `Renvoi ${editor.project.devices[id]?.tag ?? ''} sans correspondance` });
		return out;
	});
</script>

<Panel title="Contrôles">
	{#if issues.length}
		<ul>
			{#each issues as issue, i (i)}
				<li>
					<button onclick={() => issue.folioId && editor.setFolio(issue.folioId)}>
						<CircleAlert size={14} />
						<span>{issue.text}</span>
					</button>
				</li>
			{/each}
		</ul>
		<label class="toggle">
			<input type="checkbox" bind:checked={editor.showOpenTerminals} /> Marquer les bornes non raccordées
		</label>
	{:else}
		<p class="ok"><Check size={14} /> Aucun problème détecté.</p>
	{/if}
</Panel>

<style>
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	button {
		display: flex;
		gap: var(--sp-2);
		align-items: flex-start;
		width: 100%;
		padding: 4px 0;
		border: none;
		background: transparent;
		color: var(--c-warning);
		font-size: var(--fs-sm);
		text-align: left;
		cursor: pointer;
	}
	button span {
		color: var(--c-text);
	}
	.ok {
		display: flex;
		align-items: center;
		gap: var(--sp-1);
		margin: 0;
		color: var(--c-success);
		font-size: var(--fs-sm);
	}
	.toggle {
		display: flex;
		gap: var(--sp-1);
		align-items: center;
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}
</style>
