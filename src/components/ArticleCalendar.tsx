"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { listArticles } from "@/lib/api";
import { CATEGORIES, type Article } from "@/lib/types";
import { CATEGORY_STYLE, cn, toDateInput } from "@/lib/utils";
import { CategoryBadge } from "./ui";

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

/** 월요일 시작 달력 칸 (앞뒤 달 날짜 포함, 6주 고정) */
function monthCells(year: number, month: number) {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

/** 홈 — 날짜별로 등록된 자료를 보는 달력 */
export default function ArticleCalendar() {
  const today = toDateInput(new Date());
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selected, setSelected] = useState(today);
  const [articles, setArticles] = useState<Article[] | null>(null);

  const cells = useMemo(() => monthCells(cursor.year, cursor.month), [cursor]);
  const rangeFrom = toDateInput(cells[0]);
  const rangeTo = toDateInput(cells[cells.length - 1]);

  useEffect(() => {
    let alive = true;
    listArticles({ from: rangeFrom, to: rangeTo, limit: 1000 }).then((r) => alive && setArticles(r.items));
    return () => {
      alive = false;
    };
  }, [rangeFrom, rangeTo]);

  const byDay = useMemo(() => {
    const map = new Map<string, Article[]>();
    for (const a of articles ?? []) {
      const key = toDateInput(new Date(a.createdAt));
      map.set(key, [...(map.get(key) ?? []), a]);
    }
    return map;
  }, [articles]);

  function move(delta: number) {
    setCursor(({ year, month }) => {
      const d = new Date(year, month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  function goToday() {
    const now = new Date();
    setCursor({ year: now.getFullYear(), month: now.getMonth() });
    setSelected(today);
  }

  const dayItems = byDay.get(selected) ?? [];
  const [, sm, sd] = selected.split("-").map(Number);

  return (
    <section className="glass p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-bold">
          <CalendarDays size={16} /> 자료 캘린더
        </h2>
        <button onClick={goToday} className="rounded-lg px-2 py-1 text-[11px] text-ink-faint hover:bg-white/70 hover:text-violet-500">
          오늘
        </button>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <button onClick={() => move(-1)} aria-label="이전 달" className="rounded-lg p-1 text-ink-soft hover:bg-white/70">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold">
          {cursor.year}년 {cursor.month + 1}월
        </span>
        <button onClick={() => move(1)} aria-label="다음 달" className="rounded-lg p-1 text-ink-soft hover:bg-white/70">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-[10px] text-ink-faint">
        {WEEKDAYS.map((w, i) => (
          <span key={w} className={cn("py-1", i === 5 && "text-sky-500", i === 6 && "text-rose-400")}>
            {w}
          </span>
        ))}
      </div>
      <div className={cn("grid grid-cols-7 gap-0.5", articles === null && "opacity-60")}>
        {cells.map((d) => {
          const key = toDateInput(d);
          const items = byDay.get(key) ?? [];
          const cats = CATEGORIES.filter((c) => items.some((a) => a.category === c));
          const inMonth = d.getMonth() === cursor.month;
          return (
            <button
              key={key}
              onClick={() => setSelected(key)}
              aria-label={`${d.getMonth() + 1}월 ${d.getDate()}일, 자료 ${items.length}건`}
              aria-pressed={key === selected}
              className={cn(
                "flex h-10 flex-col items-center justify-start gap-0.5 rounded-lg pt-1 text-xs transition",
                key === selected ? "bg-violet-100 font-semibold text-violet-700" : "hover:bg-white/70",
                !inMonth && "text-ink-faint/50",
                key === today && key !== selected && "ring-1 ring-violet-300",
              )}
            >
              {d.getDate()}
              <span className="flex gap-0.5">
                {cats.map((c) => (
                  <span key={c} className={cn("h-1.5 w-1.5 rounded-full", CATEGORY_STYLE[c].dot)} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 border-t border-line pt-3">
        <p className="mb-2 text-xs font-semibold text-ink-soft">
          {sm}월 {sd}일 등록 자료 <span className="text-violet-600">{dayItems.length}</span>건
        </p>
        {dayItems.length === 0 ? (
          <p className="text-[11px] text-ink-faint">이 날 등록된 자료가 없어요.</p>
        ) : (
          <ul className="space-y-1.5">
            {dayItems.slice(0, 4).map((a) => (
              <li key={a.id}>
                <Link href={`/articles/${a.id}`} className="flex items-center gap-2 rounded-lg bg-white/60 px-2.5 py-1.5 hover:bg-white">
                  <CategoryBadge category={a.category} />
                  <span className="min-w-0 flex-1 truncate text-xs">{a.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {dayItems.length > 4 && (
          <Link href={`/search?from=${selected}&to=${selected}`} className="mt-2 flex items-center justify-end gap-1 text-[11px] text-ink-faint hover:text-violet-500">
            {dayItems.length}건 모두 보기 <ArrowRight size={12} />
          </Link>
        )}
      </div>
    </section>
  );
}
