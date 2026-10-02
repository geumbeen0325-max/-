/**
 * 프론트엔드용 API 클라이언트.
 *
 * 현재는 백엔드가 없으므로 localStorage 기반 mock으로 동작한다.
 * 함수 시그니처는 설계서 11~13장의 REST API와 1:1로 맞춰 두었으므로,
 * 백엔드 구현 후에는 각 함수 본문만 fetch("/api/...") 호출로 바꾸면 된다.
 */
import { CURRENT_USER_ID, SEED_ARTICLES, SEED_COMMENTS, USERS } from "./seed";
import {
  CATEGORIES,
  type AnalyzeResult,
  type Article,
  type ArticleInput,
  type ArticleQuery,
  type Briefing,
  type BriefingSection,
  type Category,
  type Comment,
  type Project,
  type RelatedMatch,
  type SourceKind,
  type User,
} from "./types";
import { normalizeTitle, normalizeUrl, toDateInput, weekLabel } from "./utils";
import { buildIndex, rankBySimilarity, type DocInput } from "./similarity";

const ARTICLES_KEY = "trend-drawer:articles";
const BRIEFINGS_KEY = "trend-drawer:briefings";
const COMMENTS_KEY = "trend-drawer:comments";
const PROJECTS_KEY = "trend-drawer:projects";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {}
  return fallback;
}

function write<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function loadArticles(): Article[] {
  const stored = read<Article[] | null>(ARTICLES_KEY, null);
  if (stored) return stored;
  write(ARTICLES_KEY, SEED_ARTICLES);
  return SEED_ARTICLES;
}

/**
 * 댓글 저장소. 처음 읽을 때 이전 버전의 '시사점'(article.insight)을
 * 등록자의 첫 댓글로 옮긴다.
 */
function loadComments(): Comment[] {
  const stored = read<Comment[] | null>(COMMENTS_KEY, null);
  if (stored) return stored;

  const seedIds = new Set(SEED_ARTICLES.map((a) => a.id));
  const legacy = loadArticles() as (Article & { insight?: string })[];
  const migrated: Comment[] = legacy
    .filter((a) => !seedIds.has(a.id) && a.insight?.trim())
    .map((a) => ({
      id: crypto.randomUUID(),
      articleId: a.id,
      parentId: null,
      authorId: a.createdBy,
      text: a.insight!.trim(),
      likes: [],
      createdAt: a.createdAt,
    }));
  const ids = new Set(legacy.map((a) => a.id));
  const comments = [...SEED_COMMENTS.filter((c) => ids.has(c.articleId)), ...migrated];
  write(COMMENTS_KEY, comments);
  write(
    ARTICLES_KEY,
    legacy.map((a) => {
      const copy = { ...a };
      delete copy.insight;
      return copy;
    }),
  );
  return comments;
}

const byNewest = (a: Article, b: Article) => b.createdAt.localeCompare(a.createdAt);

/* ───────────── 사용자 ───────────── */

export function getUsers(): User[] {
  return USERS;
}

export function getCurrentUser(): User {
  return USERS.find((u) => u.id === CURRENT_USER_ID)!;
}

export function getUserName(id: string) {
  return USERS.find((u) => u.id === id)?.name ?? "알 수 없음";
}

/* ───────────── 자료 (11장) ───────────── */

function matches(a: Article, q: string, commentText: string) {
  const needle = q.trim().toLowerCase().replace(/^#/, "");
  if (!needle) return true;
  const haystack = [a.title, a.body, a.summary.join(" "), a.keywords.join(" "), commentText, a.category]
    .join(" ")
    .toLowerCase();
  // 공백으로 나뉜 모든 단어가 포함되어야 함 (AND)
  return needle.split(/\s+/).every((w) => haystack.includes(w));
}

/** GET /api/articles?q=&category=&from=&to=&page=&limit= — 검색 대상에 팀 의견(댓글) 포함 */
export async function listArticles(query: ArticleQuery = {}) {
  await delay(120);
  const { q = "", category = "전체", from, to, page = 1, limit = 100 } = query;
  const commentText = new Map<string, string>();
  if (q.trim()) {
    for (const c of loadComments()) commentText.set(c.articleId, `${commentText.get(c.articleId) ?? ""} ${c.text}`);
  }
  const filtered = loadArticles()
    .filter((a) => matches(a, q, commentText.get(a.id) ?? ""))
    .filter((a) => category === "전체" || a.category === category)
    .filter((a) => !from || toDateInput(new Date(a.createdAt)) >= from)
    .filter((a) => !to || toDateInput(new Date(a.createdAt)) <= to)
    .sort(byNewest);
  return {
    items: filtered.slice((page - 1) * limit, page * limit),
    total: filtered.length,
  };
}

/** GET /api/articles/:id */
export async function getArticle(id: string) {
  await delay(80);
  return loadArticles().find((a) => a.id === id) ?? null;
}

/** POST /api/articles — firstComment가 있으면 등록자의 첫 의견으로 함께 남긴다 */
export async function createArticle(input: ArticleInput, firstComment?: string) {
  await delay(200);
  const now = new Date().toISOString();
  const article: Article = {
    ...input,
    title: input.title.trim(),
    url: input.url.trim(),
    id: crypto.randomUUID(),
    createdBy: CURRENT_USER_ID,
    createdAt: now,
    updatedAt: now,
  };
  write(ARTICLES_KEY, [article, ...loadArticles()]);
  if (firstComment?.trim()) await addComment(article.id, firstComment);
  return article;
}

/** PATCH /api/articles/:id */
export async function updateArticle(id: string, patch: Partial<ArticleInput>) {
  await delay(150);
  const articles = loadArticles();
  const idx = articles.findIndex((a) => a.id === id);
  if (idx < 0) throw new Error("자료를 찾을 수 없습니다.");
  articles[idx] = { ...articles[idx], ...patch, updatedAt: new Date().toISOString() };
  write(ARTICLES_KEY, articles);
  return articles[idx];
}

/** DELETE /api/articles/:id — 후속 자료의 연결은 끊고 남겨둔다 */
export async function deleteArticle(id: string) {
  await delay(150);
  const articles = loadArticles()
    .filter((a) => a.id !== id)
    .map((a) => (a.parentArticleId === id ? { ...a, parentArticleId: null } : a));
  write(ARTICLES_KEY, articles);
  write(COMMENTS_KEY, loadComments().filter((c) => c.articleId !== id));
}

/* ───────────── 팀 의견(댓글) ───────────── */

/** GET /api/articles/:id/comments — 작성순 */
export async function listComments(articleId: string) {
  await delay(60);
  return loadComments()
    .filter((c) => c.articleId === articleId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** POST /api/articles/:id/comments */
export async function addComment(articleId: string, text: string, parentId: string | null = null) {
  const comment: Comment = {
    id: crypto.randomUUID(),
    articleId,
    parentId,
    authorId: CURRENT_USER_ID,
    text: text.trim(),
    likes: [],
    createdAt: new Date().toISOString(),
  };
  write(COMMENTS_KEY, [...loadComments(), comment]);
  return comment;
}

/** PATCH /api/comments/:id */
export async function editComment(id: string, text: string) {
  write(COMMENTS_KEY, loadComments().map((c) => (c.id === id ? { ...c, text: text.trim() } : c)));
}

/** DELETE /api/comments/:id — 답글도 함께 삭제 */
export async function deleteComment(id: string) {
  write(COMMENTS_KEY, loadComments().filter((c) => c.id !== id && c.parentId !== id));
}

/** POST /api/comments/:id/like — 공감 토글 */
export async function toggleLike(id: string) {
  write(
    COMMENTS_KEY,
    loadComments().map((c) =>
      c.id === id
        ? { ...c, likes: c.likes.includes(CURRENT_USER_ID) ? c.likes.filter((u) => u !== CURRENT_USER_ID) : [...c.likes, CURRENT_USER_ID] }
        : c,
    ),
  );
}

/** 카드·목록용: 자료별 댓글 수와 대표 의견(공감 많은 → 최신) */
export async function getCommentSummaries() {
  const map = new Map<string, { count: number; top: Comment | null }>();
  for (const c of loadComments()) {
    const s = map.get(c.articleId) ?? { count: 0, top: null };
    s.count++;
    if (!c.parentId && (!s.top || c.likes.length > s.top.likes.length || (c.likes.length === s.top.likes.length && c.createdAt > s.top.createdAt)))
      s.top = c;
    map.set(c.articleId, s);
  }
  return map;
}

/** 최근 팀 의견 (홈 화면) */
export async function listRecentComments(limit = 5) {
  const articles = new Map(loadArticles().map((a) => [a.id, a]));
  return loadComments()
    .filter((c) => articles.has(c.articleId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map((c) => ({ comment: c, article: articles.get(c.articleId)! }));
}

/* ───────────── 유사 자료 찾기 ───────────── */

/** POST /api/similar — 프로젝트 설명(또는 임의의 글)과 비슷한 자료를 유사도 순으로 */
export async function searchSimilar(query: DocInput, opts: { excludeId?: string; limit?: number } = {}) {
  await delay(250);
  return rankBySimilarity(buildIndex(loadArticles()), query, opts);
}

/** GET /api/articles/:id/similar — 자료 ↔ 자료 유사도 */
export async function getSimilarArticles(id: string, limit = 5) {
  await delay(80);
  const articles = loadArticles();
  const me = articles.find((a) => a.id === id);
  if (!me) return [];
  return rankBySimilarity(buildIndex(articles), me, { excludeId: id, limit });
}

/** 저장해 둔 프로젝트 (유사 자료 찾기의 질의) */
export async function listProjects(): Promise<Project[]> {
  return read<Project[]>(PROJECTS_KEY, []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveProject(p: Pick<Project, "name" | "description"> & { id?: string }) {
  const all = read<Project[]>(PROJECTS_KEY, []);
  const now = new Date().toISOString();
  const existing = p.id ? all.find((x) => x.id === p.id) : undefined;
  const project: Project = existing
    ? { ...existing, name: p.name.trim(), description: p.description, updatedAt: now }
    : { id: crypto.randomUUID(), name: p.name.trim(), description: p.description, createdBy: CURRENT_USER_ID, createdAt: now, updatedAt: now };
  write(PROJECTS_KEY, [project, ...all.filter((x) => x.id !== project.id)]);
  return project;
}

export async function deleteProject(id: string) {
  write(PROJECTS_KEY, read<Project[]>(PROJECTS_KEY, []).filter((p) => p.id !== id));
}

/* ───────────── 같은 이슈 자동 연결 ───────────── */

/** 공통 단어 희귀도 합이 이 값 이상이면 같은 이슈로 본다 (시드 데이터로 조정) */
const RELATED_THRESHOLD = 2.5;
// 어느 이슈에나 나오는 일반 단어·분류명은 이슈 판단에서 제외
const TITLE_STOP = new Set([
  "발표", "공개", "전망", "확대", "강화", "추진", "관련", "위한", "대한", "올해", "내년",
  "신규", "출시", "신제품", "본격화", "가속화", "개편",
  "경쟁사", "시장", "정책", "기술", "정부", "업계", "시장동향",
]);

/** 비교용 단어 집합: 키워드 + 제목 단어(조사 제거) */
function termsOf(title: string, keywords: string[]) {
  const set = new Set(keywords.map((k) => k.toLowerCase().replace(/\s+/g, "")).filter((k) => !TITLE_STOP.has(k)));
  for (const raw of title.split(/[\s,.'"“”‘’()·…!?|[\]:]+/)) {
    const w = raw.replace(/(은|는|이|가|을|를|의|에|에서|으로|로|와|과|도|만)$/, "").toLowerCase();
    if (w.length >= 2 && !TITLE_STOP.has(w) && !/^\d+$/.test(w)) set.add(w);
  }
  return set;
}

/**
 * 새 자료와 같은 이슈로 보이는 기존 자료 찾기.
 * 공통 단어마다 희귀도(IDF) 가중치를 줘서 "AI"처럼 흔한 단어만 겹칠 땐 연결하지 않는다.
 * 실제 AI 연동 후에는 임베딩 유사도로 교체할 자리.
 */
export async function findRelatedArticles(title: string, keywords: string[], excludeId?: string): Promise<RelatedMatch[]> {
  const articles = loadArticles().filter((a) => a.id !== excludeId);
  if (!articles.length) return [];
  const docs = articles.map((a) => ({ a, terms: termsOf(a.title, a.keywords) }));
  const df = new Map<string, number>();
  docs.forEach((d) => d.terms.forEach((t) => df.set(t, (df.get(t) ?? 0) + 1)));
  const idf = (t: string) => Math.log((docs.length + 1) / ((df.get(t) ?? 0) + 1)) + 0.2;

  const mine = termsOf(title, keywords);
  return docs
    .map(({ a, terms }) => {
      const shared = [...mine].filter((t) => terms.has(t));
      return { article: a, shared, score: shared.reduce((s, t) => s + idf(t), 0) };
    })
    .filter((m) => m.shared.length >= 2 && m.score >= RELATED_THRESHOLD)
    .sort((x, y) => y.score - x.score || y.article.createdAt.localeCompare(x.article.createdAt))
    .slice(0, 3);
}

/* ───────────── 중복 검사 (6장, 16장) ───────────── */

export interface DuplicateHit {
  article: Article;
  reason: "url" | "title";
}

/** URL 동일 OR 제목 동일. URL이 비어 있으면 URL 조건은 제외 */
export async function checkDuplicate(title: string, url: string): Promise<DuplicateHit[]> {
  await delay(150);
  const t = normalizeTitle(title);
  const u = url.trim() ? normalizeUrl(url) : "";
  const hits: DuplicateHit[] = [];
  for (const a of loadArticles()) {
    if (u && normalizeUrl(a.url) === u) hits.push({ article: a, reason: "url" });
    else if (t && normalizeTitle(a.title) === t) hits.push({ article: a, reason: "title" });
  }
  return hits.slice(0, 10);
}

/* ───────────── 후속 자료 타임라인 (7장) ───────────── */

/** 해당 자료가 속한 이슈(루트 + 모든 후속 자료)를 날짜순으로 반환 */
export async function getIssueThread(id: string) {
  await delay(80);
  const articles = loadArticles();
  const map = new Map(articles.map((a) => [a.id, a]));
  let root = map.get(id);
  const seen = new Set<string>();
  while (root?.parentArticleId && map.has(root.parentArticleId) && !seen.has(root.id)) {
    seen.add(root.id);
    root = map.get(root.parentArticleId);
  }
  if (!root) return [];
  const thread: Article[] = [];
  const queue = [root];
  while (queue.length) {
    const cur = queue.shift()!;
    thread.push(cur);
    queue.push(...articles.filter((a) => a.parentArticleId === cur.id));
  }
  return thread.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** 후속 자료가 1건 이상 연결된 이슈 목록 */
export async function listIssues() {
  const articles = loadArticles();
  const roots = articles.filter(
    (a) => !a.parentArticleId && articles.some((b) => b.parentArticleId === a.id),
  );
  const threads = await Promise.all(roots.map((r) => getIssueThread(r.id)));
  return threads.sort((a, b) => b[b.length - 1].createdAt.localeCompare(a[a.length - 1].createdAt));
}

/* ───────────── 자료 넣기: 링크·파일 → 제목/본문 추출 ───────────── */
/* 이 두 함수는 mock이 아니라 실제 서버 라우트(/api/extract)를 호출한다 */

export interface ExtractResult {
  kind: SourceKind;
  title: string;
  body: string;
  detail: string;
  warning?: string;
  url?: string;
}

async function readResult(res: Response, fallback: string): Promise<ExtractResult> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? fallback);
  return data as ExtractResult;
}

/** GET /api/extract?url= — 웹페이지, 파일 링크, 구글 문서/드라이브 공유 링크 */
export async function extractFromUrl(url: string) {
  return readResult(await fetch(`/api/extract?url=${encodeURIComponent(url)}`), "링크 내용을 불러오지 못했습니다.");
}

/** POST /api/extract — 파일 업로드 */
export async function extractFromFile(file: File) {
  const form = new FormData();
  form.append("file", file);
  return readResult(await fetch("/api/extract", { method: "POST", body: form }), "파일을 읽지 못했습니다.");
}

/* ───────────── AI 분석 (12장) — mock ───────────── */

const CATEGORY_HINTS: Record<Category, string[]> = {
  경쟁사: ["경쟁사", "삼성", "LG", "SK", "네이버", "카카오", "애플", "구글", "출시", "신제품", "인수", "점유율"],
  시장: ["시장", "수요", "성장", "규모", "전망", "소비", "매출", "투자", "파트너십", "업계"],
  정책: ["정부", "정책", "규제", "법", "위원회", "가이드라인", "지원", "세제", "부처", "국회"],
  기술: ["기술", "AI", "칩", "알고리즘", "모델", "개발", "특허", "플랫폼", "클라우드", "반도체"],
};

const STOPWORDS = new Set(["있다", "했다", "밝혔다", "것으로", "이번", "대한", "위해", "통해", "따르면", "있는", "등", "및"]);

/** POST /api/ai/analyze — 실제 AI 연동 전까지는 본문 기반 규칙으로 흉내낸다 */
export async function analyzeArticle(title: string, body: string): Promise<AnalyzeResult> {
  await delay(1200);
  const text = body.trim();
  if (text.length < 40) throw new Error("AI 분석에 실패했습니다.");

  // 표 행("a | b")·시트/슬라이드 머리글("[시트: …]")은 문장이 아니므로 제외
  const isStructural = (s: string) => s.includes(" | ") || /^\[(시트|슬라이드)/.test(s);
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8 && !isStructural(s));
  // 표 위주 자료는 문장이 부족하므로 시트 머리글(열 이름)로 보충
  const headers = text.split("\n").filter((l) => /^\[(시트|슬라이드)/.test(l));
  const pool = [...sentences, ...headers.map((h) => h.replace(/^\[시트: ([^\]]+)\]\s*/, "'$1' 시트: ").replace(/^\[슬라이드 (\d+)\]/, "슬라이드 $1"))];
  const summary = [0, 1, 2].map((i) => pool[i] ?? "");

  const source = `${title} ${text}`;
  const scores = CATEGORIES.map((c) => ({
    c,
    score: CATEGORY_HINTS[c].reduce((n, w) => n + (source.split(w).length - 1), 0),
  }));
  const category = scores.sort((a, b) => b.score - a.score)[0].c;

  const freq = new Map<string, number>();
  for (const raw of source.split(/[\s,.'"“”‘’()·…!?|[\]:_]+/)) {
    const word = raw.replace(/(은|는|이|가|을|를|의|에|에서|으로|로|와|과|도|만)$/, "");
    if (word.length < 2 || STOPWORDS.has(word) || /^[\d%]+$/.test(word) || /^(시트|슬라이드|열)$/.test(word)) continue;
    freq.set(word, (freq.get(word) ?? 0) + (title.includes(word) ? 3 : 1));
  }
  const keywords = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([w]) => w);

  return { summary, category, keywords };
}

/* ───────────── 주간 브리핑 (8장, 13장) ───────────── */

export async function listBriefings(): Promise<Briefing[]> {
  return read<Briefing[]>(BRIEFINGS_KEY, []);
}

/** POST /api/briefings/weekly */
export async function generateWeeklyBriefing(start: Date, end: Date): Promise<Briefing> {
  await delay(1500);
  const { items } = await listArticles({ from: toDateInput(start), to: toDateInput(end) });
  const comments = loadComments();

  const sections: BriefingSection[] = CATEGORIES.map((category) => {
    const list = items.filter((a) => a.category === category);
    const ids = new Set(list.map((a) => a.id));
    // 해당 분야 자료에 달린 팀 의견 중 공감이 많은 순으로 3개
    const opinions = comments
      .filter((c) => ids.has(c.articleId))
      .sort((a, b) => b.likes.length - a.likes.length || b.createdAt.localeCompare(a.createdAt))
      .slice(0, 3)
      .map((c) => ({ author: getUserName(c.authorId), text: c.text }));
    return {
      category,
      articleCount: list.length,
      changes: list.slice(0, 3).map((a) => a.summary[0] || a.title),
      articles: list.map((a) => ({ id: a.id, title: a.title })),
      opinions,
    };
  });

  const keywordCount = new Map<string, number>();
  items.forEach((a) => a.keywords.forEach((k) => keywordCount.set(k, (keywordCount.get(k) ?? 0) + 1)));
  const topKeywords = [...keywordCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => `#${k}`);
  const busiest = [...sections].sort((a, b) => b.articleCount - a.articleCount)[0];

  const overall = items.length
    ? [
        `이번 주 총 ${items.length}건의 자료가 등록되었으며, ${busiest.category} 분야가 ${busiest.articleCount}건으로 가장 많았습니다.`,
        topKeywords.length ? `주요 키워드는 ${topKeywords.join(", ")} 입니다.` : "",
        `팀원들이 남긴 의견 ${comments.filter((c) => items.some((a) => a.id === c.articleId)).length}건을 바탕으로 다음 주 중점 모니터링 항목을 확정할 필요가 있습니다.`,
      ].filter(Boolean)
    : ["이번 주 등록된 자료가 없습니다."];

  const label = weekLabel(start);
  const content = [
    `${label} 동향 브리핑`,
    `(${toDateInput(start)} ~ ${toDateInput(end)}, 총 ${items.length}건)`,
    "",
    ...sections.flatMap((s) => [
      `[${s.category}] ${s.articleCount}건`,
      ...(s.articleCount
        ? [
            "■ 주요 변화",
            ...s.changes.map((c) => `- ${c}`),
            "■ 주요 기사",
            ...s.articles.map((a) => `- ${a.title}`),
            "■ 팀 의견",
            ...(s.opinions.length ? s.opinions.map((o) => `- ${o.text} (${o.author})`) : ["- 아직 의견 없음"]),
          ]
        : ["- 등록된 자료 없음"]),
      "",
    ]),
    "[종합]",
    ...overall.map((o) => `- ${o}`),
  ].join("\n");

  const briefing: Briefing = {
    id: crypto.randomUUID(),
    weekStart: toDateInput(start),
    weekEnd: toDateInput(end),
    sections,
    overall,
    content,
    articleCount: items.length,
    createdBy: CURRENT_USER_ID,
    createdAt: new Date().toISOString(),
  };
  const others = (await listBriefings()).filter((b) => b.weekStart !== briefing.weekStart);
  write(BRIEFINGS_KEY, [briefing, ...others].slice(0, 20));
  return briefing;
}
