import { createContext, useContext, useLayoutEffect, useRef, useState } from "react";
import LearnMarkdown from "./LearnMarkdown";
import LearnHighlightToolbar from "./LearnHighlightToolbar";
import {
  applyHighlightsToContainer,
  removeHighlightMark,
  selectionTouchesExistingHighlight,
  serializeHighlight,
  wrapRangeWithHighlight,
} from "../learnHighlightUtils";

const LearnPageHighlighterContext = createContext(null);

function LearnPageHighlighterProvider({
  highlights,
  onHighlightsChange,
  readOnly = false,
  enabled = true,
  showToolbar = true,
  activeColor,
  onActiveColorChange,
  eraserActive,
  onEraserActiveChange,
  children,
}) {
  const contentRef = useRef(null);
  const applyingRef = useRef(false);
  const [localColor, setLocalColor] = useState("orange");
  const [localEraser, setLocalEraser] = useState(false);
  const resolvedColor = activeColor ?? localColor;
  const resolvedEraser = eraserActive ?? localEraser;
  const setResolvedColor = onActiveColorChange ?? setLocalColor;
  const setResolvedEraser = onEraserActiveChange ?? setLocalEraser;
  const interactive = enabled && !readOnly;
  const toolbarDisabled = !interactive;

  useLayoutEffect(() => {
    const container = contentRef.current;
    if (!container) return undefined;

    applyingRef.current = true;
    applyHighlightsToContainer(container, highlights);
    applyingRef.current = false;
    return undefined;
  }, [highlights]);

  function addHighlight(nextHighlight) {
    onHighlightsChange([...(highlights || []), nextHighlight]);
  }

  function removeHighlightById(id) {
    if (!id) return;
    onHighlightsChange((highlights || []).filter((item) => item.id !== id));
  }

  function handleMouseUp() {
    if (!interactive || resolvedEraser || applyingRef.current) return;

    const container = contentRef.current;
    const selection = window.getSelection();
    if (!container || !selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (range.collapsed || !container.contains(range.commonAncestorContainer)) {
      return;
    }
    if (selectionTouchesExistingHighlight(range)) {
      selection.removeAllRanges();
      return;
    }

    const nextHighlight = serializeHighlight(container, range, resolvedColor);
    if (!nextHighlight.exact.trim()) {
      selection.removeAllRanges();
      return;
    }

    wrapRangeWithHighlight(range, nextHighlight.color, nextHighlight.id);
    addHighlight(nextHighlight);
    selection.removeAllRanges();
  }

  function handleClick(event) {
    if (!interactive || !resolvedEraser) return;
    const mark = event.target.closest?.("mark.learn-hl");
    const container = contentRef.current;
    if (!mark || !container?.contains(mark)) return;

    event.preventDefault();
    const id = removeHighlightMark(mark);
    if (id) removeHighlightById(id);
  }

  const value = {
    contentRef,
    interactive,
    showToolbar: enabled && showToolbar,
    toolbarDisabled,
    activeColor: resolvedColor,
    setActiveColor: setResolvedColor,
    eraserActive: resolvedEraser,
    setEraserActive: setResolvedEraser,
    handleMouseUp,
    handleClick,
  };

  return (
    <LearnPageHighlighterContext.Provider value={value}>
      {children}
    </LearnPageHighlighterContext.Provider>
  );
}

function useLearnPageHighlighter() {
  const value = useContext(LearnPageHighlighterContext);
  if (!value) {
    throw new Error("Learn page highlighter components must be used within LearnPageHighlighter.");
  }
  return value;
}

export function LearnPageHighlightToolbarSlot({ disabledHint = "" }) {
  const {
    showToolbar,
    toolbarDisabled,
    activeColor,
    setActiveColor,
    eraserActive,
    setEraserActive,
  } = useLearnPageHighlighter();

  if (!showToolbar) return null;

  return (
    <LearnHighlightToolbar
      activeColor={activeColor}
      onActiveColorChange={setActiveColor}
      eraserActive={eraserActive}
      onEraserActiveChange={setEraserActive}
      disabled={toolbarDisabled}
      disabledHint={disabledHint}
    />
  );
}

export function LearnPageHighlightMarkdown({ markdown }) {
  const { contentRef, interactive, handleMouseUp, handleClick } =
    useLearnPageHighlighter();

  return (
    <div
      ref={contentRef}
      className={`learn-md learn-highlight-area${interactive ? " learn-highlight-area--interactive" : ""}`}
      {...(interactive
        ? {
            onMouseUp: handleMouseUp,
            onClick: handleClick,
          }
        : {})}
    >
      <LearnMarkdown markdown={markdown} />
    </div>
  );
}

export default function LearnPageHighlighter(props) {
  return (
    <LearnPageHighlighterProvider {...props}>
      {props.children}
    </LearnPageHighlighterProvider>
  );
}
