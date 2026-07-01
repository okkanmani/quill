const STYLES = {
  NCERT: "bg-amber-100 text-amber-950 border-amber-200",
  Contest: "bg-violet-100 text-violet-950 border-violet-200",
  Quest: "bg-fuchsia-100 text-fuchsia-950 border-fuchsia-200",
};

function badgeStyle(text) {
  const upper = text.toUpperCase();
  if (upper.startsWith("QUEST")) return STYLES.Quest;
  return STYLES[upper] || "bg-amber-50 text-amber-900 border-amber-200";
}

export default function ContentBadge({ label }) {
  const text = (label || "").trim();
  if (!text) return null;
  const style = badgeStyle(text);
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style}`}
    >
      {text}
    </span>
  );
}
