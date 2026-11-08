import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, FileText, Images, Loader2, ScanText, Send, ShieldAlert, Trash2, UserPlus } from "lucide-react";
import { PmmgShield } from "../components/Brand";
import { Button } from "../components/ui/button";
import { Field, Input, Select, Textarea } from "../components/ui/input";
import { INTEL_BUCKET, supabase } from "../supabase";
import { safeFileName } from "../lib/domain";
import { shrinkImage } from "../lib/image";
import type { IntakeFile, IntakePayload, IntakeSubmitter } from "../hooks/useIntake";
import type { Boletim } from "../lib/boletim";

const SUBMITTER_KEY = "si6_envio_policial";
const EMPTY: IntakePayload = { name: "", alias: "", birthDate: "", motherName: "", fatherName: "", document: "", address: "", neighborhood: "", city: "", crimes: "", reds: "", notes: "" };
const MAX_PHOTOS = 8;

type Photo = { file: File; preview: string };

/** Página aberta pelo link enviado no WhatsApp: outro policial cadastra um alvo, que entra como "Pendente" na base. */
export function IntakePublicView({ token }: { token: string }) {
  const [info, setInfo] = useState<{ valid: boolean; label?: string; link_id?: string; reason?: string } | null>(null);
  const [submitter, setSubmitter] = useState<IntakeSubmitter>(() => {
    try { return { name: "", register: "", unit: "", phone: "", ...JSON.parse(localStorage.getItem(SUBMITTER_KEY) || "{}") }; } catch { return { name: "", register: "", unit: "", phone: "" }; }
  });
  const [form, setForm] = useState<IntakePayload>(EMPTY);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [boFile, setBoFile] = useState<File | null>(null);
  const [bo, setBo] = useState<Boletim | null>(null);
  const [reading, setReading] = useState(false);
  const [sending, setSending] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(0);
  const [done, setDone] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const boRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = "Cadastro de alvo · SI 6ª CIA";
    supabase.rpc("intake_link_info", { p_token: token }).then(({ data, error: err }) => {
      if (err) setInfo({ valid: false, reason: "Não foi possível conferir o link. Tente de novo em instantes." });
      else setInfo(data as any);
    });
  }, [token]);

  const set = (key: keyof IntakePayload, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const setS = (key: keyof IntakeSubmitter, value: string) => setSubmitter((s) => ({ ...s, [key]: value }));

  function addPhotos(list: FileList | null) {
    const files = Array.from(list || []).filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(f.name));
    setPhotos((current) => [...current, ...files.map((file) => ({ file, preview: URL.createObjectURL(file) }))].slice(0, MAX_PHOTOS));
  }

  async function readBo(file: File) {
    setBoFile(file);
    setReading(true);
    try {
      const [{ extractPdfItems }, lib] = await Promise.all([import("../lib/pdf"), import("../lib/boletim")]);
      const parsed = lib.parseBoletim(await extractPdfItems(file));
      if (lib.isBoletim(parsed)) {
        setBo(parsed);
        setForm((f) => ({ ...f, reds: parsed.numero || f.reds, crimes: f.crimes || lib.naturezaCurta(parsed.natureza) }));
      } else setBo(null);
    } catch { setBo(null); } finally { setReading(false); }
  }

  function pickEnvolvido(index: string) {
    const e = bo?.envolvidos[Number(index)];
    if (!e) return;
    const docs = [e.rg && `RG ${e.rg}`, e.cpf && `CPF ${e.cpf}`].filter(Boolean).join(" · ");
    setForm((f) => ({
      ...f, name: e.nome, birthDate: e.nascimento || "", motherName: e.mae || "", fatherName: e.pai || "", document: docs,
      address: [e.endereco, e.numeroEndereco].filter(Boolean).join(", "), neighborhood: e.bairro || "", city: e.municipio ? `${e.municipio}${e.uf ? `/${e.uf}` : ""}` : "",
      notes: f.notes || `Envolvido como ${e.tipo.toLowerCase()} no REDS ${bo?.numero || ""}.`,
    }));
  }

  async function submit() {
    setError("");
    if (!submitter.name.trim() || !submitter.unit?.trim()) return setError("Informe seu nome (posto/graduação) e sua unidade.");
    if (!form.name.trim()) return setError("Informe o nome do alvo.");
    if (!info?.link_id) return;
    try { localStorage.setItem(SUBMITTER_KEY, JSON.stringify(submitter)); } catch { /* sem armazenamento */ }
    const uploaded: IntakeFile[] = [];
    const all: { file: File; kind: "photo" | "doc" }[] = [...photos.map((p) => ({ file: p.file, kind: "photo" as const })), ...(boFile ? [{ file: boFile, kind: "doc" as const }] : [])];
    for (const [i, item] of all.entries()) {
      setSending(`Enviando arquivo ${i + 1} de ${all.length}…`);
      const file = item.kind === "photo" ? await shrinkImage(item.file) : item.file;
      const path = `externo/${info.link_id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeFileName(file.name)}`;
      const type = file.type || (item.kind === "doc" ? "application/pdf" : "image/jpeg");
      let up = await supabase.storage.from(INTEL_BUCKET).upload(path, file, { upsert: false, contentType: type });
      if (up.error) up = await supabase.storage.from(INTEL_BUCKET).upload(path, file, { upsert: false, contentType: type });
      if (up.error) { setSending(""); return setError(`Não foi possível enviar ${file.name}. Confira a internet e tente de novo.`); }
      uploaded.push({ path, name: file.name, size: file.size, type, kind: item.kind });
    }
    setSending("Gravando o cadastro…");
    const clean = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, String(v || "").trim()])) as IntakePayload;
    const { error: err } = await supabase.rpc("intake_submit", { p_token: token, p_submitter: submitter, p_payload: { ...clean, name: clean.name.toUpperCase() }, p_files: uploaded });
    setSending("");
    if (err) return setError(err.message || "Não foi possível gravar. Tente de novo.");
    photos.forEach((p) => URL.revokeObjectURL(p.preview));
    setSent((n) => n + 1);
    setDone(true);
  }

  function another() {
    setForm(EMPTY); setPhotos([]); setBo(null); setBoFile(null); setDone(false); setError("");
    window.scrollTo({ top: 0 });
  }

  return (
    <main className="min-h-screen bg-pm-cream">
      <header className="relative bg-pm-black px-4 py-4 text-white">
        <span className="absolute inset-x-0 bottom-0 h-[3px] bg-pm-gold" />
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <PmmgShield className="h-12 w-auto" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-pm-gold-light">SI 6ª CIA · Inteligência</p>
            <h1 className="font-display text-xl font-black uppercase leading-tight">Cadastro de alvo</h1>
            {info?.valid && <p className="text-xs text-white/70">{info.label}</p>}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-4 p-4 pb-16">
        {!info && <p className="flex items-center gap-2 py-16 text-pm-muted"><Loader2 className="h-5 w-5 animate-spin" />Conferindo o link…</p>}
        {info && !info.valid && (
          <div className="rounded-sm border-l-4 border-status-late bg-white p-5 shadow-panel">
            <p className="flex items-center gap-2 font-black uppercase"><ShieldAlert className="h-5 w-5 text-status-late" />Link indisponível</p>
            <p className="mt-2 text-sm text-pm-muted">{info.reason} Peça um link novo a quem enviou.</p>
          </div>
        )}

        {info?.valid && done && (
          <div className="rounded-sm border-l-4 border-status-done bg-white p-6 text-center shadow-panel">
            <CheckCircle2 className="mx-auto h-12 w-12 text-status-done" />
            <p className="mt-2 font-display text-2xl font-black uppercase">Enviado</p>
            <p className="mt-1 text-sm text-pm-muted">O cadastro chegou à SI 6ª CIA e será conferido antes de entrar na base. {sent > 1 ? `${sent} alvos enviados nesta sessão.` : ""}</p>
            <Button variant="primary" size="lg" className="mt-5 w-full" onClick={another}><UserPlus />Cadastrar outro alvo</Button>
          </div>
        )}

        {info?.valid && !done && (
          <>
            <p className="rounded-sm bg-pm-gold/15 px-3 py-2 text-xs text-pm-ink"><b>Uso restrito a policiais.</b> As informações vão para a base reservada da Seção de Inteligência e passam por conferência. Seu nome e unidade ficam registrados no envio.</p>

            <section className="rounded-sm border border-pm-line bg-white p-4 shadow-panel">
              <p className="pm-eyebrow mb-3">Quem está enviando</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Posto/graduação e nome *"><Input value={submitter.name} onChange={(e) => setS("name", e.target.value)} placeholder="Ex.: Sgt Fulano" autoComplete="name" /></Field>
                <Field label="Nº PM"><Input value={submitter.register} onChange={(e) => setS("register", e.target.value)} inputMode="numeric" /></Field>
                <Field label="Unidade *"><Input value={submitter.unit} onChange={(e) => setS("unit", e.target.value)} placeholder="Ex.: 16º BPM / 2ª Cia" /></Field>
                <Field label="Telefone (WhatsApp)"><Input value={submitter.phone} onChange={(e) => setS("phone", e.target.value)} inputMode="tel" autoComplete="tel" /></Field>
              </div>
            </section>

            <section className="rounded-sm border border-pm-line bg-white p-4 shadow-panel">
              <p className="pm-eyebrow mb-3">Preencher pelo BO (opcional)</p>
              <button type="button" onClick={() => boRef.current?.click()} disabled={reading}
                className="flex w-full items-center gap-3 rounded-sm border-2 border-dashed border-pm-line px-4 py-3 text-left hover:border-pm-gold">
                {reading ? <Loader2 className="h-6 w-6 animate-spin text-pm-gold-dark" /> : boFile ? <FileText className="h-6 w-6 text-pm-gold-dark" /> : <ScanText className="h-6 w-6 text-pm-gold-dark" />}
                <span className="min-w-0"><b className="block truncate text-sm">{reading ? "Lendo o BO…" : boFile ? (bo?.numero ? `REDS ${bo.numero}` : boFile.name) : "Anexar o PDF do REDS"}</b>
                  <span className="text-xs text-pm-muted">{boFile ? "O PDF vai junto com o cadastro." : "Os dados do envolvido são preenchidos sozinhos."}</span></span>
              </button>
              <input ref={boRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) readBo(f); e.target.value = ""; }} />
              {bo && bo.envolvidos.some((x) => x.nome) && (
                <Field label="Qual envolvido é o alvo?" className="mt-3">
                  <Select defaultValue="" onChange={(e) => pickEnvolvido(e.target.value)}>
                    <option value="" disabled>Escolha…</option>
                    {bo.envolvidos.map((x, i) => x.nome && <option key={i} value={i}>{x.nome} — {x.tipo.toLowerCase()}</option>)}
                  </Select>
                </Field>
              )}
            </section>

            <section className="rounded-sm border border-pm-line bg-white p-4 shadow-panel">
              <p className="pm-eyebrow mb-3">Dados do alvo</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nome completo *" className="sm:col-span-2"><Input value={form.name} onChange={(e) => set("name", e.target.value)} autoCapitalize="characters" /></Field>
                <Field label="Vulgo"><Input value={form.alias} onChange={(e) => set("alias", e.target.value)} /></Field>
                <Field label="Nascimento"><Input type="date" value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} /></Field>
                <Field label="Mãe"><Input value={form.motherName} onChange={(e) => set("motherName", e.target.value)} /></Field>
                <Field label="Pai"><Input value={form.fatherName} onChange={(e) => set("fatherName", e.target.value)} /></Field>
                <Field label="RG / CPF"><Input value={form.document} onChange={(e) => set("document", e.target.value)} /></Field>
                <Field label="Nº REDS relacionado"><Input value={form.reds} onChange={(e) => set("reds", e.target.value)} placeholder="2026-000000000-001" /></Field>
                <Field label="Endereço" className="sm:col-span-2"><Input value={form.address} onChange={(e) => set("address", e.target.value)} /></Field>
                <Field label="Bairro"><Input value={form.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} /></Field>
                <Field label="Cidade"><Input value={form.city} onChange={(e) => set("city", e.target.value)} /></Field>
                <Field label="Crimes / modus operandi" className="sm:col-span-2"><Textarea rows={2} value={form.crimes} onChange={(e) => set("crimes", e.target.value)} /></Field>
                <Field label="Observações (área de atuação, veículos, comparsas…)" className="sm:col-span-2"><Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
              </div>
            </section>

            <section className="rounded-sm border border-pm-line bg-white p-4 shadow-panel">
              <p className="pm-eyebrow mb-3">Fotos ({photos.length}/{MAX_PHOTOS})</p>
              <div className="flex flex-wrap gap-2">
                {photos.map((p, i) => (
                  <div key={p.preview} className="relative h-28 w-20 overflow-hidden rounded-sm border border-pm-line">
                    <img src={p.preview} alt="" className="h-full w-full object-cover" />
                    <button type="button" onClick={() => setPhotos((list) => list.filter((_, j) => j !== i))} className="absolute right-0.5 top-0.5 grid h-7 w-7 place-items-center rounded-sm bg-pm-black/80 text-white" aria-label="Remover foto"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
              {photos.length < MAX_PHOTOS && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button size="lg" onClick={() => cameraRef.current?.click()}><Camera />Tirar foto</Button>
                  <Button size="lg" onClick={() => galleryRef.current?.click()}><Images />Galeria</Button>
                </div>
              )}
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
              <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
            </section>

            {error && <p className="rounded-sm border-l-4 border-status-late bg-red-50 px-3 py-2 text-sm font-semibold text-status-late">{error}</p>}
            <Button variant="primary" size="lg" className="w-full" onClick={submit} disabled={Boolean(sending) || reading}>
              {sending ? <Loader2 className="animate-spin" /> : <Send />}{sending || "Enviar cadastro"}
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
