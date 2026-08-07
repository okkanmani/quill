import { useId } from "react";

const SIZE_PRESETS = {
  sm: { mark: 24, word: "text-[15px]", gap: "gap-1.5" },
  md: { mark: 28, word: "text-xl", gap: "gap-2" },
  lg: { mark: 56, word: "text-5xl", gap: "gap-3" },
};

/** Full asset bounds (shadow included) — loading spinner. */
const VIEWBOX_FULL = "0 0 168 168";
/** Tighter crop for app-icon beside wordmark (unused when variant=nib). */
const VIEWBOX_LOCKUP = "22 10 124 128";
/** Nib-only crop. */
const VIEWBOX_NIB = "52 40 64 64";

const NIB_PATH =
  "M101.998 74.9976L97.8726 54.3756C97.7604 53.8146 97.4901 53.2973 97.0936 52.8848C96.697 52.4723 96.1908 52.1818 95.6346 52.0476L57.7026 42.0816C57.2029 41.9608 56.6805 41.9704 56.1856 42.1096C55.6907 42.2487 55.2398 42.5127 54.8763 42.8763C54.5127 43.2398 54.2487 43.6907 54.1096 44.1856C53.9704 44.6805 53.9608 45.2029 54.0816 45.7026L64.0476 83.6346C64.1818 84.1908 64.4723 84.697 64.8848 85.0936C65.2973 85.4901 65.8146 85.7604 66.3756 85.8726L86.9976 89.9976M54.897 42.897L76.755 64.755M95.1181 99.8761C94.5556 100.439 93.7926 100.755 92.9971 100.755C92.2017 100.755 91.4387 100.439 90.8761 99.8761L86.1181 95.1181C85.5557 94.5556 85.2398 93.7926 85.2398 92.9971C85.2398 92.2017 85.5557 91.4387 86.1181 90.8761L102.876 74.1181C103.439 73.5557 104.202 73.2398 104.997 73.2398C105.793 73.2398 106.556 73.5557 107.118 74.1181L111.876 78.8761C112.439 79.4387 112.755 80.2017 112.755 80.9971C112.755 81.7926 112.439 82.5556 111.876 83.1181L95.1181 99.8761ZM86.9976 68.9976C86.9976 72.3113 84.3113 74.9976 80.9976 74.9976C77.6839 74.9976 74.9976 72.3113 74.9976 68.9976C74.9976 65.6839 77.6839 62.9976 80.9976 62.9976C84.3113 62.9976 86.9976 65.6839 86.9976 68.9976Z";

function QuillGradient({ id }) {
  return (
    <linearGradient
      id={id}
      x1="53.9976"
      y1="41.9976"
      x2="112.755"
      y2="41.9976"
      gradientUnits="userSpaceOnUse"
    >
      <stop stopColor="#00F5FF" />
      <stop offset="1" stopColor="#2E5BFF" />
    </linearGradient>
  );
}

function QuillNib({ gradId, animate = false, strokeWidth = 2 }) {
  return (
    <g className={animate ? "quill-loading-nib" : undefined}>
      <path
        d={NIB_PATH}
        stroke={`url(#${gradId})`}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </g>
  );
}

/**
 * Quill mark — `nib` for headers/login, `app-icon` for loading spinner & favicon.
 */
export function QuillMark({
  size = 24,
  className = "",
  variant = "app-icon",
  crop = "full",
  animateNib = false,
}) {
  const uid = useId().replace(/:/g, "");
  const filterId = `quill-icon-filter-${uid}`;
  const gradId = `quill-icon-grad-${uid}`;

  if (variant === "nib") {
    return (
      <svg
        width={size}
        height={size}
        viewBox={VIEWBOX_NIB}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`block shrink-0 ${className}`.trim()}
        aria-hidden
      >
        <defs>
          <QuillGradient id={gradId} />
        </defs>
        <QuillNib gradId={gradId} strokeWidth={2.25} />
      </svg>
    );
  }

  const viewBox = crop === "lockup" ? VIEWBOX_LOCKUP : VIEWBOX_FULL;

  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`block shrink-0 ${className}`.trim()}
      aria-hidden
    >
      <defs>
        <filter
          id={filterId}
          x="0"
          y="0"
          width="168"
          height="168"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dy="12" />
          <feGaussianBlur stdDeviation="12" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0.960784 0 0 0 0 1 0 0 0 0.14902 0"
          />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
        </filter>
        <QuillGradient id={gradId} />
      </defs>
      <g filter={`url(#${filterId})`}>
        <rect
          x="24"
          y="12"
          width="120"
          height="120"
          rx="28"
          fill="#0E0D1F"
          shapeRendering="crispEdges"
        />
        <rect
          x="25"
          y="13"
          width="118"
          height="118"
          rx="27"
          stroke="#2E5BFF"
          strokeOpacity="0.302"
          strokeWidth="2"
          shapeRendering="crispEdges"
        />
      </g>
      <QuillNib gradId={gradId} animate={animateNib} />
    </svg>
  );
}

/**
 * Quill brand lockup: nib mark + Exo 2 wordmark (all caps).
 * Wordmark uses `--quill-brand-font`, independent of user content font.
 */
export default function QuillLogo({
  size = "md",
  showWordmark = true,
  className = "",
  markClassName = "",
  wordmarkClassName = "",
}) {
  const preset = SIZE_PRESETS[size] || SIZE_PRESETS.md;

  return (
    <div
      className={`quill-brand-lockup inline-flex items-center ${preset.gap} ${className}`.trim()}
      aria-label={showWordmark ? undefined : "Quill"}
    >
      <QuillMark
        size={preset.mark}
        variant="nib"
        className={markClassName}
      />
      {showWordmark ? (
        <span
          className={`quill-brand-text ${preset.word} ${wordmarkClassName}`.trim()}
        >
          Quill
        </span>
      ) : null}
    </div>
  );
}
