export function newId(prefix = ''): string {
	const rnd =
		typeof crypto !== 'undefined' && 'randomUUID' in crypto
			? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
			: Math.random().toString(36).slice(2, 14);
	return prefix ? `${prefix}_${rnd}` : rnd;
}

/**
 * Copie profonde d'un document JSON. N'utilise pas structuredClone : les objets
 * réactifs de Svelte ($state) sont des Proxy que structuredClone refuse.
 */
export function deepClone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}
