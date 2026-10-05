import type { PdfItem } from "./pdf-parse";

/** Читает PDF в браузере (pdfjs-dist) и отдаёт фрагменты текста с координатами. Файл никуда не отправляется. */
export async function readPdfItems(file: File): Promise<PdfItem[][]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages: PdfItem[][] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    pages.push(
      content.items
        .filter((i): i is typeof i & { str: string; transform: number[]; width: number } => "str" in i && i.str.trim() !== "")
        .map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width })),
    );
  }
  return pages;
}
