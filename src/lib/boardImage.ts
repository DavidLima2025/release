// Converte o organograma por núcleos (SVG) em PNG para o PDF — o mesmo desenho da tela.
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { OrgBoard, type BoardPerson } from "../components/OrgBoard";
import type { BoardLayout, InvestigationLink, InvestigationTarget, OrgGroup } from "./investigation";
import type { AutoLink } from "./orgBoard";
import type { ReportImage } from "./report/model";

export async function renderBoardImage(targets: InvestigationTarget[], links: InvestigationLink[], groups: OrgGroup[], people: Map<string, BoardPerson>, autoLinks: AutoLink[] = [], layout?: BoardLayout, scale = 2): Promise<ReportImage | undefined> {
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-99999px;top:0;";
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(createElement(OrgBoard, { targets, links, groups, people, autoLinks, layout, exportMode: true })));
    const svg = host.querySelector("svg");
    if (!svg) return undefined;
    const w = Number(svg.getAttribute("width")); const h = Number(svg.getAttribute("height"));
    const xml = new XMLSerializer().serializeToString(svg);
    const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const s = Math.min(scale, 7000 / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * s); canvas.height = Math.round(h * s);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    const dataUrl = canvas.toDataURL("image/png");
    return { bytes: Uint8Array.from(atob(dataUrl.split(",")[1]), (c) => c.charCodeAt(0)), type: "png", dataUrl, width: canvas.width, height: canvas.height };
  } finally {
    root.unmount(); host.remove();
  }
}
