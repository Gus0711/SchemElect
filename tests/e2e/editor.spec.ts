import { expect, test, type Page } from '@playwright/test';

/* Parcours complet : premier admin → projet → dessin → renvois → numéros → sauvegarde → PDF. */

type Pt = { x: number; y: number };

async function toScreen(page: Page, p: Pt): Promise<Pt> {
	return page.evaluate(({ x, y }) => {
		const { editor } = (
			window as never as {
				__schemelect: { editor: { viewport: { x: number; y: number; scale: number } } };
			}
		).__schemelect;
		const r = document.querySelector('.canvas svg')!.getBoundingClientRect();
		const vp = editor.viewport;
		return { x: r.left + (x - vp.x) * vp.scale, y: r.top + (y - vp.y) * vp.scale };
	}, p);
}

async function clickAt(page: Page, p: Pt, dbl = false) {
	const s = await toScreen(page, p);
	await page.mouse.move(s.x, s.y);
	if (dbl) await page.mouse.dblclick(s.x, s.y);
	else await page.mouse.click(s.x, s.y);
}

async function evalEditor<T>(page: Page, fn: string): Promise<T> {
	return page.evaluate(
		`(() => { const { editor } = window.__schemelect; return ${fn}; })()`
	) as Promise<T>;
}

async function place(page: Page, name: RegExp, at: Pt) {
	await page.getByRole('button', { name }).first().click();
	await clickAt(page, at);
	await page.keyboard.press('Escape');
}

test('dessiner un folio, renvois, numéros de fils, sauvegarde et export PDF', async ({ page }) => {
	// Premier lancement : création de l'administrateur
	await page.goto('/');
	await expect(page).toHaveURL(/\/setup/);
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Identifiant').fill('admin');
	await page.getByLabel('Nom affiché').fill('Admin Test');
	await page.getByLabel('Mot de passe').fill('motdepasse-e2e');
	await page.getByLabel('Confirmation').fill('motdepasse-e2e');
	await page.locator('form button[type=submit]').click();
	await expect(page).toHaveURL(/\/$/);
	await page.waitForLoadState('networkidle');

	// Nouveau projet
	await page.getByRole('button', { name: /Nouveau projet/ }).click();
	await page.getByLabel('Nom du projet').fill('Chaufferie test');
	await page.getByRole('button', { name: 'Créer', exact: true }).click();
	await expect(page).toHaveURL(/\/projets\//);
	await expect(page.locator('.status.saved')).toBeVisible();

	// Barre Phase 1 à y = 40
	await page.getByRole('button', { name: /Barre/ }).first().click();
	await clickAt(page, { x: 100, y: 40 });

	// Voyant H1 (X1 en 100;70, X2 en 100;85) et fil depuis la barre
	await place(page, /Voyant lumineux/, { x: 100, y: 70 });
	await page.keyboard.press('w');
	await clickAt(page, { x: 100, y: 40 });
	await clickAt(page, { x: 100, y: 70 });
	// Fil libre sous le voyant, terminé par Entrée
	await clickAt(page, { x: 100, y: 85 });
	await clickAt(page, { x: 100, y: 120 });
	await page.keyboard.press('Enter');
	await page.keyboard.press('Escape');

	const numbers = await evalEditor<string[]>(
		page,
		'[...editor.analysis.wireStyle.values()].map((s) => s.number).filter(Boolean)'
	);
	expect(numbers).toEqual(['01']);

	// Bobine KM1 + contact rattaché par son repère → renvois croisés
	await place(page, /Bobine de contacteur/, { x: 150, y: 100 });
	await place(page, /Contact à fermeture/, { x: 60, y: 100 });
	await clickAt(page, { x: 59, y: 107 });
	const tag = page.getByLabel('Repère');
	await tag.fill('KM1');
	await tag.press('Enter');
	await page.locator('.canvas').click({ position: { x: 5, y: 5 } });
	await expect(page.locator('.canvas svg text', { hasText: '(01 - ' }).first()).toBeVisible();
	const tags = await evalEditor<string[]>(
		page,
		'Object.values(editor.project.devices).map((d) => d.tag).sort()'
	);
	expect(tags).toEqual(['H1', 'KM1']);

	// Annuler / rétablir
	await page.keyboard.press('Control+z');
	expect(await evalEditor<number>(page, 'Object.keys(editor.project.devices).length')).toBe(3);
	await page.keyboard.press('Control+y');
	expect(await evalEditor<number>(page, 'Object.keys(editor.project.devices).length')).toBe(2);

	// Sauvegarde auto puis rechargement
	await expect(page.locator('.status.saved')).toBeVisible({ timeout: 10_000 });
	await page.screenshot({ path: 'test-results/editor.png' });
	await page.reload();
	await expect(page.locator('.status.saved')).toBeVisible();
	expect(await evalEditor<number>(page, 'editor.project.folios[0].wires.length')).toBe(2);

	// Export PDF
	await page
		.getByRole('button', { name: /Exporter/ })
		.first()
		.click();
	const download = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Exporter le PDF' }).click();
	const file = await download;
	expect(file.suggestedFilename()).toMatch(/\.pdf$/);
	await file.saveAs('test-results/export.pdf');
});

test('projet de démonstration : ouverture, deux folios, glisser un symbole', async ({ page }) => {
	await page.goto('/login');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Identifiant').fill('admin');
	await page.getByLabel('Mot de passe').fill('motdepasse-e2e');
	await page.locator('form button[type=submit]').click();
	await expect(page).toHaveURL(/\/$/);
	await page.waitForLoadState('networkidle');

	await page.getByRole('button', { name: 'Projet de démonstration' }).click();
	await expect(page).toHaveURL(/\/projets\//);
	await page.waitForLoadState('networkidle');
	await expect(page.locator('.status.saved')).toBeVisible();
	await page.screenshot({ path: 'test-results/demo-folio1.png' });

	// Glisser le premier symbole de 10 mm vers la droite : les fils suivent, un seul pas d'annulation.
	const before = await evalEditor<{ x: number; y: number; wires: string }>(
		page,
		'({ x: editor.folio.symbols[0].x, y: editor.folio.symbols[0].y, wires: JSON.stringify(editor.folio.wires) })'
	);
	const from = await toScreen(page, { x: before.x, y: before.y + 7.5 });
	const to = await toScreen(page, { x: before.x + 10, y: before.y + 7.5 });
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	await page.mouse.move((from.x + to.x) / 2, from.y, { steps: 5 });
	await page.mouse.move(to.x, to.y, { steps: 5 });
	await page.mouse.up();
	expect(await evalEditor<number>(page, 'editor.folio.symbols[0].x')).toBe(before.x + 10);
	expect(await evalEditor<string>(page, 'JSON.stringify(editor.folio.wires)')).not.toBe(
		before.wires
	);
	await page.keyboard.press('Control+z');
	expect(await evalEditor<number>(page, 'editor.folio.symbols[0].x')).toBe(before.x);

	await page.keyboard.press('PageDown');
	await page.screenshot({ path: 'test-results/demo-folio2.png' });
});

test('menu clic droit, alerte de contacts et alignement', async ({ page }) => {
	await page.goto('/login');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Identifiant').fill('admin');
	await page.getByLabel('Mot de passe').fill('motdepasse-e2e');
	await page.locator('form button[type=submit]').click();
	await expect(page).toHaveURL(/\/$/);
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Projet de démonstration' }).click();
	await expect(page).toHaveURL(/\/projets\//);
	await page.waitForLoadState('networkidle');
	await expect(page.locator('.status.saved')).toBeVisible();

	// Clic droit sur la bobine KM1 → menu → Pivoter
	const coil = await evalEditor<{ id: string; x: number; y: number }>(
		page,
		"(() => { const s = editor.folio.symbols.find((s) => s.defId === 'bobine-contacteur'); return { id: s.id, x: s.x, y: s.y }; })()"
	);
	const at = await toScreen(page, { x: coil.x, y: coil.y + 7.5 });
	await page.mouse.click(at.x, at.y, { button: 'right' });
	await expect(page.getByRole('menu')).toBeVisible();
	await page.getByRole('menuitem', { name: 'Pivoter' }).click();
	expect(
		await evalEditor<number>(
			page,
			`editor.folio.symbols.find((s) => s.id === '${coil.id}').rotation`
		)
	).toBe(90);
	await page.keyboard.press('Control+z');

	// Double-clic sur le renvoi de fil → saut au renvoi jumeau (folio 02)
	const arrow = await evalEditor<{ x: number; y: number }>(
		page,
		"(() => { const s = editor.folio.symbols.find((s) => s.defId === 'renvoi-sortie'); return { x: s.x, y: s.y }; })()"
	);
	const arrowAt = await toScreen(page, { x: arrow.x, y: arrow.y + 3 });
	await page.mouse.dblclick(arrowAt.x, arrowAt.y);
	expect(await evalEditor<number>(page, 'editor.folioIndex')).toBe(1);
	expect(
		await evalEditor<string>(
			page,
			'editor.folio.symbols.find((s) => s.id === editor.selection[0].id).defId'
		)
	).toBe('renvoi-entree');
	await page.keyboard.press('PageUp');

	// Contacts disponibles : 1 NO → alerte de dépassement (vue recentrée : position recalculée)
	const coilAt = await toScreen(page, { x: coil.x, y: coil.y + 7.5 });
	await page.mouse.click(coilAt.x, coilAt.y);
	const no = page.getByLabel('Contacts NO dispo.');
	await no.fill('1');
	await no.press('Enter');
	await expect(page.getByText(/dépassement/)).toBeVisible();
	await page.keyboard.press('Escape');
	await page.locator('.canvas').click({ position: { x: 5, y: 5 } });
	await expect(page.getByText(/dessinés pour 1 NO/)).toBeVisible();

	// Alignement sur l'axe : deux voyants décalés
	await page.keyboard.press('f');
	await place(page, /Voyant lumineux/, { x: 40, y: 150 });
	await place(page, /Voyant lumineux/, { x: 52.5, y: 165 });
	const ids = await evalEditor<string[]>(page, 'editor.folio.symbols.slice(-2).map((s) => s.id)');
	await clickAt(page, { x: 40, y: 157.5 });
	const second = await toScreen(page, { x: 52.5, y: 172.5 });
	await page.keyboard.down('Shift');
	await page.mouse.click(second.x, second.y);
	await page.keyboard.up('Shift');
	await page.getByRole('button', { name: /Aligner sur l’axe/ }).click();
	expect(
		await evalEditor<number[]>(
			page,
			`[${ids.map((id) => `'${id}'`).join(',')}].map((id) => editor.folio.symbols.find((s) => s.id === id).x)`
		)
	).toEqual([40, 40]);
});

test('symbole maison depuis une image de documentation', async ({ page }) => {
	await page.goto('/login');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Identifiant').fill('admin');
	await page.getByLabel('Mot de passe').fill('motdepasse-e2e');
	await page.locator('form button[type=submit]').click();
	await expect(page).toHaveURL(/\/$/);
	await page.waitForLoadState('networkidle');
	await page.getByRole('link', { name: 'Chaufferie test' }).click();
	await expect(page).toHaveURL(/\/projets\//);
	await page.waitForLoadState('networkidle');
	await expect(page.locator('.status.saved')).toBeVisible();

	// Création : image + deux rangées de bornes
	await page.getByRole('button', { name: /Nouveau symbole/ }).click();
	await page
		.locator('input[type=file][accept="image/*"]')
		.setInputFiles('tests/e2e/fixtures/ecy-253.png');
	await expect(page.locator('.preview svg image')).toHaveCount(1);
	await page.getByLabel('Nom', { exact: true }).fill('Automate ECY-253');
	await page.getByLabel('Largeur (mm)').fill('80');
	await page.getByLabel('Largeur (mm)').press('Tab');

	// Retouches : rogner (on garde 10..70 × 10..50 mm), fond transparent, annuler
	const stagePt = (x: number, y: number) =>
		page.evaluate(
			([x, y]) => {
				const svg = document.querySelector('.stage > svg') as SVGSVGElement;
				const p = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM()!);
				return { x: p.x, y: p.y };
			},
			[x, y]
		);
	const dragStage = async (a: [number, number], b: [number, number]) => {
		const p = await stagePt(...a);
		const q = await stagePt(...b);
		await page.mouse.move(p.x, p.y);
		await page.mouse.down();
		await page.mouse.move(q.x, q.y, { steps: 6 });
		await page.mouse.up();
	};
	await page.getByRole('button', { name: 'Rogner' }).click();
	await dragStage([10, 10], [70, 50]);
	await expect(page.getByRole('button', { name: /Annuler \(1\)/ })).toBeVisible();
	expect(Number(await page.getByLabel('Largeur (mm)').inputValue())).toBeCloseTo(60, 0);
	await page.getByRole('button', { name: 'Fond transparent' }).click();
	await expect(page.getByRole('button', { name: /Annuler \(2\)/ })).toBeVisible();
	await page.getByRole('button', { name: /Annuler \(2\)/ }).click();
	await expect(page.getByRole('button', { name: /Annuler \(1\)/ })).toBeVisible();
	await page.getByRole('button', { name: 'Fond transparent' }).click();

	// Redimensionnement par la poignée : 60 → 80 mm
	await page.getByRole('button', { name: 'Bornes' }).click();
	const h = Number(await page.getByLabel('Hauteur (mm)').inputValue());
	await dragStage([60, h], [80, h]);
	expect(Number(await page.getByLabel('Largeur (mm)').inputValue())).toBeCloseTo(80, 0);
	const quick = page.getByPlaceholder('24V, 0V, 0V, IP');
	await quick.fill('24V, COM, DO1, C1, DO2, C2');
	await quick.press('Enter');
	await page.locator('fieldset select').selectOption('s');
	await quick.fill('UI1, COM, UI2');
	await quick.press('Enter');
	await expect(page.locator('.trow')).toHaveCount(9);

	// Borne posée exactement au clic (centre de l'aperçu = centre de l'image), puis glissée
	const clickAt2 = await page.evaluate(() => {
		const svg = document.querySelector('.stage > svg') as SVGSVGElement;
		const p = new DOMPoint(40, 20).matrixTransform(svg.getScreenCTM()!);
		return { x: p.x, y: p.y };
	});
	await page.mouse.click(clickAt2.x, clickAt2.y);
	await expect(page.locator('.trow')).toHaveCount(10);
	const last = page.locator('.trow').last();
	await last.locator('input.name').fill('DO3');
	expect(Number(await last.locator('input[type=number]').nth(0).inputValue())).toBeCloseTo(40, 0);
	expect(Number(await last.locator('input[type=number]').nth(1).inputValue())).toBeCloseTo(20, 0);
	const to = await page.evaluate(() => {
		const svg = document.querySelector('.stage > svg') as SVGSVGElement;
		const p = new DOMPoint(45.5, 20).matrixTransform(svg.getScreenCTM()!);
		return { x: p.x, y: p.y };
	});
	await page.mouse.move(clickAt2.x, clickAt2.y);
	await page.mouse.down();
	await page.mouse.move(to.x, to.y, { steps: 5 });
	await page.mouse.up();
	expect(Number(await last.locator('input[type=number]').nth(0).inputValue())).toBeCloseTo(45.5, 0);
	await page.getByRole('button', { name: 'Enregistrer dans la bibliothèque' }).click();

	// Le symbole est prêt à être posé
	await clickAt(page, { x: 150, y: 60 });
	await page.keyboard.press('Escape');
	const placed = await evalEditor<{ n: number; tag: string; terms: number }>(
		page,
		`(() => {
			const s = editor.folio.symbols.find((s) => s.defId.startsWith('custom-'));
			const def = editor.project.customSymbols[s.defId];
			return { n: Object.keys(editor.project.customSymbols).length, tag: editor.project.devices[s.deviceId].tag, terms: def.terminals.length };
		})()`
	);
	expect(placed).toEqual({ n: 1, tag: 'A1', terms: 10 });
	await expect(page.getByRole('button', { name: /Automate ECY-253/ })).toBeVisible();

	// Redimensionnement sur le folio : sélection puis poignée du coin
	await clickAt(page, { x: 160, y: 70 });
	const handle = await evalEditor<{ x: number; y: number; origin: { x: number; y: number } }>(
		page,
		'editor.scaleHandle'
	);
	expect(handle).not.toBeNull();
	const hFrom = await toScreen(page, handle);
	const hTo = await toScreen(page, {
		x: handle.origin.x + (handle.x - handle.origin.x) * 0.5,
		y: handle.origin.y + (handle.y - handle.origin.y) * 0.5
	});
	await page.mouse.move(hFrom.x, hFrom.y);
	await page.mouse.down();
	await page.mouse.move(hTo.x, hTo.y, { steps: 6 });
	await page.mouse.up();
	expect(
		await evalEditor<number>(
			page,
			"editor.folio.symbols.find((s) => s.defId.startsWith('custom-')).scale"
		)
	).toBeCloseTo(0.5, 1);
	await page.keyboard.press('Control+z');
	expect(
		await evalEditor<number | undefined>(
			page,
			"editor.folio.symbols.find((s) => s.defId.startsWith('custom-')).scale ?? 1"
		)
	).toBe(1);
	await page.screenshot({ path: 'test-results/custom-symbol.png' });

	// Export PDF avec l'image
	await expect(page.locator('.status.saved')).toBeVisible({ timeout: 10_000 });
	await page
		.getByRole('button', { name: /Exporter/ })
		.first()
		.click();
	const download = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Exporter le PDF' }).click();
	await (await download).saveAs('test-results/export-custom.pdf');
});
