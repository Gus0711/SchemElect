/**
 * Thème de l'interface : clair (« Atelier », défaut), sombre (« Nuit ») ou système.
 * Le choix est mémorisé par poste (localStorage) et appliqué via `data-theme` sur <html>.
 * Le script de src/app.html applique le thème avant le premier rendu (pas de flash).
 */
export type ThemePref = 'light' | 'dark' | 'system';

export const THEME_KEY = 'schemelect-theme';
const ORDER: ThemePref[] = ['light', 'dark', 'system'];

export const THEME_LABELS: Record<ThemePref, string> = {
	light: 'Clair',
	dark: 'Sombre',
	system: 'Système'
};

function readPref(): ThemePref {
	try {
		const v = localStorage.getItem(THEME_KEY);
		if (v === 'light' || v === 'dark' || v === 'system') return v;
	} catch {
		/* stockage indisponible : thème par défaut */
	}
	return 'light';
}

function systemDark(): boolean {
	return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}

function apply(pref: ThemePref) {
	const dark = pref === 'dark' || (pref === 'system' && systemDark());
	document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

class Theme {
	pref = $state<ThemePref>('light');
	#watching = false;

	/** À appeler côté navigateur (onMount du layout racine). */
	init() {
		this.pref = readPref();
		apply(this.pref);
		if (this.#watching || typeof matchMedia !== 'function') return;
		this.#watching = true;
		matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
			if (this.pref === 'system') apply('system');
		});
	}

	set(pref: ThemePref) {
		this.pref = pref;
		try {
			localStorage.setItem(THEME_KEY, pref);
		} catch {
			/* ignoré */
		}
		apply(pref);
	}

	/** Clair → Sombre → Système → Clair… */
	cycle() {
		this.set(ORDER[(ORDER.indexOf(this.pref) + 1) % ORDER.length]);
	}
}

export const theme = new Theme();
