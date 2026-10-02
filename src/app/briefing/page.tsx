"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Box, Check, Copy, FileDown, FileText, LoaderCircle, Save, Search, Sparkles, Trash2, X } from "lucide-react";
import { listArticles } from "@/lib/api";
import { createBriefingReport, deleteReport, download, exportText, exportWordHtml, getReport, listReports, saveReport } from "@/lib/reports";
import { CATEGORIES, type Article, type Report } from "@/lib/types";
import { CATEGORY_STYLE, cn, formatDate, toDateInput, weekLabel, weekRange } from "@/lib/utils";
import PageHeader from "@/components/PageHeader";
import { CATEGORY_ICON, CategoryBadge, CategoryFilter, type FilterValue } from "@/components/ui";

type Period = "week" | "lastWeek" | "month" | "all";

const PERIODS: [Period, string][] = [
  ["week", "이번 주"],
  ["lastWeek", "지난 주"],
  ["month", "최근 30일"],
  ["all", "전체"],
];

function periodRange(p: Period): { from?: string; to?: string } {
  if (p === "week" || p === "lastWeek") {
    const { start, end } = weekRange(new Date(), p === "week" ? 0 : -1);
    return { from: toDateInput(start), to: toDateInput(end) };
  }
  if (p === "month") return { from: toDateInput(new Date(Date.now() - 30 * 864e5)) };
  return {};
}

function BriefingView() {
  const params = useSearchParams();
  const router = useRouter();
  const presetIds = params.get("ids");
  const reportId = params.get("report");

  const [articles, setArticles] = useState<Article[] | null>(null);
  const [period, setPeriod] = useState<Period>(presetIds ? "all" : "week");
  const [category, setCategory] = useState<FilterValue>("전체");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(presetIds ? presetIds.split(",") : []));
  const [title, setTitle] = useState(params.get("title") ?? `${weekLabel(weekRange().start)} 동향 보고`);
  const [creating, setCreating] = useState(false);

  const [report, setReport] = useState<Report | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);

  useEffect(() => {
    listArticles({ limit: 1000 }).then((r) => {
      setArticles(r.items);
      // 홈의 "주간 브리핑 생성"으로 들어오면 이번 주 자료를 모두 골라 둔다
      if (params.get("auto") === "1") {
        const { from = "", to = "" } = periodRange("week");
        setSelected(new Set(r.items.filter((a) => inRange(a, from, to)).map((a) => a.id)));
      }
    });
    listReports().then(setReports);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!reportId) return;
    getReport(reportId).then((r) => {
      setReport(r);
      setDirty(false);
    });
  }, [reportId]);

  const visible = useMemo(() => {
    if (!articles) return null;
    const { from = "", to = "" } = periodRange(period);
    const needle = q.trim().toLowerCase();
    return articles
      .filter((a) => inRange(a, from, to))
      .filter((a) => category === "전체" || a.category === category)
      .filter((a) => !needle || [a.title, a.summary.join(" "), a.keywords.join(" ")].join(" ").toLowerCase().includes(needle));
  }, [articles, period, category, q]);

  // 주소의 ?report= 가 열려 있는 보고서 (목록으로 돌아가면 자동으로 닫힘)
  const current = reportId && report?.id === reportId ? report : null;
  const picked = useMemo(() => (articles ?? []).filter((a) => selected.has(a.id)), [articles, selected]);
  const byId = useMemo(() => new Map((articles ?? []).map((a) => [a.id, a])), [articles]);
  const allVisibleSelected = !!visible?.length && visible.every((a) => selected.has(a.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      visible?.forEach((a) => (allVisibleSelected ? next.delete(a.id) : next.add(a.id)));
      return next;
    });
  }

  async function create() {
    if (!picked.length) return;
    setCreating(true);
    const r = await createBriefingReport(title, picked);
    setReports(await listReports());
    setCreating(false);
    router.push(`/briefing?report=${r.id}`);
  }

  function edit(patch: Partial<Report>) {
    setReport((r) => (r ? { ...r, ...patch } : r));
    setDirty(true);
  }

  async function save() {
    if (!report) return;
    setSaving(true);
    const saved = await saveReport(report);
    setReport(saved);
    setDirty(false);
    setReports(await listReports());
    setSaving(false);
  }

  async function remove(r: Report) {
    if (!confirm(`'${r.title}' 보고서를 삭제할까요?`)) return;
    await deleteReport(r.id);
    setReports(await listReports());
    if (report?.id === r.id) router.push("/briefing");
  }

  async function copy() {
    if (!report) return;
    await navigator.clipboard.writeText(exportText(report, byId));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <>
      <PageHeader title="주간 동향 브리핑" description="등록된 자료 중 필요한 것을 골라 하나의 보고서로 만듭니다." />

      {current ? (
        <ReportEditor
          report={current}
          byId={byId}
          dirty={dirty}
          saving={saving}
          copied={copied}
          onEdit={edit}
          onSave={save}
          onCopy={copy}
          onClose={() => router.push("/briefing")}
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          {/* 자료 고르기 */}
          <section className="glass p-5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="grid grid-cols-4 gap-1 rounded-xl bg-white/60 p-1">
                {PERIODS.map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setPeriod(k)}
                    className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold", period === k ? "bg-white text-violet-600 shadow-sm" : "text-ink-soft")}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="relative ml-auto min-w-[200px] flex-1 sm:max-w-[280px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="자료 검색" className="field w-full py-2 pl-8 text-sm" />
              </label>
            </div>
            <div className="mt-3">
              <CategoryFilter value={category} onChange={setCategory} size="sm" />
            </div>

            <div className="mt-4 flex items-center justify-between border-b border-line pb-2 text-xs text-ink-soft">
              <span>자료 {visible?.length ?? "–"}건</span>
              <button onClick={toggleVisible} disabled={!visible?.length} className="font-semibold text-violet-600 disabled:opacity-40">
                {allVisibleSelected ? "보이는 자료 선택 해제" : "보이는 자료 모두 선택"}
              </button>
            </div>

            {visible === null ? (
              <div className="mt-3 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="skeleton h-16" />
                ))}
              </div>
            ) : visible.length === 0 ? (
              <p className="py-12 text-center text-sm text-ink-faint">
                조건에 맞는 자료가 없어요.{" "}
                <Link href="/articles/new" className="text-violet-500 underline">
                  자료 등록하기
                </Link>
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {visible.map((a) => {
                  const on = selected.has(a.id);
                  return (
                    <li key={a.id}>
                      <label className={cn("flex cursor-pointer items-start gap-3 rounded-xl px-2 py-3 transition", on ? "bg-violet-50/70" : "hover:bg-white/60")}>
                        <input type="checkbox" checked={on} onChange={() => toggle(a.id)} className="mt-1 h-4 w-4 accent-violet-500" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <CategoryBadge category={a.category} />
                            <span className="text-[11px] text-ink-faint">{formatDate(a.createdAt)}</span>
                          </span>
                          <span className="mt-1 block text-sm font-semibold">{a.title}</span>
                          {a.summary[0] && <span className="mt-0.5 block truncate text-xs text-ink-soft">{a.summary[0]}</span>}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* 보고서 만들기 */}
          <aside className="space-y-6 xl:sticky xl:top-4 xl:self-start">
            <section className="glass p-5">
              <h2 className="flex items-center gap-2 font-bold">
                <FileText size={16} /> 새 보고서
              </h2>
              <label className="mt-4 block text-xs font-semibold text-ink-soft">
                보고서 제목
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="field mt-1.5 w-full text-sm font-normal" />
              </label>

              <div className="mt-4 grid grid-cols-5 gap-1.5 text-center">
                <div className="rounded-xl bg-white/70 py-2">
                  <p className="text-lg font-bold">{picked.length}</p>
                  <p className="text-[10px] text-ink-faint">선택</p>
                </div>
                {CATEGORIES.map((c) => {
                  const Icon = CATEGORY_ICON[c];
                  return (
                    <div key={c} className={cn("rounded-xl py-2", CATEGORY_STYLE[c].soft)}>
                      <p className="text-lg font-bold">{picked.filter((a) => a.category === c).length}</p>
                      <p className={cn("flex items-center justify-center gap-0.5 text-[10px]", CATEGORY_STYLE[c].text)}>
                        <Icon size={10} /> {c}
                      </p>
                    </div>
                  );
                })}
              </div>

              {picked.length > 0 && (
                <ul className="mt-4 max-h-[240px] space-y-1 overflow-y-auto">
                  {picked.map((a) => (
                    <li key={a.id} className="flex items-center gap-2 rounded-lg bg-white/70 px-2.5 py-1.5 text-xs">
                      <span className="min-w-0 flex-1 truncate">{a.title}</span>
                      <button onClick={() => toggle(a.id)} aria-label="선택 해제" className="text-ink-faint hover:text-rose-500">
                        <X size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <button onClick={create} disabled={creating || !picked.length} className="btn-brand mt-4 w-full py-3">
                {creating ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {creating ? "보고서 만드는 중…" : picked.length ? `자료 ${picked.length}건으로 보고서 만들기` : "왼쪽에서 자료를 골라주세요"}
              </button>
              <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
                고른 자료의 요약과 팀 의견만으로 분야별 동향을 정리해요. 자료에 없는 내용은 만들지 않고, 시사점은 직접 채울 수 있게 비워 둬요.
              </p>
            </section>

            {reports.length > 0 && (
              <section className="glass p-5">
                <h2 className="text-sm font-bold text-ink-soft">만든 보고서</h2>
                <ul className="mt-3 space-y-1.5">
                  {reports.map((r) => (
                    <li key={r.id} className="group flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2">
                      <Link href={`/briefing?report=${r.id}`} className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold group-hover:text-violet-600">{r.title}</span>
                        <span className="text-[11px] text-ink-faint">
                          {formatDate(r.updatedAt)} · 자료 {r.citations.length}건
                        </span>
                      </Link>
                      <Link href={`/verify/${r.id}`} aria-label="3D 검증" className="rounded-lg p-1.5 text-ink-faint hover:bg-violet-50 hover:text-violet-600">
                        <Box size={14} />
                      </Link>
                      <button onClick={() => remove(r)} aria-label="삭제" className="rounded-lg p-1.5 text-ink-faint hover:bg-rose-50 hover:text-rose-500">
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>
      )}
    </>
  );
}

function inRange(a: Article, from: string, to: string) {
  const d = toDateInput(new Date(a.createdAt));
  return (!from || d >= from) && (!to || d <= to);
}

function ReportEditor({
  report,
  byId,
  dirty,
  saving,
  copied,
  onEdit,
  onSave,
  onCopy,
  onClose,
}: {
  report: Report;
  byId: Map<string, Article>;
  dirty: boolean;
  saving: boolean;
  copied: boolean;
  onEdit: (patch: Partial<Report>) => void;
  onSave: () => void;
  onCopy: () => void;
  onClose: () => void;
}) {
  const safe = report.title.replace(/[\\/:*?"<>|]/g, "_");

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="glass p-6">
        <input
          value={report.title}
          onChange={(e) => onEdit({ title: e.target.value })}
          className="w-full bg-transparent text-xl font-bold outline-none"
          aria-label="보고서 제목"
        />
        <p className="mt-1 text-xs text-ink-faint">
          {formatDate(report.updatedAt)} 저장 · 본문의 [번호]는 오른쪽 참고 자료 번호예요.
        </p>

        <div className="mt-6 space-y-5">
          {report.sections.map((s, i) => (
            <div key={s.id}>
              <h3 className="mb-1.5 text-sm font-bold">
                {i + 1}. {s.heading}
              </h3>
              <textarea
                value={s.content}
                onChange={(e) => onEdit({ sections: report.sections.map((x) => (x.id === s.id ? { ...x, content: e.target.value } : x)) })}
                placeholder={`${s.heading}을(를) 작성해주세요.`}
                rows={Math.max(3, s.content.split("\n").length + 1)}
                className="field w-full resize-y text-[13px] leading-6"
              />
            </div>
          ))}
        </div>
      </section>

      <aside className="space-y-6 xl:sticky xl:top-4 xl:self-start">
        <section className="glass space-y-2 p-5">
          <button onClick={onSave} disabled={!dirty || saving} className="btn-brand w-full">
            {saving ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />}
            {saving ? "저장 중…" : dirty ? "변경 내용 저장" : "저장됨"}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={onCopy} className="btn-ghost text-xs">
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? "복사됨" : "텍스트 복사"}
            </button>
            <button onClick={() => download(`${safe}.doc`, exportWordHtml(report, byId), "application/msword")} className="btn-ghost text-xs">
              <FileDown size={13} /> Word 저장
            </button>
          </div>
          <Link
            href={`/verify/${report.id}`}
            onClick={(e) => dirty && !confirm("저장하지 않은 변경 내용이 있어요. 그래도 검증 화면으로 갈까요?") && e.preventDefault()}
            className="btn-ghost w-full border-violet-200 bg-violet-50 text-violet-700"
          >
            <Box size={15} /> 3D 검증하기
          </Link>
          <button onClick={onClose} className="w-full pt-1 text-xs text-ink-faint hover:text-ink">
            ← 자료 고르기로 돌아가기
          </button>
        </section>

        <section className="glass p-5">
          <h2 className="text-sm font-bold">참고 자료 {report.citations.length}건</h2>
          <ol className="mt-3 space-y-1.5">
            {report.citations.map((id, i) => {
              const a = byId.get(id);
              return (
                <li key={id} className="flex gap-2 text-xs">
                  <span className="shrink-0 font-semibold text-violet-600">[{i + 1}]</span>
                  {a ? (
                    <Link href={`/articles/${a.id}`} className="hover:text-violet-600">
                      {a.title} <span className="text-ink-faint">· {formatDate(a.createdAt)}</span>
                    </Link>
                  ) : (
                    <span className="text-ink-faint">(삭제된 자료)</span>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      </aside>
    </div>
  );
}

export default function BriefingPage() {
  return (
    <Suspense>
      <BriefingView />
    </Suspense>
  );
}
