/**
 * 보고서 3축 검증.
 *  - 근거 충실도: 보고서 주제와 관련 깊은 자료를 얼마나 인용했고, 각 항목에 근거([번호])가 달려 있는가
 *  - 관점 균형: 관련 자료가 걸쳐 있는 분야(경쟁사/시장/정책/기술)를 고루 다뤘는가
 *  - 최신성: 관련 자료 중 최근 것을 반영했는가
 * 보고서의 "내용이 맞는지"가 아니라 "팀이 모은 근거를 충분히 썼는지"를 보는 지표다.
 */
import { buildIndex, rankBySimilarity, type SimilarityResult } from "./similarity";
import { reportPlainText, usedCitationNumbers } from "./reports";
import type { Article, Category, Report, VerifyScores } from "./types";

const RELEVANT_PERCENT = 35;
const RECENT_DAYS = 30;

export interface Missed {
  result: SimilarityResult;
  reasons: string[];
}

export interface Issue {
  level: "warn" | "info";
  text: string;
}

export interface Verification {
  scores: VerifyScores;
  overall: number;
  grade: { label: string; tone: "high" | "mid" | "low" };
  relevant: SimilarityResult[];
  missed: Missed[];
  issues: Issue[];
  ranking: SimilarityResult[]; // 보고서 ↔ 전체 자료 유사도
}

export function verifyReport(report: Report, articles: Article[]): Verification {
  const ranking = rankBySimilarity(buildIndex(articles), { title: report.title, body: reportPlainText(report) });
  let relevant = ranking.filter((r) => r.percent >= RELEVANT_PERCENT).slice(0, 10);
  if (relevant.length === 0) relevant = ranking.filter((r) => r.percent >= 20).slice(0, 3);

  const cited = new Set(report.citations);
  const citedArticles = articles.filter((a) => cited.has(a.id));
  const relevantIds = new Set(relevant.map((r) => r.article.id));
  const filled = report.sections.filter((s) => s.content.trim());
  const withEvidence = filled.filter((s) => /\[\d+\]/.test(s.content));

  // 근거 충실도
  const coverage = relevant.length ? relevant.filter((r) => cited.has(r.article.id)).length / relevant.length : cited.size ? 0.6 : 0;
  // 빈 항목도 "근거 없음"으로 센다
  const density = report.sections.length ? withEvidence.length / report.sections.length : 0;
  const evidence = Math.round(100 * (0.6 * coverage + 0.4 * density));

  // 관점 균형
  const relCats = new Set<Category>(relevant.map((r) => r.article.category));
  const citedCats = new Set<Category>(citedArticles.map((a) => a.category));
  const balance = relCats.size
    ? Math.round((100 * [...relCats].filter((c) => citedCats.has(c)).length) / relCats.size)
    : Math.min(100, citedCats.size * 40);

  // 최신성
  const newest = Math.max(0, ...relevant.map((r) => new Date(r.article.createdAt).getTime()));
  const recent = relevant.filter((r) => newest - new Date(r.article.createdAt).getTime() <= RECENT_DAYS * 864e5);
  const newestRel = relevant.find((r) => new Date(r.article.createdAt).getTime() === newest);
  const recency = recent.length
    ? Math.round(100 * (0.7 * (recent.filter((r) => cited.has(r.article.id)).length / recent.length) + 0.3 * (newestRel && cited.has(newestRel.article.id) ? 1 : 0)))
    : citedArticles.length
      ? 50
      : 0;

  const scores = { evidence, balance, recency };
  const overall = Math.round((evidence + balance + recency) / 3);
  const hasEmpty = report.sections.some((s) => !s.content.trim());
  // 비어 있는 항목이 있으면 '우수'를 주지 않는다
  const grade =
    overall >= 75 && !hasEmpty
      ? { label: "우수", tone: "high" as const }
      : overall >= 50
        ? { label: hasEmpty ? "빈 항목을 채워주세요" : "보완하면 좋아요", tone: "mid" as const }
        : { label: "보완 필요", tone: "low" as const };

  // 놓친 자료: 관련 깊은데 인용하지 않은 것
  const missed: Missed[] = relevant
    .filter((r) => !cited.has(r.article.id))
    .map((r) => {
      const reasons = [`유사도 ${r.percent}%`];
      if (!citedCats.has(r.article.category)) reasons.push(`다루지 않은 관점: ${r.article.category}`);
      if (recent.some((x) => x.article.id === r.article.id)) reasons.push("최근 자료");
      return { result: r, reasons };
    });

  // 구조 점검
  const issues: Issue[] = [];
  const empty = report.sections.filter((s) => !s.content.trim());
  if (empty.length) issues.push({ level: "warn", text: `비어 있는 항목: ${empty.map((s) => s.heading).join(", ")}` });
  const noEvidence = filled.filter((s) => !/\[\d+\]/.test(s.content));
  if (noEvidence.length) issues.push({ level: "info", text: `근거 표시가 없는 항목: ${noEvidence.map((s) => s.heading).join(", ")}` });
  const used = usedCitationNumbers(report);
  const orphan = [...used].filter((n) => n < 1 || n > report.citations.length);
  if (orphan.length) issues.push({ level: "warn", text: `참고 자료 목록에 없는 번호: ${orphan.map((n) => `[${n}]`).join(" ")}` });
  const unused = report.citations.map((_, i) => i + 1).filter((n) => !used.has(n));
  if (unused.length) issues.push({ level: "info", text: `본문에서 쓰지 않은 참고 자료: ${unused.map((n) => `[${n}]`).join(" ")}` });
  const offTopic = citedArticles.filter((a) => !relevantIds.has(a.id) && (ranking.find((r) => r.article.id === a.id)?.percent ?? 0) < 20);
  if (offTopic.length) issues.push({ level: "info", text: `주제와 관련이 적어 보이는 인용: ${offTopic.map((a) => `'${a.title}'`).join(", ")}` });

  return { scores, overall, grade, relevant, missed, issues, ranking };
}
