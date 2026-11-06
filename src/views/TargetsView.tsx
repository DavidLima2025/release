import { useEffect, useState } from "react";
import { Camera, Edit3, FileText, FolderOpen, Image as ImageIcon, Paperclip, Plus, Search, Trash2, Upload, UserPlus, UserRound } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, EmptyState, SectionHeader } from "../components/ui/card";
import { Field, Input, Select, Textarea } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Modal } from "../components/ui/modal";
import { Author, formatBytes, matchesText } from "../lib/domain";
import { formatBR } from "../lib/dates";
import type { AppData } from "../hooks/useAppData";

const EMPTY_AUTHOR = { name: "", alias: "", motherName: "", birthDate: "", document: "", address: "", neighborhood: "", city: "Belo Horizonte", crimes: "", categoryId: "", status: "Suspeito", riskLevel: "Médio", notes: "" };
const riskTone = (risk: string) => (risk === "Alto" ? "late" : risk === "Médio" ? "risk" : "done") as any;

export function TargetsView({ data }: { data: AppData }) {
  const { authorCategories: folders, authors, authorPhotos: photos, authorReports: reports } = data;
  const [folderId, setFolderId] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Author | null>(null);
  const [form, setForm] = useState(EMPTY_AUTHOR);
  const [photo, setPhoto] = useState<File | null>(null);
  const [newFolder, setNewFolder] = useState({ name: "", description: "" });
  const [importing, setImporting] = useState(false);

  useEffect(() => { if (folderId !== "all" && !folders.some((f) => f.id === folderId)) setFolderId("all"); }, [folders, folderId]);

  const inFolder = authors.filter((a) => folderId === "all" || a.categoryId === folderId);
  const visible = inFolder.filter((a) => matchesText([a.name, a.alias, a.motherName, a.document, a.address, a.neighborhood, a.city, a.crimes, a.notes], query));
  const selected = visible.find((a) => a.id === selectedId) || null;
  const folderName = (id: string) => folders.find((f) => f.id === id)?.name || "Sem pasta";

  const openCreate = () => { setEditing(null); setForm({ ...EMPTY_AUTHOR, categoryId: folderId !== "all" ? folderId : folders[0]?.id || "" }); setPhoto(null); setFormOpen(true); };
  const openEdit = (a: Author) => { setEditing(a); setForm({ ...EMPTY_AUTHOR, ...a }); setPhoto(null); setFormOpen(true); };
  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    if (editing) {
      if (!(await data.updateAuthor(editing.id, form))) return;
      if (photo) await data.uploadAuthorFile(editing, photo, "photo");
    } else {
      const created = await data.addAuthor(form);
      if (!created) return;
      if (photo) await data.uploadAuthorFile(created, photo, "photo");
      setSelectedId(created.id);
    }
    setFormOpen(false);
  };

  const createFolder = async () => {
    const created = await data.addAuthorCategory(newFolder);
    if (created) { setFolderId(created.id); setNewFolder({ name: "", description: "" }); }
  };

  const importTrello = async (file?: File) => {
    if (!file) return;
    setImporting(true);
    try {
      const id = await data.importTrelloBoard(JSON.parse(await file.text()));
      if (id) setFolderId(id);
    } catch { window.alert("Não foi possível ler o JSON do Trello. Confira se é a exportação do quadro."); }
    finally { setImporting(false); }
  };

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <Card>
          <CardContent className="!p-4">
            <p className="pm-eyebrow mb-3">Pastas</p>
            <div className="space-y-1">
              {[{ id: "all", name: "Todas as pastas", description: "" }, ...folders].map((folder) => {
                const total = folder.id === "all" ? authors.length : authors.filter((a) => a.categoryId === folder.id).length;
                const active = folderId === folder.id;
                return (
                  <div key={folder.id} className={`group flex items-center gap-2 rounded-sm px-3 py-2 ${active ? "bg-pm-black text-white" : "hover:bg-pm-sand"}`}>
                    <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-bold" onClick={() => { setFolderId(folder.id); setSelectedId(null); }}>
                      <FolderOpen className={`h-4 w-4 shrink-0 ${active ? "text-pm-gold-light" : "text-pm-gold-dark"}`} /><span className="truncate">{folder.name}</span>
                    </button>
                    <span className={`text-xs font-bold ${active ? "text-pm-gold-light" : "text-pm-muted"}`}>{total}</span>
                    {folder.id !== "all" && total === 0 && <button type="button" title="Excluir pasta vazia" onClick={() => data.deleteAuthorCategory(folder.id)} className="opacity-0 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5 text-status-late" /></button>}
                  </div>
                );
              })}
            </div>
            <form className="mt-4 space-y-2 border-t border-pm-line pt-4" onSubmit={(e) => { e.preventDefault(); createFolder(); }}>
              <Input placeholder="Nova pasta (ex.: Tráfico de drogas)" value={newFolder.name} onChange={(e) => setNewFolder({ ...newFolder, name: e.target.value })} />
              <Input placeholder="Observação" value={newFolder.description} onChange={(e) => setNewFolder({ ...newFolder, description: e.target.value })} />
              <Button type="submit" variant="primary" size="sm" className="w-full"><Plus />Criar pasta</Button>
            </form>
            <label className={`mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-sm border border-dashed border-pm-gold px-3 py-2 text-xs font-bold uppercase tracking-wide text-pm-gold-dark hover:bg-pm-cream ${importing ? "pointer-events-none opacity-60" : ""}`}>
              <Upload className="h-4 w-4" />{importing ? "Importando…" : "Importar JSON do Trello"}
              <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => { importTrello(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
          </CardContent>
        </Card>
      </aside>

      <div className="space-y-6">
        <Card>
          <CardContent>
            <SectionHeader title={folderId === "all" ? "Todos os alvos" : folderName(folderId)} subtitle={`${visible.length} card(s)`}
              actions={<>
                <div className="relative w-72 max-w-full"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-pm-muted" /><Input className="pl-9" placeholder="Nome, vulgo, documento, bairro…" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
                <Button variant="primary" onClick={openCreate} disabled={!folders.length} title={!folders.length ? "Crie uma pasta primeiro" : ""}><UserPlus />Novo alvo</Button>
              </>} />
            {!folders.length && <EmptyState icon={FolderOpen} title="Crie a primeira pasta">As pastas organizam os alvos por modalidade criminal.</EmptyState>}
            {folders.length > 0 && visible.length === 0 && <EmptyState icon={UserRound} title="Nenhum card nesta pasta" />}
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {visible.map((author) => {
                const cover = photos.find((p) => p.authorId === author.id);
                const active = selected?.id === author.id;
                return (
                  <button key={author.id} type="button" onClick={() => setSelectedId(active ? null : author.id)}
                    className={`flex gap-3 rounded-sm border bg-white p-2.5 text-left transition hover:border-pm-gold ${active ? "border-pm-black ring-2 ring-pm-gold" : "border-pm-line"}`}>
                    <div className="grid h-24 w-20 shrink-0 place-items-center overflow-hidden rounded-sm bg-pm-sand">
                      {cover ? <img src={data.getIntelFileUrl(cover.filePath)} alt="" loading="lazy" className="h-full w-full object-cover" /> : <UserRound className="h-8 w-8 text-pm-muted" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap gap-1"><Badge>{author.status}</Badge><Badge tone={riskTone(author.riskLevel)}>{author.riskLevel}</Badge></div>
                      <p className="mt-1 truncate font-black uppercase">{author.name}</p>
                      <p className="truncate text-sm text-pm-muted">Vulgo: {author.alias || "—"}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-pm-muted">{author.crimes || folderName(author.categoryId)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {selected && (
          <Card className="overflow-hidden">
            <div className="grid md:grid-cols-[240px_1fr]">
              <div className="relative min-h-64 bg-pm-black">
                {photos.find((p) => p.authorId === selected.id)
                  ? <img src={data.getIntelFileUrl(photos.find((p) => p.authorId === selected.id)!.filePath)} alt={selected.name} className="h-full w-full object-cover" />
                  : <div className="grid h-full place-items-center"><UserRound className="h-16 w-16 text-white/30" /></div>}
              </div>
              <div className="p-5 md:p-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="pm-eyebrow">{folderName(selected.categoryId)}</p>
                    <h2 className="font-display text-3xl font-black uppercase leading-tight">{selected.name}</h2>
                    <p className="text-sm text-pm-muted">Vulgo: <b className="text-pm-ink">{selected.alias || "não informado"}</b></p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => openEdit(selected)}><Edit3 />Editar</Button>
                    <Button size="sm" variant="danger" onClick={() => data.deleteAuthor(selected)}><Trash2 />Excluir</Button>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
                  {[
                    ["Situação", selected.status], ["Risco", selected.riskLevel], ["Nascimento", selected.birthDate ? formatBR(selected.birthDate) : "—"],
                    ["Mãe", selected.motherName], ["Documento", selected.document], ["Cidade / bairro", [selected.city, selected.neighborhood].filter(Boolean).join(" / ")],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-sm border border-pm-line bg-pm-cream/60 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wider text-pm-muted">{label}</p><p className="font-semibold">{value || "—"}</p></div>
                  ))}
                  <div className="rounded-sm border border-pm-line bg-pm-cream/60 px-3 py-2 sm:col-span-3"><p className="text-[10px] font-bold uppercase tracking-wider text-pm-muted">Endereço</p><p className="font-semibold">{selected.address || "—"}</p></div>
                  <div className="rounded-sm border border-pm-line bg-pm-cream/60 px-3 py-2 sm:col-span-3"><p className="text-[10px] font-bold uppercase tracking-wider text-pm-muted">Crimes / modus operandi</p><p className="font-semibold">{selected.crimes || "—"}</p></div>
                </div>
                {selected.notes && <p className="mt-3 whitespace-pre-wrap rounded-sm border border-pm-line bg-white p-3 text-sm">{selected.notes}</p>}
              </div>
            </div>
            <div className="grid gap-6 border-t border-pm-line p-5 md:p-6 lg:grid-cols-2">
              <div>
                <div className="mb-3 flex items-center justify-between"><p className="pm-heading flex items-center gap-2"><ImageIcon className="h-4 w-4 text-pm-gold-dark" />Fotos</p>
                  <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-sm bg-pm-black px-3 text-xs font-bold uppercase text-white hover:bg-pm-ink"><Camera className="h-3.5 w-3.5" />Subir foto<input type="file" accept="image/*" className="hidden" onChange={(e) => { data.uploadAuthorFile(selected, e.target.files?.[0], "photo"); e.target.value = ""; }} /></label>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {photos.filter((p) => p.authorId === selected.id).map((p) => (
                    <a key={p.id} href={data.getIntelFileUrl(p.filePath)} target="_blank" rel="noreferrer" className="aspect-[3/4] overflow-hidden rounded-sm bg-pm-sand"><img src={data.getIntelFileUrl(p.filePath)} alt={p.fileName} loading="lazy" className="h-full w-full object-cover transition hover:scale-105" /></a>
                  ))}
                  {!photos.some((p) => p.authorId === selected.id) && <p className="col-span-full text-sm text-pm-muted">Nenhuma foto.</p>}
                </div>
              </div>
              <div>
                <div className="mb-3 flex items-center justify-between"><p className="pm-heading flex items-center gap-2"><Paperclip className="h-4 w-4 text-pm-gold-dark" />Relatórios</p>
                  <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-sm border border-pm-line bg-white px-3 text-xs font-bold uppercase hover:border-pm-gold"><Upload className="h-3.5 w-3.5" />Subir relatório<input type="file" className="hidden" onChange={(e) => { data.uploadAuthorFile(selected, e.target.files?.[0], "report"); e.target.value = ""; }} /></label>
                </div>
                <div className="space-y-1.5">
                  {reports.filter((r) => r.authorId === selected.id).map((r) => (
                    <a key={r.id} href={data.getIntelFileUrl(r.filePath)} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 rounded-sm border border-pm-line bg-white px-3 py-2 text-sm hover:border-pm-gold">
                      <span className="flex min-w-0 items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-pm-gold-dark" /><span className="truncate">{r.fileName}</span></span><span className="shrink-0 text-xs text-pm-muted">{formatBytes(r.fileSize)}</span>
                    </a>
                  ))}
                  {!reports.some((r) => r.authorId === selected.id) && <p className="text-sm text-pm-muted">Nenhum relatório.</p>}
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} eyebrow="Banco de alvos" title={editing ? `Editar ${editing.name}` : "Novo card de alvo"}
        footer={<><Button onClick={() => setFormOpen(false)}>Cancelar</Button><Button variant="primary" onClick={submit}><Plus />{editing ? "Salvar" : "Criar card"}</Button></>}>
        <form className="grid gap-3 md:grid-cols-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <Field label="Pasta" className="md:col-span-3"><Select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}><option value="">Sem pasta</option>{folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</Select></Field>
          <Field label="Nome completo" className="md:col-span-2"><Input value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus /></Field>
          <Field label="Vulgo"><Input value={form.alias} onChange={(e) => set("alias", e.target.value)} /></Field>
          <Field label="Nome da mãe"><Input value={form.motherName} onChange={(e) => set("motherName", e.target.value)} /></Field>
          <Field label="Nascimento"><Input type="date" value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} /></Field>
          <Field label="RG / CPF"><Input value={form.document} onChange={(e) => set("document", e.target.value)} /></Field>
          <Field label="Endereço" className="md:col-span-3"><Input value={form.address} onChange={(e) => set("address", e.target.value)} /></Field>
          <Field label="Bairro"><Input value={form.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} /></Field>
          <Field label="Cidade"><Input value={form.city} onChange={(e) => set("city", e.target.value)} /></Field>
          <Field label="Situação"><Select value={form.status} onChange={(e) => set("status", e.target.value)}>{["Suspeito", "Autor", "Monitorado", "Foragido", "Preso"].map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field label="Crimes / modus operandi" className="md:col-span-2"><Input value={form.crimes} onChange={(e) => set("crimes", e.target.value)} /></Field>
          <Field label="Risco"><Select value={form.riskLevel} onChange={(e) => set("riskLevel", e.target.value)}>{["Baixo", "Médio", "Alto"].map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field label="Observações / vínculos" className="md:col-span-2"><Textarea rows={4} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
          <Field label="Foto">
            <label className="flex h-[118px] cursor-pointer flex-col items-center justify-center gap-1 rounded-sm border border-dashed border-pm-line bg-white text-center text-xs text-pm-muted hover:border-pm-gold">
              <Camera className="h-5 w-5 text-pm-gold-dark" /><span className="px-2 font-semibold text-pm-ink">{photo ? photo.name : "Escolher foto"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
            </label>
          </Field>
          <button type="submit" className="hidden" />
        </form>
      </Modal>
    </div>
  );
}
