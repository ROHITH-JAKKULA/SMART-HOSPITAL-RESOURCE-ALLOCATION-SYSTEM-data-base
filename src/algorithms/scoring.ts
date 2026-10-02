import { PriorityBand, ScoringWeights } from "../types";

export const DEFAULT_WEIGHTS: ScoringWeights = {
  severity: 40,
  waiting: 20,
  risk: 15,
  urgency: 15,
  icu: 10,
};

export function waitingLevel(waitingMinutes: number): number {
  if (waitingMinutes < 10) return 1;
  if (waitingMinutes < 30) return 2;
  if (waitingMinutes < 60) return 3;
  if (waitingMinutes < 120) return 4;
  return 5;
}

export function calculatePriority(
  severity: number,
  waitingLvl: number,
  risk: number,
  urgency: number,
  icu: number,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): number {
  return (
    weights.severity * severity +
    weights.waiting * waitingLvl +
    weights.risk * risk +
    weights.urgency * urgency +
    weights.icu * icu
  );
}

export function priorityBand(score: number): PriorityBand {
  if (score >= 360) return "CRITICAL";
  if (score >= 240) return "HIGH";
  return "NORMAL";
}

export function scoreBreakdown(
  severity: number,
  waitingLvl: number,
  risk: number,
  urgency: number,
  icu: number,
  weights: ScoringWeights = DEFAULT_WEIGHTS
) {
  return {
    severity: weights.severity * severity,
    waiting: weights.waiting * waitingLvl,
    risk: weights.risk * risk,
    urgency: weights.urgency * urgency,
    icu: weights.icu * icu,
    total: calculatePriority(severity, waitingLvl, risk, urgency, icu, weights),
  };
}
