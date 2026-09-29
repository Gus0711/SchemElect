import { describe, expect, it } from 'vitest';
import { analyzeProject, projectStrips } from './analysis';
import { addStripsFolio, addSymbol } from './edit';
import { duplicateFolio } from './fragments';
import { createProject, migrateProject } from './project';
import {
	columnX,
	boxTop,
	layoutStripPages,
	PER_BAND,
	SD,
	stripFolioPage,
	stripSeriesIssues,
	stripTerminalAt
} from './stripDrawing';
import type { StripRow, TerminalStrip } from './strips';

const row = (tag: string): StripRow => ({
	symbolId: `s-${tag}`,
	tag,
	wire: '',
	inside: [],
	outside: [],
	cable: [],
	position: '01 - A',
	designation: ''
});
const strip = (prefix: string, n: number): TerminalStrip => ({
	prefix,
	rows: Array.from({ length: n }, (_, i) => row(`${prefix}${i + 1}`))
});

describe('mise en page du dessin des borniers', () => {
	it('les petits borniers partagent un bandeau', () => {
		const pages = layoutStripPages([strip('C', 2), strip('P', 6)]);
		expect(pages).toHaveLength(1);
		expect(pages[0].bands).toHaveLength(1);
		const [c, p] = pages[0].bands[0].segments;
		expect(c.col).toBe(0);
		expect(p.col).toBe(2 + SD.gap);
	});

	it('un long bornier continue sur le bandeau suivant, puis sur une autre page', () => {
		const n = PER_BAND * 2 + 5;
		const pages = layoutStripPages([strip('X', n)]);
		expect(pages).toHaveLength(2);
		const segs = pages.flatMap((p) => p.bands.flatMap((b) => b.segments));
		expect(segs.map((s) => s.rows.length)).toEqual([PER_BAND, PER_BAND, 5]);
		expect(segs.map((s) => s.continued)).toEqual([false, true, true]);
	});

	it('retrouve la borne sous le curseur', () => {
		const [page] = layoutStripPages([strip('P', 3)]);
		const r = stripTerminalAt(page, { x: columnX(1), y: boxTop(0) + 5 });
		expect(r?.tag).toBe('P2');
		expect(stripTerminalAt(page, { x: columnX(10), y: boxTop(0) + 5 })).toBeNull();
	});
});

describe('folios borniers', () => {
	function project(nP: number) {
		const p = createProject('Borniers');
		for (let i = 0; i < nP; i++) addSymbol(p, p.folios[0], 'borne-p', { x: 20 + i * 2.5, y: 50 });
		addSymbol(p, p.folios[0], 'borne-c', { x: 200, y: 50 });
		return p;
	}

	it('série : un folio par page, contrôle s’il manque la suite', () => {
		const p = project(PER_BAND * SD.bandsPerPage + 3);
		const f = addStripsFolio(p, 0);
		const strips = projectStrips(p, analyzeProject(p));
		expect(stripFolioPage(p, f, strips)).toMatchObject({ index: 0, folios: 1, pages: 2 });
		expect(stripSeriesIssues(p, strips)).toHaveLength(1);
		const suite = duplicateFolio(p, f.id)!;
		expect(suite.strips).toEqual({ prefixes: [] });
		const s2 = stripFolioPage(p, suite, strips);
		expect(s2.index).toBe(1);
		expect(s2.page?.bands[0].segments[0].continued).toBe(true);
		expect(stripSeriesIssues(p, strips)).toEqual([]);
	});

	it('filtre par bornier ; relu depuis la base', () => {
		const p = project(3);
		const f = addStripsFolio(p, 0, ['C']);
		const strips = projectStrips(p, analyzeProject(p));
		const segs = stripFolioPage(p, f, strips).page!.bands[0].segments;
		expect(segs.map((s) => s.prefix)).toEqual(['C']);
		const back = migrateProject(JSON.parse(JSON.stringify(p)));
		expect(back.folios[1].strips).toEqual({ prefixes: ['C'] });
		// Les folios borniers n'ont ni symboles ni fils : l'analyse électrique est inchangée.
		expect(back.folios[1].symbols).toEqual([]);
	});
});
