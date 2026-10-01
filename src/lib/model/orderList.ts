/**
 * Liste de commande : tout ce qu'il faut acheter pour réaliser l'armoire, groupé par
 * fabricant. Pure (sans DOM), partagée par l'aperçu, le CSV et le PDF.
 *
 * Sources :
 * - appareils et bornes dessinés + accessoires liés (nomenclature par référence) ;
 * - matériel d'armoire calculé depuis les folios d'implantation : enveloppe, rails (barres de
 *   2 m), goulottes (mètres par dimension) ; butées (2) et flasque (1) par bornier ;
 * - câbles, par type / section / référence, longueur saisie sur chaque câble ;
 * - lignes libres (`Project.orderExtras`).
 * Pas de prix (décision utilisateur).
 */
import { cableName } from './cables';
import { referenceKey } from './catalog';
import { listDevices } from './inventory';
import { bomTagsText, computeNomenclature } from './nomenclature';
import type { Project } from './types';

export type OrderSource = 'appareil' | 'armoire' | 'câble' | 'libre';

export interface OrderLine {
	key: string;
	source: OrderSource;
	reference: string;
	manufacturer: string;
	designation: string;
	quantity: number;
	/** « pce », « m », « barre 2 m »… */
	unit: string;
	/** Précision : repères, longueur totale, câbles sans longueur… */
	detail: string;
}

export interface OrderGroup {
	/** Fabricant (« Sans fabricant » / « À compléter » en fin de liste). */
	manufacturer: string;
	lines: OrderLine[];
}

/** Longueur d'une barre de rail oméga (mm). */
export const RAIL_BAR_MM = 2000;

export const SOURCE_LABEL: Record<OrderSource, string> = {
	appareil: 'Appareils',
	armoire: 'Armoire',
	câble: 'Câbles',
	libre: 'Divers'
};

const fmtNum = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

/** Dimension d'une goulotte : largeur × hauteur (« 40×60 »). */
export function ductSize(d: { w: number; h: number; depth: number }): string {
	return `${Math.round(Math.min(d.w, d.h))}×${Math.round(d.depth)}`;
}

/** Fiche (copie du projet) d'une référence, pour le fabricant et la désignation. */
function fiche(project: Project, reference: string | undefined) {
	return reference?.trim() ? project.catalog?.[referenceKey(reference)] : undefined;
}

export function computeOrderList(project: Project): OrderLine[] {
	const lines: OrderLine[] = [];
	const add = (line: Omit<OrderLine, 'key'> & { key?: string }) => {
		const reference = line.reference.trim();
		const f = fiche(project, reference);
		lines.push({
			...line,
			key: line.key ?? `${line.source}:${referenceKey(reference) || line.designation}`,
			reference,
			manufacturer: line.manufacturer || f?.manufacturer || '',
			designation: f?.designation || line.designation
		});
	};

	// Appareils, bornes et accessoires.
	for (const l of computeNomenclature(project))
		add({
			key: `appareil:${l.key}`,
			source: 'appareil',
			reference: l.reference,
			manufacturer: l.manufacturer,
			designation: l.designation,
			quantity: l.quantity,
			unit: 'pce',
			detail: bomTagsText(l)
		});

	// Armoire : enveloppes, rails, goulottes.
	const m = project.materials ?? {};
	let railMm = 0;
	const ducts = new Map<string, number>();
	project.folios.forEach((f) => {
		const p = f.panel;
		if (!p || p.kind !== 'implantation') return;
		const e = p.enclosure;
		add({
			key: `armoire:enveloppe:${f.id}`,
			source: 'armoire',
			reference: p.reference ?? '',
			manufacturer: '',
			designation: `Armoire ${e.w} × ${e.h} × ${e.d} mm`,
			quantity: 1,
			unit: 'pce',
			detail: f.title
		});
		for (const r of p.rails) railMm += r.length;
		for (const d of p.ducts) {
			const size = ductSize(d);
			ducts.set(size, (ducts.get(size) ?? 0) + Math.max(d.w, d.h));
		}
	});
	if (railMm > 0)
		add({
			source: 'armoire',
			reference: m.rail ?? '',
			manufacturer: '',
			designation: 'Rail oméga DIN 35 mm, barre de 2 m',
			quantity: Math.ceil(railMm / RAIL_BAR_MM),
			unit: 'barre 2 m',
			detail: `${fmtNum(railMm / 1000)} m posés`
		});
	for (const [size, mm] of [...ducts].sort((a, b) =>
		a[0].localeCompare(b[0], 'fr', { numeric: true })
	))
		add({
			key: `armoire:goulotte:${size}`,
			source: 'armoire',
			reference: m.ducts?.[size] ?? '',
			manufacturer: '',
			designation: `Goulotte ${size} mm`,
			quantity: Math.ceil(mm / 100) / 10,
			unit: 'm',
			detail: `${fmtNum(mm / 1000)} m posés`
		});

	// Borniers : 2 butées et 1 flasque d'extrémité par bornier.
	const strips = [
		...new Set(
			listDevices(project)
				.filter((d) => d.terminal)
				.map((d) => d.prefix)
		)
	];
	if (strips.length) {
		const list = strips.sort((a, b) => a.localeCompare(b, 'fr')).join(', ');
		add({
			source: 'armoire',
			reference: m.endClamp ?? '',
			manufacturer: '',
			designation: 'Butée d’arrêt pour rail',
			quantity: strips.length * 2,
			unit: 'pce',
			detail: `2 par bornier (${list})`
		});
		add({
			source: 'armoire',
			reference: m.endPlate ?? '',
			manufacturer: '',
			designation: 'Flasque d’extrémité de bornier',
			quantity: strips.length,
			unit: 'pce',
			detail: `1 par bornier (${list})`
		});
	}

	// Câbles : par référence, sinon par désignation (type, conducteurs, section).
	const cables = new Map<
		string,
		{ reference: string; designation: string; meters: number; tags: string[]; missing: string[] }
	>();
	for (const f of project.folios)
		for (const c of f.cables) {
			const designation = cableName(c);
			const key = c.reference?.trim() ? referenceKey(c.reference) : designation.toUpperCase();
			const g = cables.get(key) ?? {
				reference: c.reference?.trim() ?? '',
				designation,
				meters: 0,
				tags: [],
				missing: []
			};
			g.tags.push(c.tag);
			if (c.cableLength && c.cableLength > 0) g.meters += c.cableLength;
			else g.missing.push(c.tag);
			cables.set(key, g);
		}
	for (const [key, g] of cables)
		add({
			key: `câble:${key}`,
			source: 'câble',
			reference: g.reference,
			manufacturer: '',
			designation: g.designation,
			quantity: Math.round(g.meters * 10) / 10,
			unit: 'm',
			detail: [
				g.tags.join(', '),
				g.missing.length ? `longueur à saisir : ${g.missing.join(', ')}` : ''
			]
				.filter(Boolean)
				.join(' — ')
		});

	// Lignes libres.
	for (const x of project.orderExtras ?? [])
		add({
			key: `libre:${x.id}`,
			source: 'libre',
			reference: x.reference,
			manufacturer: x.manufacturer,
			designation: x.designation,
			quantity: x.quantity,
			unit: x.unit?.trim() || 'pce',
			detail: ''
		});

	return lines;
}

export const NO_MANUFACTURER = 'Sans fabricant';
export const TO_COMPLETE = 'À compléter (sans référence)';

/**
 * Regroupement par fabricant (ordre alphabétique), puis « Sans fabricant », puis les lignes
 * sans référence. Dans un groupe : par origine (appareils, armoire, câbles, divers) puis
 * référence.
 */
export function groupByManufacturer(lines: OrderLine[]): OrderGroup[] {
	const order: OrderSource[] = ['appareil', 'armoire', 'câble', 'libre'];
	const groups = new Map<string, OrderLine[]>();
	for (const l of lines) {
		const name = !l.reference ? TO_COMPLETE : l.manufacturer.trim() || NO_MANUFACTURER;
		const list = groups.get(name) ?? [];
		list.push(l);
		groups.set(name, list);
	}
	const rank = (name: string) => (name === TO_COMPLETE ? 2 : name === NO_MANUFACTURER ? 1 : 0);
	return [...groups]
		.sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0], 'fr'))
		.map(([manufacturer, list]) => ({
			manufacturer,
			lines: list.sort(
				(a, b) =>
					order.indexOf(a.source) - order.indexOf(b.source) ||
					a.reference.localeCompare(b.reference, 'fr', { numeric: true }) ||
					a.designation.localeCompare(b.designation, 'fr')
			)
		}));
}

/** Quantité affichée (« 2 », « 3,5 »). */
export function formatQuantity(q: number): string {
	return fmtNum(q);
}
