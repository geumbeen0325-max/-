"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Box, ChevronRight, FileText } from "lucide-react";
import { getUserName } from "@/lib/api";
import { listReports } from "@/lib/reports";
import type { Report } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import PageHeader from "@/components/PageHeader";
import { EmptyState } from "@/components/ui";

const TARGET = 70;

export default function VerifyListPage() {
  const [reports, setReports] = useState<Report[] | null>(null);

  useEffect(() => {
    listReports().then(setReports);
  }, []);

  return (
    <>
      <PageHeader
        title="3D 검증"
        description="보고서가 팀이 모은 근거를 충분히(근거 충실도), 고르게(관점 균형), 최신으로(최신성) 반영했는지 확인해요."
      />

      {reports === null ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass skeleton h-20" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <EmptyState
          title="검증할 보고서가 없어요"
          description="보고서 작성에서 자료를 골라 보고서를 먼저 만들어주세요."
          action={
            <Link href="/briefing" className="btn-brand px-5 py-2.5">
              <FileText size={15} /> 보고서 작성으로 가기
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => {
            const last = r.verifyHistory.at(-1)?.scores;
            const overall = last ? Math.round((last.evidence + last.balance + last.recency) / 3) : null;
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
