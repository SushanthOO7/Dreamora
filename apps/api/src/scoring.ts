/**
 * Quality scoring and auto-regeneration policies.
 * Tracks user feedback on completed runs and uses scores to
 * weight future recommendations and trigger auto-retry.
 */

export type RunScore = {
  runId: string;
  score: number; // 1-5
  notes: string;
  scoredAt: string;
};

export type RegenerationPolicy = {
  id: string;
  name: string;
  enabled: boolean;
  trigger: "score_below" | "failure" | "timeout";
  threshold: number;
  maxRetries: number;
  adjustments: ParameterAdjustment[];
};

type ParameterAdjustment = {
  parameter: "quality" | "batchSize" | "steps";
  action: "increase" | "decrease" | "set";
  value?: number | string;
};

const scores = new Map<string, RunScore>();

const defaultPolicies: RegenerationPolicy[] = [
  {
    id: "low-quality-retry",
    name: "Low quality auto-retry",
    enabled: true,
    trigger: "score_below",
    threshold: 2,
    maxRetries: 1,
    adjustments: [
      { parameter: "quality", action: "increase" },
      { parameter: "steps", action: "increase" }
    ]
  },
  {
    id: "failure-retry",
    name: "Failure auto-retry",
    enabled: true,
    trigger: "failure",
    threshold: 0,
    maxRetries: 2,
    adjustments: [
      { parameter: "batchSize", action: "decrease" }
    ]
  },
  {
    id: "timeout-retry",
    name: "Timeout retry with lower params",
    enabled: false,
    trigger: "timeout",
    threshold: 0,
    maxRetries: 1,
    adjustments: [
      { parameter: "quality", action: "decrease" },
      { parameter: "batchSize", action: "set", value: 1 }
    ]
  }
];

let policies: RegenerationPolicy[] = [...defaultPolicies];

export function scoreRun(runId: string, score: number, notes: string): RunScore {
  const clamped = Math.max(1, Math.min(5, Math.round(score)));
  const entry: RunScore = {
    runId,
    score: clamped,
    notes: notes.trim(),
    scoredAt: new Date().toISOString()
  };
  scores.set(runId, entry);
  return entry;
}

export function getRunScore(runId: string): RunScore | null {
  return scores.get(runId) ?? null;
}

export function getAllScores(): RunScore[] {
  return [...scores.values()];
}

export function getAverageScore(runIds: string[]): number {
  const scored = runIds
    .map((id) => scores.get(id))
    .filter((s): s is RunScore => s !== undefined);

  if (scored.length === 0) return 0;

  return Math.round(
    (scored.reduce((sum, s) => sum + s.score, 0) / scored.length) * 10
  ) / 10;
}

export function getScoreDistribution(): Record<number, number> {
  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const entry of scores.values()) {
    dist[entry.score] = (dist[entry.score] ?? 0) + 1;
  }
  return dist;
}

export function getPolicies(): RegenerationPolicy[] {
  return policies;
}

export function updatePolicy(id: string, updates: Partial<Pick<RegenerationPolicy, "enabled" | "threshold" | "maxRetries">>): RegenerationPolicy | null {
  const policy = policies.find((p) => p.id === id);
  if (!policy) return null;

  if (typeof updates.enabled === "boolean") {
    policy.enabled = updates.enabled;
  }
  if (typeof updates.threshold === "number") {
    policy.threshold = updates.threshold;
  }
  if (typeof updates.maxRetries === "number") {
    policy.maxRetries = Math.max(0, Math.min(5, updates.maxRetries));
  }

  return policy;
}

export type RegenerationDecision = {
  shouldRegenerate: boolean;
  policyId: string | null;
  reason: string;
  adjustments: ParameterAdjustment[];
  retriesUsed: number;
  maxRetries: number;
};

const retryCounters = new Map<string, number>();

export function evaluateRegeneration(
  runId: string,
  status: "completed" | "failed" | "timeout",
  score?: number
): RegenerationDecision {
  const noRegen: RegenerationDecision = {
    shouldRegenerate: false,
    policyId: null,
    reason: "No active policy triggered.",
    adjustments: [],
    retriesUsed: retryCounters.get(runId) ?? 0,
    maxRetries: 0
  };

  const activePolicies = policies.filter((p) => p.enabled);
  const retriesUsed = retryCounters.get(runId) ?? 0;

  for (const policy of activePolicies) {
    let triggered = false;

    if (policy.trigger === "score_below" && typeof score === "number" && score <= policy.threshold) {
      triggered = true;
    }

    if (policy.trigger === "failure" && status === "failed") {
      triggered = true;
    }

    if (policy.trigger === "timeout" && status === "timeout") {
      triggered = true;
    }

    if (triggered) {
      if (retriesUsed >= policy.maxRetries) {
        return {
          shouldRegenerate: false,
          policyId: policy.id,
          reason: `Policy "${policy.name}" triggered but max retries (${policy.maxRetries}) exhausted.`,
          adjustments: [],
          retriesUsed,
          maxRetries: policy.maxRetries
        };
      }

      retryCounters.set(runId, retriesUsed + 1);

      return {
        shouldRegenerate: true,
        policyId: policy.id,
        reason: `Policy "${policy.name}" triggered: ${policy.trigger}${
          policy.trigger === "score_below" ? ` (score ${score} <= ${policy.threshold})` : ""
        }.`,
        adjustments: policy.adjustments,
        retriesUsed: retriesUsed + 1,
        maxRetries: policy.maxRetries
      };
    }
  }

  return noRegen;
}

export function clearRetryCounter(runId: string): void {
  retryCounters.delete(runId);
}
