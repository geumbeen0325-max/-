import type { Article, Comment, User } from "./types";

export const USERS: User[] = [
  { id: "u1", name: "권지오", role: "admin", team: "기획" },
  { id: "u2", name: "조이현", role: "member", team: "기획" },
  { id: "u3", name: "민서연", role: "member", team: "기획" },
  { id: "u4", name: "김지민", role: "member", team: "기획" },
  { id: "u5", name: "한경제", role: "member", team: "마케팅" },
  { id: "u6", name: "박도윤", role: "member", team: "마케팅" },
];

export const CURRENT_USER_ID = "u1";

function daysAgo(n: number, hour = 10) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

/** insight = 등록자가 남긴 첫 의견 (댓글로 변환됨) */
type Seed = Omit<Article, "createdAt" | "updatedAt"> & { ago: number; insight: string };

const seeds: Seed[] = [
  {
    id: "a1",
    ago: 21,
    title: "삼성전자, 차세대 AI 반도체 로드맵 발표",
    url: "https://news.example.com/samsung-ai-roadmap",
    body: "삼성전자가 차세대 AI 반도체 로드맵을 공개했다. 회사는 2027년까지 고대역폭메모리(HBM) 생산능력을 두 배로 늘리고, 온디바이스 AI용 NPU 라인업을 확대한다고 밝혔다. 업계는 이번 발표가 경쟁사의 AI 칩 전략에도 영향을 줄 것으로 보고 있다.",
    summary: [
      "삼성전자가 차세대 AI 반도체 로드맵을 공개했다.",
      "2027년까지 HBM 생산능력을 두 배로 늘리고 NPU 라인업을 확대한다.",
      "경쟁사의 AI 칩 전략 변화 여부를 지속 모니터링해야 한다.",
    ],
    category: "경쟁사",
    keywords: ["반도체", "삼성전자", "HBM", "AI"],
    insight: "AI 반도체 투자 경쟁이 본격화 — 하반기 제휴 전략 재점검 필요",
    parentArticleId: null,
    createdBy: "u4",
  },
  {
    id: "a2",
    ago: 6,
    title: "삼성전자, AI 반도체 신제품 개발 가속화",
    url: "https://news.example.com/samsung-ai-chip",
    body: "삼성전자가 차세대 AI 반도체 제품 개발을 본격화하며 글로벌 시장 공략에 속도를 내고 있다. 업계는 이번 신제품이 경쟁사 대비 성능 우위를 확보할 것으로 전망한다. 회사는 내년 상반기 양산을 목표로 하고 있다.",
    summary: [
      "삼성전자가 차세대 AI 반도체 제품 개발을 본격화했다.",
      "글로벌 시장 공략에 속도를 내며 내년 상반기 양산을 목표로 한다.",
      "업계는 경쟁사 대비 성능 우위 확보를 전망한다.",
    ],
    category: "경쟁사",
    keywords: ["반도체", "삼성전자", "AI", "경쟁사"],
    insight: "로드맵 발표 후 실제 제품화 단계 진입 — 양산 일정 추적 필요",
    parentArticleId: "a1",
    createdBy: "u1",
  },
  {
    id: "a3",
    ago: 1,
    title: "삼성전자, AI 반도체 신제품 공개",
    url: "https://news.example.com/samsung-ai-chip-launch",
    body: "삼성전자가 AI 반도체 신제품을 공식 공개했다. 신제품은 전작 대비 전력 효율이 40% 개선됐으며, 주요 클라우드 기업과 공급 협의를 진행 중이다.",
    summary: [
      "삼성전자가 AI 반도체 신제품을 공식 공개했다.",
      "전작 대비 전력 효율이 40% 개선됐다.",
      "주요 클라우드 기업과 공급 협의를 진행 중이다.",
    ],
    category: "경쟁사",
    keywords: ["반도체", "삼성전자", "신제품", "AI"],
    insight: "클라우드 공급 계약 여부가 시장 판도의 분기점",
    parentArticleId: "a2",
    createdBy: "u1",
  },
  {
    id: "a4",
    ago: 2,
    title: "글로벌 전기차 시장, 2026년부터 수요 둔화 전망",
    url: "https://news.example.com/ev-market-slowdown",
    body: "글로벌 전기차 시장이 2026년부터 성장세가 둔화될 것이라는 전망이 나왔다. 주요국의 보조금 축소와 충전 인프라 부족이 주요 원인으로 지목됐다. 다만 하이브리드 차량 수요는 꾸준히 증가할 것으로 보인다.",
    summary: [
      "글로벌 전기차 시장 성장세가 2026년부터 둔화될 전망이다.",
      "주요국 보조금 축소와 충전 인프라 부족이 주요 원인이다.",
      "하이브리드 차량 수요는 꾸준히 증가할 것으로 보인다.",
    ],
    category: "시장",
    keywords: ["전기차", "시장동향", "배터리", "글로벌"],
    insight: "배터리 관련 신사업 계획의 수요 가정 재검토 필요",
    parentArticleId: null,
    createdBy: "u2",
  },
  {
    id: "a5",
    ago: 3,
    title: "정부, AI·바이오 산업 육성 위한 신규 정책 발표",
    url: "https://news.example.com/gov-ai-bio-policy",
    body: "정부가 AI·바이오 산업을 국가 핵심 전략 산업으로 지정하고, 연구개발 지원과 세제 혜택을 강화하는 신규 정책을 발표했다. 내년부터 관련 기업의 R&D 세액공제율이 상향된다.",
    summary: [
      "정부가 AI·바이오 산업을 국가 핵심 전략 산업으로 지정했다.",
      "연구개발 지원과 세제 혜택을 강화하는 신규 정책을 발표했다.",
      "내년부터 관련 기업의 R&D 세액공제율이 상향된다.",
    ],
    category: "정책",
    keywords: ["정책", "AI", "바이오", "정부지원"],
    insight: "R&D 세액공제 상향 — 내년 예산 기획 시 반영 검토",
    parentArticleId: null,
    createdBy: "u2",
  },
  {
    id: "a6",
    ago: 0,
    title: "애플, 차세대 칩 'M5' 공개…성능 대폭 향상",
    url: "https://news.example.com/apple-m5",
    body: "애플이 차세대 칩 M5를 공개하며 AI 성능과 전력 효율이 크게 향상됐다고 밝혔다. 업계는 이번 칩이 모바일 기기와 데이터센터 시장에 큰 영향을 미칠 것으로 보고 있다.",
    summary: [
      "애플이 차세대 칩 M5를 공개했다.",
      "AI 성능과 전력 효율이 크게 향상됐다.",
      "모바일 기기와 데이터센터 시장에 영향을 미칠 전망이다.",
    ],
    category: "기술",
    keywords: ["애플", "M5", "칩", "기술"],
    insight: "온디바이스 AI 성능 기준선 상승 — 자사 서비스 사양 재검토",
    parentArticleId: null,
    createdBy: "u3",
  },
  {
    id: "a7",
    ago: 4,
    title: "네이버, AI 검색 서비스 '큐' 전면 개편",
    url: "https://news.example.com/naver-cue",
    body: "네이버가 AI 기반 검색 서비스 '큐'를 대대적으로 개편했다. 사용자 맞춤형 검색 경험을 강화했으며, 업계는 이번 개편이 국내 검색 시장 경쟁에 큰 영향을 줄 것으로 전망한다.",
    summary: [
      "네이버가 AI 기반 검색 서비스 '큐'를 대대적으로 개편했다.",
      "사용자 맞춤형 검색 경험을 강화했다.",
      "국내 검색 시장 경쟁에 큰 영향을 줄 전망이다.",
    ],
    category: "기술",
    keywords: ["네이버", "AI검색", "플랫폼", "검색"],
    insight: "AI 검색 노출 방식 변화 — 콘텐츠 마케팅 전략 점검 필요",
    parentArticleId: null,
    createdBy: "u4",
  },
  {
    id: "a8",
    ago: 5,
    title: "바이오 업계, 글로벌 파트너십 확대 움직임",
    url: "https://news.example.com/bio-partnership",
    body: "국내 바이오 기업들이 글로벌 제약사와의 파트너십을 확대하며 해외 진출에 속도를 내고 있다. 전문가들은 기술력과 임상 데이터가 해외 시장 진출의 핵심이 될 것이라고 분석했다.",
    summary: [
      "국내 바이오 기업들이 글로벌 제약사와 파트너십을 확대하고 있다.",
      "해외 진출에 속도를 내고 있다.",
      "기술력과 임상 데이터가 해외 진출의 핵심으로 꼽힌다.",
    ],
    category: "시장",
    keywords: ["바이오", "파트너십", "글로벌", "해외"],
    insight: "정부 바이오 육성 정책과 맞물려 제휴 기회 확대 예상",
    parentArticleId: null,
    createdBy: "u5",
  },
  {
    id: "a9",
    ago: 9,
    title: "개인정보보호위원회, 생성형 AI 가이드라인 초안 공개",
    url: "https://news.example.com/pipc-genai-guide",
    body: "개인정보보호위원회가 생성형 AI 서비스의 개인정보 처리 가이드라인 초안을 공개했다. 학습 데이터의 가명처리 기준과 이용자 고지 의무가 구체화됐다.",
    summary: [
      "개인정보보호위원회가 생성형 AI 개인정보 처리 가이드라인 초안을 공개했다.",
      "학습 데이터 가명처리 기준이 구체화됐다.",
      "이용자 고지 의무가 강화된다.",
    ],
    category: "정책",
    keywords: ["개인정보", "생성형AI", "가이드라인", "규제"],
    insight: "자사 AI 기능 출시 전 고지 문구·데이터 처리 절차 점검 필요",
    parentArticleId: null,
    createdBy: "u3",
  },
  {
    id: "a10",
    ago: 12,
    title: "국내 SaaS 시장 규모 전년 대비 18% 성장",
    url: "https://news.example.com/saas-market",
    body: "국내 SaaS 시장이 전년 대비 18% 성장한 것으로 나타났다. 협업 도구와 보안 솔루션이 성장을 견인했다.",
    summary: [
      "국내 SaaS 시장이 전년 대비 18% 성장했다.",
      "협업 도구와 보안 솔루션이 성장을 견인했다.",
      "기업의 클라우드 전환이 계속될 전망이다.",
    ],
    category: "시장",
    keywords: ["SaaS", "클라우드", "시장동향"],
    insight: "협업 도구 시장 진입 시 보안 기능 차별화가 관건",
    parentArticleId: null,
    createdBy: "u6",
  },
];

export const SEED_ARTICLES: Article[] = seeds.map((s, i) => {
  const { ago, insight, ...a } = s;
  void insight; // 첫 댓글로 옮겨짐 (SEED_COMMENTS)
  const at = daysAgo(ago, 9 + (i % 8));
  return { ...a, createdAt: at, updatedAt: at };
});

function laterThan(iso: string, minutes: number) {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

/** 등록자의 첫 의견 + 팀원 답글 몇 개 */
export const SEED_COMMENTS: Comment[] = [
  ...seeds.map((s, i) => ({
    id: `c-${s.id}`,
    articleId: s.id,
    parentId: null,
    authorId: s.createdBy,
    text: s.insight,
    likes: i % 3 === 0 ? ["u2", "u3"] : i % 3 === 1 ? ["u1"] : [],
    createdAt: laterThan(SEED_ARTICLES[i].createdAt, 5),
  })),
  {
    id: "c-a3-r1",
    articleId: "a3",
    parentId: "c-a3",
    authorId: "u4",
    text: "로드맵 기사(9월 초)부터 쭉 보면 일정이 계획보다 빨라요. 다음 주 회의 안건으로 올릴까요?",
    likes: ["u1"],
    createdAt: laterThan(SEED_ARTICLES[2].createdAt, 40),
  },
  {
    id: "c-a3-r2",
    articleId: "a3",
    parentId: "c-a3",
    authorId: "u1",
    text: "좋아요. 클라우드 공급사 쪽 반응까지 같이 정리해서 올려주세요.",
    likes: [],
    createdAt: laterThan(SEED_ARTICLES[2].createdAt, 75),
  },
  {
    id: "c-a4-2",
    articleId: "a4",
    parentId: null,
    authorId: "u5",
    text: "마케팅 쪽에서는 하이브리드 수요 증가 부분이 더 중요해 보여요. 관련 자료 있으면 이어서 올려주세요!",
    likes: ["u2", "u6"],
    createdAt: laterThan(SEED_ARTICLES[3].createdAt, 120),
  },
  {
    id: "c-a7-r1",
    articleId: "a7",
    parentId: "c-a7",
    authorId: "u6",
    text: "검색 결과에 AI 답변이 먼저 뜨면 블로그 유입이 줄 것 같아요. 유입 데이터 확인해볼게요.",
    likes: ["u4"],
    createdAt: laterThan(SEED_ARTICLES[6].createdAt, 30),
  },
];
