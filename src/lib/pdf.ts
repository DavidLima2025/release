import type { PdfTextItem } from "./boletim";

// pdf.js é carregado sob demanda: só entra no navegador quando alguém importa um PDF.
// Usa o build "legacy", que funciona também em navegadores mais antigos das estações de trabalho.
let pdfjsPromise: Promise<any> | null = null;

async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const [pdfjs, worker] = await Promise.all([
        import("pdfjs-dist/legacy/build/pdf.mjs"),
        import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
      ]);
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

/** Extrai todos os trechos de texto do PDF, com posição (x, y) e tamanho da fonte. */
export async function extractPdfItems(file: File): Promise<PdfTextItem[]> {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data, verbosity: 0 });
  const doc = await loadingTask.promise;
  const items: PdfTextItem[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      content.items.forEach((item: any) => {
        if (typeof item.str !== "string") return;
        items.push({
          str: item.str,
          x: item.transform[4],
          y: item.transform[5],
          w: item.width,
          h: item.height || Math.abs(item.transform[3]),
          page: pageNumber,
        });
      });
    }
  } finally {
    // destroy() fica na loadingTask (em versões novas o documento não tem mais esse método).
    await loadingTask.destroy?.();
  }
  return items;
}
