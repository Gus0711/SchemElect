/**
 * Renvois croisés :
 * - sous un contact / pôle (slave) : position « FF - C » de son master (bobine…) ;
 * - sous un master : tableau NO | NC des positions de ses contacts ;
 * - sur un renvoi de fil (link) : position des autres renvois de même repère.
 */
import { getSymbolDef } from '$lib/symbols';
import { folioRef } from './layout';
import type { Id, Project, SymbolInstance } from './types';

export interface CrossRef {
	/** Texte sous un slave ou un link. */
	refs?: string[];
	/** Tableau sous un master. */
	table?: { no: string[]; nc: string[] };
	/**
	 * Master : contacts auxiliaires dessinés (hors pôles) et dépassement éventuel des
	 * contacts disponibles déclarés sur l'appareil (`Device.contacts`).
	 */
	usage?: { no: number; nc: number; overflowNo: boolean; overflowNc: boolean };
}

interface Placed {
	s: SymbolInstance;
	folioIndex: number;
}

const refOf = (p: Placed) => folioRef(p.folioIndex, p.s.x);

export function computeCrossRefs(project: Project): Map<Id, CrossRef> {
	const byDevice = new Map<Id, Placed[]>();
	project.folios.forEach((f, folioIndex) => {
		for (const s of f.symbols) {
			const list = byDevice.get(s.deviceId) ?? [];
			list.push({ s, folioIndex });
			byDevice.set(s.deviceId, list);
		}
	});

	const out = new Map<Id, CrossRef>();
	for (const placed of byDevice.values()) {
		const sorted = placed.sort(
			(a, b) => a.folioIndex - b.folioIndex || a.s.x - b.s.x || a.s.y - b.s.y
		);
		const role = (p: Placed) => getSymbolDef(p.s.defId).role;

		const master = sorted.find((p) => role(p) === 'master');
		const slaves = sorted.filter((p) => role(p) === 'slave');
		if (master) {
			const table = { no: [] as string[], nc: [] as string[] };
			let no = 0,
				nc = 0;
			for (const sl of slaves) {
				const kind = getSymbolDef(sl.s.defId).contactKind ?? 'no';
				if (kind === 'nc') {
					table.nc.push(refOf(sl));
					nc++;
				} else if (kind === 'co') {
					// Un inverseur occupe un contact NO et un contact NC.
					table.no.push(refOf(sl));
					table.nc.push(refOf(sl));
					no++;
					nc++;
				} else {
					table.no.push(refOf(sl));
					if (kind === 'no') no++;
				}
			}
			const avail = project.devices[master.s.deviceId]?.contacts;
			out.set(master.s.id, {
				table,
				usage: {
					no,
					nc,
					overflowNo: !!avail && no > avail.no,
					overflowNc: !!avail && nc > avail.nc
				}
			});
			for (const sl of slaves) out.set(sl.s.id, { refs: [refOf(master)] });
		}

		const links = sorted.filter((p) => role(p) === 'link');
		for (const l of links) {
			const others = links.filter((o) => o !== l).map(refOf);
			out.set(l.s.id, { refs: others });
		}
	}
	return out;
}

/** Appareils dont les contacts dessinés dépassent les contacts disponibles. */
export function contactOverflows(
	project: Project,
	crossRefs: Map<Id, CrossRef>
): { deviceId: Id; tag: string; no: number; nc: number; avail: { no: number; nc: number } }[] {
	const out = [];
	for (const f of project.folios)
		for (const s of f.symbols) {
			const u = crossRefs.get(s.id)?.usage;
			const d = project.devices[s.deviceId];
			if (u && d?.contacts && (u.overflowNo || u.overflowNc))
				out.push({ deviceId: d.id, tag: d.tag, no: u.no, nc: u.nc, avail: d.contacts });
		}
	return out;
}

export interface CrossTarget {
	symbolId: Id;
	/** Position « FF - C ». */
	ref: string;
	kind: 'renvoi' | 'master' | 'contact';
}

/**
 * Destinations de navigation depuis un symbole : renvois de même repère (link),
 * master d'un contact (slave), contacts d'un master. Ordre du dossier.
 */
export function crossTargets(project: Project, symbolId: Id): CrossTarget[] {
	const placed: Placed[] = [];
	let self: Placed | undefined;
	project.folios.forEach((f, folioIndex) => {
		for (const s of f.symbols) {
			if (s.id === symbolId) self = { s, folioIndex };
			placed.push({ s, folioIndex });
		}
	});
	if (!self) return [];
	const me = self;
	const role = getSymbolDef(me.s.defId).role;
	const siblings = placed
		.filter((p) => p.s.deviceId === me.s.deviceId && p.s.id !== me.s.id && me.s.deviceId)
		.sort((a, b) => a.folioIndex - b.folioIndex || a.s.x - b.s.x || a.s.y - b.s.y);
	const roleOf = (p: Placed) => getSymbolDef(p.s.defId).role;
	const to = (p: Placed, kind: CrossTarget['kind']): CrossTarget => ({
		symbolId: p.s.id,
		ref: refOf(p),
		kind
	});
	if (role === 'link')
		return siblings.filter((p) => roleOf(p) === 'link').map((p) => to(p, 'renvoi'));
	if (role === 'slave')
		return siblings.filter((p) => roleOf(p) === 'master').map((p) => to(p, 'master'));
	if (role === 'master')
		return siblings.filter((p) => roleOf(p) === 'slave').map((p) => to(p, 'contact'));
	return [];
}
