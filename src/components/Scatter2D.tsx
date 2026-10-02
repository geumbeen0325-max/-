"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface P2D {
  id: string;
  pos: [number, number];
  color: string;
  radius?: number;
  label?: string;
  sub?: string;
  shape?: "circle" | "star";
  /** 강조 테두리 (예: 인용한 자료) */
  ring?: string;
  dim?: boolean;
  alwaysLabel?: boolean;
}

export interface L2D {
  from: string;
  to: string;
  color: string;
  dashed?: boolean;
}

const W = 1000;
const PAD = 70;

function starPath(cx: number, cy: number, r: number) {
  return Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r * 1.25;
    return `${i ? "L" : "M"}${cx + Math.cos(a) * rr},${cy + Math.sin(a) * rr}`;
  }).join(" ") + "Z";
}

/** 2D 산점도 — 휠: 확대/축소, 드래그: 이동, 마우스 올리기: 정보, 클릭: onSelect */
export default function Scatter2D({
  points,
  links = [],
  height = 560,
  onSelect,
}: {
  points: P2D[];
  links?: L2D[];
  height?: number;
  onSelect?: (id: string) => void;
}) {
  const H = height;
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [hover, setHover] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);

  // 가로·세로 같은 배율로 화면에 맞춤 (거리 왜곡 없이)
  const placed = useMemo(() => {
    if (!points.length) return [];
    const xs = points.map((p) => p.pos[0]);
    const ys = points.map((p) => p.pos[1]);
    const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const s = Math.min((W - 2 * PAD) / Math.max(1e-6, maxX - minX), (H - 2 * PAD) / Math.max(1e-6, maxY - minY));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    return points.map((p) => ({ p, x: W / 2 + (p.pos[0] - cx) * s, y: H / 2 - (p.pos[1] - cy) * s }));
  }, [points, H]);
  const byId = useMemo(() => new Map(placed.map((q) => [q.p.id, q])), [placed]);

  // 화면 좌표(px) → SVG 좌표
  const toSvg = (clientX: number, clientY: number) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const scale = Math.max(W / rect.width, H / rect.height);
    const offX = (rect.width * scale - W) / 2;
    const offY = (rect.height * scale - H) / 2;
    return { x: (clientX - rect.left) * scale - offX, y: (clientY - rect.top) * scale - offY };
  };

  // 휠 확대/축소 — 페이지 스크롤을 막아야 해서 passive: false로 직접 등록
  useEffect(() => {
    const svg = svgRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const m = toSvg(e.clientX, e.clientY);
      setView((v) => {
        const nk = Math.max(0.6, Math.min(4, v.k * (e.deltaY < 0 ? 1.15 : 0.87)));
        // 마우스 위치를 기준으로 확대
        return { k: nk, x: m.x - ((m.x - v.x) * nk) / v.k, y: m.y - ((m.y - v.y) * nk) / v.k };
      });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hovered = hover ? byId.get(hover) : null;
  const k = view.k;
  // 그리기 순서: 흐린 점 → 일반 → 강조 → 보고서
  const order = [...placed].sort((a, b) => Number(!a.p.dim) - Number(!b.p.dim) || (a.p.radius ?? 7) - (b.p.radius ?? 7));

  return (
    <div className="relative select-none">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full touch-none"
        // 가로세로 비율을 고정해서 툴팁(%) 위치가 SVG 좌표와 정확히 맞도록
        style={{ aspectRatio: `${W} / ${H}`, cursor: dragging ? "grabbing" : "grab" }}
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, moved: false };
          setDragging(true);
          (e.target as Element).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const a = toSvg(drag.current.x, drag.current.y);
          const b = toSvg(e.clientX, e.clientY);
          if (Math.abs(e.clientX - drag.current.x) + Math.abs(e.clientY - drag.current.y) > 3) drag.current.moved = true;
          setView((v) => ({ ...v, x: v.x + b.x - a.x, y: v.y + b.y - a.y }));
          drag.current.x = e.clientX;
          drag.current.y = e.clientY;
        }}
        onPointerUp={() => {
          setDragging(false);
          // click 이벤트가 먼저 '드래그였는지'를 확인할 수 있게 한 박자 늦게 비움
          setTimeout(() => (drag.current = null), 0);
        }}
      >
        {/* 배경 격자 */}
        <defs>
          <pattern id="grid2d" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M50 0H0V50" fill="none" stroke="rgba(124,116,196,0.08)" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#grid2d)" />

        <g transform={`translate(${view.x} ${view.y}) scale(${k})`}>
          {links.map((l) => {
            const a = byId.get(l.from);
            const b = byId.get(l.to);
            if (!a || !b) return null;
            return (
              <line
                key={`${l.from}-${l.to}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={l.color}
                strokeWidth={1.6 / k}
                strokeDasharray={l.dashed ? `${6 / k} ${5 / k}` : undefined}
              />
            );
          })}

          {order.map(({ p, x, y }) => {
            const r = (p.radius ?? 7) / k;
            const isHover = hover === p.id;
            return (
              <g
                key={p.id}
                opacity={p.dim && !isHover ? 0.35 : 1}
                onPointerEnter={() => setHover(p.id)}
                onPointerLeave={() => setHover((h) => (h === p.id ? null : h))}
                onClick={() => !drag.current?.moved && onSelect?.(p.id)}
                style={{ cursor: "pointer" }}
              >
                {p.shape === "star" ? (
                  <path d={starPath(x, y, r)} fill={p.color} style={{ filter: `drop-shadow(0 0 ${6 / k}px ${p.color})` }} />
                ) : (
                  <>
                    <circle cx={x} cy={y} r={r} fill={p.color} stroke="white" strokeWidth={1.5 / k} />
                    {p.ring && <circle cx={x} cy={y} r={r + 3.5 / k} fill="none" stroke={p.ring} strokeWidth={2.5 / k} />}
                  </>
                )}
                {isHover && <circle cx={x} cy={y} r={r + 8 / k} fill="none" stroke="#1f1d3a" strokeWidth={1.5 / k} />}
                {p.label && (p.alwaysLabel || isHover) && (
                  <text
                    x={x + r + 7 / k}
                    y={y + 4 / k}
                    fontSize={15 / k}
                    fontWeight={p.shape === "star" ? 700 : 600}
                    fill="#1f1d3a"
                    stroke="white"
                    strokeWidth={4 / k}
                    paintOrder="stroke"
                  >
                    {p.label.length > 24 ? p.label.slice(0, 23) + "…" : p.label}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {hovered?.p.sub && (
        <div
          className="pointer-events-none absolute z-10 max-w-[280px] rounded-xl border border-line bg-white/95 px-3 py-2 text-xs shadow-lg"
          style={{
            left: `${((hovered.x * k + view.x) / W) * 100}%`,
            top: `${((hovered.y * k + view.y) / H) * 100}%`,
            transform: "translate(14px, 14px)",
          }}
        >
          <p className="font-semibold text-ink">{hovered.p.label}</p>
          <p className="mt-0.5 text-ink-soft">{hovered.p.sub}</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setView({ x: 0, y: 0, k: 1 })}
        className="absolute right-3 top-3 rounded-lg bg-white/80 px-2.5 py-1 text-[11px] text-ink-soft shadow-sm hover:bg-white"
      >
        보기 초기화
      </button>
      <p className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-ink-faint">휠: 확대/축소 · 드래그: 이동 · 점 클릭: 자료 열기</p>
    </div>
  );
}
