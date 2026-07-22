import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  generateFocusPracticeWorksheet,
  getAdminSettings,
  getAnalysisPracticeResults,
  getFocusAreasDiscussed,
  getResults,
  getRevisionAnalysisRecords,
  logout,
  markFocusAreaDiscussed,
  saveManualFocusPracticeWorksheet,
  uploadFocusEvaluation,
} from "../api";
import { ADMIN_MAIN_NAV } from "../adminNav";
import AppShell from "../components/AppShell";
import AdminStudentSwitcher from "../components/AdminStudentSwitcher";
import AdminStudentBanner from "../components/AdminStudentBanner";
import QuillLoading from "../components/QuillLoading";
import FocusAreaExplainPanel from "../components/FocusAreaExplainPanel";
import FocusPracticeBuilder from "../components/FocusPracticeBuilder";
import FocusPracticeWorksheet from "../components/FocusPracticeWorksheet";
import { QuestionDifficultyStars } from "../components/DifficultyStars";
import { formatWeightedTestScore } from "../testUtils";
import {
  buildFocusAreaUrgencyMap,
  filterFocusAreasForChipDisplay,
  focusAreasAnalysisWithDiscussion,
  focusAreaUrgencyChipClass,
  formatAreaLabel,
  formatFocusExampleAnswer,
  formatFocusExampleChoices,
  isMissingFocusExampleAnswer,
} from "../analysisUtils";
import {
  flattenGroupedFocusAreas,
  groupFocusAreas,
  rebuildGroupedFocusAreas,
} from "../areaGroupMap";
import {
  readJsonFile,
  resolveResultForEvaluationUpload,
} from "../resultExportUtils";
import AdminTestAnalysisView from "./AdminTestAnalysisView";

const NEEDS_DISCUSSION_VISIBLE_COUNT = 6;

function AnalysisViewTabs({ activeView }) {
  const worksheetClass =
    activeView === "worksheets"
      ? "bg-slate-900 text-white border-slate-900"
      : "bg-white text-slate-800 border-slate-300 hover:bg-slate-50";
  const testClass =
    activeView === "tests"
      ? "bg-slate-900 text-white border-slate-900"
      : "bg-white text-slate-800 border-slate-300 hover:bg-slate-50";

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      <Link
        to="/admin/analysis"
        className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${worksheetClass}`}
      >
        Worksheet analysis
      </Link>
      <Link
        to="/admin/analysis?view=tests"
        className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${testClass}`}
      >
        Test analysis
      </Link>
    </div>
  );
}

function focusSelectionKey(subjectKey, area) {
  return `${subjectKey}::${area}`;
}

function parseFocusSelectionKey(key) {
  if (!key) return null;
  const splitAt = key.indexOf("::");
  if (splitAt <= 0) return null;
  return {
    subjectKey: key.slice(0, splitAt),
    area: key.slice(splitAt + 2),
  };
}

function findSelectedFocus(bySubject, selectedKey) {
  const parsed = parseFocusSelectionKey(selectedKey);
  if (!parsed) return null;
  const subject = bySubject.find((s) => s.subjectKey === parsed.subjectKey);
  if (!subject) return null;
  const focus =
    subject.needsAddressing.find((f) => f.area === parsed.area) ||
    subject.needsReinforcing.find((f) => f.area === parsed.area) ||
    subject.discussed.find((f) => f.area === parsed.area);
  if (!focus) return null;
  return { subject, focus };
}

function FocusAreaChipButton({
  focus,
  subjectKey,
  selectedKey,
  onSelectArea,
  urgencyTier = "low",
  muted = false,
  chipCountMode = "wrong",
}) {
  const key = focusSelectionKey(subjectKey, focus.area);
  const isSelected = selectedKey === key;
  const label = formatAreaLabel(focus.area);
  if (!label.trim()) return null;

  const chipCount =
    chipCountMode === "reinforcement"
      ? Math.max(focus.reinforcementCount || 0, 1)
      : focus.wrongCount || 0;

  if (!muted && chipCount <= 0) return null;

  return (
    <button
      type="button"
      onClick={() => onSelectArea(key)}
      aria-pressed={isSelected}
      className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition ${focusAreaUrgencyChipClass(
        urgencyTier,
        { selected: isSelected, muted },
      )}`}
    >
      <span>{label}</span>
      {!muted ? (
        <>
          <span className="mx-1.5 opacity-70" aria-hidden="true">
            ·
          </span>
          <span className="tabular-nums">{chipCount}</span>
        </>
      ) : null}
    </button>
  );
}

function FocusAreaChipRow({
  areas,
  subjectKey,
  selectedKey,
  onSelectArea,
  urgencyMap = {},
  muted = false,
  chipCountMode = "wrong",
}) {
  const displayAreas = useMemo(
    () => filterFocusAreasForChipDisplay(areas, { chipCountMode: muted ? "discussed" : chipCountMode }),
    [areas, chipCountMode, muted],
  );
  if (!displayAreas.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {displayAreas.map((focus) => (
        <FocusAreaChipButton
          key={focus.area}
          focus={focus}
          subjectKey={subjectKey}
          selectedKey={selectedKey}
          onSelectArea={onSelectArea}
          urgencyTier={urgencyMap[focus.area] || "low"}
          muted={muted}
          chipCountMode={chipCountMode}
        />
      ))}
    </div>
  );
}

function GroupedNeedsDiscussionChips({
  areas,
  subjectKey,
  selectedKey,
  onSelectArea,
  collapseAfter = null,
  chipCountMode = "wrong",
}) {
  const displayAreas = useMemo(
    () => filterFocusAreasForChipDisplay(areas, { chipCountMode }),
    [areas, chipCountMode],
  );
  const [expanded, setExpanded] = useState(false);
  const urgencyMap = useMemo(() => buildFocusAreaUrgencyMap(displayAreas), [displayAreas]);
  const groupedAreas = useMemo(
    () => groupFocusAreas(displayAreas, subjectKey),
    [displayAreas, subjectKey],
  );
  const flatAreas = useMemo(
    () => flattenGroupedFocusAreas(groupedAreas),
    [groupedAreas],
  );

  const visibleFlatAreas = useMemo(() => {
    if (!collapseAfter || expanded || flatAreas.length <= collapseAfter) {
      return flatAreas;
    }

    const initial = flatAreas.slice(0, collapseAfter);
    const parsed = parseFocusSelectionKey(selectedKey);
    if (parsed?.subjectKey !== subjectKey) {
      return initial;
    }

    const selectedItem = flatAreas.find((item) => item.focus.area === parsed.area);
    if (selectedItem && !initial.some((item) => item.focus.area === selectedItem.focus.area)) {
      return [...initial, selectedItem];
    }

    return initial;
  }, [flatAreas, collapseAfter, expanded, selectedKey, subjectKey]);

  const visibleGroupedAreas = useMemo(
    () => rebuildGroupedFocusAreas(visibleFlatAreas),
    [visibleFlatAreas],
  );

  const hiddenCount = expanded ? 0 : flatAreas.length - visibleFlatAreas.length;
  const showToggle = Boolean(collapseAfter) && flatAreas.length > collapseAfter;

  if (!displayAreas.length) return null;

  return (
    <div className="mt-2">
      <div className="flex flex-col gap-4">
        {visibleGroupedAreas.map(([groupLabel, groupAreas]) => {
          if (!groupAreas.length) return null;
          return (
          <div key={groupLabel}>
            <p className="text-xs font-semibold text-slate-600 mb-2">{groupLabel}</p>
            <FocusAreaChipRow
              areas={groupAreas}
              subjectKey={subjectKey}
              selectedKey={selectedKey}
              onSelectArea={onSelectArea}
              urgencyMap={urgencyMap}
              chipCountMode={chipCountMode}
            />
          </div>
          );
        })}
      </div>
      {showToggle ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="mt-4 w-full rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-semibold text-slate-800 py-2.5 transition"
        >
          {expanded
            ? "Show less"
            : `Show ${Math.max(hiddenCount, 0)} more topic${hiddenCount === 1 ? "" : "s"}`}
        </button>
      ) : null}
    </div>
  );
}

function FocusAreaChips({
  areas,
  subjectKey,
  selectedKey,
  onSelectArea,
  muted = false,
  collapseAfter = null,
}) {
  const displayAreas = useMemo(
    () => filterFocusAreasForChipDisplay(areas, { chipCountMode: "discussed" }),
    [areas],
  );
  const [expanded, setExpanded] = useState(false);

  const visibleAreas = useMemo(() => {
    if (!collapseAfter || expanded || displayAreas.length <= collapseAfter) {
      return displayAreas;
    }

    const initial = displayAreas.slice(0, collapseAfter);
    const parsed = parseFocusSelectionKey(selectedKey);
    if (parsed?.subjectKey !== subjectKey) {
      return initial;
    }

    const selectedFocus = displayAreas.find((focus) => focus.area === parsed.area);
    if (selectedFocus && !initial.some((focus) => focus.area === selectedFocus.area)) {
      return [...initial, selectedFocus];
    }

    return initial;
  }, [displayAreas, collapseAfter, expanded, selectedKey, subjectKey]);

  const hiddenCount = expanded ? 0 : displayAreas.length - visibleAreas.length;
  const showToggle = Boolean(collapseAfter) && displayAreas.length > collapseAfter;

  if (!displayAreas.length) return null;

  return (
    <div className="mt-2">
      <FocusAreaChipRow
        areas={visibleAreas}
        subjectKey={subjectKey}
        selectedKey={selectedKey}
        onSelectArea={onSelectArea}
        muted={muted}
      />
      {showToggle ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="mt-3 w-full rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-semibold text-slate-800 py-2.5 transition"
        >
          {expanded
            ? "Show less"
            : `Show ${Math.max(hiddenCount, 0)} more topic${hiddenCount === 1 ? "" : "s"}`}
        </button>
      ) : null}
    </div>
  );
}

function FocusPracticeQuestionCard({ question, index, total }) {
  const [revealed, setRevealed] = useState(false);
  const choices = formatFocusExampleChoices(question.choices);
  const studentAnswer = formatFocusExampleAnswer(question.answer);
  const missingAnswer = isMissingFocusExampleAnswer(question.answer);
  const isCorrect = question.correct === true;

  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        isCorrect
          ? "border-emerald-100 bg-emerald-50/70"
          : "border-slate-100 bg-slate-50"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Question{total > 1 ? ` ${index + 1}` : ""}
        </p>
        <QuestionDifficultyStars stars={question.stars || 2} />
        <span
          className={`text-[11px] font-semibold uppercase tracking-wide ${
            isCorrect ? "text-emerald-700" : "text-red-700"
          }`}
        >
          {isCorrect ? "Correct" : "Incorrect"}
        </span>
      </div>
      <p className="text-sm text-slate-900 mt-2 leading-relaxed whitespace-pre-wrap">
        {question.question}
      </p>
      {choices ? (
        <p className="text-sm text-slate-700 mt-2 leading-relaxed">
          <span className="font-medium text-slate-600">Options: </span>
          {choices}
        </p>
      ) : null}
      <p className={`text-sm mt-2 ${isCorrect ? "text-emerald-900" : "text-red-800"}`}>
        <span className="font-medium">Student answered: </span>
        <span className={missingAnswer ? "text-slate-500 italic" : undefined}>
          {studentAnswer}
        </span>
      </p>
      {!isCorrect && question.expected ? (
        <div className="text-sm text-emerald-800 mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium">Correct answer:</span>
          {revealed ? (
            <span>{question.expected}</span>
          ) : (
            <span
              className="inline-block rounded px-2 py-0.5 bg-emerald-100/80 text-emerald-900/40 select-none tracking-widest font-mono text-xs"
              aria-hidden="true"
            >
              {"•".repeat(Math.min(Math.max(question.expected.length, 6), 16))}
            </span>
          )}
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 underline underline-offset-2"
            aria-pressed={revealed}
          >
            {revealed ? "Hide" : "Show"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function FocusExampleCard({ example, index, total }) {
  const [revealed, setRevealed] = useState(false);
  const choices = formatFocusExampleChoices(example.choices);
  const studentAnswer = formatFocusExampleAnswer(example.answer);
  const missingAnswer = isMissingFocusExampleAnswer(example.answer);

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Example{total > 1 ? ` ${index + 1}` : ""}
      </p>
      <p className="text-sm text-slate-900 mt-2 leading-relaxed whitespace-pre-wrap">
        {example.question}
      </p>
      {choices ? (
        <p className="text-sm text-slate-700 mt-2 leading-relaxed">
          <span className="font-medium text-slate-600">Options: </span>
          {choices}
        </p>
      ) : null}
      <p className="text-sm text-red-800 mt-2">
        <span className="font-medium">Student answered: </span>
        <span className={missingAnswer ? "text-slate-500 italic" : undefined}>
          {studentAnswer}
        </span>
      </p>
      {example.expected ? (
        <div className="text-sm text-emerald-800 mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium">Correct answer:</span>
          {revealed ? (
            <span>{example.expected}</span>
          ) : (
            <span
              className="inline-block rounded px-2 py-0.5 bg-emerald-100/80 text-emerald-900/40 select-none tracking-widest font-mono text-xs"
              aria-hidden="true"
            >
              {"•".repeat(Math.min(Math.max(example.expected.length, 6), 16))}
            </span>
          )}
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 underline underline-offset-2"
            aria-pressed={revealed}
          >
            {revealed ? "Hide" : "Show"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function FocusAreaDetailPlaceholder() {
  return (
    <div className="hidden lg:flex rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 shadow-sm px-5 py-5 min-h-[22rem] flex-col">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Discussion
      </p>
      <h2 className="text-xl font-semibold text-slate-400 mt-1">Select a focus area</h2>
      <p className="text-sm text-slate-500 mt-3 leading-relaxed max-w-md">
        Choose a chip on the left to review sample wrong answers, add notes, and mark
        the area as discussed.
      </p>
      <div className="mt-6 flex flex-col gap-3 flex-1">
        <div className="rounded-xl border border-slate-100 bg-white/70 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">
            Examples
          </p>
          <div className="mt-3 space-y-2">
            <div className="h-2.5 rounded bg-slate-100 w-full" />
            <div className="h-2.5 rounded bg-slate-100 w-[92%]" />
            <div className="h-2.5 rounded bg-slate-100 w-[78%]" />
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white/70 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">
            Notes &amp; status
          </p>
          <div className="mt-3 h-10 rounded-lg bg-slate-100" />
        </div>
      </div>
    </div>
  );
}

function PracticeNoticeBanner({
  notice,
  onGeneratePractice,
  onCreateManual,
  aiEnabled,
  apiKeyConfigured,
  generatingPractice,
}) {
  if (!notice) return null;

  const showSettingsLink =
    notice.message.includes("Admin → Settings") ||
    notice.message.includes("OpenAI API key");

  const showGenerate =
    notice.showPracticeActions &&
    !notice.practiceGenerated &&
    aiEnabled &&
    apiKeyConfigured &&
    onGeneratePractice;
  const showManual = notice.showPracticeActions && onCreateManual;

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 mb-4 flex flex-col gap-3">
      <p className="text-green-800 text-sm leading-relaxed">
        {notice.message}
        {showSettingsLink ? (
          <>
            {" "}
            <Link to="/admin/settings" className="font-semibold underline">
              Open Settings
            </Link>
          </>
        ) : null}
      </p>
      {showGenerate || showManual ? (
        <div className="flex flex-wrap items-center gap-2">
          {showGenerate ? (
            <button
              type="button"
              onClick={onGeneratePractice}
              disabled={generatingPractice}
              className="rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-900 hover:bg-indigo-50 transition disabled:opacity-50"
            >
              {generatingPractice ? "Generating…" : "Generate AI practice worksheet"}
            </button>
          ) : null}
          {showManual ? (
            <button
              type="button"
              onClick={onCreateManual}
              disabled={generatingPractice}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition disabled:opacity-50"
            >
              Create practice manually
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function FocusAreaDetailPanel({
  selection,
  selectionKey,
  onMarkDiscussed,
  markingDiscussed,
  generatingPractice,
  generatePracticeOnComplete,
  onGeneratePracticeOnCompleteChange,
  grade,
  aiEnabled,
  apiKeyConfigured,
}) {
  const { subject, focus } = selection;
  const practiceResult = focus.practiceResult;
  const practiceQuestions = practiceResult?.questions || [];
  const examples = focus.examples || [];
  const displayItems = practiceQuestions.length > 0 ? practiceQuestions : examples;
  const usingPractice = practiceQuestions.length > 0;
  const weightedLabel = practiceResult
    ? formatWeightedTestScore(
        practiceResult.weighted_score,
        practiceResult.max_weighted_score,
      )
    : null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-5 py-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {subject.subjectLabel}
      </p>
      <h2 className="text-xl font-semibold text-slate-950 mt-1">
        {formatAreaLabel(focus.area)}
      </h2>
      {focus.discussionStatus === "discussed" ? (
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 mt-2">
          Discussed
        </p>
      ) : focus.discussionStatus === "needs_reinforcing" ? (
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-800 mt-2">
          Needs reinforcing
          {(focus.reinforcementCount || 0) > 0 ? (
            <span className="normal-case font-medium text-slate-600">
              {" "}
              · reinforcement visit {(focus.reinforcementCount || 0)}
            </span>
          ) : null}
        </p>
      ) : (
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 mt-2">
          Needs addressing
          {(focus.wrongCount || 0) > 0 ? (
            <span className="normal-case font-medium text-slate-600">
              {" "}
              · {focus.wrongCount} wrong answer{focus.wrongCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </p>
      )}
      {usingPractice ? (
        <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-800">
            Latest practice result
          </p>
          <p className="text-sm text-slate-800 mt-1">
            {practiceResult.title || "Focus practice"}
            {practiceResult.score != null && practiceResult.total != null ? (
              <span className="text-slate-600">
                {" "}
                · {practiceResult.score}/{practiceResult.total} correct
              </span>
            ) : null}
            {weightedLabel && weightedLabel !== "—" ? (
              <span className="text-slate-600"> · {weightedLabel} weighted</span>
            ) : null}
          </p>
        </div>
      ) : null}
      {displayItems.length > 0 ? (
        <div className="mt-4 flex flex-col gap-3">
          {displayItems.map((item, index) =>
            usingPractice ? (
              <FocusPracticeQuestionCard
                key={`${focus.area}-practice-${item.question_id || index}`}
                question={item}
                index={index}
                total={displayItems.length}
              />
            ) : (
              <FocusExampleCard
                key={`${focus.area}-${item.question_id || index}`}
                example={item}
                index={index}
                total={displayItems.length}
              />
            ),
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-600 mt-4 leading-relaxed">
          No sample wrong answers or practice results recorded for this area yet.
        </p>
      )}
      <FocusAreaExplainPanel
        selectionKey={selectionKey}
        areaLabel={formatAreaLabel(focus.area)}
        area={focus.area}
        subjectKey={subject.subjectKey}
        examples={usingPractice ? practiceQuestions.filter((q) => q.correct === false) : examples}
        grade={grade}
        aiEnabled={aiEnabled}
        apiKeyConfigured={apiKeyConfigured}
        needsDiscussion={focus.discussionStatus !== "discussed"}
        onMarkDiscussed={onMarkDiscussed}
        markingDiscussed={markingDiscussed}
        generatingPractice={generatingPractice}
        generatePracticeOnComplete={generatePracticeOnComplete}
        onGeneratePracticeOnCompleteChange={onGeneratePracticeOnCompleteChange}
        reinforcing={focus.discussionStatus === "needs_reinforcing"}
      />
    </div>
  );
}

function SubjectBlock({ subject, selectedKey, onSelectArea }) {
  const { needsAddressing, needsReinforcing, discussed } = subject;
  const parsed = parseFocusSelectionKey(selectedKey);
  const selectedIsDiscussed =
    parsed?.subjectKey === subject.subjectKey &&
    discussed.some((focus) => focus.area === parsed.area);
  const [discussedExpanded, setDiscussedExpanded] = useState(false);

  useEffect(() => {
    if (selectedIsDiscussed) {
      setDiscussedExpanded(true);
    }
  }, [selectedIsDiscussed]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-5 py-4">
      <p className="text-lg font-semibold text-slate-900">{subject.subjectLabel}</p>
      {needsAddressing.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
            Needs addressing
          </p>
          <GroupedNeedsDiscussionChips
            areas={needsAddressing}
            subjectKey={subject.subjectKey}
            selectedKey={selectedKey}
            onSelectArea={onSelectArea}
            collapseAfter={NEEDS_DISCUSSION_VISIBLE_COUNT}
          />
        </div>
      ) : null}
      {needsReinforcing.length > 0 ? (
        <div className={needsAddressing.length > 0 ? "mt-4" : "mt-3"}>
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">
            Needs reinforcing
          </p>
          <GroupedNeedsDiscussionChips
            areas={needsReinforcing}
            subjectKey={subject.subjectKey}
            selectedKey={selectedKey}
            onSelectArea={onSelectArea}
            collapseAfter={NEEDS_DISCUSSION_VISIBLE_COUNT}
            chipCountMode="reinforcement"
          />
        </div>
      ) : null}
      {discussed.length > 0 ? (
        <div
          className={
            needsAddressing.length > 0 || needsReinforcing.length > 0
              ? "mt-4"
              : "mt-3"
          }
        >
          {discussedExpanded ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Discussed
              </p>
              <FocusAreaChips
                areas={discussed}
                subjectKey={subject.subjectKey}
                selectedKey={selectedKey}
                onSelectArea={onSelectArea}
                muted
              />
              <button
                type="button"
                onClick={() => setDiscussedExpanded(false)}
                aria-expanded
                className="mt-2 text-xs font-semibold text-indigo-700 hover:text-indigo-900 hover:underline"
              >
                Hide discussed
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setDiscussedExpanded(true)}
              aria-expanded={false}
              className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 hover:underline"
            >
              View discussed ({discussed.length})
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function AdminAnalysis() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const analysisView = searchParams.get("view") === "tests" ? "tests" : "worksheets";
  const initialAttemptId = searchParams.get("attempt");
  const initialFocusKey = searchParams.get("focus");
  const [results, setResults] = useState([]);
  const [revisionRecords, setRevisionRecords] = useState([]);
  const [practiceRecords, setPracticeRecords] = useState([]);
  const [discussed, setDiscussed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedKey, setSelectedKey] = useState("");
  const [markingDiscussed, setMarkingDiscussed] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [practiceWorksheet, setPracticeWorksheet] = useState(null);
  const [practicePanelMode, setPracticePanelMode] = useState(null);
  const [builderSelection, setBuilderSelection] = useState(null);
  const [practiceNotice, setPracticeNotice] = useState(null);
  const [generatePracticeOnComplete, setGeneratePracticeOnComplete] = useState(false);
  const [generatingPractice, setGeneratingPractice] = useState(false);
  const [savingManualPractice, setSavingManualPractice] = useState(false);
  const uploadInputRef = useRef(null);
  const practiceScrollerRef = useRef(null);
  const appliedFocusFromUrl = useRef(false);
  const studentGrade = Number(localStorage.getItem("studentGrade")) || null;

  useEffect(() => {
    getAdminSettings()
      .then((data) => {
        setAiEnabled(Boolean(data.ai_enabled));
        setApiKeyConfigured(Boolean(data.openai_key_configured));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getResults(),
      getFocusAreasDiscussed(),
      getRevisionAnalysisRecords().catch(() => []),
      getAnalysisPracticeResults().catch(() => []),
    ])
      .then(([resultData, discussedData, revisionData, practiceData]) => {
        setError("");
        setResults(resultData);
        setDiscussed(discussedData);
        setRevisionRecords(Array.isArray(revisionData) ? revisionData : []);
        setPracticeRecords(Array.isArray(practiceData) ? practiceData : []);
      })
      .catch(() => setError("Could not load analysis data."))
      .finally(() => setLoading(false));
  }, []);

  const bySubject = useMemo(
    () =>
      focusAreasAnalysisWithDiscussion(
        results,
        discussed,
        revisionRecords,
        practiceRecords,
      ),
    [results, discussed, revisionRecords, practiceRecords],
  );
  const uploadedCount = results.filter((r) => r.focus_evaluation).length;
  const selection = useMemo(
    () => findSelectedFocus(bySubject, selectedKey),
    [bySubject, selectedKey],
  );

  useEffect(() => {
    if (bySubject.length === 0) {
      setSelectedKey("");
      return;
    }
    if (
      !appliedFocusFromUrl.current &&
      initialFocusKey &&
      findSelectedFocus(bySubject, initialFocusKey)
    ) {
      setSelectedKey(initialFocusKey);
      appliedFocusFromUrl.current = true;
      return;
    }
    if (selectedKey && !findSelectedFocus(bySubject, selectedKey)) {
      setSelectedKey("");
    }
  }, [bySubject, initialFocusKey, selectedKey]);

  function handleSelectArea(key) {
    setSelectedKey((current) => (current === key ? "" : key));
  }

  useEffect(() => {
    if (!selection) return;
    const isReinforcing = selection.focus.discussionStatus === "needs_reinforcing";
    setGeneratePracticeOnComplete(!isReinforcing);
  }, [selectedKey, selection]);

  useEffect(() => {
    if (!practiceNotice) return;
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    });
  }, [practiceNotice]);

  function buildPracticePayload(focusSelection) {
    return {
      subject: focusSelection.subject.subjectKey,
      area: focusSelection.focus.area,
      grade: studentGrade || undefined,
      use_ai: true,
      examples: (focusSelection.focus.examples || []).map((example) => ({
        question: example.question,
        answer: example.answer || "",
        expected: example.expected || "",
        choices: example.choices?.length ? example.choices : undefined,
      })),
    };
  }

  async function generatePracticeWorksheet(focusSelection, { scrollAfter = false } = {}) {
    const worksheet = await generateFocusPracticeWorksheet(
      buildPracticePayload(focusSelection),
    );
    setPracticeWorksheet(worksheet);
    setPracticePanelMode("worksheet");
    setBuilderSelection(null);
    if (scrollAfter) {
      requestAnimationFrame(() => {
        scrollToPracticePanel();
      });
    }
    return worksheet;
  }

  function openManualBuilder(focusSelection) {
    if (!focusSelection) return;
    setBuilderSelection(focusSelection);
    setPracticePanelMode("builder");
    requestAnimationFrame(() => {
      scrollToPracticePanel();
    });
  }

  function handleOpenManualBuilder() {
    openManualBuilder(selection);
  }

  async function handleSaveManualPractice(payload) {
    setSavingManualPractice(true);
    setError("");
    try {
      const worksheet = await saveManualFocusPracticeWorksheet(payload);
      setPracticeWorksheet(worksheet);
      setPracticePanelMode("worksheet");
      setBuilderSelection(null);
      const areaLabel = formatAreaLabel(payload.area);
      setPracticeNotice({
        message: `Manual practice worksheet saved for “${areaLabel}” — available on the student's Revision page.`,
        showPracticeActions: true,
        practiceGenerated: true,
      });
    } catch (err) {
      setError(err.message || "Could not save manual practice worksheet.");
      throw err;
    } finally {
      setSavingManualPractice(false);
    }
  }

  function handleCancelManualBuilder() {
    setPracticePanelMode(practiceWorksheet ? "worksheet" : null);
    setBuilderSelection(null);
    scrollToAnalysisPanel();
  }

  async function handleMarkDiscussed() {
    if (!selection) return;
    setMarkingDiscussed(true);
    setError("");
    setPracticeNotice(null);
    const areaLabel = formatAreaLabel(selection.focus.area);
    const reinforcing = selection.focus.discussionStatus === "needs_reinforcing";
    try {
      const updated = await markFocusAreaDiscussed({
        subject: selection.subject.subjectKey,
        area: selection.focus.area,
      });
      setDiscussed((prev) => {
        const next = prev.filter(
          (row) =>
            !(
              row.subject === updated.subject &&
              row.area === updated.area
            ),
        );
        return [...next, updated];
      });

      const shouldGenerate =
        generatePracticeOnComplete && aiEnabled && apiKeyConfigured;

      if (shouldGenerate) {
        setGeneratingPractice(true);
        try {
          await generatePracticeWorksheet(selection, { scrollAfter: true });
          setPracticeNotice({
            message: reinforcing
              ? `Marked “${areaLabel}” reinforcement complete — AI practice worksheet ready and saved to the student's Revision page.`
              : `Marked “${areaLabel}” as discussed — AI practice worksheet ready and saved to the student's Revision page.`,
            showPracticeActions: true,
            practiceGenerated: true,
          });
        } catch (err) {
          setPracticeNotice({
            message: reinforcing
              ? `Marked “${areaLabel}” reinforcement complete. Could not generate practice worksheet: ${err.message}`
              : `Marked “${areaLabel}” as discussed. Could not generate practice worksheet: ${err.message}`,
            showPracticeActions: true,
            practiceGenerated: false,
          });
        } finally {
          setGeneratingPractice(false);
        }
      } else {
        setPracticeNotice({
          message: reinforcing
            ? `Marked “${areaLabel}” reinforcement complete.`
            : aiEnabled && !apiKeyConfigured
              ? `Marked “${areaLabel}” as discussed. Add an OpenAI API key under Admin → Settings to generate a focus practice worksheet, or create one manually.`
              : aiEnabled
                ? `Marked “${areaLabel}” as discussed.`
                : `Marked “${areaLabel}” as discussed. AI is disabled on this server.`,
          showPracticeActions: true,
          practiceGenerated: false,
        });
      }
    } catch (err) {
      setError(err.message || "Could not complete discussion.");
    } finally {
      setMarkingDiscussed(false);
    }
  }

  async function handleGeneratePractice() {
    if (!selection || !aiEnabled || !apiKeyConfigured) return;
    setGeneratingPractice(true);
    setError("");
    try {
      await generatePracticeWorksheet(selection, { scrollAfter: true });
      setPracticeNotice({
        message: `AI practice worksheet ready for “${formatAreaLabel(selection.focus.area)}” — saved to the student's Revision page.`,
        showPracticeActions: true,
        practiceGenerated: true,
      });
    } catch (err) {
      setError(err.message || "Could not generate practice worksheet.");
    } finally {
      setGeneratingPractice(false);
    }
  }

  function scrollToAnalysisPanel() {
    practiceScrollerRef.current?.scrollTo({ left: 0, behavior: "smooth" });
  }

  function scrollToPracticePanel() {
    const scroller = practiceScrollerRef.current;
    if (scroller) {
      scroller.scrollTo({ left: scroller.clientWidth, behavior: "smooth" });
    }
  }

  async function handleUploadFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    setUploadMessage("");
    setError("");
    try {
      const data = await readJsonFile(file);
      const resolved = resolveResultForEvaluationUpload(data, results);
      if (resolved.error) {
        throw new Error(resolved.error);
      }
      const updated = await uploadFocusEvaluation(resolved.result.id, data);
      setResults((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r)),
      );
      setUploadMessage(
        `Evaluation uploaded for “${updated.title || updated.worksheet_id}”.`,
      );
    } catch (err) {
      setError(err.message || "Could not upload evaluation JSON.");
    } finally {
      setUploading(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  const studentName = localStorage.getItem("studentName");

  return (
    <AppShell
      navLinks={ADMIN_MAIN_NAV}
      onLogout={handleLogout}
    >
      {analysisView === "worksheets" &&
      (practiceWorksheet || practicePanelMode === "builder") ? (
        <div className="sticky top-0 z-30 -mx-6 mb-2 flex flex-wrap items-center gap-2 bg-slate-50 px-6 pb-3 pt-3">
          <button
            type="button"
            onClick={scrollToAnalysisPanel}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition"
          >
            ← Back to analysis
          </button>
          {practicePanelMode === "builder" ? (
            <span className="text-sm font-semibold text-indigo-900">
              Manual practice builder
            </span>
          ) : practiceWorksheet ? (
            <button
              type="button"
              onClick={scrollToPracticePanel}
              className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-900 hover:bg-indigo-100 transition"
            >
              View practice worksheet →
            </button>
          ) : null}
          {selection && practicePanelMode !== "builder" ? (
            <button
              type="button"
              onClick={handleOpenManualBuilder}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition"
            >
              Create manually
            </button>
          ) : null}
        </div>
      ) : null}

      {analysisView === "tests" ? (
        <div className="max-w-7xl">
          <AdminStudentBanner />
          <AdminStudentSwitcher />
          <h1 className="text-2xl font-bold text-slate-950 mb-2">Analysis</h1>
          <AnalysisViewTabs activeView={analysisView} />
          <AdminTestAnalysisView initialAttemptId={initialAttemptId} />
        </div>
      ) : (
      <div
        ref={practiceScrollerRef}
        className="overflow-x-auto scroll-smooth snap-x snap-mandatory pb-4"
      >
        <div className="flex w-[200%] min-w-[200%]">
          <section className="w-1/2 shrink-0 snap-start pr-4 sm:pr-6">
      <div className="max-w-6xl">
          <AdminStudentBanner />
          <AdminStudentSwitcher />

          <h1 className="text-2xl font-bold text-slate-950 mb-2">Analysis</h1>
          <AnalysisViewTabs activeView={analysisView} />
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
            <p className="text-slate-700 text-sm leading-relaxed">
              {studentName
                ? `Focus areas for ${studentName} — from analyzed worksheet results.`
                : "Focus areas from analyzed worksheet results."}
              {" "}
              Use <strong className="font-semibold">Analyze</strong> on the Results page
              for worksheets with specific question area tags. You can still upload
              evaluation JSON here for older worksheets without areas.
            </p>
            {!loading ? (
              <>
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={handleUploadFile}
                />
                <button
                  type="button"
                  onClick={() => uploadInputRef.current?.click()}
                  disabled={uploading}
                  className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 transition disabled:opacity-50"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path d="M12 21V9m0 0l4 4m-4-4l-4-4" />
                    <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
                  </svg>
                  {uploading ? "Uploading…" : "Upload evaluation"}
                </button>
              </>
            ) : null}
          </div>

          <PracticeNoticeBanner
            notice={practiceNotice}
            onGeneratePractice={handleGeneratePractice}
            onCreateManual={selection ? handleOpenManualBuilder : null}
            aiEnabled={aiEnabled}
            apiKeyConfigured={apiKeyConfigured}
            generatingPractice={generatingPractice}
          />

          {uploadMessage && (
            <p className="text-green-700 text-sm mb-4">
              {uploadMessage}
              {uploadMessage.includes("Admin → Settings") ? (
                <>
                  {" "}
                  <Link to="/admin/settings" className="font-semibold underline">
                    Open Settings
                  </Link>
                </>
              ) : null}
            </p>
          )}

          {loading && <QuillLoading label="Loading analysis…" />}
          {error && <p className="text-red-600 text-sm">{error}</p>}

          {!loading && !error && results.length === 0 && (
            <p className="text-slate-600">
              No submissions yet — analysis will appear after worksheets are graded.
            </p>
          )}

          {!loading && !error && results.length > 0 && uploadedCount === 0 && (
            <p className="text-slate-600">
              No analyzed results yet — use Analyze on the Results page after a
              worksheet is graded, or upload evaluation JSON for untagged worksheets.
            </p>
          )}

          {!loading && !error && bySubject.length > 0 && (
            <div className="grid gap-6 items-start grid-cols-1 lg:grid-cols-3">
              <div className="lg:col-span-1">
                <div className="flex flex-col gap-4">
                  {bySubject.map((subject) => (
                    <SubjectBlock
                      key={subject.subjectKey}
                      subject={subject}
                      selectedKey={selectedKey}
                      onSelectArea={handleSelectArea}
                    />
                  ))}
                </div>
              </div>
              <div className="lg:col-span-2 lg:sticky lg:top-6">
                {selection ? (
                  <FocusAreaDetailPanel
                    selection={selection}
                    selectionKey={selectedKey}
                    onMarkDiscussed={handleMarkDiscussed}
                    markingDiscussed={markingDiscussed}
                    generatingPractice={generatingPractice}
                    generatePracticeOnComplete={generatePracticeOnComplete}
                    onGeneratePracticeOnCompleteChange={setGeneratePracticeOnComplete}
                    grade={studentGrade}
                    aiEnabled={aiEnabled}
                    apiKeyConfigured={apiKeyConfigured}
                  />
                ) : (
                  <FocusAreaDetailPlaceholder />
                )}
              </div>
            </div>
          )}
        </div>
          </section>

          <section className="w-1/2 shrink-0 snap-start pl-4 sm:pl-6">
            {practicePanelMode === "builder" && builderSelection ? (
              <FocusPracticeBuilder
                subject={builderSelection.subject.subjectKey}
                subjectLabel={builderSelection.subject.subjectLabel}
                focusArea={builderSelection.focus.area}
                focusAreaLabel={formatAreaLabel(builderSelection.focus.area)}
                grade={studentGrade}
                onSave={handleSaveManualPractice}
                onCancel={handleCancelManualBuilder}
                saving={savingManualPractice}
              />
            ) : practiceWorksheet ? (
              <FocusPracticeWorksheet worksheet={practiceWorksheet} />
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-12 min-h-[22rem] flex flex-col justify-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Focus practice
                </p>
                <h2 className="text-xl font-semibold text-slate-500 mt-2">
                  Worksheet appears here
                </h2>
                <p className="text-sm text-slate-500 mt-3 leading-relaxed max-w-md">
                  When you mark a focus area discussion complete, an AI practice worksheet
                  is generated here (if an API key is configured). You can also build
                  questions manually from the notification banner.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
      )}
    </AppShell>
  );
}
