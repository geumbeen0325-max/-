/**
 * 서버 전용: 파일/웹페이지 바이트를 받아 제목·본문 텍스트를 추출한다.
 * 지원: 웹페이지(HTML), PDF, Excel(xlsx/xls/csv/ods), Word(docx), PowerPoint(pptx), 한글(hwpx), 텍스트류
 */
import { Readability } from "@mozilla/readability";
import JSZip from "jszip";
import { parseHTML } from "linkedom";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import * as XLSX from "xlsx";
import { detectKind, fileExt } from "../source-kind";
import type { SourceKind } from "../types";

export const MAX_BODY_CHARS = 20_000;

export interface ParsedSource {
  kind: SourceKind;
  title: string;
  body: string;
  /** 사용자에게 보여줄 부가 정보 (예: "PDF · 12쪽") */
  detail: string;
  /** 본문을 추출하지 못했을 때 안내 문구 */
  warning?: string;
}

const clean = (s: string) => s.replace(/ /g, " ").replace(/[ \t]+/g, " ").trim();

function finalize(p: ParsedSource): ParsedSource {
  let body = p.body.replace(/\n{3,}/g, "\n\n").trim();
  if (body.length > MAX_BODY_CHARS) body = body.slice(0, MAX_BODY_CHARS) + "\n\n…(이하 생략)";
  if (!body && !p.warning) p.warning = "본문을 추출하지 못했습니다. 내용을 직접 입력해주세요.";
  return { ...p, title: clean(p.title), body };
}

const stripExt = (name: string) => name.replace(/\.[^.]+$/, "");
const ext = fileExt;
export { detectKind };

/* ───────────── 텍스트 인코딩 ───────────── */

/** 국내 사이트·CSV 일부는 아직 EUC-KR을 쓰므로 charset을 확인해서 디코딩 */
export function decodeText(buf: Uint8Array, contentType = "") {
  const head = new TextDecoder("latin1").decode(buf.slice(0, 4096));
  const declared =
    contentType.match(/charset=["']?([\w-]+)/i)?.[1] ?? head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1];
  if (declared) {
    try {
      return new TextDecoder(declared.toLowerCase()).decode(buf);
    } catch {}
  }
  // 선언이 없으면 UTF-8로 시도하고, 깨지면 EUC-KR
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("euc-kr").decode(buf);
  }
}

/* ───────────── 형식별 파서 ───────────── */

function meta(document: Document, ...names: string[]) {
  for (const n of names) {
    const v = document.querySelector(`meta[property="${n}"], meta[name="${n}"]`)?.getAttribute("content");
    if (v?.trim()) return v.trim();
  }
  return "";
}

export function parseHtml(html: string): ParsedSource {
  const { document } = parseHTML(html);
  const ogTitle = meta(document, "og:title", "twitter:title");
  const siteName = meta(document, "og:site_name");
  const article = new Readability(document as unknown as Document, { charThreshold: 200 }).parse();

  let body = "";
  if (article?.content) {
    const { document: doc } = parseHTML(`<html><body>${article.content}</body></html>`);
    body = [...doc.querySelectorAll("p, li, h2, h3, blockquote, td")]
      .map((el) => clean(el.textContent ?? ""))
      .filter((t) => t.length > 1)
      .join("\n\n");
  }
  if (!body && article?.textContent) {
    body = article.textContent.split(/\n+/).map(clean).filter(Boolean).join("\n\n");
  }
  // 통신사 바이라인 "(서울=연합뉴스) 홍길동 기자 =" 제거
  body = body.replace(/^.{0,40}?\([^()]{1,20}=[^()]{1,20}\)\s*[^=\n]{0,30}?(기자|특파원)\s*=\s*/, "");

  return {
    kind: "link",
    title: ogTitle || article?.title || "",
    body,
    detail: siteName || article?.siteName || "웹페이지",
    warning:
      body.length < 100
        ? "본문을 찾지 못했습니다. 로그인·유료 페이지이거나 스크립트로 그려지는 페이지일 수 있어요. 내용을 직접 붙여넣어 주세요."
        : undefined,
  };
}

async function parsePdf(buf: Uint8Array, name: string): Promise<ParsedSource> {
  const pdf = await getDocumentProxy(buf);
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  const body = (text as string[])
    .map((page) => page.split(/\n/).map(clean).filter(Boolean).join("\n"))
    .join("\n\n");
  const info = (await pdf.getMetadata().catch(() => null))?.info as { Title?: string } | undefined;
  return {
    kind: "pdf",
    title: info?.Title?.trim() || stripExt(name),
    body,
    detail: `PDF · ${totalPages}쪽`,
    warning: body.trim() ? undefined : "스캔(이미지) PDF로 보여 글자를 읽지 못했습니다. 내용을 직접 입력해주세요.",
  };
}

function parseSpreadsheet(buf: Uint8Array, name: string): ParsedSource {
  const isText = ["csv", "tsv"].includes(ext(name));
  const wb = isText
    ? XLSX.read(decodeText(buf), { type: "string", FS: ext(name) === "tsv" ? "\t" : undefined })
    : XLSX.read(buf, { type: "array" });

  let totalRows = 0;
  const sections = wb.SheetNames.map((sheetName) => {
    const rows = XLSX.utils
      .sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, blankrows: false, defval: "" })
      .map((r) => r.map((c) => clean(String(c ?? ""))))
      .filter((r) => r.some(Boolean));
    totalRows += rows.length;
    const header = rows[0]?.filter(Boolean).join(", ");
    const lines = rows.slice(0, 200).map((r) => r.join(" | "));
    return [
      `[시트: ${sheetName}] ${rows.length}행${header ? ` · 열: ${header}` : ""}`,
      ...lines,
      rows.length > 200 ? `…(${rows.length - 200}행 더 있음)` : "",
    ]
      .filter(Boolean)
      .join("\n");
  });

  const overview = `${wb.SheetNames.length}개 시트, 총 ${totalRows}행으로 구성된 표 자료이다.`;
  return {
    kind: "excel",
    title: stripExt(name),
    body: [overview, ...sections].join("\n\n"),
    detail: `${ext(name).toUpperCase() || "Excel"} · 시트 ${wb.SheetNames.length}개 · ${totalRows}행`,
  };
}

async function parseDocx(buf: Uint8Array, name: string): Promise<ParsedSource> {
  const { value } = await mammoth.extractRawText({ buffer: Buffer.from(buf) });
  return { kind: "word", title: stripExt(name), body: value, detail: "Word 문서" };
}

const xmlText = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

/** zip 안의 XML 파일들에서 문단 단위로 텍스트 수집 (pptx, hwpx 공용) */
async function zipXmlText(buf: Uint8Array, filePattern: RegExp, paraTag: string, textTag: string) {
  const zip = await JSZip.loadAsync(buf);
  const files = Object.keys(zip.files)
    .filter((f) => filePattern.test(f))
    .sort((a, b) => Number(a.match(/(\d+)\.xml$/)?.[1] ?? 0) - Number(b.match(/(\d+)\.xml$/)?.[1] ?? 0));
  const textRe = new RegExp(`<${textTag}(?:\\s[^>]*)?>([\\s\\S]*?)</${textTag}>`, "g");
  const parts: string[] = [];
  for (const f of files) {
    const xml = await zip.files[f].async("string");
    const paras = xml
      .split(`</${paraTag}>`)
      .map((p) => clean(xmlText([...p.matchAll(textRe)].map((m) => m[1].replace(/<[^>]+>/g, "")).join(""))))
      .filter(Boolean);
    parts.push(paras.join("\n"));
  }
  return { count: files.length, text: parts.filter(Boolean) };
}

async function parsePptx(buf: Uint8Array, name: string): Promise<ParsedSource> {
  const { count, text } = await zipXmlText(buf, /^ppt\/slides\/slide\d+\.xml$/, "a:p", "a:t");
  return {
    kind: "ppt",
    title: stripExt(name),
    body: text.map((t, i) => `[슬라이드 ${i + 1}]\n${t}`).join("\n\n"),
    detail: `PowerPoint · ${count}장`,
  };
}

async function parseHwp(buf: Uint8Array, name: string): Promise<ParsedSource> {
  if (ext(name) === "hwp") {
    return {
      kind: "hwp",
      title: stripExt(name),
      body: "",
      detail: "한글 문서(HWP)",
      warning: "HWP(구형 한글) 형식은 아직 읽을 수 없어요. 한글에서 'HWPX' 또는 PDF로 저장해 다시 넣어주세요.",
    };
  }
  const { text } = await zipXmlText(buf, /^Contents\/section\d+\.xml$/, "hp:p", "hp:t");
  return { kind: "hwp", title: stripExt(name), body: text.join("\n\n"), detail: "한글 문서(HWPX)" };
}

/** 바이트 → 제목/본문. 실패해도 예외 대신 warning이 담긴 결과를 돌려준다 */
export async function parseSource(buf: Uint8Array, name: string, mime = ""): Promise<ParsedSource> {
  const kind = detectKind(name, mime);
  try {
    switch (kind) {
      case "pdf":
        return finalize(await parsePdf(buf, name));
      case "excel":
        return finalize(parseSpreadsheet(buf, name));
      case "word":
        return finalize(await parseDocx(buf, name));
      case "ppt":
        return finalize(await parsePptx(buf, name));
      case "hwp":
        return finalize(await parseHwp(buf, name));
      case "link":
        return finalize(parseHtml(decodeText(buf, mime)));
      case "text":
        return finalize({ kind, title: stripExt(name), body: decodeText(buf, mime), detail: "텍스트" });
      case "image":
        return finalize({
          kind,
          title: stripExt(name),
          body: "",
          detail: "이미지",
          warning: "이미지 속 글자 인식(OCR)은 AI 연동 단계에서 지원 예정이에요. 내용을 직접 입력해주세요.",
        });
      default:
        return finalize({
          kind,
          title: stripExt(name),
          body: "",
          detail: ext(name).toUpperCase() || "파일",
          warning: "지원하지 않는 형식이에요. 내용을 직접 입력해주세요.",
        });
    }
  } catch (e) {
    console.error("[parseSource]", name, e);
    return finalize({
      kind,
      title: stripExt(name),
      body: "",
      detail: "읽기 실패",
      warning: "파일을 읽는 중 오류가 났어요. 파일이 손상되었거나 암호가 걸려 있을 수 있어요.",
    });
  }
}
