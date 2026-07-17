const GROUP_ORDER = [
  "Geometry",
  "Algebra and numbers",
  "Percentages and ratios",
  "Data and probability",
  "English",
  "Financial literacy",
  "Other",
];

/** slug → group label */
const EXPLICIT_AREA_GROUPS = {
  "3d-geometry": "Geometry",
  geometry: "Geometry",
  "circle area": "Geometry",
  "complementary angles": "Geometry",
  "cube volume": "Geometry",
  "parallelogram area": "Geometry",
  "triangle perimeter": "Geometry",

  algebra: "Algebra and numbers",
  numbers: "Algebra and numbers",
  "one-step linear equations": "Algebra and numbers",
  "order of operations": "Algebra and numbers",
  "integer operations": "Algebra and numbers",
  "simplifying expressions": "Algebra and numbers",
  "greatest common factor": "Algebra and numbers",
  "least common multiple": "Algebra and numbers",
  "fraction division": "Algebra and numbers",
  "fraction subtraction": "Algebra and numbers",
  "decimal multiplication": "Algebra and numbers",
  patterns: "Algebra and numbers",

  "percent discount": "Percentages and ratios",
  "percent of a number": "Percentages and ratios",
  "ratio problems": "Percentages and ratios",
  "unit rate": "Percentages and ratios",
  "average speed": "Percentages and ratios",
  "mean average": "Percentages and ratios",

  data: "Data and probability",
  probability: "Data and probability",

  grammar: "English",

  "financial-literacy": "Financial literacy",
};

function normalizeAreaSlug(area) {
  return String(area || "").trim().toLowerCase();
}

function inferAreaGroup(areaSlug) {
  const slug = normalizeAreaSlug(areaSlug);
  if (!slug) return "Other";

  if (
    /geometry|triangle|circle|quadrilateral|parallelogram|parallel|angle|perimeter|volume|shape|mensuration|symmetry|radius|diameter|circumference/.test(
      slug,
    )
  ) {
    return "Geometry";
  }
  if (/percent|ratio|rate|discount|markup|unit price/.test(slug)) {
    return "Percentages and ratios";
  }
  if (/algebra|equation|expression|integer|fraction|decimal|pattern|number|lcm|gcm|gcf|operation|multiple|factor/.test(slug)) {
    return "Algebra and numbers";
  }
  if (/data|graph|chart|mean|median|mode|probability|statistic/.test(slug)) {
    return "Data and probability";
  }
  if (/grammar|reading|writing|vocabulary|spelling|comprehension|inference|main idea/.test(slug)) {
    return "English";
  }
  if (/financial|money|budget|interest|tax|salary/.test(slug)) {
    return "Financial literacy";
  }

  return "Other";
}

export function getAreaGroup(area, subjectKey) {
  const slug = normalizeAreaSlug(area);
  if (EXPLICIT_AREA_GROUPS[slug]) {
    return EXPLICIT_AREA_GROUPS[slug];
  }

  const subject = String(subjectKey || "").trim().toLowerCase();
  if (subject === "english" && /grammar|reading|writing|vocabulary|comprehension/.test(slug)) {
    return "English";
  }
  if (subject === "data" && !slug) {
    return "Data and probability";
  }

  return inferAreaGroup(slug);
}

export function groupFocusAreas(areas, subjectKey) {
  const grouped = new Map();

  for (const focus of areas || []) {
    const label = getAreaGroup(focus.area, subjectKey);
    if (!grouped.has(label)) grouped.set(label, []);
    grouped.get(label).push(focus);
  }

  for (const list of grouped.values()) {
    list.sort(
      (a, b) =>
        (b.wrongCount || 0) - (a.wrongCount || 0) ||
        String(a.area).localeCompare(String(b.area)),
    );
  }

  const orderIndex = new Map(GROUP_ORDER.map((label, index) => [label, index]));
  return [...grouped.entries()].sort(
    ([a], [b]) =>
      (orderIndex.get(a) ?? 999) - (orderIndex.get(b) ?? 999) ||
      a.localeCompare(b),
  );
}

export function flattenGroupedFocusAreas(groupedAreas) {
  const flat = [];
  for (const [groupLabel, groupAreas] of groupedAreas) {
    for (const focus of groupAreas) {
      flat.push({ groupLabel, focus });
    }
  }
  return flat;
}

export function rebuildGroupedFocusAreas(flatItems) {
  const grouped = new Map();
  for (const item of flatItems) {
    if (!grouped.has(item.groupLabel)) grouped.set(item.groupLabel, []);
    grouped.get(item.groupLabel).push(item.focus);
  }

  const orderIndex = new Map(GROUP_ORDER.map((label, index) => [label, index]));
  return [...grouped.entries()].sort(
    ([a], [b]) =>
      (orderIndex.get(a) ?? 999) - (orderIndex.get(b) ?? 999) ||
      a.localeCompare(b),
  );
}
