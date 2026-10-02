"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Box, FilePlus, NotebookPen, Quote, Trash } from "lucide-react";
import { getUserName, listProjects } from "@/lib/api";
import { createReport, deleteReport, listReports, TEMPLATES } from "@/lib/reports";
import type { Project, Report, ReportTemplate } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import PageHeader from "@/components/PageHeader";
import { EmptyState } from "@/components/ui";

export default function ReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<Report[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [title, setTitle] = useState("");
  const [template, setTemplate] = useState<ReportTemplate>("trend");
  const [projectId, setProjectId] = useState("");

  useEffect(() => {
    listReports().then(setReports);
    listProjects().then(setProjects);
  }, []);

  async function create() {
    const project = projects.find((p) => p.id === projectId);
    const r = await createReport({ title: title || project?.name || "", template, projectId: project?.id ?? null });
    router.push(`/reports/${r.id}`);
  }

  return (
    <>
      <PageHeader
        title="보고서 작성"
        description="모은 자료를 인용하며 보고서를 쓰고, 3D 검증으로 근거가 충분한지 확인한 뒤 Word·PDF로 내보내세요."
      />

      <section className="glass p-6">
        <h2 className="flex items-center gap-2 font-bold">
          <FilePlus size={18} className="text-violet-500" /> 새 보고서
        </h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="보고서 제목 (예: 3분기 AI 반도체 경쟁 동향 보고)"
            className="field h-12 text-[15px]"
          />
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="field h-12">
            <option value="">연결할 프로젝트 없음</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                프로젝트: {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {(Object.keys(TEMPLATES) as ReportTemplate[]).map((t) => (
            <button
              key={t}
              onClick={() => setTemplate(t)}
              className={cn(
                "rounded-2xl border p-4 text-left transition",
                template === t ? "border-violet-300 bg-violet-50/80 ring-2 ring-violet-100" : "border-line bg-white/70 hover:bg-white",
              )}
            >
              <span className="block font-semibold">{TEMPLATES[t].label}</span>
              <span className="mt-1 block text-xs text-ink-soft">{TEMPLATES[t].desc}</span>
              <span className="mt-2 block text-[11px] text-ink-faint">{TEMPLATES[t].headings.join(" · ")}</span>
            </button>
          ))}
        </div>
        <div className="mt-5 flex justify-end">
          <button onClick={create} className="btn-brand px-8 py-3">
            <NotebookPen size={16} /> 작성 시작
          </button>
        </div>
      </section>

      <h2 className="mb-3 mt-8 text-lg font-bold">내 보고서</h2>
      {reports === null && <div className="glass skeleton h-40" />}
      {reports?.length === 0 && <EmptyState title="아직 보고서가 없어요" description="위에서 새 보고서를 시작해보세요." />}
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {reports?.map((r) => {
          const filled = r.sections.filter((s) => s.content.trim()).length;
          const last = r.verifyHistory.at(-1)?.scores;
          const overall = last ? Math.round((last.evidence + last.balance + last.recency) / 3) : null;
          return (
            <div key={r.id} className="glass group relative flex flex-col p-5 transition hover:bg-white/85">
              <Link href={`/reports/${r.id}`} className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-600">
                    {TEMPLATES[r.template].label}
                  </span>
                  <span
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[11px] font-semibold",
                      r.status === "완료" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600",
                    )}
                  >
                    {r.status}
                  </span>
                </div>
                <h3 className="mt-2 font-semibold leading-snug">{r.title}</h3>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-violet-50">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400"
                    style={{ width: `${(filled / Math.max(1, r.sections.length)) * 100}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-ink-faint">
                  작성 {filled}/{r.sections.length}항목
                </p>
              </Link>
              <div className="mt-4 flex items-center justify-between text-xs text-ink-faint">
                <span>
                  {getUserName(r.createdBy)} · {formatDate(r.updatedAt)}
                </span>
                <span className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Quote size={12} /> {r.citations.length}
                  </span>
                  {overall !== null && (
                    <Link href={`/reports/${r.id}/verify`} className="flex items-center gap-1 text-violet-500 hover:underline">
                      <Box size={12} /> 검증 {overall}점
                    </Link>
                  )}
                </span>
              </div>
              <button
                onClick={async () => {
                  if (!confirm(`'${r.title}' 보고서를 삭제할까요?`)) return;
                  await deleteReport(r.id);
                  setReports(await listReports());
                }}
                aria-label="보고서 삭제"
                className="absolute right-3 top-3 rounded-lg p-1.5 text-ink-faint opacity-0 hover:bg-white hover:text-rose-500 group-hover:opacity-100"
              >
                <Trash size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
