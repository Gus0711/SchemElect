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

/** Ouvre un panneau de la barre latérale (sans le replier s'il est déjà ouvert). */
async function openPanel(page: Page, name: string) {
	const button = page.locator('.rail').getByRole('button', { name, exact: true });
	if ((await button.getAttribute('aria-pressed')) !== 'true') await button.click();
}

/** Menu « Dossier » de la barre du haut. */
async function dossierMenu(page: Page, item: string | RegExp) {
	await page.getByRole('button', { name: /^Dossier/ }).click();
	await page.getByRole('menuitem', { name: item }).click();
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
	await page.getByRole('button', { name: 'Créer et ouvrir' }).click();
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
	// Badge du panneau Contrôles, puis le détail dans le panneau.
	await expect(page.locator('.rail .badge')).toBeVisible();
	await openPanel(page, 'Contrôles');
	await expect(page.getByText(/dessinés pour 1 NO/)).toBeVisible();
	await openPanel(page, 'Symboles');

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
	// Largeur puis rognage : deux modifications annulables.
	await expect(page.getByRole('button', { name: /Annuler \(2\)/ })).toBeVisible();
	expect(Number(await page.getByLabel('Largeur (mm)').inputValue())).toBeCloseTo(60, 0);
	await page.getByRole('button', { name: 'Fond transparent' }).click();
	await expect(page.getByRole('button', { name: /Annuler \(3\)/ })).toBeVisible();
	await page.getByRole('button', { name: /Annuler \(3\)/ }).click();
	await expect(page.getByRole('button', { name: /Annuler \(2\)/ })).toBeVisible();
	await page.getByRole('button', { name: 'Fond transparent' }).click();

	// Redimensionnement par la poignée : 60 → 80 mm
	await page.getByRole('button', { name: 'Bornes' }).click();
	const h = Number(await page.getByLabel('Hauteur (mm)').inputValue());
	await dragStage([60, h], [80, h]);
	expect(Number(await page.getByLabel('Largeur (mm)').inputValue())).toBeCloseTo(80, 0);
	const quick = page.getByPlaceholder('24V, 0V, IP1..IP8');
	await quick.fill('24V, COM, DO1, C1, DO2, C2');
	await page.getByRole('button', { name: 'Répartir' }).click();
	await page.getByRole('combobox', { name: 'Côté', exact: true }).selectOption('s');
	await quick.fill('UI1, COM, UI2');
	await page.getByRole('button', { name: 'Répartir' }).click();
	await expect(page.locator('.trow')).toHaveCount(9);
	// Nom de la prochaine borne : saisi d'avance (sinon la précédente + 1).
	await expect(page.locator('.help .next')).toHaveText('UI3');
	await quick.fill('DO3');
	await expect(page.locator('.help .next')).toHaveText('DO3');

	// Borne posée exactement au clic (centre de l'aperçu = centre de l'image), puis glissée
	const clickAt2 = await page.evaluate(() => {
		const svg = document.querySelector('.stage > svg') as SVGSVGElement;
		const p = new DOMPoint(40, 20).matrixTransform(svg.getScreenCTM()!);
		return { x: p.x, y: p.y };
	});
	await page.mouse.click(clickAt2.x, clickAt2.y);
	await expect(page.locator('.trow')).toHaveCount(10);
	const last = page.locator('.trow').last();
	await expect(last.locator('input.name')).toHaveValue('DO3');
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
	// Ctrl+Z annule le déplacement ; Échap ne ferme pas la fenêtre.
	await page.keyboard.press('Control+z');
	expect(Number(await last.locator('input[type=number]').nth(0).inputValue())).toBeCloseTo(40, 0);
	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog', { name: 'Nouveau symbole' })).toBeVisible();
	await page.screenshot({ path: 'test-results/nouveau-symbole.png' });
	await page.mouse.move(clickAt2.x, clickAt2.y);
	await page.mouse.down();
	await page.mouse.move(to.x, to.y, { steps: 5 });
	await page.mouse.up();
	expect(Number(await last.locator('input[type=number]').nth(0).inputValue())).toBeCloseTo(45.5, 0);
	await page.getByRole('button', { name: 'Enregistrer dans la bibliothèque' }).click();
	// Enregistrement côté serveur : attendre la fermeture de la fenêtre et l'outil de pose.
	await expect(page.getByRole('button', { name: 'Enregistrer dans la bibliothèque' })).toBeHidden();
	await expect.poll(() => evalEditor<string>(page, 'editor.tool.kind')).toBe('place');

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

test('câble multi-conducteurs tracé en travers des fils', async ({ page }) => {
	await page.goto('/login');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Identifiant').fill('admin');
	await page.getByLabel('Mot de passe').fill('motdepasse-e2e');
	await page.locator('form button[type=submit]').click();
	await expect(page).toHaveURL(/\/$/);
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: /Nouveau projet/ }).click();
	await page.getByLabel('Nom du projet').fill('Pompes ECS');
	await page.getByRole('button', { name: 'Créer et ouvrir' }).click();
	await expect(page).toHaveURL(/\/projets\//);
	await expect(page.locator('.status.saved')).toBeVisible();

	// Six fils verticaux (comme C3…C8 du folio 04 de l'exemple)
	await evalEditor(
		page,
		`editor.transact('fils', (_, f) => [60, 70, 80, 90, 100, 110].forEach((x, i) =>
			f.wires.push({ id: 'wc' + i, points: [{ x, y: 110 }, { x, y: 170 }] })))`
	);

	// Outil câble : glisser en travers des six fils
	await page.getByRole('button', { name: /Câble/ }).first().click();
	const a = await toScreen(page, { x: 55, y: 150 });
	const b = await toScreen(page, { x: 115, y: 150 });
	await page.mouse.move(a.x, a.y);
	await page.mouse.down();
	await page.mouse.move(b.x, b.y, { steps: 8 });
	await page.mouse.up();

	const cable = await evalEditor<{ tag: string; colors: string[]; pairs: boolean }>(
		page,
		'JSON.parse(JSON.stringify(editor.folio.cables[0]))'
	);
	expect(cable.tag).toBe('W1');
	expect(cable.pairs).toBe(true);
	expect(cable.colors).toHaveLength(6);
	await expect(page.locator('.inspector')).toContainText('6 fils coupés');
	await expect(page.locator('.canvas')).toContainText('CABLE SYT1 3 PAIRES');
	await expect(page.locator('.canvas')).toContainText('Paire Ciel / Jaune');

	// Passage en câble d'énergie depuis l'inspecteur
	const type = page.locator('.inspector').getByLabel('Type');
	await type.fill('U1000 R2V');
	await type.press('Enter');
	await type.blur();
	await expect(page.locator('.canvas')).toContainText('CABLE U1000 R2V 6G');
	await expect(page.locator('.canvas')).toContainText('Vert/Jaune');
	await page.keyboard.press('Control+z');
	await expect(page.locator('.canvas')).toContainText('CABLE SYT1 3 PAIRES');
	await page.screenshot({ path: 'test-results/cable.png' });
});

test('sauvegarde manuelle de la base et téléchargement', async ({ page }) => {
	await page.goto('/login');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Identifiant').fill('admin');
	await page.getByLabel('Mot de passe').fill('motdepasse-e2e');
	await page.locator('form button[type=submit]').click();
	await expect(page).toHaveURL(/\/$/);
	await page.waitForLoadState('networkidle');

	await page.getByRole('link', { name: /Sauvegardes/ }).click();
	await expect(page).toHaveURL(/\/admin\/sauvegardes/);
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: /Sauvegarder maintenant/ }).click();
	await expect(page.getByText(/Sauvegarde schemelect-.* créée/)).toBeVisible();
	await expect(page.locator('tbody tr')).toHaveCount(1);

	const download = page.waitForEvent('download');
	await page.getByTitle('Télécharger').click();
	const file = await download;
	expect(file.suggestedFilename()).toMatch(/^schemelect-.*Z\.db$/);
});

test('folios d’implantation et de façade : placement automatique et à la main', async ({
	page
}) => {
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

	// Nouveau folio d'implantation (après le dernier folio)
	const last = await evalEditor<number>(page, 'editor.project.folios.length');
	await evalEditor(page, `editor.setFolio(editor.project.folios[${last - 1}].id)`);
	await page.getByRole('button', { name: 'Nouveau folio' }).click();
	await page.getByRole('menuitem', { name: /implantation/ }).click();
	expect(await evalEditor<string>(page, 'editor.folio.panel.kind')).toBe('implantation');
	expect(await evalEditor<number>(page, 'editor.folio.panel.rails.length')).toBe(4);

	// Onglet « À placer » : placement automatique
	await openPanel(page, 'À placer');
	await page.getByRole('button', { name: /Placer automatiquement/ }).click();
	const placed = await evalEditor<number>(page, 'editor.folio.panel.items.length');
	expect(placed).toBeGreaterThan(2);
	await expect(page.getByText(/Tout est posé/)).toBeVisible();
	await page.screenshot({ path: 'test-results/implantation.png' });

	// Glisser un appareil de 50 mm vers la droite et 10 mm plus bas : il reste accroché au rail.
	const before = await evalEditor<{ id: string; x: number; y: number; scale: number }>(
		page,
		`(() => { const f = editor.folio; const it = f.panel.items.find((i) => i.deviceId);
			editor.goToMount(f.id, it.id);
			return { id: it.id, x: it.x, y: it.y, scale: editor.viewport.scale }; })()`
	);
	const box = (await page.locator('.canvas svg').boundingBox())!;
	const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
	// Armoire 1000 × 600 : échelle 1:6, 1 mm réel = 1/6 mm de page.
	const px = before.scale / 6;
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	await page.mouse.move(from.x + 25 * px, from.y + 5 * px, { steps: 4 });
	await page.mouse.move(from.x + 50 * px, from.y + 10 * px, { steps: 4 });
	await page.mouse.up();
	const after = await evalEditor<{ x: number; y: number }>(
		page,
		`(() => { const it = editor.folio.panel.items.find((i) => i.id === '${before.id}');
			return { x: it.x, y: it.y }; })()`
	);
	// Magnétisme 5 mm : le déplacement est arrondi au pas de la grille.
	expect(Math.abs(after.x - before.x - 50)).toBeLessThanOrEqual(5);
	expect(after.y).toBe(before.y);

	// Il chevauche maintenant ses voisins : contrôle signalé, puis annulation.
	await expect(page.getByText(/Chevauche un autre appareil/)).toBeVisible();
	await page.keyboard.press('Control+z');

	// Double-clic sur l'appareil posé → son symbole dans le schéma.
	await page.mouse.dblclick(from.x, from.y);
	expect(await evalEditor<boolean>(page, '!editor.folio.panel')).toBe(true);
	await page.keyboard.press('PageDown');
	await page.keyboard.press('End');
	await evalEditor(
		page,
		'editor.setFolio(editor.project.folios[editor.project.folios.length - 1].id)'
	);

	// Façade : voyants et commutateurs du schéma
	await page.getByRole('button', { name: 'Nouveau folio' }).click();
	await page.getByRole('menuitem', { name: /façade/ }).click();
	expect(await evalEditor<string>(page, 'editor.folio.panel.kind')).toBe('facade');
	await openPanel(page, 'À placer');
	await page.getByRole('button', { name: /Placer automatiquement/ }).click();
	expect(await evalEditor<number>(page, 'editor.folio.panel.items.length')).toBeGreaterThan(0);
	await page.keyboard.press('Escape');
	await page.keyboard.press('f');
	await page.screenshot({ path: 'test-results/facade.png' });
	await page.getByRole('button', { name: /Thème : Clair/ }).click();
	await page.screenshot({ path: 'test-results/facade-sombre.png' });
	await openPanel(page, 'À placer');
	await page.screenshot({ path: 'test-results/facade-sombre-appareils.png' });

	// Export PDF du dossier avec les folios d'armoire (même rendu qu'à l'écran)
	await page
		.locator('.toolbar')
		.getByRole('button', { name: /Exporter/ })
		.click();
	const download = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Exporter le PDF' }).click();
	await (await download).saveAs('test-results/export-armoire.pdf');
	await page.keyboard.press('Escape');

	// Annuler / rétablir et sauvegarde
	await page.keyboard.press('Control+z');
	expect(await evalEditor<number>(page, 'editor.folio.panel.items.length')).toBe(0);
	await page.keyboard.press('Control+y');
	await expect(page.locator('.status.saved')).toBeVisible();
});

test('exemple armoire complète : ouverture et export PDF', async ({ page }) => {
	await page.goto('/login');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Identifiant').fill('admin');
	await page.getByLabel('Mot de passe').fill('motdepasse-e2e');
	await page.locator('form button[type=submit]').click();
	await expect(page).toHaveURL(/\/$/);
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Exemple armoire complète' }).click();
	await expect(page).toHaveURL(/\/projets\//);
	await page.waitForLoadState('networkidle');
	await expect(page.locator('.status.saved')).toBeVisible();
	expect(await evalEditor<number>(page, 'editor.project.folios.length')).toBe(5);
	await openPanel(page, 'Contrôles');
	await expect(page.getByText('Aucun problème détecté.')).toBeVisible();
	for (let i = 1; i <= 5; i++) {
		await page.screenshot({ path: `test-results/exemple-${i}.png` });
		await page.keyboard.press('PageDown');
	}
	await page
		.locator('.toolbar')
		.getByRole('button', { name: /Exporter/ })
		.click();
	const download = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Exporter le PDF' }).click();
	await (await download).saveAs('test-results/exemple-armoire.pdf');
});

test('modèle de cartouche et de page de garde : création, choix, champ libre, PDF', async ({
	page
}) => {
	await page.goto('/login');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Identifiant').fill('admin');
	await page.getByLabel('Mot de passe').fill('motdepasse-e2e');
	await page.locator('form button[type=submit]').click();
	await expect(page).toHaveURL(/\/$/);

	// Bibliothèque : nouveau modèle avec logo, champ libre « Lot », case de cartouche, présentation
	await page.getByRole('link', { name: /Modèles/ }).click();
	await expect(page).toHaveURL(/\/modeles/);
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: /Nouveau modèle/ }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByLabel('Nom du modèle').fill('Dumortier');
	await dialog.locator('input[type=file]').setInputFiles('tests/e2e/fixtures/logo-dumortier.png');
	await expect(dialog.locator('.logo-preview img')).toBeVisible();

	await dialog.getByRole('button', { name: 'Champs libres' }).click();
	await dialog.getByRole('button', { name: /Ajouter un champ/ }).click();
	await dialog.locator('.row input.cell').first().fill('Lot');
	await expect(dialog.getByText('{lot}')).toBeVisible();

	await dialog.getByRole('button', { name: 'Cartouche', exact: true }).click();
	await dialog.getByRole('button', { name: /Case texte/ }).click();
	await dialog
		.getByPlaceholder(/Texte, ex/)
		.last()
		.fill('Lot : {lot}');

	await dialog.getByRole('button', { name: 'Page de garde' }).click();
	await dialog
		.getByRole('button', { name: /Ajouter une ligne/ })
		.nth(1)
		.click();
	await dialog
		.getByPlaceholder(/Texte, ex/)
		.nth(2)
		.fill('Régulation, GTB et électricité des chaufferies');
	await dialog.getByRole('button', { name: 'Cartouche', exact: true }).click();
	await page.screenshot({ path: 'test-results/editeur-modele.png' });
	await dialog.getByRole('button', { name: 'Enregistrer' }).click();
	await expect(page.getByText('Dumortier', { exact: true })).toBeVisible();
	await page.screenshot({ path: 'test-results/modeles.png' });

	// Nouveau projet avec ce modèle
	await page.getByRole('link', { name: /Projets/ }).click();
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: /Nouveau projet/ }).click();
	await page.getByLabel('Nom du projet').fill('Chaufferie Lot CVC');
	await page.locator('select[name=template]').selectOption({ label: 'Dumortier' });
	await page.getByRole('button', { name: 'Créer et ouvrir' }).click();
	await expect(page).toHaveURL(/\/projets\//);
	await expect(page.locator('.status.saved')).toBeVisible();
	expect(await evalEditor<string>(page, 'editor.project.template.name')).toBe('Dumortier');

	// Valeur du champ libre → cartouche
	await dossierMenu(page, 'Propriétés du dossier…');
	await page.getByRole('dialog').getByLabel('Lot').fill('CVC');
	await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click();
	await expect(page.locator('.canvas svg text', { hasText: 'Lot : CVC' })).toBeVisible();
	await page.screenshot({ path: 'test-results/cartouche-modele.png' });

	await page
		.locator('.toolbar')
		.getByRole('button', { name: /Exporter/ })
		.click();
	const download = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Exporter le PDF' }).click();
	await (await download).saveAs('test-results/export-modele.pdf');
});

test('raccourcis clavier : aide, recherche de symbole, reprise de pose, barre, F2', async ({
	page
}) => {
	await page.goto('/login');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Identifiant').fill('admin');
	await page.getByLabel('Mot de passe').fill('motdepasse-e2e');
	await page.locator('form button[type=submit]').click();
	await expect(page).toHaveURL(/\/$/);
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: /Nouveau projet/ }).click();
	await page.getByLabel('Nom du projet').fill('Raccourcis');
	await page.getByRole('button', { name: 'Créer et ouvrir' }).click();
	await expect(page).toHaveURL(/\/projets\//);
	await expect(page.locator('.status.saved')).toBeVisible();

	// ? : aide, filtrable
	await page.locator('.canvas svg').click({ position: { x: 5, y: 5 } });
	await page.keyboard.press('?');
	const help = page.getByRole('dialog');
	await expect(help.getByText('Raccourcis clavier')).toBeVisible();
	await page.keyboard.type('zoom');
	await expect(help.getByText('Zoom avant / arrière')).toBeVisible();
	await expect(help.getByText('Couper')).toHaveCount(0);
	await page.screenshot({ path: 'test-results/raccourcis.png' });
	await page.keyboard.press('Escape');
	await expect(help).toHaveCount(0);

	// Bouton de la barre d'état
	await page.getByRole('button', { name: /Tous les raccourcis/ }).click();
	await expect(page.getByRole('dialog').getByText('Raccourcis clavier')).toBeVisible();
	await page.keyboard.press('Escape');
	await page.locator('.canvas svg').click({ position: { x: 5, y: 5 } });

	// / : recherche de symbole, Entrée = 1er résultat, clic = pose
	await page.keyboard.press('/');
	await expect(page.getByPlaceholder(/Rechercher \(disjoncteur/)).toBeFocused();
	await page.keyboard.type('bobine de contacteur');
	await page.keyboard.press('Enter');
	expect(await evalEditor<string>(page, 'editor.tool.defId')).toBe('bobine-contacteur');
	await clickAt(page, { x: 100, y: 80 });
	await page.keyboard.press('Escape');
	await page.keyboard.press('Escape');
	expect(await evalEditor<number>(page, 'editor.folio.symbols.length')).toBe(1);

	// Entrée : reprendre la pose du dernier symbole
	await page.keyboard.press('Enter');
	expect(await evalEditor<string>(page, 'editor.tool.kind')).toBe('place');
	await clickAt(page, { x: 140, y: 80 });
	expect(await evalEditor<number>(page, 'editor.folio.symbols.length')).toBe(2);
	await page.keyboard.press('Escape');

	// B : outil Barre ; F2 : modifier le repère du symbole sélectionné
	await page.keyboard.press('b');
	expect(await evalEditor<string>(page, 'editor.tool.kind')).toBe('bar');
	await page.keyboard.press('Escape');
	await evalEditor(page, `editor.select([{ kind: 'symbol', id: editor.folio.symbols[0].id }])`);
	await page.keyboard.press('F2');
	await expect(page.locator('.inspector input').first()).toBeFocused();
});

test('grille d’affichage : type, pas, visibilité, mémorisée', async ({ page }) => {
	await page.goto('/login');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Identifiant').fill('admin');
	await page.getByLabel('Mot de passe').fill('motdepasse-e2e');
	await page.locator('form button[type=submit]').click();
	await expect(page).toHaveURL(/\/$/);
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Projet de démonstration' }).click();
	await expect(page).toHaveURL(/\/projets\//);
	await expect(page.locator('.status.saved')).toBeVisible();

	// Points : visibles (taille constante à l'écran)
	await expect(page.locator('.canvas svg pattern#grid-points circle').first()).toBeAttached();
	await page.screenshot({ path: 'test-results/grille-points.png' });

	// Cases A–Q
	await page.getByRole('button', { name: /Grille : Points/ }).click();
	const panel = page.getByRole('dialog', { name: 'Grille d’affichage' });
	await panel.getByRole('button', { name: 'Cases A–Q' }).click();
	await expect(page.locator('.canvas svg .grid-layer line')).toHaveCount(16 + 10);
	await page.screenshot({ path: 'test-results/grille-cases.png' });

	// Quadrillage 10 mm, visibilité 30 %
	await panel.getByRole('button', { name: 'Quadrillage' }).click();
	await panel.getByRole('button', { name: '10 mm' }).click();
	await panel.getByRole('slider').fill('0.3');
	expect(await evalEditor<object>(page, 'JSON.parse(JSON.stringify(editor.grid))')).toEqual({
		show: true,
		kind: 'quadrillage',
		step: 10,
		opacity: 0.3,
		print: false
	});
	await page.screenshot({ path: 'test-results/grille-quadrillage.png' });

	// Fermeture au clic ailleurs ; G masque ; réglage conservé au rechargement
	await page.locator('.canvas svg').click({ position: { x: 5, y: 5 } });
	await expect(panel).toHaveCount(0);
	await page.keyboard.press('g');
	await expect(page.getByRole('button', { name: /Grille : masquée/ })).toBeVisible();
	await page.keyboard.press('g');
	await page.reload();
	await expect(page.locator('.status.saved')).toBeVisible();
	await expect(page.getByRole('button', { name: /Grille : Quadrillage/ })).toBeVisible();
	expect(await evalEditor<number>(page, 'editor.grid.step')).toBe(10);

	// Grille imprimable : cases A–Q dans le PDF
	await page.getByRole('button', { name: /Grille : Quadrillage/ }).click();
	await page
		.getByRole('dialog', { name: 'Grille d’affichage' })
		.getByRole('button', { name: 'Cases A–Q' })
		.click();
	await page.getByLabel('Imprimer la grille dans le PDF').check();
	await page.locator('.canvas svg').click({ position: { x: 5, y: 5 } });
	await page
		.locator('.toolbar')
		.getByRole('button', { name: /Exporter/ })
		.click();
	await expect(page.getByLabel(/Grille sur les folios/)).toBeChecked();
	const download = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Exporter le PDF' }).click();
	await (await download).saveAs('test-results/export-grille.pdf');
});

test('folio borniers automatique : dessin, filtre, double-clic, PDF', async ({ page }) => {
	await page.goto('/login');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Identifiant').fill('admin');
	await page.getByLabel('Mot de passe').fill('motdepasse-e2e');
	await page.locator('form button[type=submit]').click();
	await expect(page).toHaveURL(/\/$/);
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Exemple armoire complète' }).click();
	await expect(page).toHaveURL(/\/projets\//);
	await expect(page.locator('.status.saved')).toBeVisible();

	// Ajout après le folio 03 (pompe)
	await evalEditor(page, 'editor.setFolio(editor.project.folios[2].id)');
	await page.getByRole('button', { name: 'Nouveau folio' }).click();
	await page.getByRole('menuitem', { name: /Folio borniers/ }).click();
	expect(await evalEditor<number>(page, 'editor.folioIndex')).toBe(3);
	const svg = page.locator('.canvas svg');
	await expect(svg.locator('text', { hasText: 'Bornier C' })).toBeVisible();
	await expect(svg.locator('text', { hasText: 'Bornier P' })).toBeVisible();
	await expect(svg.locator('text', { hasText: 'KM1:2/T1' })).toBeVisible();
	await page.keyboard.press('f');
	await page.screenshot({ path: 'test-results/folio-borniers.png' });

	// Filtre : bornier P seul
	await page.getByLabel(/Bornier P/).check();
	await expect(svg.locator('text', { hasText: 'Bornier C' })).toHaveCount(0);
	await page.getByLabel('Tous').check();
	await expect(svg.locator('text', { hasText: 'Bornier C' })).toBeVisible();

	// Double-clic sur la borne P3 → son symbole dans le schéma (folio 02)
	await svg.locator('text', { hasText: /^P3$/ }).dblclick();
	expect(await evalEditor<number>(page, 'editor.folioIndex')).toBe(1);
	expect(await evalEditor<string>(page, 'editor.selection[0].kind')).toBe('symbol');

	// Export : les tableaux en fin de dossier sont décochés (le folio borniers suffit)
	await page
		.locator('.toolbar')
		.getByRole('button', { name: /Exporter/ })
		.click();
	await expect(page.getByLabel(/Tableaux des borniers/)).not.toBeChecked();
	const download = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Exporter le PDF' }).click();
	await (await download).saveAs('test-results/export-folio-borniers.pdf');
});

test('catalogue matériel, panneau Appareils, recherche Ctrl+F et nomenclature', async ({
	page
}) => {
	page.on('dialog', (d) => d.accept());
	await page.goto('/login');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Identifiant').fill('admin');
	await page.getByLabel('Mot de passe').fill('motdepasse-e2e');
	await page.locator('form button[type=submit]').click();
	await expect(page).toHaveURL(/\/$/);

	// Catalogue : import du catalogue de départ, recherche.
	await page.getByRole('link', { name: 'Catalogue' }).click();
	await expect(page).toHaveURL(/\/catalogue/);
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: /Importer le catalogue de départ/ }).click();
	await expect(page.getByText(/fiche\(s\) ajoutée\(s\)/)).toBeVisible();
	await expect(page.getByRole('cell', { name: 'LC1D09B7', exact: true })).toBeVisible();
	await page.screenshot({ path: 'test-results/catalogue.png', fullPage: true });
	await page.getByPlaceholder(/Rechercher \(référence/).fill('gv2 me08');
	await expect(page.locator('tbody tr')).toHaveCount(1);

	// Nouvelle fiche à la main.
	await page.getByRole('button', { name: /Nouvelle fiche/ }).click();
	await page.getByLabel('Référence *').fill('TEST-001');
	await page.getByLabel('Fabricant').fill('Maison');
	await page.getByLabel('Contacts NO').fill('2');
	await page.getByRole('button', { name: 'Enregistrer' }).click();
	await expect(page.getByText('Fiche « TEST-001 » enregistrée.')).toBeVisible();

	// Dossier : panneau Appareils.
	await page.getByRole('link', { name: 'Projets' }).click();
	await page.getByRole('button', { name: 'Exemple armoire complète' }).click();
	await expect(page).toHaveURL(/\/projets\//);
	await page.waitForLoadState('networkidle');
	await expect(page.locator('.status.saved')).toBeVisible();
	await openPanel(page, 'Appareils');
	await page.getByRole('button', { name: /^Sans réf\./ }).click();
	const firstRow = page.locator('.devices .row').first();
	const tag = (await firstRow.locator('.tag').textContent())!.trim();
	await firstRow.click();
	expect(
		await evalEditor<string>(
			page,
			`editor.project.devices[editor.folio.symbols.find((s) => s.id === editor.selection[0].id).deviceId].tag`
		)
	).toBe(tag);

	// Référence choisie dans le catalogue (casse / espaces indifférents).
	const ref = page.getByLabel('Référence constructeur');
	await ref.fill('lc1d09 b7');
	await ref.press('Tab');
	await expect(page.locator('.inspector p.catalog')).toContainText('Contacteur TeSys D 3P 9 A');
	const device = await evalEditor<{ reference: string; manufacturer: string }>(
		page,
		`Object.values(editor.project.devices).find((d) => d.tag === '${tag}')`
	);
	expect(device).toMatchObject({ reference: 'LC1D09B7', manufacturer: 'Schneider Electric' });
	expect(await evalEditor<boolean>(page, `!!editor.project.catalog.LC1D09B7`)).toBe(true);
	await page.screenshot({ path: 'test-results/appareils.png' });

	// Recherche Ctrl+F : aller à un appareil d'un autre folio.
	const target = await evalEditor<{ tag: string; folioId: string; symbolId: string }>(
		page,
		`(() => { const f = editor.project.folios.find((f) => f.id !== editor.folioId && f.symbols.length);
			const s = f.symbols.find((s) => editor.project.devices[s.deviceId]);
			return { tag: editor.project.devices[s.deviceId].tag, folioId: f.id, symbolId: s.id }; })()`
	);
	await page.keyboard.press('Escape');
	await page.keyboard.press('Control+f');
	const search = page.getByRole('textbox', { name: 'Rechercher dans le dossier' });
	await expect(search).toBeFocused();
	await search.fill(target.tag);
	await expect(page.locator('.search li button').first()).toContainText(target.tag);
	await page.screenshot({ path: 'test-results/recherche.png' });
	await search.press('Enter');
	await expect(search).toBeHidden();
	expect(await evalEditor<string>(page, 'editor.folioId')).toBe(target.folioId);
	expect(await evalEditor<number>(page, 'editor.selection.length')).toBe(1);

	// Relais avec embase : l'accessoire arrive dans la nomenclature.
	await evalEditor(
		page,
		`(() => { const d = Object.values(editor.project.devices).find((d) => d.tag === 'S1');
			editor.setReference(d.id, 'RXM4AB2B7'); })()`
	);
	expect(await evalEditor<boolean>(page, '!!editor.project.catalog.RXZE2S114M')).toBe(true);

	// Section par défaut des fils : affichée à côté du numéro.
	await dossierMenu(page, 'Propriétés du dossier…');
	await page.getByRole('button', { name: 'Numérotation, sections, couleurs' }).click();
	await page.getByRole('combobox', { name: /Section par défaut/ }).fill('0,75');
	await page.getByRole('button', { name: 'Enregistrer' }).click();
	await expect(page.locator('.canvas svg text', { hasText: '0,75²' }).first()).toBeVisible();
	await page.screenshot({ path: 'test-results/sections.png' });

	// Nomenclature : aperçu, puis PDF avec la nomenclature en fin de dossier.
	await page.getByRole('button', { name: /^Nomenclature$/ }).click();
	await expect(page.getByRole('cell', { name: 'LC1D09B7' })).toBeVisible();
	await expect(page.getByRole('cell', { name: 'accessoire de S1' })).toBeVisible();
	await page.screenshot({ path: 'test-results/nomenclature.png' });

	// Liste de commande : matériel d'armoire calculé, référence du rail, ligne libre.
	await page.getByRole('button', { name: 'Liste de commande' }).click();
	await expect(page.getByRole('cell', { name: /^Rail oméga/ })).toBeVisible();
	await page.getByLabel('Référence du rail').fill('NSYSDR200');
	await page.getByLabel('Référence du rail').press('Tab');
	await expect(page.getByRole('cell', { name: 'NSYSDR200' })).toBeVisible();
	await page.getByRole('button', { name: /Ajouter une ligne/ }).click();
	await page.getByLabel('Désignation de la ligne libre').fill('Presse-étoupe M20');
	await page.getByLabel('Désignation de la ligne libre').press('Tab');
	await page.getByLabel('Quantité de la ligne libre').fill('6');
	await page.getByLabel('Quantité de la ligne libre').press('Tab');
	await expect(page.locator('.wrap td', { hasText: 'Presse-étoupe M20' })).toBeVisible();
	expect(await evalEditor<number>(page, 'editor.project.orderExtras[0].quantity')).toBe(6);
	await page.screenshot({ path: 'test-results/liste-commande.png' });
	await page.getByRole('button', { name: 'Fermer' }).click();
	await page
		.locator('.toolbar')
		.getByRole('button', { name: /Exporter/ })
		.click();
	await expect(page.getByLabel(/Nomenclature par référence/)).toBeChecked();
	await page.getByLabel(/Liste de commande par/).check();
	const download = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Exporter le PDF' }).click();
	await (await download).saveAs('test-results/nomenclature.pdf');
	await expect(page.locator('.status.saved')).toBeVisible();
});

test('historique : version nommée, restauration, consultation, duplication', async ({ page }) => {
	page.on('dialog', (d) => d.accept());
	await page.goto('/login');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Identifiant').fill('admin');
	await page.getByLabel('Mot de passe').fill('motdepasse-e2e');
	await page.locator('form button[type=submit]').click();
	await expect(page).toHaveURL(/\/$/);
	await page.getByRole('button', { name: 'Projet de démonstration' }).click();
	await expect(page).toHaveURL(/\/projets\//);
	await page.waitForLoadState('networkidle');
	await expect(page.locator('.status.saved')).toBeVisible();
	const projectUrl = page.url();
	const count = () => evalEditor<number>(page, 'editor.folio.symbols.length');
	const initial = await count();

	// Version nommée.
	await dossierMenu(page, /Historique/);
	const dialog = page.getByRole('dialog');
	await expect(dialog.getByText('Création', { exact: true })).toBeVisible();
	await dialog.getByLabel('Commentaire de la version').fill('Envoyé au client');
	await dialog.getByRole('button', { name: /Enregistrer une version/ }).click();
	await expect(dialog.getByText('Envoyé au client', { exact: true })).toBeVisible();
	await page.keyboard.press('Escape');

	// Modification : suppression d'un symbole, enregistrée.
	await evalEditor(page, `editor.select([{ kind: 'symbol', id: editor.folio.symbols[0].id }])`);
	await page.keyboard.press('Delete');
	expect(await count()).toBe(initial - 1);
	await expect(page.locator('.status.saved')).toBeVisible();

	// Restauration de la version nommée : la page se recharge avec l'ancien état.
	await dossierMenu(page, /Historique/);
	const reloaded = page.waitForEvent('load');
	await dialog
		.locator('.version', { hasText: 'Envoyé au client' })
		.getByRole('button', { name: /Restaurer/ })
		.click();
	await reloaded;
	await page.waitForLoadState('networkidle');
	await expect(page.locator('.status.saved')).toBeVisible();
	expect(await count()).toBe(initial);
	await dossierMenu(page, /Historique/);
	await expect(dialog.getByText(/^Avant restauration de la version du/)).toBeVisible();
	await expect(dialog.getByText(/^Restauration de la version du/)).toBeVisible();
	await page.screenshot({ path: 'test-results/historique.png' });

	// Consultation de la version « Avant restauration » (symbole supprimé) : lecture seule.
	await dialog
		.locator('.version', { hasText: 'Avant restauration' })
		.getByRole('link', { name: /Voir/ })
		.click();
	await expect(page).toHaveURL(/\/versions\//);
	await expect(page.getByText('Version archivée — lecture seule')).toBeVisible();
	expect(await count()).toBe(initial - 1);
	expect(await evalEditor<boolean>(page, 'editor.readonly')).toBe(true);
	await page.screenshot({ path: 'test-results/version-consultation.png' });
	const download = page.waitForEvent('download');
	await page.getByRole('button', { name: /PDF de cette version/ }).click();
	await page.getByRole('button', { name: 'Exporter le PDF' }).click();
	await (await download).saveAs('test-results/version.pdf');
	await page.keyboard.press('Escape');

	// Nouveau dossier à partir de cette version.
	await page.getByRole('button', { name: /Nouveau dossier à partir de cette version/ }).click();
	await page.getByLabel('Nom du nouveau dossier').fill('Chaufferie B');
	await page.getByLabel("N° d'affaire").fill('DW999');
	await page.getByRole('button', { name: 'Dupliquer et ouvrir' }).click();
	await expect(page).not.toHaveURL(projectUrl);
	await expect(page).toHaveURL(/\/projets\/[^/]+$/);
	await page.waitForLoadState('networkidle');
	await expect(page.locator('.status.saved')).toBeVisible();
	expect(await evalEditor<string>(page, 'editor.project.meta.name')).toBe('Chaufferie B');
	expect(await evalEditor<string>(page, 'editor.project.meta.affaireNumber')).toBe('DW999');
	expect(await count()).toBe(initial - 1);
	await dossierMenu(page, /Historique/);
	await expect(dialog.getByText(/^Copie de « .* » \(version du/)).toBeVisible();
	await page.keyboard.press('Escape');

	// Liste des projets : dupliquer ouvre la même fenêtre.
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	await page
		.locator('tr', { hasText: 'Chaufferie B' })
		.getByTitle(/Dupliquer/)
		.click();
	await expect(page.getByLabel('Nom du nouveau dossier')).toHaveValue('Chaufferie B (copie)');
	await expect(page.getByLabel("N° d'affaire")).toHaveValue('DW999');
});

test('disposition : onglets de folios, barre latérale repliable, menu Dossier', async ({
	page
}) => {
	page.on('dialog', (d) => d.accept());
	await page.goto('/login');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Identifiant').fill('admin');
	await page.getByLabel('Mot de passe').fill('motdepasse-e2e');
	await page.locator('form button[type=submit]').click();
	await expect(page).toHaveURL(/\/$/);
	await page.getByRole('button', { name: 'Exemple armoire complète' }).click();
	await expect(page).toHaveURL(/\/projets\//);
	await page.waitForLoadState('networkidle');
	await expect(page.locator('.status.saved')).toBeVisible();
	const titles = () => evalEditor<string[]>(page, 'editor.project.folios.map((f) => f.title)');
	const tabs = page.getByRole('tab');
	const initial = await titles();
	await expect(tabs).toHaveCount(initial.length);

	// Clic sur un onglet : on y va.
	await tabs.nth(1).click();
	expect(await evalEditor<number>(page, 'editor.folioIndex')).toBe(1);

	// Double-clic : renommer.
	await tabs.nth(1).dblclick();
	await page.getByLabel('Titre du folio').first().fill('CHAUDIERE RENOMMEE');
	await page.keyboard.press('Enter');
	expect((await titles())[1]).toBe('CHAUDIERE RENOMMEE');

	// Clic droit : dupliquer (le doublon arrive juste après).
	await tabs.nth(1).click({ button: 'right' });
	await page.getByRole('menuitem', { name: /Dupliquer/ }).click();
	await expect(tabs).toHaveCount(initial.length + 1);
	expect(await evalEditor<number>(page, 'editor.folioIndex')).toBe(2);

	// Glisser l'onglet 1 tout à gauche.
	await tabs.nth(1).dragTo(tabs.nth(0), { targetPosition: { x: 4, y: 10 } });
	expect((await titles())[0]).toBe('CHAUDIERE RENOMMEE');

	// Nouveau folio par « + ».
	await page.getByRole('button', { name: 'Nouveau folio' }).click();
	await page.getByRole('menuitem', { name: 'Folio de schéma' }).click();
	await expect(tabs).toHaveCount(initial.length + 2);
	await page.screenshot({ path: 'test-results/disposition.png' });

	// Barre latérale : clic sur l'icône active = replier, puis rouvrir.
	await openPanel(page, 'Macros');
	await page.locator('.rail').getByRole('button', { name: 'Macros', exact: true }).click();
	await expect(page.locator('.sidebar.collapsed')).toBeVisible();
	await page.screenshot({ path: 'test-results/disposition-repliee.png' });
	await openPanel(page, 'Appareils');
	await expect(page.locator('.sidebar.collapsed')).toHaveCount(0);

	// Menu Dossier : nomenclature.
	await dossierMenu(page, /Nomenclature et liste de commande/);
	await expect(page.getByRole('dialog', { name: 'Nomenclature' })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.locator('.status.saved')).toBeVisible();
});

test('symboles favoris (mémorisés) et format des numéros de fils', async ({ page }) => {
	await page.goto('/login');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Identifiant').fill('admin');
	await page.getByLabel('Mot de passe').fill('motdepasse-e2e');
	await page.locator('form button[type=submit]').click();
	await expect(page).toHaveURL(/\/$/);
	await page.getByRole('button', { name: 'Projet de démonstration' }).click();
	await expect(page).toHaveURL(/\/projets\//);
	await page.waitForLoadState('networkidle');
	await expect(page.locator('.status.saved')).toBeVisible();

	// Barre de favoris par défaut, ajout d'un symbole par l'étoile.
	const favs = page.locator('.favorites .item');
	await expect(favs.first()).toBeVisible();
	const before = await favs.count();
	await page
		.locator('.cell:has(button.item[title^="Fusible ("])')
		.getByRole('button', { name: 'Favori' })
		.click();
	await expect(favs).toHaveCount(before + 1);
	await expect(favs.last()).toContainText('Fusible');
	await page.screenshot({ path: 'test-results/favoris.png' });

	// Mémorisé côté serveur : toujours là après rechargement.
	await page.reload();
	await page.waitForLoadState('networkidle');
	await expect(page.locator('.favorites .item').last()).toContainText('Fusible');

	// Clic sur un favori : outil de pose de ce symbole.
	await page.locator('.favorites .item', { hasText: 'Fusible' }).click();
	expect(await evalEditor<string>(page, 'editor.tool.defId')).toBe('fusible');
	await page.keyboard.press('Escape');

	// Format des numéros de fils : par folio, façon WinRelais.
	await dossierMenu(page, 'Propriétés du dossier…');
	await page.getByRole('button', { name: 'Numérotation, sections, couleurs' }).click();
	await page
		.getByRole('combobox', { name: 'Format du numéro' })
		.selectOption({ label: 'Par folio, façon WinRelais (F03/12)' });
	await expect(page.getByText(/exemple : F03\/12/)).toBeVisible();
	await page.getByRole('button', { name: 'Enregistrer' }).click();
	await expect(page.locator('.canvas svg text', { hasText: /^F01\/01$/ }).first()).toBeVisible();
	await page.keyboard.press('PageDown');
	await expect(page.locator('.canvas svg text', { hasText: /^F02\/01$/ }).first()).toBeVisible();
	await page.screenshot({ path: 'test-results/numeros-par-folio.png' });
	await expect(page.locator('.status.saved')).toBeVisible();
});

test('sociétés et rôles : lecteur en lecture seule, sociétés cloisonnées', async ({ page }) => {
	const login = async (id: string, password: string) => {
		await page.goto('/login');
		await page.waitForLoadState('networkidle');
		await page.getByLabel('Identifiant').fill(id);
		await page.getByLabel('Mot de passe').fill(password);
		await page.locator('form button[type=submit]').click();
		await expect(page).toHaveURL(/\/$/);
		await page.waitForLoadState('networkidle');
	};
	const logout = async () => {
		await page.getByRole('button', { name: /Déconnexion/ }).click();
		await expect(page).toHaveURL(/\/login/);
	};

	// Le premier compte est super-administrateur : menus Sociétés et Sauvegardes.
	await login('admin', 'motdepasse-e2e');
	await expect(page.getByRole('link', { name: /Sociétés/ })).toBeVisible();
	const projectCount = await page.locator('table a.name').count();
	expect(projectCount).toBeGreaterThan(0);

	// Un lecteur dans la société.
	await page.getByRole('link', { name: /Utilisateurs/ }).click();
	await page.getByRole('button', { name: /Nouvel utilisateur/ }).click();
	await page.getByLabel('Identifiant').fill('lecteur');
	await page.getByLabel('Nom affiché').fill('Léa Lecture');
	await page.getByLabel('Mot de passe').fill('lecteur-e2e');
	await page.getByLabel('Rôle').selectOption('viewer');
	await expect(page.getByText(/Lecture seule : consulter/)).toBeVisible();
	await page.getByRole('button', { name: 'Créer', exact: true }).click();
	await expect(page.getByText('Utilisateur créé.')).toBeVisible();

	// Une autre société avec son administrateur.
	await page.getByRole('link', { name: /Sociétés/ }).click();
	await page.getByRole('button', { name: /Nouvelle société/ }).click();
	await page.getByLabel('Nom de la société').fill('Autre Société');
	await page.getByLabel('Identifiant').fill('autre-admin');
	await page.getByLabel('Nom affiché').fill('Admin Autre');
	await page.getByLabel('Mot de passe').fill('autre-e2e');
	await page.getByRole('button', { name: 'Créer', exact: true }).click();
	await expect(page.getByText('Société créée avec son administrateur.')).toBeVisible();
	await expect(page.getByRole('cell', { name: /Autre Société/ })).toBeVisible();
	await page.screenshot({ path: 'test-results/societes.png' });
	await logout();

	// Lecteur : voit les dossiers, ne peut rien créer ni modifier.
	await login('lecteur', 'lecteur-e2e');
	await expect(page.locator('table a.name')).toHaveCount(projectCount);
	await expect(page.getByRole('button', { name: /Nouveau projet/ })).toHaveCount(0);
	await expect(page.getByRole('link', { name: /Utilisateurs/ })).toHaveCount(0);
	await page.locator('table a.name').first().click();
	await expect(page).toHaveURL(/\/projets\//);
	await expect(page.getByText('Lecture seule (compte lecteur)')).toBeVisible();
	expect(await evalEditor<boolean>(page, 'editor.readonly')).toBe(true);
	// Le serveur refuse aussi l'écriture.
	const status = await page.evaluate(async () => {
		const id = location.pathname.split('/').pop();
		const res = await fetch(`/api/projects/${id}`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ data: {} })
		});
		return res.status;
	});
	expect(status).toBe(403);
	await page.screenshot({ path: 'test-results/lecteur.png' });
	await page.goto('/');
	await logout();

	// Administrateur de l'autre société : aucun dossier de Dumortier.
	await login('autre-admin', 'autre-e2e');
	await expect(page.locator('table a.name')).toHaveCount(0);
	await expect(page.getByText('Autre Société')).toBeVisible();
	await expect(page.getByRole('link', { name: /Sociétés/ })).toHaveCount(0);
	await logout();

	// Super-administrateur : entre dans l'autre société, puis revient.
	await login('admin', 'motdepasse-e2e');
	await page.getByRole('combobox', { name: 'Société' }).selectOption({ label: 'Autre Société' });
	await expect(page.locator('table a.name')).toHaveCount(0);
	await page.getByRole('combobox', { name: 'Société' }).selectOption({ label: 'Ma société' });
	await expect(page.locator('table a.name')).not.toHaveCount(0);
});

test('clients et affaires : saisie, rattachement, cartouche, reprise de l’existant', async ({
	page
}) => {
	await page.goto('/login');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Identifiant').fill('admin');
	await page.getByLabel('Mot de passe').fill('motdepasse-e2e');
	await page.locator('form button[type=submit]').click();
	await expect(page).toHaveURL(/\/$/);

	// Reprise de l'existant : les dossiers de démonstration sont classés par leur cartouche.
	await page.getByRole('navigation').getByRole('link', { name: 'Affaires' }).click();
	await page.waitForLoadState('networkidle');
	await expect(page.getByText(/schéma\(s\) non classé\(s\)/)).toBeVisible();
	await page.getByRole('button', { name: /Classer l’existant/ }).click();
	await page.getByRole('button', { name: /^Classer \d+ schéma/ }).click();
	await expect(page.getByText(/schéma\(s\) classé\(s\)/)).toBeVisible();
	await expect(
		page.locator('tr', { hasText: 'Démo — chaufferie collective' }).filter({ hasText: 'D223456' })
	).toBeVisible();

	// Un client, puis une affaire (n° WhySoft unique).
	await page.getByRole('tab', { name: /Clients/ }).click();
	await page.getByRole('button', { name: /Nouveau client/ }).click();
	await page.getByLabel('Nom du client').fill('Collège Jean Moulin');
	await page.getByLabel('Ville').fill('Laon');
	await page.getByRole('button', { name: 'Enregistrer' }).click();
	await expect(page.getByText('Client enregistré.')).toBeVisible();
	await page.getByRole('tab', { name: /Affaires/ }).click();
	const newAffaire = async (whysoft: string) => {
		await page.getByRole('button', { name: /Nouvelle affaire/ }).click();
		await page
			.getByRole('combobox', { name: 'Client', exact: true })
			.selectOption({ label: 'Collège Jean Moulin' });
		await page.getByLabel('N° WhySoft').fill(whysoft);
		await page.getByLabel('Désignation').fill('Chaufferie');
		await page.getByRole('button', { name: 'Enregistrer' }).click();
	};
	await newAffaire('WS-E2E-1');
	await expect(page.getByText('Affaire enregistrée.')).toBeVisible();
	await newAffaire('WS-E2E-1');
	await expect(page.getByText(/déjà celui d’une autre affaire/)).toBeVisible();
	await page.getByRole('button', { name: 'Annuler', exact: true }).click();
	await page.screenshot({ path: 'test-results/affaires.png' });

	// Nouveau schéma rattaché : client et n° WhySoft viennent de l'affaire.
	await page.getByRole('link', { name: /Projets/ }).click();
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: /Nouveau projet/ }).click();
	await page.getByLabel('Nom du projet').fill('Armoire chaufferie');
	await page
		.getByRole('combobox', { name: /^Affaire/ })
		.selectOption({ label: 'Collège Jean Moulin — WS-E2E-1 · Chaufferie (2026)' });
	await expect(page.getByRole('textbox', { name: 'Client', exact: true })).toHaveCount(0);
	await page.getByRole('button', { name: 'Créer et ouvrir' }).click();
	await expect(page).toHaveURL(/\/projets\//);
	await page.waitForLoadState('networkidle');
	expect(await evalEditor<string>(page, 'editor.project.meta.client')).toBe('Collège Jean Moulin');
	expect(await evalEditor<string>(page, 'editor.project.meta.whysoft')).toBe('WS-E2E-1');
	await dossierMenu(page, 'Propriétés du dossier…');
	await expect(page.getByRole('textbox', { name: 'N° WhySoft' })).toBeDisabled();
	await expect(page.getByRole('textbox', { name: 'Client / site' })).toBeDisabled();
	// Détacher : le client redevient modifiable.
	await page.getByRole('combobox', { name: /^Affaire/ }).selectOption({ label: 'Non classé' });
	await expect(page.getByRole('textbox', { name: 'Client / site' })).toBeEnabled();
	await page.getByRole('button', { name: 'Annuler', exact: true }).click();
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	await page.getByRole('tab', { name: 'Récents' }).click();
	const row = page.locator('tr', { hasText: 'Armoire chaufferie' });
	await expect(row.getByRole('link', { name: 'WS-E2E-1' })).toBeVisible();
	await page.getByPlaceholder(/WhySoft/).fill('ws-e2e');
	await expect(page.locator('table a.name')).toHaveCount(1);

	// Affaire avec un schéma : suppression refusée ; fiche avec ses schémas.
	await page.getByRole('navigation').getByRole('link', { name: 'Affaires' }).click();
	await page.waitForLoadState('networkidle');
	const affaireRow = page.locator('tr', { hasText: 'WS-E2E-1' });
	await expect(affaireRow.getByRole('button', { name: 'Supprimer' })).toHaveCount(0);
	await affaireRow.getByRole('button', { name: /Schémas de l’affaire/ }).click();
	await expect(page.getByRole('link', { name: 'Armoire chaufferie' })).toBeVisible();
});

test('page Projets : arbre par affaire, filtres, création guidée, fiche affaire et PDF', async ({
	page
}) => {
	await page.goto('/login');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Identifiant').fill('admin');
	await page.getByLabel('Mot de passe').fill('motdepasse-e2e');
	await page.locator('form button[type=submit]').click();
	await expect(page).toHaveURL(/\/$/);
	await page.waitForLoadState('networkidle');

	// Vue « Par affaire » (par défaut) : client › affaire › schémas.
	await expect(page.getByRole('tab', { name: 'Par affaire' })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	await expect(page.getByRole('button', { name: 'Collège Jean Moulin' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'WS-E2E-1 · Chaufferie' })).toBeVisible();
	const total = await page.locator('table a.name').count();

	// Filtres : non classé, client.
	await page.getByRole('combobox', { name: 'Statut' }).selectOption('non_classe');
	await expect(page.getByRole('button', { name: 'Non classé' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Collège Jean Moulin' })).toHaveCount(0);
	await page.getByRole('button', { name: 'Effacer les filtres' }).click();
	await page
		.getByRole('combobox', { name: 'Client' })
		.selectOption({ label: 'Collège Jean Moulin' });
	await expect(page.locator('table a.name')).toHaveCount(1);
	await page.getByRole('button', { name: 'Effacer les filtres' }).click();
	await expect(page.locator('table a.name')).toHaveCount(total);

	// Création guidée : nouvelle affaire chez un nouveau client.
	await page.getByRole('button', { name: /Nouveau projet/ }).click();
	await page
		.getByRole('combobox', { name: /^Affaire/ })
		.selectOption({ label: '+ Nouvelle affaire…' });
	await page
		.getByRole('combobox', { name: 'Client de l’affaire' })
		.selectOption({ label: '+ Nouveau client…' });
	await page.getByLabel('Nom du nouveau client').fill('Hôpital de Laon');
	await page.getByLabel('N° WhySoft').fill('WS-E2E-2');
	await page.getByLabel('Désignation de l’affaire').fill('Sous-station');
	await page.getByLabel('Nom du projet').fill('Armoire sous-station');
	await page.getByRole('button', { name: 'Créer et ouvrir' }).click();
	await expect(page).toHaveURL(/\/projets\//);
	await page.waitForLoadState('networkidle');
	expect(await evalEditor<string>(page, 'editor.project.meta.client')).toBe('Hôpital de Laon');
	expect(await evalEditor<string>(page, 'editor.project.meta.whysoft')).toBe('WS-E2E-2');
	await expect(page.locator('.status.saved')).toBeVisible();

	// Fiche affaire : schémas, PDF, nouveau schéma dans l'affaire, statut.
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	await page.getByRole('link', { name: 'WS-E2E-2 · Sous-station' }).click();
	await expect(page).toHaveURL(/\/affaires\/aff/);
	await page.waitForLoadState('networkidle');
	await expect(page.getByRole('heading', { name: 'WS-E2E-2 · Sous-station' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Armoire sous-station' })).toBeVisible();
	const download = page.waitForEvent('download');
	await page.getByRole('button', { name: 'PDF du dossier' }).click();
	expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
	await page.screenshot({ path: 'test-results/fiche-affaire.png' });
	await page
		.getByRole('button', { name: /Nouveau schéma/ })
		.first()
		.click();
	await expect(page.getByRole('combobox', { name: /^Affaire/ })).toHaveValue(/^aff/);
	await page.getByLabel('Nom du projet').fill('Armoire sous-station 2');
	await page.getByRole('button', { name: 'Créer et ouvrir' }).click();
	await expect(page).toHaveURL(/\/projets\//);
	await page.waitForLoadState('networkidle');
	expect(await evalEditor<string>(page, 'editor.project.meta.whysoft')).toBe('WS-E2E-2');
	await page.goBack();
	await page.waitForLoadState('networkidle');
	await expect(page.locator('table a.name')).toHaveCount(2);
	await page.getByRole('combobox', { name: 'Statut de l’affaire' }).selectOption('terminee');
	await expect(page.locator('.toolbar .status')).toHaveText('Terminée');
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	await page.screenshot({ path: 'test-results/projets-par-affaire.png' });
});

test('fils : départ dans le sens de la borne, borne visée, couleur', async ({ page }) => {
	await page.goto('/login');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Identifiant').fill('admin');
	await page.getByLabel('Mot de passe').fill('motdepasse-e2e');
	await page.locator('form button[type=submit]').click();
	await expect(page).toHaveURL(/\/$/);
	await page.getByRole('button', { name: 'Projet de démonstration' }).click();
	await expect(page).toHaveURL(/\/projets\//);
	await page.waitForLoadState('networkidle');
	await expect(page.locator('.status.saved')).toBeVisible();

	// Folio vidé, une bobine : A2 sort vers le bas.
	await evalEditor(
		page,
		`editor.transact('Vider', (p, f) => { f.symbols = []; f.wires = []; f.bars = []; f.texts = []; })`
	);
	await evalEditor(
		page,
		`editor.setTool({ kind: 'place', defId: 'bobine-contacteur', rotation: 0 })`
	);
	await clickAt(page, { x: 100, y: 80 });
	await page.keyboard.press('Escape');
	const a2 = await evalEditor<{ x: number; y: number; dir: string }>(
		page,
		`window.__schemelect.symbolTerminals(editor.folio.symbols[0]).find((t) => t.dir === 's')`
	);

	// Outil Fil : la borne visée affiche son nom.
	await page.keyboard.press('w');
	await clickAt(page, { x: a2.x + 0.3, y: a2.y });
	await expect(page.locator('.snap-label')).toHaveText(/\d+ : A2$/);
	// Cible au-dessus à gauche : le fil sort d'abord vers le bas.
	await clickAt(page, { x: a2.x - 30, y: a2.y - 20 }, true);
	const pts = await evalEditor<{ x: number; y: number }[]>(page, 'editor.folio.wires[0].points');
	expect(pts[0]).toEqual({ x: a2.x, y: a2.y });
	expect(pts[1].x).toBeCloseTo(a2.x, 5);
	expect(pts[1].y).toBeGreaterThan(a2.y);
	await page.keyboard.press('Escape');

	// Couleur imposée dans l'inspecteur : tracé rouge.
	await evalEditor(page, `editor.selection = [{ kind: 'wire', id: editor.folio.wires[0].id }]`);
	await page.getByRole('combobox', { name: 'Couleur du fil' }).selectOption('Rouge');
	expect(await evalEditor<string>(page, 'editor.folio.wires[0].color')).toBe('Rouge');
	await expect(page.locator('.canvas path[stroke="#e0241b"]').first()).toBeVisible();
	await page.screenshot({ path: 'test-results/fil-couleur.png' });
	await expect(page.locator('.status.saved')).toBeVisible();
});
