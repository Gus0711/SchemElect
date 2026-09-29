/**
 * Borniers générés depuis les bornes dessinées (symboles de rôle `terminal`).
 * Un bornier = toutes les bornes de même préfixe (P, C, X…), triées par numéro.
 * Côté intérieur / extérieur : appareils câblés directement (par fils) sur la borne
 * haute / basse du symbole de borne. Colonne « Câble » : conducteurs de câble portés par
 * l'équipotentielle de la borne (« W1 P1 Ciel »).
 */
import { getSymbolDef } from '$lib/symbols';
import { netCableLabels, type CableAnalysis } from './cables';
import { folioRef } from './layout';
import { directlyConnected, type NetAnalysis } from './nets';
import { symbolTerminals } from './symbolGeometry';
import { compareTags, parseTag } from './tags';
import type { Id, Project, SymbolInstance } from './types';

export interface StripRow {
	symbolId: Id;
	tag: string;
	/** Numéro de fil ou nom du potentiel. */
	wire: string;
	inside: string[];
	outside: string[];
	/** Conducteurs de câble (« W1 P1 Ciel »). */
	cable: string[];
	position: string;
	designation: string;
}

export interface TerminalStrip {
	prefix: string;
	rows: StripRow[];
}

export function computeStrips(
	project: Project,
	nets: NetAnalysis,
	cables?: CableAnalysis
): TerminalStrip[] {
	const symbolById = new Map<Id, { s: SymbolInstance; folioIndex: number }>();
	project.folios.forEach((f, folioIndex) =>
		f.symbols.forEach((s) => symbolById.set(s.id, { s, folioIndex }))
	);
	const potName = new Map(project.potentials.map((p) => [p.id, p.name]));

	const strips = new Map<string, StripRow[]>();
	for (const { s, folioIndex } of symbolById.values()) {
		const def = getSymbolDef(s.defId);
		if (def.role !== 'terminal') continue;
		const device = project.devices[s.deviceId];
		if (!device) continue;
		const net = nets.netOfTerminal.get(`${s.id}:${def.terminals[0]?.id}`);
		// Côté intérieur = ce qui est câblé sur la 1re borne (haut), extérieur = sur la 2e (bas).
		const folio = project.folios[folioIndex];
		const side = (terminalIndex: number) => {
			const t = symbolTerminals(s)[terminalIndex];
			if (!t) return [];
			const labels = directlyConnected(folio, t, s.id)
				.filter((c) => {
					const role = getSymbolDef(symbolById.get(c.symbolId)!.s.defId).role;
					return role !== 'link' && role !== 'terminal';
				})
				.map(
					(c) =>
						`${project.devices[symbolById.get(c.symbolId)!.s.deviceId]?.tag ?? '?'}:${c.terminalId}`
				);
			return [...new Set(labels)];
		};
		const inside = side(0);
		const outside = side(1);
		const prefix = parseTag(device.tag).prefix || def.prefix;
		const rows = strips.get(prefix) ?? [];
		rows.push({
			symbolId: s.id,
			tag: device.tag,
			wire: net?.number ?? (net?.potentialId ? (potName.get(net.potentialId) ?? '') : ''),
			inside,
			outside,
			cable: cables ? netCableLabels(nets, cables, net?.id) : [],
			position: folioRef(folioIndex, s.x),
			designation: device.designation ?? ''
		});
		strips.set(prefix, rows);
	}
	return [...strips.entries()]
		.sort(([a], [b]) => a.localeCompare(b, 'fr'))
		.map(([prefix, rows]) => ({ prefix, rows: rows.sort((a, b) => compareTags(a.tag, b.tag)) }));
}
