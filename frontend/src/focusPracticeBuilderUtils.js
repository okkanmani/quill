import { CHOICE_LABELS } from "./questionBuilderUtils";

export const FOCUS_PRACTICE_STAR_OPTIONS = [
  { value: 2, label: "★★ Medium" },
  { value: 3, label: "★★★ Hard" },
];

export function emptyFocusPracticeQuestion(stars = 2) {
  return {
    prompt: "",
    choices: ["", "", "", ""],
    correctIndex: 0,
    stars,
  };
}

export function isFocusPracticeQuestionComplete(question) {
  if (!question.prompt.trim()) return false;
  const choices = question.choices.map((c) => c.trim());
  if (choices.some((c) => !c)) return false;
  if (new Set(choices.map((c) => c.toLowerCase())).size !== 4) return false;
  return true;
}

export function validateFocusPracticeBuilder({ title, questions }) {
  const errors = [];
  if (!questions.length) {
    errors.push("Add at least one question.");
    return errors;
  }
  questions.forEach((question, index) => {
    const label = `Question ${index + 1}`;
    if (!question.prompt.trim()) {
      errors.push(`${label}: enter a prompt.`);
      return;
    }
    const choices = question.choices.map((c) => c.trim());
    if (choices.some((c) => !c)) {
      errors.push(`${label}: fill in all four choices.`);
      return;
    }
    if (new Set(choices.map((c) => c.toLowerCase())).size !== 4) {
      errors.push(`${label}: choices must be unique.`);
    }
  });
  if (title && title.length > 200) {
    errors.push("Title must be at most 200 characters.");
  }
  return errors;
}

export function buildManualFocusPracticePayload({
  subject,
  area,
  grade,
  title,
  questions,
}) {
  return {
    subject,
    area,
    grade: grade || undefined,
    title: title.trim() || undefined,
    questions: questions.map((question) => ({
      prompt: question.prompt.trim(),
      choices: question.choices.map((c) => c.trim()),
      answer: question.choices[question.correctIndex].trim(),
      stars: question.stars,
    })),
  };
}

export { CHOICE_LABELS };
