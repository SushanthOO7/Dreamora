type Mode = "image" | "video";

type PolicySeverity = "low" | "medium" | "high";

export type PolicyReason = {
  id: string;
  severity: PolicySeverity;
  message: string;
};

export type RegenerationPolicyInput = {
  mode: Mode;
  status: "queued" | "running" | "completed" | "failed";
  backend: "comfy" | "simulated";
  error: string | null;
  outputSummary: string | null;
  quality?: "Standard" | "High" | "Ultra";
  batchSize?: number;
  aspectRatio?: string;
  tokensUsed: number;
  attempt: number;
};

export type RegenerationPolicyDecision = {
  policyVersion: string;
  shouldRegenerate: boolean;
  severity: PolicySeverity;
  reasons: PolicyReason[];
  suggestedAdjustments: {
    quality?: "Standard" | "High" | "Ultra";
    batchSize?: number;
    aspectRatio?: string;
    promptAddendum?: string;
  };
  nextAction:
    | "continue_polling"
    | "accept_result"
    | "retry_with_adjustments"
    | "manual_review";
};

function parseOutputCount(outputSummary: string | null): number | null {
  if (!outputSummary) {
    return null;
  }

  const match = outputSummary.match(/(\d+)/);
  if (!match) {
    return null;
  }

  const value = Number(match[1]);
  if (!Number.isFinite(value)) {
    return null;
  }
  return value;
}

function downgradeQuality(current?: "Standard" | "High" | "Ultra"): "Standard" | "High" | "Ultra" | undefined {
  if (!current) {
    return undefined;
  }
  if (current === "Ultra") {
    return "High";
  }
  if (current === "High") {
    return "Standard";
  }
  return undefined;
}

function maxSeverity(reasons: PolicyReason[]): PolicySeverity {
  if (reasons.some((reason) => reason.severity === "high")) {
    return "high";
  }
  if (reasons.some((reason) => reason.severity === "medium")) {
    return "medium";
  }
  return "low";
}

function highTokenThreshold(mode: Mode): number {
  return mode === "image" ? 18_000 : 26_000;
}

export function evaluateRegenerationPolicy(
  input: RegenerationPolicyInput
): RegenerationPolicyDecision {
  const reasons: PolicyReason[] = [];
  const suggestedAdjustments: RegenerationPolicyDecision["suggestedAdjustments"] = {};

  if (input.status === "running" || input.status === "queued") {
    return {
      policyVersion: "stage6-v1",
      shouldRegenerate: false,
      severity: "low",
      reasons: [
        {
          id: "job-in-progress",
          severity: "low",
          message: "Generation is still in progress."
        }
      ],
      suggestedAdjustments,
      nextAction: "continue_polling"
    };
  }

  if (input.status === "failed") {
    reasons.push({
      id: "failed-run",
      severity: "high",
      message: input.error
        ? `Run failed with error: ${input.error}`
        : "Run failed before completion."
    });

    if (input.backend === "comfy") {
      reasons.push({
        id: "comfy-path-failed",
        severity: "medium",
        message: "Comfy execution failed; retry with safer settings."
      });
    }

    const downgradedQuality = downgradeQuality(input.quality);
    if (downgradedQuality) {
      suggestedAdjustments.quality = downgradedQuality;
    }

    if (input.mode === "image" && typeof input.batchSize === "number" && input.batchSize > 2) {
      suggestedAdjustments.batchSize = Math.max(1, Math.floor(input.batchSize / 2));
    }

    suggestedAdjustments.promptAddendum =
      "Keep composition stable and prioritize clean subject definition over novelty.";
  }

  const outputCount = parseOutputCount(input.outputSummary);
  if (input.status === "completed" && outputCount === 0) {
    reasons.push({
      id: "zero-artifacts",
      severity: "high",
      message: "Run completed but returned zero artifacts."
    });
    suggestedAdjustments.promptAddendum =
      "Force a single clear subject and remove conflicting style constraints.";
  }

  if (input.tokensUsed > highTokenThreshold(input.mode)) {
    reasons.push({
      id: "high-token-cost",
      severity: "medium",
      message: `Token usage (${input.tokensUsed}) exceeds target budget for ${input.mode} mode.`
    });

    const downgradedQuality = downgradeQuality(input.quality);
    if (downgradedQuality && !suggestedAdjustments.quality) {
      suggestedAdjustments.quality = downgradedQuality;
    }
  }

  if (input.attempt >= (input.mode === "video" ? 3 : 4)) {
    reasons.push({
      id: "max-retry-window",
      severity: "medium",
      message: "Retry budget reached. Escalate to manual review."
    });
  }

  const retryAllowed = input.attempt < (input.mode === "video" ? 3 : 4);
  const hasHighReason = reasons.some((reason) => reason.severity === "high");
  const hasMediumReason = reasons.some((reason) => reason.severity === "medium");
  const shouldRegenerate = retryAllowed && hasHighReason;

  const nextAction: RegenerationPolicyDecision["nextAction"] = shouldRegenerate
    ? "retry_with_adjustments"
    : hasMediumReason
      ? "manual_review"
      : "accept_result";

  return {
    policyVersion: "stage6-v1",
    shouldRegenerate,
    severity: maxSeverity(reasons),
    reasons:
      reasons.length > 0
        ? reasons
        : [
            {
              id: "healthy-run",
              severity: "low",
              message: "Run passed policy checks."
            }
          ],
    suggestedAdjustments,
    nextAction
  };
}
