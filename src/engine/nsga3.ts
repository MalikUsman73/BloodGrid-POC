import { nearestCompatible, sequentialGreedy, weightedSum } from './baselines';
import { donorTerms, evaluateTerms, type DonorTerms, type PoolContext } from './objectives';
import { combinations, paretoFront, type ParetoPoint } from './selection';
import type { Donor, ObjectiveValues, Urgency } from './types';

export interface NSGA3Options {
  /** Das and Dennis divisions. With four objectives, 6 divisions give 84 reference points. */
  divisions: number;
  /** Population size. Defaults to the number of reference points. */
  populationSize: number;
  maxGenerations: number;
  /** Stop after this many generations in which the non-dominated archive did not change. */
  patience: number;
  /** Hard cap on distinct contact sets evaluated. */
  maxEvaluations: number;
  /** Optional wall-clock budget in milliseconds. When it runs out the greedy set is returned and flagged. */
  deadlineMs?: number;
  seed: number;
  /** Probability that a child is mutated (one member swapped for an outsider). */
  mutationRate: number;
}

export const DEFAULT_NSGA3: NSGA3Options = {
  divisions: 6,
  populationSize: 84,
  maxGenerations: 300,
  patience: 30,
  maxEvaluations: 30_000,
  seed: 1,
  mutationRate: 0.35,
};

export interface NSGA3Search {
  front: ParetoPoint[];
  /** Distinct contact sets evaluated. */
  evaluated: number;
  generations: number;
  /** True when the run ended because the archive stopped changing, not because a cap was hit. */
  converged: boolean;
  /** True when the time budget ran out and the greedy set was returned instead. */
  fellBack: boolean;
  /** True when k is 1 (or the pool is no larger than k) and the exact search was used. */
  exact: boolean;
  poolUsed: number;
}

/** Small seeded generator (mulberry32), so a run is reproducible from its seed. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a over a string, used to turn a request and its pool into a seed. */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Objectives as a vector to minimise: travel, -recovery, -fulfilment, preservation. */
export const toVector = (o: ObjectiveValues): number[] => [o.travel, -o.recovery, -o.fulfilment, o.preservation];

function vecDominates(a: readonly number[], b: readonly number[]): boolean {
  let better = false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] > b[i]) return false;
    if (a[i] < b[i]) better = true;
  }
  return better;
}

/** Das and Dennis reference points on the unit simplex. */
export function referencePoints(objectives: number, divisions: number): number[][] {
  const out: number[][] = [];
  const walk = (prefix: number[], left: number, slots: number) => {
    if (slots === 1) {
      out.push([...prefix, left / divisions]);
      return;
    }
    for (let i = 0; i <= left; i += 1) walk([...prefix, i / divisions], left - i, slots - 1);
  };
  walk([], divisions, objectives);
  return out;
}

interface Individual {
  idx: number[];
  f: number[];
  key: string;
  rank: number;
}

const keyOf = (idx: readonly number[]) => idx.join(',');

function nonDominatedSort(pop: Individual[]): Individual[][] {
  const n = pop.length;
  const dominatedBy: number[][] = Array.from({ length: n }, () => []);
  const count = new Array<number>(n).fill(0);
  const fronts: number[][] = [[]];
  for (let p = 0; p < n; p += 1) {
    for (let q = p + 1; q < n; q += 1) {
      if (vecDominates(pop[p].f, pop[q].f)) {
        dominatedBy[p].push(q);
        count[q] += 1;
      } else if (vecDominates(pop[q].f, pop[p].f)) {
        dominatedBy[q].push(p);
        count[p] += 1;
      }
    }
  }
  for (let p = 0; p < n; p += 1) if (count[p] === 0) fronts[0].push(p);
  let i = 0;
  while (fronts[i].length > 0) {
    const next: number[] = [];
    for (const p of fronts[i]) {
      for (const q of dominatedBy[p]) {
        count[q] -= 1;
        if (count[q] === 0) next.push(q);
      }
    }
    i += 1;
    fronts.push(next);
  }
  fronts.pop();
  return fronts.map((fr, r) =>
    fr.map((p) => {
      pop[p].rank = r;
      return pop[p];
    }),
  );
}

/** Solve A x = b by Gaussian elimination with partial pivoting. Returns null when A is singular. */
function solve(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c += 1) {
    let piv = c;
    for (let r = c + 1; r < n; r += 1) if (Math.abs(m[r][c]) > Math.abs(m[piv][c])) piv = r;
    if (Math.abs(m[piv][c]) < 1e-12) return null;
    [m[c], m[piv]] = [m[piv], m[c]];
    for (let r = c + 1; r < n; r += 1) {
      const f = m[r][c] / m[c][c];
      for (let k = c; k <= n; k += 1) m[r][k] -= f * m[c][k];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r -= 1) {
    let s = m[r][n];
    for (let k = r + 1; k < n; k += 1) s -= m[r][k] * x[k];
    x[r] = s / m[r][r];
  }
  return x;
}

/** Normalise objectives to the ideal point and hyperplane intercepts, as NSGA-III does. */
function normalise(pool: Individual[]): number[][] {
  const m = pool[0].f.length;
  const ideal = Array.from({ length: m }, (_, j) => Math.min(...pool.map((p) => p.f[j])));
  const shifted = pool.map((p) => p.f.map((v, j) => v - ideal[j]));
  const extremes: number[][] = [];
  for (let j = 0; j < m; j += 1) {
    let best = 0;
    let bestVal = Infinity;
    shifted.forEach((s, i) => {
      // Achievement scalarising function with a heavy weight off axis j.
      let v = 0;
      for (let k = 0; k < m; k += 1) v = Math.max(v, s[k] / (k === j ? 1 : 1e-6));
      if (v < bestVal) {
        bestVal = v;
        best = i;
      }
    });
    extremes.push(shifted[best]);
  }
  const worst = Array.from({ length: m }, (_, j) => Math.max(...shifted.map((s) => s[j])));
  let intercepts = solve(extremes, new Array<number>(m).fill(1))?.map((x) => 1 / x) ?? null;
  if (!intercepts || intercepts.some((v, j) => !Number.isFinite(v) || v < 1e-9 || v > worst[j] * 1e3 + 1)) {
    intercepts = worst;
  }
  return shifted.map((s) => s.map((v, j) => v / Math.max(1e-9, intercepts![j])));
}

function perpendicular(point: readonly number[], dir: readonly number[]): number {
  let dot = 0;
  let norm = 0;
  for (let i = 0; i < dir.length; i += 1) {
    dot += point[i] * dir[i];
    norm += dir[i] * dir[i];
  }
  const t = dot / Math.max(1e-12, norm);
  let d = 0;
  for (let i = 0; i < dir.length; i += 1) d += (point[i] - t * dir[i]) ** 2;
  return Math.sqrt(d);
}

/** Pick `needed` members of the last front by reference-point niching. */
function niche(
  chosen: Individual[],
  last: Individual[],
  needed: number,
  refs: number[][],
  rand: () => number,
): Individual[] {
  const all = [...chosen, ...last];
  const norm = normalise(all);
  const assoc = new Map<Individual, { ref: number; dist: number }>();
  all.forEach((ind, i) => {
    let bestRef = 0;
    let bestDist = Infinity;
    refs.forEach((r, j) => {
      const d = perpendicular(norm[i], r);
      if (d < bestDist) {
        bestDist = d;
        bestRef = j;
      }
    });
    assoc.set(ind, { ref: bestRef, dist: bestDist });
  });

  const counts = new Array<number>(refs.length).fill(0);
  for (const c of chosen) counts[assoc.get(c)!.ref] += 1;
  const remaining = new Set(last);
  const live = new Set(refs.map((_, j) => j));
  const picked: Individual[] = [];

  while (picked.length < needed && remaining.size > 0) {
    let minCount = Infinity;
    for (const j of live) minCount = Math.min(minCount, counts[j]);
    const tied = [...live].filter((j) => counts[j] === minCount);
    const j = tied[Math.floor(rand() * tied.length)];
    const members = [...remaining].filter((ind) => assoc.get(ind)!.ref === j);
    if (members.length === 0) {
      live.delete(j);
      continue;
    }
    let pick: Individual;
    if (counts[j] === 0) {
      pick = members.reduce((a, b) => (assoc.get(b)!.dist < assoc.get(a)!.dist ? b : a));
    } else {
      pick = members[Math.floor(rand() * members.length)];
    }
    picked.push(pick);
    remaining.delete(pick);
    counts[j] += 1;
  }
  return picked;
}

/**
 * NSGA-III over contact sets of size k. A set is an ascending list of pool indices. Crossover keeps
 * the members both parents share and fills the rest from the parents' union, so the size stays k;
 * mutation swaps one member for an outsider. Part of the first generation comes from the baselines.
 * Every distinct set evaluated is checked against an archive of non-dominated sets, and that archive
 * is the returned front.
 */
export function nsga3Front(
  eligible: readonly Donor[],
  k: number,
  ctx: PoolContext,
  urgency: Urgency,
  options: Partial<NSGA3Options> = {},
): NSGA3Search {
  const opt = { ...DEFAULT_NSGA3, ...options };
  const terms: DonorTerms[] = eligible
    .map((d) => donorTerms(d, ctx))
    .sort((a, b) => a.donor.id.localeCompare(b.donor.id));
  const n = terms.length;

  // k = 1, or nothing to choose between: the problem is separable, so use the exact search.
  if (k <= 1 || n <= k) {
    const exact = paretoFront(eligible, k, ctx, urgency);
    return { front: exact.front, evaluated: exact.evaluated, generations: 0, converged: true, fellBack: false, exact: true, poolUsed: n };
  }

  const started = Date.now();
  const rand = seededRandom(opt.seed);
  const indexOf = new Map(terms.map((t, i) => [t.donor.id, i]));
  const refs = referencePoints(4, opt.divisions);
  const popSize = Math.max(8, opt.populationSize);

  const seen = new Map<string, Individual>();
  const evaluate = (idx: number[]): Individual => {
    const sorted = idx.slice().sort((a, b) => a - b);
    const key = keyOf(sorted);
    const hit = seen.get(key);
    if (hit) return hit;
    const f = toVector(evaluateTerms(sorted.map((i) => terms[i])));
    const ind: Individual = { idx: sorted, f, key, rank: 0 };
    seen.set(key, ind);
    return ind;
  };

  const randomSet = (): number[] => {
    const pool = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > n - 1 - k; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(n - k);
  };

  const fromDonors = (set: readonly Donor[]) => set.map((d) => indexOf.get(d.id) as number);
  const greedySet = fromDonors(sequentialGreedy(eligible, k, ctx));
  const seeds = [
    greedySet,
    fromDonors(weightedSum(eligible, k, urgency, ctx)),
    fromDonors(nearestCompatible(eligible, k)),
  ];

  let archive: Individual[] = [];
  let archiveChanged = false;
  const offer = (ind: Individual) => {
    if (archive.some((a) => a.key === ind.key || vecDominates(a.f, ind.f))) return;
    archive = archive.filter((a) => !vecDominates(ind.f, a.f));
    archive.push(ind);
    archiveChanged = true;
  };

  let population: Individual[] = [];
  const inPop = new Set<string>();
  const admit = (idx: number[]) => {
    const ind = evaluate(idx);
    offer(ind);
    if (!inPop.has(ind.key)) {
      inPop.add(ind.key);
      population.push(ind);
    }
  };
  for (const s of seeds) admit(s);
  const maxDistinct = combinations(n, k);
  let guard = 0;
  while (population.length < Math.min(popSize, maxDistinct) && guard < popSize * 20) {
    admit(randomSet());
    guard += 1;
  }

  const crossover = (a: Individual, b: Individual): number[] => {
    const inA = new Set(a.idx);
    const shared = b.idx.filter((i) => inA.has(i));
    const sharedSet = new Set(shared);
    const rest = [...a.idx, ...b.idx].filter((i) => !sharedSet.has(i));
    for (let i = rest.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    return [...shared, ...rest.slice(0, k - shared.length)];
  };
  const mutate = (idx: number[]): number[] => {
    const out = idx.slice();
    const has = new Set(out);
    const outsiders = Array.from({ length: n }, (_, i) => i).filter((i) => !has.has(i));
    if (outsiders.length === 0) return out;
    out[Math.floor(rand() * out.length)] = outsiders[Math.floor(rand() * outsiders.length)];
    return out;
  };

  let generations = 0;
  let stale = 0;
  let converged = false;
  let fellBack = false;

  while (generations < opt.maxGenerations) {
    if (opt.deadlineMs !== undefined && Date.now() - started > opt.deadlineMs) {
      fellBack = true;
      break;
    }
    if (seen.size >= opt.maxEvaluations) break;
    generations += 1;
    archiveChanged = false;

    const children: Individual[] = [];
    let tries = 0;
    while (children.length < popSize && tries < popSize * 10) {
      tries += 1;
      const a = population[Math.floor(rand() * population.length)];
      const b = population[Math.floor(rand() * population.length)];
      let child = a === b ? a.idx.slice() : crossover(a, b);
      if (rand() < opt.mutationRate || keyOf(child.slice().sort((x, y) => x - y)) === a.key) child = mutate(child);
      const known = seen.has(keyOf(child.slice().sort((x, y) => x - y)));
      const ind = evaluate(child);
      offer(ind);
      if (!known) children.push(ind);
      if (seen.size >= opt.maxEvaluations) break;
    }

    const combined = [...population, ...children.filter((c) => !inPop.has(c.key))];
    if (combined.length <= popSize) {
      population = combined;
    } else {
      const fronts = nonDominatedSort(combined);
      const next: Individual[] = [];
      for (const fr of fronts) {
        if (next.length + fr.length <= popSize) {
          next.push(...fr);
        } else {
          next.push(...niche(next, fr, popSize - next.length, refs, rand));
          break;
        }
      }
      population = next;
    }
    inPop.clear();
    for (const p of population) inPop.add(p.key);

    stale = archiveChanged ? 0 : stale + 1;
    if (stale >= opt.patience) {
      converged = true;
      break;
    }
  }

  if (fellBack) {
    const g = evaluate(greedySet);
    return {
      front: [{ donorIds: g.idx.map((i) => terms[i].donor.id), objectives: evaluateTerms(g.idx.map((i) => terms[i])) }],
      evaluated: seen.size,
      generations,
      converged: false,
      fellBack: true,
      exact: false,
      poolUsed: n,
    };
  }

  const front = archive
    .slice()
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((ind) => ({
      donorIds: ind.idx.map((i) => terms[i].donor.id),
      objectives: evaluateTerms(ind.idx.map((i) => terms[i])),
    }));
  return { front, evaluated: seen.size, generations, converged, fellBack: false, exact: false, poolUsed: n };
}

/**
 * Inverted generational distance of `front` to a reference front, in objectives scaled by the
 * reference's range. Zero means every reference point is matched. Used to compare NSGA-III with the
 * exact search on instances small enough to enumerate.
 */
export function igd(front: readonly ParetoPoint[], reference: readonly ParetoPoint[]): number {
  if (reference.length === 0) return 0;
  if (front.length === 0) return Infinity;
  const ref = reference.map((p) => toVector(p.objectives));
  const got = front.map((p) => toVector(p.objectives));
  const m = ref[0].length;
  const lo = Array.from({ length: m }, (_, j) => Math.min(...ref.map((v) => v[j])));
  const span = Array.from({ length: m }, (_, j) => Math.max(1e-9, Math.max(...ref.map((v) => v[j])) - lo[j]));
  const scale = (v: number[]) => v.map((x, j) => (x - lo[j]) / span[j]);
  const r = ref.map(scale);
  const g = got.map(scale);
  let total = 0;
  for (const rv of r) {
    let best = Infinity;
    for (const gv of g) {
      let d = 0;
      for (let j = 0; j < m; j += 1) d += (rv[j] - gv[j]) ** 2;
      best = Math.min(best, Math.sqrt(d));
    }
    total += best;
  }
  return total / r.length;
}
