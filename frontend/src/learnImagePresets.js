/** Preset learn image sizes, layouts, and frame shapes. */

/** Landscape frame at scale 1 (rem). Other shapes use the same scale multipliers. */
export const LEARN_IMAGE_SHAPE_BASE = {
  landscape: { widthRem: 12, heightRem: 9 },
  square: { widthRem: 10, heightRem: 10 },
  portrait: { widthRem: 9, heightRem: 12 },
};

export const LEARN_IMAGE_SIZE_SCALE = {
  small: 1,
  medium: 1.5,
  large: 3,
};

export const LEARN_IMAGE_SIZES = [
  { id: "small", label: "Small" },
  { id: "medium", label: "Medium" },
  { id: "large", label: "Large" },
];

export const LEARN_IMAGE_SHAPES = [
  { id: "landscape", label: "Landscape" },
  { id: "square", label: "Square" },
  { id: "portrait", label: "Portrait" },
];

export const LEARN_IMAGE_LAYOUTS = [
  { id: "block", label: "Block (text above/below)" },
  { id: "text-right", label: "Image left, text right" },
  { id: "text-left", label: "Image right, text left" },
];

const TITLE_RE =
  /^learn:(small|medium|large):(block|text-right|text-left)(?::(square|landscape|portrait))?$/;

export function serializeLearnImageTitle(size, layout, shape) {
  const effective = normalizeLearnImageOptions(size, layout, shape);
  return `learn:${effective.size}:${effective.layout}:${effective.shape}`;
}

export function parseLearnImageTitle(title) {
  const m = TITLE_RE.exec(String(title || "").trim());
  if (!m) return null;
  return normalizeLearnImageOptions(m[1], m[2], m[3]);
}

export function normalizeLearnImageOptions(size, layout, shape) {
  const normalizedSize = LEARN_IMAGE_SIZE_SCALE[size] ? size : "medium";
  let lay = LEARN_IMAGE_LAYOUTS.some((option) => option.id === layout) ? layout : "block";
  if (normalizedSize === "large") {
    lay = "block";
  }
  const normalizedShape = LEARN_IMAGE_SHAPES.some((option) => option.id === shape)
    ? shape
    : "landscape";
  return { size: normalizedSize, layout: lay, shape: normalizedShape };
}

export function layoutOptionsForSize(size) {
  if (size === "large") {
    return LEARN_IMAGE_LAYOUTS.filter((option) => option.id === "block");
  }
  return LEARN_IMAGE_LAYOUTS;
}

export function learnImageStyleVars(size, shape) {
  const { size: s, shape: sh } = normalizeLearnImageOptions(size, "block", shape);
  const scale = LEARN_IMAGE_SIZE_SCALE[s] ?? LEARN_IMAGE_SIZE_SCALE.medium;
  const base = LEARN_IMAGE_SHAPE_BASE[sh] ?? LEARN_IMAGE_SHAPE_BASE.landscape;
  return {
    "--learn-img-w": `${base.widthRem * scale}rem`,
    "--learn-img-h": `${base.heightRem * scale}rem`,
  };
}

export function learnFigureClassName(size, layout, shape) {
  const { size: s, layout: l, shape: sh } = normalizeLearnImageOptions(
    size,
    layout,
    shape,
  );
  return `learn-figure learn-figure--${s} learn-figure--${l} learn-figure--shape-${sh}`;
}

/** Images published before presets: full-width block. */
export function isLegacyLearnImage(title) {
  return !parseLearnImageTitle(title);
}
