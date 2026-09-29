<script lang="ts">
	import { enhance } from '$app/forms';
	import { LogIn } from '@lucide/svelte';
	import { Alert, AuthLayout, Button, Field } from '$lib/ui';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let pending = $state(false);
</script>

<svelte:head><title>Connexion — SchemElect</title></svelte:head>

<AuthLayout title="Connexion" subtitle="Éditeur de schémas électriques">
	<form
		method="POST"
		use:enhance={() => {
			pending = true;
			return async ({ update }) => {
				await update();
				pending = false;
			};
		}}
	>
		<Field
			label="Identifiant"
			name="login"
			value={form?.login ?? ''}
			autocomplete="username"
			required
		/>
		<Field
			label="Mot de passe"
			name="password"
			type="password"
			autocomplete="current-password"
			required
		/>
		{#if form?.error}<Alert>{form.error}</Alert>{/if}
		<Button variant="primary" type="submit" disabled={pending}
			><LogIn size={16} /> Se connecter</Button
		>
	</form>
</AuthLayout>
