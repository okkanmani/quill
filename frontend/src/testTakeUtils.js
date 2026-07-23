/** Navigation rules for contextual tests (RC passages, data sets, etc.). */

export function isPassageWindowSession(session) {
  return Boolean(session?.is_passage_window ?? session?.is_rc);
}

export function slotHasPassageContext(slot, isPassageWindow) {
  if (isPassageWindow) return true;
  return Boolean(slot?.question?.passage);
}

export function isContextualTest(session) {
  if (!session) return false;
  if (isPassageWindowSession(session)) return true;
  return (session.slots || []).some((slot) => slotHasPassageContext(slot, false));
}

export function isRcSlotComplete(slot, passageResponses = {}) {
  if (slot?.answered) return true;
  const questions = slot?.questions || [];
  if (!questions.length) return false;
  const saved = slot?.responses || {};
  return questions.every((question) => {
    const choice = passageResponses[question.id] ?? saved[question.id] ?? "";
    return Boolean(String(choice).trim());
  });
}

export function buildContextGroups(slots, isPassageWindow) {
  if (isPassageWindow) {
    return (slots || [])
      .filter((slot) => slot.assigned)
      .map((slot) => ({
        slots: [slot.slot],
        hasContext: true,
      }));
  }

  const groups = [];
  let current = null;
  for (const slot of slots || []) {
    if (!slot.assigned) continue;
    const passageId = slot.question?.passage?.id || slot.question?.passage_id || null;
    const hasContext = Boolean(passageId || slot.question?.passage);
    if (!hasContext) {
      if (current) {
        groups.push(current);
        current = null;
      }
      continue;
    }
    const key = passageId || `slot-${slot.slot}`;
    if (current && current.key === key) {
      current.slots.push(slot.slot);
    } else {
      if (current) groups.push(current);
      current = { key, slots: [slot.slot], hasContext: true };
    }
  }
  if (current) groups.push(current);
  return groups;
}

export function maxNavigableSlot(session) {
  const slots = session?.slots || [];
  const sittingCount = session?.sitting_count || slots.length;
  if (!isContextualTest(session)) return sittingCount;

  if (isPassageWindowSession(session)) {
    for (const slot of slots) {
      if (!slot.assigned) continue;
      if (!slot.answered) return slot.slot;
    }
    return sittingCount;
  }

  const groups = buildContextGroups(slots, false);
  for (const group of groups) {
    const complete = group.slots.every((slotNumber) => {
      const slot = slots.find((item) => item.slot === slotNumber);
      return Boolean(slot?.answered);
    });
    if (!complete) return Math.max(...group.slots);
  }
  return sittingCount;
}

export function canNavigateToRcSlot(session, targetSlot) {
  const slots = session?.slots || [];
  const target = slots.find((slot) => slot.slot === targetSlot);
  if (!target?.assigned) return false;
  if (target.answered) return true;
  return targetSlot === maxNavigableSlot(session);
}

export function canNavigateToTestSlot(session, targetSlot, currentSlot) {
  if (!session) return false;
  const slots = session.slots || [];
  const target = slots.find((slot) => slot.slot === targetSlot);
  if (!target?.assigned) return false;
  if (isPassageWindowSession(session)) {
    return canNavigateToRcSlot(session, targetSlot);
  }
  if (targetSlot <= currentSlot) return true;
  if (!isContextualTest(session)) return true;
  return targetSlot <= maxNavigableSlot(session);
}

export function isCurrentContextUnitComplete(session, slotData, passageResponses, currentSlot) {
  if (!isContextualTest(session)) return true;
  if (isPassageWindowSession(session)) {
    return isRcSlotComplete(slotData, passageResponses);
  }

  const groups = buildContextGroups(session.slots || [], false);
  const group = groups.find((item) => item.slots.includes(currentSlot));
  if (!group) return Boolean(slotData?.answered);

  return group.slots.every((slotNumber) => {
    const slot = (session.slots || []).find((item) => item.slot === slotNumber);
    return Boolean(slot?.answered);
  });
}

export function contextualAdvanceHint(session, slotData, questionsPerPassage) {
  if (!isContextualTest(session)) return "";
  const isData = session?.subject === "data";
  const unit = isData ? "data set" : "passage";
  if (isPassageWindowSession(session)) {
    const count = questionsPerPassage || slotData?.questions?.length || 0;
    return count
      ? `Answer all ${count} questions in this ${unit} before moving on.`
      : `Answer all questions in this ${unit} before moving on.`;
  }
  const groups = buildContextGroups(session.slots || [], false);
  const group = groups.find((item) => item.slots.includes(slotData?.slot));
  if (group && group.slots.length > 1) {
    return "Answer all questions for this passage or data set before moving on.";
  }
  if (slotData?.question?.passage) {
    return "Answer this question before moving on.";
  }
  return "";
}

export function testTakeUnitLabels(session) {
  const isData = session?.subject === "data";
  return {
    singular: isData ? "data set" : "passage",
    plural: isData ? "data sets" : "passages",
    capitalized: isData ? "Data set" : "Passage",
    navigator: isData ? "Data set navigator" : "Passage navigator",
    questionsHeading: isData ? "Questions for this data set" : "Questions for this passage",
  };
}
