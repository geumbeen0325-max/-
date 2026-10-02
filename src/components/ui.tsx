"use client";

import Link from "next/link";
import { ChartColumn, Cog, FileText, MessageCircle, ShieldCheck, Trophy, type LucideIcon } from "lucide-react";
import { getUserName } from "@/lib/api";
import { CATEGORIES, type Article, type Category, type Comment } from "@/lib/types";
import { CATEGORY_STYLE, cn, formatDate } from "@/lib/utils";
import { SOURCE_META } from "./SourceIcon";

export const CATEGORY_ICON: Record<Category, LucideIcon> = {
  경쟁사: Trophy,
  시장: ChartColumn,
  정책: ShieldCheck,
  기술: Cog,
};

export function CategoryBadge({ category, className }: { category: Category; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold",
        CATEGORY_STYLE[category].badge,
        className,
      )}
    >
      {category}
    </span>
  );
}

/** 기사 썸네일 대체용 — 분류별 그라데이션 타일 */
export function CategoryThumb({ category, size = 64 }: { category: Category; size?: number }) {
  const Icon = CATEGORY_ICON[category];
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br",
        CATEGORY_STYLE[category].gradient,
      )}
      style={{ width: size, height: size }}
    >
      <span className="absolute -right-3 -top-3 h-10 w-10 rounded-full bg-white/40 blur-md" />
      <Icon size={size * 0.38} className="relative text-white drop-shadow" strokeWidth={1.8} />
    </span>
  );
}

export type FilterValue = Category | "전체";

export function CategoryFilter({
  value,
  onChange,
  size = "md",
}: {
  value: FilterValue;
  onChange: (v: FilterValue) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(["전체", ...CATEGORIES] as FilterValue[]).map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={cn(
            "rounded-full transition",
            size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm",
            value === c
              ? "bg-gradient-to-r from-violet-400 to-fuchsia-400 font-semibold text-white shadow-sm"
              : "bg-white/70 text-ink-soft hover:bg-white hover:text-ink",
          )}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

export function Keywords({ keywords, className }: { keywords: string[]; className?: string }) {
  if (!keywords.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {keywords.map((k) => (
        <span key={k} className="chip">
          #{k}
        </span>
      ))}
    </div>
  );
}

export function Highlight({ text, query }: { text: string; query?: string }) {
  const words = (query ?? "")
    .trim()
    .replace(/^#/, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!words.length) return <>{text}</>;
  const parts = text.split(new RegExp(`(${words.join("|")})`, "gi"));
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          <mark key={i} className="rounded bg-yellow-100 px-0.5 text-ink">
            {p}
          </mark>
        ) : (
          p
        ),
      )}
    </>
  );
}

export type Discussion = { count: number; top: Comment | null };

export function ArticleCard({ article, query, discussion }: { article: Article; query?: string; discussion?: Discussion }) {
  return (
    <Link
      href={`/articles/${article.id}`}
      className="glass group flex flex-col p-5 transition hover:-translate-y-0.5 hover:bg-white/85 hover:shadow-[0_14px_40px_-16px_rgba(99,88,180,0.35)]"
    >
      <div className="flex gap-4">
        <CategoryThumb category={article.category} />
        <div className="min-w-0 flex-1">
          <CategoryBadge category={article.category} />
          <h3 className="mt-1.5 line-clamp-2 text-[15px] font-semibold leading-snug text-ink">
            <Highlight text={article.title} query={query} />
          </h3>
        </div>
      </div>
      <p className="mt-4 line-clamp-3 text-[13px] leading-relaxed text-ink-soft">
        <Highlight text={article.summary.filter(Boolean).join(" ")} query={query} />
      </p>
      {discussion?.top && (
        <p className="mt-3 truncate rounded-lg bg-violet-50/80 px-2.5 py-1.5 text-xs text-ink-soft">
          <b className="mr-1.5 font-semibold text-violet-600">{getUserName(discussion.top.authorId)}</b>
          <Highlight text={discussion.top.text} query={query} />
        </p>
      )}
      <Keywords keywords={article.keywords} className="mt-3" />
      <div className="mt-auto flex items-center justify-between pt-4 text-xs text-ink-faint">
        <span>
          {getUserName(article.createdBy)} <span className="mx-1.5 text-line">|</span> {formatDate(article.createdAt)}
          {article.parentArticleId && <span className="ml-2 text-violet-400">· 이슈 연결</span>}
          {article.source && article.source.kind !== "link" && (
            <span className="ml-2 rounded bg-white px-1.5 py-0.5 text-[10px] text-ink-soft">
              {SOURCE_META[article.source.kind].label}
            </span>
          )}
        </span>
        <span className="flex items-center gap-1 transition group-hover:text-violet-500">
          <MessageCircle size={14} /> {discussion?.count ?? 0}
        </span>
      </div>
    </Link>
  );
}

export function ArticleCardSkeleton() {
  return (
    <div className="glass p-5">
      <div className="flex gap-4">
        <div className="skeleton h-16 w-16" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-12" />
          <div className="skeleton h-4 w-full" />
        </div>
      </div>
      <div className="skeleton mt-4 h-3 w-full" />
      <div className="skeleton mt-2 h-3 w-4/5" />
      <div className="skeleton mt-2 h-3 w-3/5" />
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="glass flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-50 text-violet-400">
        <FileText size={22} />
      </span>
      <p className="mt-4 font-semibold">{title}</p>
      {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-lg font-bold">{children}</h2>
      {action}
    </div>
  );
}
