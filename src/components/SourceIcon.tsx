import { File, FileSpreadsheet, FileText, FileType, Globe, Image, PenLine, Presentation, type LucideIcon } from "lucide-react";
import type { ArticleSource, SourceKind } from "@/lib/types";
import { cn } from "@/lib/utils";

export const SOURCE_META: Record<SourceKind | "manual", { label: string; icon: LucideIcon; color: string }> = {
  link: { label: "링크", icon: Globe, color: "bg-indigo-50 text-indigo-500" },
  pdf: { label: "PDF", icon: FileText, color: "bg-rose-50 text-rose-500" },
  excel: { label: "엑셀", icon: FileSpreadsheet, color: "bg-emerald-50 text-emerald-600" },
  word: { label: "워드", icon: FileText, color: "bg-blue-50 text-blue-500" },
  ppt: { label: "PPT", icon: Presentation, color: "bg-orange-50 text-orange-500" },
  hwp: { label: "한글", icon: FileType, color: "bg-sky-50 text-sky-500" },
  text: { label: "텍스트", icon: FileText, color: "bg-slate-100 text-slate-500" },
  image: { label: "이미지", icon: Image, color: "bg-fuchsia-50 text-fuchsia-500" },
  other: { label: "파일", icon: File, color: "bg-slate-100 text-slate-500" },
  manual: { label: "직접 입력", icon: PenLine, color: "bg-violet-50 text-violet-500" },
};

export function SourceIcon({ kind, size = 36 }: { kind: SourceKind | "manual"; size?: number }) {
  const { icon: Icon, color } = SOURCE_META[kind];
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-xl", color)} style={{ width: size, height: size }}>
      <Icon size={size * 0.48} />
    </span>
  );
}

export function formatBytes(n?: number) {
  if (!n) return "";
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}

export function SourceBadge({ source }: { source: ArticleSource }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white/70 p-3">
      <SourceIcon kind={source.kind} />
      <div className="min-w-0 text-xs">
        <p className="truncate font-semibold text-ink">{source.fileName ?? SOURCE_META[source.kind].label}</p>
        <p className="mt-0.5 text-ink-faint">
          {[source.detail, formatBytes(source.fileSize)].filter(Boolean).join(" · ")}
        </p>
      </div>
    </div>
  );
}
