<script lang="ts">
	/**
	 * Fiche du catalogue matériel (création / modification). Partagée par la page
	 * « Catalogue » et l'éditeur (« Ajouter au catalogue » depuis un appareil).
	 */
	import { saveCatalogItem } from '$lib/api/client';
	import { normalizeCatalogItem, type CatalogItem } from '$lib/model/catalog';
	import type { Mounting } from '$lib/model/types';
	import { Alert, Button, Field, Modal } from '$lib/ui';

	let {
		open = $bindable(false),
		initial = null,
		categories = [],
		onsaved
	}: {
		open?: boolean;
		/** Fiche à modifier, ou valeurs de départ d'une nouvelle fiche (sans `id`). */
		initial?: Partial<CatalogItem> | null;
		/** Catégories existantes (suggestions). */
		categories?: string[];
		onsaved?: (item: CatalogItem) => void;
	} = $props();

	let form = $state(empty());
	let error = $state('');
	let pending = $state(false);

	function empty() {
		return {
			id: '',
			reference: '',
			manufacturer: '',
			designation: '',
			category: '',
			no: '',
			nc: '',
			w: '',
			h: '',
			mounting: '' as Mounting | '',
			notes: ''
		};
	}

	// À chaque ouverture : formulaire rempli avec la fiche (ou vide).
	$effect(() => {
		if (!open) return;
		const i = initial ?? {};
		const s = (v: number | undefined) => (v === undefined ? '' : String(v).replace('.', ','));
		form = {
			id: i.id ?? '',
			reference: i.reference ?? '',
			manufacturer: i.manufacturer ?? '',
			designation: i.designation ?? '',
			category: i.category ?? '',
			no: s(i.contacts?.no),
			nc: s(i.contacts?.nc),
			w: s(i.w),
			h: s(i.h),
			mounting: i.mounting ?? '',
			notes: i.notes ?? ''
		};
		error = '';
	});

	const editing = $derived(!!initial?.id);

	async function save() {
		const f = form;
		const item = normalizeCatalogItem({
			id: f.id,
			reference: f.reference,
			manufacturer: f.manufacturer,
			designation: f.designation,
			category: f.category,
			contacts: f.no !== '' || f.nc !== '' ? { no: f.no, nc: f.nc } : undefined,
			w: f.w,
			h: f.h,
			mounting: f.mounting,
			notes: f.notes
		});
		if (!item) {
			error = 'La référence est obligatoire.';
			return;
		}
		if ((f.w && !item.w) || (f.h && !item.h)) {
			error = 'Encombrement : saisir la largeur ET la hauteur (mm), ou aucune des deux.';
			return;
		}
		pending = true;
		error = '';
		try {
			const saved = await saveCatalogItem(editing ? item : { ...item, id: '' });
			open = false;
			onsaved?.(saved);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Enregistrement impossible';
		} finally {
			pending = false;
		}
	}
</script>

<Modal bind:open title={editing ? `Fiche ${initial?.reference}` : 'Nouvelle fiche'} width="560px">
	<form
		class="form"
		onsubmit={(e) => {
			e.preventDefault();
			save();
		}}
	>
		<div class="row">
			<Field label="Référence *" bind:value={form.reference} placeholder="LC1D09B7" required />
			<Field label="Fabricant" bind:value={form.manufacturer} placeholder="Schneider Electric" />
		</div>
		<Field
			label="Désignation"
			bind:value={form.designation}
			placeholder="Contacteur 3P 9 A AC-3, bobine 24 V CA"
		/>
		<div class="row">
			<Field label="Catégorie" bind:value={form.category} list="catalog-categories" />
			<Field label="Montage">
				<select class="control" bind:value={form.mounting}>
					<option value="">Selon le symbole</option>
					<option value="rail">Sur rail (armoire)</option>
					<option value="porte">En porte (façade)</option>
					<option value="externe">Hors armoire</option>
				</select>
			</Field>
		</div>
		<datalist id="catalog-categories">
			{#each categories as c (c)}<option value={c}></option>{/each}
		</datalist>
		<div class="row four">
			<Field
				label="Contacts NO"
				bind:value={form.no}
				inputmode="numeric"
				hint="Contacts auxiliaires"
			/>
			<Field label="Contacts NC" bind:value={form.nc} inputmode="numeric" />
			<Field label="Largeur (mm)" bind:value={form.w} inputmode="decimal" hint="Encombrement" />
			<Field label="Hauteur (mm)" bind:value={form.h} inputmode="decimal" />
		</div>
		<Field
			label="Remarque"
			bind:value={form.notes}
			placeholder="Lien fiche technique, à vérifier…"
		/>
		{#if error}<Alert>{error}</Alert>{/if}
		<!-- Entrée valide le formulaire. -->
		<button type="submit" hidden aria-hidden="true"></button>
	</form>
	{#snippet actions()}
		<Button onclick={() => (open = false)}>Annuler</Button>
		<Button variant="primary" disabled={pending} onclick={save}>Enregistrer</Button>
	{/snippet}
</Modal>

<style>
	.form {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
	}
	.row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--sp-3);
	}
	.row.four {
		grid-template-columns: repeat(4, 1fr);
	}
</style>
