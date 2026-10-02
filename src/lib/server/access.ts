/** Accès aux dossiers : un dossier n'est visible que dans sa société ; l'écriture exige un rôle qui modifie. */
import { error } from '@sveltejs/kit';
import { canEdit } from '$lib/model/access';
import { requireUser } from './guards';
import { projectOrganization } from './projects';

/**
 * Utilisateur autorisé sur le dossier : 404 s'il n'existe pas ou appartient à une autre
 * société (on ne révèle pas son existence), 403 en écriture pour un lecteur.
 */
export async function requireProject(
	locals: App.Locals,
	projectId: string,
	mode: 'read' | 'write'
): Promise<App.SessionUser> {
	const user = requireUser(locals);
	const org = await projectOrganization(projectId);
	if (!org || org !== user.organizationId) error(404, 'Projet introuvable');
	if (mode === 'write' && !canEdit(user.role))
		error(403, 'Lecture seule : votre compte ne permet pas de modifier');
	return user;
}
