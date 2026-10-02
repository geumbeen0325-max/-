# 위키비키 서랍 (프론트엔드)

`동향서랍_프로그램_개발설계서.md`(설계서)와 디자인 시안(PNG)을 기준으로 만든 Next.js 프론트엔드입니다.
서비스 이름은 설계서의 '동향 서랍'에서 **위키비키 서랍**으로 변경했습니다.

## 실행

```bash
npm install
npm run dev   # http://localhost:3000
```

## 화면 (설계서 9장)

| 경로 | 화면 |
| --- | --- |
| `/` | 대시보드 — 검색창, 이번 주/분류별 집계, 최신 자료 카드, 통합 보고서 작성 바로가기, 최근 팀 의견, 빠른 필터, 자료 캘린더(날짜별 등록 자료) |
| `/articles/new` | 자료 등록 — 파일·폴더·링크·텍스트를 넣으면 내용 자동 추출 → AI 분석 → **같은 이슈 자동 연결**, 여러 건 동시 처리 후 하나씩 검토·저장, 중복 경고, 첫 의견(선택) |
| `/articles/[id]` | 자료 상세 — 3줄 요약, 키워드, 원문, **원본 파일 미리보기·다운로드**, 유사한 자료, **팀 의견(댓글·답글·공감)** |
| `/articles/[id]/edit` | 자료 수정 |
| `/search` | 통합 검색 — 검색어 + 분류 + 기간 동시 필터, 검색어 하이라이트 |
| `/briefing` | 통합 보고서 작성 — 등록 자료를 골라(기간·분류·검색 필터) 보고서 한 건으로 만들기, 항목 편집·복사, Word·PPT·PDF·Google 문서·텍스트로 내보내기 |
| `/verify` | 3D 검증 — 만든 보고서 목록(제목·작성자 검색, 수정일·제목·종합 점수·참고 자료 수 정렬), `/verify/[id]`에서 근거 충실도·관점 균형·최신성 검증 |

## 자료 넣기 (`/api/extract` — 실제 동작하는 서버 라우트)

| 입력 | 처리 |
| --- | --- |
| 웹페이지 링크 | Readability로 본문 추출, EUC-KR 자동 판별, 통신사 바이라인 제거 |
| 파일 링크 / 구글 문서·드라이브·Dropbox 공유 링크 | 직접 다운로드 주소로 바꿔 받은 뒤 아래 파일 파서로 처리 (공개 링크만) |
| PDF | `unpdf` — 텍스트 PDF만 (스캔 PDF는 OCR 필요) |
| Excel · CSV · ODS | `xlsx` — 시트별 열 이름 + 최대 200행 |
| Word(docx) · PPT(pptx) · 한글(hwpx) | `mammoth` / zip 안의 XML 직접 파싱 |
| 텍스트·마크다운 | 그대로 |
| 폴더 | 드래그 또는 '폴더 선택' → 안의 파일을 하나씩 처리 (최대 50개) |
| 이미지, 구형 HWP | 아직 미지원 — 직접 입력 안내 |

보안: 내부망·메타데이터 주소(SSRF) 차단, 리다이렉트마다 재검증, 20MB·15초 제한.
원본 파일은 저장할 때 Supabase Storage `article-files` 버킷(비공개)에 함께 올리고(`lib/files.ts`), 경로는 `source.storagePath`에 둔다. 올리기에 실패해도 추출한 내용은 저장된다.
자료 상세의 미리보기: PDF는 브라우저 뷰어, 이미지·텍스트는 그대로, Word(docx)·Excel은 브라우저에서 HTML로 바꿔 스크립트가 막힌 iframe에 표시(`components/SourceFile.tsx`, 외부 서비스로 보내지 않음). PPT·한글은 추출한 내용을 보여주고 원본은 다운로드로 확인.
파일 보관 기능 이전에 등록한 자료는 원본 파일이 없다.

## 설계서 대비 변경 사항

- **시사점 → 팀 의견**: 자료별 필수 한 줄 메모(`insight`)를 없애고 댓글 기능으로 대체. 답글 1단계, 공감, 본인 글 수정·삭제.
  카드에는 대표 의견(공감 많은 순)과 댓글 수, 홈에는 최근 팀 의견, 통합 보고서 작성에는 분야별 팀 의견이 들어간다. 통합 검색 대상에 포함.
  → DB: `articles.insight` 제거, `comments(id, article_id, parent_id, author_id, text, created_at)` + `comment_likes(comment_id, user_id)` 추가.
- **후속 자료 수동 연결 → 자동 연결**: 등록 시 AI 분석 결과(키워드·제목)로 기존 자료 중 같은 이슈를 찾아 `parent_article_id`를 자동으로 채운다.
  흔한 단어("AI" 등)는 가중치를 낮추고 일반어·분류명은 제외 (`findRelatedArticles`). 사용자는 다른 후보 선택·연결 해제 가능.
  여러 건을 한 번에 넣으면 저장 순간에 다시 찾아서 같이 넣은 자료끼리도 이어진다. AI 연동 후 임베딩 유사도로 교체 예정.
- 기존 브라우저 데이터의 시사점은 처음 열 때 등록자의 첫 댓글로 자동 이전된다.
- **유사 자료 찾기 (`/similar`)**: 프로젝트 이름·내용(직접 입력, 파일·링크로 채우기)과 비슷한 자료를 유사도(%) 순으로 보여준다.
  프로젝트는 저장해 두고 다시 열 수 있다. 자료 상세에도 "유사한 자료" 패널(자료 ↔ 자료 %)이 있다.
  계산: `src/lib/similarity.ts` — TF-IDF 코사인 유사도(단어 + 한글 2글자 조각, 제목·키워드 가중), 겹치는 단어가 3개 미만이면 감점,
  표시용 %는 코사인 값의 제곱근(관련 기사도 원래 값이 0.2~0.4로 낮게 나오므로). 매우 유사 50%↑ / 유사 35%↑ / 약간 관련 20%↑.
  실제 AI 연동 후 임베딩 유사도로 교체해도 화면은 그대로 쓸 수 있게 반환 형태(`percent`, `shared`)를 고정해 두었다.

## 통합 보고서 작성 (`/briefing`)

- 등록된 자료를 기간(이번 주 / 지난 주 / 최근 30일 / 전체)·분류·검색어로 좁혀 체크박스로 고르고, 제목을 정해 보고서 한 건을 만든다 (`createBriefingReport`).
- 구성: 개요 · 분야별 주요 동향 · 팀 의견 · 종합 · 시사점. 고른 자료를 등록일 순으로 `[번호]` 인용하고, 문장은 자료 요약·팀 의견으로만 만든다(임시 규칙, AI 연동 시 교체). 시사점은 직접 쓰도록 비워 둔다.
- 만든 보고서는 `reports` 표에 저장되어 같은 화면에서 다시 열어 항목을 고치고, 텍스트 복사, 3D 검증으로 이어진다.
- **보고서 형식** (`lib/report-export.ts`): 만들 때와 편집 화면에서 고르고 그 형식으로 내보낸다.
  Word(.docx, `docx`) · PowerPoint(.pptx, `pptxgenjs` — 표지 + 항목별 슬라이드, 8줄 넘으면 '(계속)' 슬라이드) ·
  PDF(인쇄 창 → PDF로 저장) · Google 문서(서식 있는 내용을 복사하고 docs.new를 열어 붙여넣기) · 텍스트(.txt).
- 홈의 "통합 보고서 작성하기"는 이번 주 자료를 모두 고른 상태로, 유사 자료 찾기의 "비슷한 자료로 보고서 만들기"는 유사도 35% 이상 자료를 고른 상태로 연다.
- 예전 보고서 편집 화면(`/reports`)은 없앴다. `briefings` 표는 더 이상 쓰지 않는다.

### 3D 검증 (`/verify`)

| 축 | 계산 |
| --- | --- |
| 근거 충실도 | 보고서와 유사도 35% 이상인 자료 중 인용 비율(60%) + 항목별 근거 번호 비율(40%, 빈 항목은 근거 없음) |
| 관점 균형 | 관련 자료가 걸친 분류 중 인용 자료가 다룬 분류 비율 |
| 최신성 | 관련 자료 중 최근 30일 자료 인용 비율(70%) + 가장 최신 자료 인용 여부(30%) |

- **자료 지도 (2D)**: 보고서 + 전체 자료의 유사도 행렬을 고전적 MDS로 평면 배치(`lib/mds.ts`, `components/Scatter2D.tsx` — SVG, 휠 확대·드래그 이동).
  ★ 보고서, 보라 테두리 = 인용, 주황 = 놓친 자료.
- **품질 공간**: 세 점수를 x·y·z로 찍고 70점 이상 목표 영역 상자 표시. 검증 화면을 열 때마다(점수가 바뀐 경우) 기록되어 개선 궤적이 남음.
- 품질 공간 렌더링은 라이브러리 없이 캔버스 원근 투영(`components/Scatter3D.tsx`) — 드래그 회전, 휠 확대.
- 한계: "팀이 모은 근거를 충분히·고르게·최신으로 썼는가"를 보는 지표이며 주장의 옳고 그름이나 프로젝트 성패는 판단하지 않음.

## Supabase 스키마 (`supabase/schema.sql`)

Supabase 대시보드 → SQL Editor에 붙여넣고 실행. 표: `users`, `articles`, `comments`, `briefings`, `projects`, `reports` + Storage 버킷 `article-files`(읽기·올리기만 허용).

- 캠프용 권한: 로그인 없이(anon) **읽기·추가·수정 가능, 삭제 불가**. DELETE 정책을 만들지 않았고 DELETE·TRUNCATE 권한도 회수했다.
- 앱의 삭제 기능은 `deleted_at`에 시각을 넣는 **소프트 삭제**다(조회 시 `deleted_at is null` 조건). 공감 취소도 `likes` 배열 UPDATE로 처리.
- 여러 번 실행해도 안전(`if not exists`, 정책 재생성). 기본 팀원 6명을 고정 id로 넣는다.

## 백엔드 연동 (Supabase)

데이터는 **Supabase**에 저장되어 같은 주소로 접속한 팀원 모두가 같은 자료를 봅니다.
브라우저에서 `@supabase/supabase-js`로 직접 읽고 쓰며(`src/lib/supabase.ts`), 권한은 위 RLS 정책이 지킵니다.

`.env.local` (git에 올리지 않음, 배포 시 Vercel 환경변수에도 같은 값 등록):

```
NEXT_PUBLIC_SUPABASE_URL=https://<프로젝트>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

| 함수 (`src/lib/api.ts`, `reports.ts`) | 설계서 API | 표 |
| --- | --- | --- |
| `listArticles` | `GET /api/articles?q=&category=&from=&to=` | articles (+ 검색 시 comments) |
| `getArticle` / `createArticle` / `updateArticle` / `deleteArticle` | `GET·POST·PATCH·DELETE /api/articles` | articles |
| `checkDuplicate` | 중복 검사 (16장) | articles |
| `analyzeArticle` | `POST /api/ai/analyze` — 아직 본문 기반 규칙 mock, 본문 40자 미만이면 실패를 흉내냄 | — |
| `createBriefingReport` (`reports.ts`) | `POST /api/briefings/weekly` 대체 — 고른 자료로 보고서 생성 | reports (+ comments) |
| 댓글·프로젝트·보고서 함수 | — | comments, projects, reports |

검색·중복 검사·유사도는 삭제되지 않은 자료를 모두 불러와 브라우저에서 계산합니다(팀 규모 자료 수 기준). 자료가 수천 건을 넘으면 DB 검색으로 옮길 것.

로그인 사용자는 `src/lib/seed.ts`의 `CURRENT_USER_ID`(권지오, 관리자)로 고정되어 있습니다.
