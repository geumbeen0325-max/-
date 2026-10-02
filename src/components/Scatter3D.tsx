"use client";

import { useEffect, useRef } from "react";

export interface P3D {
  id: string;
  pos: [number, number, number]; // -1 ~ 1
  color: string; // #rrggbb
  radius?: number;
  label?: string;
  sub?: string;
  shape?: "sphere" | "star";
  /** 강조 테두리 (예: 인용한 자료) */
  ring?: string;
  dim?: boolean;
  alwaysLabel?: boolean;
}

export interface L3D {
  from: string;
  to: string;
  color: string;
  dashed?: boolean;
}

interface Props {
  points: P3D[];
  links?: L3D[];
  /** 축 이름이 있으면 0~1 큐브(품질 공간)로 그린다 */
  axes?: [string, string, string];
  /** 품질 공간의 목표 영역 하한 (0~1) */
  target?: number;
  height?: number;
  onSelect?: (id: string) => void;
}

type Projected = { p: P3D; x: number; y: number; z: number; s: number };

function mix(hex: string, to: number, t: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(c + (to - c) * t));
  return `rgb(${ch.join(",")})`;
}

/** 드래그로 회전, 휠로 확대/축소, 마우스를 올리면 정보, 클릭하면 onSelect */
export default function Scatter3D({ points, links = [], axes, target, height = 520, onSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useRef({ yaw: -0.6, pitch: 0.35, zoom: 1, auto: true, drag: null as null | { x: number; y: number; moved: boolean }, hover: null as string | null });
  const projected = useRef<Projected[]>([]);
  const data = useRef({ points, links, axes, target, onSelect });
  useEffect(() => {
    data.current = { points, links, axes, target, onSelect };
  }, [points, links, axes, target, onSelect]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let w = 0;
    let h = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const project = (x: number, y: number, z: number) => {
      const { yaw, pitch, zoom } = state.current;
      const x2 = x * Math.cos(yaw) + z * Math.sin(yaw);
      const z2 = -x * Math.sin(yaw) + z * Math.cos(yaw);
      const y2 = y * Math.cos(pitch) - z2 * Math.sin(pitch);
      const z3 = y * Math.sin(pitch) + z2 * Math.cos(pitch);
      const cam = 4;
      const persp = cam / (cam - z3);
      const scale = Math.min(w, h) * (data.current.axes ? 0.27 : 0.36) * zoom;
      return { x: w / 2 + x2 * scale * persp, y: h / 2 - y2 * scale * persp, z: z3, s: persp };
    };

    // 품질 공간은 0~1 값을 -1~1 큐브로
    const toCube = (v: number) => v * 2 - 1;

    const drawFrame = () => {
      const { points, links, axes, target } = data.current;
      const st = state.current;
      if (st.auto && !st.drag) st.yaw += 0.0025;
      ctx.clearRect(0, 0, w, h);

      // 바닥 격자 / 큐브
      ctx.lineWidth = 1;
      const edge = (a: number[], b: number[], color: string, dash: number[] = []) => {
        const p1 = project(a[0], a[1], a[2]);
        const p2 = project(b[0], b[1], b[2]);
        ctx.strokeStyle = color;
        ctx.setLineDash(dash);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.setLineDash([]);
      };
      const box = (lo: number, hi: number, color: string, dash: number[] = []) => {
        const c = [lo, hi];
        for (const i of c) for (const j of c) {
          edge([lo, i, j], [hi, i, j], color, dash);
          edge([i, lo, j], [i, hi, j], color, dash);
          edge([i, j, lo], [i, j, hi], color, dash);
        }
      };
      if (axes) {
        box(-1, 1, "rgba(124,116,196,0.22)");
        if (target !== undefined) {
          // 목표 영역 (세 축 모두 target 이상)
          const t = toCube(target);
          box(t, 1, "rgba(16,185,129,0.55)", [4, 4]);
          const c = project((t + 1) / 2, (t + 1) / 2, (t + 1) / 2);
          ctx.fillStyle = "rgba(5,150,105,0.85)";
          ctx.font = "600 11px Pretendard, sans-serif";
          ctx.fillText("목표 영역", c.x + 6, c.y);
        }
        // 축 이름 + 눈금
        const axisEnds: [number[], number[]][] = [
          [[-1, -1, -1], [1, -1, -1]],
          [[-1, -1, -1], [-1, 1, -1]],
          [[-1, -1, -1], [-1, -1, 1]],
        ];
        axisEnds.forEach(([a, b], i) => {
          edge(a, b, "rgba(124,58,237,0.7)");
          const end = project(b[0] * 1.12 + (i === 0 ? 0.05 : 0), b[1] * 1.12, b[2] * 1.12);
          ctx.fillStyle = "#6d28d9";
          ctx.font = "700 12px Pretendard, sans-serif";
          ctx.fillText(axes[i], end.x - 10, end.y);
          for (const v of [0, 50, 100]) {
            const pos = [...a];
            pos[i] = toCube(v / 100);
            const tp = project(pos[0], pos[1], pos[2]);
            ctx.fillStyle = "#a3a1bf";
            ctx.font = "10px Pretendard, sans-serif";
            ctx.fillText(String(v), tp.x + 3, tp.y + 11);
          }
        });
      } else {
        for (let i = -1; i <= 1.001; i += 0.5) {
          edge([i, -1.05, -1], [i, -1.05, 1], "rgba(124,116,196,0.12)");
          edge([-1, -1.05, i], [1, -1.05, i], "rgba(124,116,196,0.12)");
        }
      }

      // 점 투영
      const proj: Projected[] = points.map((p) => {
        const [x, y, z] = axes ? (p.pos.map(toCube) as [number, number, number]) : p.pos;
        return { p, ...project(x, y, z) };
      });
      projected.current = proj;
      const byId = new Map(proj.map((q) => [q.p.id, q]));

      // 연결선
      for (const l of links) {
        const a = byId.get(l.from);
        const b = byId.get(l.to);
        if (!a || !b) continue;
        ctx.strokeStyle = l.color;
        ctx.lineWidth = 1.4;
        ctx.setLineDash(l.dashed ? [5, 5] : []);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // 뒤에서 앞으로 그리기
      for (const q of [...proj].sort((a, b) => a.z - b.z)) {
        const { p } = q;
        const r = (p.radius ?? 7) * q.s;
        const hovered = st.hover === p.id;
        ctx.globalAlpha = p.dim ? 0.35 : 1;
        if (p.shape === "star") {
          ctx.save();
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 18;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          for (let i = 0; i < 10; i++) {
            const ang = -Math.PI / 2 + (i * Math.PI) / 5;
            const rr = i % 2 ? r * 0.45 : r * 1.25;
            ctx.lineTo(q.x + Math.cos(ang) * rr, q.y + Math.sin(ang) * rr);
          }
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else {
          const g = ctx.createRadialGradient(q.x - r * 0.35, q.y - r * 0.35, r * 0.1, q.x, q.y, r);
          g.addColorStop(0, mix(p.color, 255, 0.6));
          g.addColorStop(1, p.color);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
          ctx.fill();
          if (p.ring) {
            ctx.strokeStyle = p.ring;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(q.x, q.y, r + 3, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        if (hovered) {
          ctx.strokeStyle = "#1f1d3a";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(q.x, q.y, r + 6, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        if (p.label && (p.alwaysLabel || hovered)) {
          const text = p.label.length > 26 ? p.label.slice(0, 25) + "…" : p.label;
          ctx.font = `${hovered ? 700 : 600} 12px Pretendard, sans-serif`;
          const tw = ctx.measureText(text).width;
          const subW = p.sub && hovered ? ctx.measureText(p.sub).width : 0;
          const bw = Math.max(tw, subW) + 14;
          const bh = p.sub && hovered ? 38 : 22;
          const bx = Math.min(w - bw - 4, Math.max(4, q.x + r + 6));
          const by = q.y - bh / 2;
          ctx.fillStyle = "rgba(255,255,255,0.92)";
          ctx.strokeStyle = "rgba(124,116,196,0.25)";
          ctx.beginPath();
          ctx.roundRect(bx, by, bw, bh, 8);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#1f1d3a";
          ctx.fillText(text, bx + 7, by + 15);
          if (p.sub && hovered) {
            ctx.fillStyle = "#6b6890";
            ctx.font = "11px Pretendard, sans-serif";
            ctx.fillText(p.sub, bx + 7, by + 30);
          }
        }
      }
      raf = requestAnimationFrame(drawFrame);
    };
    raf = requestAnimationFrame(drawFrame);

    const hit = (e: PointerEvent | MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      let best: Projected | null = null;
      let bestD = Infinity;
      for (const q of projected.current) {
        const d = Math.hypot(q.x - mx, q.y - my);
        const r = (q.p.radius ?? 7) * q.s + 5;
        if (d < r && (d < bestD || (best && q.z > best.z))) {
          best = q;
          bestD = d;
        }
      }
      return best?.p.id ?? null;
    };

    const down = (e: PointerEvent) => {
      state.current.drag = { x: e.clientX, y: e.clientY, moved: false };
      state.current.auto = false;
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      const st = state.current;
      if (st.drag) {
        const dx = e.clientX - st.drag.x;
        const dy = e.clientY - st.drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 2) st.drag.moved = true;
        st.yaw += dx * 0.008;
        st.pitch = Math.max(-1.4, Math.min(1.4, st.pitch + dy * 0.008));
        st.drag.x = e.clientX;
        st.drag.y = e.clientY;
      } else {
        st.hover = hit(e);
        canvas.style.cursor = st.hover ? "pointer" : "grab";
      }
    };
    const up = (e: PointerEvent) => {
      const st = state.current;
      if (st.drag && !st.drag.moved) {
        const id = hit(e);
        if (id) data.current.onSelect?.(id);
      }
      st.drag = null;
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      state.current.zoom = Math.max(0.5, Math.min(2.5, state.current.zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
    };
    const leave = () => (state.current.hover = null);

    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointerleave", leave);
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointerleave", leave);
      canvas.removeEventListener("wheel", wheel);
    };
  }, []);

  return (
    <div className="relative">
      <canvas ref={canvasRef} className="block w-full touch-none select-none" style={{ height, cursor: "grab" }} />
      <button
        type="button"
        onClick={() => {
          Object.assign(state.current, { yaw: -0.6, pitch: 0.35, zoom: 1, auto: true });
        }}
        className="absolute right-3 top-3 rounded-lg bg-white/80 px-2.5 py-1 text-[11px] text-ink-soft shadow-sm hover:bg-white"
      >
        시점 초기화
      </button>
      <p className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-ink-faint">드래그: 회전 · 휠: 확대/축소 · 점 클릭: 자료 열기</p>
    </div>
  );
}
