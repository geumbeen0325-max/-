"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowDownUp, Box, ChevronRight, FileText, Search } from "lucide-react";
import { getUserName } from "@/lib/api";
import { listReports } from "@/lib/reports";
import type { Report } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import PageHeader from "@/components/PageHeader";
import { EmptyState } from "@/components/ui";

const TARGET = 70;

type SortKey = "updated" | "oldest" | "title" | "scoreHigh" | "scoreLow" | "citations";

const SORTS: [SortKey, string][] = [
  ["updated", "최근 수정순"],
  ["oldest", "오래된 순"],
  ["title", "제목순"],
  ["scoreHigh", "종합 점수 높은 순"],
  ["scoreLow", "종합 점수 낮은 순"],
  ["citations", "참고 자료 많은 순"],
];

/** 마지막 검증의 종합 점수 (검증 전이면 null) */
function overallScore(r: Report) {
  const s = r.verifyHistory.at(-1)?.scores;
  return s ? Math.round((s.evidence + s.balance + s.recency) / 3) : null;
}

function compare(sort: SortKey) {
  return (a: Report, b: Report) => {
    if (sort === "updated") return b.updatedAt.localeCompare(a.updatedAt);
    if (sort === "oldest") return a.updatedAt.localeCompare(b.updatedAt);
    if (sort === "title") return a.title.localeCompare(b.title, "ko");
    if (sort === "citations") return b.citations.length - a.citations.length || b.updatedAt.localeCompare(a.updatedAt);
    // 점수 정렬: 검증 전 보고서는 항상 뒤로
    const x = overallScore(a);
    const y = overallScore(b);
    if (x === null || y === null) return (x === null ? 1 : 0) - (y === null ? 1 : 0);
    return sort === "scoreHigh" ? y - x : x - y;
  };
}

export default function VerifyListPage() {
  const [all, setAll] = useState<Report[] | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("updated");

  useEffect(() => {
    listReports().then(setAll);
  }, []);

  // 제목·작성자로 찾기 (공백으로 나눈 단어가 모두 포함되어야 함)
  const reports = useMemo(() => {
    if (!all) return null;
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return all
      .filter((r) => {
        const hay = `${r.title} ${getUserName(r.createdBy)}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      })
      .sort(compare(sort));
  }, [all, q, sort]);

  return (
    <>
      <PageHeader
        title="3D 검증"
        description="보고서가 팀이 모은 근거를 충분히(근거 충실도), 고르게(관점 균형), 최신으로(최신성) 반영했는지 확인해요."
      />

      {!!all?.length && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <label className="relative min-w-[220px] flex-1 sm:max-w-[360px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="보고서 제목·작성자 검색" className="field w-full py-2 pl-9 text-sm" />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-ink-soft">
            <ArrowDownUp size={14} />
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="field py-2 text-sm" aria-label="정렬">
              {SORTS.map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <span className="ml-auto text-xs text-ink-faint">
            {reports?.length ?? 0} / {all.length}건
          </span>
        </div>
      )}

      {reports === null ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass skeleton h-20" />
          ))}
        </div>
      ) : reports.length === 0 && all?.length ? (
        <p className="glass py-12 text-center text-sm text-ink-faint">&lsquo;{q}&rsquo;에 맞는 보고서가 없어요.</p>
      ) : reports.length === 0 ? (
        <EmptyState
          title="검증할 보고서가 없어요"
          description="통합 보고서 작성에서 자료를 골라 보고서를 먼저 만들어주세요."
          action={
            <Link href="/briefing" className="btn-brand px-5 py-2.5">
              <FileText size={15} /> 통합 보고서 작성으로 가기
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => {
            const last = r.verifyHistory.at(-1)?.scores;
            const overall = overallScore(r);
            return (
              <li key={r.id}>
                <Link href={`/verify/${r.id}`} className="glass flex items-center gap-4 p-5 transition hover:bg-white/85">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-violet-50 text-violet-500">
                    <Box size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{r.title}</span>
                    <span className="mt-0.5 block text-xs text-ink-faint">
                      {formatDate(r.updatedAt)} · {getUserName(r.createdBy)} · 참고 자료 {r.citations.length}건
                    </span>
                  </span>
                  {last ? (
                    <span className="hidden gap-3 text-center text-[11px] text-ink-faint sm:flex">
                      {(
                        [
                          ["근거", last.evidence],
                          ["균형", last.balance],
                          ["최신", last.recency],
                        ] as const
                      ).map(([label, v]) => (
                        <span key={label}>
                          <span className={cn("block text-base font-bold", v >= TARGET ? "text-emerald-600" : v >= 40 ? "text-amber-500" : "text-rose-500")}>
                            {v}
                          </span>
                          {label}
                        </span>
                      ))}
                      <span>
                        <span className="block text-base font-bold text-violet-600">{overall}</span>
                        종합
                      </span>
                    </span>
                  ) : (
                    <span className="rounded-lg bg-white/80 px-2.5 py-1 text-xs text-ink-soft">검증 전</span>
                  )}
                  <ChevronRight size={18} className="text-ink-faint" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
