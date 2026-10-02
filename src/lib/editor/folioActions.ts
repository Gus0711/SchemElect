/** Commandes sur les folios (onglets du bas) : ajout, duplication, suppression, renommage, ordre. */
import { addFolio, addPanelFolio, addStripsFolio, deleteFolio, moveFolio } from '$lib/model/edit';
import { duplicateFolio } from '$lib/model/fragments';
import type { Id, PanelKind } from '$lib/model/types';
import type { Editor } from './editor.svelte';

export type NewFolioKind = 'schema' | PanelKind | 'strips';

const ADD_LABEL: Record<NewFolioKind, string> = {
	schema: 'Ajouter un folio',
	implantation: 'Ajouter un folio d’implantation',
	facade: 'Ajouter un folio de façade',
	strips: 'Ajouter un folio borniers'
};

/** Nouveau folio après le folio courant, qui devient le folio affiché. */
export function addFolioOf(editor: Editor, kind: NewFolioKind) {
	const at = editor.folioIndex;
	let id = '';
	editor.transact(ADD_LABEL[kind], (p) => {
		const f =
			kind === 'schema'
				? addFolio(p, at)
				: kind === 'strips'
					? addStripsFolio(p, at)
					: addPanelFolio(p, at, kind);
		id = f.id;
	});
	editor.setFolio(id);
}

export function duplicateFolioOf(editor: Editor, folioId: Id) {
	let id = '';
	editor.transact('Dupliquer le folio', (p) => (id = duplicateFolio(p, folioId)?.id ?? ''));
	if (id) editor.setFolio(id);
}

/** Supprime un folio (confirmation s'il n'est pas vide). */
export function removeFolio(editor: Editor, folioId: Id) {
	const folios = editor.project.folios;
	if (folios.length <= 1) return;
	const i = folios.findIndex((f) => f.id === folioId);
	const f = folios[i];
	if (!f) return;
	const count = f.symbols.length + f.wires.length;
	if (count && !confirm(`Supprimer le folio « ${f.title} » et ses ${count} éléments ?`)) return;
	const next = folios[i + 1] ?? folios[i - 1];
	editor.transact('Supprimer le folio', (p) => deleteFolio(p, folioId));
	if (folioId === editor.folioId || !editor.project.folios.some((x) => x.id === editor.folioId))
		editor.setFolio(next.id);
}

export function renameFolio(editor: Editor, folioId: Id, title: string) {
	const clean = title.trim();
	const folio = editor.project.folios.find((f) => f.id === folioId);
	if (!folio || !clean || clean === folio.title) return;
	editor.transact('Renommer le folio', (p) => {
		const f = p.folios.find((x) => x.id === folioId);
		if (f) f.title = clean;
	});
}

/** Déplace un folio à une autre place (glisser-déposer des onglets, menu). */
export function moveFolioTo(editor: Editor, folioId: Id, to: number) {
	const from = editor.project.folios.findIndex((f) => f.id === folioId);
	if (from < 0 || from === to) return;
	editor.transact('Déplacer le folio', (p) => moveFolio(p, from, to));
}
