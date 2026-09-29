/**
 * Style graphique des schémas (écran ET PDF).
 *
 * C'est le SEUL endroit à modifier pour changer l'apparence des folios :
 * épaisseurs, couleurs, polices, tailles de texte. Les valeurs sont des
 * attributs SVG concrets (pas de variables CSS) pour que l'export PDF
 * produise exactement le même rendu qu'à l'écran.
 *
 * Le style de l'INTERFACE (panneaux, boutons…) est dans src/lib/styles/tokens.css.
 */
import type { FillKind, StrokeKind, Tone } from '$lib/symbols/types';

export const schematic = {
	font: 'Helvetica, Arial, sans-serif',

	color: {
		paper: '#ffffff',
		ink: '#111111',
		accent: '#e0001a',
		muted: '#8a8a8a',
		terminal: '#e0001a',
		wireNumber: '#1f3fd6',
		reference: '#1f3fd6',
		junction: '#1f3fd6',
		frame: '#111111',
		gridText: '#111111',
		openTerminal: '#ff8a00'
	},

	stroke: {
		normal: 0.25,
		thin: 0.15,
		thick: 0.5,
		wire: 0.3,
		bar: 0.35,
		frame: 0.35,
		frameInner: 0.2,
		dash: '1.2 0.8'
	},

	text: {
		tag: 2.4,
		value: 2.1,
		designation: 2.1,
		reference: 2.0,
		terminal: 1.5,
		wireNumber: 2.8,
		xref: 1.8,
		barName: 2.4,
		gridLabel: 2.6,
		titleblock: { small: 2.0, normal: 2.8, big: 3.4 },
		/** Page de garde. */
		cover: {
			summary: 2.6,
			company: 8,
			address: 3.2,
			title: 7,
			client: 4,
			tableHeader: 3.6,
			tableCell: 3.4,
			footerLabel: 3.4,
			footerValue: 3.4,
			folioCount: 5.5
		},
		/** Tableaux des folios générés (borniers…). */
		table: { title: 3.2, header: 2.4, cell: 2.3 }
	},

	/** Page de garde : cadres à coins arrondis. */
	cover: {
		radius: 2.5,
		stroke: 0.25,
		tableStroke: 0.35
	},

	/** Tableaux (sommaire, borniers) : traits et fond d'en-tête. */
	table: {
		stroke: 0.2,
		strokeStrong: 0.35,
		headerFill: '#eeeeee'
	},

	terminalMarker: { show: true, size: 0.9 },
	junctionRadius: 0.75,

	/** Écart entre un fil vertical et son numéro. */
	wireNumberOffset: 0.8,

	/** Largeur moyenne d'un caractère Helvetica, en fraction de la taille de police (césure, troncature). */
	charWidth: 0.56
} as const;

export type SchematicTheme = typeof schematic;

/** Couleurs de signalisation reconnues dans la valeur d'un appareil (voyants…). */
export const signalColors: Record<string, string> = {
	rouge: '#e0241b',
	vert: '#1a9a3c',
	orange: '#f08a00',
	jaune: '#e6b800',
	bleu: '#1f4fe0',
	blanc: '#8a8a8a'
};

/** Couleur de signalisation déduite d'une valeur (« Rouge », « voyant vert »…), sinon undefined. */
export function signalColor(value: string | undefined): string | undefined {
	const v = (value ?? '').toLowerCase();
	const key = Object.keys(signalColors).find((k) => v.includes(k));
	return key ? signalColors[key] : undefined;
}

export function toneColor(tone: Tone | undefined, signal?: string): string {
	if (tone === 'signal') return signal ?? schematic.color.ink;
	return tone === 'accent'
		? schematic.color.accent
		: tone === 'muted'
			? schematic.color.muted
			: schematic.color.ink;
}

export function strokeAttrs(
	kind: StrokeKind | undefined,
	tone?: Tone,
	signal?: string,
	/** Échelle du groupe parent : l'épaisseur est compensée pour rester constante. */
	scale = 1
) {
	if (kind === 'none') return { stroke: 'none', 'stroke-width': 0 };
	const width =
		kind === 'thin'
			? schematic.stroke.thin
			: kind === 'thick'
				? schematic.stroke.thick
				: schematic.stroke.normal;
	return {
		stroke: toneColor(tone, signal),
		'stroke-width': width / scale,
		'stroke-dasharray': kind === 'dashed' ? schematic.stroke.dash : undefined,
		'stroke-linecap': 'round' as const,
		'stroke-linejoin': 'round' as const
	};
}

export function fillAttr(kind: FillKind | undefined, tone?: Tone, signal?: string): string {
	return kind === 'ink'
		? toneColor(tone, signal)
		: kind === 'paper'
			? schematic.color.paper
			: 'none';
}
