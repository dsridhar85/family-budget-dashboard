export function categorizeExpense(desc: string): string {
  const lc = desc.toLowerCase();

  if (/(restaurant|mc donalds|burgerking|bäckerei|baecker)/i.test(desc)) return "Eat-out";
  if (/(deichmann|c&a|sportscheck|h&m|ernstings|tedi|primark)/i.test(lc)) return "Shopping expense";
  if (/(o2|vodafone|rundkunft|enercity|e\.on|stadtwerke)/i.test(lc)) return "Utilities";
  if (/darl\.-leistung/i.test(desc)) return "House loan";
  if (/(kiga|krippe|betreuung|vimala|kindertagess)/i.test(lc)) return "Education";
  if (/(ikea|hornbach|möbel|obi|xxllutz|pocco|amazon)/i.test(lc)) return "Home update";
  if (/(h hx 328|kfz|tüv|shell|esso|aral|total|station|werkstatt|autotechnik)/i.test(lc)) return "Car expense";
  if (/(rewe|edeka|penny|aldi|netto|kaufland|dm|rossmann|angani)/i.test(lc)) return "Groceries";
  if (/(generali|advocard)/i.test(desc)) return "Insurance";
  // TODO: Add logic for Bauspar & Vacation when defined
  return "Other";
}
