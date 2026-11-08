/** en-AU, day first. "9 Apr 2026". */
export const formatDate = (at: number) =>
  new Date(at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
