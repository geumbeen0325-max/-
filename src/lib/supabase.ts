/**
 * Supabase 클라이언트 + DB 행(snake_case) ↔ 앱 타입(camelCase) 변환.
 * 표 구조는 supabase/schema.sql 참고. 로그인 없이 publishable(anon) 키로 접근하며,
 * RLS로 읽기·추가·수정만 허용되어 있다 (삭제는 deleted_at 소프트 삭제).
 */
import { createClient } from "@supabase/supabase-js";
import type { Article, Briefing, Comment, Project, Report } from "./types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 환경변수가 없습니다 (.env.local).");

export const supabase = createClient(url, key, { auth: { persistSession: false } });

/** Supabase 응답의 error를 던지고 data만 돌려준다 */
export function must<T>({ data, error }: { data: T | null; error: { message: string } | null }): NonNullable<T> {
  if (error) throw new Error(`DB 오류: ${error.message}`);
  return data as NonNullable<T>;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- DB 행은 스키마에서 형태가 보장된다 */

export const toArticle = (r: any): Article => ({
  id: r.id,
  title: r.title,
  url: r.url,
  body: r.body,
  summary: r.summary ?? [],
  category: r.category,
  keywords: r.keywords ?? [],
  parentArticleId: r.parent_article_id,
  source: r.source ?? undefined,
  createdBy: r.created_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const fromArticle = (a: Partial<Article>) =>
  strip({
    title: a.title,
    url: a.url,
    body: a.body,
    summary: a.summary,
    category: a.category,
    keywords: a.keywords,
    parent_article_id: a.parentArticleId,
    source: a.source === undefined ? undefined : (a.source ?? null),
    created_by: a.createdBy,
  });

export const toComment = (r: any): Comment => ({
  id: r.id,
  articleId: r.article_id,
  parentId: r.parent_id,
  authorId: r.author_id,
  text: r.text,
  likes: r.likes ?? [],
  createdAt: r.created_at,
});

export const toProject = (r: any): Project => ({
  id: r.id,
  name: r.name,
  description: r.description,
  createdBy: r.created_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const toBriefing = (r: any): Briefing => ({
  id: r.id,
  weekStart: r.week_start,
  weekEnd: r.week_end,
  sections: r.sections ?? [],
  overall: r.overall ?? [],
  content: r.content,
  articleCount: r.article_count,
  createdBy: r.created_by,
  createdAt: r.created_at,
});

export const toReport = (r: any): Report => ({
  id: r.id,
  title: r.title,
  template: r.template,
  projectId: r.project_id,
  sections: r.sections ?? [],
  citations: r.citations ?? [],
  status: r.status,
  verifyHistory: r.verify_history ?? [],
  createdBy: r.created_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const fromReport = (r: Partial<Report>) =>
  strip({
    title: r.title,
    template: r.template,
    project_id: r.projectId,
    sections: r.sections,
    citations: r.citations,
    status: r.status,
    verify_history: r.verifyHistory,
    created_by: r.createdBy,
  });

/** undefined 필드는 보내지 않는다 (PATCH 시 다른 컬럼을 건드리지 않도록) */
function strip<T extends Record<string, unknown>>(o: T) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}
