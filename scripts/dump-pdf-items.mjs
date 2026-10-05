// Сохраняет текстовые фрагменты PDF-отчёта ВТБ (с координатами) в JSON для тестов разбора.
// Запуск: node scripts/dump-pdf-items.mjs отчёт.pdf src/lib/report/fixtures/имя.json
// Номер счёта и тип соглашения из шапки вырезаются: фикстуры лежат в публичном репозитории.
import { readFileSync, writeFileSync } from "node:fs";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const [, , input, output] = process.argv;
const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(input)), useSystemFonts: true }).promise;
const pages = [];
for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const content = await page.getTextContent();
  pages.push(
    content.items
      .filter((i) => i.str.trim() !== "")
      .map((i) => ({ str: i.str, x: Math.round(i.transform[4] * 10) / 10, y: Math.round(i.transform[5] * 10) / 10, w: Math.round(i.width * 10) / 10 })),
  );
}
const SECRET = /^(14PD\d+|\d{6,})$|^Номер счета$|^ИИС$|^Тип соглашения$/;
const clean = pages.map((items) => items.map((i) => (SECRET.test(i.str.trim()) && !/^\d{1,3}(\s\d{3})*,\d\d/.test(i.str) ? { ...i, str: "·" } : i)));
writeFileSync(output, JSON.stringify(clean));
console.log(`${input}: страниц ${pages.length}, фрагментов ${pages.flat().length}`);
