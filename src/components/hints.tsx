import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

// Floating first-visit hints. Anchors to elements carrying
// data-hint="<key>"; remembers dismissal per-page in localStorage.
type Step = { key: string; text: string };

export function CoachMarks({ id, steps }: { id: string; steps: Step[] }) {
  const storageKey = `fulnex-hints-${id}`;
  const [idx, setIdx] = useState(0);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(storageKey) === "done"; } catch { return true; }
  });
  const [rect, setRect] = useState<DOMRect | null>(null);

  const step = steps[idx];

  useEffect(() => {
    if (dismissed || !step) return;
    let raf = 0;
    const measure = () => {
      const el = document.querySelector(`[data-hint="${step.key}"]`);
      if (!el) { setRect(null); return; }
      setRect(el.getBoundingClientRect());
    };
    // let the page settle (animations, data) before measuring
    const t = setTimeout(() => {
      measure();
      const el = document.querySelector(`[data-hint="${step.key}"]`);
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      setTimeout(measure, 450);
    }, 600);
    const onMove = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); };
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [dismissed, step]);

  if (dismissed || !step) return null;

  function finish() {
    try { localStorage.setItem(storageKey, "done"); } catch { /* private mode */ }
    setDismissed(true);
  }
  function next() {
    if (idx + 1 >= steps.length) finish();
    else { setRect(null); setIdx(idx + 1); }
  }

  const last = idx + 1 >= steps.length;
  const below = rect ? rect.top < window.innerHeight / 2 : true;

  return (
    <AnimatePresence>
      {rect && (
        <motion.div
          key={`${step.key}-ring`}
          className="fixed z-40 pointer-events-none rounded-2xl border border-brass"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, boxShadow: "0 0 0 9999px rgba(4,5,6,0.6), 0 0 30px rgba(255,255,255,0.15)" }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          style={{
            top: rect.top - 6, left: rect.left - 6,
            width: rect.width + 12, height: rect.height + 12,
          }}
        />
      )}
      <motion.div
        key={`${step.key}-card`}
        className="fixed z-50 max-w-[300px] card p-4"
        initial={{ opacity: 0, y: below ? 8 : -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        style={rect ? {
          top: below ? Math.min(rect.bottom + 14, window.innerHeight - 150) : undefined,
          bottom: below ? undefined : window.innerHeight - rect.top + 14,
          left: Math.max(12, Math.min(rect.left, window.innerWidth - 320)),
        } : { bottom: 24, left: "50%", transform: "translateX(-50%)" }}
      >
        <p className="text-sm text-ink mb-3">{step.text}</p>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-faint">{idx + 1} / {steps.length}</span>
          <span className="flex gap-2">
            <button onClick={finish} className="text-xs font-mono text-faint hover:text-mute px-2 py-1">
              skip
            </button>
            <button onClick={next} className="btn-brass text-xs font-medium rounded-lg px-3.5 py-1.5">
              {last ? "Got it" : "Next"}
            </button>
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
