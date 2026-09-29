/** Types partagés client / serveur de l'API JSON. */
import type { Fragment } from '$lib/model/fragments';
import type { Project } from '$lib/model/types';

export type LockInfo = { userId: string; userName: string; at: string };

export type ProjectResponse = {
	id: string;
	data: Project;
	updatedAt: string;
	lock: LockInfo | null;
};

export type Macro = {
	id: string;
	name: string;
	category: string;
	data: Fragment;
	createdBy: string | null;
	createdAt: string;
};
