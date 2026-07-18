import { useCallback, useEffect, useRef } from "react";

const BUILDER_ANCHOR_RATIO = 0.32;
const VIEWPORT_EDGE_PADDING = 80;

function pickClosestElement(elements, anchorY) {
  let bestKey = null;
  let bestDistance = Infinity;

  for (const [key, element] of elements) {
    const rect = element.getBoundingClientRect();
    if (rect.bottom < VIEWPORT_EDGE_PADDING) continue;
    if (rect.top > window.innerHeight - VIEWPORT_EDGE_PADDING) continue;

    const center = rect.top + rect.height / 2;
    const distance = Math.abs(center - anchorY);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestKey = key;
    }
  }

  return bestKey;
}

export function usePreviewScrollSync({
  enabled,
  onFocusQuestion,
  onFocusPassage,
  resyncKey = 0,
}) {
  const questionElementsRef = useRef(new Map());
  const passageElementsRef = useRef(new Map());
  const rafRef = useRef(null);
  const lastQuestionRef = useRef(null);
  const lastPassageRef = useRef(null);

  const registerQuestion = useCallback((index, node) => {
    if (node) questionElementsRef.current.set(index, node);
    else questionElementsRef.current.delete(index);
  }, []);

  const registerPassage = useCallback((passageId, node) => {
    if (node) passageElementsRef.current.set(passageId, node);
    else passageElementsRef.current.delete(passageId);
  }, []);

  const markQuestionFocused = useCallback((index) => {
    lastQuestionRef.current = index;
    lastPassageRef.current = null;
  }, []);

  const markPassageFocused = useCallback((passageId) => {
    lastPassageRef.current = passageId;
    lastQuestionRef.current = null;
  }, []);

  const updateActiveFromScroll = useCallback(() => {
    const anchorY = window.innerHeight * BUILDER_ANCHOR_RATIO;
    const questionKey = pickClosestElement(questionElementsRef.current, anchorY);

    if (questionKey != null) {
      if (lastQuestionRef.current !== questionKey) {
        lastQuestionRef.current = questionKey;
        lastPassageRef.current = null;
        onFocusQuestion(questionKey);
      }
      return;
    }

    const passageKey = pickClosestElement(passageElementsRef.current, anchorY);
    if (passageKey != null && lastPassageRef.current !== passageKey) {
      lastPassageRef.current = passageKey;
      lastQuestionRef.current = null;
      onFocusPassage(passageKey);
    }
  }, [onFocusPassage, onFocusQuestion]);

  useEffect(() => {
    if (!enabled) {
      lastQuestionRef.current = null;
      lastPassageRef.current = null;
      return undefined;
    }

    const handleScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateActiveFromScroll);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [enabled, resyncKey, updateActiveFromScroll]);

  return { registerQuestion, registerPassage, markQuestionFocused, markPassageFocused };
}
