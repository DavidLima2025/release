import type { Author } from "./domain";

/** Liga o nome de um arquivo de foto ao alvo cadastrado. */

const STOP = new Set(["DE", "DA", "DO", "DAS", "DOS", "E", "D"]);

export const normName = (t: string) =>
  (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

const tokens = (t: string) => normName(t).split(" ").filter((w) => w && !STOP.has(w) && !/^\d+$/.test(w));

export type ParsedFileName = {
  name: string; alias: string; digits: string; display: string; displayAlias: string;
  /** Dados extras escritos no nome do arquivo (para preencher o card novo). */
  document: string; address: string; extra: string;
};

const DOC_WORD = /\b(RG|R\.G\.?|CPF|C\.P\.F\.?|CNH|SSP(?:\s*MG)?|IDENTIDADE|DOC(?:UMENTO)?|MG)\b/i;
const ADDRESS_WORD = /\b(RUA|R\.|AV|AV\.|AVENIDA|ALAMEDA|TRAVESSA|TV\.|PRA[ÇC]A|RODOVIA|ESTRADA|BECO|BAIRRO|VILA|CONDOM[IÍ]NIO)\b/i;
const JUNK = /\b(foto|fotos|img|image|imagem|whatsapp|wa\d*|screenshot|captura|perfil|alvo|autor|copia|cópia|copy|final|frente|rosto|nome)\b/gi;

const cpfMask = (d: string) => `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
const upper = (t: string) => t.replace(/[^\p{L}\p{N} ,.\-/º°]+/gu, " ").replace(/\s+/g, " ").trim().toLocaleUpperCase("pt-BR");

/**
 * Lê o nome do arquivo da foto. Exemplos:
 *  "(BIJU) Bruno Davi Silva dos Anjos RG 17839053.jpeg" → nome BRUNO DAVI SILVA DOS ANJOS, vulgo BIJU, RG 17839053
 *  "Fulano CPF 08745484627 RG 14426650 Rua X, 213, Bairro Y.jpg" → nome FULANO, documentos e endereço separados
 *  "joao_da_silva vulgo Pezão (2).jpg" → nome JOAO DA SILVA, vulgo PEZAO
 * O nome termina no primeiro RG/CPF/MG, número ou palavra de endereço; o que sobra vira observação.
 */
export function parseFileName(fileName: string): ParsedFileName {
  let base = fileName.split(/[\\/]/).pop() || fileName;
  base = base.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/_/g, " ").replace(/\s+/g, " ").trim();
  base = base.replace(/\(\d+\)/g, " ");   // "(2)" de cópia
  base = base.replace(/^\s*nome\s*[:\-]?\s*/i, "");

  // Vulgo: (APELIDO), "APELIDO", vulgo APELIDO
  let alias = "";
  const vulgo = base.match(/\b(?:vulgo|vulg|vlg|vg)\b\.?\s*[:\-]?\s*([^\d,()]+?)(?=\s*(?:\b(?:RG|CPF|CNH|MG)\b|\d|\(|,|$))/i);
  if (vulgo) { alias = vulgo[1]; base = base.replace(vulgo[0], " "); }
  else {
    const quoted = base.match(/["“”'‘’]([^"“”'‘’]+)["“”'‘’]/);
    const paren = base.match(/\(([^)]*[A-Za-zÀ-ú][^)]*)\)/);
    if (quoted) { alias = quoted[1]; base = base.replace(quoted[0], " "); }
    else if (paren) { alias = paren[1]; base = base.replace(paren[0], " "); }
  }

  // Nome = trecho antes do primeiro rótulo de documento, número, vírgula ou palavra de endereço.
  const cut = [base.search(DOC_WORD), base.search(/\d/), base.search(ADDRESS_WORD), base.search(/,/)].filter((n) => n > 0);
  const end = cut.length ? Math.min(...cut) : base.length;
  const rawName = base.slice(0, end);
  let tail = base.slice(end);

  // Documentos (no restante do nome do arquivo).
  const docs: string[] = [];
  const cpf = tail.match(/\bC\.?P\.?F\.?\s*[:\-nº°]*\s*([\d.\-]{6,15}\d)/i);
  if (cpf) { const d = cpf[1].replace(/\D/g, ""); docs.push(`CPF ${d.length === 11 ? cpfMask(d) : d}`); tail = tail.replace(cpf[0], " "); }
  const rg = tail.match(/\b(?:R\.?G\.?|IDENTIDADE)\s*[:\-nº°]*\s*(?:(MG|SP|RJ|ES|BA|GO|DF)\s*[:\-]?\s*)?([A-Z]{0,2}\s*-?\s*[\d.\-]{5,14}[\dXx])/i)
    || tail.match(/\b(MG)\s*[:\-]?\s*([\d.\-]{6,13}\d)/i);
  if (rg) { docs.push(`RG ${rg[1] ? `${rg[1].toUpperCase()}-` : ""}${rg[2].replace(/[^\dA-Za-z]/g, "").toUpperCase()}`); tail = tail.replace(rg[0], " "); }
  // Números soltos (podem vir separados por espaço): 11 dígitos = CPF; 7 a 10 = RG.
  for (const m of tail.match(/\d[\d.\- ]{5,16}\d/g) || []) {
    const d = m.replace(/\D/g, "");
    if (d.length === 11 && !docs.some((x) => x.startsWith("CPF"))) { docs.push(`CPF ${cpfMask(d)}`); tail = tail.replace(m, " "); }
    else if (d.length >= 7 && d.length <= 10 && !docs.some((x) => x.startsWith("RG"))) { docs.push(`RG ${d}`); tail = tail.replace(m, " "); }
  }
  const digitRuns = docs.map((x) => x.replace(/\D/g, "")).filter((d) => d.length >= 6);

  // Endereço: da palavra-chave até o fim.
  let address = "";
  const addrAt = tail.search(ADDRESS_WORD);
  if (addrAt >= 0) { address = tail.slice(addrAt); tail = tail.slice(0, addrAt); }
  const extra = upper(tail.replace(new RegExp(DOC_WORD.source, "gi"), " ").replace(/[-:,.]+/g, " ").replace(/\d+/g, " ").replace(/(^|\s)\p{L}(?=\s|$)/gu, " "));

  const display = upper(rawName.replace(/[.\-–—+]+/g, " ").replace(JUNK, " ").replace(/\d+/g, " ")).replace(/[,.\-/º°]/g, " ").replace(/\s+/g, " ").trim();
  const displayAlias = upper(alias.replace(/[_.\-–—]+/g, " ").replace(/\d+/g, " ")).replace(/[,./º°]/g, " ").replace(/\s+/g, " ").trim();
  return {
    name: normName(display), alias: normName(displayAlias), digits: digitRuns.join(" "), display, displayAlias,
    document: docs.join(" · "), address: upper(address).replace(/\s+,/g, ","), extra: extra.length > 2 ? extra : "",
  };
}

export type Candidate = { author: Author; score: number; why: string };

/** Pontua cada alvo: 100 nome idêntico ou documento; 85/75 nome contido; 70 vulgo; 60 primeiro + último nome. */
export function scoreAuthors(parsed: ParsedFileName, authors: Author[]): Candidate[] {
  const fileTokens = tokens(parsed.name);
  const fileSet = new Set(fileTokens);
  const out: Candidate[] = [];
  for (const author of authors) {
    let score = 0;
    let why = "";
    const docDigits = (author.document || "").replace(/\D/g, "");
    const nameTokens = tokens(author.name);
    const aliasNorm = normName(author.alias);
    if (parsed.digits && docDigits && parsed.digits.split(" ").some((d) => docDigits.includes(d))) { score = 100; why = "Documento no nome do arquivo"; }
    else if (fileTokens.length && fileTokens.join(" ") === nameTokens.join(" ")) { score = 100; why = "Nome idêntico"; }
    else if (fileTokens.length >= 2 && nameTokens.length && fileTokens[0] === nameTokens[0] && fileTokens.every((w) => nameTokens.includes(w))) { score = 85; why = "Nome abreviado"; }
    else if (nameTokens.length >= 2 && fileTokens.length && nameTokens[0] === fileTokens[0] && nameTokens.every((w) => fileSet.has(w))) { score = 75; why = "Nome do arquivo mais completo"; }
    else if (aliasNorm && (aliasNorm === parsed.alias || aliasNorm === normName(parsed.name))) { score = 70; why = "Vulgo"; }
    else if (fileTokens.length >= 2 && nameTokens.length >= 2 && fileTokens[0] === nameTokens[0] && fileTokens[fileTokens.length - 1] === nameTokens[nameTokens.length - 1]) { score = 60; why = "Primeiro e último nome"; }
    if (score >= 60 && why !== "Vulgo" && parsed.alias && aliasNorm && aliasNorm === parsed.alias && score < 100) { score += 10; why += " + vulgo"; }
    if (score) out.push({ author, score, why });
  }
  return out.sort((a, b) => b.score - a.score || a.author.name.localeCompare(b.author.name));
}

export type MatchResult = { status: "found" | "ambiguous" | "none"; candidates: Candidate[]; best?: Author };

/** Só vincula sozinho quando há um único candidato forte; empate ou semelhança fraca vai para conferência. */
export function matchFile(fileName: string, authors: Author[]): MatchResult & { parsed: ParsedFileName } {
  const parsed = parseFileName(fileName);
  const candidates = scoreAuthors(parsed, authors);
  if (!candidates.length) return { parsed, status: "none", candidates };
  const [first, second] = candidates;
  if (first.score >= 80 && (!second || second.score < first.score)) return { parsed, status: "found", candidates, best: first.author };
  return { parsed, status: "ambiguous", candidates };
}

