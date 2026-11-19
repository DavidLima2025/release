import type { AuthorFile } from "./domain";
import type { InvestigationItem } from "./investigation";

/** Prefixo dos BOs anexados ao card quando aparecem no mapa como se fossem fontes. */
export const REPORT_PREFIX = "rep:";
export const isReportItem = (item: { id: string }) => item.id.startsWith(REPORT_PREFIX);

/** BOs (REDS) anexados aos cards dos alvos, no formato das fontes das investigações (mapa, linha do tempo). */
export function reportsAsItems(reports: AuthorFile[]): InvestigationItem[] {
  return reports
    .filter((r) => r.reds || /REDS/i.test(r.description) || r.lat != null)
    .map((r) => ({
      id: `${REPORT_PREFIX}${r.id}`, investigationId: "", kind: "Boletim de ocorrência",
      title: [r.crime || "BO", r.place].filter(Boolean).join(" — "), itemDate: r.eventDate || "", source: "PMMG / REDS",
      reference: r.reds || (r.description.match(/\d{4}-\d{9}-\d{3}/)?.[0] ?? ""), url: "", sourceRating: "A", infoRating: "2",
      summary: r.description, authorIds: [r.authorId], filePath: r.filePath, fileName: r.fileName, fileSize: r.fileSize, mimeType: r.mimeType || "application/pdf",
      includeInReport: false, createdAt: r.createdAt, lat: r.lat ?? null, lng: r.lng ?? null, geoSource: r.geoSource || "", place: r.place || "",
      eventTime: r.eventTime || "", crime: r.crime || "",
    }));
}
