// Rasterisation SVG → PNG, pour les schémas insérés dans le .docx.
//
// Word n'affiche pas le SVG de façon fiable (et pas du tout dans les versions que rencontrent
// les clients) : les schémas y entrent en PNG. Le PDF, lui, garde le SVG natif — il reste net à
// l'impression, et cette fonction ne le concerne pas.
//
// Le chemin passe par <img> + canvas, disponible dans tout navigateur. Aucune ressource externe
// n'est chargée : le SVG est autonome, encodé en data-URI, ce qui évite aussi les blocages de
// canvas « tainted ».

const DEFAULT_SCALE = 2;   // 2× : lisible à l'impression sans alourdir démesurément le document

/**
 * @returns {Promise<{ data: Uint8Array, width: number, height: number }>}
 * Rejette si l'image ne se charge pas — l'appelant remplace alors le schéma par une note, plutôt
 * que d'insérer une image vide dans le document.
 */
export function svgToPng(svg, { scale = DEFAULT_SCALE } = {}) {
  return new Promise((resolve, reject) => {
    const { width, height } = sizeOf(svg);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        const ctx = canvas.getContext('2d');
        // Fond opaque : un PNG transparent posé dans Word prend la couleur du papier, et les
        // libellés gris clair deviennent illisibles.
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve({ data: dataUrlToBytes(canvas.toDataURL('image/png')), width, height });
      } catch (err) { reject(err); }
    };
    img.onerror = () => reject(new Error('SVG illisible pour la rasterisation'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

/** Dimensions déclarées par l'enveloppe (svgDocument les écrit toujours). */
export function sizeOf(svg) {
  const w = /width="(\d+(?:\.\d+)?)"/.exec(svg);
  const h = /height="(\d+(?:\.\d+)?)"/.exec(svg);
  return { width: w ? Number(w[1]) : 600, height: h ? Number(h[1]) : 300 };
}

export function dataUrlToBytes(dataUrl) {
  const b64 = String(dataUrl).split(',')[1] || '';
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Ajuste une image à la largeur utile d'une page A4 portrait (~16,5 cm ≈ 624 pt), en conservant
 * les proportions. Sans cela, un schéma de 12 nœuds déborde de la page.
 */
export function fitToPage(width, height, maxWidth = 624) {
  if (width <= maxWidth) return { width: Math.round(width), height: Math.round(height) };
  const ratio = maxWidth / width;
  return { width: Math.round(maxWidth), height: Math.round(height * ratio) };
}
