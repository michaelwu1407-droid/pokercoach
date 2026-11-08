import { useEffect } from "react";

/** Calls `handler` for a key press, ignoring presses inside text fields or with modifier keys. */
export function useKeys(handler: ((key: string) => boolean) | null): void {
  useEffect(() => {
    if (!handler) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement | null)?.closest("input, textarea")) return;
      if (document.querySelector("[role=dialog]")) return;
      if (handler(e.key.toLowerCase())) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handler]);
}
