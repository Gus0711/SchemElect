import { describe, expect, it } from 'vitest';
import { analyzeProject } from './analysis';
import {
	applyCatalogUpdates,
	assignReference,
	catalogUpdates,
	deviceContacts,
	findCatalogItem,
	importCatalogCsv,
	normalizeCatalogItem,
	parseCsv,
	parseMounting,
	referenceKey,
	type CatalogItem
} from './catalog';
import { contactOverflows } from './crossrefs';
import { addSymbol, setSymbolTag } from './edit';
import { deviceFootprint } from './footprints';
import { extractFragment, insertFragment } from './fragments';
import { createProject, migrateProject } from './project';
import { compressTags, computeNomenclature } from './nomenclature';
import { listDevices, searchProject } from './inventory';
import { STARTER_CATALOG } from './catalogStarter';

const LC1D09: CatalogItem = {
	id: 'c1',
	reference: 'LC1D09B7',
	manufacturer: 'Schneider Electric',
	designation: 'Contacteur TeSys D 3P 9 A, bobine 24 V CA',
	category: 'Contacteur',
	contacts: { no: 1, nc: 1 },
	w: 45,
	h: 77,
	mounting: 'rail'
};

function setup() {
	const project = createProject('Test');
	return { project, folio: project.folios[0] };
}

describe('catalogue : fiches', () => {
	it('compare les références sans espaces, points ni casse', () => {
		expect(referenceKey('4 067 71')).toBe(referenceKey('406771'));
		expect(referenceKey('lc1d09b7')).toBe('LC1D09B7');
		expect(referenceKey('40.52.8.024.0000')).toBe('405280240000');
		expect(findCatalogItem([LC1D09], 'lc1-d09 b7')?.id).toBe('c1');
		expect(findCatalogItem([LC1D09], '')).toBeUndefined();
	});

	it('normalise une fiche reçue', () => {
		expect(normalizeCatalogItem({ reference: '  ' })).toBeNull();
		const it = normalizeCatalogItem({
			reference: ' GV2ME08 ',
			manufacturer: 'Schneider',
			contacts: { no: '1', nc: '' },
			w: '44,5',
			h: 89,
			mounting: 'Rail DIN'
		})!;
		expect(it.reference).toBe('GV2ME08');
		expect(it.contacts).toEqual({ no: 1, nc: 0 });
		expect(it.w).toBe(44.5);
		expect(it.mounting).toBe('rail');
		expect(it.id).toBe('cat_gv2me08');
	});

	it('lit les montages saisis librement', () => {
		expect(parseMounting('Façade')).toBe('porte');
		expect(parseMounting('hors armoire')).toBe('externe');
		expect(parseMounting('rail')).toBe('rail');
		expect(parseMounting('?')).toBeUndefined();
	});
});

describe('catalogue : import CSV', () => {
	it('découpe un CSV Excel (; guillemets, BOM)', () => {
		expect(parseCsv('﻿a;b\r\n"x;y";"il dit ""oui"""\r\n')).toEqual([
			['a', 'b'],
			['x;y', 'il dit "oui"']
		]);
		expect(parseCsv('a\tb\nc\td')).toEqual([
			['a', 'b'],
			['c', 'd']
		]);
	});

	it('reconnaît les colonnes, ignore les lignes sans référence, dédoublonne', () => {
		const csv = [
			'Réf.;Marque;Libellé;Famille;Contacts NO;Contacts NC;Largeur (mm);Hauteur (mm);Montage;Prix',
			'LC1D09B7;Schneider;Contacteur 9A;Contacteur;1;1;45;77;Rail;12',
			';Schneider;sans réf;;;;;;;',
			'lc1d09b7;Schneider;Contacteur 9 A (corrigé);Contacteur;1;1;45;77;rail;12'
		].join('\n');
		const res = importCatalogCsv(csv);
		expect(res.items).toHaveLength(1);
		expect(res.items[0].designation).toBe('Contacteur 9 A (corrigé)');
		expect(res.items[0].contacts).toEqual({ no: 1, nc: 1 });
		expect(res.skipped).toEqual([{ line: 3, reason: 'Référence vide' }]);
		expect(res.unknownColumns).toEqual(['Prix']);
	});

	it('refuse un fichier sans colonne Référence', () => {
		const res = importCatalogCsv('Nom;Prix\nA;1');
		expect(res.items).toHaveLength(0);
		expect(res.skipped[0].line).toBe(1);
	});
});

describe('catalogue : appareils du projet', () => {
	it('recopie la fiche dans le projet, reprend le fabricant et nettoie', () => {
		const { project, folio } = setup();
		const km = addSymbol(project, folio, 'bobine-contacteur', { x: 100, y: 50 });
		const item = assignReference(project, km.deviceId, 'lc1d09b7', [LC1D09]);
		const d = project.devices[km.deviceId];
		expect(item?.id).toBe('c1');
		expect(d.reference).toBe('LC1D09B7');
		expect(d.manufacturer).toBe('Schneider Electric');
		expect(project.catalog?.LC1D09B7.designation).toContain('TeSys');
		// Référence hors catalogue : la copie inutile est retirée, le fabricant aussi.
		assignReference(project, km.deviceId, 'XYZ', [LC1D09]);
		expect(d.reference).toBe('XYZ');
		expect(d.manufacturer).toBeUndefined();
		expect(project.catalog).toEqual({});
	});

	it('garde un fabricant saisi à la main', () => {
		const { project, folio } = setup();
		const km = addSymbol(project, folio, 'bobine-contacteur', { x: 100, y: 50 });
		project.devices[km.deviceId].manufacturer = 'Telemecanique';
		assignReference(project, km.deviceId, 'LC1D09B7', [LC1D09]);
		expect(project.devices[km.deviceId].manufacturer).toBe('Telemecanique');
	});

	it('déduit les contacts disponibles de la fiche (alerte de dépassement)', () => {
		const { project, folio } = setup();
		const km = addSymbol(project, folio, 'bobine-contacteur', { x: 200, y: 50 });
		for (const x of [40, 60]) {
			const c = addSymbol(project, folio, 'contact-no', { x, y: 50 });
			setSymbolTag(project, c, 'KM1');
		}
		assignReference(project, km.deviceId, 'LC1D09B7', [LC1D09]);
		expect(deviceContacts(project, project.devices[km.deviceId])).toEqual({ no: 1, nc: 1 });
		const a = analyzeProject(project);
		expect(a.crossRefs.get(km.id)?.usage?.overflowNo).toBe(true);
		expect(contactOverflows(project, a.crossRefs)[0].avail).toEqual({ no: 1, nc: 1 });
		// Saisie sur l'appareil : prime sur la fiche.
		project.devices[km.deviceId].contacts = { no: 4, nc: 0 };
		expect(analyzeProject(project).crossRefs.get(km.id)?.usage?.overflowNo).toBe(false);
	});

	it('donne l’encombrement de la fiche à l’implantation', () => {
		const { project, folio } = setup();
		const km = addSymbol(project, folio, 'bobine-contacteur', { x: 100, y: 50 });
		expect(deviceFootprint(project, km.deviceId).h).toBe(75);
		assignReference(project, km.deviceId, 'LC1D09B7', [LC1D09]);
		expect(deviceFootprint(project, km.deviceId)).toEqual({ mounting: 'rail', w: 45, h: 77 });
		// Montage imposé sur l'appareil : taille usuelle du nouveau montage.
		project.devices[km.deviceId].mounting = 'porte';
		expect(deviceFootprint(project, km.deviceId).mounting).toBe('porte');
	});

	it('signale les fiches modifiées dans la bibliothèque et les recopie', () => {
		const { project, folio } = setup();
		const km = addSymbol(project, folio, 'bobine-contacteur', { x: 100, y: 50 });
		assignReference(project, km.deviceId, 'LC1D09B7', [LC1D09]);
		expect(catalogUpdates(project, [LC1D09])).toEqual([]);
		const changed = { ...LC1D09, designation: 'Nouveau libellé', manufacturer: 'Schneider' };
		expect(catalogUpdates(project, [changed])).toHaveLength(1);
		expect(applyCatalogUpdates(project, [changed])).toBe(1);
		expect(project.catalog?.LC1D09B7.designation).toBe('Nouveau libellé');
		expect(project.devices[km.deviceId].manufacturer).toBe('Schneider');
	});

	it('survit à la migration et voyage avec le copier / coller', () => {
		const { project, folio } = setup();
		const km = addSymbol(project, folio, 'bobine-contacteur', { x: 100, y: 50 });
		assignReference(project, km.deviceId, 'LC1D09B7', [LC1D09]);
		const again = migrateProject(JSON.parse(JSON.stringify(project)));
		expect(again.catalog?.LC1D09B7.w).toBe(45);
		expect(migrateProject({ ...project, catalog: undefined }).catalog).toBeUndefined();

		const frag = extractFragment(project, folio, [{ kind: 'symbol', id: km.id }]);
		const other = createProject('Autre');
		insertFragment(other, other.folios[0], frag, { devices: 'renumber' });
		expect(other.catalog?.LC1D09B7.designation).toContain('TeSys');
	});
});

describe('nomenclature', () => {
	it('compacte les repères consécutifs', () => {
		expect(compressTags(['KA3', 'KA1', 'KA2', 'KA4', 'KA7'])).toBe('KA1 à KA4, KA7');
		expect(compressTags(['Q1', 'Q2', 'KM1'])).toBe('KM1, Q1, Q2');
		expect(compressTags(['P1', 'P2', 'P3', 'X1'])).toBe('P1 à P3, X1');
	});

	it('regroupe par référence, puis les appareils sans référence par préfixe', () => {
		const { project, folio } = setup();
		const k1 = addSymbol(project, folio, 'bobine-contacteur', { x: 100, y: 50 });
		const k2 = addSymbol(project, folio, 'bobine-contacteur', { x: 150, y: 50 });
		addSymbol(project, folio, 'bobine-contacteur', { x: 200, y: 50 });
		// Contact de KM1 : ne compte pas comme un appareil de plus.
		const c = addSymbol(project, folio, 'contact-no', { x: 40, y: 80 });
		setSymbolTag(project, c, 'KM1');
		for (const x of [40, 50, 60]) addSymbol(project, folio, 'borne-p', { x, y: 150 });
		addSymbol(project, folio, 'renvoi-sortie', { x: 250, y: 150 });
		assignReference(project, k1.deviceId, 'LC1D09B7', [LC1D09]);
		assignReference(project, k2.deviceId, 'lc1d09b7', [LC1D09]);

		const bom = computeNomenclature(project);
		expect(bom.map((l) => [l.reference, l.quantity, l.tags.join(',')])).toEqual([
			['LC1D09B7', 2, 'KM1,KM2'],
			['', 1, 'KM3'],
			['', 3, 'P1,P2,P3']
		]);
		expect(bom[0].designation).toContain('TeSys');
		expect(bom[0].manufacturer).toBe('Schneider Electric');
		expect(bom[2].designation).toBe('Bornes P');
		expect(bom[1].referenced).toBe(false);
	});
});

describe('inventaire et recherche', () => {
	it('liste les appareils physiques avec leurs emplacements et problèmes', () => {
		const { project, folio } = setup();
		const km = addSymbol(project, folio, 'bobine-contacteur', { x: 200, y: 50 });
		const c = addSymbol(project, folio, 'contact-no', { x: 40, y: 50 });
		setSymbolTag(project, c, 'KM1');
		addSymbol(project, folio, 'borne-p', { x: 60, y: 150 });
		addSymbol(project, folio, 'renvoi-sortie', { x: 250, y: 150 });
		const list = listDevices(project, analyzeProject(project));
		expect(list.map((d) => d.tag)).toEqual(['KM1', 'P1']);
		const k = list[0];
		expect(k.mainSymbolId).toBe(km.id);
		expect(k.placements.map((p) => p.symbolId)).toEqual([c.id, km.id]);
		expect(k.issues).toEqual(['no-reference']);
		// Une borne sans référence n'est pas signalée.
		expect(list[1].terminal).toBe(true);
		expect(list[1].issues).toEqual([]);
	});

	it('cherche repères, références, fils, folios et textes', () => {
		const { project, folio } = setup();
		folio.title = 'CHAUDIERE 1';
		const km = addSymbol(project, folio, 'bobine-contacteur', { x: 200, y: 50 });
		project.devices[km.deviceId].designation = 'Pompe chaudière';
		assignReference(project, km.deviceId, 'LC1D09B7', [LC1D09]);
		addSymbol(project, folio, 'bobine-contacteur', { x: 220, y: 50 });
		folio.texts.push({ id: 't1', x: 50, y: 50, text: 'Vers chaudière', size: 2.5 });
		const a = analyzeProject(project);

		const km1 = searchProject(project, a, 'km1');
		expect(km1[0]).toMatchObject({ kind: 'device', label: 'KM1', item: { id: km.id } });
		expect(searchProject(project, a, 'KM').map((h) => h.label)).toEqual(['KM1', 'KM2']);
		expect(searchProject(project, a, 'lc1 d09')[0].label).toBe('KM1');
		const ch = searchProject(project, a, 'chaudiere').map((h) => h.kind);
		expect(ch).toEqual(['folio', 'device', 'text']);
		expect(searchProject(project, a, '01')[0].kind).toBe('folio');
		expect(searchProject(project, a, '   ')).toEqual([]);
	});
});

describe('catalogue de départ', () => {
	it('fiches valides, références uniques, toutes marquées à vérifier', () => {
		const items = STARTER_CATALOG.map((s) => normalizeCatalogItem(s));
		expect(items.every(Boolean)).toBe(true);
		const keys = items.map((i) => referenceKey(i!.reference));
		expect(new Set(keys).size).toBe(keys.length);
		expect(items.every((i) => i!.notes?.includes('à vérifier'))).toBe(true);
		expect(findCatalogItem(items as CatalogItem[], 'A9F74210')?.designation).toBe(
			'Disjoncteur Acti9 iC60N 2P C10'
		);
	});
});
