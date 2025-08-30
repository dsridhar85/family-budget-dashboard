import React, { useState } from "react";
import { Container, Typography, Button, Box, Paper, Alert, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Grid } from "@mui/material";
import * as XLSX from "xlsx";
import ExpenseDashboard from "./components/ExpenseDashboard";
import { Expense } from "./types";
import { categorizeExpense, Patterns } from "./utils/categorizeExpense";
import EditIcon from "@mui/icons-material/Edit";
import UploadFileIcon from "@mui/icons-material/UploadFile";

type Targets = Record<string, number>;
type Remarks = Record<string, string>;
// Function to convert Excel serial date to JavaScript Date
function excelDateToJSDate(serial) {
  const excelEpoch = new Date(1899, 11, 30); // Excel epoch starts on 30-Dec-1899
  return new Date(excelEpoch.getTime() + serial * 86400000); // Add days in milliseconds
}
function App() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Everything is now driven by template!
  const [categories, setCategories] = useState<string[]>([]);
  const [targets, setTargets] = useState<Targets>({});
  const [remarks, setRemarks] = useState<Remarks>({});
  const [patterns, setPatterns] = useState<Patterns>({});

  const [editOpen, setEditOpen] = useState(false);
  const [targetsDraft, setTargetsDraft] = useState<Targets>({});
  const [remarksDraft, setRemarksDraft] = useState<Remarks>({});

  // Handle expense Excel import (after template is imported)
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (categories.length === 0) {
      setError("Please import the category/target template first!");
      return;
    }
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    try {
      let allExpenses: Expense[] = [];
      for (const file of files) {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1,cellDates: true }) as (Date | string | number )[][];
        if (!rows.length) continue;

        // Find column indices
        const header = rows[0];
        const dateIdx = header.findIndex(h => h === "Wertstellung");
        const descIdx = header.findIndex(h => h === "Buchungstext");
        const amountIdx = header.findIndex(h => h === "Betrag");

        if (dateIdx === -1 || descIdx === -1 || amountIdx === -1) {
          throw new Error("Excel sheet must have columns: Wertstellung, Buchungstext, Betrag");
        }

        for (const row of rows.slice(1)) {
          if (!row[dateIdx] || !row[descIdx] || !row[amountIdx]) continue;
          // Parse date dd.mm.yyyy
          //const dateParts = String(row[dateIdx]).split(".");
          //if (dateParts.length !== 3) continue;
          const date = new Date(excelDateToJSDate(row[dateIdx]));
          //const date = new Date(+dateParts[2], +dateParts[1] - 1, +dateParts[0]);
          const description = String(row[descIdx]);
          let amount = parseFloat(String(row[amountIdx]).replace(",", "."));
          if (isNaN(amount)) continue;
          allExpenses.push({
            date,
            description,
            amount,
            category: categorizeExpense(description, patterns, categories)
          });
        }
      }
      setExpenses(allExpenses);
    } catch (err: any) {
      setError(err.message ?? "Failed to parse Excel file");
    }
  };

  // Handle template Excel import (categories, patterns, targets, remarks)
  const handleTemplateImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as (string | number)[][];
      if (!rows.length) throw new Error("Template file is empty");

      // Find columns
      const header = rows[0];
      const catIdx = header.findIndex(h => String(h).toLowerCase().includes("category"));
      const targetIdx = header.findIndex(h => String(h).toLowerCase().includes("target"));
      const remarkIdx = header.findIndex(h => String(h).toLowerCase().includes("remark"));
      const patternIdx = header.findIndex(h => String(h).toLowerCase().includes("pattern"));

      if (catIdx === -1 || targetIdx === -1 || remarkIdx === -1 || patternIdx === -1) {
        throw new Error("Template must have columns: Category, Yearly target in €, Remark, Patterns");
      }

      const newCategories: string[] = [];
      const newTargets: Targets = {};
      const newRemarks: Remarks = {};
      const newPatterns: Patterns = {};

      for (const row of rows.slice(1)) {
        const category = String(row[catIdx]);
        if (!category) continue;
        const target = Number(row[targetIdx]) || 0;
        const remark = row[remarkIdx] ? String(row[remarkIdx]) : "";
        const patternStr = row[patternIdx] ? String(row[patternIdx]) : "";
        if (!patternStr.trim()) throw new Error(`Pattern column is mandatory for category: ${category}`);
        const patternList = patternStr.split(",").map(s => s.trim()).filter(Boolean);
        if (!patternList.length) throw new Error(`At least one pattern required for category: ${category}`);

        newCategories.push(category);
        newTargets[category] = target;
        newRemarks[category] = remark;
        newPatterns[category] = patternList;
      }

      setCategories(newCategories);
      setTargets(newTargets);
      setRemarks(newRemarks);
      setPatterns(newPatterns);
      setTargetsDraft(newTargets);
      setRemarksDraft(newRemarks);
      setExpenses([]); // Clear previous expenses, as categories may have changed
    } catch (err: any) {
      setError(err.message ?? "Failed to import template file");
    }
  };

  // Handlers for editing targets and remarks
  const handleEditTargets = () => {
    setTargetsDraft({ ...targets });
    setRemarksDraft({ ...remarks });
    setEditOpen(true);
  };
  const handleTargetChange = (category: string, value: string) => {
    setTargetsDraft(targets => ({
      ...targets,
      [category]: Number(value)
    }));
  };
  const handleRemarkChange = (category: string, value: string) => {
    setRemarksDraft(remarks => ({
      ...remarks,
      [category]: value
    }));
  };
  const handleSaveTargets = () => {
    setTargets({ ...targetsDraft });
    setRemarks({ ...remarksDraft });
    setEditOpen(false);
  };

  return (
    <Container maxWidth="md" sx={{ pb: 5 }}>
      <Typography variant="h4" gutterBottom align="center">
        Family Budget Dashboard
      </Typography>

      <Box mb={2} display="flex" justifyContent="center" gap={2} flexWrap="wrap">
        <Button variant="contained" component="label" disabled={categories.length === 0}>
          Import Excel
          <input type="file" accept=".xlsx,.xls" hidden onChange={handleFile} multiple />
        </Button>
        <Button variant="outlined" startIcon={<EditIcon />} onClick={handleEditTargets} disabled={categories.length === 0}>
          Set Yearly Targets
        </Button>
        <Button variant="outlined" startIcon={<UploadFileIcon />} component="label">
          Import Category/Target Template
          <input type="file" accept=".xlsx,.xls" hidden onChange={handleTemplateImport} />
        </Button>
      </Box>
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Yearly Targets & Remarks per Category (€)</DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            {categories.filter(c => c.toLowerCase() !== "income").map(cat => (
              <Grid container item xs={12} spacing={1} key={cat} alignItems="center">
                <Grid item xs={12} sm={3}>
                  <Typography noWrap>{cat}</Typography>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    label="Target (€)"
                    type="number"
                    fullWidth
                    value={targetsDraft[cat] ?? ""}
                    onChange={e => handleTargetChange(cat, e.target.value)}
                    InputProps={{ inputProps: { min: 0 } }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Remark"
                    fullWidth
                    value={remarksDraft[cat] ?? ""}
                    onChange={e => handleRemarkChange(cat, e.target.value)}
                  />
                </Grid>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveTargets} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
      {error && <Alert severity="error">{error}</Alert>}
      {expenses.length > 0 ? (
        <ExpenseDashboard expenses={expenses} targets={targets} remarks={remarks} categories={categories} />
      ) : (
        <Paper sx={{ p: 2, mt: 3 }}>
          <Typography variant="body2" color="text.secondary">
            Please first import a Category/Target Template Excel with columns: <b>Category</b>, <b>Yearly target in €</b>, <b>Remark</b>, <b>Patterns</b> (comma separated match strings for each category).<br/>
            After that, you can import one or more Excel files with columns: <b>Wertstellung</b> (date, dd.mm.yyyy), <b>Buchungstext</b> (description), <b>Betrag</b> (amount in Euro).
          </Typography>
        </Paper>
      )}
    </Container>
  );
}

export default App;