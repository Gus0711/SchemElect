/**
 * Catalogue matériel : une fiche par référence constructeur (fabricant, désignation
 * commerciale, contacts auxiliaires, encombrement, montage).
 *
 * - La **bibliothèque** est partagée (base, page « Catalogue ») ;
 * - le **projet** garde une copie des fiches qu'il utilise (`Project.catalog`, clé =
 *   `referenceKey`) : le dossier reste autonome et ne change pas tout seul si la
 *   bibliothèque est modifiée (même principe que les symboles maison).
 *
 * Le lien appareil → fiche se fait par la référence (`Device.reference`). Ce qui se déduit
 * d'une fiche (contacts disponibles, encombrement, fabricant) n'est pas recopié sur
 * l'appareil : voir `deviceContacts` et `footprints.ts`.
 */
import type { Device, Mounting, Project } from './types';

export interface CatalogItem {
	id: string;
	/** Référence constructeur, telle qu'imprimée (« LC1D09B7 », « 4 067 71 »). */
	reference: string;
	manufacturer: string;
	/** Désignation commerciale (« Contacteur 3P 9 A AC3, bobine 24 V CA »). */
	designation: string;
	/** Famille libre, pour le tri et le filtre (« Contacteur », « Disjoncteur »…). */
	category?: string;
	/** Contacts auxiliaires disponibles (bobines, disjoncteurs) : contrôle des contacts. */
	contacts?: { no: number; nc: number };
	/** Encombrement (vue de face, mm) pour l'implantation / la façade. */
	w?: number;
	h?: number;
	mounting?: Mounting;
	/** Remarque libre (« à vérifier », lien fiche technique…). */
	notes?: string;
	/**
	 * Accessoires appelés par la référence (embase d'un relais, bloc additif…) : ajoutés
	 * automatiquement à la nomenclature, quantité par appareil.
	 */
	accessories?: CatalogAccessory[];
	updatedAt?: string;
}

export interface CatalogAccessory {
	reference: string;
	quantity: number;
}

const MAX_ACCESSORIES = 20;

/**
 * Accessoires saisis en texte : un par ligne ou séparés par des virgules, quantité
 * facultative avant ou après la référence (« 2 × LADN11 », « LADN11 x2 », « RXZE2S114M »).
 */
export function parseAccessories(text: string): CatalogAccessory[] {
	const out: CatalogAccessory[] = [];
	for (const raw of text.split(/[\n,;]+/)) {
		const s = raw.trim();
		if (!s) continue;
		const before = /^(\d+)\s*[x×*]\s*(.+)$/i.exec(s);
		const after = /^(.+?)\s*[x×*]\s*(\d+)$/i.exec(s);
		const [reference, q] = before
			? [before[2], before[1]]
			: after
				? [after[1], after[2]]
				: [s, '1'];
		const acc = normalizeAccessory({ reference, quantity: q });
		if (acc) out.push(acc);
	}
	return mergeAccessories(out);
}

/** Texte d'une liste d'accessoires (« 2 × LADN11, RXZE2S114M »). */
export function formatAccessories(list: CatalogAccessory[] | undefined): string {
	return (list ?? [])
		.map((a) => (a.quantity > 1 ? `${a.quantity} × ${a.reference}` : a.reference))
		.join(', ');
}

function normalizeAccessory(raw: unknown): CatalogAccessory | null {
	if (!raw || typeof raw !== 'object') return null;
	const r = raw as Record<string, unknown>;
	const reference = str(r.reference).replace(/\s+/g, ' ').slice(0, 80);
	const q = Math.round(Number(str(r.quantity) || 1));
	if (!reference || !referenceKey(reference)) return null;
	return { reference, quantity: Number.isFinite(q) && q > 0 ? Math.min(q, 99) : 1 };
}

/** Même référence citée deux fois : quantités additionnées. */
function mergeAccessories(list: CatalogAccessory[]): CatalogAccessory[] {
	const map = new Map<string, CatalogAccessory>();
	for (const a of list) {
		const k = referenceKey(a.reference);
		const cur = map.get(k);
		if (cur) cur.quantity = Math.min(99, cur.quantity + a.quantity);
		else map.set(k, { ...a });
	}
	return [...map.values()].slice(0, MAX_ACCESSORIES);
}

/** Clé de comparaison d'une référence : sans espaces, points ni tirets, en majuscules. */
export function referenceKey(reference: string): string {
	return reference
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[\s.\-_/]+/g, '')
		.toUpperCase();
}

const MOUNTINGS: Mounting[] = ['rail', 'porte', 'externe'];

const str = (v: unknown) =>
	typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '';
const num = (v: unknown): number | undefined => {
	const n = typeof v === 'number' ? v : Number(str(v).replace(',', '.'));
	return Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : undefined;
};
const count = (v: unknown): number | undefined => {
	if (v === '' || v === null || v === undefined) return undefined;
	const n = typeof v === 'number' ? v : Number(str(v));
	return Number.isFinite(n) && n >= 0 ? Math.min(20, Math.round(n)) : undefined;
};

/** Montage saisi librement (« Façade », « hors armoire »…) → valeur du modèle. */
export function parseMounting(v: unknown): Mounting | undefined {
	const s = str(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
	if (!s) return undefined;
	if ((MOUNTINGS as string[]).includes(s)) return s as Mounting;
	if (s.startsWith('porte') || s.startsWith('facade')) return 'porte';
	if (s.startsWith('rail') || s.includes('din') || s.startsWith('fond')) return 'rail';
	if (s.includes('hors') || s.startsWith('ext')) return 'externe';
	return undefined;
}

/** Fiche reçue (client, import, base) → fiche propre, ou null si sans référence. */
export function normalizeCatalogItem(raw: unknown): CatalogItem | null {
	if (!raw || typeof raw !== 'object') return null;
	const r = raw as Record<string, unknown>;
	const reference = str(r.reference).replace(/\s+/g, ' ');
	if (!reference || reference.length > 80) return null;
	const item: CatalogItem = {
		id: str(r.id) || `cat_${referenceKey(reference).toLowerCase()}`,
		reference,
		manufacturer: str(r.manufacturer).slice(0, 80),
		designation: str(r.designation).slice(0, 200)
	};
	const category = str(r.category).slice(0, 60);
	if (category) item.category = category;
	const c = r.contacts as Record<string, unknown> | undefined;
	const no = count(c?.no);
	const nc = count(c?.nc);
	if (no !== undefined || nc !== undefined) item.contacts = { no: no ?? 0, nc: nc ?? 0 };
	const w = num(r.w);
	const h = num(r.h);
	if (w && h) {
		item.w = w;
		item.h = h;
	}
	const mounting = parseMounting(r.mounting);
	if (mounting) item.mounting = mounting;
	const notes = str(r.notes).slice(0, 500);
	if (notes) item.notes = notes;
	const accessories = mergeAccessories(
		(Array.isArray(r.accessories)
			? r.accessories
			: typeof r.accessories === 'string'
				? parseAccessories(r.accessories)
				: []
		)
			.map(normalizeAccessory)
			.filter((a): a is CatalogAccessory => !!a)
			// Une référence ne s'appelle pas elle-même.
			.filter((a) => referenceKey(a.reference) !== referenceKey(reference))
	);
	if (accessories.length) item.accessories = accessories;
	if (typeof r.updatedAt === 'string') item.updatedAt = r.updatedAt;
	return item;
}

/** Fiche correspondant à une référence dans une liste (comparaison par `referenceKey`). */
export function findCatalogItem(
	items: Iterable<CatalogItem>,
	reference: string | undefined
): CatalogItem | undefined {
	const key = reference ? referenceKey(reference) : '';
	if (!key) return undefined;
	for (const it of items) if (referenceKey(it.reference) === key) return it;
	return undefined;
}

/** Fiche (copie du projet) de l'appareil, d'après sa référence. */
export function deviceCatalogItem(
	project: Project,
	device: Device | undefined
): CatalogItem | undefined {
	const key = device?.reference ? referenceKey(device.reference) : '';
	return key ? project.catalog?.[key] : undefined;
}

/** Contacts disponibles : saisis sur l'appareil, sinon ceux de sa fiche catalogue. */
export function deviceContacts(
	project: Project,
	device: Device | undefined
): { no: number; nc: number } | undefined {
	return device?.contacts ?? deviceCatalogItem(project, device)?.contacts;
}

/**
 * Change la référence d'un appareil. Si elle existe dans la bibliothèque, la fiche est
 * recopiée dans le projet et le fabricant repris (s'il était vide ou issu de l'ancienne
 * fiche). Les copies devenues inutiles sont retirées du projet.
 */
export function assignReference(
	project: Project,
	deviceId: string,
	reference: string,
	library: Iterable<CatalogItem> = []
): CatalogItem | undefined {
	const device = project.devices[deviceId];
	if (!device) return undefined;
	const previous = deviceCatalogItem(project, device);
	const ref = reference.trim();
	const item =
		findCatalogItem(library, ref) ?? findCatalogItem(Object.values(project.catalog ?? {}), ref);
	if (item) {
		device.reference = item.reference;
		copyWithAccessories(project, item, library);
		if (!device.manufacturer || device.manufacturer === previous?.manufacturer)
			device.manufacturer = item.manufacturer || undefined;
	} else {
		device.reference = ref || undefined;
		if (previous && device.manufacturer === previous.manufacturer) device.manufacturer = undefined;
	}
	pruneProjectCatalog(project);
	return item;
}

/**
 * Recopie une fiche dans le projet, avec les fiches de ses accessoires (et des accessoires
 * de ceux-ci) trouvées dans la bibliothèque ou déjà dans le projet.
 */
function copyWithAccessories(project: Project, item: CatalogItem, library: Iterable<CatalogItem>) {
	const lib = [...library];
	const todo = [item];
	const seen = new Set<string>();
	while (todo.length) {
		const it = todo.pop()!;
		const key = referenceKey(it.reference);
		if (seen.has(key)) continue;
		seen.add(key);
		(project.catalog ??= {})[key] = { ...it };
		for (const a of it.accessories ?? []) {
			const acc = findCatalogItem(lib, a.reference) ?? project.catalog[referenceKey(a.reference)];
			if (acc) todo.push(acc);
		}
	}
}

/** Références nécessaires au projet : celles des appareils et de leurs accessoires. */
function neededKeys(project: Project, library: CatalogItem[] = []): Set<string> {
	const keys = new Set<string>();
	const todo = Object.values(project.devices)
		.map((d) => (d.reference ? referenceKey(d.reference) : ''))
		.filter(Boolean);
	while (todo.length) {
		const key = todo.pop()!;
		if (keys.has(key)) continue;
		keys.add(key);
		const item = project.catalog?.[key] ?? library.find((i) => referenceKey(i.reference) === key);
		for (const a of item?.accessories ?? []) todo.push(referenceKey(a.reference));
	}
	return keys;
}

/** Retire du projet les fiches qu'aucun appareil (ni accessoire) n'utilise plus. */
export function pruneProjectCatalog(project: Project): void {
	if (!project.catalog) return;
	const used = neededKeys(project);
	for (const key of Object.keys(project.catalog)) if (!used.has(key)) delete project.catalog[key];
}

/**
 * Fiches de la bibliothèque différentes de la copie du projet (modifiées depuis), et
 * références d'appareils trouvées dans la bibliothèque mais pas encore recopiées.
 */
export function catalogUpdates(project: Project, library: CatalogItem[]): CatalogItem[] {
	const out: CatalogItem[] = [];
	for (const key of neededKeys(project, library)) {
		const lib = library.find((i) => referenceKey(i.reference) === key);
		if (!lib) continue;
		const copy = project.catalog?.[key];
		if (!copy || !sameItem(copy, lib)) out.push(lib);
	}
	return out;
}

function sameItem(a: CatalogItem, b: CatalogItem): boolean {
	// L'id et la date de mise à jour ne comptent pas.
	const strip = (i: CatalogItem) => JSON.stringify({ ...i, id: undefined, updatedAt: undefined });
	return strip(a) === strip(b);
}

/** Recopie les fiches à jour de la bibliothèque dans le projet (fabricant compris). */
export function applyCatalogUpdates(project: Project, items: CatalogItem[]): number {
	let n = 0;
	for (const item of items) {
		const key = referenceKey(item.reference);
		const old = project.catalog?.[key];
		(project.catalog ??= {})[key] = { ...item };
		for (const d of Object.values(project.devices)) {
			if (!d.reference || referenceKey(d.reference) !== key) continue;
			if (!d.manufacturer || d.manufacturer === old?.manufacturer)
				d.manufacturer = item.manufacturer || undefined;
		}
		n++;
	}
	return n;
}

// ---------------------------------------------------------------- import / export CSV

/** Colonnes du fichier d'échange (export, modèle d'import). */
export const CATALOG_CSV_HEADER = [
	'Référence',
	'Fabricant',
	'Désignation',
	'Catégorie',
	'Contacts NO',
	'Contacts NC',
	'Largeur (mm)',
	'Hauteur (mm)',
	'Montage',
	'Accessoires',
	'Remarque'
];

type Field =
	| 'reference'
	| 'manufacturer'
	| 'designation'
	| 'category'
	| 'no'
	| 'nc'
	| 'w'
	| 'h'
	| 'mounting'
	| 'notes'
	| 'accessories';

const norm = (s: string) =>
	s
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/\(.*?\)/g, '')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();

/** En-tête de colonne (FR / EN, abrégé) → champ. */
function headerField(h: string): Field | null {
	const s = norm(h);
	if (!s) return null;
	if (
		/^(ref|reference|references|ref constructeur|reference constructeur|code article|article|part number)$/.test(
			s
		)
	)
		return 'reference';
	if (/^(fabricant|marque|constructeur|fournisseur|manufacturer|brand)$/.test(s))
		return 'manufacturer';
	if (/^(designation|libelle|description|desc|nom)$/.test(s)) return 'designation';
	if (/^(categorie|famille|type|category)$/.test(s)) return 'category';
	if (/^(contacts? no|no|nb no|contacts? ouverts?|contacts? f)$/.test(s)) return 'no';
	if (/^(contacts? nc|nc|nb nc|contacts? fermes?|contacts? o)$/.test(s)) return 'nc';
	if (/^(largeur|l|w|width)$/.test(s)) return 'w';
	if (/^(hauteur|h|height)$/.test(s)) return 'h';
	if (/^(montage|mounting|pose)$/.test(s)) return 'mounting';
	if (/^(remarque|remarques|note|notes|commentaire|observations?)$/.test(s)) return 'notes';
	if (/^(accessoires?|options?|accessories)$/.test(s)) return 'accessories';
	return null;
}

/** Découpe un CSV (séparateur `;`, `,` ou tabulation détecté sur la 1re ligne, guillemets). */
export function parseCsv(text: string): string[][] {
	const src = text.replace(/^\uFEFF/, '');
	const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
	const sep = ['\t', ';', ','].reduce((best, c) =>
		firstLine.split(c).length > firstLine.split(best).length ? c : best
	);
	const rows: string[][] = [];
	let row: string[] = [];
	let cell = '';
	let quoted = false;
	for (let i = 0; i < src.length; i++) {
		const ch = src[i];
		if (quoted) {
			if (ch === '"' && src[i + 1] === '"') {
				cell += '"';
				i++;
			} else if (ch === '"') quoted = false;
			else cell += ch;
		} else if (ch === '"' && cell === '') quoted = true;
		else if (ch === sep) {
			row.push(cell);
			cell = '';
		} else if (ch === '\n' || ch === '\r') {
			if (ch === '\r' && src[i + 1] === '\n') i++;
			row.push(cell);
			rows.push(row);
			row = [];
			cell = '';
		} else cell += ch;
	}
	if (cell !== '' || row.length) {
		row.push(cell);
		rows.push(row);
	}
	return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

export interface CatalogImport {
	items: CatalogItem[];
	/** Lignes ignorées (numéro de ligne du fichier, 1 = en-tête) et pourquoi. */
	skipped: { line: number; reason: string }[];
	/** Colonnes non reconnues (ignorées). */
	unknownColumns: string[];
}

/**
 * Lit un fichier catalogue (CSV exporté d'Excel, ou copié-collé d'un tableau). La 1re
 * ligne est l'en-tête ; seule la colonne « Référence » est obligatoire. Une référence en
 * double dans le fichier : la dernière ligne l'emporte.
 */
export function importCatalogCsv(text: string): CatalogImport {
	const rows = parseCsv(text);
	const out: CatalogImport = { items: [], skipped: [], unknownColumns: [] };
	if (!rows.length) return out;
	const fields = rows[0].map(headerField);
	rows[0].forEach((h, i) => {
		if (!fields[i] && h.trim()) out.unknownColumns.push(h.trim());
	});
	if (!fields.includes('reference')) {
		out.skipped.push({ line: 1, reason: 'Colonne « Référence » introuvable dans l’en-tête' });
		return out;
	}
	const byKey = new Map<string, CatalogItem>();
	rows.slice(1).forEach((cells, k) => {
		const rec: Partial<Record<Field, string>> = {};
		fields.forEach((f, i) => {
			if (f && cells[i] !== undefined) rec[f] = cells[i];
		});
		const item = normalizeCatalogItem({
			reference: rec.reference,
			manufacturer: rec.manufacturer,
			designation: rec.designation,
			category: rec.category,
			contacts:
				rec.no !== undefined || rec.nc !== undefined ? { no: rec.no, nc: rec.nc } : undefined,
			w: rec.w,
			h: rec.h,
			mounting: rec.mounting,
			notes: rec.notes,
			accessories: rec.accessories
		});
		if (!item) out.skipped.push({ line: k + 2, reason: 'Référence vide' });
		else byKey.set(referenceKey(item.reference), item);
	});
	out.items = [...byKey.values()];
	return out;
}

/** Ligne du fichier d'échange (même ordre que `CATALOG_CSV_HEADER`). */
export function catalogCsvRow(item: CatalogItem): (string | number | undefined)[] {
	const MOUNT: Record<Mounting, string> = { rail: 'Rail', porte: 'Porte', externe: 'Hors armoire' };
	return [
		item.reference,
		item.manufacturer,
		item.designation,
		item.category,
		item.contacts?.no,
		item.contacts?.nc,
		item.w,
		item.h,
		item.mounting ? MOUNT[item.mounting] : '',
		formatAccessories(item.accessories),
		item.notes
	];
}

/** Tri : catégorie, fabricant, référence. */
export function compareCatalogItems(a: CatalogItem, b: CatalogItem): number {
	return (
		(a.category ?? '').localeCompare(b.category ?? '', 'fr') ||
		a.manufacturer.localeCompare(b.manufacturer, 'fr') ||
		a.reference.localeCompare(b.reference, 'fr', { numeric: true })
	);
}
