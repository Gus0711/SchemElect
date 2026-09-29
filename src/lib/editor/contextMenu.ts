/** Contenu du menu contextuel selon l'élément visé (clic droit). */
import { crossTargets } from '$lib/model/crossrefs';
import { addText, detachSymbol, symbolsOfDevice } from '$lib/model/edit';
import { packRail } from '$lib/model/panel';
import type { ItemRef, Point } from '$lib/model/types';
import type { MenuEntry } from '$lib/ui';
import type { Editor } from './editor.svelte';

const SEP: MenuEntry = { separator: true };

export function buildContextMenu(editor: Editor, ref: ItemRef | null, at: Point): MenuEntry[] {
	const ro = editor.readonly;
	const sel = editor.selection;
	const multi = sel.length > 1;

	if (!ref) {
		return [
			{ label: 'Coller ici', shortcut: 'Ctrl+V', disabled: ro, action: () => editor.paste() },
			{ label: 'Tout sélectionner', shortcut: 'Ctrl+A', action: () => editor.selectAll() },
			SEP,
			{
				label: 'Ajouter un texte ici',
				disabled: ro,
				action: () => {
					editor.transact('Ajouter un texte', (_, f) => {
						const t = addText(f, at, 'Texte');
						editor.selection = [{ kind: 'text', id: t.id }];
					});
					editor.requestFocus('text');
				}
			},
			editor.panel
				? {
						label: 'Placer automatiquement les appareils',
						disabled: ro,
						action: () => editor.autoPlace()
					}
				: {
						label: 'Tracer un fil',
						shortcut: 'W',
						disabled: ro,
						action: () => editor.setTool({ kind: 'wire' })
					},
			SEP,
			{ label: 'Page entière', shortcut: 'F', action: () => editor.viewport.fit() },
			{
				label: 'Raccourcis clavier',
				shortcut: '?',
				action: () => (editor.shortcutsOpen = true)
			}
		];
	}

	const edition: MenuEntry[] = [
		{ label: 'Copier', shortcut: 'Ctrl+C', action: () => editor.copy() },
		{ label: 'Couper', shortcut: 'Ctrl+X', disabled: ro, action: () => editor.cut() },
		{ label: 'Dupliquer', shortcut: 'Ctrl+D', disabled: ro, action: () => editor.duplicate() }
	];
	const remove: MenuEntry = {
		label: multi ? `Supprimer (${sel.length})` : 'Supprimer',
		shortcut: 'Suppr',
		danger: true,
		disabled: ro,
		action: () => editor.deleteSelection()
	};
	const alignment: MenuEntry[] =
		multi && !ro
			? [
					SEP,
					{ label: 'Aligner sur l’axe du premier', action: () => editor.align('axis') },
					{ label: 'Aligner en haut', action: () => editor.align('top') },
					{ label: 'Aligner en bas', action: () => editor.align('bottom') },
					{
						label: 'Répartir horizontalement',
						disabled: sel.length < 3,
						action: () => editor.distribute('horizontal')
					}
				]
			: [];

	if (ref.kind === 'symbol' && !multi) {
		const symbol = editor.folio.symbols.find((s) => s.id === ref.id);
		const shared = symbol ? symbolsOfDevice(editor.project, symbol.deviceId).length > 1 : false;
		const LABEL = {
			renvoi: 'Aller au renvoi',
			master: 'Aller à la bobine / l’appareil',
			contact: 'Aller au contact'
		};
		const goto: MenuEntry[] = crossTargets(editor.project, ref.id)
			.slice(0, 12)
			.map((t) => ({
				label: `${LABEL[t.kind]} (${t.ref})`,
				action: () => editor.goToSymbol(t.symbolId)
			}));
		return [
			...goto,
			...(goto.length ? [SEP] : []),
			{
				label: 'Modifier le repère…',
				shortcut: 'Double-clic',
				disabled: ro,
				action: () => editor.requestFocus('tag')
			},
			{ label: 'Pivoter', shortcut: 'R', disabled: ro, action: () => editor.rotate() },
			{ label: 'Miroir', shortcut: 'X', disabled: ro, action: () => editor.mirror() },
			SEP,
			...edition,
			...(shared && symbol
				? [
						SEP,
						{
							label: 'Détacher de l’appareil',
							disabled: ro,
							action: () => editor.transact('Détacher', (p) => detachSymbol(p, symbol))
						}
					]
				: []),
			SEP,
			remove
		];
	}

	if (ref.kind === 'mount' && !multi) {
		const item = editor.panel?.items.find((i) => i.id === ref.id);
		const s = item?.deviceId ? symbolsOfDevice(editor.project, item.deviceId)[0] : undefined;
		return [
			{
				label: 'Voir dans le schéma',
				shortcut: 'Double-clic',
				disabled: !s,
				action: () => s && editor.goToSymbol(s.id)
			},
			SEP,
			remove
		];
	}

	if (ref.kind === 'rail' && !multi) {
		return [
			{
				label: 'Serrer les appareils à gauche',
				disabled: ro,
				action: () =>
					editor.transact('Serrer le rail', (_, f) => f.panel && packRail(f.panel, ref.id))
			},
			SEP,
			remove
		];
	}

	if (ref.kind === 'duct' && !multi) return [remove];

	if (ref.kind === 'wire' && !multi) {
		return [
			{
				label: 'Imposer un numéro…',
				disabled: ro,
				action: () => editor.requestFocus('wireNumber')
			},
			SEP,
			...edition,
			SEP,
			remove
		];
	}

	if (ref.kind === 'text' && !multi) {
		return [
			{ label: 'Modifier le texte…', disabled: ro, action: () => editor.requestFocus('text') },
			{ label: 'Pivoter', shortcut: 'R', disabled: ro, action: () => editor.rotate() },
			SEP,
			...edition,
			SEP,
			remove
		];
	}

	return [
		...(sel.some((r) => r.kind === 'symbol' || r.kind === 'text' || r.kind === 'cable')
			? [{ label: 'Pivoter', shortcut: 'R', disabled: ro, action: () => editor.rotate() }, SEP]
			: []),
		...edition,
		...alignment,
		SEP,
		remove
	];
}
