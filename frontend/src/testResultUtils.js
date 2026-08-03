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
