"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, TriangleAlert, X } from "lucide-react";
import { getUserName, listArticles, type DuplicateHit } from "@/lib/api";
import type { Article } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { CategoryBadge } from "./ui";
export function StepTitle({ n, title, desc }: { n: number; title: string; desc?: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-400 text-xs font-bold text-white">
        {n}
      </span>
      <div>
        <h2 className="font-bold">{title}</h2>
        {desc && <p className="mt-0.5 text-xs text-ink-faint">{desc}</p>}
      </div>
    </div>
  );
}

export function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div data-error={!!error}>
      <div className="label">
        {label}
        {required && <span className="text-rose-400">*</span>}
        {hint && <span className="text-xs font-normal text-ink-faint">{hint}</span>}
      </div>
      {children}
      {error && <p className="mt-1.5 text-xs text-rose-500">{error}</p>}
    </div>
  );
}

export function TagInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const tag = draft.trim().replace(/^#/, "");
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setDraft("");
  };
  return (
    <div className="field flex flex-wrap items-center gap-1.5 py-2">
      {value.map((k) => (
        <span key={k} className="chip flex items-center gap-1">
          #{k}
          <button type="button" aria-label={`${k} 삭제`} onClick={() => onChange(value.filter((v) => v !== k))}>
            <X size={11} />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return; // 한글 조합 중 Enter 무시
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={add}
        placeholder={value.length ? "" : "예: AI, 신제품"}
        className="min-w-[80px] flex-1 bg-transparent text-sm outline-none placeholder:text-ink-faint"
      />
    </div>
  );
}

export function ParentPicker({
  value,
  onChange,
  excludeId,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  excludeId?: string;
}) {
  const [all, setAll] = useState<Article[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listArticles().then((r) => setAll(r.items.filter((a) => a.id !== excludeId)));
  }, [excludeId]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const selected = all.find((a) => a.id === value);
  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all
      .filter((a) => !needle || `${a.title} ${a.keywords.join(" ")}`.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [all, q]);

  if (selected) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50/60 p-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <CategoryBadge category={selected.category} />
            <span className="text-[11px] text-ink-faint">{formatDate(selected.createdAt)}</span>
          </div>
          <p className="mt-1 truncate text-sm font-medium">{selected.title}</p>
        </div>
        <button type="button" onClick={() => onChange(null)} className="rounded-lg p-1.5 text-ink-faint hover:bg-white">
          <X size={15} />
        </button>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <Search size={15} className="absolute left-3.5 top-3 text-ink-faint" />
      <input
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        placeholder="기존 자료 제목으로 검색"
        className="field pl-10"
      />
      {open && (
        <ul className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-line bg-white p-1 shadow-xl">
          {results.length === 0 && <li className="px-3 py-4 text-center text-xs text-ink-faint">검색 결과가 없습니다</li>}
          {results.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(a.id);
                  setOpen(false);
                }}
                className="w-full rounded-lg px-3 py-2 text-left hover:bg-violet-50"
              >
                <span className="flex items-center gap-2">
                  <CategoryBadge category={a.category} />
                  <span className="text-[11px] text-ink-faint">{formatDate(a.createdAt)}</span>
                </span>
                <span className="mt-0.5 block truncate text-sm">{a.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DuplicateBanner({ hits }: { hits: DuplicateHit[] }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-rose-600">
        <TriangleAlert size={16} /> 이미 등록된 자료일 가능성이 있습니다.
      </p>
      <ul className="mt-2 space-y-1.5">
        {hits.map(({ article, reason }) => (
          <li key={article.id} className="flex flex-wrap items-center gap-x-2 text-xs text-ink-soft">
            <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-rose-500">
              {reason === "url" ? "URL 동일" : "제목 동일"}
            </span>
            <Link href={`/articles/${article.id}`} target="_blank" className="font-medium text-ink underline-offset-2 hover:underline">
              {article.title}
            </Link>
            <span className="text-ink-faint">
              {formatDate(article.createdAt)} · {getUserName(article.createdBy)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DuplicateModal({ hits, onClose, onForce }: { hits: DuplicateHit[]; onClose: () => void; onForce: () => void }) {
  const first = hits[0].article;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-ink/25 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal className="relative w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-50 text-rose-500">
          <TriangleAlert size={22} />
        </span>
        <h3 className="mt-4 text-lg font-bold">이미 등록된 자료일 가능성이 있습니다.</h3>
        <div className="mt-4 rounded-2xl bg-bg p-4 text-sm">
          <p className="text-xs text-ink-faint">기존 자료</p>
          <p className="mt-1 font-semibold">{first.title}</p>
          <p className="mt-2 text-xs text-ink-soft">
            등록일: {formatDate(first.createdAt)}
            <br />
            등록자: {getUserName(first.createdBy)}
          </p>
          {hits.length > 1 && <p className="mt-2 text-xs text-ink-faint">외 {hits.length - 1}건</p>}
        </div>
        <div className="mt-6 flex gap-3">
          <Link href={`/articles/${first.id}`} target="_blank" className="btn-ghost flex-1">
            기존 자료 보기
          </Link>
          <button type="button" onClick={onForce} className="btn-brand flex-1">
            그래도 등록
          </button>
        </div>
      </div>
    </div>
  );
}
