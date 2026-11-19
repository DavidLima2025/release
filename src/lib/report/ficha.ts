// Ficha individual do alvo (A4, uso reservado), gerada no navegador com pdf-lib.
import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb } from "pdf-lib";
import type { ReportImage } from "./model";

export type FichaInput = {
  name: string; alias: string; status: string; riskLevel: string; folder: string;
  birthDate: string; motherName: string; fatherName: string; document: string;
  address: string; neighborhood: string; city: string; home?: string;
  crimes: string; notes: string;
  photo?: ReportImage; extraPhotos: ReportImage[]; logo?: ReportImage;
  investigations: { code: string; title: string; role: string }[];
  occurrences: { date: string; time: string; crime: string; reference: string; place: string; inv: string }[];
  attachments: string[];
  extra?: { label: string; value: string }[];
  occurrencePhotos?: { img: ReportImage; caption: string }[];
  surveyPhotos?: { img: ReportImage; caption: string }[];
  companions?: { name: string; alias: string; together: string; reds: string }[];
  generatedBy: string; generatedAt: string;
};

const W = 595.28;
const H = 841.89;
const M = 42;
const CW = W - 2 * M;
const BLACK = rgb(0.043, 0.043, 0.047);
const INK = rgb(0.137, 0.122, 0.125);
const MUTED = rgb(0.42, 0.4, 0.35);
const GOLD = rgb(0.608, 0.541, 0.361);
const CREAM = rgb(0.953, 0.941, 0.906);
const LINE = rgb(0.86, 0.84, 0.79);
const RED = rgb(0.72, 0.1, 0.1);
const WHITE = rgb(1, 1, 1);

const WIN_ANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
const clean = (t: string) => String(t ?? "").replace(/\t/g, " ").replace(/[‐-‒]/g, "-").replace(/→/g, "->")
  .replace(/[^\n\x20-\x7E\xA0-\xFF]/g, (c) => (WIN_ANSI_EXTRA.includes(c) ? c : "?"));
const br = (iso: string) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10).split("-").reverse().join("/") : iso || "");

function age(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return "";
  const b = new Date(`${iso.slice(0, 10)}T12:00:00`); const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a -= 1;
  return a >= 0 && a < 120 ? `${a} anos` : "";
}

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const out: string[] = [];
  for (const para of clean(text).split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) { line = next; continue; }
      if (line) out.push(line);
      // Palavra maior que a linha: quebra à força.
      let w = word;
      while (font.widthOfTextAtSize(w, size) > width) {
        let i = w.length;
        while (i > 1 && font.widthOfTextAtSize(w.slice(0, i), size) > width) i -= 1;
        out.push(w.slice(0, i)); w = w.slice(i);
      }
      line = w;
    }
    out.push(line);
  }
  return out;
}

export async function renderFicha(input: FichaInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(clean(`Ficha de alvo — ${input.name}`));
  doc.setSubject("RESERVADO");
  doc.setProducer("SI 6ª CIA");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const embed = async (img?: ReportImage) => (img ? (img.type === "png" ? doc.embedPng(img.bytes) : doc.embedJpg(img.bytes)) : undefined);
  const logo = await embed(input.logo);
  const photo = await embed(input.photo);
  const extras: PDFImage[] = [];
  for (const p of input.extraPhotos.slice(0, 4)) { const e = await embed(p); if (e) extras.push(e); }

  const pages: PDFPage[] = [];
  let page!: PDFPage;
  let y = 0;
  const text = (t: string, x: number, yy: number, size: number, font = regular, color = INK) => page.drawText(clean(t), { x, y: yy, size, font, color });

  const header = (first: boolean) => {
    page = doc.addPage([W, H]);
    pages.push(page);
    page.drawRectangle({ x: 0, y: H - (first ? 86 : 44), width: W, height: first ? 86 : 44, color: BLACK });
    page.drawRectangle({ x: 0, y: H - (first ? 89 : 47), width: W, height: 3, color: GOLD });
    if (first) {
      if (logo) { const h = 62; page.drawImage(logo, { x: M, y: H - 76, width: (logo.width / logo.height) * h, height: h }); }
      text("POLÍCIA MILITAR DE MINAS GERAIS", M + 62, H - 32, 9, bold, GOLD);
      text("SEÇÃO DE INTELIGÊNCIA · 6ª CIA · 1º BPM", M + 62, H - 45, 8, regular, WHITE);
      text("FICHA DE ALVO", M + 62, H - 68, 20, bold, WHITE);
      const tag = "RESERVADO";
      const tw = bold.widthOfTextAtSize(tag, 11);
      page.drawRectangle({ x: W - M - tw - 16, y: H - 60, width: tw + 16, height: 22, color: RED });
      text(tag, W - M - tw - 8, H - 53, 11, bold, WHITE);
      y = H - 112;
    } else {
      text(`FICHA DE ALVO — ${input.name}`, M, H - 28, 10, bold, WHITE);
      text("RESERVADO", W - M - bold.widthOfTextAtSize("RESERVADO", 10), H - 28, 10, bold, rgb(1, 0.55, 0.55));
      y = H - 70;
    }
  };
  const ensure = (need: number) => { if (y - need < 60) header(false); };
  const section = (title: string) => {
    ensure(40);
    y -= 8;
    page.drawRectangle({ x: M, y: y - 4, width: 3, height: 14, color: GOLD });
    text(title.toUpperCase(), M + 9, y, 10, bold, BLACK);
    y -= 8;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: LINE });
    y -= 14;
  };
  const paragraph = (t: string, size = 10, font = regular, color = INK) => {
    for (const line of wrap(t, font, size, CW)) { ensure(size + 4); text(line, M, y, size, font, color); y -= size + 4; }
  };

  header(true);

  // Bloco de identificação: foto + nome.
  const photoW = 128; const photoH = 170;
  const top = y;
  page.drawRectangle({ x: M, y: top - photoH, width: photoW, height: photoH, color: CREAM, borderColor: LINE, borderWidth: 0.8 });
  if (photo) {
    // A foto chega recortada em 3:4 (ver loadFichaPhoto); aqui só ajusta dentro da moldura.
    const s = Math.min(photoW / photo.width, photoH / photo.height);
    const w = photo.width * s; const h = photo.height * s;
    page.drawImage(photo, { x: M + (photoW - w) / 2, y: top - photoH + (photoH - h) / 2, width: w, height: h });
  } else {
    text("SEM FOTO", M + 38, top - photoH / 2, 9, bold, MUTED);
  }
  const x0 = M + photoW + 18; const colW = W - M - x0;
  let ty = top - 6;
  for (const line of wrap(input.name.toUpperCase(), bold, 17, colW)) { text(line, x0, ty - 12, 17, bold, BLACK); ty -= 21; }
  ty -= 4;
  text(input.alias ? `Vulgo: "${input.alias}"` : "Vulgo: não informado", x0, ty - 8, 11, input.alias ? bold : regular, input.alias ? INK : MUTED);
  ty -= 24;
  const chips = [input.status, input.riskLevel && `Risco ${input.riskLevel.toLowerCase()}`, input.folder].filter(Boolean) as string[];
  let cx = x0;
  for (const c of chips) {
    const tw = bold.widthOfTextAtSize(clean(c.toUpperCase()), 8);
    page.drawRectangle({ x: cx, y: ty - 4, width: tw + 12, height: 15, color: c.startsWith("Risco alto") ? RED : CREAM, borderColor: LINE, borderWidth: 0.5 });
    text(c.toUpperCase(), cx + 6, ty, 8, bold, c.startsWith("Risco alto") ? WHITE : INK);
    cx += tw + 18;
  }
  ty -= 26;
  const field = (label: string, value: string, x: number, width: number) => {
    text(label.toUpperCase(), x, ty, 7, bold, MUTED);
    const lines = wrap(value || "—", regular, 10, width);
    lines.slice(0, 3).forEach((l, i) => text(l, x, ty - 12 - i * 12, 10, regular, INK));
    return 14 + Math.min(3, lines.length) * 12;
  };
  const half = (colW - 12) / 2;
  let h1 = Math.max(field("Nascimento", [br(input.birthDate), age(input.birthDate) && `(${age(input.birthDate)})`].filter(Boolean).join(" "), x0, half), field("Documentos", input.document, x0 + half + 12, half));
  ty -= h1 + 4;
  h1 = Math.max(field("Mãe", input.motherName, x0, half), field("Pai", input.fatherName, x0 + half + 12, half));
  ty -= h1 + 4;
  y = Math.min(ty, top - photoH - 16);

  section("Endereço");
  paragraph([input.address, input.neighborhood, input.city].filter(Boolean).join(" — ") || "Não informado.");
  if (input.home) paragraph(`Residência no mapa: ${input.home}`, 9, regular, MUTED);

  section("Crimes / modus operandi");
  paragraph(input.crimes || "Não informado.");

  if (input.extra?.length) {
    section("Dados adicionais");
    for (const e of input.extra) { paragraph(e.label.toUpperCase(), 7.5, bold, MUTED); paragraph(e.value); y -= 3; }
  }
  if (input.notes.trim()) { section("Observações e vínculos"); paragraph(input.notes); }

  if (input.investigations.length) {
    section("Investigações");
    for (const inv of input.investigations) paragraph(`${inv.code} — ${inv.title} (papel: ${inv.role})`);
  }

  if (input.companions?.length) {
    section(`Envolvidos juntos (${input.companions.length})`);
    for (const c of input.companions) {
      paragraph(`${c.name}${c.alias ? ` ("${c.alias}")` : ""} — ${c.together}`, 10, bold);
      paragraph(`REDS: ${c.reds}`, 9, regular, MUTED);
      y -= 2;
    }
  }

  if (input.occurrences.length) {
    section(`Histórico de BOs (${input.occurrences.length})${input.occurrences.length >= 3 ? " — reincidente" : ""}`);
    const cols = [62, 34, 118, 0];
    cols[3] = CW - cols[0] - cols[1] - cols[2];
    const head = ["DATA", "HORA", "NATUREZA / REDS", "LOCAL"];
    ensure(20);
    page.drawRectangle({ x: M, y: y - 5, width: CW, height: 16, color: BLACK });
    let hx = M + 4; head.forEach((h, i) => { text(h, hx, y, 7.5, bold, WHITE); hx += cols[i]; });
    y -= 18;
    input.occurrences.forEach((o, idx) => {
      const cells = [br(o.date), o.time, [o.crime, o.reference && `REDS ${o.reference}`].filter(Boolean).join("\n"), [o.place, o.inv].filter(Boolean).join("\n")];
      const wrapped = cells.map((c, i) => wrap(c || "—", regular, 8.5, cols[i] - 8));
      const rows = Math.max(...wrapped.map((w) => w.length));
      const hRow = rows * 11 + 6;
      ensure(hRow + 4);
      if (idx % 2 === 0) page.drawRectangle({ x: M, y: y - hRow + 9, width: CW, height: hRow, color: CREAM });
      let x = M + 4;
      wrapped.forEach((lines, i) => { lines.forEach((l, j) => text(l, x, y - j * 11, 8.5, i === 2 && j === 0 ? bold : regular)); x += cols[i]; });
      y -= hRow;
    });
    y -= 4;
  }

  if (extras.length) {
    section("Outras fotos do alvo");
    const tw = (CW - 3 * 10) / 4; const th = tw * 1.3;
    ensure(th + 8);
    extras.forEach((img, i) => {
      const s = Math.min(tw / img.width, th / img.height);
      const w = img.width * s; const h = img.height * s;
      const x = M + i * (tw + 10);
      page.drawRectangle({ x, y: y - th, width: tw, height: th, color: CREAM });
      page.drawImage(img, { x: x + (tw - w) / 2, y: y - th + (th - h) / 2, width: w, height: h });
    });
    y -= th + 10;
  }

  // Galerias: fotos de ocorrências e de levantamentos de inteligência (com legenda).
  for (const [title, list] of [["Fotos de ocorrências", input.occurrencePhotos], ["Levantamentos de inteligência", input.surveyPhotos]] as const) {
    if (!list?.length) continue;
    section(`${title} (${list.length})`);
    const embedded: { img: PDFImage; caption: string }[] = [];
    for (const p of list) embedded.push({ img: p.img.type === "png" ? await doc.embedPng(p.img.bytes) : await doc.embedJpg(p.img.bytes), caption: p.caption });
    const cols = 3; const gap = 10; const tw = (CW - gap * (cols - 1)) / cols; const th = tw * 0.75;
    for (let i = 0; i < embedded.length; i += cols) {
      const row = embedded.slice(i, i + cols);
      const capLines = Math.max(...row.map((r) => Math.min(2, wrap(r.caption, regular, 7.5, tw).length)));
      ensure(th + capLines * 9 + 10);
      row.forEach(({ img, caption }, j) => {
        const x = M + j * (tw + gap);
        const s = Math.min(tw / img.width, th / img.height);
        page.drawRectangle({ x, y: y - th, width: tw, height: th, color: CREAM });
        page.drawImage(img, { x: x + (tw - img.width * s) / 2, y: y - th + (th - img.height * s) / 2, width: img.width * s, height: img.height * s });
        wrap(caption, regular, 7.5, tw).slice(0, 2).forEach((l, k) => text(l, x, y - th - 9 - k * 9, 7.5, regular, MUTED));
      });
      y -= th + capLines * 9 + 14;
    }
  }

  if (input.attachments.length) {
    section("Documentos anexados ao card");
    for (const a of input.attachments.slice(0, 25)) paragraph(`• ${a}`, 9);
  }

  // Rodapé e numeração.
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: 40 }, end: { x: W - M, y: 40 }, thickness: 0.6, color: LINE });
    p.drawText(clean(`Gerada em ${input.generatedAt} por ${input.generatedBy || "—"} · Difusão restrita — documento de uso exclusivo da atividade de inteligência.`), { x: M, y: 28, size: 7, font: regular, color: MUTED });
    const n = `${i + 1}/${pages.length}`;
    p.drawText(n, { x: W - M - regular.widthOfTextAtSize(n, 8), y: 28, size: 8, font: bold, color: MUTED });
  });
  return doc.save();
}
