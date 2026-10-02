"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Box,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  FileDown,
  LoaderCircle,
  Plus,
  Printer,
  Quote,
  Search,
  Sparkles,
  Trash,
  X,
} from "lucide-react";
import { getUserName, listArticles, listProjects, searchSimilar } from "@/lib/api";
import {
  download,
  draftSection,
  exportText,
  exportWordHtml,
  getReport,
  newSection,
  reportPlainText,
  saveReport,
  TEMPLATES,
} from "@/lib/reports";
import type { SimilarityResult } from "@/lib/similarity";
import type { Article, Project, Report } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import { verifyReport } from "@/lib/verify";
import { CategoryBadge, EmptyState } from "@/components/ui";
import { SimilarityBar } from "@/components/SimilarityMeter";

export default function ReportEditorPage({ params }: PageProps<"/reports/[id]">) {
  const { id } = use(params);
  const [report, setReport] = useState<Report | null | undefined>(undefined);
  const [articles, setArticles] = useState<Article[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
  const [drafting, setDrafting] = useState<string | null>(null);
  const cursor = useRef<{ sectionId: string | null; pos: number | null }>({ sectionId: null, pos: null });
  const firstLoad = useRef(true);

  useEffect(() => {
    getReport(id).then((r) => {
      setReport(r);
      if (r?.projectId) listProjects().then((ps) => setProject(ps.find((p) => p.id === r.projectId) ?? null));
    });
    listArticles().then((r) => setArticles(r.items));
  }, [id]);

  // 자동 저장
  useEffect(() => {
    if (!report) return;
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    const t1 = setTimeout(() => setSaveState("saving"), 0);
    const t2 = setTimeout(async () => {
      await saveReport(report);
      setSaveState("saved");
    }, 600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [report]);

  const byId = useMemo(() => new Map(articles.map((a) => [a.id, a])), [articles]);

  if (report === undefined) return <div className="glass skeleton h-[600px]" />;
  if (report === null)
    return (
      <EmptyState
        title="보고서를 찾을 수 없어요"
        action={
          <Link href="/reports" className="btn-ghost">
            보고서 목록
          </Link>
        }
      />
    );

  const patch = (p: Partial<Report>) => setReport((r) => (r ? { ...r, ...p } : r));
  const patchSection = (sid: string, content: string) =>
    patch({ sections: report.sections.map((s) => (s.id === sid ? { ...s, content } : s)) });

  /** 자료 인용: 참고 자료 번호를 매기고, 마지막으로 커서가 있던 곳에 넣는다 */
  function cite(a: Article, mode: "quote" | "number") {
    const r = report!;
    const idx = r.citations.indexOf(a.id);
    const citations = idx >= 0 ? r.citations : [...r.citations, a.id];
    const n = (idx >= 0 ? idx : citations.length - 1) + 1;
    const target = r.sections.find((s) => s.id === cursor.current.sectionId) ?? r.sections.at(-1)!;
    const pos = cursor.current.sectionId === target.id && cursor.current.pos !== null ? cursor.current.pos : target.content.length;
    const before = target.content.slice(0, pos);
    const after = target.content.slice(pos);
    const text =
      mode === "quote"
        ? `${before && !before.endsWith("\n") ? "\n" : ""}${a.summary[0] || a.title} [${n}]`
        : `${before && !/\s$/.test(before) ? " " : ""}[${n}]`;
    cursor.current = { sectionId: target.id, pos: pos + text.length };
    patch({ citations, sections: r.sections.map((s) => (s.id === target.id ? { ...s, content: before + text + after } : s)) });
  }

  function removeCitation(n: number) {
    const r = report!;
    const used = r.sections.some((s) => s.content.includes(`[${n}]`));
    if (used && !confirm(`본문의 [${n}] 표시도 함께 지우고, 뒤 번호를 하나씩 당길까요?`)) return;
    const renumber = (text: string) =>
      text.replace(/ ?\[(\d+)\]/g, (m, k) => (Number(k) === n ? "" : Number(k) > n ? m.replace(k, String(Number(k) - 1)) : m));
    patch({
      citations: r.citations.filter((_, i) => i !== n - 1),
      sections: r.sections.map((s) => ({ ...s, content: renumber(s.content) })),
    });
  }

  async function aiDraft(sid: string) {
    const r = report!;
    const sec = r.sections.find((s) => s.id === sid)!;
    if (sec.content.trim() && !confirm("기존 내용 아래에 AI 초안을 덧붙일까요?")) return;
    setDrafting(sid);
    const { content, citations } = await draftSection(r, sid);
    setDrafting(null);
    setReport((cur) =>
      cur
        ? {
            ...cur,
            citations: cur.citations.length ? cur.citations : citations,
            sections: cur.sections.map((s) => (s.id === sid ? { ...s, content: [s.content.trim(), content].filter(Boolean).join("\n\n") } : s)),
          }
        : cur,
    );
  }

  function move(i: number, dir: -1 | 1) {
    const s = [...report!.sections];
    [s[i], s[i + dir]] = [s[i + dir], s[i]];
    patch({ sections: s });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0 space-y-5">
        {/* 상단 도구 */}
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/reports" className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-ink-faint hover:bg-white/70 hover:text-ink">
            <ArrowLeft size={15} /> 목록
          </Link>
          <span className="rounded-md bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-600">{TEMPLATES[report.template].label}</span>
          {project && (
            <Link href={`/similar?project=${project.id}`} className="rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-600 hover:underline">
              프로젝트: {project.name}
            </Link>
          )}
          <span className="flex items-center gap-1 text-[11px] text-ink-faint">
            {saveState === "saving" ? <LoaderCircle size={11} className="animate-spin" /> : <Check size={11} />}
            {saveState === "saving" ? "저장 중" : "저장됨"}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              onClick={() => patch({ status: report.status === "완료" ? "작성 중" : "완료" })}
              className={cn("btn-ghost px-3 py-2 text-xs", report.status === "완료" && "border-emerald-200 bg-emerald-50 text-emerald-600")}
            >
              {report.status === "완료" ? "✓ 작성 완료" : "완료로 표시"}
            </button>
            <ExportMenu report={report} byId={byId} />
            <Link href={`/reports/${report.id}/verify`} className="btn-brand px-4 py-2 text-xs">
              <Box size={14} /> 3D 검증
            </Link>
          </div>
        </div>

        <input
          value={report.title}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder="보고서 제목"
          className="w-full bg-transparent text-[26px] font-bold outline-none placeholder:text-ink-faint"
        />

        {report.sections.map((s, i) => (
          <section key={s.id} className="glass p-5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-violet-400">{i + 1}.</span>
              <input
                value={s.heading}
                onChange={(e) => patch({ sections: report.sections.map((x) => (x.id === s.id ? { ...x, heading: e.target.value } : x)) })}
                className="min-w-0 flex-1 bg-transparent text-[17px] font-bold outline-none"
              />
              <button
                onClick={() => aiDraft(s.id)}
                disabled={drafting !== null}
                className="flex items-center gap-1 rounded-lg bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-600 hover:bg-violet-100 disabled:opacity-50"
              >
                {drafting === s.id ? <LoaderCircle size={13} className="animate-spin" /> : <Sparkles size={13} />} AI 초안
              </button>
              <IconBtn label="위로" disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp size={14} />
              </IconBtn>
              <IconBtn label="아래로" disabled={i === report.sections.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown size={14} />
              </IconBtn>
              <IconBtn
                label="항목 삭제"
                disabled={report.sections.length === 1}
                onClick={() => {
                  if (s.content.trim() && !confirm(`'${s.heading}' 항목을 삭제할까요?`)) return;
                  patch({ sections: report.sections.filter((x) => x.id !== s.id) });
                }}
              >
                <Trash size={14} />
              </IconBtn>
            </div>
            <textarea
              value={s.content}
              onChange={(e) => {
                patchSection(s.id, e.target.value);
                cursor.current = { sectionId: s.id, pos: e.target.selectionStart };
              }}
              onSelect={(e) => (cursor.current = { sectionId: s.id, pos: e.currentTarget.selectionStart })}
              onFocus={(e) => (cursor.current = { sectionId: s.id, pos: e.currentTarget.selectionStart })}
              placeholder="내용을 쓰거나, 오른쪽에서 자료를 인용하거나, 'AI 초안'을 눌러보세요."
              className="mt-3 min-h-[120px] w-full resize-none rounded-xl bg-white/60 p-4 text-[15px] leading-7 outline-none transition [field-sizing:content] focus:bg-white focus:ring-4 focus:ring-violet-100"
            />
          </section>
        ))}

        <button onClick={() => patch({ sections: [...report.sections, newSection()] })} className="btn-ghost w-full border-dashed py-3">
          <Plus size={15} /> 항목 추가
        </button>

        {/* 참고 자료 */}
        <section className="glass p-5">
          <h2 className="flex items-center gap-2 font-bold">
            <Quote size={16} className="text-violet-500" /> 참고 자료 <span className="text-violet-500">{report.citations.length}</span>
          </h2>
          {report.citations.length === 0 ? (
            <p className="mt-3 text-sm text-ink-faint">오른쪽 &lsquo;자료 찾기&rsquo;에서 인용하면 번호와 함께 여기에 정리돼요.</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {report.citations.map((cid, i) => {
                const a = byId.get(cid);
                return (
                  <li key={cid} className="group flex items-start gap-2 text-sm">
                    <span className="w-7 shrink-0 font-semibold text-violet-500">[{i + 1}]</span>
                    {a ? (
                      <Link href={`/articles/${a.id}`} className="flex-1 hover:text-violet-600">
                        {a.title}
                        <span className="ml-2 text-xs text-ink-faint">
                          {formatDate(a.createdAt)} · {getUserName(a.createdBy)}
                        </span>
                      </Link>
                    ) : (
                      <span className="flex-1 text-ink-faint">(삭제된 자료)</span>
                    )}
                    <button
                      onClick={() => removeCitation(i + 1)}
                      aria-label="인용 삭제"
                      className="rounded p-1 text-ink-faint opacity-0 hover:bg-white hover:text-rose-500 group-hover:opacity-100"
                    >
                      <X size={13} />
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      <aside className="xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:self-start xl:overflow-y-auto">
        <SidePanel report={report} articles={articles} project={project} onCite={cite} />
      </aside>
    </div>
  );
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button aria-label={label} title={label} onClick={onClick} disabled={disabled} className="rounded-lg p-1.5 text-ink-faint hover:bg-white hover:text-ink disabled:opacity-30">
      {children}
    </button>
  );
}

function ExportMenu({ report, byId }: { report: Report; byId: Map<string, Article> }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const safe = report.title.replace(/[\\/:*?"<>|]/g, "_") || "보고서";
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="btn-ghost px-3 py-2 text-xs">
        <FileDown size={14} /> 내보내기 <ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-line bg-white p-1 shadow-xl" onMouseLeave={() => setOpen(false)}>
          <MenuItem onClick={() => download(`${safe}.doc`, exportWordHtml(report, byId), "application/msword")}>
            <FileDown size={14} /> Word 파일(.doc)
          </MenuItem>
          <MenuItem onClick={() => window.open(`/reports/${report.id}/preview?print=1`, "_blank")}>
            <Printer size={14} /> PDF로 저장 / 인쇄
          </MenuItem>
          <MenuItem
            onClick={async () => {
              await navigator.clipboard.writeText(exportText(report, byId));
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            <Copy size={14} /> {copied ? "복사됨!" : "텍스트 복사"}
          </MenuItem>
          <MenuItem onClick={() => window.open(`/reports/${report.id}/preview`, "_blank")}>
            <ExternalLink size={14} /> 미리보기
          </MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-violet-50">
      {children}
    </button>
  );
}

/* ───────────── 오른쪽 패널: 자료 찾기 / 검증 요약 ───────────── */

function SidePanel({
  report,
  articles,
  project,
  onCite,
}: {
  report: Report;
  articles: Article[];
  project: Project | null;
  onCite: (a: Article, mode: "quote" | "number") => void;
}) {
  const [tab, setTab] = useState<"find" | "verify">("find");
  const [q, setQ] = useState("");
  const [recommended, setRecommended] = useState<SimilarityResult[] | null>(null);
  const [searched, setSearched] = useState<Article[] | null>(null);
  const text = reportPlainText(report);

  // 보고서 내용(+ 프로젝트 설명)과 비슷한 자료 추천 — 쓰는 동안 갱신
  useEffect(() => {
    const t = setTimeout(async () => {
      setRecommended(
        await searchSimilar({ title: `${report.title} ${project?.name ?? ""}`, body: `${text}\n${project?.description ?? ""}` }),
      );
    }, 800);
    return () => clearTimeout(t);
  }, [text, report.title, project]);

  useEffect(() => {
    const t = setTimeout(async () => setSearched(q.trim() ? (await listArticles({ q })).items : null), 300);
    return () => clearTimeout(t);
  }, [q]);

  const verification = useMemo(() => (articles.length ? verifyReport(report, articles) : null), [report, articles]);
  const list: { a: Article; percent?: number }[] = searched
    ? searched.map((a) => ({ a }))
    : (recommended ?? []).filter((r) => r.percent >= 15).map((r) => ({ a: r.article, percent: r.percent }));

  return (
    <div className="glass p-5">
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-white/60 p-1">
        {(["find", "verify"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn("rounded-lg py-2 text-sm font-semibold transition", tab === t ? "bg-white text-violet-600 shadow-sm" : "text-ink-soft hover:text-ink")}
          >
            {t === "find" ? "자료 찾기" : "검증 요약"}
          </button>
        ))}
      </div>

      {tab === "find" ? (
        <>
          <label className="relative block">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="키워드로 자료 검색" className="field pl-10" />
          </label>
          <p className="mb-3 mt-3 text-[11px] text-ink-faint">
            {searched ? `검색 결과 ${searched.length}건` : "보고서 내용과 비슷한 자료를 추천해요 (쓰는 동안 갱신)"}
          </p>
          {!searched && recommended === null && <div className="skeleton h-40" />}
          {list.length === 0 && (searched || recommended) && <p className="text-xs text-ink-faint">자료가 없어요. 제목이나 내용을 조금 더 써보세요.</p>}
          <ul className="space-y-2.5">
            {list.map(({ a, percent }) => {
              const n = report.citations.indexOf(a.id) + 1;
              return (
                <li key={a.id} className={cn("rounded-xl p-3 transition", n ? "bg-violet-50/80 ring-1 ring-violet-200" : "bg-white/70")}>
                  <div className="flex items-center gap-1.5">
                    <CategoryBadge category={a.category} />
                    <span className="text-[10px] text-ink-faint">{formatDate(a.createdAt)}</span>
                    {n > 0 && <span className="ml-auto text-[11px] font-semibold text-violet-600">[{n}] 인용됨</span>}
                  </div>
                  <Link href={`/articles/${a.id}`} target="_blank" className="mt-1 block text-[13px] font-semibold leading-snug hover:text-violet-600">
                    {a.title}
                  </Link>
                  <p className="mt-1 line-clamp-2 text-xs text-ink-soft">{a.summary[0]}</p>
                  {percent !== undefined && (
                    <div className="mt-2">
                      <SimilarityBar percent={percent} />
                    </div>
                  )}
                  <div className="mt-2 flex gap-1.5">
                    <button onClick={() => onCite(a, "quote")} className="rounded-lg bg-violet-500 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-violet-600">
                      요약 인용
                    </button>
                    <button onClick={() => onCite(a, "number")} className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-violet-600 ring-1 ring-violet-200 hover:bg-violet-50">
                      번호만 [{n || report.citations.length + 1}]
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      ) : verification ? (
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-4xl font-bold text-violet-600">{verification.overall}</p>
            <p className="text-xs text-ink-faint">종합 점수 · {verification.grade.label}</p>
          </div>
          {(
            [
              ["근거 충실도", verification.scores.evidence],
              ["관점 균형", verification.scores.balance],
              ["최신성", verification.scores.recency],
            ] as const
          ).map(([label, v]) => (
            <div key={label}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-semibold">{label}</span>
                <span className="text-ink-soft">{v}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-violet-50">
                <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400" style={{ width: `${v}%` }} />
              </div>
            </div>
          ))}
          {verification.missed.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-bold text-amber-600">놓친 자료 {verification.missed.length}건</p>
              <ul className="space-y-1.5">
                {verification.missed.slice(0, 3).map(({ result: r, reasons }) => (
                  <li key={r.article.id} className="rounded-lg bg-amber-50/80 p-2.5 text-xs">
                    <p className="font-semibold">{r.article.title}</p>
                    <p className="mt-0.5 text-[11px] text-amber-700">{reasons.join(" · ")}</p>
                    <button onClick={() => onCite(r.article, "quote")} className="mt-1.5 text-[11px] font-semibold text-violet-600 hover:underline">
                      + 인용하기
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Link href={`/reports/${report.id}/verify`} className="btn-brand w-full">
            <Box size={15} /> 3D로 자세히 검증하기
          </Link>
        </div>
      ) : (
        <div className="skeleton h-40" />
      )}
    </div>
  );
}
