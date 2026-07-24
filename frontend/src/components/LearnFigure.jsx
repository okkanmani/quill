import {
  isLegacyLearnImage,
  learnFigureClassName,
  learnImageStyleVars,
  parseLearnImageTitle,
} from "../learnImagePresets";
import { resolveLearnImageSrcForPreview } from "../learnPendingImages";

export default function LearnFigure({ src, alt, title, caption, eager }) {
  const resolvedSrc = resolveLearnImageSrcForPreview(src);
  const parsed = parseLearnImageTitle(title);
  const legacy = isLegacyLearnImage(title);
  const captionText = (caption || "").trim();

  const img = (
    <img
      src={resolvedSrc}
      alt={alt || ""}
      title={legacy ? title || undefined : undefined}
      loading={eager ? "eager" : "lazy"}
      className="learn-figure__img"
    />
  );

  if (legacy) {
    const frame = (
      <div className="learn-figure learn-figure--legacy learn-figure--block">{img}</div>
    );
    if (!captionText) {
      return (
        <figure className="learn-figure learn-figure--legacy learn-figure--block">{img}</figure>
      );
    }
    return (
      <figure className="learn-figure-group learn-figure-group--block learn-figure-group--legacy">
        {frame}
        <figcaption className="learn-figure__caption">{captionText}</figcaption>
      </figure>
    );
  }

  const { size, layout, shape } = parsed;
  const className = learnFigureClassName(size, layout, shape);
  const style = learnImageStyleVars(size, shape);

  const frame = (
    <figure className={className} style={style}>
      {img}
    </figure>
  );

  if (!captionText) {
    return frame;
  }

  return (
    <figure
      className={`learn-figure-group learn-figure-group--${layout}`}
      style={style}
    >
      <div className={`${className} learn-figure--in-group`}>{img}</div>
      <figcaption className="learn-figure__caption">{captionText}</figcaption>
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
