// Monta o conteúdo do relatório de inteligência a partir do dossiê.
// Estrutura conforme ABNT NBR 10719 (relatório técnico) e NBR 14724 (apresentação):
// capa, folha de rosto, sumário, seções numeradas (NBR 6024), quadros/figuras com
// legenda acima e fonte abaixo, e referências (NBR 6023).

import { Investigation, InvestigationItem, InvestigationLink, InvestigationTarget, ITEM_KINDS, ratingLabel, SOURCE_RATINGS, INFO_RATINGS, stageIndex, STAGES } from "../investigation";

export type Rich = { text: string; bold?: boolean; italic?: boolean }[];

export type ReportPerson = {
  targetId: string; authorId: string; name: string; alias: string; role: string; parentName: string; birthDate: string;
  motherName: string; document: string; address: string; neighborhood: string; city: string; status: string; crimes: string; notes: string;
  targetNotes: string; photo?: ReportImage;
};
export type ReportImage = { bytes: Uint8Array; type: "png" | "jpg"; dataUrl: string; width: number; height: number };

export type Block =
  | { type: "p"; text: Rich | string; indent?: boolean }
  | { type: "list"; items: string[] }
  | { type: "table"; label: string; caption: string; headers: string[]; widths: number[]; rows: string[][]; source: string }
  | { type: "org"; label: string; caption: string; source: string }
  | { type: "links"; label: string; caption: string; source: string }
  | { type: "person"; person: ReportPerson; label: string };

export type Section = { number: string; title: string; level: 1 | 2; blocks: Block[] };

export type ReportInput = {
  investigation: Investigation;
  items: InvestigationItem[];
  targets: InvestigationTarget[];
  links: InvestigationLink[];
  people: ReportPerson[];
  responsibleName: string;
  teamNames: string[];
  generatedBy: string;
  place?: string;
  unit?: string[];
  logo?: ReportImage;
  today?: Date;
};

export type ReportModel = {
  institution: string[];
  title: string;
  subtitle: string;
  code: string;
  classification: string;
  place: string;
  year: string;
  dateLong: string;
  authors: string[];
  nature: string;
  sections: Section[];
  references: Rich[];
  people: ReportPerson[];
  input: ReportInput;
};

const MONTHS_ABNT = ["jan.", "fev.", "mar.", "abr.", "maio", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
const MONTHS_FULL = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function dateAbnt(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS_ABNT[m - 1]} ${y}`;
}
export function dateBr(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
function dateLong(date: Date) {
  return `${date.getDate()} de ${MONTHS_FULL[date.getMonth()]} de ${date.getFullYear()}`;
}
const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

function paragraphs(text: string): Block[] {
  return (text || "").split(/\n\s*\n|\r\n\s*\r\n/).map((p) => p.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean).map((p) => ({ type: "p", text: p, indent: true }));
}

function listLines(text: string) {
  return (text || "").split("\n").map((l) => l.replace(/^\s*[-•*\d.)]+\s*/, "").trim()).filter(Boolean);
}

function upperFirstWord(title: string) {
  const [first, ...rest] = title.trim().split(/\s+/);
  return [first?.toUpperCase() || "", ...rest].join(" ");
}

/** Referência ABNT NBR 6023 para os itens documentais do dossiê. */
export function referenceFor(item: InvestigationItem, place: string, today: Date): Rich | null {
  const date = item.itemDate ? dateAbnt(item.itemDate) : "";
  const access = item.url ? [{ text: ` Disponível em: ${item.url}. Acesso em: ${dateAbnt(iso(today))}.` }] : [];
  const source = (item.source || "").trim();
  switch (item.kind) {
    case "Boletim de ocorrência":
      return [
        { text: "MINAS GERAIS. Polícia Militar. " },
        { text: item.reference ? `Boletim de ocorrência nº ${item.reference}` : item.title, bold: true },
        { text: `. ${place}: PMMG${date ? `, ${date}` : ""}.` },
        ...access,
      ];
    case "Reportagem":
    case "Fonte aberta / rede social":
      return [
        { text: `${upperFirstWord(item.title)}. ` },
        { text: source || "Fonte aberta", bold: true },
        { text: `${date ? `, ${date}` : ""}.` },
        ...access,
      ];
    case "Relatório de inteligência":
    case "Informe":
    case "Documento":
    case "Vídeo":
      return [
        { text: `${(source || "MINAS GERAIS. Polícia Militar").toUpperCase()}. ` },
        { text: item.title, bold: true },
        { text: `${item.reference ? `. ${item.reference}` : ""}. ${place}${date ? `, ${date}` : ""}.` },
        ...access,
      ];
    default:
      return item.url ? [{ text: `${upperFirstWord(item.title)}. ` }, { text: source || "Fonte", bold: true }, { text: `${date ? `, ${date}` : ""}.` }, ...access] : null;
  }
}

/** Fontes do relatório que citam algum alvo do dossiê (para o quadro alvos × ocorrências). */
export function linkedSources(input: ReportInput) {
  const ids = new Set(input.people.map((p) => p.authorId));
  return input.items
    .filter((i) => i.includeInReport && i.authorIds.some((a) => ids.has(a)))
    .sort((a, b) => (a.itemDate || "9999").localeCompare(b.itemDate || "9999"));
}

export function sourceShortLabel(item: InvestigationItem) {
  const kind = item.kind === "Boletim de ocorrência" ? "REDS" : item.kind.split(" ")[0];
  return { kind: kind.toUpperCase(), ref: item.reference || item.title, date: dateBr(item.itemDate) };
}

export function buildReport(input: ReportInput): ReportModel {
  const inv = input.investigation;
  const today = input.today || new Date();
  const place = input.place || "Belo Horizonte";
  const items = input.items.filter((i) => i.includeInReport).sort((a, b) => (a.itemDate || "9999").localeCompare(b.itemDate || "9999"));
  const sections: Section[] = [];
  let n = 0;
  let quadro = 0;
  let figura = 0;
  const source = `Fonte: Seção de Inteligência da 6ª CIA PM (${today.getFullYear()}).`;
  const push = (title: string, blocks: Block[]) => { if (blocks.length) { n += 1; sections.push({ number: String(n), title, level: 1, blocks }); } };

  // 1 Introdução
  const period = `${dateBr(inv.openedAt) || dateBr(iso(today))} a ${dateBr(inv.closedAt) || dateBr(iso(today))}`;
  const team = [input.responsibleName, ...input.teamNames.filter((t) => t !== input.responsibleName)].filter(Boolean);
  const intro: Block[] = [
    { type: "p", indent: true, text: `O presente relatório tem por objetivo ${inv.objective ? inv.objective.replace(/\.$/, "").replace(/^./, (c) => c.toLowerCase()) : `consolidar os conhecimentos produzidos na investigação ${inv.code} — ${inv.title}`}.` },
  ];
  if (inv.origin) intro.push({ type: "p", indent: true, text: `A demanda teve origem em ${inv.origin.replace(/\.$/, "").replace(/^./, (c) => c.toLowerCase())}.` });
  intro.push({
    type: "p", indent: true,
    text: `Os trabalhos foram conduzidos no período de ${period}${team.length ? `, pela equipe composta por ${team.join(", ")}` : ""}, segundo a metodologia de produção do conhecimento de inteligência de segurança pública: ${STAGES.slice(1, 6).map((s) => s.name.toLowerCase()).join(", ")}.`,
  });
  intro.push({ type: "p", indent: true, text: "Os dados reunidos foram avaliados quanto à idoneidade da fonte (escala de A a F) e à veracidade do conteúdo (escala de 1 a 6), conforme registrado no quadro de fontes." });
  intro.push(...paragraphs(inv.methodology));
  push("INTRODUÇÃO", intro);

  // 2 Contexto
  push("SÍNTESE DOS FATOS", paragraphs(inv.summary));

  // 3 Alvos
  if (input.people.length) {
    n += 1;
    const num = String(n);
    sections.push({ number: num, title: "ALVOS IDENTIFICADOS", level: 1, blocks: [{ type: "p", indent: true, text: `Foram identificados ${input.people.length} ${input.people.length === 1 ? "alvo" : "alvos"} vinculados à investigação, qualificados a seguir.` }] });
    input.people.forEach((person, i) => {
      quadro += 1;
      const blocks: Block[] = [{ type: "person", person, label: `Quadro ${quadro}` }];
      blocks.push(...paragraphs([person.notes, person.targetNotes].filter(Boolean).join("\n\n")));
      sections.push({ number: `${num}.${i + 1}`, title: person.alias ? `${person.name} ("${person.alias}")` : person.name, level: 2, blocks });
    });
  }

  // 4 Estrutura e vínculos
  if (input.targets.length >= 1) {
    const blocks: Block[] = [];
    figura += 1;
    blocks.push({
      type: "p", indent: true,
      text: input.targets.length === 1
        ? `A Figura ${figura} apresenta o alvo identificado até o momento; não foram levantados outros integrantes.`
        : `A Figura ${figura} apresenta a estrutura hierárquica identificada${input.links.length ? ", e as linhas tracejadas indicam os demais vínculos" : ""}.`,
    });
    blocks.push({ type: "org", label: `Figura ${figura}`, caption: `Organograma — ${inv.title}`, source });
    if (linkedSources(input).length) {
      figura += 1;
      blocks.push({ type: "p", indent: true, text: `A Figura ${figura} relaciona cada alvo às ocorrências e fontes em que aparece.` });
      blocks.push({ type: "links", label: `Figura ${figura}`, caption: "Vínculos entre alvos e ocorrências", source });
    }
    if (input.links.length) {
      quadro += 1;
      const name = (id: string) => input.people.find((p) => p.targetId === id)?.name || "—";
      blocks.push({
        type: "table", label: `Quadro ${quadro}`, caption: "Vínculos identificados", headers: ["Alvo", "Vínculo", "Alvo", "Observação"], widths: [0.27, 0.18, 0.27, 0.28],
        rows: input.links.map((l) => [name(l.fromTarget), l.relation, name(l.toTarget), l.notes || "—"]), source,
      });
    }
    push("ESTRUTURA E VÍNCULOS", blocks);
  }

  // 5 Fontes e dados reunidos
  if (items.length) {
    quadro += 1;
    const blocks: Block[] = [
      { type: "p", indent: true, text: `Foram reunidos ${items.length} ${items.length === 1 ? "registro" : "registros"}, sintetizados no Quadro ${quadro}. A avaliação combina a idoneidade da fonte (letra) e a veracidade do dado (número).` },
      {
        type: "table", label: `Quadro ${quadro}`, caption: "Fontes e dados reunidos", headers: ["Data", "Tipo", "Descrição", "Fonte", "Aval."], widths: [0.13, 0.17, 0.4, 0.2, 0.1],
        rows: items.map((i) => [dateBr(i.itemDate) || "—", i.kind, [i.title, i.reference].filter(Boolean).join(" — "), i.source || "—", ratingLabel(i.sourceRating, i.infoRating) || "—"]), source,
      },
    ];
    const used = new Set(items.flatMap((i) => [i.sourceRating, i.infoRating]).filter(Boolean));
    const legend = [...SOURCE_RATINGS, ...INFO_RATINGS].filter(([k]) => used.has(k)).map(([k, v]) => `${k} = ${v.toLowerCase()}`);
    if (legend.length) blocks.push({ type: "p", text: `Legenda da avaliação: ${legend.join("; ")}.` });
    items.filter((i) => i.summary).forEach((i) => {
      blocks.push({ type: "p", indent: true, text: [{ text: `${i.kind}${i.itemDate ? ` de ${dateBr(i.itemDate)}` : ""} — ${i.title}. `, bold: true }, { text: i.summary.replace(/\s*\n\s*/g, " ") }] });
    });
    push("FONTES E DADOS REUNIDOS", blocks);
  }

  // 6 Cronologia
  const timeline = items.filter((i) => i.itemDate).map((i) => [dateBr(i.itemDate), `${i.kind}: ${i.title}${i.summary ? ` — ${i.summary.replace(/\s+/g, " ").slice(0, 160)}${i.summary.length > 160 ? "…" : ""}` : ""}`]);
  if (timeline.length >= 2) {
    quadro += 1;
    push("CRONOLOGIA", [{ type: "table", label: `Quadro ${quadro}`, caption: "Cronologia dos fatos", headers: ["Data", "Fato"], widths: [0.16, 0.84], rows: timeline, source }]);
  }

  // 7 Análise
  push("ANÁLISE", paragraphs(inv.analysis));

  // 8 Considerações finais
  const finals: Block[] = [...paragraphs(inv.conclusion)];
  const recs = listLines(inv.recommendations);
  if (recs.length) { finals.push({ type: "p", indent: true, text: "Diante do exposto, recomenda-se:" }); finals.push({ type: "list", items: recs }); }
  if (inv.destination) finals.push({ type: "p", indent: true, text: `Este conhecimento destina-se a ${inv.destination.replace(/\.$/, "")}, vedada a difusão a terceiros sem autorização.` });
  if (!finals.length) finals.push({ type: "p", indent: true, text: `A investigação encontra-se na etapa de ${STAGES[stageIndex(inv.stage)].name.toLowerCase()}.` });
  push("CONSIDERAÇÕES FINAIS", finals);

  // Referências (ordem alfabética, NBR 6023)
  const references = items.map((i) => referenceFor(i, place, today)).filter(Boolean) as Rich[];
  references.sort((a, b) => a.map((s) => s.text).join("").localeCompare(b.map((s) => s.text).join(""), "pt-BR"));

  return {
    institution: input.unit || ["POLÍCIA MILITAR DE MINAS GERAIS", "1ª REGIÃO DE POLÍCIA MILITAR", "1º BATALHÃO DE POLÍCIA MILITAR", "6ª COMPANHIA DE POLÍCIA MILITAR", "SEÇÃO DE INTELIGÊNCIA"],
    title: inv.title.toUpperCase(),
    subtitle: "Relatório de Inteligência",
    code: inv.code,
    classification: inv.classification === "Ostensivo" ? "" : inv.classification.toUpperCase(),
    place,
    year: String(today.getFullYear()),
    dateLong: dateLong(today),
    authors: team.length ? team : [input.generatedBy],
    nature: `Relatório de inteligência ${inv.code ? `(${inv.code}) ` : ""}elaborado pela Seção de Inteligência da 6ª Companhia de Polícia Militar${inv.destination ? `, com difusão para ${inv.destination.replace(/\.$/, "")}` : ""}.`,
    sections,
    references,
    people: input.people,
    input,
  };
}

export { ITEM_KINDS };
