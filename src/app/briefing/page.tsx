"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Copy, FileText, LoaderCircle, NotebookPen, Sparkles } from "lucide-react";
import { generateWeeklyBriefing, listArticles, listBriefings } from "@/lib/api";
import { createReport, newSection } from "@/lib/reports";
import { CATEGORIES, type Article, type Briefing } from "@/lib/types";
import { CATEGORY_STYLE, cn, formatDate, toDateInput, weekLabel, weekRange } from "@/lib/utils";
import PageHeader from "@/components/PageHeader";
import { CATEGORY_ICON, CategoryBadge } from "@/components/ui";

function BriefingView() {
  const auto = useSearchParams().get("auto") === "1";
  const router = useRouter();
  const [offset, setOffset] = useState(0);
  const { start, end } = weekRange(new Date(), offset);
  const startKey = toDateInput(start);

  const [articles, setArticles] = useState<Article[] | null>(null);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<Briefing[]>([]);
  const autoRan = useRef(false);

  function changeWeek(next: number) {
    setOffset(next);
    setArticles(null);
    setBriefing(null);
    setDraft("");
  }

  useEffect(() => {
    const { start, end } = weekRange(new Date(), offset);
    listArticles({ from: toDateInput(start), to: toDateInput(end) }).then((r) => setArticles(r.items));
    listBriefings().then((all) => {
      setHistory(all);
      const saved = all.find((b) => b.weekStart === toDateInput(start));
      if (saved) {
        setBriefing(saved);
        setDraft(saved.content);
      }
    });
  }, [offset]);

  async function generate() {
    setLoading(true);
    const b = await generateWeeklyBriefing(start, end);
    setBriefing(b);
    setDraft(b.content);
    setHistory(await listBriefings());
    setLoading(false);
  }

  useEffect(() => {
    if (auto && !autoRan.current && articles) {
      autoRan.current = true;
      generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, articles]);

  /** 브리핑 결과로 동향 보고서를 만들고 편집 화면으로 이동 (기사는 참고 자료로 인용) */
  async function toReport() {
    if (!briefing) return;
    const citations = briefing.sections.flatMap((s) => s.articles.map((a) => a.id));
    const num = (id: string) => citations.indexOf(id) + 1;
    const byCat = briefing.sections.filter((s) => s.articleCount > 0);
    const r = await createReport({
      title: `${weekLabel(start)} 동향 보고`,
      template: "trend",
      citations,
      sections: [
        newSection("개요", `${formatDate(start.toISOString())} ~ ${formatDate(end.toISOString())} 팀이 등록한 자료 ${briefing.articleCount}건을 분야별로 정리하였다.`),
        newSection(
          "주요 동향",
          byCat.flatMap((s) => [`■ ${s.category}`, ...s.changes.map((c, i) => `- ${c} [${num(s.articles[i]?.id ?? "")}]`)]).join("\n"),
        ),
        newSection(
          "팀 의견",
          byCat.flatMap((s) => s.opinions ?? []).map((o) => `- ${o.text} (${o.author})`).join("\n"),
        ),
        newSection("시사점", ""),
        newSection("대응 방안", ""),
      ],
    });
    router.push(`/reports/${r.id}`);
  }

  async function copy() {
    await navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <>
      <PageHeader title="주간 동향 브리핑" description="이번 주 등록 자료를 분류별로 모아 보고서 초안을 만듭니다." />

      {/* 주 선택 + 집계 */}
      <section className="glass p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button onClick={() => changeWeek(offset - 1)} aria-label="이전 주" className="rounded-lg p-1.5 hover:bg-white">
              <ChevronLeft size={18} />
            </button>
            <div className="text-center">
              <p className="text-lg font-bold">{weekLabel(start)}</p>
              <p className="text-xs text-ink-faint">
                {formatDate(start.toISOString())} ~ {formatDate(end.toISOString())}
              </p>
            </div>
            <button
              onClick={() => changeWeek(offset + 1)}
              disabled={offset >= 0}
              aria-label="다음 주"
              className="rounded-lg p-1.5 hover:bg-white disabled:opacity-30"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <button onClick={generate} disabled={loading || !articles?.length} className="btn-brand px-6 py-3">
            {loading ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {loading ? "브리핑 생성 중…" : briefing ? "브리핑 다시 생성" : "AI 브리핑 생성"}
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
          <div className="rounded-2xl bg-white/70 p-4">
            <p className="text-xs text-ink-faint">전체</p>
            <p className="mt-1 text-2xl font-bold">{articles?.length ?? "–"}</p>
          </div>
          {CATEGORIES.map((c) => {
            const Icon = CATEGORY_ICON[c];
            return (
              <div key={c} className={cn("rounded-2xl p-4", CATEGORY_STYLE[c].soft)}>
                <p className={cn("flex items-center gap-1.5 text-xs font-medium", CATEGORY_STYLE[c].text)}>
                  <Icon size={13} /> {c}
                </p>
                <p className="mt-1 text-2xl font-bold">{articles?.filter((a) => a.category === c).length ?? "–"}</p>
              </div>
            );
          })}
        </div>
        {articles?.length === 0 && (
          <p className="mt-4 text-center text-sm text-ink-faint">
            이 주에 등록된 자료가 없어 브리핑을 생성할 수 없어요.{" "}
            <Link href="/articles/new" className="text-violet-500 underline">
              자료 등록하기
            </Link>
          </p>
        )}
      </section>

      {loading && (
        <div className="glass mt-6 space-y-3 p-6">
          <p className="flex items-center gap-2 text-sm text-ink-soft">
            <LoaderCircle size={15} className="animate-spin" /> 분류별 자료 그룹화 → 요약 취합 → 주요 이슈 추출 중…
          </p>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-16" />
          ))}
        </div>
      )}

      {briefing && !loading && (
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* 분류별 브리핑 */}
          <section className="space-y-4">
            {briefing.sections.map((s) => (
              <div key={s.category} className="glass p-5">
                <div className="flex items-center justify-between">
                  <CategoryBadge category={s.category} className="px-2.5 py-1 text-xs" />
                  <span className="text-xs text-ink-faint">{s.articleCount}건</span>
                </div>
                {s.articleCount === 0 ? (
                  <p className="mt-3 text-sm text-ink-faint">등록된 자료 없음</p>
                ) : (
                  <dl className="mt-3 space-y-3 text-sm">
                    <div>
                      <dt className="text-xs font-bold text-ink-soft">주요 변화</dt>
                      <dd>
                        <ul className="mt-1 list-disc space-y-0.5 pl-4">
                          {s.changes.map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold text-ink-soft">주요 기사</dt>
                      <dd className="mt-1 flex flex-wrap gap-1.5">
                        {s.articles.map((a) => (
                          <Link key={a.id} href={`/articles/${a.id}`} className="rounded-lg bg-white/80 px-2 py-1 text-xs hover:text-violet-600">
                            {a.title}
                          </Link>
                        ))}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold text-ink-soft">팀 의견</dt>
                      <dd>
                        {(s.opinions ?? []).length === 0 ? (
                          <p className="mt-1 text-xs text-ink-faint">아직 의견 없음</p>
                        ) : (
                          <ul className="mt-1 space-y-1 text-ink-soft">
                            {(s.opinions ?? []).map((o, i) => (
                              <li key={i} className="rounded-lg bg-white/70 px-2.5 py-1.5 text-[13px]">
                                “{o.text}” <span className="text-xs text-ink-faint">— {o.author}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </dd>
                    </div>
                  </dl>
                )}
              </div>
            ))}
            <div className="glass bg-gradient-to-br from-violet-50/80 to-pink-50/80 p-5">
              <h3 className="font-bold">종합</h3>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-ink-soft">
                {briefing.overall.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            </div>
          </section>

          {/* 보고서 초안 */}
          <section className="glass flex flex-col p-5 xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)]">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-bold">
                <FileText size={16} /> 보고서 초안
              </h3>
              <div className="flex gap-1.5">
                <button onClick={copy} className="btn-ghost px-3 py-1.5 text-xs">
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? "복사됨" : "복사"}
                </button>
                <button onClick={toReport} className="btn-brand px-3 py-1.5 text-xs">
                  <NotebookPen size={13} /> 보고서로 만들기
                </button>
              </div>
            </div>
            <p className="mb-3 text-xs text-ink-faint">AI 초안을 바탕으로 최종 보고서 문장을 자유롭게 다듬으세요.</p>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="field min-h-[480px] flex-1 resize-none text-[13px] leading-6"
            />
            <p className="mt-2 text-right text-[11px] text-ink-faint">생성: {formatDate(briefing.createdAt)}</p>
          </section>
        </div>
      )}

      {history.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-bold text-ink-soft">지난 브리핑</h2>
          <div className="flex flex-wrap gap-2">
            {history.map((b) => {
              const s = new Date(b.weekStart + "T00:00:00");
              const off = Math.round((s.getTime() - weekRange().start.getTime()) / (7 * 864e5));
              return (
                <button
                  key={b.id}
                  onClick={() => changeWeek(off)}
                  className={cn(
                    "rounded-xl px-3 py-2 text-xs transition",
                    b.weekStart === startKey ? "bg-violet-100 text-violet-700" : "bg-white/70 text-ink-soft hover:bg-white",
                  )}
                >
                  {weekLabel(s)} · {b.articleCount}건
                </button>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}

export default function BriefingPage() {
  return (
    <Suspense>
      <BriefingView />
    </Suspense>
  );
}
