export const T = {
  bg: "#0e1511",
  card: "#161d19",
  surface: "#1a211d",
  panel: "#242c27",
  border: "#2f3632",
  borderHi: "#3c4a42",
  textPrimary: "#dde4dd",
  textSecondary: "#bbcac0",
  textDim: "#85948b",
  textInverse: "#2b322e",
  emerald: "#5af0b3",
  gold: "#dcc66e",
  coral: "#ffb4ab",
} as const;

export const F = {
  serif: "PlayfairDisplay_400Regular",
  serifMedium: "PlayfairDisplay_500Medium",
  sans: "Geist_300Light",
  sansMedium: "Geist_500Medium",
  mono: "Geist_400Regular",
} as const;

// Backend uses "income"/"expense"; UI uses "debit"/"credit"
export function toUIType(raw: string): "debit" | "credit" {
  return raw === "income" || raw === "credit" ? "credit" : "debit";
}
export function toAPIType(ui: "debit" | "credit"): "expense" | "income" {
  return ui === "debit" ? "expense" : "income";
}
// Safely stringify FastAPI validation errors (detail can be an array)
export function apiErrMsg(err: any, fallback: string): string {
  const detail = err?.response?.data?.detail;
  if (Array.isArray(detail)) return detail.map((e: any) => e.msg ?? String(e)).join("; ");
  return typeof detail === "string" ? detail : fallback;
}

export function fmtINR(n: number): string {
  const abs = Math.round(Math.abs(n));
  const s = String(abs);
  if (s.length <= 3) return "₹" + s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return "₹" + grouped + "," + last3;
}
