/**
 * État de l'éditeur (Svelte 5 runes). Toute modification du projet passe par
 * `transact` (ou un geste begin/end) : c'est ce qui alimente l'historique et la
 * sauvegarde automatique. Les règles métier sont dans $lib/model.
 */
import { analyzeProject, type ProjectAnalysis } from '$lib/model/analysis';
import * as edit from '$lib/model/edit';
import {
	extractFragment,
	fragmentOrigin,
	insertFragment,
	isEmptyFragment,
	normalizeFragment,
	translateFragment,
	type Fragment
} from '$lib/model/fragments';
import { snapPoint } from '$lib/model/geometry';
import { symbolBounds } from '$lib/model/symbolGeometry';
import { deepClone } from '$lib/model/ids';
import type { Folio, Id, ItemRef, Point, Project, Rotation } from '$lib/model/types';
import { deleteCustomSymbol, listCustomSymbols, saveCustomSymbol } from '$lib/api/client';
import { registerCustomSymbols } from '$lib/symbols';
import type { CustomSymbolSpec } from '$lib/symbols/custom';
import type { SymbolDef } from '$lib/symbols/types';
import { bumpCustomSymbols } from '$lib/symbols/version.svelte';
import { History } from './history';
import { Viewport } from './viewport.svelte';

export type Tool =
	| { kind: 'select' }
	| { kind: 'wire' }
	| { kind: 'place'; defId: string; rotation: Rotation; mirror: boolean }
	| { kind: 'paste'; fragment: Fragment; devices: 'renumber' | 'keep' }
	| { kind: 'bar'; potentialId: Id }
	| { kind: 'text' }
	| { kind: 'rect' };

const CLIPBOARD_KEY = 'schemelect:clipboard';

export class Editor {
	project: Project = $state(null as unknown as Project);
	folioId: Id = $state('');
	selection: ItemRef[] = $state([]);
	tool: Tool = $state({ kind: 'select' });
	readonly = $state(false);
	/** Position du curseur (mm, magnétisée). */
	cursor: Point | null = $state(null);
	/** Incrémenté à chaque modification : déclenche la sauvegarde automatique. */
	revision = $state(0);
	canUndo = $state(false);
	canRedo = $state(false);
	showGrid = $state(true);
	showOpenTerminals = $state(true);
	/** Demande de focus sur un champ de l'inspecteur (ex. repère après double-clic). */
	focusRequest = $state<{ field: string; at: number } | null>(null);

	/**
	 * Analyse figée pendant un geste (glisser) : le recalcul complet du dossier n'a lieu
	 * qu'au lâcher, pour rester fluide sur les gros dossiers.
	 */
	private frozenAnalysis: ProjectAnalysis | null = $state.raw(null);
	analysis: ProjectAnalysis = $derived(this.frozenAnalysis ?? analyzeProject(this.project));
	folio: Folio = $derived(
		this.project.folios.find((f) => f.id === this.folioId) ?? this.project.folios[0]
	);
	folioIndex = $derived(this.project.folios.findIndex((f) => f.id === this.folio.id));

	/**
	 * Poignée de redimensionnement : coin opposé à l'origine du symbole maison
	 * sélectionné (seul). Null si rien de redimensionnable n'est sélectionné.
	 */
	scaleHandle = $derived.by(() => {
		if (this.readonly || this.selection.length !== 1 || this.selection[0].kind !== 'symbol')
			return null;
		const id = this.selection[0].id;
		const s = this.folio.symbols.find((x) => x.id === id);
		if (!s || !edit.isScalable(s)) return null;
		const b = symbolBounds(s);
		const corners = [
			{ x: b.x, y: b.y },
			{ x: b.x + b.w, y: b.y },
			{ x: b.x, y: b.y + b.h },
			{ x: b.x + b.w, y: b.y + b.h }
		];
		const far = corners.sort(
			(p, q) => Math.hypot(q.x - s.x, q.y - s.y) - Math.hypot(p.x - s.x, p.y - s.y)
		)[0];
		return { symbolId: s.id, x: far.x, y: far.y, origin: { x: s.x, y: s.y }, scale: s.scale ?? 1 };
	});

	/** Bibliothèque partagée des symboles maison (chargée depuis le serveur). */
	customLibrary: SymbolDef[] = $state([]);
	/** Éditeur de symbole maison ouvert : `spec` null = création. */
	symbolEditor: { spec: CustomSymbolSpec | null } | null = $state(null);

	readonly viewport = new Viewport();
	private history = new History<Project>();
	private gestureBase: Project | null = null;

	constructor(project: Project, readonly = false) {
		// Symboles maison embarqués dans le projet : disponibles avant la 1re analyse.
		registerCustomSymbols(Object.values(project.customSymbols ?? {}));
		this.project = project;
		this.folioId = project.folios[0]?.id ?? '';
		this.readonly = readonly;
	}

	// ------------------------------------------------------------ transactions

	private snapshot(): Project {
		return deepClone($state.snapshot(this.project) as Project);
	}

	private changed() {
		this.project.meta.modifiedAt = new Date().toISOString();
		this.revision++;
		this.syncHistoryFlags();
	}

	private syncHistoryFlags() {
		this.canUndo = this.history.canUndo;
		this.canRedo = this.history.canRedo;
	}

	/** Modification atomique annulable. */
	transact(label: string, fn: (project: Project, folio: Folio) => void) {
		if (this.readonly) return;
		const before = this.snapshot();
		fn(this.project, this.folio);
		this.history.push(label, before);
		this.changed();
		this.pruneSelection();
	}

	/** Début d'un geste continu (glisser) : un seul pas d'historique à la fin. */
	beginGesture() {
		if (this.readonly) return;
		this.gestureBase = this.snapshot();
		this.frozenAnalysis = this.analysis;
	}

	/** Modification pendant un geste (pas d'historique intermédiaire). */
	gesture(fn: (project: Project, folio: Folio) => void) {
		if (this.readonly || !this.gestureBase) return;
		fn(this.project, this.folio);
	}

	endGesture(label: string, changed: boolean) {
		if (this.gestureBase && changed) {
			this.history.push(label, this.gestureBase);
			this.changed();
		}
		this.gestureBase = null;
		this.frozenAnalysis = null;
	}

	undo() {
		const prev = this.history.undo(this.snapshot());
		if (prev) this.restore(prev);
	}

	redo() {
		const next = this.history.redo(this.snapshot());
		if (next) this.restore(next);
	}

	private restore(state: Project) {
		this.project = state;
		if (!state.folios.some((f) => f.id === this.folioId)) this.folioId = state.folios[0].id;
		this.revision++;
		this.syncHistoryFlags();
		this.pruneSelection();
	}

	// ------------------------------------------------------------ sélection

	private pruneSelection() {
		const existing = new Set(edit.allItems(this.folio).map((r) => r.id));
		if (this.selection.some((r) => !existing.has(r.id)))
			this.selection = this.selection.filter((r) => existing.has(r.id));
	}

	isSelected(ref: ItemRef) {
		return this.selection.some((r) => r.id === ref.id);
	}

	select(refs: ItemRef[], additive = false) {
		if (!additive) {
			this.selection = refs;
			return;
		}
		const next = [...this.selection];
		for (const r of refs) {
			const i = next.findIndex((x) => x.id === r.id);
			if (i >= 0) next.splice(i, 1);
			else next.push(r);
		}
		this.selection = next;
	}

	selectAll() {
		this.selection = edit.allItems(this.folio);
	}

	clearSelection() {
		this.selection = [];
	}

	// ------------------------------------------------------------ navigation

	setFolio(id: Id) {
		if (id === this.folioId) return;
		this.folioId = id;
		this.selection = [];
		if (this.tool.kind === 'wire') this.setTool({ kind: 'select' });
	}

	stepFolio(delta: number) {
		const next = this.project.folios[this.folioIndex + delta];
		if (next) this.setFolio(next.id);
	}

	/** Va au symbole (autre folio si besoin), le sélectionne et centre la vue dessus. */
	goToSymbol(id: Id) {
		const folio = this.project.folios.find((f) => f.symbols.some((s) => s.id === id));
		const s = folio?.symbols.find((x) => x.id === id);
		if (!folio || !s) return;
		this.setFolio(folio.id);
		this.selection = [{ kind: 'symbol', id }];
		const b = edit.itemBounds(folio, { kind: 'symbol', id });
		if (b) this.viewport.centerOn(b.x + b.w / 2, b.y + b.h / 2);
	}

	setTool(tool: Tool) {
		this.tool = tool;
	}

	// ------------------------------------------------------------ commandes

	deleteSelection() {
		if (!this.selection.length) return;
		const refs = this.selection;
		this.transact('Supprimer', (p, f) => edit.deleteItems(p, f, refs));
		this.selection = [];
	}

	rotate() {
		if (this.tool.kind === 'place') {
			this.tool = { ...this.tool, rotation: ((this.tool.rotation + 90) % 360) as Rotation };
			return;
		}
		if (!this.selection.length) return;
		const refs = this.selection;
		this.transact('Pivoter', (_, f) => edit.rotateItems(f, refs));
	}

	mirror() {
		if (this.tool.kind === 'place') {
			this.tool = { ...this.tool, mirror: !this.tool.mirror };
			return;
		}
		if (!this.selection.length) return;
		const refs = this.selection;
		this.transact('Miroir', (_, f) => edit.mirrorItems(f, refs));
	}

	align(mode: edit.AlignMode) {
		if (this.selection.length < 2) return;
		const refs = this.selection;
		this.transact('Aligner', (_, f) => edit.alignItems(f, refs, mode));
	}

	distribute(direction: 'horizontal' | 'vertical') {
		if (this.selection.length < 3) return;
		const refs = this.selection;
		this.transact('Répartir', (_, f) => edit.distributeItems(f, refs, direction));
	}

	nudge(dx: number, dy: number) {
		if (!this.selection.length) return;
		const refs = this.selection;
		this.transact('Déplacer', (_, f) => edit.moveItems(f, refs, dx, dy));
	}

	copy(): Fragment | null {
		if (!this.selection.length) return null;
		const frag = normalizeFragment(extractFragment(this.project, this.folio, this.selection));
		try {
			localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(frag));
		} catch {
			/* stockage indisponible : presse-papiers local seulement */
		}
		this.clipboard = frag;
		return frag;
	}

	cut() {
		if (!this.copy()) return;
		this.clipboardMode = 'keep';
		this.deleteSelection();
	}

	private clipboard: Fragment | null = null;
	private clipboardMode: 'renumber' | 'keep' = 'renumber';

	paste() {
		let frag = this.clipboard;
		try {
			const raw = localStorage.getItem(CLIPBOARD_KEY);
			if (raw) frag = JSON.parse(raw) as Fragment;
		} catch {
			/* ignore */
		}
		if (!frag || isEmptyFragment(frag)) return;
		this.tool = { kind: 'paste', fragment: frag, devices: this.clipboardMode };
		this.clipboardMode = 'renumber';
	}

	/** Duplique la sélection à côté (Ctrl+D). */
	duplicate() {
		if (!this.selection.length) return;
		const frag = extractFragment(this.project, this.folio, this.selection);
		translateFragment(frag, 10, 10);
		let refs: ItemRef[] = [];
		this.transact(
			'Dupliquer',
			(p, f) => (refs = insertFragment(p, f, frag, { devices: 'renumber' }))
		);
		this.selection = refs;
	}

	/** Pose un fragment (collage, macro) avec son coin haut-gauche au point donné. */
	placeFragment(fragment: Fragment, at: Point, devices: 'renumber' | 'keep', label = 'Coller') {
		const o = fragmentOrigin(fragment);
		const p = snapPoint(at);
		const frag = translateFragment(deepClone(fragment), p.x - o.x, p.y - o.y);
		let refs: ItemRef[] = [];
		this.transact(label, (proj, f) => (refs = insertFragment(proj, f, frag, { devices })));
		this.selection = refs;
	}

	/** Fragment de la sélection courante, normalisé (pour créer une macro). */
	selectionFragment(): Fragment | null {
		if (!this.selection.length) return null;
		return normalizeFragment(extractFragment(this.project, this.folio, this.selection));
	}

	// ------------------------------------------------------------ symboles maison

	async loadCustomLibrary() {
		try {
			this.customLibrary = await listCustomSymbols();
			registerCustomSymbols(this.customLibrary);
			// La copie du projet prime (le dossier ne change pas tout seul).
			registerCustomSymbols(Object.values(this.project.customSymbols));
			bumpCustomSymbols();
		} catch {
			/* bibliothèque indisponible : les symboles du projet restent utilisables */
		}
	}

	/**
	 * Enregistre un symbole maison dans la bibliothèque partagée. S'il est déjà utilisé
	 * dans le projet, sa copie embarquée est mise à jour (tous ses exemplaires suivent).
	 */
	async saveCustomSymbol(def: SymbolDef) {
		const saved = await saveCustomSymbol(def);
		registerCustomSymbols([saved]);
		this.customLibrary = [...this.customLibrary.filter((d) => d.id !== saved.id), saved];
		if (this.project.customSymbols[saved.id])
			this.transact('Modifier le symbole', (p) => (p.customSymbols[saved.id] = deepClone(saved)));
		bumpCustomSymbols();
		return saved;
	}

	async deleteCustomSymbol(id: string) {
		await deleteCustomSymbol(id);
		this.customLibrary = this.customLibrary.filter((d) => d.id !== id);
	}

	requestFocus(field: string) {
		this.focusRequest = { field, at: Date.now() };
	}
}
