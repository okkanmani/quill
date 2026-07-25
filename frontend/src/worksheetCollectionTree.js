/** Build nested collection tree from flat API section rows. */

export function isRootSection(section) {
  if (section?.is_top_level === true) return true;
  if (section?.is_top_level === false) return false;
  const p = section?.parent_id;
  return p == null || String(p).trim() === "";
}

/** True if worksheets may be stored in this collection (any level below top). */
export function sectionCanHoldWorksheets(section) {
  return !isRootSection(section);
}

export function buildSectionTree(sections) {
  const nodes = (sections || []).map((row) => ({
    ...row,
    parent_id: row.parent_id || null,
    children: [],
  }));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const roots = [];

  for (const node of nodes) {
    const parentId = node.parent_id;
    if (!parentId) {
      roots.push(node);
      continue;
    }
    const parent = byId.get(parentId);
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  function sortBranch(list) {
    list.sort(
      (a, b) =>
        (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
        a.title.localeCompare(b.title),
    );
    for (const node of list) {
      sortBranch(node.children);
    }
  }
  sortBranch(roots);
  return roots;
}

const byIdMap = (sections) =>
  new Map((sections || []).map((row) => [row.id, row]));

/** e.g. Practice › Math › Calculus */
export function sectionPathLabel(sections, sectionId) {
  const byId = byIdMap(sections);
  const parts = [];
  let current = byId.get(sectionId);
  const guard = new Set();
  while (current && !guard.has(current.id)) {
    guard.add(current.id);
    parts.unshift(current.title);
    const pid = current.parent_id;
    current = pid ? byId.get(pid) : null;
  }
  return parts.join(" › ");
}

/** Depth-first list for parent pickers (all collections). */
export function flattenSectionTree(tree, { excludeId = null } = {}) {
  const out = [];
  function walk(list, depth) {
    for (const node of list) {
      if (node.id !== excludeId) {
        out.push({ section: node, depth });
      }
      walk(node.children, depth + 1);
    }
  }
  walk(tree, 0);
  return out;
}

/** Move targets: any collection except top-level (Practice, Timed, …). */
export function flattenWorksheetDestinations(sections, { excludeId = null } = {}) {
  const tree = buildSectionTree(sections);
  return flattenSectionTree(tree, { excludeId }).filter(({ section }) =>
    sectionCanHoldWorksheets(section),
  );
}

export function worksheetsInSection(worksheets, sectionId) {
  return (worksheets || []).filter((ws) => ws.admin_section_id === sectionId);
}

export function unassignedWorksheets(worksheets) {
  return (worksheets || []).filter((ws) => !ws.admin_section_id);
}

export const ROOT_COLLECTION_STYLES = {
  practice: "bg-indigo-100/90 border-indigo-200/80",
  timed: "bg-rose-100/90 border-rose-200/80",
  enrichment: "bg-amber-100/90 border-amber-200/80",
  gifted: "bg-violet-100/90 border-violet-200/80",
  tests: "bg-teal-100/90 border-teal-200/80",
};

export function rootCollectionStyle(node) {
  const key = (node?.mode_key || "").trim();
  if (key && ROOT_COLLECTION_STYLES[key]) {
    return ROOT_COLLECTION_STYLES[key];
  }
  return "bg-slate-200/90 border-slate-300/80";
}

export function descendantSectionIds(sections, rootId) {
  const byParent = new Map();
  for (const row of sections || []) {
    const pid = row.parent_id;
    if (pid && String(pid).trim()) {
      if (!byParent.has(pid)) byParent.set(pid, []);
      byParent.get(pid).push(row.id);
    }
  }
  const found = new Set();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop();
    for (const childId of byParent.get(id) || []) {
      if (!found.has(childId)) {
        found.add(childId);
        stack.push(childId);
      }
    }
  }
  return found;
}

/** Top-level collections only (Practice, Timed, custom roots). */
export function topLevelSections(sections) {
  return (sections || []).filter(isRootSection);
}
