export const CATEGORIES = ["경쟁사", "시장", "정책", "기술"] as const;
export type Category = (typeof CATEGORIES)[number];

export interface User {
  id: string;
  name: string;
  role: "member" | "admin";
  team: string;
}

export type SourceKind = "link" | "pdf" | "excel" | "word" | "ppt" | "hwp" | "text" | "image" | "other";

/** 자료의 출처 (설계서 이후 추가: 기사 외 파일·링크도 등록) */
export interface ArticleSource {
  kind: SourceKind;
  fileName?: string;
  fileSize?: number;
  detail?: string; // 예: "PDF · 12쪽"
  /** Storage에 보관한 원본 파일 경로 (파일 보관 기능 이전에 등록한 자료는 없음) */
  storagePath?: string;
  mimeType?: string;
}

/** 설계서 10.1 articles 테이블과 1:1 대응 (camelCase) + source */
export interface Article {
  id: string;
  title: string;
  url: string;
  body: string;
  summary: string[]; // 3줄 요약
  category: Category;
  keywords: string[];
  /** 같은 이슈의 이전 자료 — 등록 시 자동 연결(사용자가 바꿀 수 있음) */
  parentArticleId: string | null;
  source?: ArticleSource;
  createdBy: string; // user id
  createdAt: string; // ISO
  updatedAt: string;
}

export type ArticleInput = Pick<
  Article,
  "title" | "url" | "body" | "summary" | "category" | "keywords" | "parentArticleId" | "source"
>;

/** 자료별 팀 의견 (기존 '시사점' 한 줄 메모를 대체) */
export interface Comment {
  id: string;
  articleId: string;
  parentId: string | null; // 답글이면 원 댓글 id (1단계만)
  authorId: string;
  text: string;
  likes: string[]; // 공감한 user id
  createdAt: string;
}

/* ───────────── 보고서 ───────────── */

export type ReportTemplate = "trend" | "proposal" | "free";

export interface ReportSection {
  id: string;
  heading: string;
  /** 본문. 인용은 [1], [2]처럼 citations 순번으로 표시 */
  content: string;
}

export interface VerifyScores {
  evidence: number; // 근거 충실도 0~100
  balance: number; // 관점 균형 0~100
  recency: number; // 최신성 0~100
}

export interface Report {
  id: string;
  title: string;
  template: ReportTemplate;
  projectId: string | null;
  sections: ReportSection[];
  /** 인용한 자료 id — 배열 순서 + 1 이 본문의 [번호] */
  citations: string[];
  status: "작성 중" | "완료";
  verifyHistory: { at: string; scores: VerifyScores }[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** 유사 자료 찾기에 저장해 둔 프로젝트 */
export interface Project {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** 등록 시 자동으로 찾은 같은 이슈 후보 */
export interface RelatedMatch {
  article: Article;
  score: number;
  shared: string[]; // 공통 키워드
}

export interface ArticleQuery {
  q?: string;
  category?: Category | "전체";
  from?: string; // YYYY-MM-DD
  to?: string;
  page?: number;
  limit?: number;
}

export interface AnalyzeResult {
  summary: string[];
  category: Category;
  keywords: string[];
}
