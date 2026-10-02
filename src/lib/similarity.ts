/**
 * 자료 유사도 엔진 (TF-IDF + 코사인 유사도).
 *
 * - 단어(조사 제거) + 한글 2글자 조각(bigram)을 함께 써서 "반도체를"/"반도체" 같은 활용형도 맞춘다.
 * - 제목·키워드는 본문보다 가중치를 높게 준다.
 * - 흔한 단어는 IDF로 영향이 줄어든다.
 * 실제 AI 연동 후에는 임베딩 벡터의 코사인 유사도로 교체할 자리 — 반환 형태(percent, shared)는 그대로 유지.
 */
import type { Article } from "./types";

type Vec = Map<string, number>;

const JOSA = /(으로써|으로서|에서는|에게서|이라는|이라고|이었다|였다|이다|에서|에게|으로|부터|까지|처럼|보다|이나|라는|하는|했다|한다|된다|됐다|하고|하며|은|는|이|가|을|를|의|에|로|와|과|도|만|들)$/;
const STOP = new Set([
  "있다", "있는", "없는", "했다", "한다", "밝혔다", "것으로", "것이다", "이번", "대한", "위해", "통해", "따르면", "관련",
  "그리고", "하지만", "또한", "등", "및", "위한", "같은", "올해", "내년", "지난", "이후", "현재", "우리", "프로젝트", "자료",
  // 기사에 흔히 나오는 서술어·일반명사 (어느 주제에나 등장해 유사도를 부풀림)
  "공개", "발표", "대비", "기업", "회사", "영향", "전망", "전년", "대폭", "본격", "예정", "계획", "주요", "최근", "업계", "검토",
  "국내", "나타났", "보인다", "밝혔", "강화", "확대", "추진",
]);
const BODY_LIMIT = 4000;
/** 이 개수 이상 단어가 겹쳐야 감점 없이 유사도를 인정 */
const MIN_SHARED_TERMS = 3;

function words(text: string) {
  const out: string[] = [];
  for (const raw of text.toLowerCase().split(/[^0-9a-z가-힣]+/)) {
    const w = raw.replace(JOSA, "");
    if (w.length >= 2 && !STOP.has(w) && !/^\d+$/.test(w)) out.push(w);
  }
  return out;
}

/** 텍스트 → 단어/조각 빈도 (가중치 곱해서 누적) */
function addTerms(vec: Vec, text: string, weight: number) {
  for (const w of words(text)) {
    vec.set(w, (vec.get(w) ?? 0) + weight);
    // 한글 3글자 이상 단어는 2글자 조각도 추가 (복합어·활용형 대응)
    if (w.length >= 3 && /^[가-힣]+$/.test(w)) {
      for (let i = 0; i < w.length - 1; i++) {
        const g = "§" + w.slice(i, i + 2); // 조각 표시용 접두어
        vec.set(g, (vec.get(g) ?? 0) + weight * 0.4);
      }
    }
  }
}

export interface DocInput {
  title: string;
  keywords?: string[];
  summary?: string[];
  body?: string;
}

function termFreq(d: DocInput): Vec {
  const v: Vec = new Map();
  addTerms(v, d.title, 3);
  addTerms(v, (d.keywords ?? []).join(" "), 3);
  addTerms(v, (d.summary ?? []).join(" "), 2);
  addTerms(v, (d.body ?? "").slice(0, BODY_LIMIT), 1);
  // 문서 길이 영향 줄이기: 로그 스케일
  for (const [k, n] of v) v.set(k, 1 + Math.log(n));
  return v;
}

export interface SimilarityIndex {
  docs: { article: Article; tf: Vec; vec: Vec; norm: number }[];
  idf: (term: string) => number;
}

export function buildIndex(articles: Article[]): SimilarityIndex {
  const tfs = articles.map((a) => termFreq(a));
  const df = new Map<string, number>();
  tfs.forEach((tf) => tf.forEach((_, t) => df.set(t, (df.get(t) ?? 0) + 1)));
  const N = articles.length;
  const idf = (t: string) => Math.log((N + 1) / ((df.get(t) ?? 0) + 1)) + 1;

  const docs = articles.map((article, i) => {
    const vec: Vec = new Map();
    let sq = 0;
    for (const [t, f] of tfs[i]) {
      const w = f * idf(t);
      vec.set(t, w);
      sq += w * w;
    }
    return { article, tf: tfs[i], vec, norm: Math.sqrt(sq) };
  });
  return { docs, idf };
}

export interface SimilarityResult {
  article: Article;
  /** 0~1 코사인 유사도 */
  score: number;
  /** 화면 표시용 0~100 */
  percent: number;
  /** 유사하다고 판단한 근거 단어 (기여도 순) */
  shared: string[];
}

/**
 * 코사인 값 → 퍼센트.
 * 문서 유사도는 코사인 값이 낮게 나오는 편(관련 기사도 0.2~0.4)이라 제곱근으로 펼쳐서 보여준다.
 * 같은 문서 = 100%, 무관 = 0%. 순위는 코사인 값 그대로 정렬한다.
 */
export function toPercent(score: number) {
  return Math.round(Math.min(1, Math.sqrt(Math.max(0, score))) * 100);
}

export function similarityTier(percent: number) {
  if (percent >= 50) return { label: "매우 유사", tone: "high" as const };
  if (percent >= 35) return { label: "유사", tone: "mid" as const };
  if (percent >= 20) return { label: "약간 관련", tone: "low" as const };
  return { label: "관련 적음", tone: "none" as const };
}

/** 문서들 사이의 코사인 유사도 행렬 (자료 지도용) */
export function cosineMatrix(docs: DocInput[]): number[][] {
  const tfs = docs.map(termFreq);
  const df = new Map<string, number>();
  tfs.forEach((tf) => tf.forEach((_, t) => df.set(t, (df.get(t) ?? 0) + 1)));
  const idf = (t: string) => Math.log((docs.length + 1) / ((df.get(t) ?? 0) + 1)) + 1;
  const vecs = tfs.map((tf) => {
    const v: Vec = new Map();
    let sq = 0;
    for (const [t, f] of tf) {
      const w = f * idf(t);
      v.set(t, w);
      sq += w * w;
    }
    return { v, norm: Math.sqrt(sq) || 1 };
  });
  return vecs.map((a, i) =>
    vecs.map((b, j) => {
      if (i === j) return 1;
      let dot = 0;
      const [small, large] = a.v.size < b.v.size ? [a.v, b.v] : [b.v, a.v];
      for (const [t, w] of small) {
        const o = large.get(t);
        if (o) dot += w * o;
      }
      return dot / (a.norm * b.norm);
    }),
  );
}

export function rankBySimilarity(
  index: SimilarityIndex,
  query: DocInput,
  opts: { excludeId?: string; limit?: number } = {},
): SimilarityResult[] {
  const qtf = termFreq(query);
  const qvec: Vec = new Map();
  let qsq = 0;
  for (const [t, f] of qtf) {
    const w = f * index.idf(t);
    qvec.set(t, w);
    qsq += w * w;
  }
  const qnorm = Math.sqrt(qsq);
  if (!qnorm) return [];

  const results: SimilarityResult[] = [];
  for (const d of index.docs) {
    if (d.article.id === opts.excludeId || !d.norm) continue;
    let dot = 0;
    let gramHits = 0;
    const contrib: [string, number][] = [];
    for (const [t, w] of qvec) {
      const dw = d.vec.get(t);
      if (dw) {
        dot += w * dw;
        if (t.startsWith("§")) gramHits++;
        else contrib.push([t, w * dw]);
      }
    }
    // 겹치는 단어가 1~2개뿐이면 우연일 가능성이 커서 감점 (예: "개편" 하나만 같음)
    const coverage = Math.min(1, (contrib.length + gramHits * 0.3) / MIN_SHARED_TERMS);
    const score = (dot / (qnorm * d.norm)) * coverage;
    results.push({
      article: d.article,
      score,
      percent: toPercent(score),
      shared: contrib.sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t]) => t),
    });
  }
  return results.sort((a, b) => b.score - a.score).slice(0, opts.limit ?? results.length);
}
