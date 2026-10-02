/**
 * 보고서 — Supabase reports 표에 저장 (삭제는 deleted_at 소프트 삭제).
 */
import { getUserName, listArticles, listComments, searchSimilar } from "./api";
import { CURRENT_USER_ID } from "./seed";
import { fromReport, must, supabase, toReport } from "./supabase";
import type { Article, Report, ReportSection, ReportTemplate, VerifyScores } from "./types";
import { formatDate } from "./utils";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

export async function listReports() {
  const rows = must(await supabase.from("reports").select("*").is("deleted_at", null).order("updated_at", { ascending: false }));
  return rows.map(toReport);
}

export async function getReport(id: string) {
  const row = must(await supabase.from("reports").select("*").eq("id", id).is("deleted_at", null).maybeSingle());
  return row ? toReport(row) : null;
}

export async function createReport(opts: {
  title: string;
  template: ReportTemplate;
  projectId?: string | null;
  sections?: ReportSection[];
  citations?: string[];
}) {
  const row = must(
    await supabase
      .from("reports")
      .insert(
        fromReport({
          title: opts.title.trim() || "제목 없는 보고서",
          template: opts.template,
          projectId: opts.projectId ?? null,
          sections: opts.sections ?? TEMPLATES[opts.template].headings.map((h) => section(h)),
          citations: opts.citations ?? [],
          createdBy: CURRENT_USER_ID,
        }),
      )
      .select()
      .single(),
  );
  return toReport(row);
}

/** 제목·항목·인용·상태 저장 (검증 기록은 recordVerification이 따로 관리) */
export async function saveReport(report: Report) {
  const { title, template, projectId, sections, citations, status } = report;
  const row = must(
    await supabase
      .from("reports")
      .update(fromReport({ title, template, projectId, sections, citations, status }))
      .eq("id", report.id)
      .select()
      .single(),
  );
  return toReport(row);
}

export async function deleteReport(id: string) {
  must(await supabase.from("reports").update({ deleted_at: new Date().toISOString() }).eq("id", id));
}

export async function recordVerification(id: string, scores: VerifyScores) {
  const r = await getReport(id);
  if (!r) return null;
  const last = r.verifyHistory.at(-1)?.scores;
  // 점수가 바뀌었을 때만 기록 (같은 상태로 여러 번 열어도 궤적이 늘지 않게)
  if (last && last.evidence === scores.evidence && last.balance === scores.balance && last.recency === scores.recency) return r;
  const verifyHistory = [...r.verifyHistory, { at: new Date().toISOString(), scores }].slice(-12);
  const row = must(await supabase.from("reports").update({ verify_history: verifyHistory }).eq("id", id).select().single());
  return toReport(row);
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
