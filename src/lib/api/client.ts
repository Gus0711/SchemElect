/**
 * Client typé de l'API JSON (utilisé par l'éditeur). Toutes les fonctions lèvent
 * `ApiError` si la réponse n'est pas OK (401 non connecté, 404, 409 verrou…).
 */
import type { Fragment } from '$lib/model/fragments';
import type { DocTemplate } from '$lib/model/template';
import type { Project } from '$lib/model/types';
import type { SymbolDef } from '$lib/symbols/types';
import type { LockInfo, Macro } from './types';

export type { LockInfo, Macro } from './types';

export class ApiError extends Error {
	status: number;
	body: unknown;
	constructor(status: number, body: unknown) {
		const msg =
			body && typeof body === 'object' && 'error' in body
				? String((body as { error: unknown }).error)
				: body && typeof body === 'object' && 'message' in body
					? String((body as { message: unknown }).message)
					: `Erreur HTTP ${status}`;
		super(msg);
		this.name = 'ApiError';
		this.status = status;
		this.body = body;
	}
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
	const res = await fetch(url, {
		method,
		headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
		body: body !== undefined ? JSON.stringify(body) : undefined,
		credentials: 'same-origin'
	});
	const text = await res.text();
	let parsed: unknown = undefined;
	if (text) {
		try {
			parsed = JSON.parse(text);
		} catch {
			parsed = text;
		}
	}
	if (!res.ok) throw new ApiError(res.status, parsed);
	return parsed as T;
}

const projectUrl = (id: string) => `/api/projects/${encodeURIComponent(id)}`;

export async function fetchProject(
	id: string
): Promise<{ id: string; data: Project; updatedAt: string; lock: LockInfo | null }> {
	return request('GET', projectUrl(id));
}

export async function saveProject(id: string, data: Project): Promise<{ updatedAt: string }> {
	return request('PUT', projectUrl(id), { data });
}

export async function acquireLock(id: string): Promise<{ owned: boolean; lock: LockInfo | null }> {
	return request('POST', `${projectUrl(id)}/lock`);
}

/** Libère le verrou, y compris pendant la fermeture de la page (sendBeacon). */
export function releaseLock(id: string): void {
	const url = `${projectUrl(id)}/lock?release=1`;
	if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
		if (navigator.sendBeacon(url)) return;
	}
	void fetch(url, { method: 'POST', keepalive: true, credentials: 'same-origin' }).catch(() => {});
}

export async function listMacros(): Promise<Macro[]> {
	return request('GET', '/api/macros');
}

export async function createMacro(input: {
	name: string;
	category: string;
	data: Fragment;
}): Promise<Macro> {
	return request('POST', '/api/macros', input);
}

export async function deleteMacro(id: string): Promise<void> {
	await request('DELETE', `/api/macros/${encodeURIComponent(id)}`);
}

// --- Symboles maison ----------------------------------------------------------

export async function listCustomSymbols(): Promise<SymbolDef[]> {
	return request('GET', '/api/symbols');
}

export async function saveCustomSymbol(def: SymbolDef): Promise<SymbolDef> {
	return request('POST', '/api/symbols', def);
}

export async function deleteCustomSymbol(id: string): Promise<void> {
	await request('DELETE', `/api/symbols/${encodeURIComponent(id)}`);
}

// --- Modèles de cartouche / page de garde --------------------------------------

export async function listTemplates(): Promise<DocTemplate[]> {
	return request('GET', '/api/templates');
}

export async function saveTemplate(t: DocTemplate): Promise<DocTemplate> {
	return request('POST', '/api/templates', t);
}

export async function deleteTemplate(id: string): Promise<void> {
	await request('DELETE', `/api/templates/${encodeURIComponent(id)}`);
}
