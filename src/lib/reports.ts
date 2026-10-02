/**
 * 보고서 (localStorage mock) — 백엔드 연동 시 /api/reports CRUD로 교체.
 */
import { getUserName, listArticles, listComments, searchSimilar } from "./api";
import { CURRENT_USER_ID } from "./seed";
import type { Article, Report, ReportSection, ReportTemplate, VerifyScores } from "./types";
import { formatDate } from "./utils";

const REPORTS_KEY = "trend-drawer:reports";
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function read(): Report[] | null {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(REPORTS_KEY);
    return raw ? (JSON.parse(raw) as Report[]) : null;
  } catch {
    return [];
  }
}
function write(reports: Report[]) {
  try {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
  } catch {}
}

export const TEMPLATES: Record<ReportTemplate, { label: string; desc: string; headings: string[] }> = {
  trend: {
    label: "동향 보고서",
    desc: "경쟁사·시장·정책·기술 동향을 정리해 공유할 때",
    headings: ["개요", "주요 동향", "분야별 분석", "시사점", "대응 방안"],
  },
  proposal: {
    label: "프로젝트 기획서",
    desc: "새 프로젝트의 배경과 추진 계획을 제안할 때",
    headings: ["배경 및 목적", "현황 분석", "추진 방안", "기대 효과", "일정 및 과제"],
  },
  free: { label: "자유 양식", desc: "목차를 직접 구성할 때", headings: ["본문"] },
};

const section = (heading: string, content = ""): ReportSection => ({ id: crypto.randomUUID(), heading, content });

/** 처음 열 때 보여줄 예시 보고서 (3D 검증 체험용: 관련 자료 일부만 인용) */
function seedReports(): Report[] {
  const now = new Date().toISOString();
  return [
    {
      id: "r-sample",
      title: "AI 반도체 경쟁 동향 및 대응 방안",
      template: "trend",
      projectId: null,
      sections: [
        section("개요", "본 보고서는 경쟁사의 AI 반도체 전략 변화를 정리하고 우리 회사의 대응 방향을 검토한다."),
        section("주요 동향", "삼성전자가 차세대 AI 반도체 로드맵을 공개했다 [1].\n이후 AI 반도체 신제품을 공식 공개하고 클라우드 기업과 공급 협의를 진행 중이다 [2]."),
        section("분야별 분석", ""),
        section("시사점", "클라우드 공급 계약 여부가 시장 판도의 분기점이 될 것으로 보인다 [2]."),
        section("대응 방안", ""),
      ],
      citations: ["a1", "a3"],
      status: "작성 중",
      verifyHistory: [],
      createdBy: CURRENT_USER_ID,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function load(): Report[] {
  const stored = read();
  if (stored) return stored;
  const seeded = seedReports();
  write(seeded);
  return seeded;
}

export async function listReports() {
  await delay(60);
  return load().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getReport(id: string) {
  await delay(40);
  return load().find((r) => r.id === id) ?? null;
}

export async function createReport(opts: {
  title: string;
  template: ReportTemplate;
  projectId?: string | null;
  sections?: ReportSection[];
  citations?: string[];
}) {
  const now = new Date().toISOString();
  const report: Report = {
    id: crypto.randomUUID(),
    title: opts.title.trim() || "제목 없는 보고서",
    template: opts.template,
    projectId: opts.projectId ?? null,
    sections: opts.sections ?? TEMPLATES[opts.template].headings.map((h) => section(h)),
    citations: opts.citations ?? [],
    status: "작성 중",
    verifyHistory: [],
    createdBy: CURRENT_USER_ID,
    createdAt: now,
    updatedAt: now,
  };
  write([report, ...load()]);
  return report;
}

export async function saveReport(report: Report) {
  const saved = { ...report, updatedAt: new Date().toISOString() };
  write([saved, ...load().filter((r) => r.id !== report.id)]);
  return saved;
}

export async function deleteReport(id: string) {
  write(load().filter((r) => r.id !== id));
}

export async function recordVerification(id: string, scores: VerifyScores) {
  const r = load().find((x) => x.id === id);
  if (!r) return null;
  const last = r.verifyHistory.at(-1)?.scores;
  // 점수가 바뀌었을 때만 기록 (같은 상태로 여러 번 열어도 궤적이 늘지 않게)
  if (last && last.evidence === scores.evidence && last.balance === scores.balance && last.recency === scores.recency) return r;
  const updated = { ...r, verifyHistory: [...r.verifyHistory, { at: new Date().toISOString(), scores }].slice(-12) };
  write(load().map((x) => (x.id === id ? updated : x)));
  return updated;
}

export function newSection(heading = "새 항목", content = "") {
  return section(heading, content);
}

/* ───────────── 본문 도구 ───────────── */

/** 본문에 실제로 쓰인 인용 번호들 */
export function usedCitationNumbers(report: Report) {
  const used = new Set<number>();
  for (const s of report.sections) for (const m of s.content.matchAll(/\[(\d+)\]/g)) used.add(Number(m[1]));
  return used;
}

export function reportPlainText(report: Report) {
  return [report.title, ...report.sections.flatMap((s) => [s.heading, s.content])].join("\n");
}

export function referenceLine(a: Article, n: number) {
  return `[${n}] ${a.title}${a.url ? ` — ${a.url}` : ""} (${formatDate(a.createdAt)}, ${getUserName(a.createdBy)} 등록)`;
}

/* ───────────── AI 섹션 초안 (mock) ───────────── */

/**
 * 섹션 제목에 맞춰 인용 자료로 초안을 만든다. 인용 자료가 없으면 보고서 제목과 유사한 자료를 찾아 함께 인용한다.
 * 자료에 없는 사실은 만들지 않고, 자료 문장 + [번호]로만 구성한다. 실제 AI 연동 시 /api/ai/draft로 교체.
 */
export async function draftSection(report: Report, sectionId: string): Promise<{ content: string; citations: string[] }> {
  await delay(900);
  const { items } = await listArticles();
  const byId = new Map(items.map((a) => [a.id, a]));
  let citations = report.citations.filter((id) => byId.has(id));

  if (citations.length === 0) {
    const similar = await searchSimilar({ title: report.title, body: reportPlainText(report) });
    citations = similar.filter((s) => s.percent >= 20).slice(0, 4).map((s) => s.article.id);
  }
  const cited = citations.map((id, i) => ({ a: byId.get(id)!, n: i + 1 }));
  const sec = report.sections.find((s) => s.id === sectionId)!;
  const h = sec.heading;

  if (!cited.length) {
    return { content: "※ 보고서 주제와 관련된 자료를 찾지 못했어요. 오른쪽 '자료 찾기'에서 자료를 먼저 인용해주세요.", citations };
  }

  let lines: string[];
  if (/개요|목적|배경|서론/.test(h)) {
    lines = [
      `본 보고서는 '${report.title}'와 관련하여 팀이 수집한 자료 ${cited.length}건을 바탕으로 작성하였다.`,
      ...cited.slice(0, 2).map(({ a, n }) => `${a.summary[0] || a.title} [${n}]`),
    ];
  } else if (/동향|현황|분석/.test(h)) {
    const groups = new Map<string, typeof cited>();
    cited.forEach((c) => groups.set(c.a.category, [...(groups.get(c.a.category) ?? []), c]));
    lines = [...groups.entries()].flatMap(([cat, list]) => [
      `■ ${cat}`,
      ...list.map(({ a, n }) => `- ${a.summary.filter(Boolean).slice(0, 2).join(" ")} [${n}]`),
    ]);
  } else if (/시사점|결론|의견/.test(h)) {
    const opinions = (
      await Promise.all(cited.map(async ({ a, n }) => (await listComments(a.id)).filter((c) => !c.parentId).map((c) => ({ c, n }))))
    )
      .flat()
      .sort((x, y) => y.c.likes.length - x.c.likes.length)
      .slice(0, 4);
    lines = opinions.length
      ? ["팀 의견을 종합하면 다음과 같다.", ...opinions.map(({ c, n }) => `- ${c.text} (${getUserName(c.authorId)}) [${n}]`)]
      : cited.slice(0, 3).map(({ a, n }) => `- ${a.summary[2] || a.summary[0]} [${n}]`);
  } else {
    lines = [
      "※ 아래 근거를 바탕으로 구체적인 실행 내용을 직접 작성해주세요. (AI는 자료에 없는 계획을 만들지 않아요)",
      ...cited.slice(0, 3).map(({ a, n }) => `- 근거: ${a.summary[0] || a.title} [${n}]`),
      "- 실행 과제: ",
      "- 담당/일정: ",
    ];
  }
  return { content: lines.join("\n"), citations };
}

/* ───────────── 내보내기 ───────────── */

export function exportText(report: Report, articles: Map<string, Article>) {
  const refs = report.citations.map((id, i) => (articles.get(id) ? referenceLine(articles.get(id)!, i + 1) : `[${i + 1}] (삭제된 자료)`));
  return [
    report.title,
    "",
    ...report.sections.flatMap((s, i) => [`${i + 1}. ${s.heading}`, s.content.trim() || "(내용 없음)", ""]),
    refs.length ? "참고 자료" : "",
    ...refs,
  ].join("\n");
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Word에서 열리는 HTML 문서(.doc) */
export function exportWordHtml(report: Report, articles: Map<string, Article>) {
  const refs = report.citations.map((id, i) => (articles.get(id) ? referenceLine(articles.get(id)!, i + 1) : `[${i + 1}] (삭제된 자료)`));
  const body = report.sections
    .map(
      (s, i) =>
        `<h2>${i + 1}. ${esc(s.heading)}</h2>` +
        s.content
          .split("\n")
          .filter((l) => l.trim())
          .map((l) => `<p>${esc(l)}</p>`)
          .join(""),
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(report.title)}</title>
<style>body{font-family:'Malgun Gothic',sans-serif;line-height:1.7;font-size:11pt}h1{font-size:20pt}h2{font-size:14pt;margin-top:18pt;border-bottom:1px solid #ccc}.refs p{font-size:9.5pt;color:#555}</style>
</head><body><h1>${esc(report.title)}</h1><p style="color:#777">${formatDate(report.updatedAt)} · ${esc(getUserName(report.createdBy))}</p>${body}
${refs.length ? `<h2>참고 자료</h2><div class="refs">${refs.map((r) => `<p>${esc(r)}</p>`).join("")}</div>` : ""}</body></html>`;
}

export function download(filename: string, content: string, type: string) {
  const blob = new Blob(["﻿" + content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
