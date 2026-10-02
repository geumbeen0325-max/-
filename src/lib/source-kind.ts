import type { SourceKind } from "./types";

export const fileExt = (name: string) => name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";

/** 파일명·MIME으로 자료 종류 판별 (브라우저·서버 공용) */
export function detectKind(filename: string, mime = ""): SourceKind {
  const e = fileExt(filename);
  const m = mime.toLowerCase();
  if (e === "pdf" || m.includes("pdf")) return "pdf";
  if (["xlsx", "xlsm", "xls", "csv", "tsv", "ods"].includes(e) || m.includes("spreadsheet") || m.includes("excel") || m.includes("csv"))
    return "excel";
  if (e === "docx" || m.includes("wordprocessingml")) return "word";
  if (e === "pptx" || m.includes("presentationml")) return "ppt";
  if (e === "hwpx" || e === "hwp") return "hwp";
  if (["html", "htm"].includes(e) || m.includes("html")) return "link";
  if (["txt", "md", "json", "xml", "log"].includes(e) || m.startsWith("text/")) return "text";
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "heic"].includes(e) || m.startsWith("image/")) return "image";
  return "other";
}
