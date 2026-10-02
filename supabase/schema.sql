-- ============================================================================
-- 위키비키 서랍 — Supabase 스키마
--
-- 실행: Supabase 대시보드 → SQL Editor → 이 파일 전체를 붙여넣고 Run
--       (여러 번 실행해도 안전하도록 작성)
--
-- 권한 정책 (캠프용):
--   누구나(로그인 없이 anon 포함) 읽기 · 추가 · 수정 가능, 삭제는 불가.
--   앱의 "삭제" 기능은 deleted_at 에 시각을 넣어 숨기는 방식(소프트 삭제)으로 처리한다.
--   → 실수나 장난으로 지워도 deleted_at 만 비우면 복구된다.
--
-- 표 구성 (src/lib/types.ts 와 1:1 대응, 컬럼은 snake_case)
--   users           팀원
--   articles        자료 (기사·링크·파일에서 추출한 본문 + AI 요약/분류/키워드)
--   comments        팀 의견 (댓글·답글·공감)
--   briefings       주간 동향 브리핑
--   projects        유사 자료 찾기에 저장한 프로젝트
--   reports         보고서 (항목·인용·3D 검증 기록)
-- ============================================================================

create extension if not exists pg_trgm;   -- 제목·본문 부분일치 검색 가속

-- updated_at 자동 갱신
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- users — 팀원
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  role        text not null default 'member' check (role in ('member', 'admin')),
  team        text not null default '기획',
  github_id   text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- articles — 자료
-- ---------------------------------------------------------------------------
create table if not exists public.articles (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null check (length(trim(title)) > 0),
  url                text not null default '',
  body               text not null default '',
  summary            text[] not null default '{}',          -- 3줄 요약
  category           text not null check (category in ('경쟁사', '시장', '정책', '기술')),
  keywords           text[] not null default '{}',
  parent_article_id  uuid references public.articles (id),  -- 같은 이슈의 이전 자료 (자동 연결)
  source             jsonb,                                  -- { kind, fileName, fileSize, detail }
  created_by         uuid references public.users (id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz                             -- 소프트 삭제
);

create index if not exists articles_created_at_idx on public.articles (created_at desc);
create index if not exists articles_category_idx   on public.articles (category);
create index if not exists articles_parent_idx     on public.articles (parent_article_id);
create index if not exists articles_url_idx        on public.articles (lower(url)) where url <> '';  -- 중복 검사
create index if not exists articles_keywords_idx   on public.articles using gin (keywords);
create index if not exists articles_title_trgm_idx on public.articles using gin (title gin_trgm_ops);
create index if not exists articles_body_trgm_idx  on public.articles using gin (body gin_trgm_ops);

drop trigger if exists articles_updated_at on public.articles;
create trigger articles_updated_at before update on public.articles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- comments — 팀 의견 (기존 '시사점'을 대체)
-- ---------------------------------------------------------------------------
create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  article_id  uuid not null references public.articles (id),
  parent_id   uuid references public.comments (id),   -- 답글이면 원 댓글 (1단계)
  author_id   uuid references public.users (id),
  text        text not null check (length(trim(text)) > 0),
  likes       uuid[] not null default '{}',           -- 공감한 사용자 id (공감 취소도 UPDATE로 처리)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index if not exists comments_article_idx on public.comments (article_id, created_at);
create index if not exists comments_parent_idx  on public.comments (parent_id);

drop trigger if exists comments_updated_at on public.comments;
create trigger comments_updated_at before update on public.comments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- briefings — 주간 동향 브리핑 (주마다 1건, 다시 생성하면 덮어씀 = upsert)
-- ---------------------------------------------------------------------------
create table if not exists public.briefings (
  id             uuid primary key default gen_random_uuid(),
  week_start     date not null unique,
  week_end       date not null,
  sections       jsonb not null default '[]',   -- [{ category, articleCount, changes, articles, opinions }]
  overall        text[] not null default '{}',
  content        text not null default '',      -- 보고서 초안 텍스트
  article_count  integer not null default 0,
  created_by     uuid references public.users (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

drop trigger if exists briefings_updated_at on public.briefings;
create trigger briefings_updated_at before update on public.briefings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- projects — 유사 자료 찾기에 저장한 프로젝트
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(trim(name)) > 0),
  description  text not null default '',
  created_by   uuid references public.users (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- reports — 보고서
-- ---------------------------------------------------------------------------
create table if not exists public.reports (
  id              uuid primary key default gen_random_uuid(),
  title           text not null default '제목 없는 보고서',
  template        text not null default 'trend' check (template in ('trend', 'proposal', 'free')),
  project_id      uuid references public.projects (id),
  sections        jsonb not null default '[]',   -- [{ id, heading, content }] 본문의 [n]은 citations 순번
  citations       uuid[] not null default '{}',  -- 인용 자료 id (순서 = 참고 자료 번호)
  status          text not null default '작성 중' check (status in ('작성 중', '완료')),
  verify_history  jsonb not null default '[]',   -- [{ at, scores: { evidence, balance, recency } }]
  created_by      uuid references public.users (id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index if not exists reports_updated_at_idx on public.reports (updated_at desc);

drop trigger if exists reports_updated_at on public.reports;
create trigger reports_updated_at before update on public.reports
  for each row execute function public.set_updated_at();

-- ============================================================================
-- RLS — 누구나 읽기·추가·수정 가능 / 삭제 불가
-- ============================================================================
do $$
declare
  t text;
begin
  foreach t in array array['users', 'articles', 'comments', 'briefings', 'projects', 'reports']
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "%s_select_all" on public.%I', t, t);
    execute format('drop policy if exists "%s_insert_all" on public.%I', t, t);
    execute format('drop policy if exists "%s_update_all" on public.%I', t, t);

    execute format('create policy "%s_select_all" on public.%I for select to anon, authenticated using (true)', t, t);
    execute format('create policy "%s_insert_all" on public.%I for insert to anon, authenticated with check (true)', t, t);
    execute format('create policy "%s_update_all" on public.%I for update to anon, authenticated using (true) with check (true)', t, t);
    -- DELETE 정책은 만들지 않는다 → RLS가 모든 삭제를 거부

    -- 이중 잠금: 삭제·전체비우기(TRUNCATE는 RLS를 우회함) 권한 자체를 회수
    execute format('revoke delete, truncate on public.%I from anon, authenticated', t);
  end loop;
end;
$$;

-- ============================================================================
-- 기본 팀원 (앱의 시드 사용자와 같은 구성, 고정 id)
-- ============================================================================
insert into public.users (id, name, role, team) values
  ('00000000-0000-0000-0000-000000000001', '권지오', 'admin',  '기획'),
  ('00000000-0000-0000-0000-000000000002', '조이현', 'member', '기획'),
  ('00000000-0000-0000-0000-000000000003', '민서연', 'member', '기획'),
  ('00000000-0000-0000-0000-000000000004', '김지민', 'member', '기획'),
  ('00000000-0000-0000-0000-000000000005', '한경제', 'member', '마케팅'),
  ('00000000-0000-0000-0000-000000000006', '박도윤', 'member', '마케팅')
on conflict (id) do nothing;
