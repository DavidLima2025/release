import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as React from "react";
import { Camera, Check, CheckSquare, Combine, Edit3, Eye, FolderInput, FolderOpen, Images, Inbox, Link2, MessageCircle, MoreVertical, Plus, ScanText, Search, Trash2, Upload, UserPlus, UserRound, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, EmptyState, SectionHeader } from "../components/ui/card";
import { Field, Input, Select, Textarea } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Modal } from "../components/ui/modal";
import { Author, AuthorCategory, matchesText } from "../lib/domain";
import type { AppData } from "../hooks/useAppData";
import type { InvestigationsApi } from "../hooks/useInvestigations";
import { BoAuthorModal } from "../components/BoAuthorModal";
import { PhotoBatchModal } from "../components/PhotoBatchModal";
import { IntakeInboxModal, IntakeLinksModal } from "../components/IntakeModals";
import { ShareTargetModal } from "../components/ShareTargetModal";
import { useIntake } from "../hooks/useIntake";
import { ContextMenu, FolderModal, MenuItem, MoveModal } from "../components/TargetParts";
import { TargetFichaModal } from "../components/TargetFichaModal";
import { indexReds } from "../lib/companions";
import { DuplicatesModal, MergeModal, MergePicker, findDuplicates } from "../components/MergeAuthors";

const EMPTY_AUTHOR = { name: "", alias: "", motherName: "", fatherName: "", birthDate: "", document: "", address: "", neighborhood: "", city: "Belo Horizonte", crimes: "", categoryId: "", status: "Suspeito", riskLevel: "Médio", notes: "" };
const riskTone = (risk: string) => (risk === "Alto" ? "late" : risk === "Médio" ? "risk" : "done") as any;

export function TargetsView({ data, api, onOpenInvestigation, notify, focusId, onFocusDone }: { data: AppData; api?: InvestigationsApi; onOpenInvestigation?: (id: string) => void; notify: (text: string, tone?: any) => void; focusId?: string; onFocusDone?: () => void }) {
  const intake = useIntake(data, notify, data.permissions.targets);
  const [linksOpen, setLinksOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [sharing, setSharing] = useState<Author | null>(null);
  const [boOpen, setBoOpen] = useState(false);
  const [photosOpen, setPhotosOpen] = useState(false);
  const { authorCategories: folders, authors, authorPhotos: photos } = data;
  const [folderId, setFolderId] = useState("all");
  const [query, setQuery] = useState("");
  const [ficha, setFicha] = useState<Author | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [moving, setMoving] = useState<string[]>([]);
  const [menu, setMenu] = useState<{ kind: "card"; author: Author; at: { x: number; y: number } } | { kind: "folder"; folder: AuthorCategory; at: { x: number; y: number } } | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  // Vindo de outra tela (ex.: rede de vínculos): abre a ficha do alvo.
  useEffect(() => {
    if (!focusId) return;
    const a = data.authors.find((x) => x.id === focusId);
    if (a) setFicha(a);
    onFocusDone?.();
  }, [focusId]); // eslint-disable-line react-hooks/exhaustive-deps
  const [folderModal, setFolderModal] = useState<{ open: boolean; folder: AuthorCategory | null }>({ open: false, folder: null });
  const [dragOver, setDragOver] = useState("");
  const [merging, setMerging] = useState<Author[]>([]);
  const [dupOpen, setDupOpen] = useState(false);
  const [mergeWith, setMergeWith] = useState<Author | null>(null);
  const dupCount = useMemo(() => findDuplicates(authors).length, [authors]);
  // Quantos BOs cada alvo tem e com quantos parceiros já apareceu.
  const bosByAuthor = useMemo(() => {
    const { byReds } = indexReds(authors, data.authorReports, api?.items || []);
    const count = new Map<string, { bos: number; partners: Set<string> }>();
    for (const people of byReds.values()) for (const id of people.keys()) {
      const c = count.get(id) || { bos: 0, partners: new Set<string>() };
      c.bos += 1; people.forEach((_, other) => other !== id && c.partners.add(other));
      count.set(id, c);
    }
    return count;
  }, [authors, data.authorReports, api?.items]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Author | null>(null);
  const [form, setForm] = useState(EMPTY_AUTHOR);
  const [photo, setPhoto] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => { if (folderId !== "all" && folderId !== "none" && !folders.some((f) => f.id === folderId)) setFolderId("all"); }, [folders, folderId]);

  const orphan = (a: Author) => !a.categoryId || !folders.some((f) => f.id === a.categoryId);
  const inFolder = authors.filter((a) => folderId === "all" || (folderId === "none" ? orphan(a) : a.categoryId === folderId));
  const visible = inFolder.filter((a) => matchesText([a.name, a.alias, a.motherName, a.document, a.address, a.neighborhood, a.city, a.crimes, a.notes], query));
  const folderName = (id: string) => folders.find((f) => f.id === id)?.name || "Sem pasta";

  const openCreate = () => { setEditing(null); setForm({ ...EMPTY_AUTHOR, categoryId: folderId !== "all" && folderId !== "none" ? folderId : folders[0]?.id || "" }); setPhoto(null); setFormOpen(true); };
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
      setFicha(created);
    }
    setFormOpen(false);
  };

  const saveFolder = async (v: { name: string; description: string }) => {
    if (folderModal.folder) return data.updateAuthorCategory(folderModal.folder.id, v);
    const created = await data.addAuthorCategory(v);
    if (created) setFolderId(created.id);
    return Boolean(created);
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

  const toggleSel = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const openCardMenu = (e: React.MouseEvent, a: Author) => { e.preventDefault(); setMenu({ kind: "card", author: a, at: { x: e.clientX, y: e.clientY } }); };
  // Clique simples abre o menu (com um instante de espera para o clique duplo abrir a ficha direto).
  const clickTimer = useRef<number>();
  const cardClick = (e: React.MouseEvent, a: Author) => {
    const at = { x: e.clientX, y: e.clientY };
    window.clearTimeout(clickTimer.current);
    if (e.detail > 1) return;
    clickTimer.current = window.setTimeout(() => setMenu({ kind: "card", author: a, at }), 230);
  };
  const openFolderMenu = (e: React.MouseEvent, f: AuthorCategory) => { e.preventDefault(); e.stopPropagation(); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setMenu({ kind: "folder", folder: f, at: e.type === "contextmenu" ? { x: e.clientX, y: e.clientY } : { x: r.left, y: r.bottom + 4 } }); };
  const dropOn = async (e: React.DragEvent, folder: string | null) => {
    e.preventDefault(); setDragOver("");
    const ids = (e.dataTransfer.getData("text/x-alvos") || "").split(",").filter(Boolean);
    if (ids.length && await data.moveAuthors(ids, folder)) setSel(new Set());
  };
  const moveTargets = moving.length ? authors.filter((a) => moving.includes(a.id)) : [];
  const allVisibleSelected = visible.length > 0 && visible.every((a) => sel.has(a.id));

  const menuItems: MenuItem[] = menu?.kind === "card" ? [
    { label: "Ver detalhes (ficha)", icon: Eye, onClick: () => setFicha(menu.author) },
    { label: "Editar", icon: Edit3, onClick: () => openEdit(menu.author) },
    { label: "Mover para outra pasta", icon: FolderInput, onClick: () => setMoving([menu.author.id]) },
    { label: "Compartilhar no WhatsApp", icon: MessageCircle, onClick: () => setSharing(menu.author) },
    { label: "Unir com outro cadastro…", icon: Combine, onClick: () => setMergeWith(menu.author) },
    { label: sel.has(menu.author.id) ? "Desmarcar" : "Selecionar (vários)", icon: CheckSquare, onClick: () => toggleSel(menu.author.id) },
    "sep",
    { label: "Apagar", icon: Trash2, danger: true, onClick: () => data.deleteAuthor(menu.author) },
  ] : menu?.kind === "folder" ? [
    { label: "Abrir", icon: FolderOpen, onClick: () => { setFolderId(menu.folder.id); setSel(new Set()); } },
    { label: "Renomear", icon: Edit3, onClick: () => setFolderModal({ open: true, folder: menu.folder }) },
    "sep",
    { label: "Excluir pasta", icon: Trash2, danger: true, disabled: authors.some((a) => a.categoryId === menu.folder.id), hint: authors.some((a) => a.categoryId === menu.folder.id) ? "só vazia" : "", onClick: () => data.deleteAuthorCategory(menu.folder.id) },
  ] : [];

  const chip = (id: string, label: string, total: number, folder?: AuthorCategory) => {
    const active = folderId === id;
    const dropKey = id;
    return (
      <div key={id}
        onDragOver={(e) => { if (id !== "all") { e.preventDefault(); setDragOver(dropKey); } }} onDragLeave={() => setDragOver("")}
        onDrop={(e) => id !== "all" && dropOn(e, id === "none" ? null : id)}
        onContextMenu={(e) => folder && openFolderMenu(e, folder)}
        className={`flex shrink-0 items-center rounded-sm border transition ${active ? "border-pm-black bg-pm-black text-white" : "border-pm-line bg-white text-pm-ink hover:border-pm-gold"} ${dragOver === dropKey ? "ring-2 ring-pm-gold" : ""}`}>
        <button type="button" onClick={() => { setFolderId(id); setSel(new Set()); setQuery(""); }} className="flex items-center gap-2 py-2 pl-3 pr-2 text-sm font-bold" title={folder?.description || label}>
          <FolderOpen className={`h-4 w-4 ${active ? "text-pm-gold-light" : "text-pm-gold-dark"}`} />
          <span className="max-w-[220px] truncate uppercase">{label}</span>
          <span className={`rounded-sm px-1.5 text-[11px] ${active ? "bg-white/15 text-pm-gold-light" : "bg-pm-sand text-pm-muted"}`}>{total}</span>
        </button>
        {folder && <button type="button" aria-label={`Opções da pasta ${label}`} onClick={(e) => openFolderMenu(e, folder)} className={`mr-1 grid h-7 w-6 place-items-center rounded-sm ${active ? "hover:bg-white/15" : "hover:bg-pm-sand"}`}><MoreVertical className="h-4 w-4" /></button>}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Barra de pastas */}
      <div className="rounded-sm border border-pm-line bg-white p-2 shadow-panel">
        <div className="flex items-center gap-2 overflow-x-auto pb-1"
          onWheel={(e) => { const el = e.currentTarget; if (el.scrollWidth > el.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) { el.scrollLeft += e.deltaY; } }}>
          {chip("all", "Todas", authors.length)}
          {folders.map((f) => chip(f.id, f.name, authors.filter((a) => a.categoryId === f.id).length, f))}
          {authors.some((a) => !a.categoryId || !folders.some((f) => f.id === a.categoryId)) && chip("none", "Sem pasta", authors.filter((a) => !a.categoryId || !folders.some((f) => f.id === a.categoryId)).length)}
          <button type="button" onClick={() => setFolderModal({ open: true, folder: null })} className="flex shrink-0 items-center gap-1.5 rounded-sm border border-dashed border-pm-gold px-3 py-2 text-xs font-bold uppercase text-pm-gold-dark hover:bg-pm-cream"><Plus className="h-4 w-4" />Nova pasta</button>
          <label className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-sm px-2 py-2 text-xs font-bold uppercase text-pm-muted hover:bg-pm-cream ${importing ? "pointer-events-none opacity-60" : ""}`} title="Importar JSON do Trello">
            <Upload className="h-4 w-4" />{importing ? "Importando…" : "Trello"}
            <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => { importTrello(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        </div>
        <p className="px-1 text-[11px] text-pm-muted">Clique num card para as opções (ver ficha, editar, mover, apagar). Arraste cards até uma pasta para mover. Botão direito na pasta: renomear ou excluir.</p>
      </div>

      <Card>
        <CardContent>
          <SectionHeader title={folderId === "all" ? "Todos os alvos" : folderId === "none" ? "Sem pasta" : folderName(folderId)} subtitle={`${visible.length} card(s)`}
            actions={<>
              <div className="relative w-72 max-w-full"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-pm-muted" /><Input className="pl-9" placeholder="Nome, vulgo, documento, bairro…" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
              <Button onClick={() => setBoOpen(true)}><ScanText />Cadastrar pelo BO</Button>
              <Button onClick={() => setPhotosOpen(true)}><Images />Importar fotos</Button>
              <Button onClick={() => setLinksOpen(true)}><Link2 />Link externo</Button>
              <Button variant={intake.pending.length ? "gold" : "outline"} onClick={() => setInboxOpen(true)}><Inbox />Recebidos{intake.pending.length ? ` (${intake.pending.length})` : ""}</Button>
              <Button variant={dupCount ? "gold" : "outline"} onClick={() => setDupOpen(true)} title="Cadastros com o mesmo nome ou RG/CPF"><Combine />Repetidos{dupCount ? ` (${dupCount})` : ""}</Button>
              <Button variant="primary" onClick={openCreate}><UserPlus />Novo alvo</Button>
            </>} />

          {sel.size > 0 && (
            <div className="sticky top-2 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-sm bg-pm-black px-3 py-2 text-sm text-white shadow-lg">
              <CheckSquare className="h-4 w-4 text-pm-gold-light" /><b>{sel.size} selecionado(s)</b>
              <Button size="sm" variant="gold" onClick={() => setMoving([...sel])}><FolderInput />Mover para…</Button>
              {sel.size >= 2 && <Button size="sm" variant="light" onClick={() => setMerging(authors.filter((a) => sel.has(a.id)))}><Combine />Unir selecionados</Button>}
              <button type="button" className="text-xs font-bold uppercase text-white/70 hover:text-white" onClick={() => setSel(allVisibleSelected ? new Set() : new Set(visible.map((a) => a.id)))}>{allVisibleSelected ? "Desmarcar todos" : `Marcar os ${visible.length} desta lista`}</button>
              <button type="button" className="ml-auto text-white/70 hover:text-white" onClick={() => setSel(new Set())} aria-label="Limpar seleção"><X className="h-4 w-4" /></button>
            </div>
          )}

          {!folders.length && <EmptyState icon={FolderOpen} title="Crie a primeira pasta">As pastas organizam os alvos por modalidade criminal.</EmptyState>}
          {folders.length > 0 && visible.length === 0 && <EmptyState icon={UserRound} title="Nenhum card nesta pasta" />}
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {visible.map((author) => {
              const cover = photos.find((p) => p.authorId === author.id);
              const checked = sel.has(author.id);
              const menuOpen = menu?.kind === "card" && menu.author.id === author.id;
              return (
                <div key={author.id} role="button" tabIndex={0} draggable
                  onDragStart={(e) => { const ids = checked ? [...sel] : [author.id]; e.dataTransfer.setData("text/x-alvos", ids.join(",")); e.dataTransfer.effectAllowed = "move"; }}
                  onClick={(e) => (sel.size ? toggleSel(author.id) : cardClick(e, author))}
                  onContextMenu={(e) => openCardMenu(e, author)}
                  onDoubleClick={() => { window.clearTimeout(clickTimer.current); setMenu(null); if (!sel.size) setFicha(author); }}
                  onKeyDown={(e) => { if (e.key === "Enter") setFicha(author); }}
                  className={`group relative flex cursor-pointer select-none gap-3 rounded-sm border bg-white p-2.5 text-left transition hover:border-pm-gold ${checked ? "border-pm-gold ring-2 ring-pm-gold" : menuOpen ? "border-pm-black" : "border-pm-line"}`}>
                  <button type="button" aria-label={checked ? "Desmarcar" : "Selecionar"} onClick={(e) => { e.stopPropagation(); toggleSel(author.id); }}
                    className={`absolute left-1.5 top-1.5 z-10 grid h-6 w-6 place-items-center rounded-sm border-2 ${checked ? "border-pm-gold bg-pm-gold text-pm-black" : "border-white bg-pm-black/40 text-transparent opacity-0 group-hover:opacity-100"} ${sel.size ? "opacity-100" : ""}`}>
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <div className="grid h-24 w-20 shrink-0 place-items-center overflow-hidden rounded-sm bg-pm-sand">
                    {cover ? <img src={data.getIntelFileUrl(cover.filePath)} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" /> : <UserRound className="h-8 w-8 text-pm-muted" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap gap-1"><Badge>{author.status}</Badge><Badge tone={riskTone(author.riskLevel)}>{author.riskLevel}</Badge>
                      {(bosByAuthor.get(author.id)?.bos || 0) > 0 && <Badge tone={(bosByAuthor.get(author.id)!.bos >= 3) ? "late" : "gold"}>{bosByAuthor.get(author.id)!.bos} BO{bosByAuthor.get(author.id)!.bos > 1 ? "s" : ""}</Badge>}
                      {(bosByAuthor.get(author.id)?.partners.size || 0) > 0 && <Badge tone="dark">{bosByAuthor.get(author.id)!.partners.size} parceiro(s)</Badge>}
                    </div>
                    <p className="mt-1 truncate font-black uppercase">{author.name}</p>
                    <p className="truncate text-sm text-pm-muted">Vulgo: {author.alias || "—"}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-pm-muted">{folderId === "all" ? folderName(author.categoryId) : author.crimes || folderName(author.categoryId)}</p>
                  </div>
                  <MoreVertical className="h-4 w-4 shrink-0 text-pm-muted" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <TargetFichaModal author={ficha} data={data} api={api} onClose={() => setFicha(null)} onEdit={openEdit} onMove={(a) => setMoving([a.id])} onShareMessage={(a) => setSharing(a)} onOpenInvestigation={onOpenInvestigation} onOpenAuthor={(o) => setFicha(o)} />
      <DuplicatesModal open={dupOpen} data={data} onClose={() => setDupOpen(false)} onMerge={(list) => setMerging(list)} />
      <MergePicker author={mergeWith} data={data} onClose={() => setMergeWith(null)} onPick={(other) => { const a = mergeWith!; setMergeWith(null); setMerging([a, other]); }} />
      <MergeModal open={merging.length > 1} authors={merging} data={data} onClose={() => setMerging([])} onDone={() => setSel(new Set())} />
      <ContextMenu at={menu?.at || null} title={menu?.kind === "card" ? menu.author.name : menu?.kind === "folder" ? `Pasta ${menu.folder.name}` : ""} items={menuItems} onClose={closeMenu} />
      <FolderModal open={folderModal.open} folder={folderModal.folder} onClose={() => setFolderModal({ open: false, folder: null })} onSave={saveFolder} />
      <MoveModal open={moving.length > 0} count={moving.length} names={moveTargets.map((a) => a.name)} folders={folders}
        currentId={moveTargets.length === 1 ? moveTargets[0].categoryId : undefined}
        onClose={() => setMoving([])} onMove={async (id) => { const ok = await data.moveAuthors(moving, id); if (ok) setSel(new Set()); return ok; }} />
      <IntakeLinksModal open={linksOpen} onClose={() => setLinksOpen(false)} data={data} intake={intake} />
      <IntakeInboxModal open={inboxOpen} onClose={() => setInboxOpen(false)} data={data} intake={intake} onApproved={(id) => { setFolderId("all"); const a = data.authors.find((x) => x.id === id); if (a) setFicha(a); }} />
      <ShareTargetModal author={sharing} data={data} onClose={() => setSharing(null)} />
      <PhotoBatchModal open={photosOpen} data={data} onClose={() => setPhotosOpen(false)} onDone={() => setFolderId("all")} />
      <BoAuthorModal open={boOpen} data={data} api={api} onClose={() => setBoOpen(false)} onDone={() => setFolderId("all")} />
      <Modal open={formOpen} onClose={() => setFormOpen(false)} eyebrow="Banco de alvos" title={editing ? `Editar ${editing.name}` : "Novo card de alvo"}
        footer={<><Button onClick={() => setFormOpen(false)}>Cancelar</Button><Button variant="primary" onClick={submit}><Plus />{editing ? "Salvar" : "Criar card"}</Button></>}>
        <form className="grid gap-3 md:grid-cols-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <Field label="Pasta" className="md:col-span-3"><Select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}><option value="">Sem pasta</option>{folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</Select></Field>
          <Field label="Nome completo" className="md:col-span-2"><Input value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus /></Field>
          <Field label="Vulgo"><Input value={form.alias} onChange={(e) => set("alias", e.target.value)} /></Field>
          <Field label="Nome da mãe"><Input value={form.motherName} onChange={(e) => set("motherName", e.target.value)} /></Field>
          <Field label="Nome do pai"><Input value={form.fatherName} onChange={(e) => set("fatherName", e.target.value)} /></Field>
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
