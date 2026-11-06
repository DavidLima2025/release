// Conversão do JSON exportado do Trello em cards do Banco de Alvos.

function cleanText(text = "") {
  return String(text || "").replace(/[•●]/g, "").replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
}

function firstLine(text = "") {
  return cleanText(text).split("\n").map((line) => line.trim()).filter(Boolean)[0] || "";
}

function extractField(text = "", labels: string[] = []) {
  const normalized = cleanText(text);
  for (const label of labels) {
    const match = normalized.match(new RegExp(`${label}\\s*[:：-]?\\s*([^\\n]+)`, "i"));
    if (match?.[1]) return match[1].trim().replace(/^[-:]+/, "").trim();
  }
  return "";
}

function extractDocument(text = "") {
  const normalized = cleanText(text);
  const explicit = normalized.match(/(?:RG|CPF|DOCUMENTO)\s*[:：-]?\s*([A-Z]{0,3}\s*-?\s*[0-9.\-/]{6,})/i);
  if (explicit?.[1]) return explicit[1].replace(/\s+/g, " ").trim();
  return normalized.match(/\b\d{7,11}\b/)?.[0] || "";
}

function normalizeSuspectName(raw = "") {
  let text = cleanText(raw);
  text = text.replace(/NOME\s*[:：-]?/i, "");
  text = text.replace(/(?:RG|CPF|DOCUMENTO)\s*[:：-]?.*$/i, "");
  text = text.replace(/\b\d{7,11}\b/g, "");
  text = text.replace(/[-–—]+$/g, "").trim();
  return text || "Autor sem nome";
}

export function parseTrelloAuthor(listName = "", cards: any[] = []) {
  const cardTexts = cards.map((card) => [card?.name, card?.desc].filter(Boolean).join("\n")).filter(Boolean);
  const merged = [listName, ...cardTexts].join("\n");
  const nameBase = extractField(merged, ["NOME"]) || firstLine(listName) || firstLine(merged);
  const alias = extractField(merged, ["VULGO", "ALCUNHA"]);
  const crimes = extractField(merged, ["FUNÇÃO", "FUNCAO", "CRIME", "CRIMES", "MODUS OPERANDI"]);
  // Linhas vazias como "VULGO:" seguidas de "FUNÇÃO: ..." faziam o vulgo receber a função.
  const aliasIsField = /^(FUN[CÇ][AÃ]O|CRIME|RG|CPF)\b/i.test(alias);
  return {
    name: normalizeSuspectName(nameBase),
    alias: aliasIsField || /^(nao|não|n[aã]o tem|sem|informado|não informado)$/i.test(alias) ? "" : alias,
    document: extractDocument(merged),
    crimes: crimes || "",
    notes: cards.map((card) => cleanText(card?.desc || "")).filter(Boolean).join("\n\n"),
    status: "Suspeito",
    riskLevel: "Médio",
  };
}

export function isImageAttachment(attachment: any) {
  const name = String(attachment?.name || attachment?.url || "").toLowerCase();
  return /\.(png|jpe?g|webp|gif|bmp)$/i.test(name) || String(attachment?.mimeType || "").startsWith("image/");
}

export function trelloAttachmentUrl(attachment: any) {
  return attachment?.url || attachment?.previewUrl2x || attachment?.previewUrl || "";
}
