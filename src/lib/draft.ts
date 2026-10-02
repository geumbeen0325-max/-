import { analyzeArticle, findRelatedArticles } from "./api";
import type { Article, ArticleInput, ArticleSource, Category, RelatedMatch } from "./types";

export type AiState = "idle" | "loading" | "done" | "error";

/** 등록/수정 화면에서 편집 중인 자료 */
export interface Draft {
  title: string;
  url: string;
  body: string;
  summary: string[];
  category: Category | "";
  keywords: string[];
  parentArticleId: string | null;
  /** auto: 시스템이 같은 이슈를 찾아 연결 / manual: 사용자가 직접 고르거나 해제함 */
  parentMode: "auto" | "manual";
  related: RelatedMatch[];
  /** 등록하면서 남기는 첫 의견 (선택) — 댓글로 저장 */
  firstComment: string;
  source?: ArticleSource;
  ai: AiState;
  aiError?: string;
}

export function emptyDraft(patch: Partial<Draft> = {}): Draft {
  return {
    title: "",
    url: "",
    body: "",
    summary: ["", "", ""],
    category: "",
    keywords: [],
    parentArticleId: null,
    parentMode: "auto",
    related: [],
    firstComment: "",
    ai: "idle",
    ...patch,
  };
}

export function draftFromArticle(a: Article): Draft {
  return emptyDraft({
    ...a,
    summary: [...a.summary, "", "", ""].slice(0, 3),
    parentMode: "manual", // 기존 자료 수정 시에는 연결을 임의로 바꾸지 않음
    ai: "done",
  });
}

export function draftToInput(d: Draft): ArticleInput {
  return {
    title: d.title.trim(),
    url: d.url.trim(),
    body: d.body,
    summary: d.summary.map((s) => s.trim()),
    category: d.category as Category,
    keywords: d.keywords,
    parentArticleId: d.parentArticleId,
    source: d.source,
  };
}

/** AI 분석 → 초안에 덮어쓸 값. 실패해도 예외 대신 error 상태를 돌려준다 */
export async function analyzeDraft(title: string, body: string): Promise<Partial<Draft>> {
  try {
    const r = await analyzeArticle(title, body);
    return { summary: r.summary, category: r.category, keywords: r.keywords, ai: "done", aiError: undefined };
  } catch (e) {
    return { ai: "error", aiError: e instanceof Error ? e.message : "AI 분석에 실패했습니다." };
  }
}

/** 같은 이슈 자동 연결. 사용자가 직접 정했다면(manual) 후보만 갱신하고 연결은 건드리지 않는다 */
export async function autoLink(d: Pick<Draft, "title" | "keywords" | "parentMode">, excludeId?: string): Promise<Partial<Draft>> {
  const related = await findRelatedArticles(d.title, d.keywords, excludeId);
  if (d.parentMode === "manual") return { related };
  return { related, parentArticleId: related[0]?.article.id ?? null };
}
