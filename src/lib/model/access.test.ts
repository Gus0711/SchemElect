import { describe, expect, it } from 'vitest';
import {
	assignableRoles,
	canEdit,
	canManageUser,
	effectiveOrganization,
	isAdmin,
	isRole,
	isSuperAdmin
} from './access';

describe('rôles et droits', () => {
	it('lecteur : lecture seule ; admin et super-admin administrent', () => {
		expect(canEdit('viewer')).toBe(false);
		expect(['superadmin', 'admin', 'user'].every((r) => canEdit(r as never))).toBe(true);
		expect(isAdmin('admin')).toBe(true);
		expect(isAdmin('superadmin')).toBe(true);
		expect(isAdmin('user')).toBe(false);
		expect(isSuperAdmin('admin')).toBe(false);
		expect(isRole('viewer')).toBe(true);
		expect(isRole('root')).toBe(false);
	});

	it('un administrateur ne crée ni ne gère de super-administrateur', () => {
		expect(assignableRoles('admin')).toEqual(['admin', 'user', 'viewer']);
		expect(assignableRoles('superadmin')).toContain('superadmin');
		expect(assignableRoles('user')).toEqual([]);
		expect(canManageUser('admin', 'superadmin')).toBe(false);
		expect(canManageUser('admin', 'viewer')).toBe(true);
		expect(canManageUser('user', 'viewer')).toBe(false);
		expect(canManageUser('superadmin', 'superadmin')).toBe(true);
	});

	it('seul le super-administrateur change de société, vers une société existante', () => {
		const exists = (id: string) => id === 'b';
		const sa = { role: 'superadmin' as const, organizationId: 'a' };
		expect(effectiveOrganization(sa, 'b', exists)).toBe('b');
		expect(effectiveOrganization(sa, 'zz', exists)).toBe('a');
		expect(effectiveOrganization(sa, undefined, exists)).toBe('a');
		expect(effectiveOrganization({ role: 'admin', organizationId: 'a' }, 'b', exists)).toBe('a');
	});
});
