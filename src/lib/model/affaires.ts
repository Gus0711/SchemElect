/**
 * Classement des dossiers : société → client → affaire (un n° WhySoft) → schémas.
 *
 * Règles pures (validation, rattachement d'un dossier, reprise de l'existant). Le stockage
 * est dans `server/affaires.ts`. Les clients et affaires de la société Dumortier viendront
 * plus tard de l'ERP (`source: 'erp'`, lecture seule) ; en attendant, saisie manuelle.
 */
import type { ProjectMeta } from './types';

export type AffaireStatus = 'en_cours' | 'terminee' | 'archivee';

export const AFFAIRE_STATUSES: AffaireStatus[] = ['en_cours', 'terminee', 'archivee'];

export const STATUS_LABEL: Record<AffaireStatus, string> = {
	en_cours: 'En cours',
	terminee: 'Terminée',
	archivee: 'Archivée'
};

/** Origine : saisie dans SchemElect, ou reprise de l'ERP (non modifiable ici). */
export type DataSource = 'manual' | 'erp';

export interface Client {
	id: string;
	name: string;
	/** Code client (ERP / CRM), facultatif. */
	code: string;
	city: string;
	source: DataSource;
}

export interface Affaire {
	id: string;
	clientId: string;
	/** N° WhySoft (CRM) : identifie l'affaire ; unique dans la société s'il est renseigné. */
	whysoft: string;
	/** N° d'affaire du cartouche (facultatif : sinon celui du dossier est gardé). */
	number: string;
	/** Désignation (« Chaufferie collège Jean Moulin »). */
	label: string;
	year: number;
	status: AffaireStatus;
	source: DataSource;
}

export const isStatus = (v: unknown): v is AffaireStatus =>
	typeof v === 'string' && (AFFAIRE_STATUSES as string[]).includes(v);

/** Clé de comparaison d'un nom : sans accents, casse ni espaces multiples. */
export function nameKey(s: string): string {
	return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Valide un client reçu (nom obligatoire). */
export function normalizeClient(raw: unknown): Omit<Client, 'id' | 'source'> | null {
	if (!raw || typeof raw !== 'object') return null;
	const r = raw as Record<string, unknown>;
	const name = str(r.name);
	if (!name) return null;
	return { name, code: str(r.code, 60), city: str(r.city, 100) };
}

/** Valide une affaire reçue (client et, au choix, n° WhySoft ou désignation obligatoires). */
export function normalizeAffaire(
	raw: unknown,
	now = new Date()
): Omit<Affaire, 'id' | 'source'> | null {
	if (!raw || typeof raw !== 'object') return null;
	const r = raw as Record<string, unknown>;
	const clientId = str(r.clientId, 60);
	const whysoft = str(r.whysoft, 40);
	const label = str(r.label);
	if (!clientId || (!whysoft && !label)) return null;
	const year = Math.round(Number(r.year));
	return {
		clientId,
		whysoft,
		number: str(r.number, 40),
		label,
		year: year >= 1990 && year <= 2200 ? year : now.getFullYear(),
		status: isStatus(r.status) ? r.status : 'en_cours'
	};
}

/** Libellé court d'une affaire : « WS-1234 · Chaufferie collège ». */
export function affaireTitle(a: Pick<Affaire, 'whysoft' | 'label' | 'number'>): string {
	return [a.whysoft || a.number, a.label].filter(Boolean).join(' · ') || 'Affaire sans titre';
}

/**
 * Rattache le cartouche à l'affaire : client, n° WhySoft et (s'il est renseigné) n°
 * d'affaire sont imposés. Renvoie vrai si le cartouche a changé.
 */
export function applyAffaire(meta: ProjectMeta, affaire: Affaire, client: Client | null): boolean {
	const before = JSON.stringify(meta);
	meta.affaireId = affaire.id;
	meta.whysoft = affaire.whysoft;
	if (client) meta.client = client.name;
	if (affaire.number) meta.affaireNumber = affaire.number;
	return JSON.stringify(meta) !== before;
}

/** Détache le cartouche (les valeurs restent, elles redeviennent modifiables). */
export function detachAffaire(meta: ProjectMeta): void {
	delete meta.affaireId;
}

// --- Reprise de l'existant ------------------------------------------------------

export interface LegacyProject {
	id: string;
	client: string;
	affaireNumber: string;
	whysoft?: string;
	createdAt: string;
}

export interface ClassificationPlan {
	/** Clients à créer (clé = `nameKey` du nom). */
	clients: { key: string; name: string }[];
	/** Affaires à créer ; `client` = id existant ou clé d'un client à créer. */
	affaires: { key: string; client: string; number: string; whysoft: string; year: number }[];
	/** Rattachements : `affaire` = id existant ou clé d'une affaire à créer. */
	assign: { projectId: string; affaire: string }[];
	/** Dossiers laissés « Non classé » (client ou n° d'affaire manquant). */
	skipped: string[];
}

/**
 * Reprise des dossiers non classés : un client par nom (sans tenir compte des accents ni de
 * la casse), une affaire par client et n° d'affaire (ou n° WhySoft). Les clients et
 * affaires existants sont réutilisés. Sans client ou sans numéro, le dossier reste « Non
 * classé » (à rattacher à la main).
 */
export function planClassification(
	projects: LegacyProject[],
	clients: Pick<Client, 'id' | 'name'>[],
	affaires: Pick<Affaire, 'id' | 'clientId' | 'whysoft' | 'number'>[]
): ClassificationPlan {
	const plan: ClassificationPlan = { clients: [], affaires: [], assign: [], skipped: [] };
	const clientByKey = new Map<string, string>();
	for (const c of clients)
		if (!clientByKey.has(nameKey(c.name))) clientByKey.set(nameKey(c.name), c.id);
	const affaireByKey = new Map<string, string>();
	for (const a of affaires)
		for (const n of [a.whysoft, a.number])
			if (n.trim()) affaireByKey.set(`${a.clientId}|${nameKey(n)}`, a.id);
	for (const p of projects) {
		const name = p.client.trim();
		const number = (p.whysoft?.trim() || p.affaireNumber.trim()).slice(0, 40);
		if (!name || !number) {
			plan.skipped.push(p.id);
			continue;
		}
		const ck = nameKey(name);
		let client = clientByKey.get(ck);
		if (!client) {
			client = `new:${ck}`;
			clientByKey.set(ck, client);
			plan.clients.push({ key: client, name });
		}
		const ak = `${client}|${nameKey(number)}`;
		let affaire = affaireByKey.get(ak);
		if (!affaire) {
			affaire = `new:${ak}`;
			affaireByKey.set(ak, affaire);
			const year = new Date(p.createdAt).getFullYear();
			plan.affaires.push({
				key: affaire,
				client,
				number: p.affaireNumber.trim().slice(0, 40),
				whysoft: p.whysoft?.trim().slice(0, 40) ?? '',
				year: Number.isFinite(year) ? year : new Date().getFullYear()
			});
		}
		plan.assign.push({ projectId: p.id, affaire });
	}
	return plan;
}
