"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CircleAlert, Info, Plus } from "lucide-react";
import { listArticles } from "@/lib/api";
import { getReport, recordVerification, reportPlainText, saveReport } from "@/lib/reports";
import { cosineMatrix } from "@/lib/similarity";
import { mds } from "@/lib/mds";
import type { Article, Report } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import { CATEGORY_HEX, cn, formatDate } from "@/lib/utils";
import { verifyReport, type Verification } from "@/lib/verify";
import Scatter2D, { type L2D, type P2D } from "@/components/Scatter2D";
import Scatter3D, { type L3D, type P3D } from "@/components/Scatter3D";
import { CategoryBadge, EmptyState } from "@/components/ui";

const AXES: [string, string, string] = ["근거 충실도", "관점 균형", "최신성"];
const TARGET = 70;

export default function VerifyPage({ params }: PageProps<"/reports/[id]/verify">) {
  const { id } = use(params);
  const router = useRouter();
  const [report, setReport] = useState<Report | null | undefined>(undefined);
  const [articles, setArticles] = useState<Article[] | null>(null);
  const [view, setView] = useState<"map" | "quality">("map");

  useEffect(() => {
    Promise.all([getReport(id), listArticles()]).then(async ([r, { items }]) => {
      setArticles(items);
      if (!r) return setReport(null);
      // 열 때마다 현재 상태로 검증하고 기록 (점수가 바뀐 경우만 궤적에 추가)
      const v = verifyReport(r, items);
      setReport((await recordVerification(r.id, v.scores)) ?? r);
    });
  }, [id]);

  const verification = useMemo<Verification | null>(() => (report && articles ? verifyReport(report, articles) : null), [report, articles]);

  // 자료 지도: 보고서 + 모든 자료의 유사도 → 2D 좌표
  const map = useMemo(() => {
    if (!report || !articles || !verification) return null;
    const docs = [{ title: report.title, body: reportPlainText(report) }, ...articles];
    const coords = mds(cosineMatrix(docs), 2) as [number, number][];
    const cited = new Set(report.citations);
    const missed = new Set(verification.missed.map((m) => m.result.article.id));
    const pct = new Map(verification.ranking.map((r) => [r.article.id, r.percent]));

    const points: P2D[] = [
      { id: "__report", pos: coords[0], color: "#ec4899", radius: 17, shape: "star", label: `📄 ${report.title}`, alwaysLabel: true },
      ...articles.map((a, i) => ({
        id: a.id,
        pos: coords[i + 1],
        color: CATEGORY_HEX[a.category],
        radius: cited.has(a.id) ? 14 : missed.has(a.id) ? 13 : 10,
        ring: cited.has(a.id) ? "#7c3aed" : missed.has(a.id) ? "#f59e0b" : undefined,
        dim: !cited.has(a.id) && !missed.has(a.id) && (pct.get(a.id) ?? 0) < 20,
        label: a.title,
        sub: `${a.category} · 유사도 ${pct.get(a.id) ?? 0}%${cited.has(a.id) ? ` · 인용 [${report.citations.indexOf(a.id) + 1}]` : missed.has(a.id) ? " · 놓친 자료" : ""}`,
        alwaysLabel: missed.has(a.id),
      })),
    ];
    const links: L2D[] = [
      ...[...cited].map((cid) => ({ from: "__report", to: cid, color: "rgba(124,58,237,0.55)" })),
      ...[...missed].map((mid) => ({ from: "__report", to: mid, color: "rgba(245,158,11,0.7)", dashed: true })),
    ];
    return { points, links };
  }, [report, articles, verification]);

  // 품질 공간: 세 점수를 좌표로, 지난 검증 기록은 궤적으로
  const quality = useMemo(() => {
    if (!report || !verification) return null;
    // 마지막 기록이 현재 점수와 같으면 ★로 그리므로 궤적에서는 뺀다
    const last = report.verifyHistory.at(-1)?.scores;
    const s = verification.scores;
    const same = last && last.evidence === s.evidence && last.balance === s.balance && last.recency === s.recency;
    const history = same ? report.verifyHistory.slice(0, -1) : report.verifyHistory;
    const points: P3D[] = [
      ...history.map((h, i) => ({
        id: `h${i}`,
        pos: [h.scores.evidence / 100, h.scores.balance / 100, h.scores.recency / 100] as [number, number, number],
        color: "#c4b5fd",
        radius: 5,
        label: `${i + 1}차 검증 (${formatDate(h.at)})`,
        sub: `근거 ${h.scores.evidence} · 균형 ${h.scores.balance} · 최신 ${h.scores.recency}`,
      })),
      {
        id: "now",
        pos: [verification.scores.evidence / 100, verification.scores.balance / 100, verification.scores.recency / 100],
        color: "#ec4899",
        radius: 11,
        shape: "star",
        label: `현재 ${verification.overall}점`,
        sub: `근거 ${verification.scores.evidence} · 균형 ${verification.scores.balance} · 최신 ${verification.scores.recency}`,
        alwaysLabel: true,
      },
    ];
    const ids = points.map((p) => p.id);
    const links: L3D[] = ids.slice(1).map((to, i) => ({ from: ids[i], to, color: "rgba(167,139,250,0.7)", dashed: true }));
    return { points, links };
  }, [report, verification]);

  if (report === undefined || !articles) return <div className="glass skeleton h-[640px]" />;
  if (report === null) return <EmptyState title="보고서를 찾을 수 없어요" />;
  if (!verification || !map || !quality) return null;

  const { scores } = verification;
  const inTarget = scores.evidence >= TARGET && scores.balance >= TARGET && scores.recency >= TARGET;

  async function addCitation(a: Article) {
    const r = report!;
    if (r.citations.includes(a.id)) return;
    const saved = await saveReport({ ...r, citations: [...r.citations, a.id] });
    setReport((await recordVerification(saved.id, verifyReport(saved, articles!).scores)) ?? saved);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href={`/reports/${report.id}`} className="mb-2 flex items-center gap-1 text-sm text-ink-faint hover:text-ink">
            <ArrowLeft size={15} /> 보고서로 돌아가기
          </Link>
          <h1 className="text-2xl font-bold">3D 검증</h1>
          <p className="mt-1 text-sm text-ink-soft">
            &lsquo;{report.title}&rsquo;가 팀이 모은 근거를 충분히, 고르게, 최신으로 반영했는지 확인해요.
          </p>
        </div>
        <div className="flex items-center gap-4 rounded-2xl bg-white/70 px-5 py-3">
          <div className="text-center">
            <p className="text-3xl font-bold text-violet-600">{verification.overall}</p>
            <p className="text-[11px] text-ink-faint">종합</p>
          </div>
          <span
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-semibold",
              verification.grade.tone === "high" ? "bg-emerald-50 text-emerald-600" : verification.grade.tone === "mid" ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600",
            )}
          >
            {verification.grade.label}
          </span>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {(
          [
            ["근거 충실도", scores.evidence, "관련 깊은 자료를 인용했는지, 항목마다 근거 번호가 있는지"],
            ["관점 균형", scores.balance, "관련 자료가 걸친 분야(경쟁사·시장·정책·기술)를 고루 다뤘는지"],
            ["최신성", scores.recency, "관련 자료 중 최근 30일 자료와 가장 최신 자료를 반영했는지"],
          ] as const
        ).map(([label, v, desc]) => (
          <div key={label} className="glass p-4">
            <div className="flex items-baseline justify-between">
              <span className="font-semibold">{label}</span>
              <span className={cn("text-2xl font-bold", v >= TARGET ? "text-emerald-600" : v >= 40 ? "text-amber-500" : "text-rose-500")}>{v}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-violet-50">
              <div className={cn("h-full rounded-full", v >= TARGET ? "bg-emerald-400" : v >= 40 ? "bg-amber-400" : "bg-rose-400")} style={{ width: `${v}%` }} />
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">{desc}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="glass overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/60 p-1">
              {(
                [
                  ["map", "자료 지도"],
                  ["quality", "품질 공간"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setView(k)}
                  className={cn("rounded-lg px-4 py-1.5 text-sm font-semibold", view === k ? "bg-white text-violet-600 shadow-sm" : "text-ink-soft")}
                >
                  {label}
                </button>
              ))}
            </div>
            {view === "map" ? (
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-soft">
                <Legend shape="star" color="#ec4899" label="내 보고서" />
                <Legend ring="#7c3aed" label="인용한 자료" />
                <Legend ring="#f59e0b" label="놓친 자료" />
                {CATEGORIES.map((c) => (
                  <Legend key={c} color={CATEGORY_HEX[c]} label={c} />
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-ink-soft">
                ★ 현재 · ● 지난 검증 · <span className="text-emerald-600">초록 상자 = 세 점수 모두 {TARGET}점 이상</span>
              </p>
            )}
          </div>
          {view === "map" ? (
            <Scatter2D points={map.points} links={map.links} height={560} onSelect={(pid) => pid !== "__report" && router.push(`/articles/${pid}`)} />
          ) : (
            <Scatter3D key="quality" points={quality.points} links={quality.links} axes={AXES} target={TARGET / 100} height={560} />
          )}
          <p className="flex items-start gap-1.5 border-t border-line px-5 py-3 text-[11px] leading-relaxed text-ink-faint">
            <Info size={12} className="mt-0.5 shrink-0" />
            {view === "map"
              ? "내용이 비슷한 자료일수록 가까이 놓여요. 보고서(★) 주변에 주황색 자료가 있다면, 주제와 가까운데 인용하지 않은 자료예요."
              : inTarget
                ? "세 점수가 모두 목표 영역 안에 있어요. 근거 측면에서는 잘 준비된 보고서예요."
                : "★이 초록 상자 안으로 들어가도록 보완해보세요. 고칠 때마다 이 화면을 열면 이동 경로가 남아요."}
          </p>
        </section>

        <div className="space-y-6">
          <section className="glass p-5">
            <h2 className="font-bold">
              놓친 자료 <span className="text-amber-500">{verification.missed.length}</span>
            </h2>
            <p className="mt-1 text-xs text-ink-faint">보고서 주제와 가까운데 아직 인용하지 않았어요.</p>
            {verification.missed.length === 0 ? (
              <p className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">관련 깊은 자료를 모두 인용했어요 👍</p>
            ) : (
              <ul className="mt-4 space-y-2.5">
                {verification.missed.map(({ result: r, reasons }) => (
                  <li key={r.article.id} className="rounded-xl bg-amber-50/70 p-3">
                    <div className="flex items-center gap-1.5">
                      <CategoryBadge category={r.article.category} />
                      <span className="text-[10px] text-ink-faint">{formatDate(r.article.createdAt)}</span>
                    </div>
                    <Link href={`/articles/${r.article.id}`} className="mt-1 block text-[13px] font-semibold hover:text-violet-600">
                      {r.article.title}
                    </Link>
                    <p className="mt-1 text-[11px] text-amber-700">{reasons.join(" · ")}</p>
                    <button
                      onClick={() => addCitation(r.article)}
                      className="mt-2 flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-violet-600 ring-1 ring-violet-200 hover:bg-violet-50"
                    >
                      <Plus size={11} /> 참고 자료에 추가 [{report.citations.length + 1}]
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="glass p-5">
            <h2 className="font-bold">구조 점검</h2>
            {verification.issues.length === 0 ? (
              <p className="mt-3 text-sm text-emerald-700">모든 항목이 채워져 있고 근거 표시도 잘 되어 있어요.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {verification.issues.map((it, i) => (
                  <li
                    key={i}
                    className={cn("flex items-start gap-2 rounded-lg p-2.5 text-xs leading-relaxed", it.level === "warn" ? "bg-rose-50 text-rose-700" : "bg-slate-50 text-ink-soft")}
                  >
                    <CircleAlert size={13} className="mt-0.5 shrink-0" /> {it.text}
                  </li>
                ))}
              </ul>
            )}
            <Link href={`/reports/${report.id}`} className="btn-ghost mt-4 w-full">
              보고서 고치러 가기
            </Link>
          </section>

          <p className="px-1 text-[11px] leading-relaxed text-ink-faint">
            ※ 이 검증은 &lsquo;팀이 모은 자료를 근거로 충분히 활용했는가&rsquo;를 보는 지표예요. 보고서 주장 자체가 옳은지, 프로젝트가 성공할지는
            판단하지 않으니 팀 검토와 함께 활용하세요.
          </p>
        </div>
      </div>
    </div>
  );
}

function Legend({ color, ring, shape, label }: { color?: string; ring?: string; shape?: "star"; label: string }) {
  return (
    <span className="flex items-center gap-1">
      {shape === "star" ? (
        <span style={{ color }}>★</span>
      ) : (
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color ?? "#e5e7eb", boxShadow: ring ? `0 0 0 2px ${ring}` : undefined }} />
      )}
      {label}
    </span>
  );
}
