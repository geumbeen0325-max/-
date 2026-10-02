"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  FileText,
  FilePlus,
  GitBranch,
  LayoutGrid,
  Link2,
  MessagesSquare,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { getCommentSummaries, getUserName, listArticles, listRecentComments } from "@/lib/api";
import { CATEGORIES, type Article } from "@/lib/types";
import { CATEGORY_STYLE, cn, formatShortDate, timeAgo, weekRange } from "@/lib/utils";
import Avatar from "@/components/Avatar";
import {
  ArticleCard,
  type Discussion,
  ArticleCardSkeleton,
  CATEGORY_ICON,
  CategoryBadge,
  CategoryFilter,
  EmptyState,
  SectionTitle,
  type FilterValue,
} from "@/components/ui";

export default function HomePage() {
  const [articles, setArticles] = useState<Article[] | null>(null);
  const [discussions, setDiscussions] = useState<Map<string, Discussion>>(new Map());

  useEffect(() => {
    listArticles().then((r) => setArticles(r.items));
    getCommentSummaries().then(setDiscussions);
  }, []);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-6">
        <Hero />
        <Stats articles={articles} />
        <section>
          <SectionTitle
            action={
              <Link href="/search" className="flex items-center gap-1 text-xs text-ink-faint hover:text-violet-500">
                전체 보기 <ArrowRight size={13} />
              </Link>
            }
          >
            최신 자료
          </SectionTitle>
          {articles === null ? (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <ArticleCardSkeleton key={i} />
              ))}
            </div>
          ) : articles.length === 0 ? (
            <EmptyState
              title="아직 등록된 자료가 없습니다"
              description="첫 기사를 붙여넣고 AI 요약을 받아보세요."
              action={
                <Link href="/articles/new" className="btn-brand">
                  자료 등록
                </Link>
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {articles.slice(0, 6).map((a) => (
                <ArticleCard key={a.id} article={a} discussion={discussions.get(a.id)} />
              ))}
            </div>
          )}
        </section>
        <FeatureCards />
      </div>

      <aside className="space-y-6">
        <RecentTimeline articles={articles} />
        <RecentComments />
        <QuickFilter />
        <QuickLinks />
      </aside>
    </div>
  );
}

function Hero() {
  const router = useRouter();
  const [q, setQ] = useState("");

  return (
    <section className="glass relative overflow-hidden p-7 md:p-9">
      {/* 디자인 시안의 파스텔 웨이브 */}
      <div className="pointer-events-none absolute -right-20 -top-24 h-[340px] w-[620px] rotate-[-8deg] rounded-[50%] bg-gradient-to-r from-amber-100/0 via-pink-200/70 to-sky-200/80 blur-2xl" />
      <div className="pointer-events-none absolute -right-10 top-10 h-[200px] w-[480px] rotate-[-14deg] rounded-[50%] border-t-[28px] border-white/50 blur-sm" />

      <div className="relative">
        <h1 className="text-[28px] font-bold leading-tight md:text-[32px]">
          <span className="font-medium">안녕하세요,</span>
          <br />
          위키비키 서랍입니다.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          링크·파일만 넣으면 AI가 요약·분류하고 같은 이슈끼리 이어주는,
          <br className="hidden sm:block" />
          팀원들과 함께 찾고 의견을 나누는 우리 팀의 자료 보관소입니다.
        </p>

        <form
          className="mt-6 flex flex-col gap-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(`/search?q=${encodeURIComponent(q)}`);
          }}
        >
          <label className="relative flex-1">
            <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="제목, 본문, 분류, 키워드로 검색해보세요."
              className="field h-12 rounded-2xl bg-white/85 pl-11"
            />
          </label>
          <Link href="/articles/new" className="btn-brand h-12 px-8">
            <span className="text-lg leading-none">+</span> 자료 등록
          </Link>
        </form>
      </div>
    </section>
  );
}

function Stats({ articles }: { articles: Article[] | null }) {
  const stats = useMemo(() => {
    if (!articles) return null;
    const cur = weekRange();
    const prev = weekRange(new Date(), -1);
    const inRange = (a: Article, r: { start: Date; end: Date }) => {
      const t = new Date(a.createdAt);
      return t >= r.start && t <= r.end;
    };
    const thisWeek = articles.filter((a) => inRange(a, cur));
    const lastWeek = articles.filter((a) => inRange(a, prev));
    return [
      { label: "이번 주 자료", value: thisWeek.length, diff: thisWeek.length - lastWeek.length, category: null },
      ...CATEGORIES.map((c) => {
        const n = thisWeek.filter((a) => a.category === c).length;
        return { label: c, value: n, diff: n - lastWeek.filter((a) => a.category === c).length, category: c };
      }),
    ];
  }, [articles]);

  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-5">
      {(stats ?? Array.from({ length: 5 }, () => null)).map((s, i) => {
        if (!s) return <div key={i} className="glass skeleton h-[104px]" />;
        const Icon = s.category ? CATEGORY_ICON[s.category] : FileText;
        const style = s.category ? CATEGORY_STYLE[s.category] : CATEGORY_STYLE["경쟁사"];
        return (
          <Link
            key={s.label}
            href={s.category ? `/search?category=${encodeURIComponent(s.category)}` : "/briefing"}
            className="glass flex items-start gap-3 p-4 transition hover:bg-white/85"
          >
            <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full", style.soft, style.text)}>
              <Icon size={20} />
            </span>
            <span>
              <span className="block text-sm font-medium">{s.label}</span>
              <span className="mt-0.5 block text-2xl font-bold">{s.value}</span>
              <span className="mt-0.5 block text-[11px] text-ink-faint">
                지난주 대비 {s.diff >= 0 ? "+" : "−"} {Math.abs(s.diff)}
              </span>
            </span>
          </Link>
        );
      })}
    </section>
  );
}

function RecentTimeline({ articles }: { articles: Article[] | null }) {
  return (
    <section className="glass p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-bold">
          <RefreshCw size={16} /> 이슈 타임라인
        </h2>
        <Link href="/timeline" className="flex items-center gap-1 text-[11px] text-ink-faint hover:text-violet-500">
          전체 보기 <ArrowRight size={12} />
        </Link>
      </div>
      <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[3px] before:top-2 before:w-px before:bg-line">
        {(articles ?? []).slice(0, 5).map((a) => (
          <li key={a.id} className="relative flex gap-3 pl-5">
            <span
              className={cn(
                "absolute left-0 top-1.5 h-[7px] w-[7px] rounded-full ring-2 ring-white",
                CATEGORY_STYLE[a.category].dot,
              )}
            />
            <span className="w-10 shrink-0 text-xs text-ink-faint">{formatShortDate(a.createdAt)}</span>
            <Link href={`/articles/${a.id}`} className="min-w-0 hover:text-violet-600">
              <span className="line-clamp-1 text-[13px] font-medium">{a.title}</span>
              <CategoryBadge category={a.category} className="mt-1" />
            </Link>
          </li>
        ))}
        {articles === null && <li className="skeleton h-40" />}
      </ol>

      <div className="mt-5 rounded-2xl bg-gradient-to-br from-rose-50 to-violet-50 p-4">
        <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-soft">
          <TriangleAlert size={16} className="shrink-0 text-rose-400" />
          이번 주 자료를 모아 보고서로 만들 수 있어요.
        </p>
        <Link
          href="/briefing?auto=1"
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-400 to-fuchsia-400 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-105"
        >
          보고서 작성하기 <ArrowRight size={14} />
        </Link>
      </div>
    </section>
  );
}

function RecentComments() {
  const [items, setItems] = useState<Awaited<ReturnType<typeof listRecentComments>> | null>(null);
  useEffect(() => {
    listRecentComments(4).then(setItems);
  }, []);

  return (
    <section className="glass p-5">
      <h2 className="mb-4 flex items-center gap-2 font-bold">
        <MessagesSquare size={16} /> 최근 팀 의견
      </h2>
      {items === null && <div className="skeleton h-32" />}
      {items?.length === 0 && <p className="text-xs text-ink-faint">아직 의견이 없어요.</p>}
      <ul className="space-y-3.5">
        {items?.map(({ comment: c, article: a }) => (
          <li key={c.id}>
            <Link href={`/articles/${a.id}`} className="group flex gap-2.5">
              <Avatar userId={c.authorId} size={28} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-1.5 text-xs">
                  <b className="font-semibold">{getUserName(c.authorId)}</b>
                  <span className="text-[10px] text-ink-faint">{timeAgo(c.createdAt)}</span>
                </span>
                <span className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-ink-soft group-hover:text-ink">{c.text}</span>
                <span className="mt-1 block truncate text-[11px] text-violet-400">↳ {a.title}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function QuickFilter() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<FilterValue>("전체");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category !== "전체") params.set("category", category);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    router.push(`/search?${params}`);
  };

  return (
    <form onSubmit={submit} className="glass space-y-4 p-5">
      <h2 className="flex items-center gap-2 font-bold">
        <SlidersHorizontal size={16} /> 빠른 검색 & 필터
      </h2>
      <label className="relative block">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="키워드로 검색하기"
          className="field pl-10"
        />
      </label>
      <CategoryFilter value={category} onChange={setCategory} size="sm" />
      <div>
        <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
          <CalendarDays size={15} /> 기간
        </span>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="field min-w-0 px-2 py-2 text-xs" />
          <span className="text-ink-faint">~</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="field min-w-0 px-2 py-2 text-xs" />
        </div>
      </div>
      <button type="submit" className="btn-ghost w-full">
        검색하기
      </button>
    </form>
  );
}

function FeatureCards() {
  return (
    <section className="grid gap-4 md:grid-cols-3">
      <Link href="/articles/new" className="glass group flex gap-4 p-5 transition hover:bg-white/85">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-rose-50 text-rose-400">
          <FilePlus size={22} />
        </span>
        <span className="flex-1">
          <span className="block font-bold">자료 등록하기</span>
          <span className="mt-1 block text-xs leading-relaxed text-ink-soft">
            링크·파일·폴더를 넣기만 하면
            <br />
            AI가 자동으로 요약하고 분류해줘요.
          </span>
          <span className="mt-3 inline-grid h-7 w-10 place-items-center rounded-full bg-violet-100 text-violet-500 transition group-hover:translate-x-1">
            <ArrowRight size={14} />
          </span>
        </span>
      </Link>

      <Link href="/articles/new" className="glass flex gap-4 p-5 transition hover:bg-white/85">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-indigo-50 text-indigo-400">
          <Sparkles size={22} />
        </span>
        <span className="flex-1">
          <span className="block font-bold">AI 요약 미리보기</span>
          <span className="mt-1 block text-xs leading-relaxed text-ink-soft">
            본문을 붙여넣으면 3줄 요약과 분류가 자동으로 생성됩니다.
          </span>
          <span className="mt-3 block space-y-1.5 rounded-xl bg-white/70 p-3">
            <span className="block text-[11px] text-ink-faint">요약 3줄</span>
            {[1, 2, 3].map((n) => (
              <span key={n} className="flex items-center gap-2 text-[10px] text-ink-faint">
                {n}. <span className="h-1.5 flex-1 rounded-full bg-indigo-100" />
              </span>
            ))}
          </span>
        </span>
      </Link>

      <Link href="/briefing" className="glass flex gap-4 p-5 transition hover:bg-white/85">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-violet-50 text-violet-400">
          <FileText size={22} />
        </span>
        <span className="flex-1">
          <span className="block font-bold">보고서 작성</span>
          <span className="mt-1 block text-xs leading-relaxed text-ink-soft">
            등록된 자료를 골라
            <br />
            보고서 하나로 만들어보세요.
          </span>
        </span>
      </Link>
    </section>
  );
}

function QuickLinks() {
  const items = [
    { href: "/search", label: "통합 검색", icon: Search },
    { href: "/articles/new", label: "중복 등록 경고", icon: Link2 },
    { href: "/timeline", label: "이슈 타임라인", icon: GitBranch },
    { href: "/briefing", label: "보고서 작성", icon: FileText },
  ];
  return (
    <section className="glass p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-bold">
        <LayoutGrid size={15} /> 주요 기능
      </h2>
      <div className="grid grid-cols-4 gap-2 xl:grid-cols-2">
        {items.map(({ href, label, icon: Icon }) => (
          <Link key={label} href={href} className="flex flex-col items-center gap-1.5 rounded-xl p-2 text-center hover:bg-white/70">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-violet-400 shadow-sm">
              <Icon size={17} />
            </span>
            <span className="text-[11px] text-ink-soft">{label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
