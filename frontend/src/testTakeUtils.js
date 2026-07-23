/** Navigation rules for contextual tests (RC passages, data sets, etc.). */

export function slotHasPassageContext(slot, isRc) {
  if (isRc) return true;
  return Boolean(slot?.question?.passage);
}

export function isContextualTest(session) {
  if (!session) return false;
  if (session.is_rc) return true;
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

export function buildContextGroups(slots, isRc) {
  if (isRc) {
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

  if (session.is_rc) {
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

export function canNavigateToTestSlot(session, targetSlot, currentSlot) {
  if (!session) return false;
  const slots = session.slots || [];
  const target = slots.find((slot) => slot.slot === targetSlot);
  if (!target?.assigned) return false;
  if (targetSlot <= currentSlot) return true;
  if (!isContextualTest(session)) return true;
  return targetSlot <= maxNavigableSlot(session);
}

export function isCurrentContextUnitComplete(session, slotData, passageResponses, currentSlot) {
  if (!isContextualTest(session)) return true;
  if (session.is_rc) {
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
  if (session.is_rc) {
    const count = questionsPerPassage || slotData?.questions?.length || 0;
    return count
      ? `Answer all ${count} questions in this passage before moving on.`
      : "Answer all questions in this passage before moving on.";
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
