/** Helpers for rendering completed test answers in results views. */

export function isPassageWindowAnswer(answer) {
  return (
    Array.isArray(answer?.questions) &&
    answer.questions.length > 0 &&
    (answer.passage_id != null || answer.responses != null)
  );
}

export function buildPassageLookup(worksheet) {
  const lookup = {};
  for (const passage of worksheet?.passages || []) {
    if (passage?.id) lookup[String(passage.id)] = passage;
  }
  return lookup;
}

export function buildQuestionPassageLookup(worksheet) {
  const passageLookup = buildPassageLookup(worksheet);
  const lookup = {};
  for (const question of worksheet?.questions || []) {
    const questionId = question?.id;
    const passageId = question?.passage_id;
    if (!questionId || !passageId) continue;
    const passage = passageLookup[String(passageId)];
    if (passage) lookup[String(questionId)] = passage;
  }
  return lookup;
}

export function resolveAnswerPassage(
  answer,
  passageLookup = {},
  questionPassageLookup = {},
) {
  if (answer?.passage) return answer.passage;
  const passageId = answer?.passage_id;
  if (passageId && passageLookup[String(passageId)]) {
    return passageLookup[String(passageId)];
  }
  const questionId = answer?.question_id;
  if (questionId && questionPassageLookup[String(questionId)]) {
    return questionPassageLookup[String(questionId)];
  }
  return null;
}

export function passageWindowUnitLabel(subject) {
  return subject === "data" ? "Data set" : "Passage";
}

export function contextCenteredForPassage(passage, subject) {
  return (
    subject === "data" ||
    Boolean(passage?.chart?.type || passage?.table?.headers?.length)
  );
}

/** Group worksheet result answers by shared passage context, preserving order. */
export function groupWorksheetAnswers(answers, worksheet) {
  const items = Array.isArray(answers) ? answers : [];
  if (!worksheet?.passages?.length) {
    return items.map((answer, index) => ({
      kind: "question",
      answer,
      number: index + 1,
    }));
  }

  const questionPassageLookup = buildQuestionPassageLookup(worksheet);
  const groups = [];
  let currentPassageGroup = null;
  let questionNumber = 0;

  for (const answer of items) {
    const passage = questionPassageLookup[String(answer.question_id)];
    if (passage) {
      const passageId = String(passage.id);
      if (currentPassageGroup?.passageId === passageId) {
        currentPassageGroup.answers.push(answer);
      } else {
        if (currentPassageGroup) groups.push(currentPassageGroup);
        currentPassageGroup = {
          kind: "passage",
          passageId,
          passage,
          answers: [answer],
        };
      }
      continue;
    }

    if (currentPassageGroup) {
      groups.push(currentPassageGroup);
      currentPassageGroup = null;
    }
    questionNumber += 1;
    groups.push({ kind: "question", answer, number: questionNumber });
  }
  if (currentPassageGroup) groups.push(currentPassageGroup);

  return groups.map((group) => {
    if (group.kind !== "passage") return group;
    const numberedAnswers = group.answers.map((answer) => {
      questionNumber += 1;
      return { answer, number: questionNumber };
    });
    return { ...group, numberedAnswers };
  });
}

export function worksheetHasPassageContext(worksheet) {
  return Boolean(worksheet?.passages?.length);
}

export function missContextKey(miss) {
  if (!miss) return "";
  return String(miss.question_id || miss.question_index || miss.slot || "");
}

/** True when attempt slots include passage-linked questions (RC or data analysis). */
export function attemptUsesPassageContext(attempt) {
  if (attempt?.subject === "data") return true;
  if (
    (attempt?.answers || []).some(
      (answer) =>
        isPassageWindowAnswer(answer) ||
        answer?.passage_id != null ||
        answer?.passage,
    )
  ) {
    return true;
  }
  return (attempt?.slots || []).some((slot) => slot.passage_id);
}

/** Resolve passage/chart/table context for a wrong-answer slot row. */
export function resolveMissPassage(
  attempt,
  miss,
  { passageLookup = {}, questionPassageLookup = {} } = {},
) {
  if (!attempt || !miss) return null;

  const answers = attempt.answers || [];
  const passageId = miss.passage_id != null ? String(miss.passage_id) : "";

  if (passageId) {
    for (const answer of answers) {
      if (String(answer?.passage_id || "") === passageId && answer?.passage) {
        return answer.passage;
      }
    }
    if (passageLookup[passageId]) return passageLookup[passageId];
  }

  const questionId = miss.question_id != null ? String(miss.question_id) : "";
  if (questionId) {
    for (const answer of answers) {
      if (!isPassageWindowAnswer(answer)) continue;
      const matches = (answer.questions || []).some(
        (question) => String(question?.question_id || "") === questionId,
      );
      if (matches && answer.passage) return answer.passage;
    }
    if (questionPassageLookup[questionId]) return questionPassageLookup[questionId];
  }

  return null;
}

/** Flatten test result answers into per-question rows for grading. */
export function flattenTestQuestions(answers) {
  const items = [];
  for (const answer of answers || []) {
    if (isPassageWindowAnswer(answer)) {
      for (const question of answer.questions || []) {
        if (question?.question_id) items.push(question);
      }
    } else if (answer?.question_id) {
      items.push(answer);
    }
  }
  return items;
}

/** Group test result answers for admin grading (passage windows + regular). */
export function groupTestAnswers(answers, worksheet) {
  const items = Array.isArray(answers) ? answers : [];
  const passageLookup = buildPassageLookup(worksheet);
  const questionPassageLookup = buildQuestionPassageLookup(worksheet);
  const groups = [];
  let questionNumber = 0;

  for (const answer of items) {
    if (isPassageWindowAnswer(answer)) {
      const passage = resolveAnswerPassage(answer, passageLookup, questionPassageLookup);
      const numberedAnswers = (answer.questions || [])
        .filter((question) => question?.question_id)
        .map((question) => {
          questionNumber += 1;
          return { answer: question, number: questionNumber };
        });
      groups.push({
        kind: "passage",
        passageId: answer.passage_id,
        passage,
        numberedAnswers,
      });
      continue;
    }

    if (!answer?.question_id) continue;
    questionNumber += 1;
    const passage = resolveAnswerPassage(answer, passageLookup, questionPassageLookup);
    groups.push({
      kind: "question",
      answer,
      number: questionNumber,
      passage,
    });
  }

  return groups;
}
