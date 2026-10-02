"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { listIssues } from "@/lib/api";
import type { Article } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import PageHeader from "@/components/PageHeader";
import IssueTimeline from "@/components/IssueTimeline";
import { CategoryBadge, EmptyState } from "@/components/ui";

export default function TimelinePage() {
  const [issues, setIssues] = useState<Article[][] | null>(null);

  useEffect(() => {
    listIssues().then(setIssues);
  }, []);

  return (
    <>
      <PageHeader
        title="이슈 타임라인"
        description="후속 자료로 연결된 이슈의 흐름을 날짜순으로 확인합니다."
        action={
          <Link href="/articles/new" className="btn-brand">
            <Plus size={15} /> 자료 등록
          </Link>
        }
      />

      {issues === null && <div className="glass skeleton h-80" />}
      {issues?.length === 0 && (
        <EmptyState
          title="연결된 이슈가 아직 없어요"
          description="자료 등록 시 '후속 자료 연결'에서 이전 기사를 선택하면 이곳에 타임라인이 생깁니다."
        />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {issues?.map((thread) => {
          const root = thread[0];
          const last = thread[thread.length - 1];
          return (
            <section key={root.id} className="glass p-6">
              <div className="mb-5 border-b border-line pb-4">
                <div className="flex items-center gap-2">
                  <CategoryBadge category={root.category} />
                  <span className="text-xs text-ink-faint">
                    {formatDate(root.createdAt)} ~ {formatDate(last.createdAt)} · {thread.length}건
                  </span>
                </div>
                <h2 className="mt-2 font-bold">{root.title}</h2>
              </div>
              <IssueTimeline articles={thread} />
            </section>
          );
        })}
      </div>
    </>
  );
}
