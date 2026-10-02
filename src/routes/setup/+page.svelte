<script lang="ts">
	import { enhance } from '$app/forms';
	import { ShieldCheck } from '@lucide/svelte';
	import { Alert, AuthLayout, Button, Field } from '$lib/ui';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let pending = $state(false);
</script>

<svelte:head><title>Premier lancement — SchemElect</title></svelte:head>

<AuthLayout
	title="Premier lancement"
	subtitle="Créez votre société et le compte super-administrateur. Il permettra ensuite de créer les autres comptes (et d’autres sociétés)."
>
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
			label="Société"
			name="organization"
			value={form?.organization ?? ''}
			placeholder="Dumortier"
		/>
		<Field
			label="Identifiant"
			name="login"
			value={form?.login ?? ''}
			autocomplete="username"
			required
		/>
		<Field label="Nom affiché" name="name" value={form?.name ?? ''} required />
		<Field
			label="Mot de passe"
			name="password"
			type="password"
			autocomplete="new-password"
			required
		/>
		<Field
			label="Confirmation"
			name="confirm"
			type="password"
			autocomplete="new-password"
			required
		/>
		{#if form?.error}<Alert>{form.error}</Alert>{/if}
		<Button variant="primary" type="submit" disabled={pending}>
			<ShieldCheck size={16} /> Créer l'administrateur
		</Button>
	</form>
</AuthLayout>
