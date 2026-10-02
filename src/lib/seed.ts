import type { User } from "./types";

/** supabase/schema.sql 에서 넣는 기본 팀원과 같은 id */
export const USERS: User[] = [
  { id: "00000000-0000-0000-0000-000000000001", name: "권지오", role: "admin", team: "기획" },
  { id: "00000000-0000-0000-0000-000000000002", name: "조이현", role: "member", team: "기획" },
  { id: "00000000-0000-0000-0000-000000000003", name: "민서연", role: "member", team: "기획" },
  { id: "00000000-0000-0000-0000-000000000004", name: "김지민", role: "member", team: "기획" },
  { id: "00000000-0000-0000-0000-000000000005", name: "한경제", role: "member", team: "마케팅" },
  { id: "00000000-0000-0000-0000-000000000006", name: "박도윤", role: "member", team: "마케팅" },
];

export const CURRENT_USER_ID = USERS[0].id;
