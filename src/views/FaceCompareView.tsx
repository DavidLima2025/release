import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Camera, Download, Loader2, ScanFace, Search, Upload, X } from "lucide-react";
import { Card, CardContent, SectionHeader } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import type { AppData } from "../hooks/useAppData";
import { matchesText, type Author } from "../lib/domain";
import { detectFaces, faceDistance, loadFaceApi, similarity, verdict, type FaceFound } from "../lib/face";

type Side = {
  url: string; name: string; author?: Author;
  img?: HTMLImageElement; faces: FaceFound[]; pick: number; status: "" | "lendo" | "pronto" | "sem-rosto" | "erro";
};
const EMPTY: Side = { url: "", name: "", faces: [], pick: 0, status: "" };

async function toImage(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

/** Comparação facial entre duas fotos — auxílio à análise, não identificação. */
export function FaceCompareView({ data }: { data: AppData }) {
  const [a, setA] = useState<Side>(EMPTY);
  const [b, setB] = useState<Side>(EMPTY);
  const [model, setModel] = useState<"" | "carregando" | "ok" | "erro">("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    setModel("carregando");
    loadFaceApi().then(() => setModel("ok")).catch((e) => { console.error(e); setModel("erro"); });
  }, []);

  const set = (which: "a" | "b", v: Side) => (which === "a" ? setA(v) : setB(v));

  async function load(which: "a" | "b", src: string, name: string, author?: Author) {
    setSaved("");
    set(which, { ...EMPTY, url: src, name, author, status: "lendo" });
    try {
      const img = await toImage(src);
      const faces = await detectFaces(img);
      set(which, { url: src, name, author, img, faces, pick: 0, status: faces.length ? "pronto" : "sem-rosto" });
    } catch (e) {
      console.error(e);
      set(which, { ...EMPTY, url: src, name, author, status: "erro" });
    }
  }
  const fromFile = (which: "a" | "b", f?: File | null) => { if (f && f.type.startsWith("image/")) load(which, URL.createObjectURL(f), f.name); };
  const fromAuthor = async (which: "a" | "b", au: Author) => {
    const ph = data.authorPhotos.find((p) => p.authorId === au.id && (p.category || "perfil") === "perfil") || data.authorPhotos.find((p) => p.authorId === au.id);
    if (!ph) { window.alert("Esse alvo não tem foto cadastrada."); return; }
    setBusy(true);
    try {
      // Baixa para um link local: evita bloqueio de leitura da imagem (CORS) no canvas.
      const blob = await fetch(data.getIntelFileUrl(ph.filePath)).then((r) => r.blob());
      await load(which, URL.createObjectURL(blob), au.name, au);
    } catch { window.alert("Não foi possível abrir a foto do alvo."); }
    finally { setBusy(false); }
  };

  const fa = a.faces[a.pick]; const fb = b.faces[b.pick];
  const dist = fa && fb ? faceDistance(fa.descriptor, fb.descriptor) : null;
  const v = dist !== null ? verdict(dist) : null;
  const score = dist !== null ? similarity(dist) : null;
  const toneCls: Record<string, string> = { done: "bg-status-done text-white", risk: "bg-status-risk text-white", late: "bg-status-late text-white", muted: "bg-pm-sand text-pm-ink" };

  useEffect(() => {
    if (dist === null) return;
    data.addAudit("Comparação facial", `${a.name || "foto A"} × ${b.name || "foto B"}: índice ${score}% (distância ${dist.toFixed(3)}).`);
  }, [dist]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Junta as duas fotos (rostos recortados) com o resultado numa imagem. */
  async function resultImage() {
    if (!fa || !fb || !a.img || !b.img || dist === null || !v) return null;
    const W = 900; const H = 560; const c = document.createElement("canvas"); c.width = W; c.height = H;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#0B0B0C"; ctx.fillRect(0, 0, W, 54);
    ctx.fillStyle = "#CFC29B"; ctx.font = "800 20px Arial"; ctx.fillText("COMPARAÇÃO FACIAL — RESERVADO", 20, 34);
    const crop = (img: HTMLImageElement, f: FaceFound, x: number) => {
      const m = 0.35; const bx = Math.max(0, f.box.x - f.box.width * m); const by = Math.max(0, f.box.y - f.box.height * m);
      const bw = Math.min(img.naturalWidth - bx, f.box.width * (1 + 2 * m)); const bh = Math.min(img.naturalHeight - by, f.box.height * (1 + 2 * m));
      const s = Math.min(380 / bw, 380 / bh); const w = bw * s; const h = bh * s;
      ctx.drawImage(img, bx, by, bw, bh, x + (400 - w) / 2, 70 + (380 - h) / 2, w, h);
    };
    crop(a.img, fa, 40); crop(b.img, fb, 460);
    ctx.fillStyle = "#0B0B0C"; ctx.font = "700 15px Arial";
    ctx.fillText((a.name || "Foto A").slice(0, 44), 40, 472); ctx.fillText((b.name || "Foto B").slice(0, 44), 460, 472);
    ctx.font = "800 22px Arial"; ctx.fillText(`Índice de semelhança: ${score}% — ${v.label}`, 40, 510);
    ctx.font = "13px Arial"; ctx.fillStyle = "#6B655A";
    ctx.fillText(`Distância ${dist.toFixed(3)} (limiar do modelo 0,60). Auxílio à análise — não é identificação. ${new Date().toLocaleString("pt-BR")} · ${data.currentUser?.warName || data.currentUser?.name || ""}`, 40, 538);
    return new Promise<File | null>((res) => c.toBlob((bl) => res(bl ? new File([bl], `comparacao-facial-${Date.now()}.png`, { type: "image/png" }) : null), "image/png"));
  }
  async function download() {
    const f = await resultImage(); if (!f) return;
    const url = URL.createObjectURL(f); const l = document.createElement("a"); l.href = url; l.download = f.name; l.click(); setTimeout(() => URL.revokeObjectURL(url), 3000);
  }
  async function saveTo(au: Author) {
    const f = await resultImage(); if (!f) return;
    const other = au.id === a.author?.id ? b.name : a.name;
    const ok = await data.uploadAuthorFile(au, f, "photo", { category: "levantamento", description: `Comparação facial com ${other || "outra foto"}: índice ${score}% (${v!.label.toLowerCase()}).` });
    if (ok) setSaved(au.name);
  }

  const slot = (which: "a" | "b", s: Side) => <FaceSlot side={s} label={which === "a" ? "Foto A" : "Foto B"} data={data} busy={busy}
    onFile={(f) => fromFile(which, f)} onAuthor={(au) => fromAuthor(which, au)} onPick={(i) => set(which, { ...s, pick: i })} onClear={() => set(which, EMPTY)} />;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-sm border border-status-risk/40 bg-status-risk/10 p-3 text-sm">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-status-risk" />
        <p><b>Auxílio à análise, não identificação.</b> O índice mede semelhança entre rostos e pode errar — principalmente com foto de baixa qualidade, de lado, com óculos escuros, boné, máscara, luz forte ou muitos anos de diferença. Confirme por reconhecimento formal ou perícia. As fotos são analisadas no seu aparelho e não são enviadas a nenhum serviço externo.</p>
      </div>
      {model === "carregando" && <p className="flex items-center gap-2 text-sm text-pm-muted"><Loader2 className="h-4 w-4 animate-spin" />Carregando o modelo de reconhecimento (só na primeira vez, alguns MB)…</p>}
      {model === "erro" && <p className="rounded-sm bg-status-late/10 p-3 text-sm font-semibold text-status-late">Não foi possível carregar o modelo de reconhecimento. Atualize a página; se continuar, me avise.</p>}

      <div className="grid gap-5 lg:grid-cols-2">{slot("a", a)}{slot("b", b)}</div>

      {(a.status === "pronto" && b.status === "pronto") && dist !== null && v && score !== null && (
        <Card>
          <CardContent>
            <SectionHeader icon={ScanFace} title="Resultado" />
            <div className="grid gap-4 md:grid-cols-[220px_1fr]">
              <div className="grid place-items-center rounded-sm bg-pm-black p-4 text-center text-white">
                <p className="text-5xl font-black text-pm-gold-light">{score}%</p>
                <p className="text-xs font-bold uppercase tracking-wider">índice de semelhança</p>
              </div>
              <div className="space-y-2 text-sm">
                <p><span className={`rounded-sm px-2 py-1 text-sm font-black uppercase ${toneCls[v.tone]}`}>{v.label}</span></p>
                <div className="relative mt-3 h-3 rounded-full bg-gradient-to-r from-status-late via-status-risk to-status-done">
                  <span className="absolute -top-1 h-5 w-1.5 rounded-sm bg-pm-black" style={{ left: `calc(${score}% - 3px)` }} />
                </div>
                <div className="flex justify-between text-[10px] font-bold uppercase text-pm-muted"><span>diferentes</span><span>inconclusivo</span><span>mesma pessoa</span></div>
                <p className="text-xs text-pm-muted">Distância entre as "impressões" dos rostos: <b>{dist.toFixed(3)}</b> (quanto menor, mais parecidos; limiar usual do modelo: 0,60).</p>
                {[...fa!.warnings.map((w) => `Foto A: ${w}`), ...fb!.warnings.map((w) => `Foto B: ${w}`)].length > 0 && (
                  <p className="rounded-sm bg-status-risk/10 px-2 py-1 text-xs font-semibold text-status-risk">Atenção à qualidade — {[...fa!.warnings.map((w) => `A: ${w}`), ...fb!.warnings.map((w) => `B: ${w}`)].join("; ")}. O resultado é menos confiável.</p>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" onClick={download}><Download />Baixar resultado (imagem)</Button>
                  {[a.author, b.author].filter(Boolean).map((au) => <Button key={au!.id} size="sm" variant="gold" onClick={() => saveTo(au!)}><Camera />Salvar no card de {au!.name.split(" ")[0]} (levantamento)</Button>)}
                </div>
                {saved && <p className="text-xs font-semibold text-status-done">Salvo nas fotos de levantamento de {saved}.</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FaceSlot({ side, label, data, busy, onFile, onAuthor, onPick, onClear }: {
  side: Side; label: string; data: AppData; busy: boolean;
  onFile: (f?: File | null) => void; onAuthor: (a: Author) => void; onPick: (i: number) => void; onClear: () => void;
}) {
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const withPhoto = new Set(data.authorPhotos.map((p) => p.authorId));
  const found = q.trim() ? data.authors.filter((a) => withPhoto.has(a.id) && matchesText([a.name, a.alias, a.document], q)).slice(0, 8) : [];
  const W = side.img?.naturalWidth || 1; const H = side.img?.naturalHeight || 1;

  return (
    <Card>
      <CardContent>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="pm-heading text-base">{label}{side.name && <span className="ml-2 text-sm font-semibold normal-case text-pm-muted">{side.name}</span>}</h3>
          {side.url && <Button size="icon" variant="ghost" title="Trocar foto" onClick={onClear}><X /></Button>}
        </div>
        {!side.url ? (
          <div className="space-y-3" onPaste={(e) => { const f = [...e.clipboardData.files].find((x) => x.type.startsWith("image/")); if (f) onFile(f); }} tabIndex={0}>
            <button type="button" onClick={() => input.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}
              className="grid h-44 w-full place-items-center rounded-sm border-2 border-dashed border-pm-line bg-pm-cream/50 text-sm text-pm-muted hover:border-pm-gold">
              <span className="grid place-items-center gap-1"><Upload className="h-6 w-6" /><b>Escolher foto</b><span className="text-xs">ou arraste aqui / cole (Ctrl+V)</span></span>
            </button>
            <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <div>
              <p className="pm-label mb-1">ou foto de um alvo do banco</p>
              <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-pm-muted" /><Input className="pl-9" placeholder="Nome, vulgo, RG…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
              <div className="mt-1 grid gap-1">{found.map((a) => (
                <button key={a.id} type="button" disabled={busy} onClick={() => onAuthor(a)} className="rounded-sm border border-pm-line px-2 py-1.5 text-left text-sm hover:border-pm-gold"><b className="uppercase">{a.name}</b>{a.alias ? ` ("${a.alias}")` : ""}</button>
              ))}</div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative overflow-hidden rounded-sm bg-pm-black">
              <img src={side.url} alt="" className="block max-h-[420px] w-full object-contain" />
              {side.img && (
                <svg viewBox={`0 0 ${W} ${H}`} className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet">
                  {side.faces.map((f, i) => (
                    <g key={i} className="pointer-events-auto cursor-pointer" onClick={() => onPick(i)}>
                      <rect x={f.box.x} y={f.box.y} width={f.box.width} height={f.box.height} fill="transparent" stroke={i === side.pick ? "#F5D547" : "#ffffff88"} strokeWidth={Math.max(2, W / 250)} />
                      {i === side.pick && f.landmarks.map((p, k) => <circle key={k} cx={p.x} cy={p.y} r={Math.max(1.5, W / 400)} fill="#2EE59D" />)}
                    </g>
                  ))}
                </svg>
              )}
              {side.status === "lendo" && <div className="absolute inset-0 grid place-items-center bg-black/50 text-sm font-bold text-white"><span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Procurando o rosto…</span></div>}
            </div>
            {side.status === "sem-rosto" && <p className="text-sm font-semibold text-status-late">Nenhum rosto encontrado. Tente uma foto mais próxima, de frente e com o rosto visível.</p>}
            {side.status === "erro" && <p className="text-sm font-semibold text-status-late">Não foi possível ler a imagem.</p>}
            {side.faces.length > 1 && <p className="text-xs text-pm-muted">{side.faces.length} rostos na foto — toque no rosto certo (o amarelo é o usado).</p>}
            {side.faces[side.pick] && <p className="text-xs text-pm-muted">Pontos verdes: os 68 pontos do rosto usados para alinhar (olhos, sobrancelhas, nariz, boca e mandíbula).{side.faces[side.pick].warnings.length ? <b className="text-status-risk"> Qualidade: {side.faces[side.pick].warnings.join(", ")}.</b> : ""}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
