/** Zoom / déplacement de la vue (coordonnées écran ⇄ mm). */
import { PAGE } from '$lib/model/layout';
import type { Point } from '$lib/model/types';

const MIN_SCALE = 0.8;
const MAX_SCALE = 40;

export class Viewport {
	/** Coin haut-gauche visible (mm). */
	x = $state(0);
	y = $state(0);
	/** Pixels par mm. */
	scale = $state(3);
	/** Taille de la zone d'affichage (px), mise à jour par le canvas. */
	width = $state(800);
	height = $state(600);

	viewBox = $derived(`${this.x} ${this.y} ${this.width / this.scale} ${this.height / this.scale}`);
	zoomPercent = $derived(Math.round((this.scale / 3.78) * 100));

	toModel(sx: number, sy: number): Point {
		return { x: this.x + sx / this.scale, y: this.y + sy / this.scale };
	}

	/** Zoom autour d'un point écran (par défaut le centre). */
	zoomBy(factor: number, sx = this.width / 2, sy = this.height / 2) {
		const before = this.toModel(sx, sy);
		this.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, this.scale * factor));
		this.x = before.x - sx / this.scale;
		this.y = before.y - sy / this.scale;
	}

	panBy(dxPx: number, dyPx: number) {
		this.x -= dxPx / this.scale;
		this.y -= dyPx / this.scale;
	}

	/** Page entière visible, centrée. */
	fit() {
		const margin = 16;
		this.scale = Math.min((this.width - margin * 2) / PAGE.w, (this.height - margin * 2) / PAGE.h);
		this.x = PAGE.w / 2 - this.width / 2 / this.scale;
		this.y = PAGE.h / 2 - this.height / 2 / this.scale;
	}

	/** Centre la vue sur un point (mm) sans changer le zoom. */
	centerOn(x: number, y: number) {
		this.x = x - this.width / 2 / this.scale;
		this.y = y - this.height / 2 / this.scale;
	}

	/** Taille « réelle » approximative (96 dpi). */
	actualSize() {
		this.zoomBy(3.78 / this.scale);
	}
}
