/**
 * Open the system print dialog (Save as PDF) for a DOM subtree in the live document.
 * Uses visibility-based print CSS (see index.css) — avoids iframe print blank-page bugs.
 */
export async function printLearnSubjectDocument(rootEl, documentTitle) {
  if (!rootEl) return false;

  const prevTitle = document.title;
  document.title = documentTitle || "Learning resource";
  document.documentElement.classList.add("learn-printing");
  const removePrintPageStyle = injectPrintPageStyle();

  await waitForImages(rootEl);
  await nextFrame();
  await nextFrame();

  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      document.documentElement.classList.remove("learn-printing");
      removePrintPageStyle();
      document.title = prevTitle;
      resolve(ok);
    };

    window.addEventListener("afterprint", () => finish(true), { once: true });

    try {
      window.print();
    } catch {
      finish(false);
      return;
    }

    window.setTimeout(() => finish(true), 120_000);
  });
}

function nextFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function waitForImages(rootEl) {
  const images = Array.from(rootEl.querySelectorAll("img"));
  if (!images.length) return Promise.resolve();
  return Promise.all(
    images.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  );
}

/** Appended last in <head> so @page wins over any other print CSS during export. */
function injectPrintPageStyle() {
  const el = document.createElement("style");
  el.setAttribute("data-learn-print", "page-margins");
  el.textContent = `
    @page learn-resource {
      margin: 0;
      size: auto;
    }
    @page {
      margin: 0;
      size: auto;
    }
  `;
  document.head.appendChild(el);
  return () => {
    el.remove();
  };
}
