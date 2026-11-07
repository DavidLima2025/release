import type { Author } from "./domain";

/** Liga o nome de um arquivo de foto ao alvo cadastrado. */

const STOP = new Set(["DE", "DA", "DO", "DAS", "DOS", "E", "D"]);

export const normName = (t: string) =>
  (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

const tokens = (t: string) => normName(t).split(" ").filter((w) => w && !STOP.has(w) && !/^\d+$/.test(w));

export type ParsedFileName = { name: string; alias: string; digits: string; display: string; displayAlias: string };

/**
 * "joao_da_silva vulgo Pezão (2).jpg" → nome "JOAO DA SILVA", vulgo "PEZAO".
 * Aceita "_", "-", "." como espaço, vulgo entre aspas/parênteses ou após "vulgo"/"vlg",
 * e ignora numeração de cópia, "foto", "img", datas etc.
 */
export function parseFileName(fileName: string): ParsedFileName {
  let base = fileName.split(/[\\/]/).pop() || fileName;
  base = base.replace(/\.[a-z0-9]{2,5}$/i, "");
  const digitRuns = (base.match(/\d[\d.\-/]{5,}\d/g) || []).map((d) => d.replace(/\D/g, "")).filter((d) => d.length >= 6);

  let alias = "";
  const quoted = base.match(/["“”'‘’]([^"“”'‘’]+)["“”'‘’]/);
  const vulgo = base.match(/\b(?:vulgo|vulg|vlg|vg|v\.)\s*[:\-_. ]?\s*(.+)$/i);
  if (vulgo) { alias = vulgo[1]; base = base.slice(0, vulgo.index); }
  else if (quoted) { alias = quoted[1]; base = base.replace(quoted[0], " "); }
  else {
    const paren = base.match(/\(([^)]*[A-Za-zÀ-ú][^)]*)\)/);
    if (paren) { alias = paren[1]; base = base.replace(paren[0], " "); }
  }

  let name = base
    .replace(/\(\d+\)/g, " ")
    .replace(/[_.\-–—+]+/g, " ")
    .replace(/\b(foto|fotos|img|image|imagem|whatsapp|wa\d*|screenshot|captura|perfil|alvo|autor|copia|cópia|copy|final|frente|rosto)\b/gi, " ")
    .replace(/\d+/g, " ");
  const clean = (t: string) => t.replace(/[^\p{L}\p{N} ]+/gu, " ").replace(/\s+/g, " ").trim().toLocaleUpperCase("pt-BR");
  const display = clean(name);
  const displayAlias = clean(alias.replace(/[_.\-–—]+/g, " ").replace(/\d+/g, " "));
  return { name: normName(display), alias: normName(displayAlias), digits: digitRuns.join(" "), display, displayAlias };
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

