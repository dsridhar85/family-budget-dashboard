// Uses user-defined patterns only. No fallback logic.
import type { Patterns } from "../types";

// Accept the patterns and categories as arguments.
export function categorizeExpense(
  desc: string,
  amount: number,
  patterns: Patterns,
  categories: string[]
): string {
  if (amount > 0 && categories.includes("income")) return "income";
  const lc = desc.toLowerCase();

  // Check user-defined patterns for each category (except income)
  for (const cat of categories) {
    if (cat.toLowerCase() === "income") continue;
    const pats = patterns[cat] || [];
    for (const pat of pats) {
      if (pat && lc.includes(pat.toLowerCase())) {
        return cat;
      }
    }
  }
  // If not matched, return "Other" if present, else the first category
  if (categories.includes("Other")) return "Other";
  return categories[0] ?? "";
}
