import { getUserName } from "@/lib/api";
import { cn } from "@/lib/utils";

const COLORS = [
  "from-rose-300 to-pink-400",
  "from-sky-300 to-indigo-400",
  "from-emerald-300 to-teal-400",
  "from-violet-300 to-purple-400",
  "from-amber-300 to-orange-400",
  "from-fuchsia-300 to-pink-400",
];

export default function Avatar({ userId, size = 32, className }: { userId: string; size?: number; className?: string }) {
  const name = getUserName(userId);
  const color = COLORS[[...userId].reduce((n, c) => n + c.charCodeAt(0), 0) % COLORS.length];
  return (
    <span
      title={name}
      className={cn("grid shrink-0 place-items-center rounded-full bg-gradient-to-br font-semibold text-white", color, className)}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {name.slice(0, 1)}
    </span>
  );
}
