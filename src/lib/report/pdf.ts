// Relatório em PDF no padrão ABNT (NBR 14724 / NBR 10719):
// A4; margens 3 cm (superior/esquerda) e 2 cm (inferior/direita); fonte 12 com
// espaçamento 1,5 e recuo de 1,25 cm; seções primárias em página própria;
// paginação no canto superior direito a 2 cm da borda, contada desde a folha de rosto
// e impressa a partir da primeira página textual; legendas acima e fontes abaixo
// das ilustrações (fonte 10); referências alinhadas à esquerda em espaço simples.
// A capa segue o modelo visual da PMMG (faixas preta e dourada com o brasão).

import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { layoutOrganogram, ROLE_COLOR } from "../investigation";
import type { Block, ReportModel, ReportPerson, Rich } from "./model";
import { dateBr, linkedSources, sourceShortLabel } from "./model";

const CM = 28.3465;
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M_TOP = 3 * CM;
const M_LEFT = 3 * CM;
const M_BOTTOM = 2 * CM;
const M_RIGHT = 2 * CM;
const CONTENT_W = PAGE_W - M_LEFT - M_RIGHT;
const BODY = 12;
const LEAD = 18; // 1,5
const SMALL = 10;
const SMALL_LEAD = 12; // simples
const INDENT = 1.25 * CM;

const BLACK = rgb(0.043, 0.043, 0.047);
const INK = rgb(0.137, 0.122, 0.125);
const GOLD = rgb(0.608, 0.541, 0.361);
const CREAM = rgb(0.953, 0.941, 0.906);
const GRAY = rgb(0.86, 0.85, 0.82);
const RED = rgb(0.62, 0.11, 0.09);
const WHITE = rgb(1, 1, 1);

const hex = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);

// As fontes padrão do PDF usam WinAnsi: acentos do português estão incluídos; o resto é trocado.
const WIN_ANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
function clean(text: string) {
  return String(text ?? "")
    .replace(/\t/g, " ")
    .replace(/[‐-‒]/g, "-")
    .replace(/→/g, "->")
    .replace(/[^\n\x20-\x7E\xA0-\xFF]/g, (c) => (WIN_ANSI_EXTRA.includes(c) ? c : "?"));
}

type Fonts = { regular: PDFFont; bold: PDFFont; italic: PDFFont; boldItalic: PDFFont };
type Token = { text: string; font: PDFFont; width: number; space: boolean };
type Line = { tokens: Token[]; width: number; last: boolean };

function fontFor(fonts: Fonts, seg: { bold?: boolean; italic?: boolean }) {
  if (seg.bold && seg.italic) return fonts.boldItalic;
  if (seg.bold) return fonts.bold;
  if (seg.italic) return fonts.italic;
  return fonts.regular;
}

function toRich(text: Rich | string): Rich {
  return typeof text === "string" ? [{ text }] : text;
}

/** Quebra texto rico em linhas que cabem em `width`. */
function layoutRich(fonts: Fonts, rich: Rich, size: number, width: number, firstIndent = 0): Line[] {
  const tokens: Token[] = [];
  rich.forEach((seg) => {
    const font = fontFor(fonts, seg);
    clean(seg.text).split(/(\s+)/).forEach((part) => {
      if (!part) return;
      const space = /^\s+$/.test(part);
      tokens.push({ text: space ? " " : part, font, width: font.widthOfTextAtSize(space ? " " : part, size), space });
    });
  });
  const lines: Line[] = [];
  let current: Token[] = [];
  let lineWidth = 0;
  let limit = width - firstIndent;
  const flush = (last: boolean) => {
    while (current.length && current[current.length - 1].space) current.pop();
    lines.push({ tokens: current, width: current.reduce((s, t) => s + t.width, 0), last });
    current = [];
    lineWidth = 0;
    limit = width;
  };
  tokens.forEach((token) => {
    if (token.space && !current.length) return;
    if (!token.space && lineWidth + token.width > limit && current.length) flush(false);
    if (!token.space && token.width > limit) {
      // Palavra maior que a linha (URL longa): quebra por caracteres.
      let chunk = "";
      for (const ch of token.text) {
        const w = token.font.widthOfTextAtSize(chunk + ch, size);
        if (lineWidth + w > limit && chunk) {
          current.push({ ...token, text: chunk, width: token.font.widthOfTextAtSize(chunk, size) });
          flush(false);
          chunk = ch;
        } else chunk += ch;
      }
      token = { ...token, text: chunk, width: token.font.widthOfTextAtSize(chunk, size) };
    }
    current.push(token);
    lineWidth += token.width;
  });
  flush(true);
  return lines;
}

class Writer {
  pages: PDFPage[] = [];
  page!: PDFPage;
  y = 0; // distância a partir do topo
  bodyStart = -1;
  numbered = new Set<number>();

  constructor(public doc: PDFDocument, public fonts: Fonts, public classification: string) {}

  addPage(numbered = true) {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.pages.push(this.page);
    if (numbered) this.numbered.add(this.pages.length - 1);
    this.y = M_TOP;
    return this.page;
  }

  get bottom() { return PAGE_H - M_BOTTOM; }
  fits(h: number) { return this.y + h <= this.bottom; }
  ensure(h: number) { if (!this.fits(h)) this.addPage(); }

  text(str: string, x: number, top: number, size: number, font = this.fonts.regular, color = INK) {
    this.page.drawText(clean(str), { x, y: PAGE_H - top - size * 0.8, size, font, color });
  }

  drawLines(lines: Line[], opts: { x?: number; width?: number; size?: number; lead?: number; justify?: boolean; firstIndent?: number; align?: "left" | "center" } = {}) {
    const x0 = opts.x ?? M_LEFT;
    const width = opts.width ?? CONTENT_W;
    const size = opts.size ?? BODY;
    const lead = opts.lead ?? LEAD;
    lines.forEach((line, index) => {
      this.ensure(lead);
      const indent = index === 0 ? opts.firstIndent || 0 : 0;
      const avail = width - indent;
      const words = line.tokens.filter((t) => !t.space);
      const justify = opts.justify && !line.last && words.length > 1;
      const spaceW = this.fonts.regular.widthOfTextAtSize(" ", size);
      const wordsWidth = words.reduce((s, t) => s + t.width, 0);
      const gap = justify ? (avail - wordsWidth) / (words.length - 1) : spaceW;
      let x = x0 + indent;
      if (opts.align === "center") x = x0 + (width - line.width) / 2;
      const baseline = PAGE_H - this.y - (lead - size) / 2 - size * 0.8;
      if (justify) {
        words.forEach((t) => { this.page.drawText(t.text, { x, y: baseline, size, font: t.font, color: INK }); x += t.width + gap; });
      } else {
        line.tokens.forEach((t) => { if (!t.space) this.page.drawText(t.text, { x, y: baseline, size, font: t.font, color: INK }); x += t.space ? spaceW : t.width; });
      }
      this.y += lead;
    });
  }

  paragraph(text: Rich | string, indent = true) {
    const lines = layoutRich(this.fonts, toRich(text), BODY, CONTENT_W, indent ? INDENT : 0);
    this.drawLines(lines, { justify: true, firstIndent: indent ? INDENT : 0 });
  }

  small(text: string, opts: { x?: number; width?: number; align?: "left" | "center" } = {}) {
    const lines = layoutRich(this.fonts, [{ text }], SMALL, opts.width ?? CONTENT_W);
    this.drawLines(lines, { size: SMALL, lead: SMALL_LEAD, x: opts.x, width: opts.width, align: opts.align });
  }
}

// ---------- Tabelas (quadros) ----------
function measureRow(w: Writer, cells: string[], widths: number[], bold: boolean) {
  const font = bold ? w.fonts.bold : w.fonts.regular;
  const wrapped = cells.map((c, i) => layoutRich(w.fonts, [{ text: c || "—", bold }], SMALL, widths[i] - 8).map((l) => l.tokens.map((t) => t.text).join("")));
  return { wrapped, height: Math.max(...wrapped.map((l) => l.length)) * SMALL_LEAD + 6, font };
}

function drawRow(w: Writer, x: number, widths: number[], row: ReturnType<typeof measureRow>, fill?: ReturnType<typeof rgb>) {
  const top = w.y;
  let cx = x;
  widths.forEach((cw, i) => {
    w.page.drawRectangle({ x: cx, y: PAGE_H - top - row.height, width: cw, height: row.height, borderColor: INK, borderWidth: 0.5, color: fill });
    row.wrapped[i].forEach((line, li) => w.text(line, cx + 4, top + 3 + li * SMALL_LEAD + 1, SMALL, row.font));
    cx += cw;
  });
  w.y += row.height;
}

function table(w: Writer, block: Extract<Block, { type: "table" }>, x = M_LEFT, width = CONTENT_W) {
  const widths = block.widths.map((f) => f * width);
  const header = measureRow(w, block.headers, widths, true);
  const rows = block.rows.map((r) => measureRow(w, r, widths, false));
  w.y += 6;
  w.ensure(SMALL_LEAD * 2 + header.height + (rows[0]?.height || 0));
  w.small(`${block.label} – ${block.caption}`, { x, width });
  drawRow(w, x, widths, header, GRAY);
  rows.forEach((row) => {
    if (!w.fits(row.height + SMALL_LEAD)) { w.addPage(); drawRow(w, x, widths, header, GRAY); }
    drawRow(w, x, widths, row);
  });
  w.y += 2;
  w.small(block.source, { x, width });
  w.y += 6;
}

// ---------- Qualificação do alvo (foto + quadro) ----------
async function person(w: Writer, person: ReportPerson, label: string, images: Map<string, PDFImage>, source: string) {
  const rows: [string, string][] = [
    ["Nome", person.name], ["Vulgo", person.alias], ["Papel no grupo", person.role], ["Superior", person.parentName],
    ["Nascimento", dateBr(person.birthDate)], ["Mãe", person.motherName], ["Documento", person.document],
    ["Endereço", [person.address, person.neighborhood, person.city].filter(Boolean).join(", ")], ["Situação", person.status], ["Crimes / modus operandi", person.crimes],
  ];
  const filled = rows.filter(([, v]) => v);
  const img = images.get(person.authorId);
  const photoW = 3 * CM;
  const photoH = 4 * CM;
  const x = img ? M_LEFT + photoW + 0.4 * CM : M_LEFT;
  const width = img ? CONTENT_W - photoW - 0.4 * CM : CONTENT_W;
  const widths = [0.32 * width, 0.68 * width];
  const measured = filled.map(([k, v]) => {
    const a = measureRow(w, [k], [widths[0]], true);
    const b = measureRow(w, [v], [widths[1]], false);
    return { wrapped: [a.wrapped[0], b.wrapped[0]], height: Math.max(a.height, b.height), font: w.fonts.regular, labelFont: w.fonts.bold };
  });
  const tableH = measured.reduce((s, r) => s + r.height, 0);
  w.y += 6;
  w.ensure(SMALL_LEAD * 3 + Math.max(tableH, img ? photoH : 0));
  w.small(`${label} – Qualificação de ${person.name}`);
  const top = w.y;
  if (img) {
    const scale = Math.min(photoW / img.width, photoH / img.height);
    const iw = img.width * scale;
    const ih = img.height * scale;
    w.page.drawRectangle({ x: M_LEFT, y: PAGE_H - top - photoH, width: photoW, height: photoH, color: CREAM, borderColor: INK, borderWidth: 0.5 });
    w.page.drawImage(img, { x: M_LEFT + (photoW - iw) / 2, y: PAGE_H - top - photoH + (photoH - ih) / 2, width: iw, height: ih });
  }
  measured.forEach((row) => {
    const rowTop = w.y;
    w.page.drawRectangle({ x, y: PAGE_H - rowTop - row.height, width: widths[0], height: row.height, borderColor: INK, borderWidth: 0.5, color: GRAY });
    w.page.drawRectangle({ x: x + widths[0], y: PAGE_H - rowTop - row.height, width: widths[1], height: row.height, borderColor: INK, borderWidth: 0.5 });
    row.wrapped[0].forEach((l, i) => w.text(l, x + 4, rowTop + 4 + i * SMALL_LEAD, SMALL, w.fonts.bold));
    row.wrapped[1].forEach((l, i) => w.text(l, x + widths[0] + 4, rowTop + 4 + i * SMALL_LEAD, SMALL, w.fonts.regular));
    w.y += row.height;
  });
  w.y = Math.max(w.y, top + (img ? photoH : 0)) + 2;
  w.small(source);
  w.y += 6;
}

// ---------- Organograma ----------
function organogram(w: Writer, model: ReportModel, block: Extract<Block, { type: "org" }>) {
  const { targets, links } = model.input;
  const layout = layoutOrganogram(targets);
  const people = new Map(model.people.map((p) => [p.targetId, p]));
  const BOX_W = 112;
  const BOX_H = 44;
  const GAP_X = 14;
  const GAP_Y = 30;
  const natW = layout.width * (BOX_W + GAP_X) - GAP_X;
  const natH = layout.depth * (BOX_H + GAP_Y) - GAP_Y;
  const maxH = PAGE_H - M_TOP - M_BOTTOM - SMALL_LEAD * 4;
  const s = Math.min(1.45, CONTENT_W / natW, (maxH * 0.6) / natH);
  const figW = natW * s;
  const figH = natH * s;
  w.y += 6;
  w.ensure(figH + SMALL_LEAD * 3);
  w.small(`${block.label} – ${block.caption}`);
  const top = w.y + 4;
  const ox = M_LEFT + (CONTENT_W - figW) / 2;
  const pos = new Map(layout.nodes.map((n) => [n.id, { cx: ox + (n.x * (BOX_W + GAP_X) + BOX_W / 2) * s, ty: top + n.y * (BOX_H + GAP_Y) * s }]));
  const P = (x: number, yTop: number) => ({ x, y: PAGE_H - yTop });

  // Linhas hierárquicas (ortogonais)
  layout.nodes.forEach((n) => {
    if (!n.parentId) return;
    const a = pos.get(n.parentId)!;
    const b = pos.get(n.id)!;
    const midY = a.ty + BOX_H * s + (GAP_Y * s) / 2;
    const seg = (x1: number, y1: number, x2: number, y2: number) => w.page.drawLine({ start: P(x1, y1), end: P(x2, y2), thickness: 0.8, color: INK });
    seg(a.cx, a.ty + BOX_H * s, a.cx, midY);
    seg(a.cx, midY, b.cx, midY);
    seg(b.cx, midY, b.cx, b.ty);
  });
  // Demais vínculos (tracejado)
  links.forEach((l) => {
    const a = pos.get(l.fromTarget);
    const b = pos.get(l.toTarget);
    if (!a || !b) return;
    const ay = a.ty + (BOX_H * s) / 2;
    const by = b.ty + (BOX_H * s) / 2;
    w.page.drawLine({ start: P(a.cx, ay), end: P(b.cx, by), thickness: 0.7, color: GOLD, dashArray: [3, 2] });
    const label = clean(l.relation);
    const fs = 6.5 * Math.max(s, 0.7);
    const lw = w.fonts.italic.widthOfTextAtSize(label, fs);
    const mx = (a.cx + b.cx) / 2;
    const my = (ay + by) / 2;
    w.page.drawRectangle({ x: mx - lw / 2 - 2, y: PAGE_H - my - fs / 2 - 2, width: lw + 4, height: fs + 3, color: WHITE });
    w.page.drawText(label, { x: mx - lw / 2, y: PAGE_H - my - fs / 2, size: fs, font: w.fonts.italic, color: INK });
  });
  // Caixas
  layout.nodes.forEach((n) => {
    const p = pos.get(n.id)!;
    const person = people.get(n.id);
    const color = hex(ROLE_COLOR[person?.role || ""] || "#6B655A");
    const bw = BOX_W * s;
    const bh = BOX_H * s;
    const x = p.cx - bw / 2;
    w.page.drawRectangle({ x, y: PAGE_H - p.ty - bh, width: bw, height: bh, color: WHITE, borderColor: color, borderWidth: 1 });
    w.page.drawRectangle({ x, y: PAGE_H - p.ty - 4 * s, width: bw, height: 4 * s, color });
    const nameSize = 7.2 * s;
    const lines = layoutRich(w.fonts, [{ text: person?.name || "?", bold: true }], nameSize, bw - 6).slice(0, 2);
    let ty = p.ty + 7 * s;
    lines.forEach((line) => {
      const t = line.tokens.map((k) => k.text).join("");
      const tw = w.fonts.bold.widthOfTextAtSize(t, nameSize);
      w.page.drawText(t, { x: p.cx - tw / 2, y: PAGE_H - ty - nameSize * 0.8, size: nameSize, font: w.fonts.bold, color: BLACK });
      ty += nameSize * 1.15;
    });
    const sub = [person?.alias ? `"${person.alias}"` : "", person?.role || ""].filter(Boolean).join(" · ");
    const subSize = 6.3 * s;
    const sw = w.fonts.regular.widthOfTextAtSize(clean(sub), subSize);
    w.page.drawText(clean(sub), { x: p.cx - Math.min(sw, bw - 4) / 2, y: PAGE_H - (p.ty + bh - 5 * s) - subSize * 0.2, size: subSize, font: w.fonts.regular, color: INK, maxWidth: bw - 4 });
  });
  w.y = top + figH + 6;
  w.small(block.source);
  w.y += 6;
}

// ---------- Alvos × ocorrências ----------
function linkChart(w: Writer, model: ReportModel, block: Extract<Block, { type: "links" }>) {
  const people = model.people;
  const sources = linkedSources(model.input);
  const rowLayout = (n: number, maxW: number) => {
    const gap = 10;
    const bw = Math.min(maxW, (CONTENT_W - gap * (n - 1)) / n);
    const total = n * bw + gap * (n - 1);
    const x0 = M_LEFT + (CONTENT_W - total) / 2;
    return { bw, x: (i: number) => x0 + i * (bw + gap) };
  };
  const top = rowLayout(people.length, 118);
  const bottom = rowLayout(sources.length, 104);
  const BH = 40;
  const GAP = 70;
  const height = BH * 2 + GAP;
  w.y += 6;
  w.ensure(height + SMALL_LEAD * 3);
  w.small(`${block.label} – ${block.caption}`);
  const y0 = w.y + 4;
  const y1 = y0 + BH + GAP;
  const fit = (text: string, font: PDFFont, size: number, max: number) => {
    let t = clean(text);
    while (t.length > 3 && font.widthOfTextAtSize(t, size) > max) t = `${t.slice(0, -2)}…`;
    return t;
  };
  // linhas primeiro (ficam por baixo das caixas)
  sources.forEach((src, j) => {
    src.authorIds.forEach((id) => {
      const i = people.findIndex((p) => p.authorId === id);
      if (i < 0) return;
      w.page.drawLine({ start: { x: top.x(i) + top.bw / 2, y: PAGE_H - y0 - BH }, end: { x: bottom.x(j) + bottom.bw / 2, y: PAGE_H - y1 }, thickness: 0.8, color: GOLD });
    });
  });
  people.forEach((p, i) => {
    const x = top.x(i);
    const color = hex(ROLE_COLOR[p.role] || "#6B655A");
    w.page.drawRectangle({ x, y: PAGE_H - y0 - BH, width: top.bw, height: BH, color: WHITE, borderColor: color, borderWidth: 1 });
    w.page.drawRectangle({ x, y: PAGE_H - y0 - 3, width: top.bw, height: 3, color });
    const size = Math.max(5.5, Math.min(7.5, top.bw / 14));
    const lines = layoutRich(w.fonts, [{ text: p.name, bold: true }], size, top.bw - 6).slice(0, 2);
    lines.forEach((l, li) => {
      const t = l.tokens.map((k) => k.text).join("");
      const tw = w.fonts.bold.widthOfTextAtSize(t, size);
      w.page.drawText(t, { x: x + (top.bw - tw) / 2, y: PAGE_H - y0 - 10 - li * size * 1.15 - size * 0.8, size, font: w.fonts.bold, color: BLACK });
    });
    const sub = fit(p.alias ? `"${p.alias}" · ${p.role}` : p.role, w.fonts.regular, size - 0.8, top.bw - 6);
    const sw = w.fonts.regular.widthOfTextAtSize(sub, size - 0.8);
    w.page.drawText(sub, { x: x + (top.bw - sw) / 2, y: PAGE_H - y0 - BH + 5, size: size - 0.8, font: w.fonts.regular, color: INK });
  });
  sources.forEach((src, j) => {
    const x = bottom.x(j);
    const label = sourceShortLabel(src);
    w.page.drawRectangle({ x, y: PAGE_H - y1 - BH, width: bottom.bw, height: BH, color: BLACK });
    w.page.drawRectangle({ x, y: PAGE_H - y1 - 3, width: bottom.bw, height: 3, color: GOLD });
    const size = Math.max(5.5, Math.min(7.2, bottom.bw / 14));
    [[label.kind, w.fonts.bold, GOLD], [label.ref, w.fonts.bold, WHITE], [label.date, w.fonts.regular, rgb(0.81, 0.76, 0.61)]].forEach(([text, font, color], li) => {
      const t = fit(String(text || ""), font as PDFFont, size, bottom.bw - 6);
      const tw = (font as PDFFont).widthOfTextAtSize(t, size);
      w.page.drawText(t, { x: x + (bottom.bw - tw) / 2, y: PAGE_H - y1 - 9 - li * (size + 3) - size * 0.8, size, font: font as PDFFont, color: color as ReturnType<typeof rgb> });
    });
  });
  w.y = y1 + BH + 6;
  w.small(block.source);
  w.y += 6;
}

// ---------- Elementos pré-textuais ----------
function cover(w: Writer, model: ReportModel, logo?: PDFImage) {
  const page = w.addPage(false);
  const split = PAGE_H * 0.52;
  page.drawRectangle({ x: 0, y: PAGE_H - split, width: PAGE_W, height: split, color: BLACK });
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H - split, color: GOLD });
  // faixas diagonais na base do bloco preto (detalhe do modelo)
  for (let i = -2; i < 30; i += 1) {
    const x = i * 26;
    page.drawLine({ start: { x, y: PAGE_H - split + 2 }, end: { x: x + 18, y: PAGE_H - split + 26 }, thickness: 7, color: rgb(0.14, 0.14, 0.14) });
  }
  page.drawRectangle({ x: 0, y: PAGE_H - split - 2, width: PAGE_W, height: 4, color: BLACK });
  let y = 2 * CM;
  model.institution.forEach((line, i) => {
    const font = i === 0 ? w.fonts.bold : w.fonts.regular;
    const size = i === 0 ? 12 : 10;
    const tw = font.widthOfTextAtSize(clean(line), size);
    page.drawText(clean(line), { x: (PAGE_W - tw) / 2, y: PAGE_H - y - size, size, font, color: i === 0 ? WHITE : rgb(0.81, 0.76, 0.61) });
    y += size + 5;
  });
  if (logo) {
    const h = 6.2 * CM;
    const lw = (logo.width / logo.height) * h;
    page.drawImage(logo, { x: (PAGE_W - lw) / 2, y: PAGE_H - split - h * 0.42, width: lw, height: h });
  }
  const center = (text: string, top: number, size: number, font: PDFFont, color = BLACK) => {
    layoutRich(w.fonts, [{ text, bold: font === w.fonts.bold }], size, CONTENT_W).forEach((l, i) => {
      const t = l.tokens.map((k) => k.text).join("");
      const tw = font.widthOfTextAtSize(t, size);
      page.drawText(t, { x: (PAGE_W - tw) / 2, y: PAGE_H - top - i * size * 1.25 - size, size, font, color });
    });
  };
  center(model.title, split + 4.4 * CM, 18, w.fonts.bold);
  center(`${model.subtitle}${model.code ? ` — ${model.code}` : ""}`.toUpperCase(), split + 6.6 * CM, 11, w.fonts.regular);
  center(model.place.toUpperCase(), PAGE_H - 3.2 * CM, 12, w.fonts.bold);
  center(model.year, PAGE_H - 2.5 * CM, 12, w.fonts.bold);
}

function titlePage(w: Writer, model: ReportModel) {
  w.addPage(false);
  const center = (text: string, top: number, font = w.fonts.regular, size = BODY) => {
    w.y = top;
    w.drawLines(layoutRich(w.fonts, [{ text, bold: font === w.fonts.bold }], size, CONTENT_W), { align: "center", size, lead: size * 1.5 });
  };
  center(model.authors.join(" · ").toUpperCase(), M_TOP);
  center(model.title, M_TOP + 9 * CM, w.fonts.bold);
  center(model.subtitle, w.y + 4);
  // Natureza: do meio da mancha para a direita, espaço simples, fonte menor
  w.y = M_TOP + 13 * CM;
  const half = CONTENT_W / 2;
  w.drawLines(layoutRich(w.fonts, [{ text: model.nature }], SMALL, half), { x: M_LEFT + half, width: half, size: SMALL, lead: SMALL_LEAD, justify: true });
  center(model.place, PAGE_H - M_BOTTOM - 2.2 * CM);
  center(model.year, w.y);
}

const DOTS_GAP = 4;

function summary(w: Writer, pages: PDFPage[], model: ReportModel, entries: { number: string; title: string; level: number; page: number }[]) {
  let index = 0;
  w.page = pages[index];
  w.y = M_TOP;
  w.drawLines(layoutRich(w.fonts, [{ text: "SUMÁRIO", bold: true }], BODY, CONTENT_W), { align: "center" });
  w.y += LEAD;
  entries.forEach((e) => {
    if (w.y + LEAD > w.bottom) { index += 1; w.page = pages[Math.min(index, pages.length - 1)]; w.y = M_TOP; }
    const font = e.level === 1 ? w.fonts.bold : w.fonts.regular;
    const numX = M_LEFT;
    const titleX = M_LEFT + (e.number ? 1.2 * CM : 0);
    const pageText = String(e.page);
    const pw = w.fonts.regular.widthOfTextAtSize(pageText, BODY);
    const maxTitle = CONTENT_W - (titleX - M_LEFT) - pw - 20;
    let title = clean(e.title);
    while (font.widthOfTextAtSize(title, BODY) > maxTitle && title.length > 4) title = `${title.slice(0, -2)}…`;
    const top = w.y + (LEAD - BODY) / 2;
    if (e.number) w.text(e.number, numX, top, BODY, font);
    w.text(title, titleX, top, BODY, font);
    const start = titleX + font.widthOfTextAtSize(title, BODY) + 4;
    const end = M_LEFT + CONTENT_W - pw - 4;
    const dot = w.fonts.regular.widthOfTextAtSize(".", BODY);
    for (let x = start; x + dot < end; x += dot + DOTS_GAP / 2) w.page.drawText(".", { x, y: PAGE_H - top - BODY * 0.8, size: BODY, font: w.fonts.regular, color: INK });
    w.text(pageText, M_LEFT + CONTENT_W - pw, top, BODY);
    w.y += LEAD;
  });
}

async function embed(doc: PDFDocument, img?: { bytes: Uint8Array; type: string }) {
  if (!img) return undefined;
  try { return img.type === "png" ? await doc.embedPng(img.bytes) : await doc.embedJpg(img.bytes); } catch { return undefined; }
}

export async function renderPdf(model: ReportModel): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
    boldItalic: await doc.embedFont(StandardFonts.HelveticaBoldOblique),
  };
  doc.setTitle(`${model.subtitle} — ${model.title}`);
  doc.setAuthor(model.authors.join(", "));
  doc.setSubject(model.classification ? `${model.classification} — ${model.code}` : model.code);
  doc.setCreator("SI 6ª CIA — Sistema de Controle de Demandas");
  doc.setProducer("SI 6ª CIA");
  doc.setLanguage("pt-BR");

  const w = new Writer(doc, fonts, model.classification);
  const logo = await embed(doc, model.input.logo);
  const images = new Map<string, PDFImage>();
  for (const p of model.people) { const img = await embed(doc, p.photo); if (img) images.set(p.authorId, img); }

  cover(w, model, logo);
  titlePage(w, model);

  // Reserva as páginas do sumário (preenchidas depois de saber as páginas das seções).
  const entryCount = model.sections.length + (model.references.length ? 1 : 0);
  const summaryPagesCount = Math.max(1, Math.ceil((entryCount + 2) / 36));
  const summaryPages: PDFPage[] = [];
  for (let i = 0; i < summaryPagesCount; i += 1) { w.addPage(false); summaryPages.push(w.page); }

  const entries: { number: string; title: string; level: number; page: number }[] = [];
  const source = `Fonte: Seção de Inteligência da 6ª CIA PM (${model.year}).`;
  for (const section of model.sections) {
    if (section.level === 1) {
      w.addPage();
      if (w.bodyStart < 0) w.bodyStart = w.pages.length - 1;
    } else {
      w.y += LEAD;
      // Título de subseção nunca fica sozinho no pé da página.
      if (!w.fits(LEAD * 3 + 9 * CM)) w.addPage();
    }
    entries.push({ number: section.number, title: section.title, level: section.level, page: w.pages.length - 1 });
    const heading = `${section.number} ${section.level === 1 ? section.title.toUpperCase() : section.title}`;
    w.drawLines(layoutRich(fonts, [{ text: heading, bold: true }], BODY, CONTENT_W));
    w.y += LEAD;
    for (const block of section.blocks) {
      if (block.type === "p") w.paragraph(block.text, block.indent !== false);
      else if (block.type === "list") {
        block.items.forEach((item, i) => {
          const letter = `${String.fromCharCode(97 + (i % 26))}) `;
          const end = i === block.items.length - 1 ? "." : ";";
          const text = item.replace(/[.;]\s*$/, "") + end;
          const lw = fonts.regular.widthOfTextAtSize(letter, BODY);
          const lines = layoutRich(fonts, [{ text }], BODY, CONTENT_W - INDENT - lw);
          w.ensure(LEAD);
          w.text(letter, M_LEFT + INDENT, w.y + (LEAD - BODY) / 2, BODY);
          w.drawLines(lines, { x: M_LEFT + INDENT + lw, width: CONTENT_W - INDENT - lw, justify: true });
        });
      } else if (block.type === "table") table(w, block);
      else if (block.type === "org") organogram(w, model, block);
      else if (block.type === "links") linkChart(w, model, block);
      else if (block.type === "person") await person(w, block.person, block.label, images, source);
    }
  }

  if (model.references.length) {
    w.addPage();
    entries.push({ number: "", title: "REFERÊNCIAS", level: 1, page: w.pages.length - 1 });
    w.drawLines(layoutRich(fonts, [{ text: "REFERÊNCIAS", bold: true }], BODY, CONTENT_W), { align: "center" });
    w.y += LEAD;
    model.references.forEach((ref) => {
      w.drawLines(layoutRich(fonts, ref, BODY, CONTENT_W), { lead: 14 });
      w.y += 14;
    });
  }

  summary(w, summaryPages, model, entries);

  // Paginação (folha de rosto = 1; impressa a partir da primeira página textual) e grau de sigilo.
  w.pages.forEach((page, index) => {
    if (model.classification) {
      const text = clean(model.classification);
      const tw = fonts.bold.widthOfTextAtSize(text, SMALL);
      const color = index === 0 ? WHITE : RED;
      page.drawText(text, { x: (PAGE_W - tw) / 2, y: PAGE_H - 1.2 * CM, size: SMALL, font: fonts.bold, color });
      page.drawText(text, { x: (PAGE_W - tw) / 2, y: 0.9 * CM, size: SMALL, font: fonts.bold, color: index === 0 ? BLACK : RED });
    }
    if (w.bodyStart >= 0 && index >= w.bodyStart) {
      const num = String(index);
      const nw = fonts.regular.widthOfTextAtSize(num, SMALL);
      page.drawText(num, { x: PAGE_W - 2 * CM - nw, y: PAGE_H - 2 * CM, size: SMALL, font: fonts.regular, color: INK });
    }
  });
  // números do sumário seguem a mesma contagem
  return doc.save();
}
