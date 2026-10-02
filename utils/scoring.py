"""Scoring utilities for dynamic priority computation."""
from typing import Dict
import config


def waiting_level(waiting_minutes: int) -> int:
    """Computes waiting level (1 to 5) from minutes waited.

    <10 min -> 1
    10-29 min -> 2
    30-59 min -> 3
    60-119 min -> 4
    >=120 min -> 5
    """
    if waiting_minutes < 0:
        waiting_minutes = 0

    for bound, level in config.WAIT_LEVEL_BREAKPOINTS:
        if waiting_minutes < bound:
            return level
    return 5


def calculate_priority(
    severity: int,
    waiting_lvl: int,
    risk: int,
    urgency: int,
    icu: int,
    weights: Dict[str, int] = None
) -> int:
    """Computes academic priority score using weighted factors.

    Priority = w_S*S + w_W*W + w_R*R + w_U*U + w_I*I
    Default weights: 40*S + 20*W + 15*R + 15*U + 10*I
    Default range: min 90 (1,1,1,1,0), max 460 (5,5,5,5,1)
    """
    if weights is None:
        weights = config.DEFAULT_WEIGHTS

    score = (
        weights.get("severity", 40) * severity +
        weights.get("waiting", 20) * waiting_lvl +
        weights.get("risk", 15) * risk +
        weights.get("urgency", 15) * urgency +
        weights.get("icu", 10) * icu
    )
    return score


def priority_band(score: int) -> str:
    """Returns priority band name (CRITICAL, HIGH, NORMAL)."""
    for band_name, threshold in config.BAND_THRESHOLDS:
        if score >= threshold:
            return band_name
    return "NORMAL"


def score_breakdown(
    severity: int,
    waiting_lvl: int,
    risk: int,
    urgency: int,
    icu: int,
    weights: Dict[str, int] = None
) -> Dict[str, int]:
    """Returns the individual weighted terms of the score."""
    if weights is None:
        weights = config.DEFAULT_WEIGHTS

    return {
        "severity": weights.get("severity", 40) * severity,
        "waiting": weights.get("waiting", 20) * waiting_lvl,
        "risk": weights.get("risk", 15) * risk,
        "urgency": weights.get("urgency", 15) * urgency,
        "icu": weights.get("icu", 10) * icu,
        "total": calculate_priority(severity, waiting_lvl, risk, urgency, icu, weights)
    }
