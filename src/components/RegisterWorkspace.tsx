"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CircleAlert,
  CircleCheck,
  ClipboardPaste,
  FolderOpen,
  LoaderCircle,
  PenLine,
  Plus,
  Upload,
  X,
} from "lucide-react";
import { createArticle, extractFromFile, extractFromUrl, type ExtractResult } from "@/lib/api";
import { analyzeDraft, autoLink, draftToInput, emptyDraft, type Draft } from "@/lib/draft";
import { detectKind } from "@/lib/source-kind";
import { uploadSourceFile } from "@/lib/files";
import type { SourceKind } from "@/lib/types";
import { cn, isValidUrl } from "@/lib/utils";
import ArticleForm from "./ArticleForm";
import { SourceIcon, formatBytes } from "./SourceIcon";

type Status = "reading" | "analyzing" | "ready" | "warning" | "failed" | "saved";

interface Item {
  id: string;
  label: string;
  kind: SourceKind | "manual";
  status: Status;
  message?: string;
  draft: Draft;
  savedId?: string;
}

const MAX_FILES = 50;
const CONCURRENCY = 3;
const ACCEPT_HINT = ["링크", "PDF", "엑셀·CSV", "워드", "PPT", "한글(HWPX)", "텍스트", "폴더"];

const STATUS_VIEW: Record<Status, { label: string; className: string }> = {
  reading: { label: "내용 읽는 중", className: "text-indigo-500" },
  analyzing: { label: "AI 분석 중", className: "text-violet-500" },
  ready: { label: "검토 후 저장", className: "text-emerald-600" },
  warning: { label: "확인 필요", className: "text-amber-600" },
  failed: { label: "불러오기 실패", className: "text-rose-500" },
  saved: { label: "저장 완료", className: "text-ink-faint" },
};

const isJunkFile = (name: string) => /^(\.|~\$)|^(thumbs\.db|desktop\.ini)$/i.test(name);

/** 드래그한 폴더 안의 파일까지 재귀로 수집 */
async function filesFromDataTransfer(dt: DataTransfer): Promise<File[]> {
  const entries = [...dt.items].map((i) => i.webkitGetAsEntry?.()).filter(Boolean) as FileSystemEntry[];
  if (!entries.length) return [...dt.files];

  const out: File[] = [];
  const walk = async (entry: FileSystemEntry, path: string): Promise<void> => {
    if (out.length >= MAX_FILES) return;
    if (entry.isFile) {
      const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej));
      Object.defineProperty(file, "relPath", { value: path + file.name });
      out.push(file);
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      // readEntries는 한 번에 일부만 돌려주므로 빈 배열이 나올 때까지 반복
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
        if (!batch.length) break;
        for (const child of batch) await walk(child, `${path}${entry.name}/`);
      }
    }
  };
  for (const e of entries) await walk(e, "");
  return out;
}

const fileLabel = (f: File) =>
  (f as File & { relPath?: string }).relPath || f.webkitRelativePath || f.name;

export default function RegisterWorkspace({ defaultParentId }: { defaultParentId?: string }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  /** 자료 id → 넣은 원본 파일 (저장 시 Storage에 올림) */
  const sourceFiles = useRef(new Map<string, File>());

  /* ───── 동시 처리 개수 제한 ───── */
  const queue = useRef<(() => Promise<void>)[]>([]);
  const running = useRef(0);
  const pump = useCallback(function run() {
    while (running.current < CONCURRENCY && queue.current.length) {
      const task = queue.current.shift()!;
      running.current++;
      task().finally(() => {
        running.current--;
        run();
      });
    }
  }, []);

  const update = useCallback((id: string, patch: Partial<Omit<Item, "draft">>, draft?: Partial<Draft>) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch, draft: draft ? { ...it.draft, ...draft } : it.draft } : it)),
    );
  }, []);

  /** 추출 → AI 분석 파이프라인 */
  const process = useCallback(
    async (id: string, extract: (() => Promise<ExtractResult>) | null, preset?: Partial<Draft>) => {
      let title = preset?.title ?? "";
      let body = preset?.body ?? "";
      if (extract) {
        try {
          const r = await extract();
          title = r.title;
          body = r.body;
          update(id, { kind: r.kind }, {
            title,
            body,
            ...(r.url ? { url: r.url } : {}),
            source: { ...(preset?.source ?? {}), kind: r.kind, detail: r.detail },
          });
          if (body.trim().length < 40) {
            update(id, { status: "warning", message: r.warning ?? "본문이 너무 짧아요. 내용을 보완해주세요." });
            return;
          }
        } catch (e) {
          update(id, { status: "failed", message: e instanceof Error ? e.message : "불러오지 못했습니다." });
          return;
        }
      }
      update(id, { status: "analyzing" }, { ai: "loading" });
      const patch = await analyzeDraft(title, body);
      const link = patch.ai === "done" ? await autoLink({ title, keywords: patch.keywords ?? [], parentMode: preset?.parentMode ?? "auto" }) : {};
      update(
        id,
        patch.ai === "done" ? { status: "ready", message: undefined } : { status: "warning", message: patch.aiError },
        { ...patch, ...link },
      );
    },
    [update],
  );

  const enqueue = useCallback(
    (newItems: { item: Item; extract: (() => Promise<ExtractResult>) | null }[]) => {
      if (!newItems.length) return;
      setItems((prev) => [...prev, ...newItems.map((n) => n.item)]);
      setSelectedId((cur) => cur ?? newItems[0].item.id);
      for (const { item, extract } of newItems) {
        queue.current.push(() => process(item.id, extract, item.draft));
      }
      pump();
    },
    [process, pump],
  );

  const base = useCallback(
    (label: string, kind: Item["kind"], draft: Partial<Draft>): Item => ({
      id: crypto.randomUUID(),
      label,
      kind,
      status: "reading",
      // 상세 화면의 "이어서 등록"으로 들어오면 그 자료에 직접 연결
      draft: emptyDraft({
        ...(defaultParentId ? { parentArticleId: defaultParentId, parentMode: "manual" as const } : {}),
        ...draft,
      }),
    }),
    [defaultParentId],
  );

  /* ───── 자료 추가 경로 ───── */

  const addFiles = useCallback(
    (files: File[]) => {
      const valid = files.filter((f) => !isJunkFile(f.name));
      if (valid.length > MAX_FILES) setNotice(`한 번에 최대 ${MAX_FILES}개까지 넣을 수 있어 앞의 ${MAX_FILES}개만 추가했어요.`);
      enqueue(
        valid.slice(0, MAX_FILES).map((f) => {
          const item = base(fileLabel(f), detectKind(f.name, f.type), {
            title: f.name.replace(/\.[^.]+$/, ""),
            source: { kind: detectKind(f.name, f.type), fileName: fileLabel(f), fileSize: f.size },
          });
          sourceFiles.current.set(item.id, f); // 저장할 때 원본 파일도 함께 올린다
          return { item, extract: () => extractFromFile(f) };
        }),
      );
    },
    [base, enqueue],
  );

  const addLinks = useCallback(
    (urls: string[]) =>
      enqueue(
        [...new Set(urls)].map((u) => ({
          item: base(u.replace(/^https?:\/\/(www\.)?/, ""), "link", { url: u }),
          extract: () => extractFromUrl(u),
        })),
      ),
    [base, enqueue],
  );

  const addText = useCallback(
    (text: string) => {
      const firstLine = text.trim().split("\n")[0].slice(0, 60);
      const item = base(firstLine || "붙여넣은 내용", "text", {
        title: firstLine,
        body: text.trim(),
        source: { kind: "text", detail: "붙여넣은 내용" },
      });
      item.status = "analyzing";
      enqueue([{ item, extract: null }]);
    },
    [base, enqueue],
  );

  const addManual = () => {
    const item = { ...base("직접 입력", "manual", {}), status: "warning" as Status, message: "내용을 직접 입력하세요." };
    setItems((prev) => [...prev, item]);
    setSelectedId(item.id);
  };

  /** 붙여넣은 텍스트: 모든 줄이 링크면 링크로, 아니면 본문으로 */
  const addPasted = useCallback(
    (text: string) => {
      const lines = text.split(/\s*\n\s*/).map((l) => l.trim()).filter(Boolean);
      if (!lines.length) return;
      if (lines.every((l) => isValidUrl(l))) addLinks(lines);
      else addText(text);
    },
    [addLinks, addText],
  );

  // 입력칸 밖에서 Ctrl+V → 바로 자료로 추가
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      const editable = target.closest("input, textarea, [contenteditable='true']");
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.length && !editable) {
        e.preventDefault();
        addFiles(files);
      } else if (!editable) {
        const text = e.clipboardData?.getData("text") ?? "";
        if (text.trim()) {
          e.preventDefault();
          addPasted(text);
        }
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [addFiles, addPasted]);

  /* ───── 선택된 자료 편집·저장 ───── */

  const selected = items.find((i) => i.id === selectedId) ?? null;
  const pendingCount = items.filter((i) => i.status !== "saved").length;
  const savedItems = items.filter((i) => i.status === "saved");

  async function saveSelected() {
    if (!selected) return;
    // 같이 넣은 자료가 먼저 저장됐을 수 있으므로 저장 직전에 같은 이슈를 한 번 더 찾는다
    const draft = { ...selected.draft, ...(await autoLink(selected.draft)) };
    // 원본 파일 보관 — 실패해도 내용(추출한 본문·요약)은 저장한다
    const file = sourceFiles.current.get(selected.id);
    if (file && draft.source) {
      try {
        draft.source = { ...draft.source, storagePath: await uploadSourceFile(file), mimeType: file.type || undefined };
      } catch (e) {
        console.error("[upload]", e);
        setNotice(`'${file.name}' 원본 파일은 보관하지 못했어요. 내용은 그대로 저장돼요. (${e instanceof Error ? e.message : ""})`);
      }
    }
    const saved = await createArticle(draftToInput(draft), draft.firstComment);
    sourceFiles.current.delete(selected.id);
    update(selected.id, { status: "saved", savedId: saved.id, message: undefined });
    // 다음 미저장 자료로 이동 (하나만 넣었다면 상세 화면으로)
    if (items.length === 1) {
      router.push(`/articles/${saved.id}`);
      return;
    }
    const idx = items.findIndex((i) => i.id === selected.id);
    const next = [...items.slice(idx + 1), ...items.slice(0, idx)].find((i) => i.status !== "saved");
    setSelectedId(next?.id ?? null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function remove(id: string) {
    sourceFiles.current.delete(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (selectedId === id) setSelectedId(items.find((i) => i.id !== id && i.status !== "saved")?.id ?? null);
  }

  return (
    <div className="space-y-6">
      <Dropzone
        compact={items.length > 0}
        onFiles={addFiles}
        onPasted={addPasted}
        onManual={addManual}
      />

      {notice && (
        <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-xs text-amber-700">
          <CircleAlert size={14} /> {notice}
          <button className="ml-auto" onClick={() => setNotice("")} aria-label="닫기">
            <X size={13} />
          </button>
        </p>
      )}

      {items.length > 0 && (
        <section className="glass p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">
              넣은 자료 <span className="text-violet-500">{items.length}</span>
              <span className="ml-2 text-xs font-normal text-ink-faint">
                저장 {savedItems.length} · 남은 자료 {pendingCount}
              </span>
            </h2>
            <span className="text-xs text-ink-faint">자료를 눌러 내용을 확인하고 저장하세요</span>
          </div>
          <ul className="grid max-h-[264px] grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-2 overflow-y-auto pr-1">
            {items.map((it) => {
              const sv = STATUS_VIEW[it.status];
              const busy = it.status === "reading" || it.status === "analyzing";
              return (
                <li key={it.id} className="relative">
                  <button
                    onClick={() => it.status !== "saved" && setSelectedId(it.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition",
                      it.id === selectedId
                        ? "border-violet-300 bg-violet-50/80 ring-2 ring-violet-100"
                        : "border-transparent bg-white/70 hover:bg-white",
                      it.status === "saved" && "opacity-60",
                    )}
                  >
                    <SourceIcon kind={it.kind} size={34} />
                    <span className="min-w-0 flex-1 pr-4">
                      <span className="block truncate text-[13px] font-medium">{it.draft.title || it.label}</span>
                      <span className={cn("mt-0.5 flex items-center gap-1 text-[11px]", sv.className)}>
                        {busy && <LoaderCircle size={11} className="animate-spin" />}
                        {it.status === "saved" && <CircleCheck size={11} />}
                        {sv.label}
                        {it.draft.source?.fileSize ? (
                          <span className="text-ink-faint">· {formatBytes(it.draft.source.fileSize)}</span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                  {it.status === "saved" ? (
                    <Link
                      href={`/articles/${it.savedId}`}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-faint hover:bg-white hover:text-violet-500"
                      aria-label="저장된 자료 보기"
                    >
                      <ArrowRight size={13} />
                    </Link>
                  ) : (
                    <button
                      onClick={() => remove(it.id)}
                      className="absolute right-2 top-2 rounded-md p-0.5 text-ink-faint hover:bg-white hover:text-rose-500"
                      aria-label="목록에서 빼기"
                    >
                      <X size={12} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {selected && (
        <>
          {selected.message && (
            <p
              className={cn(
                "flex items-start gap-2 rounded-xl px-4 py-3 text-sm",
                selected.status === "failed" ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-700",
              )}
            >
              <CircleAlert size={16} className="mt-0.5 shrink-0" />
              {selected.message}
            </p>
          )}
          <ArticleForm
            key={selected.id}
            value={selected.draft}
            onChange={(patch) => update(selected.id, {}, patch)}
            onAnalyze={async () => {
              const { title, body, parentMode } = selected.draft;
              update(selected.id, { status: "analyzing" }, { ai: "loading" });
              const patch = await analyzeDraft(title, body);
              const link = patch.ai === "done" ? await autoLink({ title, keywords: patch.keywords ?? [], parentMode }) : {};
              update(
                selected.id,
                patch.ai === "done" ? { status: "ready", message: undefined } : { status: "warning", message: patch.aiError },
                { ...patch, ...link },
              );
            }}
            onSave={saveSelected}
            onCancel={() => remove(selected.id)}
            saveLabel={pendingCount > 1 ? "저장하고 다음 자료" : "저장"}
          />
        </>
      )}

      {items.length > 0 && pendingCount === 0 && (
        <section className="glass flex flex-col items-center p-10 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-500">
            <CircleCheck size={26} />
          </span>
          <p className="mt-4 text-lg font-bold">{savedItems.length}건을 모두 저장했어요</p>
          <div className="mt-6 flex gap-3">
            <button onClick={() => setItems([])} className="btn-ghost">
              <Plus size={15} /> 자료 더 넣기
            </button>
            <Link href="/" className="btn-brand">
              홈에서 확인 <ArrowRight size={15} />
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

/* ───────────── 자료 넣기 영역 ───────────── */

function Dropzone({
  compact,
  onFiles,
  onPasted,
  onManual,
}: {
  compact: boolean;
  onFiles: (files: File[]) => void;
  onPasted: (text: string) => void;
  onManual: () => void;
}) {
  const [over, setOver] = useState(false);
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    folderRef.current?.setAttribute("webkitdirectory", "");
  }, []);

  const submitText = () => {
    if (!text.trim()) return;
    onPasted(text);
    setText("");
  };

  return (
    <section
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false);
      }}
      onDrop={async (e) => {
        e.preventDefault();
        setOver(false);
        const files = await filesFromDataTransfer(e.dataTransfer);
        if (files.length) onFiles(files);
        else {
          const t = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text");
          if (t) onPasted(t);
        }
      }}
      className={cn(
        "glass relative overflow-hidden border-2 border-dashed transition",
        over ? "border-violet-400 bg-violet-50/80" : "border-violet-200/70",
        compact ? "p-5" : "p-8 md:p-10",
      )}
    >
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gradient-to-br from-sky-200/60 to-pink-200/60 blur-3xl" />

      <div className={cn("relative flex flex-col gap-5", !compact && "items-center text-center")}>
        {!compact && (
          <>
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-sky-100 via-violet-100 to-pink-100 text-violet-500">
              <Upload size={28} />
            </span>
            <div>
              <h2 className="text-xl font-bold">자료를 여기에 넣어주세요</h2>
              <p className="mt-1.5 text-sm text-ink-soft">
                파일·폴더를 끌어다 놓거나, 링크를 붙여넣으면 내용을 읽고 AI가 바로 요약·분류해요.
              </p>
            </div>
          </>
        )}

        <div className={cn("flex w-full flex-col gap-3 lg:flex-row", !compact && "max-w-3xl")}>
          <div className="relative flex-1">
            <ClipboardPaste size={16} className="absolute left-3.5 top-3.5 text-ink-faint" />
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submitText();
                }
              }}
              rows={1}
              placeholder="링크(여러 개는 줄바꿈)나 내용을 붙여넣고 Enter"
              className="field min-h-[46px] resize-none py-3 pl-10 pr-20 [field-sizing:content] max-h-40"
            />
            <button
              type="button"
              onClick={submitText}
              disabled={!text.trim()}
              className="absolute right-2 top-2 rounded-lg bg-violet-500 px-3 py-1.5 text-xs font-semibold text-white disabled:bg-violet-200"
            >
              넣기
            </button>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} className="btn-ghost flex-1 whitespace-nowrap bg-white">
              <Upload size={15} /> 파일 선택
            </button>
            <button type="button" onClick={() => folderRef.current?.click()} className="btn-ghost flex-1 whitespace-nowrap bg-white">
              <FolderOpen size={15} /> 폴더 선택
            </button>
            <button type="button" onClick={onManual} className="btn-ghost whitespace-nowrap" title="직접 입력">
              <PenLine size={15} />
              {!compact && "직접 입력"}
            </button>
          </div>
        </div>

        <div className={cn("flex flex-wrap gap-1.5", !compact && "justify-center")}>
          {ACCEPT_HINT.map((h) => (
            <span key={h} className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] text-ink-soft">
              {h}
            </span>
          ))}
          <span className="px-1 py-1 text-[11px] text-ink-faint">· 파일당 최대 20MB · 화면 어디서든 Ctrl+V로도 넣을 수 있어요</span>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          onFiles([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
      <input
        ref={folderRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          onFiles([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
    </section>
  );
}
