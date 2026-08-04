import { bulkSaveQuestionBank, saveWorksheetContextToBank } from "./api";
import {
  criticalReasoningDisplayQuestions,
  isCriticalReasoningWorksheetLayout,
  isWorksheetPassageBankReady,
  worksheetPassageToBankPayload,
  worksheetPublishedQuestionToBankPayload,
} from "./worksheetUtils";
import {
  groupTestQuestionsByPassage,
  unassignedTestQuestions,
  isTestQuestionComplete,
  isTestPassageComplete,
  isPassageWindowTest,
  isDataPassageTest,
  testPassageToBankPayload,
  testQuestionToBankPayload,
  testQuestionToContextBankPayload,
  worksheetToTestBuilderState,
} from "./testBuilderUtils";

export function isWorksheetMcqBankReady(question) {
  if (question?.type !== "multiple_choice") return false;
  const choices = (question.choices || []).map((c) => String(c || "").trim());
  if (choices.length !== 4 || !choices.every(Boolean)) return false;
  if (new Set(choices).size !== 4) return false;
  return Boolean(String(question.prompt || "").trim() && String(question.answer || "").trim());
}

export function formatQuestionBankSaveMessage({
  totalCreated,
  totalSkipped,
  passagesCreated,
}) {
  const passageNote =
    passagesCreated > 0
      ? ` ${passagesCreated} passage${passagesCreated === 1 ? "" : "s"} added to the bank.`
      : "";
  if (totalCreated === 0 && totalSkipped > 0) {
    return `All ${totalSkipped} question${totalSkipped === 1 ? "" : "s"} are already in the question bank.${passageNote}`;
  }
  return `Saved ${totalCreated} question${totalCreated === 1 ? "" : "s"} to the question bank.${totalSkipped ? ` ${totalSkipped} duplicate${totalSkipped === 1 ? "" : "s"} skipped.` : ""}${passageNote}`;
}

function worksheetMcqToBulkPayload(question, worksheet) {
  return {
    ...worksheetPublishedQuestionToBankPayload(question),
    stars: Number(question.stars) || Number(worksheet.difficulty_min) || 2,
  };
}

function accumulateSaveResult(
  totals,
  result,
  { countPassage = false } = {},
) {
  totals.totalCreated += result.created_count || 0;
  totals.totalSkipped += result.skipped_duplicate_count || 0;
  if (countPassage && result.created_passage) {
    totals.passagesCreated += 1;
  }
  if (Array.isArray(result.errors) && result.errors.length) {
    totals.saveErrors.push(...result.errors);
  }
}

async function saveTestToQuestionBank(worksheet, { source }) {
  const state = worksheetToTestBuilderState(worksheet);
  const { subject, passages, questions, readingComprehensionEnabled } = state;
  const passageWindowEnabled = isPassageWindowTest(subject, readingComprehensionEnabled);
  const passageMode = isDataPassageTest(subject) ? "data" : "rc";
  const completeQuestions = questions.filter(isTestQuestionComplete);

  if (completeQuestions.length === 0) {
    throw new Error("No complete questions to save to the question bank.");
  }

  const totals = {
    totalCreated: 0,
    totalSkipped: 0,
    passagesCreated: 0,
    saveErrors: [],
  };

  if (passageWindowEnabled) {
    for (const { passage, questions: passageQuestions } of groupTestQuestionsByPassage(
      passages,
      completeQuestions,
    )) {
      const readyQuestions = passageQuestions.filter(isTestQuestionComplete);
      if (readyQuestions.length === 0) continue;

      const passageLabel = passage.title?.trim() || "Untitled passage";
      if (!isTestPassageComplete(passage, passageMode)) {
        totals.saveErrors.push(`${passageLabel}: incomplete passage skipped.`);
        continue;
      }

      const result = await saveWorksheetContextToBank({
        subject,
        stars: Number(passage.tier) || 2,
        source,
        passage: testPassageToBankPayload(passage),
        questions: readyQuestions.map((question) =>
          testQuestionToContextBankPayload(question, passage),
        ),
      });
      accumulateSaveResult(totals, result, { countPassage: true });
    }

    const unassigned = unassignedTestQuestions(passages, completeQuestions).filter(
      isTestQuestionComplete,
    );
    if (unassigned.length > 0) {
      const result = await bulkSaveQuestionBank({
        subject,
        source,
        questions: unassigned.map((question) => {
          const payload = testQuestionToBankPayload(question, subject, null, passages);
          delete payload.passage_id;
          return payload;
        }),
      });
      accumulateSaveResult(totals, result);
    }
  } else {
    const result = await bulkSaveQuestionBank({
      subject,
      source,
      questions: completeQuestions.map((question) =>
        testQuestionToBankPayload(question, subject, null, passages),
      ),
    });
    accumulateSaveResult(totals, result);
  }

  if (totals.saveErrors.length && totals.totalCreated === 0 && totals.totalSkipped === 0) {
    throw new Error(totals.saveErrors.join(" "));
  }

  return {
    totalCreated: totals.totalCreated,
    totalSkipped: totals.totalSkipped,
    passagesCreated: totals.passagesCreated,
    errors: totals.saveErrors,
    message: formatQuestionBankSaveMessage(totals),
  };
}

async function saveWorksheetContentToQuestionBank(worksheet, { source }) {
  const subject = worksheet.subject;
  const passages = worksheet.passages || [];
  const questions = worksheet.questions || [];
  const crLayout = isCriticalReasoningWorksheetLayout(worksheet);
  const hasReadingPassages = passages.length > 0 && !crLayout;

  const totals = {
    totalCreated: 0,
    totalSkipped: 0,
    passagesCreated: 0,
    saveErrors: [],
  };

  if (crLayout) {
    const ready = criticalReasoningDisplayQuestions(worksheet).filter(isWorksheetMcqBankReady);
    if (ready.length === 0) {
      throw new Error("No bank-ready multiple-choice questions.");
    }
    const result = await bulkSaveQuestionBank({
      subject,
      source,
      questions: ready.map((question) => worksheetMcqToBulkPayload(question, worksheet)),
    });
    accumulateSaveResult(totals, result);
    return {
      totalCreated: totals.totalCreated,
      totalSkipped: totals.totalSkipped,
      passagesCreated: totals.passagesCreated,
      errors: totals.saveErrors,
      message: formatQuestionBankSaveMessage(totals),
    };
  }

  if (hasReadingPassages) {
    for (const [index, passage] of passages.entries()) {
      const passageId = passage.id || `p${index + 1}`;
      const passageQuestions = questions.filter((q) => q.passage_id === passageId);
      const mcqQuestions = passageQuestions.filter(isWorksheetMcqBankReady);
      if (mcqQuestions.length === 0) continue;

      const passageLabel = passage.title?.trim() || "Untitled passage";
      if (!isWorksheetPassageBankReady(passage)) {
        totals.saveErrors.push(`${passageLabel}: incomplete passage skipped.`);
        continue;
      }

      const result = await saveWorksheetContextToBank({
        subject,
        stars: Number(mcqQuestions[0]?.stars) || Number(worksheet.difficulty_min) || 2,
        source,
        passage: worksheetPassageToBankPayload(passage),
        questions: mcqQuestions.map(worksheetPublishedQuestionToBankPayload),
      });
      accumulateSaveResult(totals, result, { countPassage: true });
    }

    const passageIds = new Set(
      passages.map((passage, index) => passage.id || `p${index + 1}`),
    );
    const unassigned = questions
      .filter((q) => !q.passage_id || !passageIds.has(q.passage_id))
      .filter(isWorksheetMcqBankReady);
    if (unassigned.length > 0) {
      const result = await bulkSaveQuestionBank({
        subject,
        source,
        questions: unassigned.map((question) => worksheetMcqToBulkPayload(question, worksheet)),
      });
      accumulateSaveResult(totals, result);
    }
  } else {
    const ready = questions.filter(isWorksheetMcqBankReady);
    if (ready.length === 0) {
      throw new Error("No bank-ready multiple-choice questions.");
    }
    const result = await bulkSaveQuestionBank({
      subject,
      source,
      questions: ready.map((question) => worksheetMcqToBulkPayload(question, worksheet)),
    });
    accumulateSaveResult(totals, result);
  }

  if (totals.saveErrors.length && totals.totalCreated === 0 && totals.totalSkipped === 0) {
    throw new Error(totals.saveErrors.join(" "));
  }

  return {
    totalCreated: totals.totalCreated,
    totalSkipped: totals.totalSkipped,
    passagesCreated: totals.passagesCreated,
    errors: totals.saveErrors,
    message: formatQuestionBankSaveMessage(totals),
  };
}

export async function saveWorksheetOrTestToQuestionBank(worksheet, { source = "imported" } = {}) {
  if (!worksheet || typeof worksheet !== "object") {
    throw new Error("Worksheet not found.");
  }
  if (worksheet.is_test) {
    return saveTestToQuestionBank(worksheet, { source });
  }
  return saveWorksheetContentToQuestionBank(worksheet, { source });
}
