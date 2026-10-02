/**
 * 원본 파일 보관 — Supabase Storage 'article-files' 버킷 (supabase/schema.sql 참고).
 * 저장 경로는 무작위 id(+확장자)로 만들고, 원래 파일 이름은 articles.source.fileName에 둔다
 * (Storage 경로에는 한글을 쓸 수 없으므로). 비공개 버킷이라 내려받기·미리보기는 1시간짜리 서명 주소로 한다.
 */
import { supabase } from "./supabase";
import type { ArticleSource } from "./types";

const BUCKET = "article-files";
const URL_TTL = 60 * 60;

/** 파일을 올리고 저장 경로를 돌려준다 */
export async function uploadSourceFile(file: File) {
  const ext = /\.([a-z0-9]{1,8})$/i.exec(file.name)?.[1]?.toLowerCase();
  const path = `${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) throw new Error(`파일 저장 실패: ${error.message}`);
  return path;
}

/** 미리보기용 주소 (download를 주면 그 이름으로 내려받는 주소) */
export async function sourceFileUrl(path: string, download?: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, URL_TTL, download ? { download } : undefined);
  if (error || !data) throw new Error(`파일 주소를 만들지 못했습니다: ${error?.message ?? ""}`);
  return data.signedUrl;
}

export async function downloadSourceFile(source: ArticleSource) {
  if (!source.storagePath) return;
  const name = source.fileName?.split("/").pop() || source.storagePath;
  const a = document.createElement("a");
  a.href = await sourceFileUrl(source.storagePath, name);
  a.click();
}

/** 미리보기용으로 파일 내용을 받아온다 */
export async function fetchSourceFile(path: string) {
  const res = await fetch(await sourceFileUrl(path));
  if (!res.ok) throw new Error(`파일을 불러오지 못했습니다 (${res.status})`);
  return res;
}
