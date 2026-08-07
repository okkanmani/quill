import { useEffect, useMemo, useRef, useState } from "react";
import { getWorksheet } from "../api";
import { formatAreaLabel } from "../analysisUtils";
import { QuestionDifficultyStars } from "./DifficultyStars";
import WorksheetPassageContent from "./WorksheetPassageContent";
import { formatSubjectLabel } from "../subjectUtils";
import { formatDurationSeconds } from "../worksheetUtils";
import { formatWeightedTestScore } from "../testUtils";
import {
  buildPassageBandSegments,
  TEST_TIER_LABELS,
  trendUsesPassageBands,
} from "../testAnalysisUtils";
import {
  attemptUsesPassageContext,
  buildPassageLookup,
  buildQuestionPassageLookup,
  contextCenteredForPassage,
  missContextKey,
  passageWindowUnitLabel,
  resolveMissPassage,
} from "../testResultUtils";

function TierTrendChart({ trend, chartKey }) {
  if (!trend?.length) {
    return (
      <p className="text-sm text-slate-600">No slot data available for this attempt.</p>
    );
  }

  const showPassageBands = trendUsesPassageBands(trend);
  const passageBands = showPassageBands ? buildPassageBandSegments(trend) : [];

  const width = 640;
  const height = showPassageBands ? 248 : 180;
  const padLeft = 64;
  const padRight = 20;
  const plotTop = showPassageBands ? 36 : 24;
  const plotBottom = showPassageBands ? 208 : height - 24;
  const plotRight = width - padRight;
  const innerW = plotRight - padLeft;
  const innerH = plotBottom - plotTop;
  const stepX = trend.length > 1 ? innerW / (trend.length - 1) : 0;

  const yForTier = (tier) => plotTop + innerH - ((tier - 1) / 2) * innerH;

  const xCenter = (index) => padLeft + index * stepX;

  const xBandStart = (index) =>
    index === 0 ? padLeft : padLeft + (index - 0.5) * stepX;

  const xBandEnd = (index) =>
    index === trend.length - 1 ? plotRight : padLeft + (index + 0.5) * stepX;

  const points = trend
    .map((point, index) => {
      const x = xCenter(index);
      const y = yForTier(point.tier);
      return `${x},${y}`;
    })
    .join(" ");

  const xLabel = (point) =>
    showPassageBands ? point.questionIndex : point.slot;

  return (
    <div className="overflow-x-auto">
      <svg
        key={chartKey}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full min-w-[320px]"
        role="img"
        aria-label={
          showPassageBands
            ? "Tier progress by question with passage complexity bands"
            : "Tier progress across the test sitting"
        }
      >
        {showPassageBands
          ? passageBands.map((band) => {
              const x = xBandStart(band.startIndex);
              const bandWidth = xBandEnd(band.endIndex) - x;
              const fill =
                band.passageTier === 1
                  ? "rgba(16, 185, 129, 0.22)"
                  : "rgba(244, 63, 94, 0.18)";
              const centerX = x + bandWidth / 2;
              return (
                <g key={`${chartKey}-band-${band.passageSlot}`}>
                  <rect
                    x={x}
                    y={plotTop}
                    width={bandWidth}
                    height={innerH}
                    fill={fill}
                  />
                  {band.startIndex > 0 ? (
                    <line
                      x1={x}
                      x2={x}
                      y1={plotTop}
                      y2={plotBottom}
                      stroke="#cbd5e1"
                      strokeWidth="1"
                    />
                  ) : null}
                  <text
                    x={centerX}
                    y={plotTop - 10}
                    textAnchor="middle"
                    className="fill-slate-600 text-[10px] font-medium"
                  >
                    {band.label}
                  </text>
                </g>
              );
            })
          : null}
        {[1, 2, 3].map((tier) => (
          <g key={tier}>
            <line
              x1={padLeft}
              x2={plotRight}
              y1={yForTier(tier)}
              y2={yForTier(tier)}
              stroke="#e2e8f0"
              strokeDasharray="4 4"
            />
            <text
              x={10}
              y={yForTier(tier) + 4}
              textAnchor="start"
              className="fill-slate-400 text-[10px]"
            >
              {TEST_TIER_LABELS[tier]}
            </text>
          </g>
        ))}
        <polyline
          key={`${chartKey}-line`}
          fill="none"
          stroke="#6366f1"
          strokeWidth="2.5"
          points={points}
        />
        {trend.map((point, index) => {
          const x = xCenter(index);
          const y = yForTier(point.tier);
          const fill = point.correct ? "#059669" : "#dc2626";
          return (
            <g key={`${chartKey}-slot-${index}`}>
              <circle cx={x} cy={y} r="7" fill={fill} stroke="#fff" strokeWidth="2" />
              <text
                x={x}
                y={height - (showPassageBands ? 18 : 6)}
                textAnchor="middle"
                className="fill-slate-500 text-[10px]"
              >
                {xLabel(point)}
              </text>
            </g>
          );
        })}
        {showPassageBands ? (
          <text
            x={(padLeft + plotRight) / 2}
            y={height - 4}
            textAnchor="middle"
            className="fill-slate-500 text-[10px]"
          >
            Question number in test
          </text>
        ) : null}
      </svg>
      <div className="flex flex-wrap gap-4 mt-2 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-600" />
          Correct
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-600" />
          Incorrect
        </span>
      </div>
    </div>
  );
}

function passageSittingSlot(attempt, miss) {
  const slotRow = (attempt?.slots || []).find(
    (slot) =>
      miss?.passage_id != null &&
      String(slot.passage_id) === String(miss.passage_id),
  );
  return slotRow?.slot ?? null;
}

function passageTierLabel(tier, subject) {
  const value = Number(tier);
  if (!value) return "";
  if (subject === "data") {
    return TEST_TIER_LABELS[value]?.toLowerCase() || "";
  }
  return value === 1 ? "easy" : value === 2 ? "complex" : "";
}

function WeakAreaMissChoice({ choice, isCorrect, isGiven }) {
  const label = String(choice || "").trim();
  if (!label) return null;

  let className =
    "rounded-lg border px-3 py-2 text-sm flex items-center justify-between gap-3";
  if (isCorrect) {
    className += " border-emerald-200 bg-emerald-50 text-emerald-800";
  } else if (isGiven) {
    className += " border-red-200 bg-red-50 text-red-800";
  } else {
    className += " border-slate-200 bg-white text-slate-900";
  }

  return (
    <div className={className}>
      <span>{label}</span>
      {isCorrect ? (
        <span className="text-emerald-700 text-xs font-semibold shrink-0">Correct</span>
      ) : null}
      {isGiven && !isCorrect ? (
        <span className="text-red-700 text-xs font-semibold shrink-0">Student</span>
      ) : null}
    </div>
  );
}

function WeakAreaMissContextPanel({
  attempt,
  miss,
  areaLabel,
  passage,
  subject,
  loading = false,
}) {
  if (!miss) return null;

  const unitLabel = passageWindowUnitLabel(subject);
  const passageSlot = passageSittingSlot(attempt, miss);
  const areaName = miss.area ? formatAreaLabel(miss.area) : areaLabel;
  const choices = (miss.choices || []).map((choice) => String(choice || "").trim()).filter(Boolean);
  const given = String(miss.given || "").trim();
  const expected = String(miss.expected || "").trim();
  const passageTier = passageTierLabel(miss.passage_tier, subject);
  const passageHeading = [
    passageSlot != null ? `${unitLabel} ${passageSlot}` : unitLabel,
    passage?.title ? `"${passage.title}"` : null,
    passageTier || null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className="test-analysis-miss-context"
      aria-label={`Wrong answer review for question ${miss.slot}`}
    >
      <div className="test-analysis-miss-context-grid">
        <div className="test-analysis-miss-context-question">
          <p className="text-xs text-slate-500">
            Question {miss.slot}
            {passageSlot != null ? (
              <>
                {" "}
                · {unitLabel} {passageSlot}
              </>
            ) : null}
            {areaName ? (
              <>
                {" "}
                · {areaName}
              </>
            ) : null}
          </p>
          <p className="text-sm font-medium text-slate-900 mt-1.5 leading-relaxed">
            {miss.prompt || "Question"}
          </p>

          {choices.length > 0 ? (
            <div className="mt-3.5 flex flex-col gap-1.5">
              {choices.map((choice) => (
                <WeakAreaMissChoice
                  key={choice}
                  choice={choice}
                  isCorrect={Boolean(expected) && choice === expected}
                  isGiven={Boolean(given) && choice === given}
                />
              ))}
            </div>
          ) : (
            <div className="mt-3.5 space-y-2 text-sm">
              <p className="text-red-800">
                Student answered: <span className="font-medium">{given || "—"}</span>
              </p>
              {expected ? (
                <p className="text-emerald-800">
                  Correct: <span className="font-medium">{expected}</span>
                </p>
              ) : null}
            </div>
          )}
        </div>

        <div className="test-analysis-miss-context-passage">
          {loading ? (
            <p className="text-sm text-slate-600">Loading {unitLabel.toLowerCase()}…</p>
          ) : passage ? (
            <>
              {passageHeading ? (
                <p className="text-xs text-slate-500 mb-2">{passageHeading}</p>
              ) : null}
              <WorksheetPassageContent
                passage={passage}
                embedded
                hideTitle
                centered={contextCenteredForPassage(passage, subject)}
                maxWidthClass="max-w-none"
              />
            </>
          ) : (
            <p className="text-sm text-slate-600">
              Could not load {unitLabel.toLowerCase()} context for this question.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function AreaMissCard({ miss, selected = false, onSelect = null }) {
  const interactive = typeof onSelect === "function";

  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? onSelect : undefined}
      onMouseDown={interactive ? (event) => event.preventDefault() : undefined}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect();
              }
            }
          : undefined
      }
      className={`rounded-xl border px-4 py-3 transition ${
        selected
          ? "border-indigo-300 bg-indigo-50/80 ring-2 ring-indigo-200"
          : "border-red-200 bg-red-50/50"
      } ${interactive ? "cursor-pointer hover:border-indigo-200 hover:bg-indigo-50/40" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Q{miss.slot}
        </p>
        <QuestionDifficultyStars stars={miss.tier} />
        {selected ? (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
            Context shown →
          </span>
        ) : null}
      </div>
      <p className="text-sm text-slate-900 mt-2 leading-relaxed">
        {miss.prompt || "Question"}
      </p>
      <p className="text-sm text-red-800 mt-2">Student answered: {miss.given || "—"}</p>
      {miss.expected ? (
        <p className="text-sm text-emerald-800 mt-1">Correct: {miss.expected}</p>
      ) : null}
    </div>
  );
}

function WeakAreaChipList({
  areas,
  resetKey,
  subject = "",
  showPassageContext = false,
  attempt = null,
  passageLookup = {},
  questionPassageLookup = {},
  loadingPassages = false,
}) {
  const [expandedArea, setExpandedArea] = useState(null);
  const [selectedMissKey, setSelectedMissKey] = useState("");
  const expandedSectionRef = useRef(null);
  const shouldScrollExpandedRef = useRef(false);

  const expanded = areas.find((area) => area.area === expandedArea) || null;
  const sortedMisses = expanded
    ? [...(expanded.misses || [])].sort((a, b) => a.slot - b.slot)
    : [];
  const firstMiss = sortedMisses[0] || null;
  const firstMissKey = firstMiss ? missContextKey(firstMiss) : "";
  const selectedMiss =
    sortedMisses.find((miss) => missContextKey(miss) === selectedMissKey) ||
    firstMiss ||
    null;
  const selectedPassage =
    showPassageContext && selectedMiss && attempt
      ? resolveMissPassage(attempt, selectedMiss, {
          passageLookup,
          questionPassageLookup,
        })
      : null;
  const contextLoading =
    showPassageContext && loadingPassages && selectedMiss && !selectedPassage;

  useEffect(() => {
    setExpandedArea(null);
    setSelectedMissKey("");
  }, [resetKey]);

  useEffect(() => {
    if (!expandedArea) {
      setSelectedMissKey("");
      return;
    }
    if (firstMissKey) setSelectedMissKey(firstMissKey);
  }, [expandedArea, firstMissKey]);

  useEffect(() => {
    if (!expandedArea || !shouldScrollExpandedRef.current) return;
    shouldScrollExpandedRef.current = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        expandedSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      });
    });
  }, [expandedArea, sortedMisses.length]);

  if (!areas.length) {
    return (
      <p className="text-sm text-slate-600">No clear weak areas on this sitting.</p>
    );
  }

  return (
    <div ref={expandedSectionRef}>
      <div className="flex flex-wrap gap-2">
        {areas.map((area) => {
          const selected = expandedArea === area.area;
          const missCount = area.misses?.length || 0;
          return (
            <button
              key={area.area}
              type="button"
              title="Click to view wrong questions for this topic"
              aria-expanded={selected}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                const openingFresh = expandedArea === null;
                const next = expandedArea === area.area ? null : area.area;
                if (next) {
                  shouldScrollExpandedRef.current = openingFresh;
                }
                setExpandedArea(next);
              }}
              className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                selected
                  ? "border-rose-400 bg-rose-100 text-rose-950 ring-2 ring-rose-200"
                  : "border-rose-200 bg-rose-50 text-rose-950 hover:border-rose-300 hover:bg-rose-100/80"
              }`}
            >
              {area.label}
              <span className="mx-1.5 opacity-60">·</span>
              <span className="tabular-nums">
                {area.correctCount}/{area.count}
              </span>
              <span className="mx-1.5 opacity-60">·</span>
              <span className="tabular-nums">{area.weightedPct}%</span>
              {missCount > 0 ? (
                <>
                  <span className="mx-1.5 opacity-60">·</span>
                  <span className="tabular-nums">
                    {missCount} miss{missCount === 1 ? "" : "es"}
                  </span>
                </>
              ) : null}
            </button>
          );
        })}
      </div>

      {expanded ? (
        showPassageContext ? (
          <div className="mt-3">
            {sortedMisses.length > 1 ? (
              <div className="flex flex-wrap gap-2 mb-3">
                {sortedMisses.map((miss) => {
                  const missKey = missContextKey(miss);
                  const selected = selectedMissKey === missKey;
                  return (
                    <button
                      key={missKey}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => setSelectedMissKey(missKey)}
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        selected
                          ? "border-indigo-300 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-200"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      Q{miss.slot}
                    </button>
                  );
                })}
              </div>
            ) : null}
            {selectedMiss ? (
              <WeakAreaMissContextPanel
                attempt={attempt}
                miss={selectedMiss}
                areaLabel={expanded.label}
                passage={selectedPassage}
                subject={subject}
                loading={contextLoading}
              />
            ) : (
              <p className="text-sm text-slate-600">
                No wrong questions recorded for this topic.
              </p>
            )}
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50/30 px-4 py-4">
            <p className="text-xs font-semibold text-rose-900">
              Wrong questions · {expanded.label}
            </p>
            {sortedMisses.length > 0 ? (
              <div className="mt-3 flex flex-col gap-3">
                {sortedMisses.map((miss) => (
                  <AreaMissCard key={missContextKey(miss)} miss={miss} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600 mt-2">
                No wrong questions recorded for this topic.
              </p>
            )}
          </div>
        )
      ) : null}
    </div>
  );
}

function AreaChipList({ areas }) {
  if (!areas.length) {
    return (
      <p className="text-sm text-slate-600">
        No fully strong areas yet — misses were spread across topics.
      </p>
    );
  }

  const chipClass = "border-emerald-200 bg-emerald-50 text-emerald-950";

  return (
    <div className="flex flex-wrap gap-2">
      {areas.map((area) => (
        <span
          key={area.area}
          className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold ${chipClass}`}
        >
          {area.label}
          <span className="mx-1.5 opacity-60">·</span>
          <span className="tabular-nums">
            {area.correctCount}/{area.count}
          </span>
          <span className="mx-1.5 opacity-60">·</span>
          <span className="tabular-nums">{area.weightedPct}%</span>
        </span>
      ))}
    </div>
  );
}

export function TestAttemptTile({ attempt, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full text-left px-3 py-3 transition ${
        selected ? "bg-indigo-50/80" : "hover:bg-slate-50"
      }`}
    >
      <p className="font-semibold text-slate-900 text-sm leading-snug line-clamp-2">
        {attempt.title}
      </p>
      <p className="text-[11px] text-teal-800 mt-1 capitalize">
        {formatSubjectLabel(attempt.subject)}
      </p>
      {attempt.completed_at ? (
        <p className="text-[11px] text-slate-500 mt-1">
          {new Date(attempt.completed_at).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      ) : null}
      <p className="text-xs font-semibold text-teal-900 mt-2 tabular-nums">
        {formatWeightedTestScore(attempt.weighted_score, attempt.max_weighted_score)}
      </p>
      {typeof attempt.correct_count === "number" ? (
        <p className="text-[11px] text-slate-500 tabular-nums">
          {attempt.correct_count}/{attempt.total_count} correct
        </p>
      ) : null}
      {attempt.duration_seconds != null ? (
        <p className="text-[11px] text-slate-500 tabular-nums">
          {formatDurationSeconds(attempt.duration_seconds)}
        </p>
      ) : null}
    </button>
  );
}

export function TestAnalysisDetail({ attempt, analysis, nested = false }) {
  const { tierTrend, tierBands, weakAreas, strongAreas, timePressure, narrative } =
    analysis;
  const showPassageContext = attemptUsesPassageContext(attempt, { tierTrend });
  const [worksheet, setWorksheet] = useState(null);
  const [loadingWorksheet, setLoadingWorksheet] = useState(false);

  const needsWorksheetLookup = showPassageContext && Boolean(attempt?.worksheet_id);

  useEffect(() => {
    if (!attempt?.worksheet_id || !needsWorksheetLookup) {
      setWorksheet(null);
      return undefined;
    }

    let cancelled = false;
    setLoadingWorksheet(true);
    getWorksheet(attempt.worksheet_id)
      .then((data) => {
        if (!cancelled) setWorksheet(data);
      })
      .catch(() => {
        if (!cancelled) setWorksheet(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingWorksheet(false);
      });

    return () => {
      cancelled = true;
    };
  }, [attempt?.worksheet_id, needsWorksheetLookup]);

  const passageLookup = useMemo(() => buildPassageLookup(worksheet), [worksheet]);
  const questionPassageLookup = useMemo(
    () => buildQuestionPassageLookup(worksheet),
    [worksheet],
  );

  const weakAreasSection = (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-rose-900">Weak areas</h3>
        <span
          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-[11px] font-bold text-slate-500 cursor-help"
          title="Click a topic chip to view wrong questions for that area."
          aria-label="Click a topic chip to view wrong questions for that area."
        >
          ?
        </span>
      </div>
      <p className="text-xs text-slate-600 mt-1">
        Below 75% weighted accuracy or any easy-tier miss in that topic. Click a chip
        to review wrong answers.
        {showPassageContext ? (
          <>
            {" "}
            Each miss opens with its {passageWindowUnitLabel(attempt.subject).toLowerCase()}{" "}
            in the same panel.
          </>
        ) : null}
      </p>
      <div className="mt-3">
        <WeakAreaChipList
          areas={weakAreas}
          resetKey={attempt.id}
          subject={attempt.subject}
          showPassageContext={showPassageContext}
          attempt={attempt}
          passageLookup={passageLookup}
          questionPassageLookup={questionPassageLookup}
          loadingPassages={loadingWorksheet}
        />
      </div>
    </div>
  );

  const analysisBody = (
    <>
      {narrative ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
          <h3 className="text-sm font-semibold text-slate-900">Adaptive summary</h3>
          <p className="text-sm text-slate-700 mt-2 leading-relaxed">{narrative}</p>
          <p className="text-xs text-slate-500 mt-2">
            Auto-generated from tier movement and misses — use alongside the question
            details below, not as a substitute for reviewing work.
          </p>
        </div>
      ) : null}

      <div className={narrative ? "mt-6" : ""}>
        <h3 className="text-sm font-semibold text-slate-900">Tier progress</h3>
        <p className="text-xs text-slate-600 mt-1">
          {trendUsesPassageBands(analysis.tierTrend)
            ? "Question difficulty across the sitting; bands mark easy vs complex passages."
            : "How difficulty shifted question by question under adaptive rules."}
        </p>
        <div className="mt-3">
          <TierTrendChart trend={tierTrend} chartKey={attempt.id} />
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-slate-900">Accuracy by tier</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {tierBands.map((band) => (
            <div
              key={band.tier}
              className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <QuestionDifficultyStars stars={band.tier} />
                <span className="text-sm font-semibold text-slate-900">
                  {band.label}
                </span>
              </div>
              <p className="text-2xl font-bold text-slate-950 mt-2 tabular-nums">
                {band.accuracyPct}%
              </p>
              <p className="text-xs text-slate-600 mt-1 tabular-nums">
                {band.correctCount}/{band.count} correct · {band.weightedPct}% weighted
              </p>
            </div>
          ))}
        </div>
      </div>

      {timePressure ? (
        <div className="mt-6 rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-4">
          <h3 className="text-sm font-semibold text-amber-950">Time under pressure</h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 text-sm text-slate-800">
            {timePressure.timeLimitMinutes ? (
              <p>
                Time used:{" "}
                <span className="font-semibold tabular-nums">
                  {formatDurationSeconds(timePressure.durationSeconds)}
                </span>{" "}
                of {timePressure.timeLimitMinutes} min
                {timePressure.timeUsedPct != null ? (
                  <span className="text-slate-600"> ({timePressure.timeUsedPct}%)</span>
                ) : null}
              </p>
            ) : (
              <p>
                Duration:{" "}
                <span className="font-semibold tabular-nums">
                  {formatDurationSeconds(timePressure.durationSeconds)}
                </span>
              </p>
            )}
            {timePressure.secondsPerQuestion != null ? (
              <p>
                Pace:{" "}
                <span className="font-semibold tabular-nums">
                  {timePressure.secondsPerQuestion}s
                </span>{" "}
                per question
              </p>
            ) : null}
            {timePressure.firstHalfAccuracy != null ? (
              <p>
                First half:{" "}
                <span className="font-semibold tabular-nums">
                  {timePressure.firstHalfAccuracy}%
                </span>{" "}
                correct
              </p>
            ) : null}
            {timePressure.secondHalfAccuracy != null ? (
              <p>
                Second half:{" "}
                <span className="font-semibold tabular-nums">
                  {timePressure.secondHalfAccuracy}%
                </span>{" "}
                correct
              </p>
            ) : null}
          </div>
          {timePressure.rushedFinish ? (
            <p className="text-xs text-amber-900 mt-2">
              Used most of the available time — accuracy in the final stretch matters.
            </p>
          ) : null}
        </div>
      ) : null}

      {!showPassageContext ? weakAreasSection : null}

      {!showPassageContext ? (
        <>
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-emerald-900">Strong areas</h3>
            <p className="text-xs text-slate-600 mt-1">
              All questions correct in that topic for this sitting.
            </p>
            <div className="mt-3">
              <AreaChipList areas={strongAreas} />
            </div>
          </div>

          {attempt.review_id ? (
            <p className="mt-6 text-sm text-slate-700">
              Missed questions were saved to review session #{attempt.review_id}
              {attempt.review_completed ? " (completed)." : " (pending)."}
            </p>
          ) : null}
        </>
      ) : null}
    </>
  );

  const tailSections = showPassageContext ? (
    <>
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-emerald-900">Strong areas</h3>
        <p className="text-xs text-slate-600 mt-1">
          All questions correct in that topic for this sitting.
        </p>
        <div className="mt-3">
          <AreaChipList areas={strongAreas} />
        </div>
      </div>

      {attempt.review_id ? (
        <p className="mt-6 text-sm text-slate-700">
          Missed questions were saved to review session #{attempt.review_id}
          {attempt.review_completed ? " (completed)." : " (pending)."}
        </p>
      ) : null}
    </>
  ) : null;

  const shellClass = nested
    ? "min-w-0"
    : "rounded-2xl border border-slate-200 bg-white shadow-sm px-5 py-5 min-w-0";

  if (!showPassageContext) {
    return <div className={shellClass}>{analysisBody}</div>;
  }

  return (
    <div className={shellClass}>
      {analysisBody}
      {weakAreasSection}
      {tailSections}
    </div>
  );
}


export function CompositeAttemptTile({ composite, selected, onSelect }) {
  const sectionCount = (composite.sections || []).filter((section) => section.result).length;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full text-left px-3 py-3 transition ${
        selected ? "bg-violet-50/80" : "hover:bg-slate-50"
      }`}
    >
      <p className="font-semibold text-slate-900 text-sm leading-snug line-clamp-2">
        {composite.title}
      </p>
      <p className="text-[11px] text-violet-800 mt-1">
        Composite · {sectionCount} section{sectionCount === 1 ? "" : "s"}
      </p>
      {composite.completed_at ? (
        <p className="text-[11px] text-slate-500 mt-1">
          {new Date(composite.completed_at).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      ) : null}
      <p className="text-xs font-semibold text-violet-900 mt-2 tabular-nums">
        {formatWeightedTestScore(composite.weighted_score, composite.max_weighted_score)}
      </p>
      {composite.duration_seconds != null ? (
        <p className="text-[11px] text-slate-500 tabular-nums">
          {formatDurationSeconds(composite.duration_seconds)}
        </p>
      ) : null}
    </button>
  );
}
