"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, RotateCcw, Search } from "lucide-react";
import { getCommentSummaries, listArticles } from "@/lib/api";
import type { Article, Category } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import { ArticleCard, ArticleCardSkeleton, CategoryFilter, EmptyState, type Discussion, type FilterValue } from "@/components/ui";

function SearchView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [q, setQ] = useState(params.get("q") ?? "");
  const category = (params.get("category") as Category | null) ?? "전체";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const appliedQ = params.get("q") ?? "";

  const [result, setResult] = useState<{ items: Article[]; total: number } | null>(null);
  const [discussions, setDiscussions] = useState<Map<string, Discussion>>(new Map());
  useEffect(() => {
    getCommentSummaries().then(setDiscussions);
  }, []);

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v && v !== "전체" ? next.set(k, v) : next.delete(k)));
    router.replace(`${pathname}?${next}`, { scroll: false });
  };

  // 입력하는 동안 디바운스로 URL에 반영
  useEffect(() => {
    if (q === appliedQ) return;
    const t = setTimeout(() => update({ q }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    let alive = true;
    listArticles({ q: appliedQ, category, from, to }).then((r) => alive && setResult(r));
    return () => {
      alive = false;
    };
  }, [appliedQ, category, from, to]);

  const filtered = appliedQ || category !== "전체" || from || to;

  return (
    <>
      <PageHeader title="통합 검색" description="제목 · 본문 · 요약 · 키워드 · 팀 의견 · 분류를 한 번에 검색합니다." />

      <div className="glass sticky top-4 z-10 space-y-4 p-5">
        <label className="relative block">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder='예: "생성형 AI", 반도체, #정책'
            className="field h-12 rounded-2xl pl-11 text-[15px]"
          />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CategoryFilter value={category} onChange={(c: FilterValue) => update({ category: c })} />
          <div className="flex items-center gap-2 text-sm">
            <CalendarDays size={15} className="text-ink-faint" />
            <input type="date" value={from} onChange={(e) => update({ from: e.target.value })} className="field w-auto px-2 py-1.5 text-xs" />
            <span className="text-ink-faint">~</span>
            <input type="date" value={to} onChange={(e) => update({ to: e.target.value })} className="field w-auto px-2 py-1.5 text-xs" />
            {filtered && (
              <button
                onClick={() => {
                  setQ("");
                  router.replace(pathname);
                }}
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-ink-faint hover:bg-white hover:text-ink"
              >
                <RotateCcw size={13} /> 초기화
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="mb-3 mt-6 text-sm text-ink-soft">
        {result ? (
          <>
            검색 결과 <b className="text-violet-600">{result.total}</b>건
          </>
        ) : (
          "검색 중…"
        )}
      </p>

      {!result ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ArticleCardSkeleton key={i} />
          ))}
        </div>
      ) : result.items.length === 0 ? (
        <EmptyState title="조건에 맞는 자료가 없습니다" description="검색어를 바꾸거나 필터를 초기화해보세요." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {result.items.map((a) => (
            <ArticleCard key={a.id} article={a} query={appliedQ} discussion={discussions.get(a.id)} />
          ))}
        </div>
      )}
    </>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchView />
    </Suspense>
  );
}
