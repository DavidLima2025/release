// Reconhecimento facial "buffalo_l" (InsightFace · ArcFace ResNet-50 treinado em WebFace600K) rodando
// no navegador com ONNX Runtime Web. O modelo é baixado uma vez (Hugging Face) e guardado no aparelho
// (Cache Storage); as fotos nunca saem do navegador. Licença do modelo: InsightFace, só pesquisa não comercial.
import type { FaceFound, FacePoint } from "./face";

export const ARC_MODEL_URL = "https://huggingface.co/immich-app/buffalo_l/resolve/main/recognition/model.onnx";
const CACHE_NAME = "face-models-v1";
const MIN_BYTES = 50_000_000; // abaixo disso não pode ser o modelo (página de erro, download cortado)

export type ArcProgress = { phase: "cache" | "download" | "init"; loaded?: number; total?: number };

async function openCache(): Promise<Cache | null> {
  try { return typeof caches === "undefined" ? null : await caches.open(CACHE_NAME); } catch { return null; }
}

/** Baixa o modelo (com progresso) ou lê do cache do aparelho. */
async function modelBytes(onProgress?: (p: ArcProgress) => void): Promise<Uint8Array> {
  const cache = await openCache();
  if (cache) {
    try {
      const hit = await cache.match(ARC_MODEL_URL);
      if (hit) {
        onProgress?.({ phase: "cache" });
        const b = new Uint8Array(await hit.arrayBuffer());
        if (b.length >= MIN_BYTES) return b;
        await cache.delete(ARC_MODEL_URL);
      }
    } catch { /* segue para o download */ }
  }
  const resp = await fetch(ARC_MODEL_URL, { mode: "cors" });
  if (!resp.ok || !resp.body) throw new Error(`Falha ao baixar o modelo (HTTP ${resp.status}).`);
  const total = Number(resp.headers.get("content-length")) || 0;
  const saving = cache ? cache.put(ARC_MODEL_URL, resp.clone()).catch(() => {}) : null;
  const reader = resp.body.getReader();
  let buf = total > 0 ? new Uint8Array(total) : null; const chunks: Uint8Array[] = []; let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    if (buf && loaded + value.length <= buf.length) buf.set(value, loaded); else { if (buf) { chunks.push(buf.subarray(0, loaded)); buf = null; } chunks.push(value); }
    loaded += value.length; onProgress?.({ phase: "download", loaded, total });
  }
  if (saving) await saving;
  let bytes: Uint8Array;
  if (buf && loaded === buf.length) bytes = buf;
  else { bytes = new Uint8Array(loaded); let o = 0; for (const c of chunks) { bytes.set(c, o); o += c.length; } }
  if (bytes.length < MIN_BYTES) { try { await cache?.delete(ARC_MODEL_URL); } catch { /* ok */ } throw new Error("O arquivo do modelo veio incompleto. Tente de novo."); }
  return bytes;
}

let session: Promise<any> | null = null;
let ortMod: any = null;

/** Carrega o motor ONNX e o modelo (uma vez por aba). */
export function loadArc(onProgress?: (p: ArcProgress) => void) {
  if (!session) {
    session = (async () => {
      // @ts-ignore — subcaminho do pacote onnxruntime-web (só WebAssembly)
      const ort: any = await import("onnxruntime-web/wasm");
      ort.env.wasm.wasmPaths = "/ort/"; // arquivos copiados no build (scripts/copy-ort.mjs)
      ort.env.wasm.numThreads = 1;
      const bytes = await modelBytes(onProgress);
      onProgress?.({ phase: "init" });
      const s = await ort.InferenceSession.create(bytes, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
      ortMod = ort;
      return s;
    })().catch((e) => { session = null; throw e; });
  }
  return session;
}

// Posição padrão dos 5 pontos (olho esq., olho dir., nariz, canto esq. e dir. da boca) num rosto 112×112 (ArcFace).
const TEMPLATE: [number, number][] = [[38.2946, 51.6963], [73.5318, 51.5014], [56.0252, 71.7366], [41.5493, 92.3655], [70.7299, 92.2041]];
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / (xs.length || 1);

/** Os 5 pontos a partir dos 68 do face-api (centro dos olhos, ponta do nariz, cantos da boca). */
function fivePoints(p: FacePoint[]): [number, number][] {
  const c = (a: number, b: number): [number, number] => [mean(p.slice(a, b).map((q) => q.x)), mean(p.slice(a, b).map((q) => q.y))];
  return [c(36, 42), c(42, 48), [p[30].x, p[30].y], [p[48].x, p[48].y], [p[54].x, p[54].y]];
}

/** Transformação de semelhança (giro + escala + deslocamento) por mínimos quadrados. */
function similarityTransform(src: [number, number][], dst: [number, number][]) {
  const n = src.length;
  const sx = mean(src.map((p) => p[0])), sy = mean(src.map((p) => p[1])), dx = mean(dst.map((p) => p[0])), dy = mean(dst.map((p) => p[1]));
  let num1 = 0, num2 = 0, den = 0;
  for (let i = 0; i < n; i++) {
    const x = src[i][0] - sx, y = src[i][1] - sy, u = dst[i][0] - dx, v = dst[i][1] - dy;
    num1 += x * u + y * v; num2 += x * v - y * u; den += x * x + y * y;
  }
  const a = num1 / (den || 1), b = num2 / (den || 1);
  return { a, b, tx: dx - (a * sx - b * sy), ty: dy - (b * sx + a * sy) };
}

const S = 112;
/** Rosto alinhado 112×112 (olhos na horizontal, mesma posição/escala do treino do modelo), opcionalmente espelhado. */
function alignedFace(img: HTMLImageElement | HTMLCanvasElement, pts: FacePoint[], flip: boolean) {
  const t = similarityTransform(fivePoints(pts), TEMPLATE);
  const c = document.createElement("canvas"); c.width = S; c.height = S;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, S, S); ctx.imageSmoothingQuality = "high";
  ctx.setTransform(t.a, t.b, -t.b, t.a, t.tx, t.ty); ctx.drawImage(img, 0, 0);
  if (!flip) return c;
  const f = document.createElement("canvas"); f.width = S; f.height = S;
  const fx = f.getContext("2d", { willReadFrequently: true })!; fx.translate(S, 0); fx.scale(-1, 1); fx.drawImage(c, 0, 0);
  return f;
}

function unit(v: Float32Array) {
  let s = 0; for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  const n = Math.sqrt(s) || 1; return v.map((x) => x / n);
}

async function embed(sess: any, face: HTMLCanvasElement) {
  const d = face.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, S, S).data;
  const plane = S * S; const x = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) { x[i] = (d[i * 4] - 127.5) / 127.5; x[plane + i] = (d[i * 4 + 1] - 127.5) / 127.5; x[2 * plane + i] = (d[i * 4 + 2] - 127.5) / 127.5; } // RGB, como no treino
  const out = await sess.run({ [sess.inputNames[0]]: new ortMod.Tensor("float32", x, [1, 3, S, S]) });
  return unit(Float32Array.from(out[sess.outputNames[0]].data as ArrayLike<number>));
}

const cached = new WeakMap<FaceFound, Float32Array>();
/** Impressão (512 números) do rosto: média do rosto alinhado com o seu espelho. */
export async function arcEmbedding(img: HTMLImageElement | HTMLCanvasElement, face: FaceFound): Promise<Float32Array> {
  const hit = cached.get(face); if (hit) return hit;
  const sess = await loadArc();
  const a = await embed(sess, alignedFace(img, face.landmarks, false));
  const b = await embed(sess, alignedFace(img, face.landmarks, true));
  const m = unit(a.map((x, i) => x + b[i]));
  cached.set(face, m); return m;
}

/** Semelhança de cosseno entre duas impressões já normalizadas (1 = idênticas, ~0 = sem relação). */
export function cosine(a: Float32Array, b: Float32Array) {
  let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s;
}

// Limiares INICIAIS para este tipo de modelo (cosseno ≈ 0,30–0,35 é o ponto de decisão usual); a calibrar com testes reais.
/** Índice 0–100: 50 no ponto de decisão (0,33); curva íngreme (0,45 ≈ 95, 0,40 ≈ 85, 0,28 ≈ 22, 0,20 ≈ 4). Não é probabilidade. */
export function arcIndex(sim: number) { return Math.round(100 / (1 + Math.exp(-(sim - 0.33) / 0.04))); }

export function arcVerdict(sim: number, hard = false): { label: string; tone: "done" | "risk" | "late" | "muted" } {
  if (sim >= 0.5) return { label: "Muito provável que seja a mesma pessoa", tone: "done" };
  if (sim >= 0.38) return { label: "Provável que seja a mesma pessoa", tone: "done" };
  if (sim >= 0.28) return { label: "Inconclusivo — perto do limiar", tone: "risk" };
  if (sim >= (hard ? 0.15 : 0.2)) return { label: "Inconclusivo — tende a pessoas diferentes", tone: "muted" };
  return { label: "Provavelmente pessoas diferentes", tone: "late" };
}
