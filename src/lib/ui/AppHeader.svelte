<script lang="ts">
	/** En-tête commun des pages hors éditeur. */
	import { page } from '$app/state';
	import ThemeToggle from './ThemeToggle.svelte';
	import {
		DatabaseBackup,
		FolderOpen,
		LayoutTemplate,
		LogOut,
		Package,
		UserRound,
		Users
	} from '@lucide/svelte';

	let { user }: { user: { name: string; role: 'admin' | 'user' } } = $props();

	const path = $derived(page.url.pathname);
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
	<nav>
		<a href="/" class:active={path === '/' || path.startsWith('/projets')}
			><FolderOpen size={16} /> Projets</a
		>
		<a href="/modeles" class:active={path.startsWith('/modeles')}
			><LayoutTemplate size={16} /> Modèles</a
		>
		<a href="/catalogue" class:active={path.startsWith('/catalogue')}
			><Package size={16} /> Catalogue</a
		>
		{#if user.role === 'admin'}
			<a href="/admin/utilisateurs" class:active={path.startsWith('/admin/utilisateurs')}
				><Users size={16} /> Utilisateurs</a
			>
			<a href="/admin/sauvegardes" class:active={path.startsWith('/admin/sauvegardes')}
				><DatabaseBackup size={16} /> Sauvegardes</a
			>
		{/if}
	</nav>
	<div class="user">
		<ThemeToggle />
		<span class="name"><UserRound size={16} /> {user.name}</span>
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
