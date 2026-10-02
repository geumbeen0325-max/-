"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookmarkPlus, FileUp, Info, Link2, LoaderCircle, NotebookPen, X } from "lucide-react";
import {
  deleteProject,
  extractFromFile,
  extractFromUrl,
  getArticle,
  getUserName,
  listProjects,
  saveProject,
  searchSimilar,
} from "@/lib/api";
import type { SimilarityResult } from "@/lib/similarity";
import type { Project } from "@/lib/types";
import { cn, formatDate, isValidUrl } from "@/lib/utils";
import PageHeader from "@/components/PageHeader";
import { SimilarityChip, SimilarityRing } from "@/components/SimilarityMeter";
import { CategoryBadge, CategoryFilter, EmptyState, type FilterValue } from "@/components/ui";

const SHOW_THRESHOLD = 20; // 이 % 미만은 기본으로 접어 둠

function SimilarView() {
  const params = useSearchParams();
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [excludeId, setExcludeId] = useState<string | undefined>();
  const [projects, setProjects] = useState<Project[]>([]);

  const [results, setResults] = useState<SimilarityResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [category, setCategory] = useState<FilterValue>("전체");
  const [showLow, setShowLow] = useState(false);

  const [filling, setFilling] = useState("");
  const [linkInput, setLinkInput] = useState("");
  const [notice, setNotice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listProjects().then(setProjects);
  }, []);

  const run = useCallback(async (title: string, body: string, exclude?: string) => {
    if (!`${title}${body}`.trim()) {
      setResults(null);
      return;
    }
    setSearching(true);
    setResults(await searchSimilar({ title, body }, { excludeId: exclude }));
    setSearching(false);
  }, []);

  // 상세 화면 "더 보기"(?article=) 또는 저장된 프로젝트(?project=)로 들어온 경우
  useEffect(() => {
    const articleId = params.get("article");
    const pid = params.get("project");
    if (articleId) {
      getArticle(articleId).then((a) => {
        if (!a) return;
        const desc = [a.summary.filter(Boolean).join(" "), a.keywords.map((k) => `#${k}`).join(" ")].join("\n");
        setName(a.title);
        setDescription(desc);
        setExcludeId(a.id);
        run(a.title, `${desc}\n${a.body}`, a.id);
      });
    } else if (pid) {
      listProjects().then((all) => {
        const p = all.find((x) => x.id === pid);
        if (p) load(p);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  // 입력하는 동안 자동 검색 (디바운스)
  useEffect(() => {
    if (excludeId) return; // 자료 기준 검색은 위에서 처리
    const t = setTimeout(() => run(name, description), 500);
    return () => clearTimeout(t);
  }, [name, description, excludeId, run]);

  function load(p: Project) {
    setProjectId(p.id);
    setExcludeId(undefined);
    setName(p.name);
    setDescription(p.description);
  }

  async function save() {
    if (!name.trim()) {
      setNotice("프로젝트 이름을 입력해주세요.");
      return;
    }
    const p = await saveProject({ id: projectId ?? undefined, name, description });
    setProjectId(p.id);
    setProjects(await listProjects());
    setNotice("프로젝트를 저장했어요. 자료가 늘어나도 다시 열면 최신 유사도로 찾아드려요.");
  }

  async function fill(promise: Promise<{ title: string; body: string; warning?: string }>, label: string) {
    setFilling(label);
    setNotice("");
    try {
      const r = await promise;
      if (!name.trim()) setName(r.title);
      setDescription((d) => [d.trim(), r.body.slice(0, 6000)].filter(Boolean).join("\n\n"));
      setExcludeId(undefined);
      if (r.warning) setNotice(r.warning);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "불러오지 못했습니다.");
    }
    setFilling("");
  }

  const filtered = (results ?? []).filter((r) => category === "전체" || r.article.category === category);
  const visible = filtered.filter((r) => showLow || r.percent >= SHOW_THRESHOLD);
  const hiddenCount = filtered.length - filtered.filter((r) => r.percent >= SHOW_THRESHOLD).length;

  return (
    <>
      <PageHeader
        title="유사 자료 찾기"
        description="진행할 프로젝트를 설명하면, 지금까지 팀이 모은 자료를 유사도가 높은 순으로 보여드려요."
      />

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        {/* 프로젝트 입력 */}
        <div className="space-y-6 xl:sticky xl:top-4 xl:self-start">
          <section className="glass space-y-4 p-6">
            <div>
              <label className="label">프로젝트 이름</label>
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setExcludeId(undefined);
                }}
                placeholder="예: AI 반도체 경쟁 대응 전략 수립"
                className="field"
              />
            </div>
            <div>
              <label className="label">
                프로젝트 내용 <span className="text-xs font-normal text-ink-faint">목표·범위·관심 키워드 등</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setExcludeId(undefined);
                }}
                rows={9}
                placeholder={"예: 경쟁사의 AI 반도체 신제품과 양산 일정을 분석해\n우리 회사의 칩 수급 및 제휴 전략을 세운다.\n관심 키워드: 삼성전자, HBM, 클라우드 공급"}
                className="field resize-y leading-relaxed"
              />
            </div>

            <div className="space-y-2 rounded-xl bg-white/60 p-3">
              <p className="text-[11px] text-ink-faint">기획서·제안서가 있다면 내용으로 바로 채울 수 있어요</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => fileRef.current?.click()} disabled={!!filling} className="btn-ghost flex-1 bg-white px-3 py-2 text-xs">
                  {filling === "file" ? <LoaderCircle size={14} className="animate-spin" /> : <FileUp size={14} />} 파일로 채우기
                </button>
              </div>
              <div className="relative">
                <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                <input
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && isValidUrl(linkInput.trim())) {
                      e.preventDefault();
                      fill(extractFromUrl(linkInput.trim()), "link");
                      setLinkInput("");
                    }
                  }}
                  placeholder="링크 붙여넣고 Enter"
                  className="field py-2 pl-8 text-xs"
                />
                {filling === "link" && <LoaderCircle size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-violet-400" />}
              </div>
              <input
                ref={fileRef}
                type="file"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) fill(extractFromFile(f), "file");
                  e.target.value = "";
                }}
              />
            </div>

            {notice && (
              <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                <Info size={13} className="mt-0.5 shrink-0" /> {notice}
              </p>
            )}

            {name.trim() && (
              <button
                type="button"
                onClick={async () => {
                  // 프로젝트를 저장하고, 관련 깊은 자료를 미리 고른 채로 통합 보고서 작성 화면에서 보고서를 만든다
                  const p = await saveProject({ id: projectId ?? undefined, name, description });
                  const top = (results ?? []).filter((r) => r.percent >= 35).slice(0, 5).map((r) => r.article.id);
                  const q = new URLSearchParams({ title: p.name });
                  if (top.length) q.set("ids", top.join(","));
                  router.push(`/briefing?${q}`);
                }}
                className="btn-ghost w-full border-violet-200 bg-violet-50 text-violet-700"
              >
                <NotebookPen size={15} /> 비슷한 자료로 보고서 만들기
              </button>
            )}

            <div className="flex gap-2">
              <button type="button" onClick={save} className="btn-brand flex-1">
                <BookmarkPlus size={15} /> {projectId ? "프로젝트 저장" : "프로젝트로 저장"}
              </button>
              {(name || description) && (
                <button
                  type="button"
                  onClick={() => {
                    setName("");
                    setDescription("");
                    setProjectId(null);
                    setExcludeId(undefined);
                    setNotice("");
                  }}
                  className="btn-ghost"
                >
                  새로 쓰기
                </button>
              )}
            </div>
          </section>

          {projects.length > 0 && (
            <section className="glass p-5">
              <h2 className="mb-3 text-sm font-bold">저장한 프로젝트</h2>
              <ul className="space-y-1.5">
                {projects.map((p) => (
                  <li key={p.id} className="group relative">
                    <button
                      onClick={() => load(p)}
                      className={cn(
                        "w-full rounded-xl px-3 py-2.5 text-left transition",
                        p.id === projectId ? "bg-violet-100/80 text-violet-700" : "bg-white/60 hover:bg-white",
                      )}
                    >
                      <span className="block truncate pr-6 text-sm font-medium">{p.name}</span>
                      <span className="text-[11px] text-ink-faint">
                        {getUserName(p.createdBy)} · {formatDate(p.updatedAt)}
                      </span>
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(`'${p.name}' 프로젝트를 삭제할까요?`)) return;
                        await deleteProject(p.id);
                        if (p.id === projectId) setProjectId(null);
                        setProjects(await listProjects());
                      }}
                      aria-label="프로젝트 삭제"
                      className="absolute right-2 top-2 rounded p-1 text-ink-faint opacity-0 hover:bg-white hover:text-rose-500 group-hover:opacity-100"
                    >
                      <X size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* 결과 */}
        <section className="min-w-0">
          {results === null && !searching ? (
            <EmptyState
              title="프로젝트를 설명해주세요"
              description="이름과 내용을 적으면 바로 유사한 자료를 찾아 유사도(%) 순으로 보여드려요."
            />
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-sm text-ink-soft">
                  {searching && <LoaderCircle size={14} className="animate-spin" />}
                  전체 {results?.length ?? 0}건 중 관련 자료{" "}
                  <b className="text-violet-600">{(results ?? []).filter((r) => r.percent >= SHOW_THRESHOLD).length}</b>건
                </p>
                <CategoryFilter value={category} onChange={setCategory} size="sm" />
              </div>

              {visible.length === 0 && !searching && (
                <EmptyState
                  title="유사한 자료를 찾지 못했어요"
                  description="프로젝트 내용에 핵심 키워드(회사명, 제품, 기술, 정책명 등)를 더 넣어보세요."
                />
              )}

              <ol className="space-y-3">
                {visible.map((r, i) => (
                  <li key={r.article.id}>
                    <Link
                      href={`/articles/${r.article.id}`}
                      className="glass flex gap-5 p-5 transition hover:-translate-y-0.5 hover:bg-white/85"
                    >
                      <div className="flex flex-col items-center gap-1.5">
                        <SimilarityRing percent={r.percent} />
                        <span className="text-[10px] text-ink-faint">#{i + 1}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <SimilarityChip percent={r.percent} />
                          <CategoryBadge category={r.article.category} />
                          <span className="text-[11px] text-ink-faint">
                            {formatDate(r.article.createdAt)} · {getUserName(r.article.createdBy)}
                          </span>
                        </div>
                        <h3 className="mt-1.5 font-semibold leading-snug">{r.article.title}</h3>
                        <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-soft">
                          {r.article.summary.filter(Boolean).join(" ")}
                        </p>
                        {r.shared.length > 0 && (
                          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-faint">
                            겹치는 내용
                            {r.shared.map((s) => (
                              <span key={s} className="chip">
                                #{s}
                              </span>
                            ))}
                          </p>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ol>

              {hiddenCount > 0 && (
                <button onClick={() => setShowLow(!showLow)} className="btn-ghost mt-4 w-full">
                  {showLow ? "관련 적은 자료 접기" : `관련 적은 자료 ${hiddenCount}건 더 보기 (${SHOW_THRESHOLD}% 미만)`}
                </button>
              )}

              <p className="mt-6 flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-faint">
                <Info size={12} className="mt-0.5 shrink-0" />
                유사도는 제목·키워드·요약·본문에 겹치는 핵심 단어를 비교해 계산해요(흔한 단어일수록 낮게 반영).
                절대적인 수치보다 순위와 &lsquo;겹치는 내용&rsquo;을 함께 참고해주세요.
              </p>
            </>
          )}
        </section>
      </div>
    </>
  );
}

export default function SimilarPage() {
  return (
    <Suspense>
      <SimilarView />
    </Suspense>
  );
}
