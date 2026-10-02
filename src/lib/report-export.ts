/**
 * 보고서 내보내기 — 형식별(Word·PowerPoint·PDF·Google 문서·텍스트) 파일 만들기.
 * 무거운 라이브러리(docx, pptxgenjs)는 해당 형식을 고를 때만 불러온다.
 */
import { getUserName } from "./api";
import { download, exportText, referenceLine } from "./reports";
import type { Article, Report } from "./types";
import { formatDate } from "./utils";

export type ReportFormat = "word" | "ppt" | "pdf" | "gdocs" | "text";

export const REPORT_FORMATS: { key: ReportFormat; label: string; ext: string; action: string; desc: string }[] = [
  { key: "word", label: "Word", ext: ".docx", action: "Word 파일 내려받기", desc: "한글·Word에서 바로 편집" },
  { key: "ppt", label: "PowerPoint", ext: ".pptx", action: "PPT 파일 내려받기", desc: "항목마다 슬라이드로 정리" },
  { key: "pdf", label: "PDF", ext: ".pdf", action: "PDF로 저장", desc: "인쇄 창에서 'PDF로 저장' 선택" },
  { key: "gdocs", label: "Google 문서", ext: "Docs", action: "Google 문서로 열기", desc: "새 문서에 붙여넣기(Ctrl+V)" },
  { key: "text", label: "텍스트", ext: ".txt", action: "텍스트 파일 내려받기", desc: "메일·메신저에 붙여넣기용" },
];

export const isReportFormat = (v: string | null): v is ReportFormat => REPORT_FORMATS.some((f) => f.key === v);

/** 형식에 맞게 내보내고, 사용자에게 보여줄 안내 문구를 돌려준다 */
export async function exportReport(format: ReportFormat, report: Report, articles: Map<string, Article>): Promise<string> {
  const name = report.title.replace(/[\\/:*?"<>|]/g, "_") || "보고서";
  switch (format) {
    case "word":
      saveBlob(`${name}.docx`, await toDocx(report, articles));
      return "Word 파일을 내려받았어요.";
    case "ppt":
      await toPptx(report, articles, `${name}.pptx`);
      return "PPT 파일을 내려받았어요.";
    case "pdf":
      return printPdf(report, articles);
    case "gdocs":
      return openGoogleDocs(report, articles);
    case "text":
      download(`${name}.txt`, exportText(report, articles), "text/plain;charset=utf-8");
      return "텍스트 파일을 내려받았어요.";
  }
}

/* ───────────── 공통 ───────────── */

/** 본문 한 줄 → 소제목(■) / 글머리(-) / 일반 문단 */
function lineKind(line: string): { kind: "sub" | "bullet" | "plain"; text: string } {
  const t = line.trim();
  if (t.startsWith("■")) return { kind: "sub", text: t.replace(/^■\s*/, "") };
  if (t.startsWith("- ")) return { kind: "bullet", text: t.slice(2) };
  return { kind: "plain", text: t };
}

const lines = (content: string) => content.split("\n").filter((l) => l.trim());

const references = (report: Report, articles: Map<string, Article>) =>
  report.citations.map((id, i) => (articles.get(id) ? referenceLine(articles.get(id)!, i + 1) : `[${i + 1}] (삭제된 자료)`));

const byline = (report: Report) => `${formatDate(report.updatedAt)} · ${getUserName(report.createdBy)}`;

function saveBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** PDF 인쇄·Google 문서 붙여넣기에 쓰는 HTML */
function reportHtml(report: Report, articles: Map<string, Article>) {
  const refs = references(report, articles);
  const body = report.sections
    .map((s, i) => {
      const items = lines(s.content).map(lineKind);
      const html = items.length
        ? items
            .map(({ kind, text }) =>
              kind === "sub" ? `<p><b>${esc(text)}</b></p>` : kind === "bullet" ? `<ul><li>${esc(text)}</li></ul>` : `<p>${esc(text)}</p>`,
            )
            .join("")
        : `<p style="color:#999">(내용 없음)</p>`;
      return `<h2>${i + 1}. ${esc(s.heading)}</h2>${html}`;
    })
    .join("");
  return `<h1>${esc(report.title)}</h1><p style="color:#777">${esc(byline(report))}</p>${body}${
    refs.length ? `<h2>참고 자료</h2>${refs.map((r) => `<p style="font-size:9.5pt;color:#555">${esc(r)}</p>`).join("")}` : ""
  }`;
}

/* ───────────── Word (.docx) ───────────── */

async function toDocx(report: Report, articles: Map<string, Article>) {
  const { Document, HeadingLevel, Packer, Paragraph, TextRun } = await import("docx");
  const font = "Malgun Gothic";

  const children = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: report.title, font })] }),
    new Paragraph({ spacing: { after: 300 }, children: [new TextRun({ text: byline(report), color: "777777", font, size: 20 })] }),
    ...report.sections.flatMap((s, i) => {
      const items = lines(s.content).map(lineKind);
      return [
        new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 300 }, children: [new TextRun({ text: `${i + 1}. ${s.heading}`, font })] }),
        ...(items.length
          ? items.map(
              ({ kind, text }) =>
                new Paragraph({
                  bullet: kind === "bullet" ? { level: 0 } : undefined,
                  spacing: { after: 80 },
                  children: [new TextRun({ text, bold: kind === "sub", font, size: 22 })],
                }),
            )
          : [new Paragraph({ children: [new TextRun({ text: "(내용 없음)", color: "999999", font, size: 22 })] })]),
      ];
    }),
  ];

  const refs = references(report, articles);
  if (refs.length) {
    children.push(
      new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 300 }, children: [new TextRun({ text: "참고 자료", font })] }),
      ...refs.map((r) => new Paragraph({ children: [new TextRun({ text: r, color: "555555", font, size: 19 })] })),
    );
  }

  return Packer.toBlob(new Document({ creator: getUserName(report.createdBy), title: report.title, sections: [{ children }] }));
}

/* ───────────── PowerPoint (.pptx) ───────────── */

const SLIDE_LINES = 8;

async function toPptx(report: Report, articles: Map<string, Article>, filename: string) {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in
  pptx.title = report.title;
  const fontFace = "Malgun Gothic";
  const brand = "7C3AED";

  // 표지
  const cover = pptx.addSlide();
  cover.background = { color: "F5F3FF" };
  cover.addShape("rect", { x: 0, y: 0, w: 0.25, h: 7.5, fill: { color: brand } });
  cover.addText(report.title, { x: 0.9, y: 2.4, w: 11.5, h: 1.4, fontFace, fontSize: 36, bold: true, color: "1F1B2E" });
  cover.addText(`${byline(report)} · 참고 자료 ${report.citations.length}건`, { x: 0.9, y: 3.9, w: 11.5, h: 0.6, fontFace, fontSize: 16, color: "6B6880" });

  // 항목마다 슬라이드 (줄이 많으면 나눠서 '(계속)')
  const addListSlides = (heading: string, items: { kind: "sub" | "bullet" | "plain"; text: string }[]) => {
    const pages = items.length ? chunk(items, SLIDE_LINES) : [[{ kind: "plain" as const, text: "(내용 없음)" }]];
    pages.forEach((page, p) => {
      const slide = pptx.addSlide();
      slide.addShape("rect", { x: 0, y: 0, w: 13.33, h: 0.12, fill: { color: brand } });
      slide.addText(p ? `${heading} (계속)` : heading, { x: 0.6, y: 0.35, w: 12, h: 0.8, fontFace, fontSize: 26, bold: true, color: "1F1B2E" });
      slide.addText(
        page.map(({ kind, text }) => ({
          text,
          options: {
            bullet: kind === "bullet" ? { indent: 18 } : false,
            bold: kind === "sub",
            color: kind === "sub" ? brand : "333333",
            breakLine: true,
            paraSpaceAfter: 6,
          },
        })),
        { x: 0.7, y: 1.35, w: 11.9, h: 5.7, fontFace, fontSize: 16, valign: "top", fit: "shrink" },
      );
    });
  };

  report.sections.forEach((s, i) => addListSlides(`${i + 1}. ${s.heading}`, lines(s.content).map(lineKind)));
  const refs = references(report, articles);
  if (refs.length) addListSlides("참고 자료", refs.map((text) => ({ kind: "plain" as const, text })));

  await pptx.writeFile({ fileName: filename });
}

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/* ───────────── PDF (브라우저 인쇄 → PDF로 저장) ───────────── */

function printPdf(report: Report, articles: Map<string, Article>) {
  const w = window.open("", "_blank");
  if (!w) return "팝업이 차단되었어요. 주소창 오른쪽에서 팝업을 허용한 뒤 다시 눌러주세요.";
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(report.title)}</title>
<style>body{font-family:'Malgun Gothic',sans-serif;line-height:1.7;font-size:11pt;max-width:720px;margin:32px auto;color:#222}
h1{font-size:20pt}h2{font-size:14pt;margin-top:18pt;border-bottom:1px solid #ccc}ul{margin:0;padding-left:20px}p{margin:4px 0}
@page{margin:18mm}</style></head><body>${reportHtml(report, articles)}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
  return "인쇄 창에서 대상(프린터)을 'PDF로 저장'으로 바꿔 저장하세요.";
}

/* ───────────── Google 문서 (서식 복사 → 새 문서에 붙여넣기) ───────────── */

async function openGoogleDocs(report: Report, articles: Map<string, Article>) {
  const html = reportHtml(report, articles);
  const text = exportText(report, articles);
  try {
    await navigator.clipboard.write([
      new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([text], { type: "text/plain" }) }),
    ]);
  } catch {
    await navigator.clipboard.writeText(text);
  }
  const w = window.open("https://docs.new", "_blank");
  return w
    ? "보고서를 복사했어요. 새로 열린 Google 문서에서 Ctrl+V로 붙여넣으세요."
    : "보고서를 복사했어요. 팝업이 차단되어 있으니 docs.new 를 직접 열고 Ctrl+V로 붙여넣으세요.";
}
