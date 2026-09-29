<script lang="ts">
	/**
	 * Lignes d'un bloc de modèle (case de cartouche, bloc de page de garde) : texte avec
	 * champs `{…}` insérables, libellé facultatif, taille, gras, couleur d'accent.
	 */
	import type { TemplateLine } from '$lib/model/template';
	import { Plus, Trash } from '@lucide/svelte';

	let {
		lines = $bindable(),
		fields,
		max = 8,
		withLabel = false,
		fixed = false
	}: {
		lines: TemplateLine[];
		fields: { key: string; label: string }[];
		max?: number;
		/** Colonne « libellé » (libellé à gauche, valeur à droite / au-dessus). */
		withLabel?: boolean;
		/** Nombre de lignes fixe (pied de page à 3 cases). */
		fixed?: boolean;
	} = $props();

	function insert(i: number, key: string) {
		if (!key) return;
		const v = lines[i].value;
		lines[i].value = `${v}${v && !v.endsWith(' ') ? ' ' : ''}{${key}}`;
	}
</script>

<div class="lines">
	{#each lines as line, i (i)}
		<div class="line" class:with-label={withLabel}>
			{#if withLabel}
				<input class="cell" placeholder="Libellé" bind:value={line.label} />
			{/if}
			<input class="cell" placeholder="Texte, ex. Lot : {'{lot}'}" bind:value={line.value} />
			<select
				class="cell"
				title="Insérer un champ"
				value=""
				onchange={(e) => {
					insert(i, (e.currentTarget as HTMLSelectElement).value);
					(e.currentTarget as HTMLSelectElement).value = '';
				}}
			>
				<option value="">+ champ</option>
				{#each fields as f (f.key)}<option value={f.key}>{f.label}</option>{/each}
			</select>
			<select class="cell" title="Taille" bind:value={line.size}>
				<option value={undefined}>Normal</option>
				<option value="small">Petit</option>
				<option value="big">Grand</option>
			</select>
			<label class="toggle" title="Gras"><input type="checkbox" bind:checked={line.bold} /> G</label
			>
			<label class="toggle" title="Couleur bleue (références)"
				><input type="checkbox" bind:checked={line.accent} /> Bleu</label
			>
			{#if !fixed}
				<button class="icon" title="Supprimer la ligne" onclick={() => lines.splice(i, 1)}
					><Trash size={14} /></button
				>
			{/if}
		</div>
	{/each}
	{#if !fixed && lines.length < max}
		<button class="add" onclick={() => lines.push({ value: '' })}
			><Plus size={13} /> Ajouter une ligne</button
		>
	{/if}
</div>

<style>
	.lines {
		display: flex;
		flex-direction: column;
		gap: var(--sp-1);
	}
	.line {
		display: grid;
		grid-template-columns: 1fr 92px 76px auto auto auto;
		gap: var(--sp-1);
		align-items: center;
	}
	.line.with-label {
		grid-template-columns: 110px 1fr 92px 76px auto auto auto;
	}
	.cell {
		min-width: 0;
		height: 28px;
		padding: 0 var(--sp-2);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		background: var(--c-surface);
		color: var(--c-text);
		font-size: var(--fs-sm);
	}
	.toggle {
		display: flex;
		align-items: center;
		gap: 2px;
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		white-space: nowrap;
	}
	.icon {
		border: none;
		background: transparent;
		color: var(--c-text-muted);
		cursor: pointer;
	}
	.add {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		border: none;
		background: transparent;
		color: var(--c-primary);
		font-size: var(--fs-sm);
		cursor: pointer;
		padding: 2px 0;
	}
</style>
