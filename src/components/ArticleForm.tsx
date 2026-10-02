"use client";

import { useEffect, useState } from "react";
import { Check, CircleAlert, GitBranch, LoaderCircle, Sparkles } from "lucide-react";
import { checkDuplicate, type DuplicateHit } from "@/lib/api";
import type { Draft } from "@/lib/draft";
import { CATEGORIES } from "@/lib/types";
import { CATEGORY_STYLE, cn, formatDate, isValidUrl } from "@/lib/utils";
import { CategoryBadge } from "./ui";
import { DuplicateBanner, DuplicateModal, Field, ParentPicker, StepTitle, TagInput } from "./form-parts";
import { SourceBadge } from "./SourceIcon";

/**
 * 자료 1건의 제목·본문·AI 결과·이슈 연결을 확인/수정하는 폼.
 * 상태는 부모가 가진다(제어 컴포넌트) — 등록 화면에서는 여러 자료를 백그라운드로 분석하기 때문.
 */
export default function ArticleForm({
  value: d,
  onChange,
  onAnalyze,
  onSave,
  onCancel,
  excludeId,
  saveLabel = "저장",
  showFirstComment = true,
}: {
  value: Draft;
  onChange: (patch: Partial<Draft>) => void;
  onAnalyze: () => void;
  onSave: () => Promise<void>;
  onCancel?: () => void;
  excludeId?: string;
  saveLabel?: string;
  showFirstComment?: boolean;
}) {
  const [duplicates, setDuplicates] = useState<DuplicateHit[]>([]);
  const [showDupModal, setShowDupModal] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  // 제목/URL 변경 시 실시간 중복 검사 (디바운스)
  useEffect(() => {
    const t = setTimeout(async () => {
      const hits = d.title.trim() || d.url.trim() ? await checkDuplicate(d.title, d.url) : [];
      setDuplicates(hits.filter((h) => h.article.id !== excludeId));
    }, 400);
    return () => clearTimeout(t);
  }, [d.title, d.url, excludeId]);

  const urlInvalid = d.url.trim() !== "" && !isValidUrl(d.url.trim());
  const errors = {
    title: !d.title.trim() ? "제목을 입력하세요." : "",
    url: urlInvalid ? "올바른 URL 형식이 아닙니다. (http:// 또는 https://)" : "",
    body: !d.body.trim() ? "본문 내용을 입력하세요." : "",
    summary: d.summary.every((s) => !s.trim()) ? "요약을 1줄 이상 입력하거나 AI 분석을 실행하세요." : "",
    category: !d.category ? "분류를 선택하세요." : "",
  };
  const hasError = Object.values(errors).some(Boolean);
  const err = (k: keyof typeof errors) => (submitted ? errors[k] : "");

  async function save(force = false) {
    setSubmitted(true);
    if (hasError) {
      document.querySelector("[data-error='true']")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!force && duplicates.length) {
      setShowDupModal(true);
      return;
    }
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  }

  const analyzing = d.ai === "loading";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]"
    >
      {/* ① 원문 확인 */}
      <section className="glass space-y-5 p-6">
        <StepTitle n={1} title="원문 확인" desc="불러온 제목·본문을 확인하고 필요하면 고쳐주세요." />

        {d.source && <SourceBadge source={d.source} />}

        <Field label="제목" required error={err("title")}>
          <input value={d.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="자료 제목" className="field" />
        </Field>

        <Field label="출처 링크" hint="선택" error={err("url") || (urlInvalid ? errors.url : "")}>
          <input
            value={d.url}
            onChange={(e) => onChange({ url: e.target.value })}
            placeholder="https://"
            className="field"
            inputMode="url"
          />
        </Field>

        {duplicates.length > 0 && <DuplicateBanner hits={duplicates} />}

        <Field label="본문 내용" required hint="AI는 이 내용만 근거로 요약해요" error={err("body")}>
          <textarea
            value={d.body}
            onChange={(e) => onChange({ body: e.target.value })}
            placeholder="자료의 본문 내용"
            rows={14}
            className="field resize-y leading-relaxed"
          />
          <div className="mt-1 text-right text-[11px] text-ink-faint">{d.body.length.toLocaleString()}자</div>
        </Field>

        <button type="button" onClick={onAnalyze} disabled={!d.body.trim() || analyzing} className="btn-brand w-full py-3">
          {analyzing ? (
            <>
              <LoaderCircle size={16} className="animate-spin" /> AI가 내용을 분석하고 있어요…
            </>
          ) : (
            <>
              <Sparkles size={16} /> {d.ai === "done" ? "AI 다시 분석" : "AI 분석"}
            </>
          )}
        </button>
      </section>

      {/* ② AI 결과 확인/수정 + ③ 시사점·연결 */}
      <div className="space-y-6">
        <section className="glass space-y-5 p-6">
          <StepTitle n={2} title="AI 결과 확인" desc="AI 결과는 추천값이에요. 저장 전 자유롭게 수정하세요." />

          {d.ai === "error" && (
            <div className="flex gap-2 rounded-xl bg-rose-50 p-3 text-xs leading-relaxed text-rose-600">
              <CircleAlert size={16} className="shrink-0" />
              <span>
                <b>{d.aiError}</b>
                <br />
                요약·분류·키워드를 직접 입력해도 저장할 수 있어요.
              </span>
            </div>
          )}

          <Field label="3줄 요약" required error={err("summary")}>
            <div className="space-y-2">
              {d.summary.map((line, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="mt-2.5 w-4 text-xs font-semibold text-ink-faint">{i + 1}.</span>
                  {analyzing ? (
                    <div className="skeleton mt-1 h-9 flex-1" />
                  ) : (
                    <textarea
                      value={line}
                      onChange={(e) => onChange({ summary: d.summary.map((s, j) => (j === i ? e.target.value : s)) })}
                      rows={2}
                      placeholder={["무엇에 관한 자료인가?", "주요 내용 또는 변화는?", "기획팀이 알아야 할 핵심은?"][i]}
                      className="field resize-none py-2 text-[13px]"
                    />
                  )}
                </div>
              ))}
            </div>
          </Field>

          <Field label="분류" required error={err("category")}>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onChange({ category: c })}
                  className={cn(
                    "rounded-xl border py-2 text-sm transition",
                    d.category === c
                      ? cn(CATEGORY_STYLE[c].badge, "border-transparent font-semibold")
                      : "border-line bg-white/70 text-ink-soft hover:bg-white",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </Field>

          <Field label="키워드" hint="Enter로 추가">
            <TagInput value={d.keywords} onChange={(keywords) => onChange({ keywords })} />
          </Field>
        </section>

        <section className="glass space-y-5 p-6">
          <StepTitle n={3} title="이슈 연결" desc="기존 자료 중 같은 이슈를 찾아 자동으로 이어 붙여요." />
          <IssueLink d={d} onChange={onChange} excludeId={excludeId} analyzing={analyzing} />
          {showFirstComment && (
            <Field label="첫 의견 남기기" hint="선택 · 팀원들이 이어서 댓글을 달 수 있어요">
              <textarea
                value={d.firstComment}
                onChange={(e) => onChange({ firstComment: e.target.value })}
                rows={2}
                placeholder="이 자료를 공유하는 이유나 생각을 자유롭게 남겨주세요"
                className="field resize-none"
              />
            </Field>
          )}
        </section>

        <div className="flex gap-3">
          {onCancel && (
            <button type="button" onClick={onCancel} className="btn-ghost flex-1">
              취소
            </button>
          )}
          <button type="submit" disabled={saving} className="btn-brand flex-[2] py-3">
            {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Check size={16} />}
            {saveLabel}
          </button>
        </div>
      </div>

      {showDupModal && (
        <DuplicateModal
          hits={duplicates}
          onClose={() => setShowDupModal(false)}
          onForce={() => {
            setShowDupModal(false);
            save(true);
          }}
        />
      )}
    </form>
  );
}

/** 같은 이슈 자동 연결 표시 + 변경/해제 */
function IssueLink({
  d,
  onChange,
  excludeId,
  analyzing,
}: {
  d: Draft;
  onChange: (patch: Partial<Draft>) => void;
  excludeId?: string;
  analyzing: boolean;
}) {
  const [picking, setPicking] = useState(false);
  const match = d.related.find((m) => m.article.id === d.parentArticleId);
  const others = d.related.filter((m) => m.article.id !== d.parentArticleId);

  if (analyzing) {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-white/60 p-4 text-xs text-ink-soft">
        <LoaderCircle size={14} className="animate-spin" /> 분석이 끝나면 같은 이슈의 기존 자료를 찾아 연결해요…
      </p>
    );
  }

  if (picking || (d.parentArticleId && !match)) {
    return (
      <div className="space-y-2">
        <ParentPicker
          value={d.parentArticleId}
          onChange={(id) => {
            onChange({ parentArticleId: id, parentMode: "manual" });
            if (id) setPicking(false);
          }}
          excludeId={excludeId}
        />
        {picking && (
          <button type="button" onClick={() => setPicking(false)} className="text-xs text-ink-faint hover:text-ink">
            ← 돌아가기
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {match ? (
        <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-pink-50 p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-600">
            <GitBranch size={13} />
            {d.parentMode === "auto" ? "같은 이슈로 자동 연결돼요" : "선택한 이슈에 연결돼요"}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <CategoryBadge category={match.article.category} />
            <span className="text-[11px] text-ink-faint">{formatDate(match.article.createdAt)}</span>
          </div>
          <p className="mt-1 text-sm font-semibold leading-snug">{match.article.title}</p>
          {match.shared.length > 0 && (
            <p className="mt-2 text-[11px] text-ink-soft">
              공통: {match.shared.slice(0, 4).map((s) => `#${s}`).join(" ")}
            </p>
          )}
        </div>
      ) : (
        <p className="rounded-xl bg-white/60 p-4 text-xs leading-relaxed text-ink-soft">
          {d.parentMode === "manual"
            ? "연결하지 않고 새 이슈로 등록해요."
            : d.ai === "done"
              ? "관련된 기존 자료가 없어 새 이슈로 등록돼요."
              : "AI 분석 후 같은 이슈를 자동으로 찾아요."}
        </p>
      )}

      {others.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] text-ink-faint">다른 후보</p>
          <div className="flex flex-col gap-1">
            {others.map((m) => (
              <button
                key={m.article.id}
                type="button"
                onClick={() => onChange({ parentArticleId: m.article.id, parentMode: "manual" })}
                className="truncate rounded-lg bg-white/70 px-3 py-1.5 text-left text-xs hover:bg-white hover:text-violet-600"
              >
                {m.article.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 text-xs">
        <button type="button" onClick={() => setPicking(true)} className="btn-ghost px-3 py-1.5 text-xs">
          다른 자료 선택
        </button>
        {d.parentArticleId && (
          <button
            type="button"
            onClick={() => onChange({ parentArticleId: null, parentMode: "manual" })}
            className="btn-ghost px-3 py-1.5 text-xs"
          >
            연결 안 함
          </button>
        )}
      </div>
    </div>
  );
}