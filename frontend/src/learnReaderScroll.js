/** Wait for img load/error (or timeout) under root before hash scroll. */
export function waitForImages(root, timeoutMs = 4000) {
  if (!root) return Promise.resolve();
  const pending = [...root.querySelectorAll("img")].filter((img) => !img.complete);
  if (pending.length === 0) return Promise.resolve();

  return Promise.race([
    Promise.all(
      pending.map(
        (img) =>
          new Promise((resolve) => {
            img.addEventListener("load", resolve, { once: true });
            img.addEventListener("error", resolve, { once: true });
          }),
      ),
    ),
    new Promise((resolve) => {
      window.setTimeout(resolve, timeoutMs);
    }),
  ]);
}

export function nextFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

/**
 * Scroll to hash target after layout/media settle. Returns false if element missing.
 */
export async function scrollToLearnHashTarget(id, { root } = {}) {
  const el = document.getElementById(id);
  if (!el) return false;

  const scope = el.closest("article") || root || document.body;
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* ignore */
    }
  }

  await waitForImages(root || scope);
  await nextFrame();

  el.scrollIntoView({ block: "start", behavior: "auto" });
  await nextFrame();
  await waitForImages(root || scope);
  await nextFrame();
  el.scrollIntoView({ block: "start", behavior: "auto" });
  await nextFrame();
  return true;
}
