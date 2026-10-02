"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import ArticleForm from "@/components/ArticleForm";
import PageHeader from "@/components/PageHeader";
import { EmptyState } from "@/components/ui";
import { getArticle, updateArticle } from "@/lib/api";
import { analyzeDraft, autoLink, draftFromArticle, draftToInput, type Draft } from "@/lib/draft";

export default function EditArticlePage({ params }: PageProps<"/articles/[id]/edit">) {
  const { id } = use(params);
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null | undefined>(undefined);

  useEffect(() => {
    getArticle(id).then((a) => setDraft(a ? draftFromArticle(a) : null));
  }, [id]);

  const patch = (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d));

  return (
    <>
      <PageHeader title="자료 수정" />
      {draft === undefined && <div className="glass skeleton h-96" />}
      {draft === null && <EmptyState title="자료를 찾을 수 없습니다" />}
      {draft && (
        <ArticleForm
          value={draft}
          onChange={patch}
          onAnalyze={async () => {
            patch({ ai: "loading" });
            const result = await analyzeDraft(draft.title, draft.body);
            patch({ ...result, ...(await autoLink({ ...draft, keywords: result.keywords ?? draft.keywords }, id)) });
          }}
          onSave={async () => {
            await updateArticle(id, draftToInput(draft));
            router.push(`/articles/${id}`);
          }}
          onCancel={() => router.back()}
          excludeId={id}
          saveLabel="수정 저장"
          showFirstComment={false}
        />
      )}
    </>
  );
}
