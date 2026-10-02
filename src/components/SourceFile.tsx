"use client";

import { useEffect, useState } from "react";
import { Download, Eye, Info, LoaderCircle, X } from "lucide-react";
import { downloadSourceFile, fetchSourceFile, sourceFileUrl } from "@/lib/files";
import { fileExt } from "@/lib/source-kind";
import type { Article, ArticleSource } from "@/lib/types";
import { SourceBadge } from "./SourceIcon";

/** 자료 상세의 원본 파일 — 내려받기 + 미리보기 */
export default function SourceFile({ article }: { article: Article }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const source = article.source;
  if (!source || source.kind === "link") return null;

  async function download() {
    setBusy(true);
    setError("");
    try {
      await downloadSourceFile(source!);
    } catch (e) {
      setError(e instanceof Error ? e.message : "내려받지 못했습니다.");
    }
    setBusy(false);
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[240px] max-w-sm flex-1">
          <SourceBadge source={source} />
        </div>
        {source.storagePath && (
          <>
            <button onClick={() => setOpen(true)} className="btn-ghost px-4 py-2 text-sm">
              <Eye size={15} /> 미리보기
            </button>
            <button onClick={download} disabled={busy} className="btn-ghost px-4 py-2 text-sm">
              {busy ? <LoaderCircle size={15} className="animate-spin" /> : <Download size={15} />} 다운로드
            </button>
          </>
        )}
      </div>
      {!source.storagePath && source.fileName && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-faint">
          <Info size={12} /> 원본 파일 보관 기능이 생기기 전에 등록한 자료라 파일은 없고, 추출한 본문만 있어요.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-rose-500">{error}</p>}
      {open && <PreviewModal source={source} body={article.body} onClose={() => setOpen(false)} />}
    </div>
  );
}

type Preview =
  | { mode: "loading" }
  | { mode: "url"; url: string } // PDF — 브라우저 내장 뷰어
  | { mode: "image"; url: string }
  | { mode: "html"; html: string } // Word·Excel을 HTML로 변환
  | { mode: "text"; text: string; note?: string }
  | { mode: "error"; message: string };

async function buildPreview(source: ArticleSource, body: string): Promise<Preview> {
  const path = source.storagePath!;
  const ext = fileExt(source.fileName ?? path);

  if (source.kind === "pdf") return { mode: "url", url: await sourceFileUrl(path) };
  if (source.kind === "image") return { mode: "image", url: await sourceFileUrl(path) };
  if (source.kind === "text") return { mode: "text", text: await (await fetchSourceFile(path)).text() };

  if (source.kind === "word" && ext === "docx") {
    const mammoth = (await import("mammoth")).default;
    const arrayBuffer = await (await fetchSourceFile(path)).arrayBuffer();
    const { value } = await mammoth.convertToHtml({ arrayBuffer });
    return { mode: "html", html: value };
  }

  if (source.kind === "excel") {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await (await fetchSourceFile(path)).arrayBuffer(), { type: "array" });
    const html = wb.SheetNames.map(
      (name) => `<h3>${escapeHtml(name)}</h3>${XLSX.utils.sheet_to_html(wb.Sheets[name], { header: "", footer: "" })}`,
    ).join("");
    return { mode: "html", html };
  }

  // PPT·한글 등은 브라우저에서 바로 그릴 수 없어 등록 때 추출한 내용으로 보여준다
  return {
    mode: "text",
    text: body,
    note: "이 형식은 브라우저에서 바로 볼 수 없어 등록할 때 추출한 내용을 보여드려요. 원래 모양은 다운로드해서 확인하세요.",
  };
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** 변환한 HTML은 스크립트가 돌지 않는 sandbox iframe에 넣는다 */
const wrapHtml = (html: string) => `<!doctype html><html><head><meta charset="utf-8"><style>
body{font-family:'Malgun Gothic',sans-serif;font-size:14px;line-height:1.7;color:#222;margin:24px}
table{border-collapse:collapse;margin-bottom:24px}td,th{border:1px solid #ddd;padding:4px 8px;font-size:13px;vertical-align:top}
h3{margin:16px 0 8px}img{max-width:100%}
</style></head><body>${html}</body></html>`;

function PreviewModal({ source, body, onClose }: { source: ArticleSource; body: string; onClose: () => void }) {
  const [preview, setPreview] = useState<Preview>({ mode: "loading" });

  useEffect(() => {
    let alive = true;
    buildPreview(source, body)
      .catch((e): Preview => ({ mode: "error", message: e instanceof Error ? e.message : "미리보기를 만들지 못했습니다." }))
      .then((p) => alive && setPreview(p));
    return () => {
      alive = false;
    };
  }, [source, body]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="파일 미리보기">
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-line px-5 py-3">
          <p className="min-w-0 flex-1 truncate text-sm font-semibold">{source.fileName?.split("/").pop() ?? "원본 파일"}</p>
          <button onClick={() => downloadSourceFile(source)} className="btn-ghost px-3 py-1.5 text-xs">
            <Download size={13} /> 다운로드
          </button>
          <button onClick={onClose} aria-label="닫기" className="rounded-lg p-1.5 text-ink-soft hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 bg-slate-50">
          {preview.mode === "loading" && (
            <p className="flex h-full items-center justify-center gap-2 text-sm text-ink-faint">
              <LoaderCircle size={16} className="animate-spin" /> 불러오는 중…
            </p>
          )}
          {preview.mode === "error" && <p className="flex h-full items-center justify-center text-sm text-rose-500">{preview.message}</p>}
          {preview.mode === "url" && <iframe src={preview.url} title="PDF 미리보기" className="h-full w-full" />}
          {preview.mode === "image" && (
            // eslint-disable-next-line @next/next/no-img-element -- 서명 주소라 next/image 최적화 대상이 아님
            <img src={preview.url} alt={source.fileName ?? "이미지"} className="mx-auto h-full object-contain p-4" />
          )}
          {preview.mode === "html" && <iframe sandbox="" srcDoc={wrapHtml(preview.html)} title="문서 미리보기" className="h-full w-full bg-white" />}
          {preview.mode === "text" && (
            <div className="h-full overflow-auto p-6">
              {preview.note && (
                <p className="mb-4 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  <Info size={13} className="mt-0.5 shrink-0" /> {preview.note}
                </p>
              )}
              <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-ink">{preview.text}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
