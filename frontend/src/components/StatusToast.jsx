export default function StatusToast({ message, children }) {
  const content = children ?? message;
  if (!content) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-12 left-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-emerald-200/90 bg-white px-4 py-3 text-sm font-medium text-emerald-900 shadow-lg"
    >
      {content}
    </div>
  );
}
