/**
 * Modèles de cartouche et de page de garde (réutilisables).
 *
 * Un modèle décrit l'identité (logo, société, présentation), les champs libres propres au
 * modèle (« Lot », « Maître d'ouvrage »…, saisis dans chaque projet) et la composition :
 * - cartouche = suite de cases (texte sur 1 à 3 lignes, logo, n° de folio) ;
 * - page de garde = structure du dossier de référence (sommaire, société, présentation,
 *   titre, indices, pied à 3 cases), avec des textes à champs `{affaire}`, `{plan}`…
 *
 * Les modèles vivent dans une bibliothèque partagée ; chaque projet en garde une COPIE
 * (`Project.template`) : modifier la bibliothèque ne change pas les dossiers existants.
 */
import { newId } from './ids';
import { folioNumber, TITLEBLOCK } from './layout';
import type { Project } from './types';

export type TextSize = 'small' | 'normal' | 'big';

/** Ligne de texte : `value` (avec champs `{…}`) ; `label` à gauche et valeur à droite. */
export interface TemplateLine {
	label?: string;
	value: string;
	bold?: boolean;
	size?: TextSize;
	/** Couleur d'accent (bleu des références) au lieu du noir. */
	accent?: boolean;
}

export type CellKind = 'text' | 'logo' | 'folio';

export interface TitleCell {
	id: string;
	kind: CellKind;
	/** Largeur en mm ; 0 = prend la place restante. */
	width: number;
	lines: TemplateLine[];
	align?: 'left' | 'center';
	/** Trait entre les lignes. */
	rules?: boolean;
}

/** Champ libre du modèle, valeur saisie dans chaque projet (`meta.fields[key]`). */
export interface TemplateField {
	key: string;
	label: string;
}

export interface DocTemplate {
	id: string;
	name: string;
	/** Logo : data URL (PNG / JPEG). */
	logo?: string;
	/** Hauteur / largeur du logo (mise en page sans recharger l'image). */
	logoRatio?: number;
	fields: TemplateField[];
	titleblock: { cells: TitleCell[] };
	cover: {
		/** Bloc société (logo + lignes). */
		company: TemplateLine[];
		/** Bloc de présentation (masqué s'il est vide). */
		about: TemplateLine[];
		/** Bloc titre du dossier. */
		title: TemplateLine[];
		/** Pied de page : 3 cases (libellé au-dessus, valeur dessous). */
		footer: TemplateLine[];
	};
	updatedAt?: string;
}

// ---------------------------------------------------------------- champs

export interface FieldContext {
	folioTitle?: string;
	folioIndex?: number;
	/** Nombre total de pages (cartouche). */
	total?: number;
	/** Nombre de folios (page de garde). */
	folioCount?: number;
}

/** Champs fournis par l'application (clé → libellé). */
export const BUILTIN_FIELDS: { key: string; label: string }[] = [
	{ key: 'nom', label: 'Nom du projet' },
	{ key: 'affaire', label: 'N° d’affaire' },
	{ key: 'whysoft', label: 'N° WhySoft' },
	{ key: 'plan', label: 'N° de plan' },
	{ key: 'client', label: 'Client / site' },
	{ key: 'dessinateur', label: 'Dessinateur' },
	{ key: 'societe', label: 'Société (propriétés du dossier)' },
	{ key: 'adresse', label: 'Adresse (propriétés du dossier)' },
	{ key: 'cree', label: 'Date de création' },
	{ key: 'modifie', label: 'Date de modification' },
	{ key: 'indice', label: 'Dernier indice' },
	{ key: 'dateIndice', label: 'Date du dernier indice' },
	{ key: 'titre', label: 'Titre du folio (cartouche)' },
	{ key: 'folio', label: 'N° du folio (cartouche)' },
	{ key: 'total', label: 'Nombre de pages (cartouche)' },
	{ key: 'nbFolios', label: 'Nombre de folios (page de garde)' }
];

const BUILTIN_KEYS = new Set(BUILTIN_FIELDS.map((f) => f.key));

const fmtDate = (iso: string) => (iso ? new Date(iso).toLocaleDateString('fr-FR') : '');

/** Valeur d'un champ (clé de l'application ou champ libre du modèle). */
export function fieldValue(project: Project, key: string, ctx: FieldContext = {}): string {
	const m = project.meta;
	const last = project.revisions.at(-1);
	switch (key) {
		case 'nom':
			return m.name;
		case 'affaire':
			return m.affaireNumber;
		case 'whysoft':
			return m.whysoft ?? '';
		case 'plan':
			return m.planNumber;
		case 'client':
			return m.client;
		case 'dessinateur':
			return m.author;
		case 'societe':
			return m.company;
		case 'adresse':
			return m.companyAddress;
		case 'cree':
			return fmtDate(m.createdAt);
		case 'modifie':
			return fmtDate(m.modifiedAt);
		case 'indice':
			return last?.indice ?? '';
		case 'dateIndice':
			return last?.date ?? '';
		case 'titre':
			return ctx.folioTitle ?? '';
		case 'folio':
			return ctx.folioIndex === undefined ? '' : folioNumber(ctx.folioIndex);
		case 'total':
			return ctx.total === undefined ? '' : String(ctx.total);
		case 'nbFolios':
			return ctx.folioCount === undefined ? '' : String(ctx.folioCount);
		default:
			return m.fields?.[key] ?? '';
	}
}

/** Remplace les champs `{clé}` d'un texte ; espaces en trop retirés. */
export function fillText(text: string, project: Project, ctx: FieldContext = {}): string {
	return text
		.replace(/\{([\w-]+)\}/g, (_, key: string) => fieldValue(project, key, ctx))
		.replace(/\s+/g, ' ')
		.trim();
}

/** Clé d'un nouveau champ libre, dérivée du libellé (« Maître d'ouvrage » → `maitre_douvrage`). */
export function fieldKey(label: string, taken: Iterable<string>): string {
	const base =
		label
			.toLowerCase()
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_+|_+$/g, '')
			.slice(0, 24) || 'champ';
	const used = new Set([...taken, ...BUILTIN_KEYS]);
	let key = base;
	for (let i = 2; used.has(key); i++) key = `${base}_${i}`;
	return key;
}

// ---------------------------------------------------------------- cartouche

/** Largeur réelle des cases (la case de largeur 0 prend le reste ; au moins 10 mm). */
export function cellWidths(cells: TitleCell[], total = TITLEBLOCK.w): number[] {
	const fixed = cells.reduce((s, c) => s + (c.width > 0 ? c.width : 0), 0);
	const flex = cells.filter((c) => !(c.width > 0)).length;
	const rest = Math.max(0, total - fixed);
	return cells.map((c) => (c.width > 0 ? c.width : flex ? Math.max(10, rest / flex) : 0));
}

// ---------------------------------------------------------------- modèle par défaut

export const DEFAULT_TEMPLATE_ID = 'defaut';

/**
 * Modèle par défaut : exactement la présentation d'origine (dossier WinRelais de
 * référence). Société et adresse viennent des propriétés du dossier.
 */
export function defaultTemplate(): DocTemplate {
	return {
		id: DEFAULT_TEMPLATE_ID,
		name: 'Standard',
		fields: [],
		titleblock: {
			cells: [
				{
					id: 'societe',
					kind: 'text',
					width: 58,
					align: 'center',
					lines: [
						{ value: '{societe}', bold: true },
						{ value: '{adresse}', size: 'small' }
					]
				},
				{
					id: 'projet',
					kind: 'text',
					width: 0,
					rules: true,
					lines: [{ value: '{plan} {nom}' }, { value: '{titre}' }]
				},
				{
					id: 'dates',
					kind: 'text',
					width: 48,
					lines: [
						{ label: 'Dessiné le :', value: '{cree}', size: 'small' },
						{ label: 'Modifié le :', value: '{modifie}', size: 'small' },
						{ label: 'Par :', value: '{dessinateur}', size: 'small' }
					]
				},
				{ id: 'folio', kind: 'folio', width: 18, lines: [] }
			]
		},
		cover: {
			company: [{ value: '{societe}', bold: true, size: 'big' }, { value: '{adresse}' }],
			about: [],
			title: [{ value: '{nom}', bold: true, size: 'big' }, { value: '{client}' }],
			footer: [
				{ label: 'N° d’affaire :', value: '{affaire}' },
				{ label: 'N° de plan', value: '{plan}' },
				{ label: 'NB DE FOLIOS :', value: '{nbFolios}', bold: true, size: 'big' }
			]
		}
	};
}

/** Modèle effectif d'un projet. */
export function projectTemplate(project: Project): DocTemplate {
	return project.template ?? defaultTemplate();
}

/** Nouveau modèle vierge, à partir du modèle par défaut. */
export function newTemplate(name: string): DocTemplate {
	return { ...defaultTemplate(), id: newId('tpl'), name };
}

/**
 * Normalise un modèle reçu (bibliothèque, ancien format) : champs manquants complétés
 * à partir du modèle par défaut, cases sans identifiant corrigées.
 */
export function normalizeTemplate(raw: unknown): DocTemplate | null {
	const t = raw as Partial<DocTemplate> | null;
	if (!t || typeof t !== 'object' || typeof t.id !== 'string' || typeof t.name !== 'string')
		return null;
	const base = defaultTemplate();
	const lines = (l: unknown, fallback: TemplateLine[]) =>
		Array.isArray(l)
			? (l as TemplateLine[]).filter((x) => x && typeof x.value === 'string')
			: fallback;
	return {
		id: t.id,
		name: t.name.trim() || 'Sans nom',
		logo: typeof t.logo === 'string' && t.logo.startsWith('data:image/') ? t.logo : undefined,
		logoRatio: typeof t.logoRatio === 'number' && t.logoRatio > 0 ? t.logoRatio : undefined,
		fields: Array.isArray(t.fields)
			? t.fields.filter((f) => f && typeof f.key === 'string' && typeof f.label === 'string')
			: [],
		titleblock: {
			cells: Array.isArray(t.titleblock?.cells)
				? t.titleblock.cells
						.filter((c) => c && ['text', 'logo', 'folio'].includes(c.kind))
						.map((c) => ({
							...c,
							id: c.id || newId('c'),
							width: Math.max(0, Number(c.width) || 0),
							lines: lines(c.lines, [])
						}))
				: base.titleblock.cells
		},
		cover: {
			company: lines(t.cover?.company, base.cover.company),
			about: lines(t.cover?.about, []),
			title: lines(t.cover?.title, base.cover.title),
			footer: lines(t.cover?.footer, base.cover.footer).slice(0, 3)
		},
		updatedAt: t.updatedAt
	};
}

/**
 * Applique un modèle à un projet (copie) ; les valeurs des champs libres déjà saisies
 * sont conservées.
 */
export function applyTemplate(project: Project, template: DocTemplate) {
	project.template = JSON.parse(JSON.stringify(template)) as DocTemplate;
	project.meta.fields ??= {};
}
