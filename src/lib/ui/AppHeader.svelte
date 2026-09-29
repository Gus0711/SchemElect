<script lang="ts">
	/** En-tête commun des pages hors éditeur. */
	import { page } from '$app/state';
	import { FolderOpen, LogOut, UserRound, Users } from '@lucide/svelte';

	let { user }: { user: { name: string; role: 'admin' | 'user' } } = $props();

	const path = $derived(page.url.pathname);
</script>

<header class="app-header">
	<a class="logo" href="/">SchemElect</a>
	<nav>
		<a href="/" class:active={path === '/' || path.startsWith('/projets')}
			><FolderOpen size={16} /> Projets</a
		>
		{#if user.role === 'admin'}
			<a href="/admin/utilisateurs" class:active={path.startsWith('/admin')}
				><Users size={16} /> Utilisateurs</a
			>
		{/if}
	</nav>
	<div class="user">
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
		font-size: var(--fs-lg);
		font-weight: var(--fw-bold);
		color: var(--c-text);
		letter-spacing: 0.01em;
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
