export type Patterns = Record<string, string[]>;

export function categorizeExpense(
  desc: string,
  patterns: Patterns,
  categories: string[]
): string {
  const lc = desc.toLowerCase();
  for (const cat of categories) {
    const pats = patterns[cat] || [];
    for (const pat of pats) {
      if (pat && lc.includes(pat.toLowerCase().trim())) {
        return cat;
      }
    }
  }
  if (categories.includes("Other")) return "Other";
  return categories[0] ?? "";
}