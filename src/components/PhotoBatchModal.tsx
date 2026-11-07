import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileArchive, FolderOpen, Images, Loader2, Upload, UserPlus } from "lucide-react";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";
import { Input, Select } from "./ui/input";
import { Badge } from "./ui/badge";
import type { AppData } from "../hooks/useAppData";
import { matchFile, normName, type Candidate, type ParsedFileName } from "../lib/photoMatch";

const IMAGE = /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i;
const UNSUPPORTED = /\.(heic|heif)$/i;

type Row = {
  key: string;
  file: File;
  preview: string;
  parsed: ParsedFileName;
  status: "found" | "ambiguous" | "none" | "unsupported" | "duplicate";
  candidates: Candidate[];
  /** id do alvo, "" = ignorar, "new" = cadastrar alvo novo */
  target: string;
  newName: string;
  newAlias: string;
  result?: "ok" | "error" | "skipped";
};

type Filter = "all" | "check" | "found" | "none";
type ExistingMode = "add" | "replace" | "skip";

/** Lê arquivos soltos, pastas arrastadas e .zip (ex.: pasta baixada do Google Drive). */
async function collectFiles(input: File[], onZip: (name: string) => void): Promise<File[]> {
  const out: File[] = [];
  for (const file of input) {
    if (/\.zip$/i.test(file.name) || file.type === "application/zip" || file.type === "application/x-zip-compressed") {
      onZip(file.name);
      const { unzip } = await import("../lib/zip");
      out.push(...(await unzip(file, (name) => IMAGE.test(name))));
    } else if (IMAGE.test(file.name) || file.type.startsWith("image/")) out.push(file);
  }
  return out;
}

/** Arrastar uma pasta inteira: percorre as subpastas. */
async function filesFromDrop(items: DataTransferItemList): Promise<File[]> {
  const entries = Array.from(items).map((i) => (i as any).webkitGetAsEntry?.()).filter(Boolean);
  if (!entries.length) return [];
  const out: File[] = [];
  const walk = async (entry: any): Promise<void> => {
    if (entry.isFile) out.push(await new Promise<File>((res, rej) => entry.file(res, rej)));
    else if (entry.isDirectory) {
      const reader = entry.createReader();
      let batch: any[] = [];
      do {
        batch = await new Promise<any[]>((res, rej) => reader.readEntries(res, rej));
        for (const child of batch) await walk(child);
      } while (batch.length);
    }
  };
  for (const entry of entries) await walk(entry);
  return out;
}

/** Fotos grandes são reduzidas (lado maior 1600 px, JPEG) para economizar espaço e acelerar os relatórios. */
async function shrink(file: File): Promise<File> {
  if (file.size < 1.5 * 1024 * 1024 || !/^image\/(jpeg|png|webp|bmp)$/.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.88));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[a-z0-9]+$/i, ".jpg"), { type: "image/jpeg" });
  } catch {
    return file;
  }
}

type Props = { open: boolean; data: AppData; onClose: () => void; onDone?: (authorIds: string[]) => void };

export function PhotoBatchModal({ open, data, onClose, onDone }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState("");
  const [saving, setSaving] = useState("");
  const [finished, setFinished] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [existingMode, setExistingMode] = useState<ExistingMode>("add");
  const [folderId, setFolderId] = useState("");
  const [dragging, setDragging] = useState(false);
  const filesRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);

  const authorsSorted = useMemo(() => [...data.authors].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")), [data.authors]);
  const photosOf = (authorId: string) => data.authorPhotos.filter((p) => p.authorId === authorId);

  useEffect(() => {
    if (!open) return;
    setRows([]); setLoading(""); setSaving(""); setFinished(false); setFilter("all"); setExistingMode("add");
    setFolderId(data.authorCategories[0]?.id || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  // Libera as miniaturas só ao fechar (revogar a cada mudança apagaria as imagens ainda na tela).
  const rowsRef = useRef<Row[]>([]);
  rowsRef.current = rows;
  useEffect(() => { if (!open) { rowsRef.current.forEach((r) => URL.revokeObjectURL(r.preview)); } }, [open]);
  useEffect(() => () => rowsRef.current.forEach((r) => URL.revokeObjectURL(r.preview)), []);

  async function addFiles(input: File[]) {
    if (!input.length) return;
    setLoading("Lendo arquivos…");
    try {
      const files = await collectFiles(input, (name) => setLoading(`Abrindo ${name}…`));
      if (!files.length) { window.alert("Nenhuma imagem encontrada (JPG, PNG, WEBP)."); return; }
      const known = new Set(rows.map((r) => `${r.file.name}|${r.file.size}`));
      const fresh: Row[] = [];
      files.forEach((file, i) => {
        if (known.has(`${file.name}|${file.size}`)) return;
        known.add(`${file.name}|${file.size}`);
        const m = matchFile(file.name, data.authors);
        const base: Row = {
          key: `${Date.now()}-${i}-${file.name}`, file, preview: URL.createObjectURL(file), parsed: m.parsed, status: m.status, candidates: m.candidates,
          target: m.status === "found" ? m.best!.id : "", newName: m.parsed.display, newAlias: m.parsed.displayAlias,
        };
        if (UNSUPPORTED.test(file.name)) { base.status = "unsupported"; base.target = ""; }
        else if (m.best && photosOf(m.best.id).some((p) => normName(p.fileName.replace(/\.[a-z0-9]+$/i, "")) === normName(file.name.replace(/\.[a-z0-9]+$/i, "")))) {
          base.status = "duplicate"; base.target = "";
        }
        fresh.push(base);
      });
      setRows((list) => [...list, ...fresh].sort((a, b) => a.file.name.localeCompare(b.file.name, "pt-BR")));
    } catch (error) {
      console.error(error);
      window.alert(error instanceof Error ? error.message : "Não foi possível ler os arquivos.");
    } finally { setLoading(""); }
  }

  const update = (key: string, patch: Partial<Row>) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const counts = {
    found: rows.filter((r) => r.status === "found").length,
    check: rows.filter((r) => r.status === "ambiguous").length,
    none: rows.filter((r) => r.status === "none" || r.status === "unsupported" || r.status === "duplicate").length,
  };
  const shown = rows.filter((r) => filter === "all"
    || (filter === "found" && r.status === "found")
    || (filter === "check" && r.status === "ambiguous")
    || (filter === "none" && (r.status === "none" || r.status === "unsupported" || r.status === "duplicate")));
  const toSend = rows.filter((r) => !r.result && (r.target === "new" ? r.newName.trim() : r.target));
  const willSkipExisting = existingMode === "skip" ? toSend.filter((r) => r.target !== "new" && photosOf(r.target).length).length : 0;

  async function send() {
    if (!toSend.length) return;
    const done: string[] = [];
    const replaced = new Set<string>();
    const created = new Map<string, { id: string; name: string }>();
    let ok = 0;
    let fail = 0;
    let skipped = 0;
    for (const [index, row] of toSend.entries()) {
      setSaving(`Enviando ${index + 1} de ${toSend.length}…`);
      let author: { id: string; name: string } | null = null;
      if (row.target === "new") {
        const key = normName(row.newName);
        author = created.get(key) || null;
        if (!author) {
          const made = await data.addAuthor({
            name: row.newName.trim(), alias: row.newAlias.trim(), motherName: "", fatherName: "", birthDate: "", document: "", address: "", neighborhood: "",
            city: "", crimes: "", categoryId: folderId, status: "Suspeito", riskLevel: "Médio", notes: `Card criado pela importação de fotos (${row.file.name}).`,
          }, { silent: true });
          if (made) { author = made; created.set(key, made); }
        }
      } else {
        const a = data.authors.find((x) => x.id === row.target);
        if (a) author = { id: a.id, name: a.name };
      }
      if (!author) { fail += 1; update(row.key, { result: "error" }); continue; }

      const oldPhotos = row.target === "new" ? [] : photosOf(author.id);
      if (oldPhotos.length && existingMode === "skip") { skipped += 1; update(row.key, { result: "skipped" }); continue; }

      const file = await shrink(row.file);
      const saved = await data.uploadAuthorFile(author, file, "photo", { silent: true, noAudit: true, description: `Importada em lote (${row.file.name})` });
      if (!saved) { fail += 1; update(row.key, { result: "error" }); continue; }
      if (existingMode === "replace" && oldPhotos.length && !replaced.has(author.id)) {
        replaced.add(author.id);
        for (const old of oldPhotos) await data.deleteAuthorPhoto(old, { silent: true });
      }
      ok += 1;
      done.push(author.id);
      update(row.key, { result: "ok" });
    }
    await data.addAudit("Fotos importadas em lote", `${ok} foto(s) enviada(s) para ${new Set(done).size} alvo(s)${created.size ? `, ${created.size} card(s) novo(s)` : ""}${replaced.size ? `, foto substituída em ${replaced.size} card(s)` : ""}${fail ? `, ${fail} falha(s)` : ""}.`);
    setSaving("");
    setFinished(true);
    data.reload();
    onDone?.([...new Set(done)]);
    window.setTimeout(() => window.alert(`${ok} foto(s) enviada(s).${created.size ? ` ${created.size} alvo(s) novo(s) cadastrado(s).` : ""}${skipped ? ` ${skipped} pulada(s) porque o alvo já tinha foto.` : ""}${fail ? ` ${fail} com erro.` : ""}`), 50);
  }

  const busy = Boolean(saving || loading);
  return (
    <Modal open={open} onClose={() => !saving && onClose()} size="xl" eyebrow="Banco de alvos" title="Importar fotos em lote"
      footer={rows.length ? <>
        <span className="mr-auto self-center text-xs text-pm-muted">
          {finished ? "Importação concluída." : `${toSend.length} foto(s) serão enviadas${willSkipExisting ? ` (${willSkipExisting} serão puladas: alvo já tem foto)` : ""}.`}
        </span>
        <Button onClick={onClose} disabled={Boolean(saving)}>{finished ? "Fechar" : "Cancelar"}</Button>
        {!finished && <Button variant="primary" onClick={send} disabled={!toSend.length || busy}>{saving ? <Loader2 className="animate-spin" /> : <Upload />}{saving || "Enviar fotos"}</Button>}
      </> : undefined}>
      <input ref={filesRef} type="file" multiple accept="image/*,.heic,.zip,application/zip" className="hidden" onChange={(e) => { addFiles(Array.from(e.target.files || [])); e.target.value = ""; }} />
      <input ref={folderRef} type="file" multiple className="hidden" {...({ webkitdirectory: "", directory: "" } as any)} onChange={(e) => { addFiles(Array.from(e.target.files || [])); e.target.value = ""; }} />
      <input ref={zipRef} type="file" accept=".zip,application/zip,application/x-zip-compressed" className="hidden" onChange={(e) => { addFiles(Array.from(e.target.files || [])); e.target.value = ""; }} />

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
        onDrop={async (e) => { e.preventDefault(); setDragging(false); const fromDirs = await filesFromDrop(e.dataTransfer.items); addFiles(fromDirs.length ? fromDirs : Array.from(e.dataTransfer.files)); }}
        className={`rounded-sm border-2 border-dashed px-5 text-center transition-colors ${dragging ? "border-pm-gold bg-pm-gold/10" : "border-pm-line bg-white"} ${rows.length ? "py-4" : "py-10"}`}>
        {loading ? <p className="flex items-center justify-center gap-2 font-bold"><Loader2 className="h-5 w-5 animate-spin text-pm-gold-dark" />{loading}</p> : <>
          {!rows.length && <Images className="mx-auto mb-3 h-10 w-10 text-pm-gold-dark" />}
          <p className="font-black uppercase tracking-wide">{rows.length ? "Adicionar mais fotos" : "Arraste a pasta, as fotos ou o .zip aqui"}</p>
          {!rows.length && <p className="mx-auto mt-1 max-w-2xl text-sm text-pm-muted">O nome de cada arquivo é comparado com o nome dos alvos (sem diferenciar acentos, maiúsculas, “_” ou “-”). Também reconhece vulgo (<i>Fulano vulgo Pezão.jpg</i>, <i>Fulano (Pezão).jpg</i>) e RG/CPF no nome. Você confere tudo antes de enviar.</p>}
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Button size="sm" onClick={() => folderRef.current?.click()} disabled={busy}><FolderOpen />Escolher pasta</Button>
            <Button size="sm" onClick={() => filesRef.current?.click()} disabled={busy}><Images />Escolher fotos</Button>
            <Button size="sm" onClick={() => zipRef.current?.click()} disabled={busy}><FileArchive />Abrir .zip do Google Drive</Button>
          </div>
          {!rows.length && <p className="mx-auto mt-3 max-w-2xl text-xs text-pm-muted">No Google Drive: clique com o botão direito na pasta → <b>Fazer download</b>. O Drive gera um .zip — escolha esse arquivo aqui, sem precisar descompactar.</p>}
        </>}
      </div>

      {rows.length > 0 && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {([["all", `Todas (${rows.length})`], ["found", `Encontradas (${counts.found})`], ["check", `Conferir (${counts.check})`], ["none", `Sem vínculo (${counts.none})`]] as [Filter, string][]).map(([key, label]) => (
              <button key={key} type="button" onClick={() => setFilter(key)}
                className={`rounded-sm px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${filter === key ? "bg-pm-black text-white" : "border border-pm-line bg-white text-pm-ink hover:border-pm-gold"}`}>{label}</button>
            ))}
          </div>

          <div className="grid gap-3 rounded-sm border border-pm-line bg-white p-3 text-sm md:grid-cols-2">
            <label className="block">
              <span className="pm-label">Se o alvo já tiver foto</span>
              <Select value={existingMode} onChange={(e) => setExistingMode(e.target.value as ExistingMode)} disabled={busy || finished}>
                <option value="add">Adicionar como mais uma foto (a atual continua principal)</option>
                <option value="replace">Substituir — apaga a(s) foto(s) antiga(s)</option>
                <option value="skip">Pular — não enviar para quem já tem foto</option>
              </Select>
            </label>
            <label className="block">
              <span className="pm-label">Pasta dos alvos novos (“Cadastrar alvo novo”)</span>
              <Select value={folderId} onChange={(e) => setFolderId(e.target.value)} disabled={busy || finished}>
                <option value="">Sem pasta</option>
                {data.authorCategories.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </Select>
            </label>
          </div>

          <div className="divide-y divide-pm-line overflow-hidden rounded-sm border border-pm-line bg-white">
            {shown.length === 0 && <p className="p-4 text-sm text-pm-muted">Nada neste filtro.</p>}
            {shown.map((row) => {
              const chosen = data.authors.find((a) => a.id === row.target);
              const hasPhoto = chosen ? photosOf(chosen.id).length : 0;
              const suggested = new Set(row.candidates.map((c) => c.author.id));
              return (
                <div key={row.key} className={`flex flex-wrap items-center gap-3 px-3 py-2.5 ${!row.target ? "bg-pm-cream/50" : ""}`}>
                  <img src={row.preview} alt="" className="h-[72px] w-14 shrink-0 rounded-sm border border-pm-line bg-pm-sand object-cover" />
                  <div className="min-w-[180px] flex-1">
                    <p className="break-all text-sm font-bold">{row.file.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {row.result === "ok" && <Badge tone="done"><CheckCircle2 className="mr-1 inline h-3 w-3" />Enviada</Badge>}
                      {row.result === "error" && <Badge tone="late">Erro no envio</Badge>}
                      {row.result === "skipped" && <Badge>Pulada</Badge>}
                      {!row.result && row.status === "found" && <Badge tone="done">{row.candidates[0]?.why}</Badge>}
                      {!row.result && row.status === "ambiguous" && <Badge tone="risk"><AlertTriangle className="mr-1 inline h-3 w-3" />Conferir</Badge>}
                      {!row.result && row.status === "none" && <Badge tone="late">Nenhum alvo com esse nome</Badge>}
                      {!row.result && row.status === "unsupported" && <Badge tone="late">HEIC (iPhone) — converta para JPG</Badge>}
                      {!row.result && row.status === "duplicate" && <Badge tone="dark">Já está no card</Badge>}
                      {!row.result && chosen && hasPhoto > 0 && <Badge tone="gold">Alvo já tem {hasPhoto} foto(s)</Badge>}
                    </div>
                  </div>
                  <div className="flex w-full flex-col gap-1.5 sm:w-[380px]">
                    <Select className="h-9 text-sm" value={row.target} disabled={busy || Boolean(row.result) || row.status === "unsupported"}
                      onChange={(e) => update(row.key, { target: e.target.value })}>
                      <option value="">— Ignorar esta foto —</option>
                      <option value="new">+ Cadastrar alvo novo com este nome</option>
                      {row.candidates.length > 0 && (
                        <optgroup label="Sugestões pelo nome do arquivo">
                          {row.candidates.slice(0, 6).map((c) => <option key={c.author.id} value={c.author.id}>{c.author.name}{c.author.alias ? ` ("${c.author.alias}")` : ""} — {c.why}</option>)}
                        </optgroup>
                      )}
                      <optgroup label="Todos os alvos">
                        {authorsSorted.filter((a) => !suggested.has(a.id)).map((a) => <option key={a.id} value={a.id}>{a.name}{a.alias ? ` ("${a.alias}")` : ""}</option>)}
                      </optgroup>
                    </Select>
                    {row.target === "new" && (
                      <div className="flex gap-1.5">
                        <Input className="h-9 flex-1 text-sm" placeholder="Nome completo" value={row.newName} onChange={(e) => update(row.key, { newName: e.target.value })} disabled={busy || Boolean(row.result)} />
                        <Input className="h-9 w-28 text-sm" placeholder="Vulgo" value={row.newAlias} onChange={(e) => update(row.key, { newAlias: e.target.value })} disabled={busy || Boolean(row.result)} />
                      </div>
                    )}
                    {row.target === "new" && <span className="flex items-center gap-1 text-[11px] text-pm-muted"><UserPlus className="h-3 w-3" />Cria o card só com nome e foto — complete depois (ou cadastre pelo BO).</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Modal>
  );
}
