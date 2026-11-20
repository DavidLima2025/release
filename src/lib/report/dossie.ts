// Dossiê da investigação em PDF: organograma (com fotos), relação de alvos e vínculos,
// e ao final a ficha de qualificação de cada alvo. Gerado no navegador com pdf-lib.
import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { layoutOrganogram, ROLE_COLOR, type InvestigationLink, type InvestigationTarget } from "../investigation";
import type { ReportImage } from "./model";

export type DossiePerson = { name: string; alias: string; role: string; status: string; document: string; parent: string; photo?: ReportImage; bos: number };
export type DossieInput = {
  code: string; title: string; status: string; responsible: string; objective: string;
  targets: InvestigationTarget[]; links: InvestigationLink[]; people: Map<string, DossiePerson>;
  logo?: ReportImage; fichas: Uint8Array[];
  generatedBy: string; generatedAt: string;
};

const BLACK = rgb(0.043, 0.043, 0.047);
const INK = rgb(0.137, 0.122, 0.125);
const MUTED = rgb(0.42, 0.4, 0.35);
const GOLD = rgb(0.608, 0.541, 0.361);
const CREAM = rgb(0.953, 0.941, 0.906);
const LINE = rgb(0.86, 0.84, 0.79);
const RED = rgb(0.72, 0.1, 0.1);
const WHITE = rgb(1, 1, 1);
const hex = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);

const WIN_ANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
const clean = (t: string) => String(t ?? "").replace(/\t/g, " ").replace(/[‐-‒]/g, "-").replace(/→/g, "->").replace(/[“”]/g, '"')
  .replace(/[^\n\x20-\x7E\xA0-\xFF]/g, (c) => (WIN_ANSI_EXTRA.includes(c) ? c : "?"));

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const out: string[] = [];
  for (const para of clean(text).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) { line = next; continue; }
      if (line) out.push(line);
      let w = word;
      while (font.widthOfTextAtSize(w, size) > width && w.length > 1) {
        let i = w.length; while (i > 1 && font.widthOfTextAtSize(w.slice(0, i), size) > width) i -= 1;
        out.push(w.slice(0, i)); w = w.slice(i);
      }
      line = w;
    }
    out.push(line);
  }
  return out;
}

export async function renderDossie(input: DossieInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(clean(`Dossiê ${input.code} — ${input.title}`));
  doc.setSubject("RESERVADO");
  doc.setProducer("SI 6ª CIA");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const embed = async (img?: ReportImage): Promise<PDFImage | undefined> => {
    if (!img) return undefined;
    try { return img.type === "png" ? await doc.embedPng(img.bytes) : await doc.embedJpg(img.bytes); } catch { return undefined; }
  };
  const logo = await embed(input.logo);

  let page!: PDFPage;
  let PW = 0; let PH = 0;
  const M = 34;
  const T = (t: string, x: number, y: number, size: number, font = regular, color = INK) => page.drawText(clean(t), { x, y, size, font, color });
  const header = (w: number, h: number, sub: string) => {
    page = doc.addPage([w, h]); PW = w; PH = h;
    page.drawRectangle({ x: 0, y: PH - 70, width: PW, height: 70, color: BLACK });
    page.drawRectangle({ x: 0, y: PH - 73, width: PW, height: 3, color: GOLD });
    if (logo) { const lh = 52; page.drawImage(logo, { x: M, y: PH - 62, width: (logo.width / logo.height) * lh, height: lh }); }
    const x = M + (logo ? 60 : 0);
    T("POLÍCIA MILITAR DE MINAS GERAIS · SEÇÃO DE INTELIGÊNCIA", x, PH - 24, 8, bold, GOLD);
    T(sub, x, PH - 44, 16, bold, WHITE);
    const inv = clean(`${input.code ? `${input.code} — ` : ""}${input.title}`);
    let invLine = inv; while (invLine.length > 4 && regular.widthOfTextAtSize(invLine, 9) > PW - x - 140) invLine = `${invLine.slice(0, -2)}…`;
    T(invLine, x, PH - 60, 9, regular, WHITE);
    const tag = "RESERVADO"; const tw = bold.widthOfTextAtSize(tag, 11);
    page.drawRectangle({ x: PW - M - tw - 16, y: PH - 50, width: tw + 16, height: 22, color: RED });
    T(tag, PW - M - tw - 8, PH - 43, 11, bold, WHITE);
  };
  const footer = (n: string) => {
    page.drawLine({ start: { x: M, y: 30 }, end: { x: PW - M, y: 30 }, thickness: 0.5, color: LINE });
    T(`Gerado por ${input.generatedBy || "—"} em ${input.generatedAt}. Documento de difusão restrita.`, M, 18, 7, regular, MUTED);
    T(n, PW - M - regular.widthOfTextAtSize(n, 7), 18, 7, regular, MUTED);
  };

  // ---------- 1. Organograma ----------
  const { targets, links, people } = input;
  const layout = layoutOrganogram(targets);
  const BW = 156; const BH = 66; const GX = 18; const GY = 40;
  const natW = Math.max(1, layout.width) * (BW + GX) - GX;
  const natH = Math.max(1, layout.depth) * (BH + GY) - GY;
  // A4 paisagem; se o organograma for grande, a folha cresce (até A2) em vez de encolher demais as caixas.
  const baseW = 841.89; const baseH = 595.28;
  const availW0 = baseW - 2 * M; const availH0 = baseH - 73 - 60 - 60;
  let s = Math.min(1.25, availW0 / natW, availH0 / natH);
  let pw = baseW; let ph = baseH;
  if (s < 0.72) {
    s = 0.72;
    pw = Math.min(1684, Math.max(baseW, natW * s + 2 * M));
    ph = Math.min(1191, Math.max(baseH, natH * s + 73 + 120));
    s = Math.min(s, (pw - 2 * M) / natW, (ph - 73 - 120) / natH);
  }
  header(pw, ph, "ORGANOGRAMA DA INVESTIGAÇÃO");
  const info = [`Situação: ${input.status || "—"}`, `Responsável: ${input.responsible || "—"}`, `Alvos: ${targets.length}`, `Vínculos: ${links.length}`].join("     ");
  T(info, M, PH - 92, 8.5, regular, MUTED);

  if (!targets.length) {
    T("Nenhum alvo vinculado a esta investigação.", M, PH / 2, 12, italic, MUTED);
  } else {
    const figW = natW * s; const figH = natH * s;
    const ox = (PW - figW) / 2;
    const topY = PH - 108 - Math.max(0, (PH - 108 - 64 - figH) / 2); // topo do desenho, centralizado na área livre
    const pos = new Map(layout.nodes.map((n) => [n.id, { cx: ox + (n.x * (BW + GX) + BW / 2) * s, top: topY - n.y * (BH + GY) * s }]));
    const bw = BW * s; const bh = BH * s;
    // Hierarquia (linhas ortogonais)
    for (const n of layout.nodes) {
      if (!n.parentId) continue;
      const a = pos.get(n.parentId); const b = pos.get(n.id); if (!a || !b) continue;
      const midY = a.top - bh - (GY * s) / 2;
      const seg = (x1: number, y1: number, x2: number, y2: number) => page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 1, color: INK });
      seg(a.cx, a.top - bh, a.cx, midY); seg(a.cx, midY, b.cx, midY); seg(b.cx, midY, b.cx, b.top);
    }
    // Vínculos (tracejado dourado, com a relação). Rota em "cotovelo" para não passar por cima das caixas.
    const labels: { x: number; y: number; text: string }[] = [];
    const dash = (x1: number, y1: number, x2: number, y2: number) => page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.9, color: GOLD, dashArray: [3, 2] });
    links.forEach((l, i) => {
      const a = pos.get(l.fromTarget); const b = pos.get(l.toTarget); if (!a || !b) return;
      const off = (i % 4) * 4 * s;
      if (Math.abs(a.cx - b.cx) < 1) {
        // mesma coluna: contorna pela direita
        const xr = a.cx + bw / 2 + (GX / 2) * s + off;
        const ay = a.top - bh / 2; const by = b.top - bh / 2;
        dash(a.cx + bw / 2, ay, xr, ay); dash(xr, ay, xr, by); dash(xr, by, b.cx + bw / 2, by);
        labels.push({ x: xr, y: (ay + by) / 2, text: l.relation });
      } else if (Math.abs(a.top - b.top) < 1) {
        // mesma linha: passa por baixo das caixas
        const dy = a.top - bh - 9 * s - off;
        dash(a.cx, a.top - bh, a.cx, dy); dash(a.cx, dy, b.cx, dy); dash(b.cx, dy, b.cx, b.top - bh);
        labels.push({ x: (a.cx + b.cx) / 2, y: dy, text: l.relation });
      } else {
        const [up, down] = a.top > b.top ? [a, b] : [b, a];
        const midY = up.top - bh - (GY * s) * 0.35 - off;
        dash(up.cx + (down.cx > up.cx ? bw / 4 : -bw / 4), up.top - bh, up.cx + (down.cx > up.cx ? bw / 4 : -bw / 4), midY);
        dash(up.cx + (down.cx > up.cx ? bw / 4 : -bw / 4), midY, down.cx, midY);
        dash(down.cx, midY, down.cx, down.top);
        labels.push({ x: (up.cx + down.cx) / 2, y: midY, text: l.relation });
      }
    });
    // Caixas com foto
    const photos = new Map<string, PDFImage>();
    for (const n of layout.nodes) { const e = await embed(people.get(n.id)?.photo); if (e) photos.set(n.id, e); }
    for (const n of layout.nodes) {
      const p = pos.get(n.id)!; const person = people.get(n.id);
      const color = hex(ROLE_COLOR[person?.role || ""] || "#6B655A");
      const x = p.cx - bw / 2; const y = p.top - bh;
      page.drawRectangle({ x, y, width: bw, height: bh, color: WHITE, borderColor: color, borderWidth: 1.2 });
      page.drawRectangle({ x, y: p.top - 5 * s, width: bw, height: 5 * s, color });
      const phW = 42 * s; const phH = 54 * s; const px = x + 4 * s; const py = y + (bh - 5 * s - phH) / 2;
      page.drawRectangle({ x: px, y: py, width: phW, height: phH, color: CREAM });
      const img = photos.get(n.id);
      if (img) {
        // A foto chega recortada em 3:4; aqui só ajusta dentro do quadro.
        const r = Math.min(phW / img.width, phH / img.height);
        const w = img.width * r; const h = img.height * r;
        page.drawImage(img, { x: px + (phW - w) / 2, y: py + (phH - h) / 2, width: w, height: h });
      }
      const tx = px + phW + 5 * s; const tw = x + bw - tx - 4 * s;
      const ns = 7.4 * s;
      let ty = p.top - 5 * s - ns - 3 * s;
      for (const line of wrap((person?.name || "?").toUpperCase(), bold, ns, tw).slice(0, 3)) { page.drawText(line, { x: tx, y: ty, size: ns, font: bold, color: BLACK }); ty -= ns * 1.12; }
      const ss = 6.4 * s;
      if (person?.alias) { const al = wrap(`"${person.alias}"`, italic, ss, tw)[0]; page.drawText(al, { x: tx, y: ty - 1, size: ss, font: italic, color: INK }); ty -= ss * 1.2; }
      const roleTxt = clean(person?.role || "");
      page.drawText(roleTxt, { x: tx, y: y + 4 * s, size: ss, font: bold, color, maxWidth: tw });
      if (person?.bos) { const b = `${person.bos} BO`; page.drawText(b, { x: x + bw - 4 * s - regular.widthOfTextAtSize(b, ss), y: y + 4 * s, size: ss, font: regular, color: MUTED }); }
    }
    for (const lb of labels) {
      const fs = Math.max(5.5, 6.5 * s); const label = clean(lb.text); const lw = italic.widthOfTextAtSize(label, fs);
      page.drawRectangle({ x: lb.x - lw / 2 - 2, y: lb.y - fs / 2 - 1.5, width: lw + 4, height: fs + 3, color: WHITE, borderColor: GOLD, borderWidth: 0.4 });
      page.drawText(label, { x: lb.x - lw / 2, y: lb.y - fs / 2 + 0.5, size: fs, font: italic, color: INK });
    }
    // Legenda das funções usadas
    const roles = [...new Set(targets.map((t) => people.get(t.id)?.role || "").filter(Boolean))];
    let lx = M; const ly = 44;
    T("Funções:", lx, ly, 7.5, bold, MUTED); lx += 38;
    for (const r of roles) {
      page.drawRectangle({ x: lx, y: ly - 1, width: 9, height: 7, color: hex(ROLE_COLOR[r] || "#6B655A") });
      T(r, lx + 12, ly, 7.5, regular, INK); lx += 12 + regular.widthOfTextAtSize(clean(r), 7.5) + 14;
    }
    page.drawLine({ start: { x: lx + 4, y: ly + 2.5 }, end: { x: lx + 26, y: ly + 2.5 }, thickness: 0.8, color: GOLD, dashArray: [3, 2] });
    T("vínculo", lx + 30, ly, 7.5, regular, INK);
    page.drawLine({ start: { x: lx + 70, y: ly + 2.5 }, end: { x: lx + 92, y: ly + 2.5 }, thickness: 1, color: INK });
    T("hierarquia", lx + 96, ly, 7.5, regular, INK);
  }
  footer("Organograma");

  // ---------- 2. Relação de alvos e vínculos (A4 retrato) ----------
  const A4W = 595.28; const A4H = 841.89;
  header(A4W, A4H, "RELAÇÃO DE ALVOS E VÍNCULOS");
  let y = A4H - 100;
  const newPage = () => { footer("Relação"); header(A4W, A4H, "RELAÇÃO DE ALVOS E VÍNCULOS"); y = A4H - 100; };
  const sectionTitle = (t: string) => {
    if (y < 120) newPage();
    page.drawRectangle({ x: M, y: y - 3, width: 3, height: 13, color: GOLD });
    T(t.toUpperCase(), M + 9, y, 10, bold, BLACK); y -= 8;
    page.drawLine({ start: { x: M, y }, end: { x: A4W - M, y }, thickness: 0.6, color: LINE }); y -= 6;
  };
  const table = (cols: { label: string; w: number }[], rows: string[][]) => {
    const fs = 8; const lead = 10;
    const head = () => {
      page.drawRectangle({ x: M, y: y - 14, width: A4W - 2 * M, height: 15, color: BLACK });
      let x = M; for (const c of cols) { T(c.label, x + 4, y - 10, 7.5, bold, GOLD); x += c.w; } y -= 15;
    };
    head();
    rows.forEach((r, ri) => {
      const wrapped = r.map((cell, i) => wrap(cell || "—", i === 1 ? bold : regular, fs, cols[i].w - 8));
      const h = Math.max(...wrapped.map((w) => w.length)) * lead + 6;
      if (y - h < 50) { newPage(); head(); }
      if (ri % 2) page.drawRectangle({ x: M, y: y - h, width: A4W - 2 * M, height: h, color: CREAM });
      let x = M;
      wrapped.forEach((lines, i) => { lines.forEach((l, k) => page.drawText(l, { x: x + 4, y: y - 10 - k * lead, size: fs, font: i === 1 ? bold : regular, color: INK })); x += cols[i].w; });
      y -= h;
      page.drawLine({ start: { x: M, y }, end: { x: A4W - M, y }, thickness: 0.3, color: LINE });
    });
    y -= 16;
  };
  if (input.objective.trim()) {
    sectionTitle("Objetivo");
    for (const l of wrap(input.objective, regular, 9.5, A4W - 2 * M)) { if (y < 60) newPage(); T(l, M, y - 8, 9.5); y -= 13; }
    y -= 12;
  }
  sectionTitle(`Alvos (${targets.length})`);
  const ordered = [...targets].sort((a, b) => a.position - b.position);
  table(
    [{ label: "Nº", w: 24 }, { label: "NOME", w: 150 }, { label: "VULGO", w: 70 }, { label: "FUNÇÃO", w: 70 }, { label: "SUBORDINADO A", w: 110 }, { label: "SITUAÇÃO / BOs", w: A4W - 2 * M - 424 }],
    ordered.map((t, i) => { const p = people.get(t.id); return [String(i + 1), p?.name || "?", p?.alias || "", p?.role || t.role, p?.parent || "", [p?.status, p?.bos ? `${p.bos} BO(s)` : ""].filter(Boolean).join(" · ")]; }),
  );
  if (links.length) {
    sectionTitle(`Vínculos (${links.length})`);
    table(
      [{ label: "Nº", w: 24 }, { label: "ALVO", w: 135 }, { label: "RELAÇÃO", w: 80 }, { label: "COM", w: 135 }, { label: "OBSERVAÇÃO", w: A4W - 2 * M - 374 }],
      links.map((l, i) => [String(i + 1), people.get(l.fromTarget)?.name || "?", l.relation, people.get(l.toTarget)?.name || "?", l.notes]),
    );
  }
  if (input.fichas.length) {
    if (y < 90) newPage();
    T(`A seguir: ficha de qualificação de cada alvo (${input.fichas.length}).`, M, y, 9, italic, MUTED);
  }
  footer("Relação");

  // ---------- 3. Qualificações (fichas individuais) ----------
  for (const bytes of input.fichas) {
    const src = await PDFDocument.load(bytes);
    const pages = await doc.copyPages(src, src.getPageIndices());
    pages.forEach((p) => doc.addPage(p));
  }
  return doc.save();
}
