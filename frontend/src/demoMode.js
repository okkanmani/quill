export const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";

export const DEMO_PREVIEW_ROUTES = [
  {
    pattern: /^\/admin\/analysis(\/|$)/,
    blurb:
      "Sample analysis data is shown here. In your account, Quill builds focus areas from graded results and can generate targeted practice worksheets.",
  },
  {
    pattern: /^\/admin\/create(\/|$)/,
    blurb:
      "Explore the builders with sample drafts. Saving, publishing, AI generation, and JSON upload are disabled in the demo.",
  },
  {
    pattern: /^\/admin\/question-bank(\/|$)/,
    blurb:
      "Browse sample passages and questions. Adding or editing bank items is disabled in the demo.",
  },
  {
    pattern: /^\/admin\/students(\/|$)/,
    blurb:
      "The demo roster is read-only. In your account you can add students, set grades, and manage passwords.",
  },
  {
    pattern: /^\/admin\/tests(\/|$)/,
    blurb:
      "Preview the tests library and scheduling UI. Creating, editing, and unlocking tests is disabled in the demo.",
  },
  {
    pattern: /^\/admin\/composites(\/|$)/,
    blurb:
      "Preview composite test management. Creating and editing composite tests is disabled in the demo.",
  },
  {
    pattern: /^\/student\/writing(\/|$)/,
    blurb:
      "Writing submissions are preview-only in the demo. Students can submit writing in a full account.",
  },
  {
    pattern: /^\/student\/revision(\/|$)/,
    blurb:
      "Revision practice appears here after focus discussions. The demo may show sample entries only.",
  },
];

export function getDemoPreviewForPath(pathname) {
  if (!IS_DEMO_MODE) return null;
  return (
    DEMO_PREVIEW_ROUTES.find((route) => route.pattern.test(pathname || "")) ||
    null
  );
}

export function decorateNavLinksForDemo(navLinks) {
  if (!IS_DEMO_MODE) return navLinks;
  return navLinks.map((link) => {
    const preview = Boolean(getDemoPreviewForPath(link.to));
    return preview ? { ...link, demoPreview: true } : link;
  });
}

export function parseDemoBlockedPayload(body) {
  if (!body || body.demo !== true) return null;
  const detail = body.detail;
  return typeof detail === "string" && detail.trim()
    ? detail.trim()
    : "This action is disabled in the demo.";
}

export async function readDemoBlockedMessage(res) {
  if (!IS_DEMO_MODE || res.ok) return null;
  try {
    const body = await res.clone().json();
    return parseDemoBlockedPayload(body);
  } catch {
    return null;
  }
}
