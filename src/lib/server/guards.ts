import { error, redirect } from '@sveltejs/kit';

/** Utilisateur connecté (les hooks ont déjà filtré ; garde-fou pour le typage). */
export function requireUser(locals: App.Locals): App.SessionUser {
	if (!locals.user) error(401, 'Non authentifié');
	return locals.user;
}

/** Page réservée aux administrateurs. */
export function requireAdmin(locals: App.Locals): App.SessionUser {
	if (!locals.user) redirect(303, '/login');
	if (locals.user.role !== 'admin') error(403, 'Réservé aux administrateurs');
	return locals.user;
}
