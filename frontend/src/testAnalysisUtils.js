import { formatAreaLabel } from "./analysisUtils";

export const TEST_TIER_WEIGHTS = { 1: 1, 2: 1.5, 3: 2 };
export const TEST_TIER_LABELS = { 1: "Easy", 2: "Medium", 3: "Hard" };

const WEAK_AREA_CUTOFF = 0.75;

function tierWeight(tier) {
  return TEST_TIER_WEIGHTS[Number(tier)] || 1;
}

export function filterAdaptiveTestAttempts(attempts) {
  return (attempts || []).filter((attempt) => attempt.test_adaptive !== false);
}

export function buildTierTrend(slots) {
  return (slots || []).map((slot) => ({
    slot: slot.slot,
    tier: Number(slot.tier) || 2,
    correct: slot.correct === true,
  }));
}

export function buildTierBandAccuracy(slots) {
  const bands = {
    1: { earned: 0, max: 0, count: 0, correct: 0 },
    2: { earned: 0, max: 0, count: 0, correct: 0 },
    3: { earned: 0, max: 0, count: 0, correct: 0 },
  };

  for (const slot of slots || []) {
    const tier = Number(slot.tier) || 2;
    if (!bands[tier]) continue;
    const weight = tierWeight(tier);
    bands[tier].max += weight;
    bands[tier].count += 1;
    if (slot.correct === true) {
      bands[tier].earned += weight;
      bands[tier].correct += 1;
    }
  }

  return [1, 2, 3]
    .map((tier) => {
      const band = bands[tier];
      if (!band.count) return null;
      return {
        tier,
        label: TEST_TIER_LABELS[tier],
        count: band.count,
        correctCount: band.correct,
        accuracyPct: Math.round((band.correct / band.count) * 100),
        weightedPct: Math.round((band.earned / band.max) * 100),
      };
    })
    .filter(Boolean);
}

function areaKey(area) {
  return String(area || "").trim().toLowerCase();
}

export function buildAreaBreakdown(slots) {
  const byArea = new Map();

  for (const slot of slots || []) {
    const area = areaKey(slot.area);
    if (!area) continue;
    if (!byArea.has(area)) {
      byArea.set(area, {
        area,
        label: formatAreaLabel(area),
        earned: 0,
        max: 0,
        count: 0,
        correctCount: 0,
        tier1Wrong: 0,
        tier3Correct: 0,
        misses: [],
      });
    }
    const entry = byArea.get(area);
    const weight = tierWeight(slot.tier);
    entry.max += weight;
    entry.count += 1;
    if (slot.correct === true) {
      entry.earned += weight;
      entry.correctCount += 1;
      if (Number(slot.tier) === 3) entry.tier3Correct += 1;
    } else {
      if (Number(slot.tier) === 1) entry.tier1Wrong += 1;
      if (entry.misses.length < 2) {
        entry.misses.push(slot);
      }
    }
  }

  return [...byArea.values()]
    .map((entry) => ({
      ...entry,
      weightedPct: entry.max ? Math.round((entry.earned / entry.max) * 100) : 0,
      accuracyPct: entry.count
        ? Math.round((entry.correctCount / entry.count) * 100)
        : 0,
    }))
    .sort(
      (a, b) =>
        a.weightedPct - b.weightedPct ||
        a.correctCount - b.correctCount ||
        a.label.localeCompare(b.label),
    );
}

export function splitWeakStrongAreas(areaBreakdown) {
  const weak = [];
  const strong = [];

  for (const area of areaBreakdown || []) {
    const isWeak =
      area.tier1Wrong > 0 ||
      (area.count > 0 && area.earned / area.max < WEAK_AREA_CUTOFF);
    const isStrong =
      area.count > 0 &&
      area.correctCount === area.count &&
      area.count >= 1;

    if (isWeak) weak.push(area);
    else if (isStrong) strong.push(area);
  }

  weak.sort(
    (a, b) =>
      b.tier1Wrong - a.tier1Wrong ||
      a.weightedPct - b.weightedPct ||
      b.count - a.count,
  );
  strong.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  return { weak, strong };
}

export function buildTimePressureMetrics(attempt) {
  const slots = attempt?.slots || [];
  if (!slots.length) return null;

  const durationSeconds = Number(attempt.duration_seconds) || 0;
  const timeLimitMinutes = Number(attempt.time_limit_minutes) || 0;
  const limitSeconds = timeLimitMinutes > 0 ? timeLimitMinutes * 60 : 0;
  const midpoint = Math.ceil(slots.length / 2);
  const firstHalf = slots.slice(0, midpoint);
  const secondHalf = slots.slice(midpoint);

  const accuracy = (list) => {
    if (!list.length) return null;
    const correct = list.filter((slot) => slot.correct === true).length;
    return Math.round((correct / list.length) * 100);
  };

  return {
    durationSeconds,
    timeLimitMinutes,
    limitSeconds,
    timeUsedPct:
      limitSeconds > 0
        ? Math.round((durationSeconds / limitSeconds) * 100)
        : null,
    secondsPerQuestion:
      durationSeconds > 0
        ? Math.round(durationSeconds / slots.length)
        : null,
    firstHalfAccuracy: accuracy(firstHalf),
    secondHalfAccuracy: accuracy(secondHalf),
    rushedFinish:
      limitSeconds > 0 && durationSeconds > 0
        ? durationSeconds >= limitSeconds * 0.9
        : false,
  };
}

export function buildAdaptiveNarrative(slots) {
  if (!slots?.length) return "";

  const tiers = slots.map((slot) => Number(slot.tier) || 2);
  const startTier = tiers[0];
  const peakTier = Math.max(...tiers);
  const minTier = Math.min(...tiers);
  const wrongSlots = slots.filter((slot) => slot.correct !== true);
  const lastTier = tiers[tiers.length - 1];

  const parts = [
    `Started at ${TEST_TIER_LABELS[startTier] || "medium"} difficulty (tier ${startTier}).`,
  ];

  if (peakTier > startTier) {
    parts.push(`Reached ${TEST_TIER_LABELS[peakTier] || "hard"} (tier ${peakTier}) during the sitting.`);
  }

  if (wrongSlots.length > 0) {
    const firstMiss = wrongSlots[0];
    const missArea = formatAreaLabel(firstMiss.area);
    parts.push(
      `First miss at question ${firstMiss.slot}${
        missArea ? ` (${missArea})` : ""
      } on tier ${firstMiss.tier}.`,
    );
    if (firstMiss.slot < slots.length) {
      const afterMiss = slots.slice(firstMiss.slot);
      const recovered = afterMiss.some(
        (slot, index) =>
          index > 0 &&
          slot.correct === true &&
          Number(slot.tier) >= Number(firstMiss.tier),
      );
      if (!recovered && lastTier < Number(firstMiss.tier)) {
        parts.push(`Difficulty did not return to tier ${firstMiss.tier} before the end.`);
      } else if (recovered) {
        parts.push("Recovered with correct answers at similar or higher difficulty later.");
      }
    }
  } else {
    parts.push("No misses in this sitting.");
  }

  if (minTier < peakTier && lastTier <= minTier + 1 && wrongSlots.length > 0) {
    parts.push(`Finished at tier ${lastTier}, below the peak of tier ${peakTier}.`);
  }

  return parts.join(" ");
}

export function analyzeTestAttempt(attempt) {
  const slots = attempt?.slots || [];
  const areaBreakdown = buildAreaBreakdown(slots);
  const { weak, strong } = splitWeakStrongAreas(areaBreakdown);

  return {
    tierTrend: buildTierTrend(slots),
    tierBands: buildTierBandAccuracy(slots),
    areaBreakdown,
    weakAreas: weak,
    strongAreas: strong,
    timePressure: buildTimePressureMetrics(attempt),
    narrative: buildAdaptiveNarrative(slots),
    peakTier: slots.length ? Math.max(...slots.map((s) => Number(s.tier) || 2)) : null,
  };
}
