// Comparação facial no navegador (face-api / TensorFlow.js). O modelo vem do próprio site
// (public/models/face); as fotos nunca saem do aparelho.
export type FacePoint = { x: number; y: number };
export type FaceFound = {
  box: { x: number; y: number; width: number; height: number };
  score: number; landmarks: FacePoint[]; descriptor: Float32Array;
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

export async function detectFaces(img: HTMLImageElement, minConfidence = 0.35): Promise<FaceFound[]> {
  const faceapi = await loadFaceApi();
  const res = await faceapi.detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence })).withFaceLandmarks().withFaceDescriptors();
  return res.map((r: any) => {
    const b = r.detection.box; const pts: FacePoint[] = r.landmarks.positions.map((p: any) => ({ x: p.x, y: p.y }));
    const box = { x: b.x, y: b.y, width: b.width, height: b.height };
    const warnings: string[] = [];
    if (Math.min(box.width, box.height) < 90) warnings.push("rosto pequeno / pouca resolução");
    if (r.detection.score < 0.75) warnings.push("detecção fraca (rosto pouco nítido ou coberto)");
    // Rosto de lado: ponta do nariz longe do meio dos olhos.
    const le = pts.slice(36, 42); const re = pts.slice(42, 48);
    const ex = (le.reduce((s, p) => s + p.x, 0) / 6 + re.reduce((s, p) => s + p.x, 0) / 6) / 2;
    const eyeDist = Math.abs(re[0].x - le[3].x) + 1;
    if (Math.abs(pts[30].x - ex) / eyeDist > 0.35) warnings.push("rosto de lado (ângulo)");
    const lum = brightness(img, box);
    if (lum.mean < 55) warnings.push("rosto escuro");
    if (lum.blown > 0.12 || lum.mean > 215) warnings.push("luz estourada / reflexo");
    return { box, score: r.detection.score, landmarks: pts, descriptor: r.descriptor, warnings };
  }).sort((a: FaceFound, b: FaceFound) => b.box.width * b.box.height - a.box.width * a.box.height);
}

export function faceDistance(a: Float32Array, b: Float32Array) {
  let s = 0; for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; }
  return Math.sqrt(s);
}

/** Índice de semelhança (0–100) a partir da distância. 0,55 ≈ 50 (limiar usual do modelo: 0,6). */
export function similarity(distance: number) {
  return Math.round(100 / (1 + Math.exp((distance - 0.55) / 0.06)));
}

export function verdict(distance: number): { label: string; tone: "done" | "risk" | "late" | "muted" } {
  if (distance <= 0.42) return { label: "Muito provável que seja a mesma pessoa", tone: "done" };
  if (distance <= 0.5) return { label: "Provável que seja a mesma pessoa", tone: "done" };
  if (distance <= 0.6) return { label: "Inconclusivo — semelhança moderada", tone: "risk" };
  if (distance <= 0.68) return { label: "Inconclusivo — tende a pessoas diferentes", tone: "muted" };
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
