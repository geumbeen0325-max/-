/**
 * 보고서 — Supabase reports 표에 저장 (삭제는 deleted_at 소프트 삭제).
 * 통합 보고서 작성 화면에서 고른 자료로 만들고, 3D 검증에서 근거 활용도를 점검한다.
 */
import { getUserName, listAllComments } from "./api";
import { CURRENT_USER_ID } from "./seed";
import { fromReport, must, supabase, toReport } from "./supabase";
import { CATEGORIES, type Article, type Report, type ReportSection, type VerifyScores } from "./types";
import { formatDate } from "./utils";

const section = (heading: string, content = ""): ReportSection => ({ id: crypto.randomUUID(), heading, content });

export async function listReports() {
  const rows = must(await supabase.from("reports").select("*").is("deleted_at", null).order("updated_at", { ascending: false }));
  return rows.map(toReport);
}

export async function getReport(id: string) {
  const row = must(await supabase.from("reports").select("*").eq("id", id).is("deleted_at", null).maybeSingle());
  return row ? toReport(row) : null;
}

async function createReport(opts: { title: string; sections: ReportSection[]; citations: string[] }) {
  const row = must(
    await supabase
      .from("reports")
      .insert(
        fromReport({
          title: opts.title.trim() || "제목 없는 보고서",
          template: "trend",
          projectId: null,
          sections: opts.sections,
          citations: opts.citations,
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

/* ───────────── 브리핑 → 보고서 ───────────── */

/**
 * 고른 자료로 보고서 한 건을 만든다. 자료는 등록일 순으로 [번호]를 매겨 인용하고,
 * 문장은 자료의 요약·팀 의견으로만 구성한다 (자료에 없는 사실은 만들지 않음).
 * 시사점은 팀이 직접 쓰도록 비워 둔다. 실제 AI 연동 시 /api/briefings로 교체.
 */
export async function createBriefingReport(title: string, picked: Article[]) {
  const articles = [...picked].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const citations = articles.map((a) => a.id);
  const num = new Map(citations.map((id, i) => [id, i + 1]));
  const ids = new Set(citations);
  const comments = (await listAllComments()).filter((c) => ids.has(c.articleId) && !c.parentId);

  const groups = CATEGORIES.map((category) => ({ category, list: articles.filter((a) => a.category === category) })).filter(
    (g) => g.list.length,
  );
  const first = articles[0].createdAt;
  const last = articles.at(-1)!.createdAt;

  const keywordCount = new Map<string, number>();
  articles.forEach((a) => a.keywords.forEach((k) => keywordCount.set(k, (keywordCount.get(k) ?? 0) + 1)));
  const topKeywords = [...keywordCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => `#${k}`);
  const busiest = [...groups].sort((a, b) => b.list.length - a.list.length)[0];

  const opinions = [...comments]
    .sort((a, b) => b.likes.length - a.likes.length || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6)
    .map((c) => `- ${c.text} (${getUserName(c.authorId)}) [${num.get(c.articleId)}]`);

  return createReport({
    title,
    citations,
    sections: [
      section(
        "개요",
        `${formatDate(first)} ~ ${formatDate(last)} 팀이 등록한 자료 ${articles.length}건(${groups
          .map((g) => `${g.category} ${g.list.length}건`)
          .join(" · ")})을 바탕으로 작성하였다.`,
      ),
      section(
        "분야별 주요 동향",
        groups
          .flatMap((g) => [`■ ${g.category}`, ...g.list.map((a) => `- ${a.summary.filter(Boolean).slice(0, 2).join(" ") || a.title} [${num.get(a.id)}]`)])
          .join("\n"),
      ),
      section("팀 의견", opinions.length ? opinions.join("\n") : ""),
      section(
        "종합",
        [
          `총 ${articles.length}건 중 ${busiest.category} 분야가 ${busiest.list.length}건으로 가장 많았다. [${busiest.list.map((a) => num.get(a.id)).join("][")}]`,
          topKeywords.length ? `자주 나온 키워드: ${topKeywords.join(", ")}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      ),
      section("시사점"),
    ],
  });
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

export function download(filename: string, content: string, type: string) {
  const blob = new Blob(["﻿" + content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
