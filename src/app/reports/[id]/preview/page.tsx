"use client";

import { Suspense, use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileDown, Printer } from "lucide-react";
import { getUserName, listArticles } from "@/lib/api";
import { download, exportWordHtml, getReport, referenceLine } from "@/lib/reports";
import type { Article, Report } from "@/lib/types";
import { formatDate } from "@/lib/utils";

function Preview({ id }: { id: string }) {
  const autoPrint = useSearchParams().get("print") === "1";
  const [report, setReport] = useState<Report | null>(null);
  const [byId, setById] = useState<Map<string, Article>>(new Map());

  useEffect(() => {
    Promise.all([getReport(id), listArticles()]).then(([r, { items }]) => {
      setReport(r);
      setById(new Map(items.map((a) => [a.id, a])));
    });
  }, [id]);

  useEffect(() => {
    if (report && autoPrint) setTimeout(() => window.print(), 400);
  }, [report, autoPrint]);

  if (!report) return <div className="skeleton mx-auto h-[800px] max-w-[820px]" />;

  return (
    <>
      <div className="mx-auto mb-4 flex max-w-[820px] justify-end gap-2 print:hidden">
        <button
          onClick={() => download(`${report.title.replace(/[\\/:*?"<>|]/g, "_")}.doc`, exportWordHtml(report, byId), "application/msword")}
          className="btn-ghost"
        >
          <FileDown size={15} /> Word로 저장
        </button>
        <button onClick={() => window.print()} className="btn-brand">
          <Printer size={15} /> 인쇄 / PDF로 저장
        </button>
      </div>
      <article className="mx-auto max-w-[820px] bg-white px-16 py-14 text-[15px] leading-8 text-[#222] shadow-xl print:max-w-none print:px-0 print:py-0 print:shadow-none">
        <h1 className="text-[28px] font-bold leading-snug">{report.title}</h1>
        <p className="mt-2 border-b border-gray-200 pb-6 text-sm text-gray-500">
          {formatDate(report.updatedAt)} · 작성 {getUserName(report.createdBy)}
        </p>
        {report.sections.map((s, i) => (
          <section key={s.id} className="mt-8 break-inside-avoid-page">
            <h2 className="mb-3 text-[19px] font-bold">
              {i + 1}. {s.heading}
            </h2>
            {s.content.trim() ? (
              s.content
                .split("\n")
                .filter((l) => l.trim())
                .map((l, j) => (
                  <p key={j} className={l.startsWith("■") ? "mt-3 font-semibold" : ""}>
                    {l}
                  </p>
                ))
            ) : (
              <p className="text-gray-400">(내용 없음)</p>
            )}
          </section>
        ))}
        {report.citations.length > 0 && (
          <section className="mt-12 border-t border-gray-200 pt-6">
            <h2 className="mb-3 text-[17px] font-bold">참고 자료</h2>
            {report.citations.map((cid, i) => (
              <p key={cid} className="text-[13px] leading-6 text-gray-600">
                {byId.get(cid) ? referenceLine(byId.get(cid)!, i + 1) : `[${i + 1}] (삭제된 자료)`}
              </p>
            ))}
          </section>
        )}
      </article>
    </>
  );
}

export default function PreviewPage({ params }: PageProps<"/reports/[id]/preview">) {
  const { id } = use(params);
  return (
    <Suspense>
      <Preview id={id} />
    </Suspense>
  );
}
