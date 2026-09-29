import { describe, expect, it } from 'vitest';
import { analyzeProject, projectStrips } from '$lib/model/analysis';
import { addSymbol } from '$lib/model/edit';
import { createProject } from '$lib/model/project';
import { BOM, cablesCsv, csvCell, devicesCsv, stripsCsv, toCsv, wiresCsv } from './csv';
import { pdfFileName, planDossier, safeFileName } from './dossier';
import { buildSampleProject } from './sample';

/** Lignes d'un CSV (sans BOM), cellules non échappées simples. */
const lines = (csv: string) => csv.slice(BOM.length).trimEnd().split('\r\n');

describe('csv', () => {
	it('BOM UTF-8, séparateur « ; », CRLF', () => {
		const csv = toCsv(['A', 'B'], [['é', 1]]);
		expect(csv.charCodeAt(0)).toBe(0xfeff);
		expect(csv).toBe(BOM + 'A;B\r\né;1\r\n');
	});

	it('échappe les cellules', () => {
		expect(csvCell('a;b')).toBe('"a;b"');
		expect(csvCell('dit "oui"')).toBe('"dit ""oui"""');
		expect(csvCell('l1\nl2')).toBe('"l1\nl2"');
		expect(csvCell(undefined)).toBe('');
		expect(csvCell(3)).toBe('3');
	});
});

describe('projet de démonstration', () => {
	const project = buildSampleProject();
	const analysis = analyzeProject(project);

	it('numérote des fils et produit des renvois', () => {
		const numbered = analysis.nets.nets.filter((n) => n.number);
		expect(numbered.length).toBeGreaterThanOrEqual(4);
		expect(numbered.map((n) => n.number)).toContain('01');
		expect(analysis.nets.nets.every((n) => n.shortedPotentials.length === 0)).toBe(true);

		const byTag = (tag: string) =>
			project.folios
				.flatMap((f) => f.symbols)
				.filter((s) => project.devices[s.deviceId]?.tag === tag);
		// Bobine KM1 (folio 01) : 3 contacts NO dont un sur le folio 02
		const km1 = byTag('KM1');
		const coil = km1.find((s) => s.defId === 'bobine-contacteur')!;
		expect(analysis.crossRefs.get(coil.id)?.table?.no).toHaveLength(3);
		expect(analysis.crossRefs.get(coil.id)?.table?.no.some((r) => r.startsWith('02 - '))).toBe(
			true
		);
		// Contact KA1 (folio 01) → bobine KA1 (folio 02)
		const ka1Contact = byTag('KA1').find((s) => s.defId === 'contact-no')!;
		expect(analysis.crossRefs.get(ka1Contact.id)?.refs?.[0]).toMatch(/^02 - /);
		// Renvoi de fil R1 : sortie folio 01 ↔ arrivée folio 02, même numéro de fil
		const [out, inn] = byTag('R1');
		expect(analysis.crossRefs.get(out.id)?.refs?.[0]).toMatch(/^02 - /);
		expect(analysis.crossRefs.get(inn.id)?.refs?.[0]).toMatch(/^01 - /);
		const netOut = analysis.nets.netOfTerminal.get(`${out.id}:1`);
		expect(netOut?.number).toBeTruthy();
		expect(analysis.nets.netOfTerminal.get(`${inn.id}:1`)).toBe(netOut);
	});

	it('génère les borniers P et C', () => {
		const strips = projectStrips(project, analysis);
		expect(strips.map((s) => s.prefix)).toEqual(['C', 'P']);
		const p1 = strips[1].rows.find((r) => r.tag === 'P1')!;
		expect(p1.inside).toEqual(['KM1:14']);
		expect(p1.outside).toEqual(['H1:X1']);
		expect(strips[1].rows.find((r) => r.tag === 'P2')?.wire).toBe('Neutre');
	});

	it('stripsCsv', () => {
		const l = lines(stripsCsv(project, analysis));
		expect(l[0]).toBe(
			'Bornier;Repère;N° fil / potentiel;Intérieur;Extérieur;Câble;Position;Désignation'
		);
		expect(l).toHaveLength(1 + 4);
		expect(l.find((x) => x.startsWith('P;P1;'))).toMatch(
			/;KM1:14;H1:X1;W1 Marron;01 - C;Alimentation chaudière$/
		);
	});

	it('cablesCsv : une ligne par conducteur', () => {
		const l = lines(cablesCsv(project, analysis));
		expect(l).toEqual([
			'Câble;Type;Désignation;Conducteur;Couleur;N° fil / potentiel;Position',
			'W1;U1000 R2V;CABLE U1000 R2V 2X1,5;1;Bleu;Neutre;01 - B',
			'W1;U1000 R2V;CABLE U1000 R2V 2X1,5;2;Marron;01;01 - B'
		]);
	});

	it('devicesCsv : appareils triés, sans renvois', () => {
		const l = lines(devicesCsv(project));
		expect(l[0]).toBe('Repère;Désignation;Valeur;Référence;Fabricant;Nombre de symboles;Positions');
		const tags = l.slice(1).map((x) => x.split(';')[0]);
		expect(tags).toEqual(['C1', 'C2', 'H1', 'H2', 'H3', 'KA1', 'KM1', 'P1', 'P2']);
		const km1 = l.find((x) => x.startsWith('KM1;'))!.split(';');
		expect(km1[3]).toBe('LC1K0910B7');
		expect(km1[5]).toBe('4');
		expect(km1[6]).toMatch(/^"?01 - /);
	});

	it('wiresCsv : numéros puis potentiels, bornes raccordées', () => {
		const l = lines(wiresCsv(project, analysis));
		expect(l[0]).toBe('N° fil / potentiel;Couleur;Folios;Bornes raccordées');
		const first = l[1].split(';');
		expect(first[0]).toBe('01');
		expect(first[3]).toBe('H1:X1, KM1:14, P1');
		// ordre de marche : présent sur les deux folios (renvoi)
		expect(l.some((x) => /^\d+;;01, 02;/.test(x) && x.includes('KM1:A1'))).toBe(true);
		expect(l.some((x) => x.startsWith('Neutre;Bleu;01'))).toBe(true);
	});

	it('plan du dossier et numérotation', () => {
		const plan = planDossier(project, analysis, { cover: true, strips: true });
		expect(plan.stripPages).toHaveLength(1);
		expect(plan.entries.map((e) => `${e.number} ${e.title}`)).toEqual([
			'01 CHAUDIERE 1',
			'02 COMMANDE CHAUFFE',
			'03 BORNIERS'
		]);
		expect(plan.folioCount).toBe(3);
		expect(plan.totalPages).toBe(4);
		const bare = planDossier(project, analysis, { cover: false, strips: false });
		expect([bare.folioCount, bare.totalPages, bare.stripPages.length]).toEqual([2, 2, 0]);
	});
});

describe('noms de fichiers', () => {
	it('pdfFileName', () => {
		const p = createProject('ESSIQUE 86 LGTS');
		expect(pdfFileName(p.meta)).toBe('schema ESSIQUE 86 LGTS.pdf');
		p.meta.planNumber = 'DW261136';
		p.meta.name = 'Chaufferie A/B : "RDC"';
		expect(pdfFileName(p.meta)).toBe('DW261136 Chaufferie A_B _ _RDC_.pdf');
		expect(safeFileName('  a  b. ')).toBe('a b');
	});

	it('projet vide : CSV avec seulement les en-têtes', () => {
		const p = createProject('Vide');
		addSymbol(p, p.folios[0], 'voyant', { x: 100, y: 100 });
		const a = analyzeProject(p);
		expect(lines(stripsCsv(p, a))).toHaveLength(1);
		expect(lines(wiresCsv(p, a))).toHaveLength(1);
		expect(lines(devicesCsv(p))).toHaveLength(2);
	});
});
