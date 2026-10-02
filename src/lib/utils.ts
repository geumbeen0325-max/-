import type { Category } from "./types";

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 2026.09.25 */
export function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

/** 09.25 */
export function formatShortDate(iso: string) {
  const d = new Date(iso);
  return `${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

/** 방금 / 5분 전 / 3시간 전 / 2일 전 / 2026.09.25 */
export function timeAgo(iso: string, now = Date.now()) {
  const min = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  if (min < 60 * 24) return `${Math.floor(min / 60)}시간 전`;
  if (min < 60 * 24 * 7) return `${Math.floor(min / 60 / 24)}일 전`;
  return formatDate(iso);
}

/** YYYY-MM-DD (로컬 기준) */
export function toDateInput(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 월요일 시작 ~ 일요일 종료 */
export function weekRange(base = new Date(), offsetWeeks = 0) {
  const start = new Date(base);
  start.setHours(0, 0, 0, 0);
  const day = (start.getDay() + 6) % 7; // 월=0
  start.setDate(start.getDate() - day + offsetWeeks * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/** 2026년 10월 1주차 */
export function weekLabel(start: Date) {
  // 주의 목요일이 속한 달을 기준으로 주차 계산
  const thursday = new Date(start);
  thursday.setDate(start.getDate() + 3);
  const week = Math.ceil(thursday.getDate() / 7);
  return `${thursday.getFullYear()}년 ${thursday.getMonth() + 1}월 ${week}주차`;
}

export function isValidUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** 중복 비교용 정규화: 앞뒤 공백, 끝 슬래시, 대소문자 */
export function normalizeUrl(value: string) {
  return value.trim().replace(/\/+$/, "").toLowerCase();
}

export function normalizeTitle(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

/** 캔버스(3D 지도)용 분류 색 */
export const CATEGORY_HEX: Record<Category, string> = {
  경쟁사: "#fb7185",
  시장: "#38bdf8",
  정책: "#34d399",
  기술: "#a78bfa",
};

export const CATEGORY_STYLE: Record<
  Category,
  { badge: string; dot: string; soft: string; text: string; gradient: string }
> = {
  경쟁사: {
    badge: "bg-rose-100 text-rose-600",
    dot: "bg-rose-400",
    soft: "bg-rose-50",
    text: "text-rose-500",
    gradient: "from-rose-200 via-pink-200 to-violet-200",
  },
  시장: {
    badge: "bg-sky-100 text-sky-600",
    dot: "bg-sky-400",
    soft: "bg-sky-50",
    text: "text-sky-500",
    gradient: "from-sky-200 via-blue-200 to-indigo-200",
  },
  정책: {
    badge: "bg-emerald-100 text-emerald-600",
    dot: "bg-emerald-400",
    soft: "bg-emerald-50",
    text: "text-emerald-500",
    gradient: "from-emerald-200 via-teal-200 to-cyan-200",
  },
  기술: {
    badge: "bg-violet-100 text-violet-600",
    dot: "bg-violet-400",
    soft: "bg-violet-50",
    text: "text-violet-500",
    gradient: "from-violet-200 via-purple-200 to-fuchsia-200",
  },
};
