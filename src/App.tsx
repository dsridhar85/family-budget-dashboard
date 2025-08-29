import React, { useState } from "react";
import { Container, Typography, Button, Box, Paper, Alert } from "@mui/material";
import * as XLSX from "xlsx";
import ExpenseDashboard from "./components/ExpenseDashboard";
import { Expense } from "./types";
import { categorizeExpense } from "./utils/categorizeExpense";

function App() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Handle file upload and parse
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];
      if (!rows.length) throw new Error("Excel file is empty");

      // Find column indices
      const header = rows[0];
      const dateIdx = header.findIndex(h => h === "Wertstellung");
      const descIdx = header.findIndex(h => h === "Buchungstext");
      const amountIdx = header.findIndex(h => h === "Betrag");

      if (dateIdx === -1 || descIdx === -1 || amountIdx === -1) {
        throw new Error("Excel sheet must have columns: Wertstellung, Buchungstext, Betrag");
      }

      const newExpenses: Expense[] = [];
      for (const row of rows.slice(1)) {
        if (!row[dateIdx] || !row[descIdx] || !row[amountIdx]) continue;
        // Parse date dd.mm.yyyy
        const dateParts = (row[dateIdx] as string).split(".");
        if (dateParts.length !== 3) continue;
        const date = new Date(+dateParts[2], +dateParts[1] - 1, +dateParts[0]);
        const description = row[descIdx] as string;
        let amount = parseFloat((row[amountIdx] as string).replace(",", "."));
        if (isNaN(amount)) continue;
        newExpenses.push({
          date,
          description,
          amount,
          category: categorizeExpense(description)
        });
      }
      setExpenses(newExpenses);
    } catch (err: any) {
      setError(err.message ?? "Failed to parse Excel file");
    }
  };

  return (
    <Container maxWidth="sm" sx={{ pb: 5 }}>
      <Typography variant="h4" gutterBottom align="center">
        Family Budget Dashboard
      </Typography>

      <Box mb={2} display="flex" justifyContent="center">
        <Button variant="contained" component="label">
          Import Excel
          <input type="file" accept=".xlsx,.xls" hidden onChange={handleFile} />
        </Button>
      </Box>
      {error && <Alert severity="error">{error}</Alert>}
      {expenses.length > 0 ? (
        <ExpenseDashboard expenses={expenses} />
      ) : (
        <Paper sx={{ p: 2, mt: 3 }}>
          <Typography variant="body2" color="text.secondary">
            Please import an Excel file with columns: <b>Wertstellung</b> (date, dd.mm.yyyy), <b>Buchungstext</b> (description), <b>Betrag</b> (amount in Euro).
          </Typography>
        </Paper>
      )}
    </Container>
  );
}

export default App;
