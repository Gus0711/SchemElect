// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Role } from '$lib/model/access';

declare global {
	namespace App {
		interface SessionUser {
			id: string;
			login: string;
			name: string;
			role: Role;
			/** Société active (celle du compte, ou celle choisie par le super-administrateur). */
			organizationId: string;
			organizationName: string;
			/** Société du compte. */
			homeOrganizationId: string;
		}
		// interface Error {}
		interface Locals {
			user: SessionUser | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
