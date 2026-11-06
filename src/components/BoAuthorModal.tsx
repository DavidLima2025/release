import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, FileText, FolderLock, Link2, Loader2, MapPin, ScanText, UserRound } from "lucide-react";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";
import { Field, Input, Select, Textarea } from "./ui/input";
import { Badge } from "./ui/badge";
import type { Author } from "../lib/domain";
import { formatBR } from "../lib/dates";
import { TARGET_ROLES } from "../lib/investigation";
import type { Boletim, BoEnvolvido } from "../lib/boletim";
import type { AppData } from "../hooks/useAppData";
import type { InvestigationsApi } from "../hooks/useInvestigations";

// Tipos de envolvimento que entram marcados como alvo (vítima, testemunha etc. ficam desmarcados).
const SUSPECT = /AUTOR|SUSPEITO|INFRATOR|CONDUZIDO|PRESO|CO-?AUTOR|PARTICIPE|AUTUADO|ADOLESCENTE/i;

type Person = {
  key: number;
  include: boolean;
  tipo: string;
  existing?: Author;
  form: {
    name: string; alias: string; motherName: string; fatherName: string; birthDate: string; document: string; address: string;
    neighborhood: string; city: string; crimes: string; categoryId: string; status: string; riskLevel: string; notes: string;
  };
  photo: File | null;
  preview: string;
  role: string;
};

function cpfMask(cpf: string) {
  const d = cpf.replace(/\D/g, "");
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : cpf;
}

function documentOf(e: BoEnvolvido) {
  return [e.rg && `RG ${e.rg}`, e.cpf && `CPF ${cpfMask(e.cpf)}`].filter(Boolean).join(" · ");
}

const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
const digits = (t: string) => (t || "").replace(/\D/g, "");

/** Procura o envolvido no banco de alvos pelo nome ou por RG/CPF. */
function findExisting(authors: Author[], e: BoEnvolvido) {
  const docs = [digits(e.rg), digits(e.cpf)].filter((d) => d.length >= 6);
  return authors.find((a) => norm(a.name) === norm(e.nome) || (docs.length > 0 && docs.some((d) => digits(a.document).includes(d))));
}

type Props = { open: boolean; data: AppData; api?: InvestigationsApi; onClose: () => void; onDone?: (authorIds: string[]) => void; investigationId?: string };

export function BoAuthorModal({ open, data, api, onClose, onDone, investigationId = "" }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [bo, setBo] = useState<Boletim | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState("");
  const [attachBo, setAttachBo] = useState(true);
  const [invId, setInvId] = useState(investigationId);
  const [coauthor, setCoauthor] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const canInvestigate = Boolean(api && data.permissions.investigations);
  const openInvestigations = (api?.investigations || []).filter((i) => i.status === "Em andamento" || i.status === "Suspensa" || i.id === investigationId);

  useEffect(() => {
    if (!open) return;
    setFile(null); setBo(null); setPeople([]); setSaving(""); setAttachBo(true); setInvId(investigationId); setCoauthor(true);
  }, [open, investigationId]);
  useEffect(() => () => people.forEach((p) => p.preview && URL.revokeObjectURL(p.preview)), [people]);

  async function read(pdf: File) {
    setFile(pdf);
    setReading(true);
    try {
      const [{ extractPdfItems }, lib] = await Promise.all([import("../lib/pdf"), import("../lib/boletim")]);
      const parsed = lib.parseBoletim(await extractPdfItems(pdf));
      if (!lib.isBoletim(parsed)) { window.alert("Não reconheci um BO do REDS neste PDF (ele precisa ter texto selecionável)."); setFile(null); return; }
      setBo(parsed);
      const natureza = lib.naturezaCurta(parsed.natureza);
      const folder = data.authorCategories.find((f) => norm(natureza).includes(norm(f.name)) || norm(f.name).includes(norm(natureza)));
      setPeople(parsed.envolvidos.filter((e) => e.nome).map((e) => {
        const existing = findExisting(data.authors, e);
        const address = [e.endereco, e.numeroEndereco].filter(Boolean).join(", ");
        return {
          key: e.numero, include: SUSPECT.test(e.tipo) && !/JURIDICA|LTDA|ME$|EIRELI|S\/A/i.test(e.nome), tipo: e.tipo, existing,
          role: /AUTOR|INFRATOR|PRESO|CONDUZIDO/i.test(e.tipo) ? "Executor" : "Associado",
          photo: null, preview: "",
          form: {
            name: e.nome, alias: existing?.alias || "", motherName: e.mae, fatherName: e.pai, birthDate: e.nascimento, document: documentOf(e),
            address, neighborhood: e.bairro, city: e.municipio ? `${e.municipio}${e.uf ? `/${e.uf}` : ""}` : "",
            crimes: [natureza, parsed.tentadoConsumado && parsed.tentadoConsumado.toLowerCase()].filter(Boolean).join(" — "),
            categoryId: existing?.categoryId || folder?.id || "", status: /AUTOR|PRESO|CONDUZIDO|INFRATOR/i.test(e.tipo) ? "Autor" : "Suspeito", riskLevel: existing?.riskLevel || "Médio",
            notes: `Envolvido como ${e.tipo.toLowerCase()} no REDS ${parsed.numero || ""}${parsed.dataFato ? ` (${formatBR(parsed.dataFato)})` : ""} — ${parsed.natureza}${parsed.local.logradouro ? `, ${parsed.local.logradouro}${parsed.local.numero ? `, ${parsed.local.numero}` : ""}${parsed.local.bairro ? ` — ${parsed.local.bairro}` : ""}` : ""}.`,
          },
        };
      }));
    } catch (error) {
      console.error(error);
      window.alert("Não foi possível ler este PDF.");
      setFile(null);
    } finally { setReading(false); }
  }

  const update = (key: number, patch: Partial<Person>) => setPeople((list) => list.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  const setField = (key: number, field: string, value: string) => setPeople((list) => list.map((p) => (p.key === key ? { ...p, form: { ...p.form, [field]: value } } : p)));
  const choosePhoto = (key: number, photo: File | null) => {
    setPeople((list) => list.map((p) => {
      if (p.key !== key) return p;
      if (p.preview) URL.revokeObjectURL(p.preview);
      return { ...p, photo, preview: photo ? URL.createObjectURL(photo) : "" };
    }));
  };

  const selected = people.filter((p) => p.include);

  async function save() {
    if (!bo || !file || !selected.length) return;
    const authorIds: string[] = [];
    const ref = bo.numero ? `REDS ${bo.numero}` : file.name;
    for (const p of selected) {
      setSaving(`Salvando ${p.form.name}…`);
      let author: { id: string; name: string } | null = null;
      if (p.existing) {
        // Completa só o que estava vazio no card e acrescenta a observação do BO.
        const e = p.existing;
        const merged: any = { ...e };
        (Object.keys(p.form) as (keyof Person["form"])[]).forEach((k) => { if (!merged[k] && p.form[k]) merged[k] = p.form[k]; });
        merged.notes = e.notes?.includes(bo.numero) ? e.notes : [e.notes, p.form.notes].filter(Boolean).join("\n\n");
        merged.crimes = e.crimes && !norm(e.crimes).includes(norm(p.form.crimes.split(" — ")[0])) ? `${e.crimes}; ${p.form.crimes}` : e.crimes || p.form.crimes;
        if (p.form.alias && p.form.alias !== e.alias) merged.alias = p.form.alias;
        if (await data.updateAuthor(e.id, merged, { silent: true })) author = { id: e.id, name: e.name };
      } else {
        author = await data.addAuthor(p.form, { silent: true });
      }
      if (!author) continue;
      authorIds.push(author.id);
      if (p.photo) await data.uploadAuthorFile(author, p.photo, "photo", { silent: true, description: `Foto cadastrada pelo ${ref}` });
      if (attachBo) await data.uploadAuthorFile(author, file, "report", { silent: true, description: `${ref} — ${p.tipo.toLowerCase()}` });
    }

    // Vínculo com a investigação: alvos + BO como fonte + coautoria.
    const inv = api?.investigations.find((i) => i.id === invId);
    if (api && inv && authorIds.length) {
      setSaving("Vinculando à investigação…");
      const targetIds: string[] = [];
      for (const [index, id] of authorIds.entries()) {
        const p = selected[index];
        const target = api.targets.find((t) => t.investigationId === inv.id && t.authorId === id) || await api.addTarget(inv, id, p?.role || "Executor");
        if (target) targetIds.push(target.id);
      }
      const already = api.items.some((i) => i.investigationId === inv.id && bo.numero && i.reference === bo.numero);
      if (!already) {
        const [lib] = await Promise.all([import("../lib/boletim")]);
        await api.saveItem(inv, {
          kind: "Boletim de ocorrência", title: `${lib.naturezaCurta(bo.natureza)}${bo.local.logradouro ? ` — ${bo.local.logradouro}${bo.local.bairro ? `, ${bo.local.bairro}` : ""}` : ""}`,
          itemDate: bo.dataFato || bo.dataRegistro, source: "PMMG / REDS", reference: bo.numero, sourceRating: "A", infoRating: "2",
          summary: [`Envolvidos: ${bo.envolvidos.map((e) => `${e.nome} (${e.tipo.toLowerCase()})`).join("; ")}.`, bo.historico].join("\n\n"),
          authorIds, includeInReport: true,
        }, file);
      }
      if (coauthor && targetIds.length > 1) {
        const invLinks = api.links.filter((l) => l.investigationId === inv.id);
        for (let i = 0; i < targetIds.length; i += 1) {
          for (let j = i + 1; j < targetIds.length; j += 1) {
            const exists = invLinks.some((l) => (l.fromTarget === targetIds[i] && l.toTarget === targetIds[j]) || (l.fromTarget === targetIds[j] && l.toTarget === targetIds[i]));
            if (!exists) await api.addLink(inv, targetIds[i], targetIds[j], "Comparsa", `Coautores no ${ref}`);
          }
        }
      }
    }
    setSaving("");
    data.reload();
    onDone?.(authorIds);
    onClose();
  }

  const activeFolders = data.authorCategories;
  return (
    <Modal open={open} onClose={() => !saving && onClose()} size="xl" eyebrow="Banco de alvos" title="Cadastrar alvos pelo BO"
      footer={<>
        <span className="mr-auto self-center text-xs text-pm-muted">{selected.length ? `${selected.length} envolvido(s) selecionado(s)` : "Marque quem deve virar alvo."}</span>
        <Button onClick={onClose} disabled={Boolean(saving)}>Cancelar</Button>
        <Button variant="primary" onClick={save} disabled={!selected.length || Boolean(saving) || reading}>{saving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}{saving || "Salvar alvos"}</Button>
      </>}>
      {!bo ? (
        <div onClick={() => inputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) read(f); }}
          className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-sm border-2 border-dashed border-pm-line bg-white px-6 py-14 text-center hover:border-pm-gold">
          {reading ? <Loader2 className="h-10 w-10 animate-spin text-pm-gold-dark" /> : <ScanText className="h-10 w-10 text-pm-gold-dark" />}
          <p className="font-black uppercase tracking-wide">{reading ? "Lendo o BO…" : "Arraste o PDF do BO aqui ou clique para escolher"}</p>
          <p className="max-w-lg text-sm text-pm-muted">O sistema lê a qualificação de cada envolvido (nome, nascimento, mãe, pai, RG, CPF, endereço), sugere quem vira alvo, e você acrescenta a foto antes de salvar.</p>
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) read(f); e.target.value = ""; }} />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-sm bg-pm-black px-4 py-3 text-white">
            <FileText className="h-5 w-5 text-pm-gold-light" />
            <span className="font-black">{bo.numero ? `REDS ${bo.numero}` : file?.name}</span>
            {bo.natureza && <span className="pm-chip bg-pm-gold text-pm-black">{bo.natureza}</span>}
            {bo.dataFato && <span className="text-sm text-white/70">Fato em {formatBR(bo.dataFato)} {bo.horaFato}</span>}
            {bo.local.logradouro && <span className="inline-flex items-center gap-1 text-sm text-white/70"><MapPin className="h-3.5 w-3.5" />{bo.local.logradouro}{bo.local.numero ? `, ${bo.local.numero}` : ""} · {bo.local.bairro}</span>}
          </div>

          {people.length === 0 && <p className="text-sm text-pm-muted">Nenhum envolvido identificado neste BO.</p>}
          {people.map((p) => (
            <div key={p.key} className={`rounded-sm border bg-white ${p.include ? "border-pm-gold" : "border-pm-line opacity-75"}`}>
              <label className="flex cursor-pointer items-center gap-3 border-b border-pm-line px-4 py-2.5">
                <input type="checkbox" className="h-5 w-5 accent-[#7A6C45]" checked={p.include} onChange={(e) => update(p.key, { include: e.target.checked })} />
                <span className="font-black uppercase">{p.form.name}</span>
                <Badge tone={SUSPECT.test(p.tipo) ? "late" : "default"}>{p.tipo}</Badge>
                {p.existing ? <Badge tone="gold">Já está no banco — completa o card</Badge> : <Badge tone="todo">Card novo</Badge>}
              </label>
              {p.include && (
                <div className="grid gap-4 p-4 md:grid-cols-[150px_1fr]">
                  <label className="group relative flex aspect-[3/4] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-sm border border-dashed border-pm-line bg-pm-cream text-center text-xs text-pm-muted hover:border-pm-gold">
                    {p.preview ? <img src={p.preview} alt="" className="absolute inset-0 h-full w-full object-cover" />
                      : p.existing && data.authorPhotos.some((ph) => ph.authorId === p.existing!.id)
                        ? <img src={data.getIntelFileUrl(data.authorPhotos.find((ph) => ph.authorId === p.existing!.id)!.filePath)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
                        : <UserRound className="mb-1 h-10 w-10" />}
                    <span className="relative z-10 mt-auto w-full bg-pm-black/80 py-1.5 font-bold uppercase text-white"><Camera className="mr-1 inline h-3.5 w-3.5" />{p.preview ? "Trocar foto" : "Adicionar foto"}</span>
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { choosePhoto(p.key, e.target.files?.[0] || null); e.target.value = ""; }} />
                  </label>
                  <div className="grid gap-2.5 md:grid-cols-3">
                    <Field label="Nome completo" className="md:col-span-2"><Input value={p.form.name} onChange={(e) => setField(p.key, "name", e.target.value)} /></Field>
                    <Field label="Vulgo"><Input value={p.form.alias} onChange={(e) => setField(p.key, "alias", e.target.value)} /></Field>
                    <Field label="Nascimento"><Input type="date" value={p.form.birthDate} onChange={(e) => setField(p.key, "birthDate", e.target.value)} /></Field>
                    <Field label="Mãe"><Input value={p.form.motherName} onChange={(e) => setField(p.key, "motherName", e.target.value)} /></Field>
                    <Field label="Pai"><Input value={p.form.fatherName} onChange={(e) => setField(p.key, "fatherName", e.target.value)} /></Field>
                    <Field label="Documentos"><Input value={p.form.document} onChange={(e) => setField(p.key, "document", e.target.value)} /></Field>
                    <Field label="Endereço"><Input value={p.form.address} onChange={(e) => setField(p.key, "address", e.target.value)} /></Field>
                    <Field label="Bairro / cidade"><Input value={[p.form.neighborhood, p.form.city].filter(Boolean).join(" — ")} onChange={(e) => { const [b, c] = e.target.value.split(" — "); setField(p.key, "neighborhood", b || ""); setField(p.key, "city", c || ""); }} /></Field>
                    <Field label="Pasta"><Select value={p.form.categoryId} onChange={(e) => setField(p.key, "categoryId", e.target.value)}><option value="">Sem pasta</option>{activeFolders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</Select></Field>
                    <Field label="Situação"><Select value={p.form.status} onChange={(e) => setField(p.key, "status", e.target.value)}>{["Suspeito", "Autor", "Monitorado", "Foragido", "Preso"].map((s) => <option key={s}>{s}</option>)}</Select></Field>
                    <Field label="Risco"><Select value={p.form.riskLevel} onChange={(e) => setField(p.key, "riskLevel", e.target.value)}>{["Baixo", "Médio", "Alto"].map((s) => <option key={s}>{s}</option>)}</Select></Field>
                    <Field label="Observação" className="md:col-span-3"><Textarea rows={2} value={p.form.notes} onChange={(e) => setField(p.key, "notes", e.target.value)} /></Field>
                    {invId && <Field label="Papel na investigação"><Select value={p.role} onChange={(e) => update(p.key, { role: e.target.value })}>{TARGET_ROLES.map((r) => <option key={r}>{r}</option>)}</Select></Field>}
                  </div>
                </div>
              )}
            </div>
          ))}

          <div className="grid gap-3 rounded-sm border border-pm-line bg-white p-4 md:grid-cols-2">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#7A6C45]" checked={attachBo} onChange={(e) => setAttachBo(e.target.checked)} />
              <span><b>Anexar o PDF do BO ao card de cada alvo</b><span className="block text-xs text-pm-muted">Fica na lista de relatórios do alvo, em espaço privado.</span></span>
            </label>
            {canInvestigate && (
              <div>
                <Field label="Vincular a uma investigação (opcional)">
                  <Select value={invId} onChange={(e) => setInvId(e.target.value)}>
                    <option value="">Não vincular agora</option>
                    {openInvestigations.map((i) => <option key={i.id} value={i.id}>{i.code} — {i.title}</option>)}
                  </Select>
                </Field>
                {invId && (
                  <div className="mt-2 space-y-1 text-xs text-pm-muted">
                    <p className="flex items-center gap-1.5"><FolderLock className="h-3.5 w-3.5 text-pm-gold-dark" />Os alvos entram no dossiê e o BO vira fonte (com o PDF).</p>
                    {selected.length > 1 && (
                      <label className="flex items-center gap-1.5 text-pm-ink"><input type="checkbox" className="h-3.5 w-3.5 accent-[#7A6C45]" checked={coauthor} onChange={(e) => setCoauthor(e.target.checked)} /><Link2 className="h-3.5 w-3.5 text-pm-gold-dark" />Registrar coautoria entre os alvos deste BO</label>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
