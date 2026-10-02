"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Bell,
  Box,
  ChevronDown,
  CirclePlay,
  FileText,
  GitBranch,
  Globe,
  House,
  Menu,
  MessageCircle,
  Plus,
  ScanSearch,
  Search,
  Users,
  X,
} from "lucide-react";
import { getCurrentUser, getUsers } from "@/lib/api";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "홈", icon: House },
  { href: "/articles/new", label: "자료 등록", icon: Plus },
  { href: "/search", label: "통합 검색", icon: Search },
  { href: "/similar", label: "유사 자료 찾기", icon: ScanSearch },
  { href: "/timeline", label: "이슈 타임라인", icon: GitBranch },
  { href: "/briefing", label: "보고서 작성", icon: FileText },
  { href: "/verify", label: "3D 검증", icon: Box },
];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-3 px-2">
      <span className="relative block h-10 w-10 shrink-0">
        <span className="absolute inset-0 rounded-[14px] bg-gradient-to-br from-sky-300 via-violet-300 to-pink-300 opacity-90 blur-[1px]" />
        <span className="absolute inset-[5px] rounded-[10px] bg-white/40 backdrop-blur" />
      </span>
      <span>
        <span className="block text-[15px] font-bold text-ink">위키비키 서랍</span>
        <span className="block text-[11px] text-ink-faint">함께 만드는 더 나은 기획</span>
      </span>
    </Link>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const users = getUsers();
  const teams = Object.entries(
    users.reduce<Record<string, number>>((acc, u) => ({ ...acc, [u.team]: (acc[u.team] ?? 0) + 1 }), {}),
  );

  return (
    <div className="glass flex h-full flex-col p-4">
      <Logo />
      <nav className="mt-8 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-3 text-[16.5px] transition",
                active
                  ? "bg-gradient-to-r from-violet-100 to-indigo-50 font-semibold text-violet-700"
                  : "text-ink-soft hover:bg-white/70 hover:text-ink",
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-6 px-2 pt-8">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Users size={15} /> 우리 팀
          </div>
          <p className="mt-1.5 text-xs text-ink-faint">
            {teams.map(([t, n]) => `${t} ${n}명`).join(" · ")} · 총 {users.length}명
          </p>
        </div>
        <p className="text-xs leading-relaxed text-ink-faint">
          “좋은 자료가
          <br />더 좋은 기획을 만듭니다.”
        </p>
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const user = getCurrentUser();

  return (
    <div className="mx-auto flex min-h-screen max-w-[1600px] gap-6 p-4 print:block print:p-0 lg:p-6">
      {/* 데스크톱 사이드바 */}
      <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] w-[240px] shrink-0 print:!hidden lg:block">
        <Sidebar />
      </aside>

      {/* 모바일 사이드바 */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/20 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-3 left-3 w-[260px]">
            <Sidebar onNavigate={() => setOpen(false)} />
            <button
              aria-label="메뉴 닫기"
              className="absolute right-3 top-3 rounded-lg p-1.5 text-ink-soft hover:bg-white"
              onClick={() => setOpen(false)}
            >
              <X size={18} />
            </button>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="mb-4 flex items-center justify-between gap-4 print:hidden">
          <button
            aria-label="메뉴 열기"
            className="rounded-xl p-2 text-ink-soft hover:bg-white/70 lg:hidden"
            onClick={() => setOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="ml-auto flex items-center gap-4">
            <button aria-label="알림" className="relative rounded-full p-2 text-ink-soft hover:bg-white/70">
              <Bell size={19} />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-rose-400" />
            </button>
            <button className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-white/70">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-rose-300 to-pink-400 text-xs font-semibold text-white">
                {user.name.slice(0, 1)}
              </span>
              <span className="text-sm font-medium">{user.name}</span>
              <ChevronDown size={15} className="text-ink-faint" />
            </button>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5 text-xs text-ink-faint print:hidden">
          <div className="flex gap-5">
            <span>이용약관</span>
            <span>개인정보처리방침</span>
            <span>고객센터</span>
          </div>
          <div className="flex gap-3">
            <Globe size={16} />
            <CirclePlay size={16} />
            <MessageCircle size={16} />
          </div>
        </footer>
      </div>
    </div>
  );
}
