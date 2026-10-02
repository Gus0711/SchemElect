/**
 * Rôles et droits (règles pures, partagées client / serveur).
 *
 * - super-administrateur : toute la plateforme (sociétés, leurs administrateurs, sauvegardes de
 *   la base) ; peut entrer dans n'importe quelle société ;
 * - administrateur : sa société (utilisateurs, réglages) ;
 * - utilisateur (dessinateur) : crée et modifie les dossiers de sa société ;
 * - lecteur : lecture seule (consulter, rechercher, exporter), ne prend pas de verrou.
 * Tout le monde lit tous les dossiers de sa société ; jamais ceux d'une autre société.
 */

export type Role = 'superadmin' | 'admin' | 'user' | 'viewer';

export const ROLES: Role[] = ['superadmin', 'admin', 'user', 'viewer'];

export const ROLE_LABEL: Record<Role, string> = {
	superadmin: 'Super-administrateur',
	admin: 'Administrateur',
	user: 'Utilisateur',
	viewer: 'Lecteur'
};

export const ROLE_HINT: Record<Role, string> = {
	superadmin: 'Toute la plateforme : sociétés, administrateurs, sauvegardes',
	admin: 'Sa société : utilisateurs, modèles, catalogue',
	user: 'Crée et modifie les dossiers',
	viewer: 'Lecture seule : consulter, rechercher, exporter'
};

export function isRole(x: unknown): x is Role {
	return typeof x === 'string' && (ROLES as string[]).includes(x);
}

/** Peut modifier les dossiers et bibliothèques (macros, symboles, catalogue, modèles). */
export function canEdit(role: Role): boolean {
	return role !== 'viewer';
}

/** Administration de la société (utilisateurs). */
export function isAdmin(role: Role): boolean {
	return role === 'admin' || role === 'superadmin';
}

export function isSuperAdmin(role: Role): boolean {
	return role === 'superadmin';
}

/** Rôles qu'un compte peut attribuer : jamais super-administrateur, sauf par un super-admin. */
export function assignableRoles(actor: Role): Role[] {
	if (actor === 'superadmin') return ['superadmin', 'admin', 'user', 'viewer'];
	if (actor === 'admin') return ['admin', 'user', 'viewer'];
	return [];
}

/** Un administrateur ne touche pas aux comptes super-administrateur. */
export function canManageUser(actor: Role, target: Role): boolean {
	if (actor === 'superadmin') return true;
	return actor === 'admin' && target !== 'superadmin';
}

/**
 * Société active : celle du compte, ou celle choisie par un super-administrateur (bascule),
 * si elle existe.
 */
export function effectiveOrganization(
	user: { role: Role; organizationId: string },
	requested: string | undefined,
	exists: (id: string) => boolean
): string {
	if (
		user.role === 'superadmin' &&
		requested &&
		requested !== user.organizationId &&
		exists(requested)
	)
		return requested;
	return user.organizationId;
}
