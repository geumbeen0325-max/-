"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, ExternalLink, GitBranch, Pencil, ScanSearch, Trash, User } from "lucide-react";
import { deleteArticle, getArticle, getCurrentUser, getIssueThread, getSimilarArticles, getUserName } from "@/lib/api";
import type { SimilarityResult } from "@/lib/similarity";
import { SimilarityBar } from "@/components/SimilarityMeter";
import type { Article } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import { CategoryBadge, CategoryThumb, EmptyState, Keywords } from "@/components/ui";
import IssueTimeline from "@/components/IssueTimeline";
import { SourceBadge } from "@/components/SourceIcon";
import CommentThread from "@/components/CommentThread";

export default function ArticleDetailPage({ params }: PageProps<"/articles/[id]">) {
  const { id } = use(params);
  const router = useRouter();
  const [article, setArticle] = useState<Article | null | undefined>(undefined);
  const [thread, setThread] = useState<Article[]>([]);
  const [showBody, setShowBody] = useState(false);
  const [similar, setSimilar] = useState<SimilarityResult[] | null>(null);
  const me = getCurrentUser();

  useEffect(() => {
    getArticle(id).then(setArticle);
    getIssueThread(id).then(setThread);
    getSimilarArticles(id, 5).then((r) => setSimilar(r.filter((s) => s.percent >= 15)));
  }, [id]);

  if (article === undefined) return <div className="glass skeleton h-[480px]" />;
  if (article === null)
    return (
      <EmptyState
        title="자료를 찾을 수 없습니다"
        description="삭제되었거나 잘못된 주소입니다."
        action={
          <Link href="/" className="btn-ghost">
            홈으로
          </Link>
        }
      />
    );

  const canEdit = me.role === "admin" || me.id === article.createdBy;

  async function remove() {
    if (!confirm("이 자료를 삭제할까요? 연결된 후속 자료의 연결도 해제됩니다.")) return;
    await deleteArticle(id);
    router.push("/");
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <article className="glass p-6 md:p-8">
        <button onClick={() => router.back()} className="mb-6 flex items-center gap-1.5 text-sm text-ink-faint hover:text-ink">
          <ArrowLeft size={15} /> 목록으로
        </button>

        <div className="flex gap-5">
          <CategoryThumb category={article.category} size={72} />
          <div className="min-w-0 flex-1">
            <CategoryBadge category={article.category} />
            <h1 className="mt-2 text-2xl font-bold leading-snug">{article.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-faint">
              <span className="flex items-center gap-1">
                <User size={13} /> {getUserName(article.createdBy)}
              </span>
              <span className="flex items-center gap-1">
                <CalendarDays size={13} /> {formatDate(article.createdAt)}
              </span>
              {article.url && (
                <a
                  href={article.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center gap-1 text-violet-500 hover:underline"
                >
                  <ExternalLink size={13} /> 원문 링크
                </a>
              )}
            </div>
          </div>
        </div>

        {article.source && article.source.kind !== "link" && (
          <div className="mt-6 max-w-sm">
            <SourceBadge source={article.source} />
          </div>
        )}

        <section className="mt-8">
          <h2 className="mb-3 text-sm font-bold text-ink-soft">3줄 요약</h2>
          <ol className="space-y-2.5">
            {article.summary.filter(Boolean).map((s, i) => (
              <li key={i} className="flex gap-3 rounded-xl bg-white/70 p-3.5 text-[15px] leading-relaxed">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-violet-100 text-xs font-bold text-violet-500">
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ol>
        </section>

        <Keywords keywords={article.keywords} className="mt-6" />

        <section className="mt-8 border-t border-line pt-6">
          <button onClick={() => setShowBody(!showBody)} className="text-sm font-bold text-ink-soft hover:text-ink">
            원문 본문 {showBody ? "접기 ▲" : "펼치기 ▼"}
          </button>
          <p
            className={cn(
              "mt-3 whitespace-pre-wrap text-sm leading-7 text-ink-soft",
              !showBody && "line-clamp-3",
            )}
          >
            {article.body}
          </p>
        </section>

        {canEdit && (
          <div className="mt-8 flex flex-wrap gap-2">
            <Link href={`/articles/${article.id}/edit`} className="btn-ghost">
              <Pencil size={14} /> 수정
            </Link>
            <button onClick={remove} className="btn-ghost hover:text-rose-500">
              <Trash size={14} /> 삭제
            </button>
          </div>
        )}
      </article>

      <aside className="glass h-fit p-6 xl:row-span-2">
        <h2 className="flex items-center gap-2 font-bold">
          <GitBranch size={16} /> 이슈 타임라인
        </h2>
        <p className="mt-1 text-xs text-ink-faint">같은 이슈로 연결된 자료를 날짜순으로 보여줘요.</p>
        <div className="mt-5">
          {thread.length > 1 ? (
            <IssueTimeline articles={thread} currentId={article.id} />
          ) : (
            <div className="rounded-xl bg-white/60 p-5 text-center text-xs leading-relaxed text-ink-faint">
              아직 같은 이슈의 다른 자료가 없어요.
              <br />
              관련 자료를 등록하면 자동으로 여기에 이어져요.
            </div>
          )}
        </div>

        <div className="mt-8 border-t border-line pt-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-bold">
              <ScanSearch size={16} /> 유사한 자료
            </h2>
            <Link href={`/similar?article=${article.id}`} className="text-[11px] text-ink-faint hover:text-violet-500">
              더 보기 →
            </Link>
          </div>
          <p className="mt-1 text-xs text-ink-faint">이 자료와 내용이 비슷한 순서예요.</p>
          <ul className="mt-4 space-y-3">
            {similar === null && <li className="skeleton h-24" />}
            {similar?.length === 0 && <li className="text-xs text-ink-faint">비슷한 자료가 아직 없어요.</li>}
            {similar?.map((s) => (
              <li key={s.article.id}>
                <Link href={`/articles/${s.article.id}`} className="block rounded-xl bg-white/60 p-3 transition hover:bg-white">
                  <span className="flex items-center gap-1.5">
                    <CategoryBadge category={s.article.category} />
                    {thread.some((t) => t.id === s.article.id) && (
                      <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-500">같은 이슈</span>
                    )}
                  </span>
                  <span className="mt-1 line-clamp-1 text-[13px] font-medium">{s.article.title}</span>
                  <span className="mt-1.5 block">
                    <SimilarityBar percent={s.percent} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <CommentThread articleId={article.id} />
    </div>
  );
}
