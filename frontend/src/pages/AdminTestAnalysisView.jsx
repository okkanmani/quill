import { useEffect, useMemo, useState } from "react";
import { getAdminTestResults, markTestAttemptAnalyzed } from "../api";
import QuillLoading from "../components/QuillLoading";
import { QuestionDifficultyStars } from "../components/DifficultyStars";
import { formatSubjectLabel } from "../subjectUtils";
import { formatDurationSeconds } from "../worksheetUtils";
import { formatWeightedTestScore } from "../testUtils";
import {
  analyzeTestAttempt,
  filterAdaptiveTestAttempts,
  buildPassageBandSegments,
  TEST_TIER_LABELS,
  trendUsesPassageBands,
} from "../testAnalysisUtils";

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

function AreaMissCard({ miss }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50/50 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Q{miss.slot}
        </p>
        <QuestionDifficultyStars stars={miss.tier} />
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

function WeakAreaChipList({ areas, resetKey }) {
  const [expandedArea, setExpandedArea] = useState(null);

  useEffect(() => {
    setExpandedArea(null);
  }, [resetKey]);

  if (!areas.length) {
    return (
      <p className="text-sm text-slate-600">No clear weak areas on this sitting.</p>
    );
  }

  const expanded = areas.find((area) => area.area === expandedArea) || null;
  const sortedMisses = expanded
    ? [...(expanded.misses || [])].sort((a, b) => a.slot - b.slot)
    : [];

  return (
    <div>
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
              onClick={() =>
                setExpandedArea((current) => (current === area.area ? null : area.area))
              }
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
        <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50/30 px-4 py-4">
          <p className="text-xs font-semibold text-rose-900">
            Wrong questions · {expanded.label}
          </p>
          {sortedMisses.length > 0 ? (
            <div className="mt-3 flex flex-col gap-3">
              {sortedMisses.map((miss) => (
                <AreaMissCard key={miss.slot} miss={miss} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-600 mt-2">
              No wrong questions recorded for this topic.
            </p>
          )}
        </div>
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

function TestAttemptTile({ attempt, selected, onSelect }) {
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

function TestAnalysisDetail({ attempt, analysis }) {
  const { tierTrend, tierBands, weakAreas, strongAreas, timePressure, narrative } =
    analysis;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-5 py-5 min-w-0">
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
        </p>
        <div className="mt-3">
          <WeakAreaChipList areas={weakAreas} resetKey={attempt.id} />
        </div>
      </div>

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
    </div>
  );
}

export default function AdminTestAnalysisView({ initialAttemptId = null }) {
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(
    initialAttemptId ? Number(initialAttemptId) : null,
  );

  useEffect(() => {
    setLoading(true);
    getAdminTestResults()
      .then((data) => {
        setError("");
        setAttempts(filterAdaptiveTestAttempts(data));
      })
      .catch(() => setError("Could not load test results."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (initialAttemptId) {
      setSelectedId(Number(initialAttemptId));
    }
  }, [initialAttemptId]);

  useEffect(() => {
    if (!selectedId) return;
    const attempt = attempts.find((item) => item.id === selectedId);
    if (!attempt || attempt.analyzed_at) return;
    markTestAttemptAnalyzed(selectedId)
      .then(({ analyzed_at: analyzedAt }) => {
        setAttempts((prev) =>
          prev.map((item) =>
            item.id === selectedId ? { ...item, analyzed_at: analyzedAt } : item,
          ),
        );
      })
      .catch(() => {});
  }, [selectedId, attempts]);

  const selectedAttempt = useMemo(
    () => attempts.find((attempt) => attempt.id === selectedId) || null,
    [attempts, selectedId],
  );

  const analysis = useMemo(
    () => (selectedAttempt ? analyzeTestAttempt(selectedAttempt) : null),
    [selectedAttempt],
  );

  if (loading) return <QuillLoading label="Loading test analysis…" />;

  return (
    <div>
      <p className="text-slate-700 text-sm leading-relaxed mb-6">
        Adaptive test performance under timed conditions — tier movement, accuracy by
        difficulty, and topic strengths/weaknesses for one sitting at a time.
      </p>

      {error ? <p className="text-red-600 text-sm mb-4">{error}</p> : null}

      {attempts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-sm text-slate-600">
          No completed adaptive tests yet. Use <strong>Analyse</strong> on the Results
          page after a student submits an adaptive test.
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-5 lg:items-start">
          <div className="w-full lg:w-44 xl:w-48 shrink-0 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Tests
              </p>
            </div>
            <div className="divide-y divide-slate-100 max-h-[70vh] overflow-y-auto">
              {attempts.map((attempt) => (
                <TestAttemptTile
                  key={attempt.id}
                  attempt={attempt}
                  selected={attempt.id === selectedId}
                  onSelect={() => setSelectedId(attempt.id)}
                />
              ))}
            </div>
          </div>

          <div className="flex-1 min-w-0 lg:sticky lg:top-4">
            {selectedAttempt && analysis ? (
              <TestAnalysisDetail
                key={selectedAttempt.id}
                attempt={selectedAttempt}
                analysis={analysis}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-5 py-8 min-h-[20rem] flex items-center justify-center text-sm text-slate-500">
                Select a test to view analysis.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
