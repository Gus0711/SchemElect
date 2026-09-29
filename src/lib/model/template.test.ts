import { describe, expect, it } from 'vitest';
import { migrateProject, createProject } from './project';
import {
	applyTemplate,
	cellWidths,
	defaultTemplate,
	fieldKey,
	fillText,
	newTemplate,
	normalizeTemplate,
	projectTemplate
} from './template';

function project() {
	const p = createProject('ESSIQUE 86 LGTS', 'V.R');
	Object.assign(p.meta, { affaireNumber: 'D223456', planNumber: 'DW261136', client: 'OPH' });
	p.revisions = [
		{ indice: 'A', description: 'Création', date: '01/09/2026' },
		{ indice: 'B', description: 'Ajout pompe', date: '29/09/2026' }
	];
	return p;
}

describe('champs des modèles', () => {
	it('remplit les champs du projet, du folio et les champs libres', () => {
		const p = project();
		p.meta.fields = { lot: 'CVC' };
		expect(fillText('{plan} {nom}', p)).toBe('DW261136 ESSIQUE 86 LGTS');
		expect(fillText('Indice {indice} du {dateIndice}', p)).toBe('Indice B du 29/09/2026');
		expect(fillText('Lot : {lot}', p)).toBe('Lot : CVC');
		expect(
			fillText('{folio} / {total} {titre}', p, { folioIndex: 2, total: 12, folioTitle: 'X' })
		).toBe('03 / 12 X');
		expect(fillText('{nbFolios}', p, { folioCount: 12 })).toBe('12');
		// Champ vide ou inconnu : texte propre, sans espaces doubles.
		expect(fillText('{plan} {inconnu} {nom}', p)).toBe('DW261136 ESSIQUE 86 LGTS');
	});

	it('génère une clé de champ libre unique et lisible', () => {
		expect(fieldKey('Maître d’ouvrage', [])).toBe('maitre_d_ouvrage');
		expect(fieldKey('Lot', ['lot'])).toBe('lot_2');
		// Pas de collision avec les champs de l'application.
		expect(fieldKey('Plan', [])).toBe('plan_2');
	});
});

describe('cartouche', () => {
	it('la case de largeur 0 prend la place restante', () => {
		const cells = defaultTemplate().titleblock.cells;
		const w = cellWidths(cells, 277);
		expect(w).toEqual([58, 277 - 58 - 48 - 18, 48, 18]);
	});

	it('modèle standard par défaut, copie propre au projet', () => {
		const p = project();
		expect(projectTemplate(p).id).toBe('defaut');
		const t = newTemplate('Dumortier');
		t.fields = [{ key: 'lot', label: 'Lot' }];
		applyTemplate(p, t);
		t.name = 'modifié après coup';
		expect(p.template?.name).toBe('Dumortier');
		expect(p.meta.fields).toEqual({});
		// Relecture du projet : modèle et valeurs conservés.
		p.meta.fields!.lot = 'CVC';
		const back = migrateProject(JSON.parse(JSON.stringify(p)));
		expect(back.template?.fields).toEqual([{ key: 'lot', label: 'Lot' }]);
		expect(back.meta.fields).toEqual({ lot: 'CVC' });
	});
});

describe('validation des modèles', () => {
	it('complète un modèle partiel et rejette les données invalides', () => {
		const t = normalizeTemplate({ id: 'tpl1', name: 'Partiel' })!;
		expect(t.titleblock.cells).toHaveLength(4);
		expect(t.cover.footer).toHaveLength(3);
		expect(normalizeTemplate({ name: 'sans id' })).toBeNull();
		expect(
			normalizeTemplate({ id: 'x', name: 'n', logo: 'javascript:alert(1)' })!.logo
		).toBeUndefined();
	});
});
