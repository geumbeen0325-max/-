/**
 * 유사도 행렬 → 3차원 좌표 (고전적 다차원 척도법, Classical MDS).
 * 내용이 비슷한 자료일수록 3D 공간에서 가까이 놓인다.
 */
export type Point3 = [number, number, number];

export function mds3(sim: number[][]): Point3[] {
  const n = sim.length;
  if (n === 0) return [];
  if (n === 1) return [[0, 0, 0]];

  // 거리² 행렬 → 이중 중심화: B = -½ J D² J
  const d2 = sim.map((row) => row.map((s) => (1 - Math.min(1, Math.max(0, s))) ** 2));
  const rowMean = d2.map((r) => r.reduce((a, b) => a + b, 0) / n);
  const total = rowMean.reduce((a, b) => a + b, 0) / n;
  const B = d2.map((r, i) => r.map((v, j) => -0.5 * (v - rowMean[i] - rowMean[j] + total)));

  // 거듭제곱법으로 상위 고유벡터 3개 (결정적 초기값 → 매번 같은 배치)
  const mul = (v: number[]) => B.map((r) => r.reduce((s, x, j) => s + x * v[j], 0));
  const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);
  const eig: { vec: number[]; val: number }[] = [];
  for (let k = 0; k < 3; k++) {
    let v = Array.from({ length: n }, (_, i) => Math.sin((i + 1) * (k + 1) * 1.7) + 0.01);
    for (let it = 0; it < 120; it++) {
      let w = mul(v);
      for (const e of eig) {
        const p = dot(w, e.vec);
        w = w.map((x, i) => x - p * e.vec[i]);
      }
      const norm = Math.sqrt(dot(w, w)) || 1;
      v = w.map((x) => x / norm);
    }
    eig.push({ vec: v, val: Math.max(0, dot(v, mul(v))) });
  }

  const pts: Point3[] = Array.from({ length: n }, (_, i) =>
    eig.map((e) => e.vec[i] * Math.sqrt(e.val)) as unknown as Point3,
  );
  // -1~1 범위로 정규화
  const max = Math.max(1e-6, ...pts.flat().map(Math.abs));
  return pts.map((p) => p.map((x) => x / max) as Point3);
}
