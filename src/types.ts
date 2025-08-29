export type Expense = {
  date: Date;
  description: string;
  amount: number;
  category: string;
};

export type Patterns = Record<string, string[]>;
