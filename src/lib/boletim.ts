import { coordsFromRedsText } from "./geo";
// Leitura de Boletim de Ocorrência (REDS / SIDS - PMMG) a partir dos itens de texto
// posicionados que o pdf.js entrega. O layout do BO é sempre "rótulo pequeno em cima,
// valor embaixo, alinhado na mesma coluna" — o parser explora exatamente isso.

export type PdfTextItem = { str: string; x: number; y: number; w: number; h: number; page: number };

type Segment = { text: string; x0: number; x1: number; h: number; kind: "label" | "value" | "title" };
type Row = { page: number; y: number; segments: Segment[]; text: string };

export type BoEnvolvido = {
  numero: number; tipo: string; nome: string; natureza: string; sexo: string; nascimento: string; naturalidade: string;
  mae: string; pai: string; rg: string; cpf: string; endereco: string; numeroEndereco: string; bairro: string; municipio: string; uf: string;
};
export type BoMaterial = { objeto: string; quantidade: string; situacao: string; info: string };
export type BoMilitar = { nome: string; cargo: string; matricula: string; unidade: string };

export type Boletim = {
  numero: string; // nº REDS, ex.: 2026-043884443-001
  dataRegistro: string; // ISO yyyy-mm-dd
  horaRegistro: string;
  dataFato: string; // ISO
  horaFato: string;
  natureza: string; // ex.: C01155 - FURTO
  tentadoConsumado: string;
  alvoEvento: string;
  unidade: string;
  municipio: string;
  local: { logradouro: string; numero: string; bairro: string; municipio: string; uf: string; descricao: string; lat?: number; lng?: number };
  meioUtilizado: string;
  causaPresumida: string;
  envolvidos: BoEnvolvido[];
  materiais: BoMaterial[];
  militares: BoMilitar[];
  historico: string;
  textoCompleto: string;
};

const EMPTY_VALUES = /^(X{2,}|-+|XX)$/i;

const MAJOR_SECTIONS = [
  /^ORIGEM DA COMUNICA/i,
  /^DADOS DA OCORR/i,
  /^QUALIFICA.{1,3}O DOS ENVOLVIDOS/i,
  /^MATERIAIS/i,
  /^ARMAS/i,
  /^DROGAS/i,
  /^VE.CULOS/i,
  /^ANIMAIS/i,
  /^SUBST/i,
  /^HIST.RICO DA OCORR/i,
  /^PER.CIA/i,
  /^VIATURAS/i,
  /^MILITARES\/POLICIAIS/i,
  /^RESPONS.VEL PELA/i,
  /^DADOS PARA CONTROLE/i,
  /^RECIBO/i,
];

function clean(value = "") {
  const text = value.replace(/\s+/g, " ").trim();
  return EMPTY_VALUES.test(text) ? "" : text;
}

export function brDateToIso(value = "") {
  const match = value.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
}

function extractTime(value = "") {
  return value.match(/\b(\d{2}:\d{2})\b/)?.[1] || "";
}

/** Agrupa itens em linhas (mesma página e mesma altura) e as linhas em segmentos (colunas). */
export function buildRows(items: PdfTextItem[]): Row[] {
  const visible = items.filter((item) => item.str && item.h >= 4);
  const byPage = new Map<number, PdfTextItem[]>();
  visible.forEach((item) => {
    if (!byPage.has(item.page)) byPage.set(item.page, []);
    byPage.get(item.page)!.push(item);
  });

  const rows: Row[] = [];
  [...byPage.keys()].sort((a, b) => a - b).forEach((page) => {
    const pageItems = byPage.get(page)!.sort((a, b) => b.y - a.y || a.x - b.x);
    const lines: PdfTextItem[][] = [];
    pageItems.forEach((item) => {
      const line = lines.find((candidate) => Math.abs(candidate[0].y - item.y) <= 1.6);
      if (line) line.push(item); else lines.push([item]);
    });

    lines.forEach((line) => {
      line.sort((a, b) => a.x - b.x);
      const segments: Segment[] = [];
      let current: { parts: string[]; x0: number; x1: number; h: number } | null = null;
      line.forEach((item) => {
        const blank = !item.str.trim();
        if (blank) {
          // Espaços largos separam colunas; espaços curtos fazem parte do texto.
          if (current && item.w > 7.5) { segments.push(toSegment(current)); current = null; }
          else if (current) { current.parts.push(" "); current.x1 = Math.max(current.x1, item.x + item.w); }
          return;
        }
        if (current && item.x - current.x1 > 6) { segments.push(toSegment(current)); current = null; }
        if (!current) current = { parts: [], x0: item.x, x1: item.x + item.w, h: item.h };
        else if (current.parts.length && !current.parts[current.parts.length - 1].endsWith(" ") && item.x - current.x1 > 1) current.parts.push(" ");
        current.parts.push(item.str);
        current.x1 = Math.max(current.x1, item.x + item.w);
        current.h = Math.max(current.h, item.h);
      });
      if (current) segments.push(toSegment(current));
      if (segments.length) rows.push({ page, y: line[0].y, segments, text: segments.map((s) => s.text).join("  ") });
    });
  });

  // Remove cabeçalhos ("SISTEMA INTEGRADO...", "BOLETIM DE OCORRÊNCIA ... Fl.") e
  // rodapés ("DIGITADOR: ... GERADO POR" + data) repetidos em todas as folhas.
  const limits = new Map<number, { top: number; bottom: number }>();
  rows.forEach((row) => {
    const limit = limits.get(row.page) || { top: Infinity, bottom: -Infinity };
    if (/^BOLETIM DE OCORR/i.test(row.text)) limit.top = Math.min(limit.top, row.y - 1);
    if (/^DIGITADOR:/i.test(row.text)) limit.bottom = Math.max(limit.bottom, row.y + 1);
    limits.set(row.page, limit);
  });
  return rows.filter((row) => {
    const limit = limits.get(row.page)!;
    if (row.y >= limit.top || row.y <= limit.bottom) return false;
    return !/^SISTEMA INTEGRADO DE SEGURAN/i.test(row.text);
  });
}

function toSegment(current: { parts: string[]; x0: number; x1: number; h: number }): Segment {
  const text = current.parts.join("").replace(/\s+/g, " ").trim();
  const kind = current.h >= 9.5 ? "title" : current.h <= 6.5 ? "label" : "value";
  return { text, x0: current.x0, x1: current.x1, h: current.h, kind };
}

function findRowIndex(rows: Row[], matcher: RegExp, from = 0, to = rows.length) {
  for (let i = from; i < to; i += 1) if (rows[i].segments.some((s) => matcher.test(s.text))) return i;
  return -1;
}

function sectionRange(rows: Row[], start: RegExp): [number, number] {
  const begin = rows.findIndex((row) => row.segments.some((s) => s.kind === "title" && start.test(s.text)));
  if (begin < 0) return [-1, -1];
  for (let i = begin + 1; i < rows.length; i += 1) {
    const title = rows[i].segments.find((s) => s.kind === "title");
    if (title && !start.test(title.text) && MAJOR_SECTIONS.some((re) => re.test(title.text))) return [begin, i];
  }
  return [begin, rows.length];
}

/** Valor do campo cujo rótulo casa com `label`, procurando entre as linhas [from, to). */
function field(rows: Row[], label: RegExp, from = 0, to = rows.length): string {
  for (let i = Math.max(0, from); i < to; i += 1) {
    const row = rows[i];
    const labelSeg = row.segments.find((s) => s.kind === "label" && label.test(s.text));
    if (!labelSeg) continue;
    const nextLabel = row.segments
      .filter((s) => s.kind === "label" && s.x0 > labelSeg.x0 + 2)
      .sort((a, b) => a.x0 - b.x0)[0];
    const start = labelSeg.x0 - 12;
    const end = nextLabel ? nextLabel.x0 - 3 : Infinity;

    // Valor na mesma linha (ex.: "UNIDADE MILITAR:  6 CIA PM/1 BPM").
    const inline = row.segments.filter((s) => s.kind === "value" && s.x0 > labelSeg.x1 && s.x0 < end);
    if (inline.length) return clean(inline.map((s) => s.text).join(" "));

    // Valor na linha seguinte, na mesma coluna.
    for (let j = i + 1; j < Math.min(i + 3, to); j += 1) {
      const values = rows[j].segments.filter((s) => s.kind === "value");
      if (!values.length) continue;
      const inColumn = values.filter((s) => s.x0 < end && s.x1 > start && s.x0 >= start);
      return clean(inColumn.map((s) => s.text).join(" "));
    }
    return "";
  }
  return "";
}

function blocks(rows: Row[], [begin, end]: [number, number], header: RegExp) {
  const result: { numero: number; from: number; to: number }[] = [];
  if (begin < 0) return result;
  for (let i = begin; i < end; i += 1) {
    const title = rows[i].segments.find((s) => s.kind === "title" && header.test(s.text));
    if (!title) continue;
    const numero = Number(title.text.match(/(\d+)/)?.[1] || result.length + 1);
    if (result.length) result[result.length - 1].to = i;
    result.push({ numero, from: i, to: end });
  }
  return result;
}

function parseHistorico(rows: Row[], [begin, end]: [number, number]) {
  if (begin < 0) return "";
  const paragraphs: string[] = [];
  let current: string[] = [];
  let previous: Row | null = null;
  let baseX = Infinity;
  for (let i = begin + 1; i < end; i += 1) {
    const row = rows[i];
    if (row.segments.some((s) => s.kind === "title")) continue; // cabeçalho repetido na folha seguinte
    const x0 = row.segments[0].x0;
    baseX = Math.min(baseX, x0);
    const gap = previous && previous.page === row.page ? previous.y - row.y : 0;
    const newParagraph = !previous || gap > 13 || x0 > baseX + 2.5 || /^\*/.test(row.text.trim());
    if (newParagraph && current.length) { paragraphs.push(current.join(" ")); current = []; }
    current.push(row.segments.map((s) => s.text).join(" "));
    previous = row;
  }
  if (current.length) paragraphs.push(current.join(" "));
  const cleaned = paragraphs.map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
  // Itens de lista ("* REDS ...") ficam em linhas seguidas; parágrafos, separados por linha em branco.
  return cleaned.reduce((text, paragraph, index) => {
    if (index === 0) return paragraph;
    const bullet = paragraph.startsWith("*") && cleaned[index - 1].startsWith("*");
    return `${text}${bullet ? "\n" : "\n\n"}${paragraph}`;
  }, "");
}

export function parseBoletim(items: PdfTextItem[]): Boletim {
  const rows = buildRows(items);
  const fullText = items.map((i) => i.str).join(" ").replace(/\s+/g, " ");
  const numero = fullText.match(/N[º°o]\.?\s*(\d{4}-\d{6,12}-\d{3})/)?.[1]
    || fullText.match(/REDS\s*(\d{4}-\d{6,12}-\d{3})/)?.[1]
    || "";

  const registro = field(rows, /^DATA DO REGISTRO/i);
  const dados = sectionRange(rows, /^DADOS DA OCORR/i);
  const [dFrom, dTo] = dados[0] >= 0 ? dados : [0, rows.length];
  const fato = field(rows, /^DATA\/HORA DO FATO/i, dFrom, dTo);

  const envolvidosRange = sectionRange(rows, /^QUALIFICA.{1,3}O DOS ENVOLVIDOS/i);
  const envolvidosMap = new Map<number, BoEnvolvido>();
  blocks(rows, envolvidosRange, /^ENVOLVIDO\s+\d+/i).forEach((block) => {
    const existing: BoEnvolvido = envolvidosMap.get(block.numero) || {
      numero: block.numero, tipo: "", nome: "", natureza: "", sexo: "", nascimento: "", naturalidade: "", mae: "", pai: "",
      rg: "", cpf: "", endereco: "", numeroEndereco: "", bairro: "", municipio: "", uf: "",
    };
    const f = (label: RegExp) => field(rows, label, block.from, block.to);
    existing.tipo ||= f(/^TIPO ENVOLVIMENTO/i);
    existing.nome ||= f(/^NOME COMPLETO/i);
    existing.natureza ||= f(/^DESCRI.{1,3}O NATUREZA/i);
    existing.sexo ||= f(/^SEXO$/i);
    existing.nascimento ||= brDateToIso(f(/^DATA NASCIMENTO/i));
    existing.naturalidade ||= f(/^NATURALIDADE/i);
    existing.mae ||= f(/^M.E$/i);
    existing.pai ||= f(/^PAI$/i);
    existing.rg ||= f(/^N.MERO DOCUMENTO IDENTIDADE/i);
    existing.cpf ||= f(/^CPF/i);
    existing.endereco ||= f(/^ENDERE.O \(AV/i).replace(/\s+/g, " ");
    existing.numeroEndereco ||= f(/^N.MERO$/i);
    existing.bairro ||= f(/^BAIRRO$/i);
    existing.municipio ||= f(/^MUNIC.PIO$/i);
    existing.uf ||= f(/^UF$/i);
    envolvidosMap.set(block.numero, existing);
  });
  // Envolvidos com o mesmo número em folhas diferentes aparecem como continuação.
  const envolvidos = [...envolvidosMap.values()].filter((e) => e.nome || e.tipo).sort((a, b) => a.numero - b.numero);

  const materiaisRange = sectionRange(rows, /^MATERIAIS/i);
  const materiais = blocks(rows, materiaisRange, /^MATERIAL\s+\d+/i).map((block) => ({
    objeto: field(rows, /^OBJETO/i, block.from, block.to),
    quantidade: field(rows, /^QUANTIDADE/i, block.from, block.to),
    situacao: field(rows, /^SITUA.{1,3}O/i, block.from, block.to),
    info: field(rows, /^INFORMA.{1,4}ES COMPLEMENTARES/i, block.from, block.to),
  })).filter((m) => m.objeto);

  const militaresRange = sectionRange(rows, /^MILITARES\/POLICIAIS INTEGRANTES/i);
  const militares = blocks(rows, militaresRange, /^MILITAR\/POLICIAL INTEGRANTE/i).map((block) => ({
    nome: field(rows, /^NOME COMPLETO/i, block.from, block.to),
    cargo: field(rows, /^CARGO/i, block.from, block.to),
    matricula: field(rows, /^MATR.CULA/i, block.from, block.to),
    unidade: field(rows, /^UNIDADE/i, block.from, block.to),
  })).filter((m) => m.nome);

  const historico = parseHistorico(rows, sectionRange(rows, /^HIST.RICO DA OCORR/i));
  const textoCompleto = rows.map((row) => row.text).join("\n");
  // Coordenadas do local do fato (campos LATITUDE/LONGITUDE do REDS, em graus/min/seg).
  const coords = coordsFromRedsText(textoCompleto);

  return {
    numero,
    dataRegistro: brDateToIso(registro),
    horaRegistro: extractTime(registro),
    dataFato: brDateToIso(fato),
    horaFato: extractTime(fato),
    natureza: field(rows, /^PROV.VEL DESCRI/i, dFrom, dTo),
    tentadoConsumado: field(rows, /^TENTADO \/ CONSUMADO/i, dFrom, dTo),
    alvoEvento: field(rows, /^ALVO DO EVENTO/i, dFrom, dTo),
    unidade: field(rows, /^UNIDADE RESPONS.VEL PELO REGISTRO/i),
    municipio: field(rows, /^MUNIC.PIO/i, 0, findRowIndex(rows, /^ORIGEM DA COMUNICA/i) + 1 || rows.length),
    local: {
      logradouro: field(rows, /^LOCAL \(AV/i, dFrom, dTo),
      numero: field(rows, /^N.MERO$/i, dFrom, dTo),
      bairro: field(rows, /^BAIRRO/i, dFrom, dTo),
      municipio: field(rows, /^MUNIC.PIO/i, findRowIndex(rows, /^LOCAL \(AV/i, dFrom, dTo), dTo),
      uf: field(rows, /^UF$/i, findRowIndex(rows, /^LOCAL \(AV/i, dFrom, dTo), dTo),
      descricao: field(rows, /^DESCRI.{1,3}O DO LUGAR/i, dFrom, dTo),
      ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
    },
    meioUtilizado: field(rows, /^DESCRI.{1,3}O OUTRO MEIO/i, dFrom, dTo) || field(rows, /^MEIO UTILIZADO/i, dFrom, dTo),
    causaPresumida: field(rows, /^CAUSA PRESUMIDA/i, dFrom, dTo),
    envolvidos,
    materiais,
    militares,
    historico,
    textoCompleto,
  };
}

/** Dados do fato para o mapa criminal (coordenadas do REDS, endereço, hora e natureza). */
export function boletimGeo(bo: Boletim) {
  const place = [[bo.local.logradouro, bo.local.numero].filter(Boolean).join(", "), bo.local.bairro, [bo.local.municipio || bo.municipio, bo.local.uf].filter(Boolean).join("/")].filter(Boolean).join(" — ");
  const has = typeof bo.local.lat === "number" && typeof bo.local.lng === "number";
  return {
    lat: has ? bo.local.lat! : null, lng: has ? bo.local.lng! : null, geoSource: has ? "REDS" : "",
    place, eventTime: bo.horaFato || "", crime: naturezaCurta(bo.natureza),
  };
}

export function isBoletim(bo: Boletim) {
  return Boolean(bo.numero || bo.natureza || bo.historico);
}

function formatBr(iso: string) {
  return iso ? iso.split("-").reverse().join("/") : "";
}

/** Natureza sem o código: "C01155 - FURTO" -> "FURTO". */
export function naturezaCurta(natureza = "") {
  return natureza.replace(/^[A-Z]\d{4,6}\s*-\s*/i, "").trim() || natureza;
}

export function boletimTitle(bo: Boletim) {
  const nat = naturezaCurta(bo.natureza);
  return [bo.numero ? `REDS ${bo.numero}` : "Boletim de ocorrência", nat].filter(Boolean).join(" — ");
}

export function boletimNotes(bo: Boletim) {
  const local = [
    [bo.local.logradouro, bo.local.numero].filter(Boolean).join(", "),
    bo.local.bairro,
    [bo.local.municipio, bo.local.uf].filter(Boolean).join("/"),
  ].filter(Boolean).join(" - ");

  const lines = [
    bo.numero && `REDS: ${bo.numero}`,
    bo.natureza && `Natureza: ${bo.natureza}${bo.tentadoConsumado ? ` (${bo.tentadoConsumado})` : ""}`,
    bo.dataFato && `Fato: ${formatBr(bo.dataFato)}${bo.horaFato ? ` ${bo.horaFato}` : ""}`,
    bo.dataRegistro && `Registro: ${formatBr(bo.dataRegistro)}${bo.horaRegistro ? ` ${bo.horaRegistro}` : ""}`,
    local && `Local: ${local}${bo.local.descricao ? ` (${bo.local.descricao})` : ""}`,
    bo.unidade && `Unidade: ${bo.unidade}`,
    bo.meioUtilizado && `Meio utilizado: ${bo.meioUtilizado}`,
  ].filter(Boolean);

  if (bo.envolvidos.length) {
    lines.push("", "Envolvidos:");
    bo.envolvidos.forEach((e) => lines.push(`- ${e.tipo || "ENVOLVIDO"}: ${e.nome || "não informado"}`));
  }
  if (bo.materiais.length) {
    lines.push("", "Materiais:");
    bo.materiais.forEach((m) => lines.push(`- ${m.objeto}${m.quantidade ? ` (${m.quantidade})` : ""}${m.situacao ? ` - ${m.situacao}` : ""}`));
  }
  if (bo.militares.length) {
    lines.push("", "Guarnição:");
    bo.militares.forEach((m) => lines.push(`- ${[m.cargo, m.nome].filter(Boolean).join(" ")}${m.matricula ? ` (${m.matricula})` : ""}`));
  }
  if (bo.historico) lines.push("", "Histórico:", bo.historico);
  return lines.join("\n");
}
