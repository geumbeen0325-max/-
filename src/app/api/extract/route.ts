/**
 * 자료 넣기 → 제목·본문 추출
 *   GET  /api/extract?url=...   링크(웹페이지, PDF/엑셀 등 파일 링크, 구글 문서·드라이브 공유 링크)
 *   POST /api/extract           multipart "file" — 업로드한 파일 1건
 * 브라우저에서 직접 가져오면 CORS에 막히고 파일 파서도 무거우므로 서버에서 처리한다.
 */
import type { NextRequest } from "next/server";
import { fetchUrl, MAX_BYTES, SourceError } from "@/lib/server/fetch-url";
import { detectKind, parseSource } from "@/lib/server/parse";

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url")?.trim();
  if (!raw) return Response.json({ error: "url 파라미터가 필요합니다." }, { status: 400 });

  try {
    const { buf, contentType, filename, finalUrl } = await fetchUrl(raw);
    // 웹페이지는 파일명이 의미 없으므로 HTML로 강제 판별
    const isHtml = /html|xhtml/i.test(contentType) || (!contentType && detectKind(filename) === "other");
    const parsed = await parseSource(buf, isHtml ? "page.html" : filename, contentType);
    return Response.json({ ...parsed, url: finalUrl });
  } catch (e) {
    if (e instanceof SourceError) return Response.json({ error: e.message }, { status: e.status });
    console.error("[extract GET]", e);
    return Response.json({ error: "링크 내용을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "file 필드가 필요합니다." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "파일이 너무 큽니다. (최대 20MB)" }, { status: 413 });

  const parsed = await parseSource(new Uint8Array(await file.arrayBuffer()), file.name, file.type);
  return Response.json(parsed);
}
