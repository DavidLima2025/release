// Comparação facial no navegador (face-api / TensorFlow.js). O modelo vem do próprio site
// (public/models/face); as fotos nunca saem do aparelho.
export type FacePoint = { x: number; y: number };
export type FaceFound = {
  box: { x: number; y: number; width: number; height: number };
  score: number; landmarks: FacePoint[];
  /** Impressão "crua" (como o modelo devolve, sem endireitar o rosto). */
  descriptor: Float32Array;
  /** Impressão usada na comparação: rosto endireitado pela linha dos olhos e média com o espelhado. */
  emb: Float32Array;
  /** Inclinação da cabeça (graus) corrigida antes de comparar; `aligned` = se a correção rodou. */
  roll: number; aligned: boolean;
  /** Alertas de qualidade (rosto pequeno, de lado, detecção fraca, iluminação). */
  warnings: string[];
};

let loading: Promise<any> | null = null;
export function loadFaceApi() {
  if (!loading) {
    loading = (async () => {
      const faceapi: any = await import("@vladmandic/face-api");
      const url = "/models/face";
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(url),
        faceapi.nets.faceLandmark68Net.loadFromUri(url),
        faceapi.nets.faceRecognitionNet.loadFromUri(url),
      ]);
      return faceapi;
    })().catch((e) => { loading = null; throw e; });
  }
  return loading;
}

function brightness(img: HTMLImageElement | HTMLCanvasElement, box: FaceFound["box"]) {
  const c = document.createElement("canvas"); c.width = 32; c.height = 32;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, box.x, box.y, box.width, box.height, 0, 0, 32, 32);
  const d = ctx.getImageData(0, 0, 32, 32).data;
  let sum = 0; let over = 0;
  for (let i = 0; i < d.length; i += 4) { const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; sum += l; if (l > 245) over += 1; }
  return { mean: sum / (d.length / 4), blown: over / (d.length / 4) };
}

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / (xs.length || 1);

/** Eixo dos olhos: ângulo (rad) da linha entre os centros dos olhos, distância e ponto médio. */
function eyeAxis(pts: FacePoint[]) {
  const l = { x: mean(pts.slice(36, 42).map((p) => p.x)), y: mean(pts.slice(36, 42).map((p) => p.y)) };
  const r = { x: mean(pts.slice(42, 48).map((p) => p.x)), y: mean(pts.slice(42, 48).map((p) => p.y)) };
  const dx = r.x - l.x; const dy = r.y - l.y;
  return { angle: Math.atan2(dy, dx), dist: Math.hypot(dx, dy) || 1, mid: { x: (l.x + r.x) / 2, y: (l.y + r.y) / 2 } };
}

const SIZE = 400;
/**
 * O face-api recorta o rosto sem girar: com a cabeça inclinada (deitado, celular torto) a impressão piora.
 * Aqui o rosto é recortado, endireitado pela linha dos olhos, e a impressão é a média do rosto e do seu
 * espelho (reduz o efeito de o rosto estar um pouco virado). Devolve null se não conseguir refazer a leitura.
 */
async function alignedEmbedding(faceapi: any, img: HTMLImageElement | HTMLCanvasElement, pts: FacePoint[], box: FaceFound["box"]): Promise<Float32Array | null> {
  const ax = eyeAxis(pts);
  if (Math.abs((ax.angle * 180) / Math.PI) > 70) return null;
  const xs = pts.map((p) => p.x); const ys = pts.map((p) => p.y);
  const cx = mean(xs); const cy = mean(ys);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), box.width, box.height);
  const k = SIZE / (span * 2.1);
  const crop = (flip: boolean) => {
    const c = document.createElement("canvas"); c.width = SIZE; c.height = SIZE;
    const ctx = c.getContext("2d")!; ctx.fillStyle = "#7f7f7f"; ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.translate(SIZE / 2, SIZE / 2); if (flip) ctx.scale(-1, 1);
    ctx.rotate(-ax.angle); ctx.scale(k, k); ctx.drawImage(img, -cx, -cy);
    return c;
  };
  const read = async (c: HTMLCanvasElement) => {
    const res = await faceapi.detectAllFaces(c, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.2 })).withFaceLandmarks().withFaceDescriptors();
    let best: any = null; let bd = Infinity;
    for (const r of res) { const b = r.detection.box; const d = Math.hypot(b.x + b.width / 2 - SIZE / 2, b.y + b.height / 2 - SIZE / 2); if (d < bd) { bd = d; best = r; } }
    return best && bd < SIZE * 0.25 ? (best.descriptor as Float32Array) : null;
  };
  const d1 = await read(crop(false)); if (!d1) return null;
  const d2 = await read(crop(true)); if (!d2) return d1;
  return new Float32Array(d1.length).map((_, i) => (d1[i] + d2[i]) / 2);
}

export async function detectFaces(img: HTMLImageElement, minConfidence = 0.35): Promise<FaceFound[]> {
  const faceapi = await loadFaceApi();
  const res = await faceapi.detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence })).withFaceLandmarks().withFaceDescriptors();
  const faces: FaceFound[] = res.map((r: any) => {
    const b = r.detection.box; const pts: FacePoint[] = r.landmarks.positions.map((p: any) => ({ x: p.x, y: p.y }));
    const box = { x: b.x, y: b.y, width: b.width, height: b.height };
    const warnings: string[] = [];
    if (Math.min(box.width, box.height) < 90) warnings.push("rosto pequeno / pouca resolução");
    if (r.detection.score < 0.75) warnings.push("detecção fraca (rosto pouco nítido ou coberto)");
    // Rosto de lado: ponta do nariz afastada do meio dos olhos, medida ao longo da linha dos olhos
    // (assim a cabeça só inclinada não conta como "de lado").
    const ax = eyeAxis(pts);
    const off = ((pts[30].x - ax.mid.x) * Math.cos(ax.angle) + (pts[30].y - ax.mid.y) * Math.sin(ax.angle)) / ax.dist;
    if (Math.abs(off) > 0.18) warnings.push("rosto de lado (ângulo)");
    const lum = brightness(img, box);
    if (lum.mean < 55) warnings.push("rosto escuro");
    if (lum.blown > 0.12 || lum.mean > 215) warnings.push("luz estourada / reflexo");
    return { box, score: r.detection.score, landmarks: pts, descriptor: r.descriptor, emb: r.descriptor, roll: (ax.angle * 180) / Math.PI, aligned: false, warnings };
  }).sort((a: FaceFound, b: FaceFound) => b.box.width * b.box.height - a.box.width * a.box.height);
  // Endireita e espelha os maiores (em foto de grupo, o resto fica com a impressão crua).
  for (const f of faces.slice(0, 5)) {
    try { const e = await alignedEmbedding(faceapi, img, f.landmarks, f.box); if (e) { f.emb = e; f.aligned = true; } } catch (e) { console.error(e); }
  }
  return faces;
}

export function faceDistance(a: Float32Array, b: Float32Array) {
  let s = 0; for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; }
  return Math.sqrt(s);
}

/**
 * Índice de semelhança (0–100) a partir da distância. O meio da escala (50) fica no limiar publicado do
 * modelo (0,60); não é probabilidade. Ex.: 0,45 ≈ 90; 0,60 = 50; 0,75 ≈ 10.
 */
export function similarity(distance: number) {
  return Math.round(100 / (1 + Math.exp((distance - 0.6) / 0.07)));
}

/** `hard`: foto difícil (de lado, fraca, pequena, escura, estourada) — a distância sobe mesmo para a mesma pessoa. */
export function verdict(distance: number, hard = false): { label: string; tone: "done" | "risk" | "late" | "muted" } {
  if (distance <= 0.45) return { label: "Muito provável que seja a mesma pessoa", tone: "done" };
  if (distance <= 0.55) return { label: "Provável que seja a mesma pessoa", tone: "done" };
  if (distance <= 0.65) return { label: "Inconclusivo — perto do limiar", tone: "risk" };
  if (distance <= (hard ? 0.8 : 0.72)) return { label: "Inconclusivo — tende a pessoas diferentes", tone: "muted" };
  return { label: "Provavelmente pessoas diferentes", tone: "late" };
}

/** Gira a imagem (90, 180 ou 270 graus) num canvas. */
export function rotateImage(img: HTMLImageElement, deg: number) {
  const c = document.createElement("canvas");
  const w = img.naturalWidth; const h = img.naturalHeight;
  const swap = deg % 180 !== 0;
  c.width = swap ? h : w; c.height = swap ? w : h;
  const ctx = c.getContext("2d")!;
  ctx.translate(c.width / 2, c.height / 2); ctx.rotate((deg * Math.PI) / 180); ctx.drawImage(img, -w / 2, -h / 2);
  return c.toDataURL("image/jpeg", 0.95);
}
const asImage = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

/**
 * Procura o rosto também com a foto girada (pessoa deitada, celular de lado) e, se precisar,
 * com uma régua mais tolerante. Devolve a imagem na posição em que o rosto foi achado.
 */
export async function detectAnyOrientation(img: HTMLImageElement, start = 0): Promise<{ img: HTMLImageElement; url?: string; faces: FaceFound[]; rotation: number }> {
  const order = [0, 90, 270, 180].map((d) => (d + start) % 360);
  for (const tolerant of [false, true]) {
    for (const deg of order) {
      const url = deg ? rotateImage(img, deg) : undefined;
      const im = url ? await asImage(url) : img;
      const faces = await detectFaces(im, tolerant ? 0.18 : 0.35);
      if (faces.length) return { img: im, url, faces: tolerant ? faces.map((f) => ({ ...f, warnings: [...f.warnings, "rosto achado com régua tolerante"] })) : faces, rotation: deg };
    }
  }
  return { img, faces: [], rotation: 0 };
}
