/** Repères d'appareils : « KM12 » = préfixe « KM » + numéro 12. */

export interface ParsedTag {
	prefix: string;
	num: number | null;
}

export function parseTag(tag: string): ParsedTag {
	const m = /^(.*?)(\d+)$/.exec(tag.trim());
	if (!m) return { prefix: tag.trim(), num: null };
	return { prefix: m[1], num: Number(m[2]) };
}

/** Premier repère libre après le plus grand numéro utilisé pour ce préfixe. */
export function nextFreeTag(prefix: string, used: Iterable<string>): string {
	let max = 0;
	for (const t of used) {
		const p = parseTag(t);
		if (p.prefix === prefix && p.num !== null) max = Math.max(max, p.num);
	}
	return `${prefix}${max + 1}`;
}

/** Tri naturel des repères (KM2 avant KM10). */
export function compareTags(a: string, b: string): number {
	const pa = parseTag(a);
	const pb = parseTag(b);
	if (pa.prefix !== pb.prefix) return pa.prefix.localeCompare(pb.prefix, 'fr');
	return (pa.num ?? 0) - (pb.num ?? 0);
}
