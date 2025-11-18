export type Fit = { freq: number; intensity: string; time: number; type: string };
export type RuleOutput = { id: string; priority: number; confidence?: number; fit?: Partial<Fit> };
type Kernel = number[][];

const intensityToNum = (s: string): number => {
  if (s === '低强度') return 1;
  if (s === '中低强度') return 1.5;
  if (s === '中等强度') return 2;
  if (s === '高强度') return 3;
  return 2;
};
const numToIntensity = (x: number): string => {
  if (x <= 1.25) return '低强度';
  if (x <= 1.75) return '中低强度';
  if (x <= 2.5) return '中等强度';
  return '高强度';
};

const priorityToFactor = (p: number, map?: Record<number, number>): number => {
  if (map && map[p] != null) return Number(map[p]);
  return Math.max(0.1, p / 10);
};

const buildKernel = (n: number, init = 0): Kernel => {
  const K: Kernel = Array.from({ length: n }).map(() => Array.from({ length: n }).map(() => init));
  for (let i = 0; i < n; i++) K[i][i] = 1;
  return K;
};

export function crfFuse(
  rulesOutputs: RuleOutput[],
  context: Record<string, any>,
  options: { alpha?: number; beta?: number; priorityFactors?: Record<number, number>; kernelInit?: number } = {}
): { fusedFit: Fit; explain: { top: { id: string; score: number }[]; alpha: number; beta: number }; rawContributions: { id: string; score: number }[] } {
  const alpha = Number(options.alpha ?? 1);
  const beta = Number(options.beta ?? 0.1);
  const n = rulesOutputs.length;
  const K = buildKernel(n, options.kernelInit ?? 0);
  const w: number[] = rulesOutputs.map(r => alpha * priorityToFactor(r.priority, options.priorityFactors) * Number(r.confidence ?? 1));
  const freqVec: number[] = rulesOutputs.map(r => Number(r.fit?.freq ?? 0));
  const timeVec: number[] = rulesOutputs.map(r => Number(r.fit?.time ?? 0));
  const intensityVec: number[] = rulesOutputs.map(r => r.fit?.intensity ? intensityToNum(String(r.fit?.intensity)) : 0);

  const sumKTimes = (vec: number[]) => {
    const out: number[] = Array.from({ length: n }).map(() => 0);
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let j = 0; j < n; j++) s += K[i][j] * vec[j];
      out[i] = s;
    }
    return out;
  };

  const addVec = (a: number[], b: number[]) => a.map((v, i) => v + b[i]);
  const mulW = (vec: number[]) => vec.map((v, i) => w[i] * v);

  const freqFuseVec = addVec(mulW(freqVec), sumKTimes(freqVec).map(v => beta * v));
  const timeFuseVec = addVec(mulW(timeVec), sumKTimes(timeVec).map(v => beta * v));
  const intensityFuseVec = addVec(mulW(intensityVec), sumKTimes(intensityVec).map(v => beta * v));

  const freqSum = freqFuseVec.reduce((a, b) => a + b, 0);
  const timeSum = timeFuseVec.reduce((a, b) => a + b, 0);
  const intensitySum = intensityFuseVec.reduce((a, b) => a + b, 0);
  const wSum = w.reduce((a, b) => a + b, 0) + beta * n;

  const fusedFreq = Math.max(1, Math.round((freqSum / Math.max(1e-6, wSum))));
  const fusedTime = Math.max(10, Math.round((timeSum / Math.max(1e-6, wSum))));
  const fusedIntensity = numToIntensity(intensitySum / Math.max(1e-6, wSum));

  let topTypeId = '';
  let topScore = -Infinity;
  rulesOutputs.forEach((r, i) => {
    const s = (freqFuseVec[i] + timeFuseVec[i] + intensityFuseVec[i]);
    if (s > topScore && r.fit?.type) { topScore = s; topTypeId = r.id; }
  });
  const fusedType = rulesOutputs.find(r => r.id === topTypeId)?.fit?.type || '快走';

  const contributions = rulesOutputs.map((r, i) => ({ id: r.id, score: (freqFuseVec[i] + timeFuseVec[i] + intensityFuseVec[i]) }));
  const top = [...contributions].sort((a, b) => b.score - a.score).slice(0, 3);

  return {
    fusedFit: { freq: fusedFreq, intensity: fusedIntensity, time: fusedTime, type: fusedType },
    explain: { top, alpha, beta },
    rawContributions: contributions
  };
}