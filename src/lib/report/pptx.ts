// Apresentação do relatório no modelo "Apresentação Padrão PMMG":
// capa preta e dourada com o brasão; slides internos em creme com faixa preta lateral,
// filete dourado, brasão no rodapé e linha de paralelogramos; títulos em Rawline Black.

import PptxGenJS from "pptxgenjs";
import { layoutOrganogram, ROLE_COLOR, STAGES, stageIndex } from "../investigation";
import type { ReportModel, Rich } from "./model";
import { dateBr } from "./model";

const BLACK = "0B0B0C";
const INK = "231F20";
const GOLD = "9B8A5C";
const GOLD_LIGHT = "CFC29B";
const CREAM = "F3F0E7";
const RED = "B3261E";
const TITLE_FONT = "Rawline Black";
const BODY_FONT = "Rawline";
const W = 13.333;
const H = 7.5;

const plain = (r: Rich | string) => (typeof r === "string" ? r : r.map((s) => s.text).join(""));

/** Divide texto longo em blocos que cabem num slide. */
function chunks(paragraphs: string[], max = 950) {
  const out: string[][] = [];
  let current: string[] = [];
  let size = 0;
  paragraphs.forEach((p) => {
    const parts = p.length > max ? (p.match(new RegExp(`.{1,${max}}(\\s|$)`, "g")) || [p]) : [p];
    parts.forEach((part) => {
      if (size + part.length > max && current.length) { out.push(current); current = []; size = 0; }
      current.push(part.trim());
      size += part.length;
    });
  });
  if (current.length) out.push(current);
  return out;
}

export async function renderPptx(model: ReportModel): Promise<Uint8Array> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = model.authors.join(", ");
  pptx.company = "PMMG — SI 6ª CIA";
  pptx.title = `${model.subtitle} — ${model.title}`;
  pptx.subject = model.classification;
  const logo = model.input.logo;
  const theme = `${model.code} · ${model.subtitle}`.toUpperCase();
  const logoW = logo ? 0.95 : 0;
  const logoH = logo ? (logo.height / logo.width) * 0.95 : 0;

  pptx.defineSlideMaster({
    title: "PMMG",
    background: { color: CREAM },
    objects: [
      { rect: { x: 0, y: 0, w: 0.62, h: H, fill: { color: BLACK } } },
      { rect: { x: 0.62, y: 0, w: 0.05, h: H, fill: { color: GOLD } } },
      { rect: { x: 0.69, y: 0, w: 0.012, h: H, fill: { color: GOLD_LIGHT } } },
      ...(logo ? [{ image: { x: 0.18, y: H - logoH - 0.12, w: logoW, h: logoH, data: logo.dataUrl } }] : []),
      { text: { text: theme, options: { x: 1.3, y: 6.88, w: 6, h: 0.25, fontFace: TITLE_FONT, fontSize: 9, color: INK, margin: 0 } } },
      { line: { x: 1.3, y: 7.15, w: 5.0, h: 0, line: { color: INK, width: 0.75 } } },
      ...[0, 1, 2].map((i) => ({ rect: { x: 6.32 + i * 0.22, y: 7.07, w: 0.18, h: 0.16, line: { color: INK, width: 0.75 }, fill: { color: CREAM } } })),
      ...(model.classification ? [{ text: { text: model.classification, options: { x: W - 3.3, y: 0.12, w: 3, h: 0.3, align: "right" as const, fontFace: TITLE_FONT, fontSize: 11, color: RED, bold: true, margin: 0 } } }] : []),
    ],
    slideNumber: { x: W - 1.0, y: 7.0, w: 0.6, h: 0.3, fontFace: BODY_FONT, fontSize: 10, color: INK, align: "right" },
  });

  const content = (title: string, subtitle?: string) => {
    const slide = pptx.addSlide({ masterName: "PMMG" });
    slide.addText(title.toUpperCase(), { x: 1.3, y: 0.42, w: 11.4, h: 0.65, fontFace: TITLE_FONT, fontSize: 30, color: BLACK, margin: 0, fit: "shrink" });
    if (subtitle) slide.addText(subtitle.toUpperCase(), { x: 1.3, y: 1.07, w: 11.4, h: 0.3, fontFace: BODY_FONT, fontSize: 10, color: INK, charSpacing: 1.5, margin: 0 });
    return slide;
  };

  const tableStyle = { fontFace: BODY_FONT, fontSize: 11, color: INK, border: { type: "solid" as const, color: "FFFFFF", pt: 1 }, valign: "middle" as const, margin: 0.06 };
  const header = (cells: string[]) => cells.map((c) => ({ text: c.toUpperCase(), options: { bold: true, color: "FFFFFF", fill: { color: BLACK }, fontFace: TITLE_FONT } }));
  const body = (rows: string[][]) => rows.map((r, i) => r.map((c) => ({ text: c || "—", options: { fill: { color: i % 2 ? "E6E6E6" : "CFCFCF" } } })));

  // ---------- Capa (slide de título do modelo) ----------
  const cover = pptx.addSlide();
  cover.background = { color: GOLD };
  cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 3.75, fill: { color: BLACK }, line: { color: BLACK } });
  for (let i = 0; i < 24; i += 1) {
    cover.addShape(pptx.ShapeType.parallelogram, { x: i * 0.62 - 0.4, y: 3.2, w: 0.75, h: 0.5, fill: { color: i % 3 === 0 ? "3A3A3A" : "1C1B1B" }, line: { color: BLACK, width: 0 } });
  }
  if (logo) {
    const h = 3.4;
    const w = (logo.width / logo.height) * h;
    cover.addImage({ data: logo.dataUrl, x: (W - w) / 2, y: 0.85, w, h });
  }
  cover.addText(model.title, { x: 0.8, y: 4.55, w: W - 1.6, h: 1.25, align: "center", valign: "middle", fontFace: TITLE_FONT, fontSize: 30, color: BLACK, fit: "shrink" });
  cover.addText(`${model.subtitle}${model.code ? ` · ${model.code}` : ""}`.toUpperCase(), { x: 0.8, y: 5.8, w: W - 1.6, h: 0.4, align: "center", fontFace: BODY_FONT, fontSize: 14, color: BLACK, charSpacing: 2 });
  cover.addText(`${model.institution[model.institution.length - 1]} · ${model.institution[3] || ""} · ${model.place.toUpperCase()}, ${model.dateLong.toUpperCase()}`, { x: 0.8, y: 6.55, w: W - 1.6, h: 0.35, align: "center", fontFace: BODY_FONT, fontSize: 11, color: INK });
  if (model.classification) cover.addText(model.classification, { x: W - 3.3, y: 0.15, w: 3, h: 0.35, align: "right", fontFace: TITLE_FONT, fontSize: 12, color: "FFFFFF", bold: true });

  // ---------- Roteiro ----------
  const agenda = content("Roteiro", model.title);
  const topics = model.sections.filter((s) => s.level === 1).map((s) => `${s.number}  ${s.title}`);
  agenda.addText(topics.map((t) => ({ text: t, options: { breakLine: true } })), { x: 1.3, y: 1.7, w: 7.5, h: 4.9, fontFace: TITLE_FONT, fontSize: 18, color: INK, paraSpaceAfter: 8, valign: "top" });
  const inv = model.input.investigation;
  const facts: [string, string][] = [
    ["Código", model.code], ["Etapa", STAGES[stageIndex(inv.stage)].name], ["Abertura", dateBr(inv.openedAt)],
    ["Responsável", model.input.responsibleName], ["Alvos", String(model.people.length)], ["Fontes", String(model.input.items.filter((i) => i.includeInReport).length)],
  ];
  agenda.addTable(facts.map(([k, v], i) => [
    { text: k.toUpperCase(), options: { bold: true, color: "FFFFFF", fill: { color: BLACK }, fontFace: TITLE_FONT } },
    { text: v || "—", options: { fill: { color: i % 2 ? "E6E6E6" : "CFCFCF" } } },
  ]), { ...tableStyle, x: 9.0, y: 1.75, w: 3.7, colW: [1.4, 2.3], rowH: 0.42 });

  // ---------- Seções de texto ----------
  const textSlides = (title: string, texts: string[], subtitle?: string) => {
    chunks(texts).forEach((part, i, all) => {
      const slide = content(all.length > 1 ? `${title} (${i + 1}/${all.length})` : title, subtitle);
      slide.addText(part.map((t) => ({ text: t, options: { breakLine: true, paraSpaceAfter: 10 } })), { x: 1.3, y: 1.6, w: 11.4, h: 5.1, fontFace: BODY_FONT, fontSize: 15, color: INK, valign: "top", align: "justify" });
    });
  };

  const intro = model.sections.find((s) => s.title === "INTRODUÇÃO");
  if (intro) textSlides("Objetivo e origem", intro.blocks.filter((b) => b.type === "p").slice(0, 2).map((b) => plain((b as any).text)), "Introdução");
  const synth = model.sections.find((s) => s.title === "SÍNTESE DOS FATOS");
  if (synth) textSlides("Síntese dos fatos", synth.blocks.filter((b) => b.type === "p").map((b) => plain((b as any).text)));

  // ---------- Alvos (layout de slide com imagem à esquerda) ----------
  model.people.forEach((p) => {
    const slide = pptx.addSlide({ masterName: "PMMG" });
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 4.3, h: H, fill: { color: BLACK }, line: { color: BLACK } });
    slide.addShape(pptx.ShapeType.rect, { x: 4.3, y: 0, w: 0.05, h: H, fill: { color: GOLD }, line: { color: GOLD } });
    if (p.photo) slide.addImage({ data: p.photo.dataUrl, x: 0.55, y: 1.0, w: 3.2, h: 4.2, sizing: { type: "contain", w: 3.2, h: 4.2 } });
    else slide.addText("SEM FOTO", { x: 0.55, y: 1.0, w: 3.2, h: 4.2, align: "center", fontFace: TITLE_FONT, fontSize: 14, color: "777777", fill: { color: "1C1B1B" } });
    if (logo) slide.addImage({ data: logo.dataUrl, x: 0.18, y: H - logoH - 0.12, w: logoW, h: logoH });
    slide.addText(p.name, { x: 4.75, y: 0.42, w: 8.1, h: 0.75, fontFace: TITLE_FONT, fontSize: 26, color: BLACK, margin: 0, fit: "shrink" });
    slide.addText([p.alias ? `VULGO "${p.alias.toUpperCase()}"` : "", p.role.toUpperCase()].filter(Boolean).join(" · "), { x: 4.75, y: 1.15, w: 8.1, h: 0.3, fontFace: BODY_FONT, fontSize: 11, color: INK, charSpacing: 1.5, margin: 0 });
    const rows: [string, string][] = ([
      ["Superior", p.parentName], ["Nascimento", dateBr(p.birthDate)], ["Mãe", p.motherName], ["Documento", p.document],
      ["Endereço", [p.address, p.neighborhood, p.city].filter(Boolean).join(", ")], ["Situação", p.status], ["Crimes", p.crimes],
    ] as [string, string][]).filter(([, v]) => v);
    if (rows.length) slide.addTable(rows.map(([k, v], i) => [
      { text: k.toUpperCase(), options: { bold: true, color: "FFFFFF", fill: { color: BLACK }, fontFace: TITLE_FONT } },
      { text: v, options: { fill: { color: i % 2 ? "E6E6E6" : "CFCFCF" } } },
    ]), { ...tableStyle, x: 4.75, y: 1.7, w: 8.1, colW: [2.0, 6.1], rowH: 0.4 });
    const notes = [p.notes, p.targetNotes].filter(Boolean).join(" ");
    if (notes) slide.addText(notes, { x: 4.75, y: 1.8 + rows.length * 0.42 + 0.2, w: 8.1, h: Math.max(0.6, 4.9 - rows.length * 0.42), fontFace: BODY_FONT, fontSize: 13, color: INK, valign: "top", fit: "shrink" });
  });

  // ---------- Organograma ----------
  const { targets, links } = model.input;
  if (targets.length > 1) {
    const slide = content("Organograma", "Estrutura hierárquica e vínculos");
    const layout = layoutOrganogram(targets);
    const people = new Map(model.people.map((p) => [p.targetId, p]));
    const areaX = 1.3, areaY = 1.65, areaW = 11.5, areaH = 5.0;
    const BOX_W = 2.1, BOX_H = 0.85, GAP_X = 0.3, GAP_Y = 0.55;
    const natW = layout.width * (BOX_W + GAP_X) - GAP_X;
    const natH = layout.depth * (BOX_H + GAP_Y) - GAP_Y;
    const s = Math.min(1.15, areaW / natW, areaH / natH);
    const ox = areaX + (areaW - natW * s) / 2;
    const pos = new Map(layout.nodes.map((n) => [n.id, { cx: ox + (n.x * (BOX_W + GAP_X) + BOX_W / 2) * s, ty: areaY + n.y * (BOX_H + GAP_Y) * s }]));
    const line = (x1: number, y1: number, x2: number, y2: number, opts: any) => {
      slide.addShape(pptx.ShapeType.line, { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1) || 0.001, h: Math.abs(y2 - y1) || 0.001, flipH: (x2 < x1) !== (y2 < y1) && x1 !== x2 && y1 !== y2, line: opts });
    };
    layout.nodes.forEach((n) => {
      if (!n.parentId) return;
      const a = pos.get(n.parentId)!;
      const b = pos.get(n.id)!;
      const mid = a.ty + BOX_H * s + (GAP_Y * s) / 2;
      const st = { color: INK, width: 1.25 };
      line(a.cx, a.ty + BOX_H * s, a.cx, mid, st);
      if (Math.abs(a.cx - b.cx) > 0.001) line(a.cx, mid, b.cx, mid, st);
      line(b.cx, mid, b.cx, b.ty, st);
    });
    links.forEach((l) => {
      const a = pos.get(l.fromTarget);
      const b = pos.get(l.toTarget);
      if (!a || !b) return;
      const ay = a.ty + (BOX_H * s) / 2;
      const by = b.ty + (BOX_H * s) / 2;
      line(a.cx, ay, b.cx, by, { color: GOLD, width: 1.5, dashType: "dash" });
      slide.addText(l.relation, { x: (a.cx + b.cx) / 2 - 0.7, y: (ay + by) / 2 - 0.13, w: 1.4, h: 0.26, align: "center", fontFace: BODY_FONT, fontSize: 9, italic: true, color: INK, fill: { color: CREAM }, margin: 0 });
    });
    layout.nodes.forEach((n) => {
      const p = pos.get(n.id)!;
      const person = people.get(n.id);
      const color = (ROLE_COLOR[person?.role || ""] || "#6B655A").replace("#", "");
      const bw = BOX_W * s;
      const bh = BOX_H * s;
      slide.addShape(pptx.ShapeType.rect, { x: p.cx - bw / 2, y: p.ty, w: bw, h: bh, fill: { color: "FFFFFF" }, line: { color, width: 1.5 } });
      slide.addShape(pptx.ShapeType.rect, { x: p.cx - bw / 2, y: p.ty, w: bw, h: 0.07 * s, fill: { color }, line: { color, width: 0 } });
      // Fonte calculada para o nome caber em até duas linhas dentro da caixa.
      const name = person?.name || "?";
      const nameSize = Math.max(6, Math.min(10.5 * s, (bw * 72 * 1.8) / (name.length * 0.62)));
      slide.addText([
        { text: name, options: { bold: true, fontFace: TITLE_FONT, fontSize: nameSize, color: BLACK, breakLine: true } },
        { text: [person?.alias ? `"${person.alias}"` : "", person?.role || ""].filter(Boolean).join(" · "), options: { fontFace: BODY_FONT, fontSize: Math.max(6, 9 * s), color: INK } },
      ], { x: p.cx - bw / 2, y: p.ty + 0.07 * s, w: bw, h: bh - 0.07 * s, align: "center", valign: "middle", margin: 0.04, fit: "shrink" });
    });
  }

  // ---------- Tabelas (vínculos, fontes, cronologia) ----------
  const tableSlides = (title: string, headers: string[], rows: string[][], colW: number[], perSlide = 8, subtitle?: string) => {
    for (let i = 0; i < rows.length; i += perSlide) {
      const part = rows.slice(i, i + perSlide);
      const pages = Math.ceil(rows.length / perSlide);
      const slide = content(pages > 1 ? `${title} (${i / perSlide + 1}/${pages})` : title, subtitle || `Fonte: Seção de Inteligência da 6ª CIA PM (${model.year})`);
      slide.addTable([header(headers), ...body(part)], { ...tableStyle, x: 1.3, y: 1.65, w: 11.4, colW, fontSize: 11, autoPage: false });
    }
  };
  if (links.length) {
    const name = (id: string) => model.people.find((p) => p.targetId === id)?.name || "—";
    tableSlides("Vínculos identificados", ["Alvo", "Vínculo", "Alvo", "Observação"], links.map((l) => [name(l.fromTarget), l.relation, name(l.toTarget), l.notes]), [3.2, 2.0, 3.2, 3.0]);
  }
  const items = model.input.items.filter((i) => i.includeInReport).sort((a, b) => (a.itemDate || "9999").localeCompare(b.itemDate || "9999"));
  if (items.length) {
    tableSlides("Fontes e dados reunidos", ["Data", "Tipo", "Descrição", "Fonte", "Aval."],
      items.map((i) => [dateBr(i.itemDate) || "—", i.kind, [i.title, i.reference].filter(Boolean).join(" — "), i.source || "—", `${i.sourceRating || "–"}${i.infoRating || ""}`]), [1.3, 2.0, 5.0, 2.3, 0.8], 7);
    const dated = items.filter((i) => i.itemDate);
    if (dated.length >= 2) {
      // Linha do tempo visual
      const slide = content("Cronologia", "Sequência dos fatos levantados");
      const shown = dated.slice(0, 7);
      const step = 11.0 / Math.max(1, shown.length - 1 || 1);
      slide.addShape(pptx.ShapeType.line, { x: 1.5, y: 3.7, w: 11.0, h: 0, line: { color: INK, width: 2 } });
      shown.forEach((it, idx) => {
        const x = shown.length === 1 ? 7 : 1.5 + idx * step;
        const up = idx % 2 === 0;
        slide.addShape(pptx.ShapeType.ellipse, { x: x - 0.12, y: 3.58, w: 0.24, h: 0.24, fill: { color: GOLD }, line: { color: BLACK, width: 1 } });
        slide.addText(dateBr(it.itemDate), { x: x - 0.9, y: up ? 3.1 : 3.95, w: 1.8, h: 0.35, align: "center", fontFace: TITLE_FONT, fontSize: 12, color: BLACK });
        slide.addText([{ text: it.kind.toUpperCase(), options: { bold: true, fontSize: 8, color: GOLD, breakLine: true } }, { text: it.title, options: { fontSize: 10, color: INK } }],
          { x: x - 0.95, y: up ? 1.75 : 4.4, w: 1.9, h: 1.3, align: "center", valign: up ? "bottom" : "top", fontFace: BODY_FONT, fit: "shrink" });
      });
    }
  }

  // ---------- Análise e conclusão ----------
  const analysis = model.sections.find((s) => s.title === "ANÁLISE");
  if (analysis) textSlides("Análise", analysis.blocks.filter((b) => b.type === "p").map((b) => plain((b as any).text)));
  const finals = model.sections.find((s) => s.title === "CONSIDERAÇÕES FINAIS");
  if (finals) {
    const slide = content("Conclusão e recomendações");
    const paras = finals.blocks.filter((b) => b.type === "p").map((b) => plain((b as any).text)).filter((t) => !t.startsWith("Diante do exposto"));
    const recs = (finals.blocks.find((b) => b.type === "list") as any)?.items || [];
    slide.addText(paras.map((t) => ({ text: t, options: { breakLine: true, paraSpaceAfter: 8 } })), { x: 1.3, y: 1.6, w: recs.length ? 5.4 : 11.4, h: 5.0, fontFace: BODY_FONT, fontSize: 15, color: INK, valign: "top", fit: "shrink" });
    if (recs.length) {
      slide.addShape(pptx.ShapeType.rect, { x: 7.0, y: 1.6, w: 5.7, h: 5.0, fill: { color: BLACK }, line: { color: BLACK } });
      slide.addShape(pptx.ShapeType.rect, { x: 7.0, y: 1.6, w: 5.7, h: 0.06, fill: { color: GOLD }, line: { color: GOLD } });
      slide.addText("RECOMENDAÇÕES", { x: 7.3, y: 1.8, w: 5.1, h: 0.45, fontFace: TITLE_FONT, fontSize: 16, color: GOLD_LIGHT, margin: 0 });
      slide.addText(recs.map((r: string) => ({ text: r, options: { bullet: { code: "25B8" }, breakLine: true, paraSpaceAfter: 8 } })), { x: 7.3, y: 2.35, w: 5.1, h: 4.1, fontFace: BODY_FONT, fontSize: 14, color: "FFFFFF", valign: "top", fit: "shrink" });
    }
  }

  // ---------- Encerramento ----------
  const end = pptx.addSlide();
  end.background = { color: BLACK };
  end.addShape(pptx.ShapeType.rect, { x: 0, y: H - 2.2, w: W, h: 2.2, fill: { color: GOLD }, line: { color: GOLD } });
  if (logo) { const h = 3.0; const w = (logo.width / logo.height) * h; end.addImage({ data: logo.dataUrl, x: (W - w) / 2, y: 1.0, w, h }); }
  end.addText("SEÇÃO DE INTELIGÊNCIA · 6ª CIA PM", { x: 0.8, y: H - 1.75, w: W - 1.6, h: 0.6, align: "center", fontFace: TITLE_FONT, fontSize: 24, color: BLACK });
  end.addText(model.classification ? `${model.classification} — difusão restrita ao destinatário` : model.place, { x: 0.8, y: H - 1.1, w: W - 1.6, h: 0.4, align: "center", fontFace: BODY_FONT, fontSize: 12, color: BLACK });

  const out = await pptx.write({ outputType: "uint8array" });
  return out as Uint8Array;
}
