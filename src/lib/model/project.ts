import { normalizeCatalogItem, referenceKey, type CatalogItem } from './catalog';
import { deepClone, newId } from './ids';
import { AREA } from './layout';
import { normalizeTemplate } from './template';
import { SCHEMA_VERSION, type Bar, type Folio, type Potential, type Project } from './types';

/** Potentiels usuels d'une armoire GTB (repris de l'exemple WinRelais). */
export function defaultPotentials(): Potential[] {
	return [
		{ id: 'L1', name: 'Phase 1', wireColor: 'Marron', stroke: '#8a4b16' },
		{ id: 'L2', name: 'Phase 2', wireColor: 'Noir', stroke: '#1a1a1a' },
		{ id: 'L3', name: 'Phase 3', wireColor: 'Rouge', stroke: '#e0241b' },
		{ id: 'N', name: 'Neutre', wireColor: 'Bleu', stroke: '#1f4fe0' },
		{ id: 'PE', name: 'Terre', wireColor: 'Vert/Jaune', stroke: '#2e9e3c' },
		{ id: '24V', name: '24V / Commande', wireColor: 'Violet', stroke: '#a24bc8' },
		{ id: '0V', name: '0V / Commun', wireColor: 'Blanc', stroke: '#1f4fe0', dashed: true }
	];
}

export function createFolio(title = 'Nouveau folio'): Folio {
	return {
		id: newId('f'),
		title,
		symbols: [],
		wires: [],
		bars: [],
		texts: [],
		rects: [],
		cables: []
	};
}

export function createBar(potentialId: string, y: number): Bar {
	return { id: newId('b'), potentialId, y, x1: AREA.x + 5, x2: AREA.x + AREA.w - 5 };
}

export function createProject(name: string, author = ''): Project {
	const now = new Date().toISOString();
	const first = createFolio('DISTRIBUTION');
	return {
		schemaVersion: SCHEMA_VERSION,
		meta: {
			name,
			affaireNumber: '',
			planNumber: '',
			client: '',
			company: 'S.A.R.L DUMORTIER',
			companyAddress: 'ZAC LE CHATEAU 02800 CHARMES',
			author,
			createdAt: now,
			modifiedAt: now
		},
		revisions: [],
		potentials: defaultPotentials(),
		devices: {},
		folios: [first],
		settings: { wireNumberDigits: 2, wireNumberStart: 1 },
		customSymbols: {}
	};
}

/**
 * Normalise un document chargé (champs manquants, versions antérieures).
 * Point d'entrée unique pour les migrations de format.
 */
export function migrateProject(raw: unknown): Project {
	const p = deepClone(raw) as Partial<Project> & Record<string, unknown>;
	if (!p || typeof p !== 'object') throw new Error('Document projet invalide');
	const base = createProject(String(p.meta?.name ?? 'Projet'));
	const project: Project = {
		schemaVersion: SCHEMA_VERSION,
		meta: { ...base.meta, ...(p.meta ?? {}) },
		revisions: p.revisions ?? [],
		potentials: p.potentials?.length ? p.potentials : base.potentials,
		devices: p.devices ?? {},
		folios: (p.folios?.length ? p.folios : base.folios).map((f) => ({
			...createFolio(f.title),
			...f,
			...(f.panel
				? {
						panel: {
							...f.panel,
							rails: f.panel.rails ?? [],
							ducts: f.panel.ducts ?? [],
							items: f.panel.items ?? []
						}
					}
				: {})
		})),
		settings: { ...base.settings, ...(p.settings ?? {}) },
		customSymbols: p.customSymbols ?? {}
	};
	const template = p.template ? normalizeTemplate(p.template) : null;
	if (template) project.template = template;
	if (p.materials && typeof p.materials === 'object') project.materials = p.materials;
	if (Array.isArray(p.orderExtras) && p.orderExtras.length) project.orderExtras = p.orderExtras;
	if (p.catalog && typeof p.catalog === 'object') {
		const catalog: Record<string, CatalogItem> = {};
		for (const raw of Object.values(p.catalog)) {
			const item = normalizeCatalogItem(raw);
			if (item) catalog[referenceKey(item.reference)] = item;
		}
		if (Object.keys(catalog).length) project.catalog = catalog;
	}
	return project;
}
