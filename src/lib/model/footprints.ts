/**
 * Encombrement et montage par défaut des appareils, déduits de leur symbole.
 *
 * En attendant le catalogue matériel (phase 12), les dimensions sont des valeurs usuelles
 * (largeur en modules de 18 mm pour le modulaire). Elles restent modifiables sur chaque
 * appareil posé, et le montage est modifiable par appareil (`Device.mounting`).
 */
import { getSymbolDef } from '$lib/symbols';
import type { Id, Mounting, Project } from './types';

export interface Footprint {
	mounting: Mounting;
	/** Largeur × hauteur en mm (vue de face). */
	w: number;
	h: number;
}

const MOD = 18;
const rail = (modules: number, h = 85): Footprint => ({ mounting: 'rail', w: modules * MOD, h });
const door = (d = 30): Footprint => ({ mounting: 'porte', w: d, h: d });
const EXTERNAL: Footprint = { mounting: 'externe', w: 40, h: 40 };

/** Par identifiant de symbole (les contacts / pôles renvoient à leur appareil). */
const BY_SYMBOL: Record<string, Footprint> = {
	'disjoncteur-1p': rail(1),
	'disjoncteur-1p-n': rail(1),
	'disjoncteur-2p': rail(2),
	'disjoncteur-3p': rail(3),
	'disjoncteur-3p-n': rail(4),
	'disjoncteur-4p': rail(4),
	'interrupteur-differentiel-2p': rail(2),
	'interrupteur-differentiel-4p': rail(4),
	'interrupteur-sectionneur-2p': rail(2),
	'interrupteur-sectionneur-4p': rail(4),
	'porte-fusible-1p-n': rail(1),
	'porte-fusible-1p': rail(1),
	'porte-fusible-3p': rail(3),
	'porte-fusible-3p-n': rail(4),
	'disjoncteur-differentiel-1p-n': rail(2),
	'disjoncteur-differentiel-3p-n': rail(4),
	'disjoncteur-differentiel-4p': rail(4),
	'interrupteur-sectionneur-3p': rail(3),
	'sectionneur-3p': rail(3),
	'relais-thermique-3p': { mounting: 'rail', w: 45, h: 70 },
	'contact-relais-thermique-nc': { mounting: 'rail', w: 45, h: 70 },
	'contact-relais-thermique-no': { mounting: 'rail', w: 45, h: 70 },
	'poles-contacteur-4p': { mounting: 'rail', w: 45, h: 75 },
	'bobine-relais-temporise-repos': rail(1),
	'relais-controle-phases': rail(1),
	horloge: rail(1),
	'compteur-energie-mono': rail(1),
	'compteur-energie-tri': rail(4),
	'compteur-horaire': rail(1),
	amperemetre: rail(3),
	voltmetre: rail(3),
	'variateur-frequence-tri': { mounting: 'rail', w: 72, h: 145 },
	'variateur-frequence-mono': { mounting: 'rail', w: 72, h: 145 },
	'demarreur-progressif': { mounting: 'rail', w: 45, h: 125 },
	'entree-analogique': { mounting: 'rail', w: 108, h: 90 },
	'sortie-analogique': { mounting: 'rail', w: 108, h: 90 },
	fusible: rail(1),
	parafoudre: rail(2),
	'disjoncteur-moteur-3p': { mounting: 'rail', w: 45, h: 90 },
	'bobine-contacteur': { mounting: 'rail', w: 45, h: 75 },
	'poles-contacteur-2p': { mounting: 'rail', w: 45, h: 75 },
	'poles-contacteur-3p': { mounting: 'rail', w: 45, h: 75 },
	'bobine-relais': { mounting: 'rail', w: 16, h: 80 },
	'contact-no': { mounting: 'rail', w: 16, h: 80 },
	'contact-nc': { mounting: 'rail', w: 16, h: 80 },
	'contact-inverseur': { mounting: 'rail', w: 16, h: 80 },
	'bobine-relais-temporise': rail(1),
	'contact-temporise-travail': rail(1),
	'bobine-telerupteur': rail(1),
	transformateur: { mounting: 'rail', w: 80, h: 75 },
	'alimentation-24vdc': { mounting: 'rail', w: 54, h: 90 },
	'prise-2p-t': { mounting: 'rail', w: 45, h: 85 },
	'entree-tor': { mounting: 'rail', w: 108, h: 90 },
	'sortie-tor': { mounting: 'rail', w: 108, h: 90 },
	voyant: door(),
	'commutateur-a-m': door(),
	'commutateur-0-1-2': door(),
	'bouton-poussoir-no': door(),
	'bouton-poussoir-nc': door(),
	'arret-urgence': door(40),
	'commutateur-0-1': door(),
	'commutateur-a-cle': door(),
	buzzer: door()
};

/** Symbole de repli par rôle (symboles maison, appareils externes…). */
export function symbolFootprint(defId: string): Footprint {
	return BY_SYMBOL[defId] ?? EXTERNAL;
}

/** Symbole « principal » d'un appareil : master / standalone de préférence. */
export function mainSymbolDef(project: Project, deviceId: Id): string | undefined {
	let fallback: string | undefined;
	for (const f of project.folios)
		for (const s of f.symbols) {
			if (s.deviceId !== deviceId) continue;
			const role = getSymbolDef(s.defId).role;
			if (role === 'master' || role === 'standalone') return s.defId;
			fallback ??= s.defId;
		}
	return fallback;
}

/**
 * Encombrement de l'appareil ; le montage imposé sur l'appareil prime
 * (`auto` : valeur déduite du symbole seul, pour l'afficher comme défaut).
 */
export function deviceFootprint(project: Project, deviceId: Id, auto = false): Footprint {
	const defId = mainSymbolDef(project, deviceId);
	const base = defId ? symbolFootprint(defId) : EXTERNAL;
	const mounting = (!auto && project.devices[deviceId]?.mounting) || base.mounting;
	if (mounting === base.mounting) return base;
	// Montage changé à la main : taille usuelle du nouveau montage.
	return mounting === 'porte' ? door() : mounting === 'rail' ? rail(1) : EXTERNAL;
}

/** Pas d'une borne de bornier (borne à vis 2,5 mm²) et longueur des butées / flasques. */
export const TERMINAL_PITCH = 5.2;
export const STRIP_ENDS = 10;
export const STRIP_H = 50;

export function stripWidth(count: number): number {
	return Math.round((count * TERMINAL_PITCH + STRIP_ENDS) * 10) / 10;
}

/**
 * Ordre de rangement automatique sur les rails (comme le folio d'implantation de
 * référence) : protection, puis commande, puis alimentation / automate, puis le reste.
 */
const PREFIX_ORDER = [
	'QS',
	'IG',
	'ID',
	'Q',
	'QM',
	'FU',
	'F',
	'KM',
	'KA',
	'KT',
	'KL',
	'TT',
	'G',
	'A'
];

export function prefixRank(prefix: string): number {
	const i = PREFIX_ORDER.indexOf(prefix.toUpperCase());
	return i < 0 ? PREFIX_ORDER.length : i;
}

/** Ordre en façade : voyants, puis commutateurs / boutons, puis le reste. */
const DOOR_ORDER = ['H', 'S', 'AU', 'HA'];

export function doorRank(prefix: string): number {
	const i = DOOR_ORDER.indexOf(prefix.toUpperCase());
	return i < 0 ? DOOR_ORDER.length : i;
}
