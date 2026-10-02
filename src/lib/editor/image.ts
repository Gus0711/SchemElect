/**
 * Traitement des images de documentation pour les symboles maison (navigateur) :
 * import, rognage, gomme, suppression du fond. Les zones sont exprimées en fractions
 * de l'image (0..1) pour rester indépendantes de la taille en mm sur le schéma.
 */

export interface PreparedImage {
	/** Data URL PNG (ou JPEG si trop lourde et opaque). */
	href: string;
	/** Hauteur / largeur. */
	ratio: number;
}

export interface FracRect {
	x: number;
	y: number;
	w: number;
	h: number;
}

const MAX_PNG = 900_000;

function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const i = new Image();
		i.onload = () => resolve(i);
		i.onerror = () => reject(new Error('Image illisible'));
		i.src = src;
	});
}

function canvasOf(w: number, h: number) {
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.round(w));
	canvas.height = Math.max(1, Math.round(h));
	return { canvas, ctx: canvas.getContext('2d', { willReadFrequently: true })! };
}

function hasTransparency(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
	const data = ctx.getImageData(0, 0, w, h).data;
	for (let i = 3; i < data.length; i += 16) if (data[i] < 250) return true;
	return false;
}

/** Encode : PNG (transparence conservée) ; JPEG sur fond blanc si PNG trop lourd et opaque. */
function encode(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): PreparedImage {
	const ratio = canvas.height / canvas.width;
	const png = canvas.toDataURL('image/png');
	if (png.length <= MAX_PNG || hasTransparency(ctx, canvas.width, canvas.height))
		return { href: png, ratio };
	const { canvas: flat, ctx: fctx } = canvasOf(canvas.width, canvas.height);
	fctx.fillStyle = '#ffffff';
	fctx.fillRect(0, 0, flat.width, flat.height);
	fctx.drawImage(canvas, 0, 0);
	return { href: flat.toDataURL('image/jpeg', 0.88), ratio };
}

/** Charge une image (fichier ou presse-papiers), la réduit à `maxPx` et la ré-encode. */
export async function prepareImage(file: Blob, maxPx = 1600): Promise<PreparedImage> {
	const url = URL.createObjectURL(file);
	try {
		const img = await loadImage(url);
		const w0 = img.naturalWidth || 800;
		const h0 = img.naturalHeight || 600;
		const k = Math.min(1, maxPx / Math.max(w0, h0));
		const { canvas, ctx } = canvasOf(w0 * k, h0 * k);
		ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
		return encode(canvas, ctx);
	} finally {
		URL.revokeObjectURL(url);
	}
}

/** Ne garde que la zone donnée. */
export async function cropImage(href: string, r: FracRect): Promise<PreparedImage> {
	const img = await loadImage(href);
	const W = img.naturalWidth,
		H = img.naturalHeight;
	const sx = Math.round(r.x * W),
		sy = Math.round(r.y * H);
	const { canvas, ctx } = canvasOf(r.w * W, r.h * H);
	ctx.drawImage(img, sx, sy, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
	return encode(canvas, ctx);
}

/** Pivote l'image d'un quart de tour (sens horaire ou anti-horaire). */
export async function rotateImage(href: string, clockwise: boolean): Promise<PreparedImage> {
	const img = await loadImage(href);
	const W = img.naturalWidth,
		H = img.naturalHeight;
	const { canvas, ctx } = canvasOf(H, W);
	ctx.translate(H / 2, W / 2);
	ctx.rotate(((clockwise ? 1 : -1) * Math.PI) / 2);
	ctx.drawImage(img, -W / 2, -H / 2);
	return encode(canvas, ctx);
}

/** Efface une zone (devient transparente). */
export async function eraseImage(href: string, r: FracRect): Promise<PreparedImage> {
	const img = await loadImage(href);
	const { canvas, ctx } = canvasOf(img.naturalWidth, img.naturalHeight);
	ctx.drawImage(img, 0, 0);
	ctx.clearRect(r.x * canvas.width, r.y * canvas.height, r.w * canvas.width, r.h * canvas.height);
	return encode(canvas, ctx);
}

/**
 * Supprime le fond : les pixels proches du blanc deviennent transparents, avec un fondu
 * sur les pixels clairs pour garder des traits propres (anti-crénelage).
 */
export async function removeBackground(href: string, threshold = 225): Promise<PreparedImage> {
	const img = await loadImage(href);
	const { canvas, ctx } = canvasOf(img.naturalWidth, img.naturalHeight);
	ctx.drawImage(img, 0, 0);
	const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
	const px = data.data;
	for (let i = 0; i < px.length; i += 4) {
		const light = Math.min(px[i], px[i + 1], px[i + 2]);
		if (light >= threshold) {
			// 255 → transparent ; threshold → presque opaque.
			const a = Math.round(((255 - light) / Math.max(1, 255 - threshold)) * 255);
			px[i + 3] = Math.min(px[i + 3], a);
		}
	}
	ctx.putImageData(data, 0, 0);
	return encode(canvas, ctx);
}

/** Première image d'un événement coller (capture d'écran d'une documentation). */
export function imageFromClipboard(e: ClipboardEvent): File | null {
	for (const item of e.clipboardData?.items ?? [])
		if (item.type.startsWith('image/')) return item.getAsFile();
	return null;
}
