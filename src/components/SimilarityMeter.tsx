import { similarityTier } from "@/lib/similarity";
import { cn } from "@/lib/utils";

const TONE = {
  high: { ring: "#8b5cf6", text: "text-violet-600", chip: "bg-violet-100 text-violet-700", bar: "from-violet-400 to-fuchsia-400" },
  mid: { ring: "#38bdf8", text: "text-sky-600", chip: "bg-sky-100 text-sky-700", bar: "from-sky-300 to-indigo-400" },
  low: { ring: "#94a3b8", text: "text-slate-500", chip: "bg-slate-100 text-slate-600", bar: "from-slate-300 to-slate-400" },
  none: { ring: "#cbd5e1", text: "text-slate-400", chip: "bg-slate-50 text-slate-400", bar: "from-slate-200 to-slate-300" },
};

/** 원형 유사도 게이지 (결과 목록용) */
export function SimilarityRing({ percent, size = 64 }: { percent: number; size?: number }) {
  const { tone } = similarityTier(percent);
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ede9fe" strokeWidth={6} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={TONE[tone].ring}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={`${(c * percent) / 100} ${c}`}
        />
      </svg>
      <span className={cn("absolute font-bold", TONE[tone].text)} style={{ fontSize: size * 0.26 }}>
        {percent}
        <span style={{ fontSize: size * 0.16 }}>%</span>
      </span>
    </span>
  );
}

/** 가로 막대 + 수치 (좁은 패널용) */
export function SimilarityBar({ percent }: { percent: number }) {
  const { tone } = similarityTier(percent);
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-violet-50">
        <span className={cn("block h-full rounded-full bg-gradient-to-r", TONE[tone].bar)} style={{ width: `${percent}%` }} />
      </span>
      <span className={cn("w-9 text-right text-xs font-bold", TONE[tone].text)}>{percent}%</span>
    </span>
  );
}

export function SimilarityChip({ percent }: { percent: number }) {
  const { label, tone } = similarityTier(percent);
  return <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold", TONE[tone].chip)}>{label}</span>;
}
