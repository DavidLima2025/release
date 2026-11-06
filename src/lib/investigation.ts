// Domínio das investigações / dossiês de inteligência.
// As etapas seguem a Metodologia de Produção do Conhecimento da Doutrina Nacional de
// Inteligência de Segurança Pública (planejamento, reunião de dados, análise, formalização
// e difusão), com abertura e encerramento para controle da seção.

export type StageKey = "abertura" | "planejamento" | "reuniao" | "analise" | "relatorio" | "difusao" | "encerramento";

export type Stage = { key: StageKey; name: string; short: string; description: string; checklist: string[] };

export const STAGES: Stage[] = [
  {
    key: "abertura", name: "Abertura", short: "Abertura",
    description: "Recebimento da demanda, registro e designação da equipe.",
    checklist: ["Registrar a origem da demanda (quem pediu e por quê)", "Definir o objetivo da investigação", "Designar responsável e equipe", "Definir grau de sigilo"],
  },
  {
    key: "planejamento", name: "Planejamento", short: "Planejar",
    description: "Plano de trabalho: o que já se sabe, o que é preciso saber e como obter.",
    checklist: ["Listar os aspectos essenciais a conhecer", "Levantar o que já se sabe (BOs, banco de alvos)", "Definir fontes e ações de busca", "Definir prazos e medidas de segurança (contrainteligência)"],
  },
  {
    key: "reuniao", name: "Reunião de dados", short: "Coleta/Busca",
    description: "Coleta em fontes disponíveis e busca de dados negados.",
    checklist: ["Consultar REDS/BOs e sistemas", "Pesquisar fontes abertas (reportagens, redes sociais)", "Executar ações de busca (reconhecimento, vigilância, entrevista)", "Registrar cada dado no dossiê com avaliação da fonte"],
  },
  {
    key: "analise", name: "Análise e integração", short: "Análise",
    description: "Avaliação, integração e interpretação dos dados.",
    checklist: ["Avaliar idoneidade das fontes e veracidade dos dados", "Identificar alvos e qualificar", "Montar hierarquia e vínculos (organograma)", "Montar a cronologia dos fatos", "Redigir a análise e a conclusão"],
  },
  {
    key: "relatorio", name: "Formalização", short: "Relatório",
    description: "Produção do relatório de inteligência.",
    checklist: ["Gerar o relatório (PDF/PPTX)", "Revisar conteúdo e grau de sigilo", "Aprovação do chefe da seção"],
  },
  {
    key: "difusao", name: "Difusão", short: "Difusão",
    description: "Entrega do conhecimento ao destinatário.",
    checklist: ["Definir destinatário(s)", "Difundir por canal seguro", "Registrar a difusão"],
  },
  {
    key: "encerramento", name: "Encerramento", short: "Encerrar",
    description: "Avaliação dos resultados e arquivamento.",
    checklist: ["Registrar resultados obtidos", "Atualizar o banco de alvos", "Arquivar o dossiê"],
  },
];

export const stageIndex = (key: string) => Math.max(0, STAGES.findIndex((s) => s.key === key));
export const stageOf = (key: string) => STAGES[stageIndex(key)];

export const INVESTIGATION_STATUSES = ["Em andamento", "Suspensa", "Concluída", "Arquivada"];
export const CLASSIFICATIONS = ["Reservado", "Secreto", "Ostensivo"];

export const ITEM_KINDS = [
  "Boletim de ocorrência", "Relatório de inteligência", "Informe", "Reportagem", "Fonte aberta / rede social",
  "Entrevista / depoimento", "Consulta a sistemas", "Foto / imagem", "Vídeo", "Documento", "Ação de busca", "Outro",
];

// Avaliação de dados (Doutrina de Inteligência): idoneidade da fonte (A–F) e veracidade do conteúdo (1–6).
export const SOURCE_RATINGS: [string, string][] = [
  ["A", "Inteiramente idônea"], ["B", "Normalmente idônea"], ["C", "Regularmente idônea"],
  ["D", "Normalmente inidônea"], ["E", "Inidônea"], ["F", "Idoneidade não pode ser avaliada"],
];
export const INFO_RATINGS: [string, string][] = [
  ["1", "Confirmado por outras fontes"], ["2", "Provavelmente verdadeiro"], ["3", "Possivelmente verdadeiro"],
  ["4", "Duvidoso"], ["5", "Improvável"], ["6", "Veracidade não pode ser avaliada"],
];

export const TARGET_ROLES = ["Líder", "Gerente", "Financeiro", "Executor", "Apoio / logística", "Receptador", "Olheiro", "Associado", "Vítima", "Testemunha"];
export const RELATIONS = ["Comparsa", "Subordinado", "Parente", "Cônjuge / companheiro(a)", "Fornecedor", "Comprador", "Receptador", "Contato", "Rival", "Outro"];

export const ROLE_COLOR: Record<string, string> = {
  "Líder": "#B3261E", "Gerente": "#C28A12", "Financeiro": "#7A6C45", "Executor": "#231F20", "Apoio / logística": "#2F5D7C",
  "Receptador": "#5B3E8A", "Olheiro": "#5F5E5A", "Associado": "#6B655A", "Vítima": "#2E6B3A", "Testemunha": "#2E6B3A",
};

export type Investigation = {
  id: string; code: string; title: string; objective: string; origin: string; destination: string; summary: string;
  analysis: string; conclusion: string; recommendations: string; methodology: string; classification: string; status: string;
  stage: StageKey; stages: Record<string, { done?: boolean[]; notes?: string; completedAt?: string }>; priority: string; nature: string; area: string;
  responsibleId: string; team: string[]; openedAt: string; dueDate: string; closedAt: string; createdAt: string; updatedAt: string;
};

export type InvestigationItem = {
  id: string; investigationId: string; kind: string; title: string; itemDate: string; source: string; reference: string; url: string;
  sourceRating: string; infoRating: string; summary: string; authorIds: string[]; filePath: string; fileName: string; fileSize: number;
  mimeType: string; includeInReport: boolean; createdAt: string;
};

export type InvestigationTarget = { id: string; investigationId: string; authorId: string; role: string; parentId: string; notes: string; position: number };
export type InvestigationLink = { id: string; investigationId: string; fromTarget: string; toTarget: string; relation: string; notes: string };

export function normalizeInvestigation(row: any): Investigation {
  return {
    id: row.id, code: row.code || "", title: row.title || "Investigação sem título", objective: row.objective || "", origin: row.origin || "",
    destination: row.destination || "", summary: row.summary || "", analysis: row.analysis || "", conclusion: row.conclusion || "",
    recommendations: row.recommendations || "", methodology: row.methodology || "", classification: row.classification || "Reservado",
    status: row.status || "Em andamento", stage: (STAGES.some((s) => s.key === row.stage) ? row.stage : "abertura") as StageKey,
    stages: row.stages && typeof row.stages === "object" ? row.stages : {}, priority: row.priority || "Média", nature: row.nature || "",
    area: row.area || "", responsibleId: row.responsible_id || "", team: Array.isArray(row.team) ? row.team : [], openedAt: row.opened_at || "",
    dueDate: row.due_date || "", closedAt: row.closed_at || "", createdAt: row.created_at || "", updatedAt: row.updated_at || "",
  };
}

export function normalizeItem(row: any): InvestigationItem {
  return {
    id: row.id, investigationId: row.investigation_id, kind: row.kind || "Documento", title: row.title || "", itemDate: row.item_date || "",
    source: row.source || "", reference: row.reference || "", url: row.url || "", sourceRating: row.source_rating || "", infoRating: row.info_rating || "",
    summary: row.summary || "", authorIds: Array.isArray(row.author_ids) ? row.author_ids : [], filePath: row.file_path || "", fileName: row.file_name || "",
    fileSize: Number(row.file_size) || 0, mimeType: row.mime_type || "", includeInReport: row.include_in_report !== false, createdAt: row.created_at || "",
  };
}

export function normalizeTarget(row: any): InvestigationTarget {
  return { id: row.id, investigationId: row.investigation_id, authorId: row.author_id, role: row.role || "Associado", parentId: row.parent_id || "", notes: row.notes || "", position: row.position || 0 };
}

export function normalizeLink(row: any): InvestigationLink {
  return { id: row.id, investigationId: row.investigation_id, fromTarget: row.from_target, toTarget: row.to_target, relation: row.relation || "Associado", notes: row.notes || "" };
}

export function stageProgress(inv: Investigation, key: StageKey) {
  const stage = stageOf(key);
  const done = inv.stages?.[key]?.done || [];
  const count = stage.checklist.filter((_, i) => done[i]).length;
  return { count, total: stage.checklist.length, pct: Math.round((count / stage.checklist.length) * 100) };
}

export function overallProgress(inv: Investigation) {
  const idx = stageIndex(inv.stage);
  if (inv.status === "Concluída" || inv.status === "Arquivada") return 100;
  const current = stageProgress(inv, inv.stage).pct / 100;
  return Math.round(((idx + current) / STAGES.length) * 100);
}

export const ratingLabel = (source: string, info: string) => (source || info ? `${source || "–"}${info || ""}` : "");

// ---------- Organograma: layout em árvore (usado no site, no PDF e no PPTX) ----------
export type OrgNode = { id: string; x: number; y: number; depth: number; parentId: string };
export type OrgLayout = { nodes: OrgNode[]; width: number; depth: number };

/** Posiciona os alvos em níveis: cada nó fica centrado sobre seus subordinados. x/y em "unidades de caixa". */
export function layoutOrganogram(targets: InvestigationTarget[]): OrgLayout {
  const ids = new Set(targets.map((t) => t.id));
  const children = new Map<string, InvestigationTarget[]>();
  const roots: InvestigationTarget[] = [];
  const sorted = [...targets].sort((a, b) => a.position - b.position || roleRank(a.role) - roleRank(b.role));
  sorted.forEach((t) => {
    const parent = t.parentId && ids.has(t.parentId) && t.parentId !== t.id ? t.parentId : "";
    if (parent) {
      if (!children.has(parent)) children.set(parent, []);
      children.get(parent)!.push(t);
    } else roots.push(t);
  });

  const nodes: OrgNode[] = [];
  const visiting = new Set<string>();
  let cursor = 0;
  let maxDepth = 0;
  const place = (t: InvestigationTarget, depth: number): number => {
    if (visiting.has(t.id)) return cursor; // proteção contra ciclos
    visiting.add(t.id);
    maxDepth = Math.max(maxDepth, depth);
    const kids = children.get(t.id) || [];
    let x: number;
    if (!kids.length) { x = cursor; cursor += 1; } else {
      const xs = kids.map((k) => place(k, depth + 1));
      x = (xs[0] + xs[xs.length - 1]) / 2;
    }
    nodes.push({ id: t.id, x, y: depth, depth, parentId: t.parentId && ids.has(t.parentId) ? t.parentId : "" });
    return x;
  };
  roots.forEach((r) => { place(r, 0); cursor += 0.35; });
  // Alvos presos num ciclo (sem raiz) entram no fim.
  sorted.filter((t) => !nodes.some((n) => n.id === t.id)).forEach((t) => place({ ...t, parentId: "" }, 0));
  return { nodes, width: Math.max(1, cursor - 0.35), depth: maxDepth + 1 };
}

function roleRank(role: string) {
  const i = TARGET_ROLES.indexOf(role);
  return i < 0 ? 99 : i;
}

export function slug(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 60);
}
