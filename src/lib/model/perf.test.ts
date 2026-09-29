import { describe, expect, it } from 'vitest';
import { analyzeProject } from './analysis';
import { addBar, addFolio, addSymbol, addWire, moveItems } from './edit';
import { createProject } from './project';
import { symbolTerminals } from './symbolGeometry';

/** Dossier réaliste : 30 folios × 20 circuits (voyant + contact) = 1 200 symboles, 1 800 fils. */
function bigProject() {
	const project = createProject('Perf');
	for (let i = 1; i < 30; i++) addFolio(project, i - 1, `F${i}`);
	for (const folio of project.folios) {
		addBar(folio, 'L1', 30);
		addBar(folio, 'N', 180);
		for (let c = 0; c < 20; c++) {
			const x = 25 + c * 12.5;
			const k = addSymbol(project, folio, 'contact-no', { x, y: 50 });
			const h = addSymbol(project, folio, 'voyant', { x, y: 100 });
			const [k1, k2] = symbolTerminals(k);
			const [h1, h2] = symbolTerminals(h);
			addWire(folio, [{ x, y: 30 }, k1]);
			addWire(folio, [k2, h1]);
			addWire(folio, [h2, { x, y: 180 }]);
		}
	}
	return project;
}

describe('performances', () => {
	it('analyse un dossier de 1 200 symboles assez vite pour un glisser fluide', () => {
		const project = bigProject();
		const t0 = performance.now();
		const a = analyzeProject(project);
		const dt = performance.now() - t0;
		expect(a.nets.nets.filter((n) => n.number).length).toBe(600);
		// Budget large (machine de CI) ; en pratique ~quelques dizaines de ms.
		expect(dt).toBeLessThan(1000);
		console.log(`analyzeProject 1200 symboles : ${dt.toFixed(1)} ms`);
	});

	it('déplace une sélection rapidement', () => {
		const project = bigProject();
		const folio = project.folios[0];
		const refs = folio.symbols.slice(0, 10).map((s) => ({ kind: 'symbol' as const, id: s.id }));
		const t0 = performance.now();
		for (let i = 0; i < 20; i++) moveItems(folio, refs, 2.5, 0);
		expect(performance.now() - t0).toBeLessThan(500);
	});
});
