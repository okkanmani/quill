import {
  isLegacyLearnImage,
  learnFigureClassName,
  learnImageStyleVars,
  parseLearnImageTitle,
} from "../learnImagePresets";
import { resolveLearnImageSrcForPreview } from "../learnPendingImages";

export default function LearnFigure({ src, alt, title, eager }) {
  const resolvedSrc = resolveLearnImageSrcForPreview(src);
  const parsed = parseLearnImageTitle(title);
  const legacy = isLegacyLearnImage(title);

  if (legacy) {
    return (
      <figure className="learn-figure learn-figure--legacy learn-figure--block">
        <img
          src={resolvedSrc}
          alt={alt || ""}
          title={title || undefined}
          loading={eager ? "eager" : "lazy"}
          className="learn-figure__img"
        />
      </figure>
    );
  }

  const { size, layout, shape } = parsed;
  const className = learnFigureClassName(size, layout, shape);
  const style = learnImageStyleVars(size, shape);

  return (
    <figure className={className} style={style}>
      <img
        src={resolvedSrc}
        alt={alt || ""}
        loading={eager ? "eager" : "lazy"}
        className="learn-figure__img"
      />
    </figure>
  );
}

LearnFigure.displayName = "LearnFigure";

export function isLearnFigureElement(element) {
  return (
    element &&
    typeof element === "object" &&
    element.type?.displayName === "LearnFigure"
  );
}
