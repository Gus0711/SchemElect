import { error, json, redirect } from '@sveltejs/kit';
import { canEdit, isAdmin, isSuperAdmin } from '$lib/model/access';

/** Utilisateur connecté (les hooks ont déjà filtré ; garde-fou pour le typage). */
export function requireUser(locals: App.Locals): App.SessionUser {
	if (!locals.user) error(401, 'Non authentifié');
	return locals.user;
}

/** Écriture (dossiers, bibliothèques) : refusée au lecteur. */
export function requireEditor(locals: App.Locals): App.SessionUser {
	const user = requireUser(locals);
	if (!canEdit(user.role)) error(403, 'Lecture seule : votre compte ne permet pas de modifier');
	return user;
}

/** Administration de la société (administrateur ou super-administrateur). */
export function requireAdmin(locals: App.Locals): App.SessionUser {
	if (!locals.user) redirect(303, '/login');
	if (!isAdmin(locals.user.role)) error(403, 'Réservé aux administrateurs');
	return locals.user;
}

/** Toute la plateforme (sociétés, sauvegardes de la base). */
export function requireSuperAdmin(locals: App.Locals): App.SessionUser {
	if (!locals.user) redirect(303, '/login');
	if (!isSuperAdmin(locals.user.role)) error(403, 'Réservé au super-administrateur');
	return locals.user;
}

/** Réponse JSON 403 pour un lecteur (API qui renvoient du JSON). */
export function readonlyResponse() {
	return json({ error: 'Lecture seule : votre compte ne permet pas de modifier' }, { status: 403 });
}
