import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { Article } from "@/lib/types";
import { CATEGORY_STYLE, cn, formatDate } from "@/lib/utils";
import { CategoryBadge } from "./ui";

/** 설계서 7.3 — 날짜 / 제목 / 분류 / 요약 / 링크 */
export default function IssueTimeline({ articles, currentId }: { articles: Article[]; currentId?: string }) {
  return (
    <ol className="relative space-y-5 before:absolute before:bottom-3 before:left-[5px] before:top-3 before:w-0.5 before:bg-gradient-to-b before:from-violet-200 before:to-pink-200">
      {articles.map((a, i) => {
        const current = a.id === currentId;
        return (
          <li key={a.id} className="relative pl-7">
            <span
              className={cn(
                "absolute left-0 top-1.5 h-3 w-3 rounded-full ring-4 ring-white",
                CATEGORY_STYLE[a.category].dot,
                current && "scale-125",
              )}
            />
            <div className="flex items-center gap-2 text-xs text-ink-faint">
              <span className="font-semibold text-ink-soft">{formatDate(a.createdAt)}</span>
              {i === 0 && <span className="rounded bg-ink/5 px-1.5 py-0.5 text-[10px]">이슈 발생</span>}
              {current && <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-600">현재 자료</span>}
            </div>
            <div
              className={cn(
                "mt-1.5 rounded-xl p-3 transition",
                current ? "bg-violet-50 ring-1 ring-violet-200" : "bg-white/70 hover:bg-white",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <Link href={`/articles/${a.id}`} className="text-sm font-semibold leading-snug hover:text-violet-600">
                  {a.title}
                </Link>
                {a.url && (
                  <a href={a.url} target="_blank" rel="noreferrer noopener" aria-label="원문 링크" className="mt-0.5 text-ink-faint hover:text-violet-500">
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>
              <CategoryBadge category={a.category} className="mt-1.5" />
              <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-ink-soft">{a.summary[0]}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
