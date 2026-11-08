import { useEffect } from "react";

/** Calls `handler` for a key press, ignoring presses in text fields, with modifier keys, or under a dialog. */
export function useKeys(handler: ((key: string) => boolean) | null): void {
  useEffect(() => {
    if (!handler) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("textarea, input:not([type=range])")) return;
      // A focused slider moves itself with the arrow keys. Every other key still reaches the handler.
      if (target?.matches("input[type=range]") && e.key.startsWith("Arrow")) return;
      if (document.querySelector("[role=dialog]")) return;
      if (handler(e.key.toLowerCase())) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handler]);
}
