/**
 * Constrained two-sided b-matching (Design §9b–§9f) — PURE, no DB/LLM.
 *
 * Match creation is a degree-constrained bipartite assignment that maximises total
 * mutual compatibility subject to per-person caps, solved exactly with minimum-cost
 * flow. Two phases (§9f) keep the coverage compromise confined to the tail:
 *   Phase 1 (quality): add only edges with value ≥ threshold, augment ONLY while
 *     an augmenting path has negative cost (beneficial) — best mutual matches, no
 *     forcing.
 *   Phase 2 (coverage): greedily give every man his floor P and every woman ≥1 a
 *     match from best-available remaining, even if mediocre.
 *
 * Edge cost = −Val(m,w) + λ·|PS[m]−PS[w]|  (assortative soft-cost — like-tier
 * pairs preferred, but soft so coverage can still cross tiers). Scaled to ints.
 */

export interface MatchCandidate {
	manId: string;
	womanId: string;
	value: number; // Val(m,w) = √(appeal_her·appeal_him), 0–100
	psGap: number; // |PS[man] − PS[woman]|, 0–100
}

export interface MatchCaps {
	manFloor: number; // P  — every man gets ≥ this many
	manCap: number;   // X_m
	womanCap: number; // X_w
}

export interface MatchAssignment {
	manId: string;
	womanId: string;
	value: number;
	phase: 1 | 2; // 1 = quality optimum, 2 = coverage fill (AI frames as "starter match")
}

const SCALE = 1000; // value/psGap → int cost

// ── Min-cost max-flow (SSP with SPFA; handles negative edge costs) ──────────────

interface Edge { to: number; cap: number; cost: number; flow: number; rev: number; }

class MinCostFlow {
	private g: Edge[][];
	constructor(public n: number) {
		this.g = Array.from({ length: n }, () => []);
	}
	addEdge(u: number, v: number, cap: number, cost: number): void {
		this.g[u].push({ to: v, cap, cost, flow: 0, rev: this.g[v].length });
		this.g[v].push({ to: u, cap: 0, cost: -cost, flow: 0, rev: this.g[u].length - 1 });
	}
	/**
	 * Send flow from s to t along successive shortest (cheapest) paths. If
	 * `onlyNegative`, stop once the cheapest augmenting path has non-negative cost
	 * (i.e. take only beneficial augmentations — the quality-optimum subset).
	 * Returns total flow pushed.
	 */
	run(s: number, t: number, onlyNegative: boolean): number {
		let totalFlow = 0;
		for (;;) {
			const dist = new Array(this.n).fill(Infinity);
			const inq = new Array(this.n).fill(false);
			const pe = new Array(this.n).fill(-1); // edge index into g[prevNode]
			const pv = new Array(this.n).fill(-1); // prev node
			dist[s] = 0;
			const queue = [s];
			while (queue.length) {
				const u = queue.shift()!;
				inq[u] = false;
				for (let i = 0; i < this.g[u].length; i++) {
					const e = this.g[u][i];
					if (e.cap - e.flow > 0 && dist[u] + e.cost < dist[e.to]) {
						dist[e.to] = dist[u] + e.cost;
						pv[e.to] = u; pe[e.to] = i;
						if (!inq[e.to]) { inq[e.to] = true; queue.push(e.to); }
					}
				}
			}
			if (dist[t] === Infinity) break;            // no augmenting path
			if (onlyNegative && dist[t] >= 0) break;     // no more beneficial flow
			// Find bottleneck along the path.
			let push = Infinity;
			for (let v = t; v !== s; v = pv[v]) {
				const e = this.g[pv[v]][pe[v]];
				push = Math.min(push, e.cap - e.flow);
			}
			for (let v = t; v !== s; v = pv[v]) {
				const e = this.g[pv[v]][pe[v]];
				e.flow += push;
				this.g[v][e.rev].flow -= push;
			}
			totalFlow += push;
		}
		return totalFlow;
	}
	/** Edges carrying flow from man-nodes to woman-nodes (for reading the matching). */
	flowEdges(): Array<{ u: number; v: number }> {
		const out: Array<{ u: number; v: number }> = [];
		for (let u = 0; u < this.n; u++) {
			for (const e of this.g[u]) if (e.cap > 0 && e.flow > 0) out.push({ u, v: e.to });
		}
		return out;
	}
}

function edgeCost(c: MatchCandidate, lambda: number): number {
	return Math.round((-c.value + lambda * c.psGap) * SCALE);
}

/**
 * Solve the constrained matching. `valueThreshold` drops weak edges from the
 * quality phase (§9f, e.g. 40 on the LLM scale; lower on the vector scale).
 */
export function solveMatching(
	men: string[],
	women: string[],
	candidates: MatchCandidate[],
	caps: MatchCaps,
	opts: { lambda?: number; valueThreshold?: number } = {},
): MatchAssignment[] {
	const lambda = opts.lambda ?? 0;
	const threshold = opts.valueThreshold ?? 0;
	const mIdx = new Map(men.map((id, i) => [id, i]));
	const wIdx = new Map(women.map((id, i) => [id, i]));
	const M = men.length, W = women.length;
	if (!M || !W) return [];

	// Node layout: S=0, men 1..M, women M+1..M+W, T=M+W+1.
	const S = 0, T = M + W + 1;
	const manNode = (i: number) => 1 + i;
	const womanNode = (j: number) => 1 + M + j;
	const mcf = new MinCostFlow(M + W + 2);

	for (let i = 0; i < M; i++) mcf.addEdge(S, manNode(i), caps.manCap, 0);
	for (let j = 0; j < W; j++) mcf.addEdge(womanNode(j), T, caps.womanCap, 0);

	// Quality-phase edges: value ≥ threshold only. Track edge → candidate.
	const usable = candidates.filter(
		(c) => mIdx.has(c.manId) && wIdx.has(c.womanId) && c.value >= threshold,
	);
	for (const c of usable) {
		mcf.addEdge(manNode(mIdx.get(c.manId)!), womanNode(wIdx.get(c.womanId)!), 1, edgeCost(c, lambda));
	}

	// Phase 1: beneficial augmentations only.
	mcf.run(S, T, /* onlyNegative */ true);

	// Read the matching from man→woman edges carrying flow.
	const assigned: MatchAssignment[] = [];
	const manCount = new Array(M).fill(0);
	const womanCount = new Array(W).fill(0);
	const usedPair = new Set<string>();
	for (const { u, v } of mcf.flowEdges()) {
		if (u >= 1 && u <= M && v >= 1 + M && v <= M + W) {
			const mi = u - 1, wj = v - 1 - M;
			const cand = usable.find((c) => mIdx.get(c.manId) === mi && wIdx.get(c.womanId) === wj);
			assigned.push({ manId: men[mi], womanId: women[wj], value: cand?.value ?? 0, phase: 1 });
			manCount[mi]++; womanCount[wj]++; usedPair.add(`${mi}:${wj}`);
		}
	}

	// Phase 2 — coverage fill (greedy, best-available, respects caps). Confined to
	// men below floor and women with zero matches. May use sub-threshold edges.
	const byValueDesc = [...candidates]
		.filter((c) => mIdx.has(c.manId) && wIdx.has(c.womanId))
		.sort((a, b) => b.value - a.value);

	const tryFill = (predicate: (mi: number, wj: number) => boolean) => {
		for (const c of byValueDesc) {
			const mi = mIdx.get(c.manId)!, wj = wIdx.get(c.womanId)!;
			if (usedPair.has(`${mi}:${wj}`)) continue;
			if (manCount[mi] >= caps.manCap || womanCount[wj] >= caps.womanCap) continue;
			if (!predicate(mi, wj)) continue;
			assigned.push({ manId: men[mi], womanId: women[wj], value: c.value, phase: 2 });
			manCount[mi]++; womanCount[wj]++; usedPair.add(`${mi}:${wj}`);
		}
	};
	// Men below floor first, then women still at zero.
	tryFill((mi) => manCount[mi] < caps.manFloor);
	tryFill((_mi, wj) => womanCount[wj] === 0);

	return assigned;
}
