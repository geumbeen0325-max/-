"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import RegisterWorkspace from "@/components/RegisterWorkspace";

function NewArticle() {
  const parent = useSearchParams().get("parent") ?? undefined;
  return <RegisterWorkspace defaultParentId={parent} />;
}

export default function NewArticlePage() {
  return (
    <>
      <PageHeader title="자료 등록" description="자료 넣기 → 내용 자동 추출 → AI 요약·분류 → 같은 이슈 자동 연결 → 확인 후 저장" />
      <Suspense>
        <NewArticle />
      </Suspense>
    </>
  );
}
