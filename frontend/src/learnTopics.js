/** Topic buckets within a learn collection (maps to group_id / group_title in API). */

export const LEARN_MISC_GROUP_ID = "miscellaneous";
export const LEARN_MISC_LABEL = "Miscellaneous";

const LEGACY_GROUP_IDS = new Set(["main", "ai-generated", ""]);

export function learnTopicFromSection(section) {
  const gid = String(section?.group_id || "").trim().toLowerCase();
  const gtitle = String(section?.group_title || "").trim();

  if (gid === LEARN_MISC_GROUP_ID) {
    return { id: LEARN_MISC_GROUP_ID, label: LEARN_MISC_LABEL };
  }
  if (LEGACY_GROUP_IDS.has(gid) || !gtitle || gtitle.toLowerCase() === "sections") {
    return { id: LEARN_MISC_GROUP_ID, label: LEARN_MISC_LABEL };
  }
  return { id: gid, label: gtitle };
}

/** Preserve global section order; bucket into topic groups (Miscellaneous last). */
export function groupSectionsByTopic(sections) {
  const groups = [];
  const indexById = new Map();

  for (const section of sections || []) {
    const { id, label } = learnTopicFromSection(section);
    if (!indexById.has(id)) {
      indexById.set(id, groups.length);
      groups.push({ id, label, sections: [] });
    }
    groups[indexById.get(id)].sections.push(section);
  }

  const miscIdx = groups.findIndex((g) => g.id === LEARN_MISC_GROUP_ID);
  if (miscIdx >= 0 && miscIdx < groups.length - 1) {
    const [misc] = groups.splice(miscIdx, 1);
    groups.push(misc);
  }

  return groups;
}

/** Topic label for author forms; empty when bucket is Miscellaneous. */
export function authorTopicFromSection(section) {
  const { id, label } = learnTopicFromSection(section);
  return id === LEARN_MISC_GROUP_ID ? "" : label;
}

export function mergeTopicSectionOrder(flatSections, subjectKey, topicId, orderedInTopic) {
  const inSubject = flatSections.filter((s) => s.subject_key === subjectKey);
  const groups = groupSectionsByTopic(inSubject);
  const merged = [];
  for (const group of groups) {
    if (group.id === topicId) {
      merged.push(...orderedInTopic);
    } else {
      merged.push(...group.sections);
    }
  }
  return merged;
}

export function isMiscellaneousSection(section) {
  return learnTopicFromSection(section).id === LEARN_MISC_GROUP_ID;
}

export function isMiscellaneousTopicGroup(group) {
  return (group?.id || "").toLowerCase() === LEARN_MISC_GROUP_ID;
}

/** Reader TOC / layout: misc sections are unlabeled singles (section title only). */
export function displayLearnGroups(groups) {
  const out = [];
  for (const group of groups || []) {
    if (isMiscellaneousTopicGroup(group)) {
      for (const sec of group.sections || []) {
        out.push({ id: sec.id, title: "", sections: [sec] });
      }
    } else {
      out.push(group);
    }
  }
  return out;
}

/** Reader URL: misc → solo section; named topic → topic scope only (top of page). */
export function learnSectionReaderUrl(section) {
  const subjectKey = section.subject_key || section.subjectKey;
  const sectionId = section.section_id || section.id;
  const base = `/student/learn/${encodeURIComponent(subjectKey)}`;
  const { id: topicId } = learnTopicFromSection(section);
  if (topicId === LEARN_MISC_GROUP_ID) {
    return `${base}?solo=${encodeURIComponent(sectionId)}`;
  }
  return `${base}?topic=${encodeURIComponent(topicId)}`;
}

/** Section id from location hash, or null if hash should not drive scroll. */
export function learnReaderHashScrollId(location, sections) {
  const raw = (location.hash || "").replace(/^#/, "");
  if (!raw) return null;

  const hashId = decodeURIComponent(raw);
  const hashNorm = hashId.toLowerCase();
  const solo = resolveSoloSectionId(location, sections);
  if (solo && solo === hashNorm) return null;

  return hashId;
}

export function learnReaderScopedQuery(location) {
  const params = new URLSearchParams(location.search || "");
  return Boolean(params.get("solo")?.trim() || params.get("topic")?.trim());
}

export function resolveTopicFilterId(location, sections) {
  const params = new URLSearchParams(location.search || "");
  const fromQuery = (params.get("topic") || "").trim().toLowerCase();
  if (fromQuery) {
    const valid = (sections || []).some((s) => {
      const { id } = learnTopicFromSection(s);
      return id === fromQuery && id !== LEARN_MISC_GROUP_ID;
    });
    return valid ? fromQuery : null;
  }

  const solo = resolveSoloSectionId(location, sections);
  if (solo) return null;

  const rawHash = (location.hash || "").replace(/^#/, "");
  if (!rawHash || !sections?.length) return null;
  const sectionId = decodeURIComponent(rawHash).toLowerCase();
  const section = sections.find((s) => (s.id || "").toLowerCase() === sectionId);
  if (!section || isMiscellaneousSection(section)) return null;
  return learnTopicFromSection(section).id;
}

export function filterGroupsToTopic(groups, topicId) {
  if (!topicId) return groups;
  const target = topicId.toLowerCase();
  return (groups || []).filter((g) => (g.id || "").toLowerCase() === target);
}

export function topicLabelFromGroups(groups, topicId) {
  if (!topicId) return "";
  const target = topicId.toLowerCase();
  const group = (groups || []).find((g) => (g.id || "").toLowerCase() === target);
  return group?.title || "";
}

export function learnCollectionReaderUrl(subjectKey) {
  return `/student/learn/${encodeURIComponent(subjectKey)}`;
}

/** Build section payload for reader URLs after publish (topic label may not match DB slug yet). */
export function sectionForReaderUrl(subjectKey, sectionId, topicLabel) {
  const base = {
    subject_key: subjectKey,
    section_id: sectionId,
  };
  const t = (topicLabel || "").trim();
  if (!t) {
    return {
      ...base,
      group_id: LEARN_MISC_GROUP_ID,
      group_title: LEARN_MISC_LABEL,
    };
  }
  const gid =
    t
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "topic";
  return { ...base, group_id: gid, group_title: t };
}

export function resolveSoloSectionId(location, sections) {
  const params = new URLSearchParams(location.search || "");
  const fromQuery = (params.get("solo") || "").trim();
  const rawHash = (location.hash || "").replace(/^#/, "");

  function idIfMisc(id) {
    const normalized = decodeURIComponent(id).toLowerCase();
    const section = (sections || []).find(
      (s) => (s.id || "").toLowerCase() === normalized,
    );
    if (section && isMiscellaneousSection(section)) return normalized;
    return null;
  }

  if (fromQuery) {
    return idIfMisc(fromQuery);
  }
  if (!rawHash || !sections?.length) return null;
  return idIfMisc(rawHash);
}

export function filterGroupsToSoloSection(groups, soloSectionId) {
  if (!soloSectionId) return groups;
  const target = soloSectionId.toLowerCase();
  for (const group of groups || []) {
    const sec = (group.sections || []).find(
      (s) => (s.id || "").toLowerCase() === target,
    );
    if (sec) {
      return [{ ...group, sections: [sec] }];
    }
  }
  return groups;
}
