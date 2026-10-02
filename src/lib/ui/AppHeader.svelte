<script lang="ts">
	/** En-tête commun des pages hors éditeur. */
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { isAdmin, ROLE_LABEL, type Role } from '$lib/model/access';
	import ThemeToggle from './ThemeToggle.svelte';
	import {
		DatabaseBackup,
		FolderOpen,
		LayoutTemplate,
		LogOut,
		Briefcase,
		Building2,
		Package,
		UserRound,
		Users
	} from '@lucide/svelte';

	let {
		user,
		organizations = []
	}: {
		user: {
			name: string;
			role: Role;
			organizationId?: string;
			organizationName?: string;
			homeOrganizationId?: string;
		};
		/** Super-administrateur : sociétés où il peut entrer. */
		organizations?: { id: string; name: string }[];
	} = $props();

	const path = $derived(page.url.pathname);
	/** Super-administrateur entré dans une autre société que la sienne. */
	const visiting = $derived(
		user.role === 'superadmin' &&
			!!user.homeOrganizationId &&
			user.organizationId !== user.homeOrganizationId
	);

	async function switchOrganization(id: string) {
		await fetch('/api/session/organization', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ id })
		});
		await invalidateAll();
		await goto('/');
	}
</script>

<header class="app-header">
	<a class="logo" href="/"
		><svg viewBox="0 0 40 36" aria-hidden="true"
			><path
				d="M10 2h26c0 9-4 13-9 13H14c-3 0-5 2-6 5-1-7 0-14 2-18z"
				fill="var(--c-accent)"
			/><path d="M7 16h22c0 9-4 13-9 13H11c-3 0-5 2-6 5-1-7 0-14 2-18z" fill="currentColor" /></svg
		>SchemElect</a
	>
	{#if user.role === 'superadmin' && organizations.length}
		<select
			class="org"
			class:visiting
			aria-label="Société"
			title="Société active (super-administrateur : changer de société)"
			value={user.organizationId}
			onchange={(e) => switchOrganization(e.currentTarget.value)}
		>
			{#each organizations as o (o.id)}<option value={o.id}>{o.name}</option>{/each}
		</select>
	{:else if user.organizationName}
		<span class="org-name" title="Société">{user.organizationName}</span>
	{/if}
	<nav>
		<a href="/" class:active={path === '/' || path.startsWith('/projets')}
			><FolderOpen size={16} /> Projets</a
		>
		<a href="/affaires" class:active={path.startsWith('/affaires')}
			><Briefcase size={16} /> Affaires</a
		>
		<a href="/modeles" class:active={path.startsWith('/modeles')}
			><LayoutTemplate size={16} /> Modèles</a
		>
		<a href="/catalogue" class:active={path.startsWith('/catalogue')}
			><Package size={16} /> Catalogue</a
		>
		{#if isAdmin(user.role)}
			<a href="/admin/utilisateurs" class:active={path.startsWith('/admin/utilisateurs')}
				><Users size={16} /> Utilisateurs</a
			>
		{/if}
		{#if user.role === 'superadmin'}
			<a href="/admin/societes" class:active={path.startsWith('/admin/societes')}
				><Building2 size={16} /> Sociétés</a
			>
			<a href="/admin/sauvegardes" class:active={path.startsWith('/admin/sauvegardes')}
				><DatabaseBackup size={16} /> Sauvegardes</a
			>
		{/if}
	</nav>
	<div class="user">
		<ThemeToggle />
		<span class="name" title={ROLE_LABEL[user.role]}
			><UserRound size={16} />
			{user.name}{#if user.role === 'viewer'}<span class="viewer">Lecteur</span>{/if}</span
		>
		<form method="POST" action="/logout">
			<button type="submit" class="logout" title="Se déconnecter"
				><LogOut size={16} /> Déconnexion</button
			>
		</form>
	</div>
</header>

<style>
	.app-header {
		display: flex;
		align-items: center;
		gap: var(--sp-5);
		height: var(--topbar-h);
		padding: 0 var(--sp-4);
		background: var(--c-surface);
		border-bottom: 1px solid var(--c-border);
	}
	.logo {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-2);
		font-size: var(--fs-lg);
		font-weight: var(--fw-bold);
		color: var(--c-text);
		letter-spacing: 0.01em;
	}
	.logo svg {
		width: 20px;
		height: 18px;
	}
	.logo:hover {
		text-decoration: none;
	}
	.org,
	.org-name {
		max-width: 200px;
		height: var(--control-h);
		padding: 0 var(--sp-2);
		border: 1px solid var(--c-border);
		border-radius: var(--radius);
		background: var(--c-surface-2);
		color: var(--c-text);
		font-weight: var(--fw-medium);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.org-name {
		display: inline-flex;
		align-items: center;
	}
	.org.visiting {
		border-color: var(--c-accent);
		background: var(--c-primary-soft);
	}
	.viewer {
		margin-left: var(--sp-1);
		padding: 0 6px;
		border-radius: 999px;
		background: var(--c-surface-2);
		font-size: var(--fs-xs);
	}
	nav {
		display: flex;
		gap: var(--sp-1);
		flex: 1;
	}
	nav a,
	.logout {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-1);
		height: var(--control-h);
		padding: 0 var(--sp-3);
		border-radius: var(--radius);
		color: var(--c-text);
		font-weight: var(--fw-medium);
	}
	nav a:hover,
	.logout:hover {
		background: var(--c-surface-2);
		text-decoration: none;
	}
	nav a.active {
		background: var(--c-primary-soft);
		color: var(--c-primary);
	}
	.user {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
	}
	.name {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-1);
		color: var(--c-text-muted);
	}
	form {
		margin: 0;
	}
	.logout {
		border: none;
		background: transparent;
		cursor: pointer;
	}
</style>
