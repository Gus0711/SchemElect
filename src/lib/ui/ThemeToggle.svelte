<script lang="ts">
	/** Bouton de choix du thème (Clair → Sombre → Système). */
	import { Monitor, Moon, Sun } from '@lucide/svelte';
	import Button from './Button.svelte';
	import { THEME_LABELS, theme } from './theme.svelte';

	let { size = 'md' }: { size?: 'sm' | 'md' } = $props();

	const Icon = $derived({ light: Sun, dark: Moon, system: Monitor }[theme.pref]);
</script>

<Button
	variant="ghost"
	{size}
	title="Thème : {THEME_LABELS[theme.pref]} (cliquer pour changer)"
	aria-label="Thème : {THEME_LABELS[theme.pref]}"
	onclick={() => theme.cycle()}
	data-testid="theme-toggle"><Icon size={16} /></Button
>
