import React, { useState } from "react";
import { Expense } from "../types";
import { Line } from "react-chartjs-2";
import { Typography, Box, Paper, Grid, Dialog, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import {
  Chart,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Legend,
  Tooltip,
  TimeScale
} from "chart.js";
import 'chartjs-adapter-date-fns';

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, TimeScale, Tooltip, Legend);

type Props = {
  expenses: Expense[];
  targets: Record<string, number>;
  remarks: Record<string, string>;
};

const categories = [
  "income",
  "Eat-out",
  "Shopping expense",
  "Utilities",
  "House loan",
  "Education",
  "Home update",
  "Car expense",
  "Groceries",
  "Insurance",
  "Bauspar",
  "Vacation",
  "Home cleaning",
  "Investment",
  "medical",
  "Credit card repayment",
  "Donation",
  "Other"
];

const palette = [
  "#26a69a", "#ff7043", "#8d6e63", "#42a5f5", "#d4e157", "#ab47bc",
  "#ec407a", "#ffa726", "#789262", "#bdbdbd", "#29b6f6", "#757575"
];

// Find min/max date from all expenses
function getMinAndMaxDate(expenses: Expense[]): { min: Date, max: Date } | null {
  if (expenses.length === 0) return null;
  let min = expenses[0].date;
  let max = expenses[0].date;
  for (const e of expenses) {
    if (e.date < min) min = e.date;
    if (e.date > max) max = e.date;
  }
  return { min, max };
}

// Cumulative per transaction, respecting sign rules (see latest user instruction)
function getCumulativePoints(expenses: Expense[], category: string) {
  const sorted = [...expenses].sort((a, b) => +a.date - +b.date);
  let running = 0;
  const isIncome = category === "income";
  return sorted.map(e => {
    let delta: number;
    if (isIncome) {
      delta = e.amount;
    } else {
      if (e.amount > 0) delta = -e.amount;
      else delta = Math.abs(e.amount);
    }
    running += delta;
    return {
      x: e.date,
      y: running,
      amount: e.amount,
      description: e.description,
      date: e.date
    };
  });
}

// Get a sorted array of the first expense in each month for a category
function getMonthlyExpenseDates(expenses: Expense[]): Date[] {
  // Group by year-month
  const monthMap = new Map<string, Date>();
  for (const e of expenses) {
    const key = `${e.date.getFullYear()}-${e.date.getMonth()}`;
    if (!monthMap.has(key) || e.date < monthMap.get(key)!) {
      monthMap.set(key, e.date);
    }
  }
  // Sort ascending
  return Array.from(monthMap.values()).sort((a, b) => a.getTime() - b.getTime());
}
/**
 * Build a linear target line for a category.
 * The line starts from 0 at the date of the first expense,
 * increases linearly, and reaches the yearly target at 12 months.
 */
function buildLinearTargetLine(expenses: Expense[], yearlyTarget: number): { x: Date; y: number }[] {
  if (!expenses.length || yearlyTarget <= 0) return [];
  // Find the first expense date for the category
  const sorted = [...expenses].sort((a, b) => +a.date - +b.date);
  const startDate = sorted[0].date;
  // Build 13 points: one per month, 0 ... 12
  const points: { x: Date; y: number }[] = [];
  for (let i = 0; i <= 12; ++i) {
    const x = new Date(startDate.getFullYear(), startDate.getMonth() + i, startDate.getDate());
    const y = yearlyTarget * (i / 12);
    points.push({ x, y });
  }
  return points;
}

// Build the linear target line as data points for the category
function buildTargetLine(expenses: Expense[], yearlyTarget: number): { x: Date; y: number }[] {
  if (!expenses.length || yearlyTarget <= 0) return [];
  const monthlyDates = getMonthlyExpenseDates(expenses);
  // Start target from 0 at first month, increase linearly to yearlyTarget at month 12
  const points: { x: Date; y: number }[] = [];
  for (let i = 0; i < monthlyDates.length; ++i) {
    const x = monthlyDates[i];
    // Target increases by (yearlyTarget/12) per month
    const y = (yearlyTarget / 12) * (i + 1);
    points.push({ x, y });
  }
  // Fill up to 12 months if fewer than 12, using the last date + 1 month steps
  let lastDate = monthlyDates[monthlyDates.length - 1];
  for (let i = monthlyDates.length; i < 12; ++i) {
    // Add 1 month to lastDate
    lastDate = new Date(lastDate);
    lastDate.setMonth(lastDate.getMonth() + 1);
    const y = (yearlyTarget / 12) * (i + 1);
    points.push({ x: new Date(lastDate), y });
  }
  // Optionally, clamp the last x to the last expense date, so target ends at last actual data point
  // If you want the last target point to always align with the last actual expense, uncomment:
  // points[points.length - 1].x = expenses[expenses.length - 1].date;
  return points;
}

type ChartPopupState = 
  | { type: "total" }
  | { type: "category", cat: string }
  | null;

function ExpenseDashboard({ expenses, targets, remarks }: Props) {
  // Find global min/max date for all charts
  const dateRange = getMinAndMaxDate(expenses);
  const xMin = dateRange ? dateRange.min : undefined;
  const xMax = dateRange ? dateRange.max : undefined;

  // Expense and income categories
  const expenseCategories = categories.filter(cat => cat !== "income");

  // Popup state for enlarged chart
  const [popup, setPopup] = useState<ChartPopupState>(null);

  // Prepare total income/expense cumulative points
  const incomePoints = getCumulativePoints(
    expenses.filter(e => e.category === "income"),
    "income"
  );
  const expensePoints = getCumulativePoints(
    expenses.filter(e => e.category !== "income"),
    "Other"
  );

  // Chart data/options for popup
  let popupChart: React.ReactNode = null;
  if (popup?.type === "total") {
    popupChart = (
      <Box p={2} sx={{ width: "90vw", maxWidth: 1200, height: "70vh" }}>
        <Typography variant="h5" gutterBottom>
          Cumulative Total Income vs. Total Expenses (per transaction)
        </Typography>
        <Line
          data={{
            datasets: [
              {
                label: "Total Expenses",
                data: expensePoints,
                parsing: { xAxisKey: "x", yAxisKey: "y" },
                borderColor: "#e53935",
                backgroundColor: "#e57373",
                fill: false,
                tension: 0,
                pointRadius: 3,
                borderWidth: 3,
              },
              {
                label: "Total Income",
                data: incomePoints,
                parsing: { xAxisKey: "x", yAxisKey: "y" },
                borderColor: "#43a047",
                backgroundColor: "#81c784",
                fill: false,
                tension: 0,
                pointRadius: 3,
                borderWidth: 3,
              }
            ]
          }}
          options={{
            responsive: true,
            plugins: {
              legend: { display: true, position: "bottom" },
              tooltip: {
                callbacks: {
                  label: (ctx: any) => {
                    const e = ctx.raw;
                    let amt = e?.amount !== undefined ? `Δ: €${e.amount.toFixed(2)}` : "";
                    let cum = e?.y !== undefined ? `Cumulative: €${e.y.toFixed(2)}` : "";
                    let date = e?.date ? `Date: ${new Date(e.date).toLocaleDateString()}` : "";
                    let desc = e?.description ? `Desc: ${e.description}` : "";
                    return [amt, cum, date, desc].filter(Boolean);
                  }
                }
              }
            },
            scales: {
              x: {
                type: "time" as const,
                min: xMin,
                max: xMax,
                time: { unit: "month" },
                title: { display: true, text: "Date" }
              },
              y: {
                beginAtZero: true,
                title: { display: true, text: "Cumulative Amount (€)" }
              }
            }
          }}
        />
      </Box>
    );
  }
  if (popup?.type === "category") {
    const cat = popup.cat;
    const catExpenses = expenses.filter(e => e.category === cat);
    const points = getCumulativePoints(catExpenses, cat);
    const target = targets[cat] || 0;
    const remark = remarks[cat] || "";
    const i = expenseCategories.indexOf(cat);

    const targetLine = buildLinearTargetLine(catExpenses, target);

    popupChart = (
      <Box p={2} sx={{ width: "90vw", maxWidth: 900, height: "70vh" }}>
        <Typography variant="h5" gutterBottom>
          {cat} (per transaction)
        </Typography>
        {remark && (
          <Typography variant="body1" color="text.secondary" gutterBottom>
            <b>Remark:</b> {remark}
          </Typography>
        )}
        <Line
          data={{
            datasets: [
              {
                label: `${cat}`,
                data: points,
                parsing: { xAxisKey: "x", yAxisKey: "y" },
                borderColor: palette[i % palette.length],
                backgroundColor: palette[i % palette.length],
                fill: false,
                tension: 0,
                pointRadius: 1,
                borderWidth: 3,
              },
              ...(target > 0
                ? [{
                    label: "Target",
                    data: targetLine,
                    parsing: { xAxisKey: "x", yAxisKey: "y" },
                    borderColor: "#e53935",
                    backgroundColor: "#e53935",
                    pointRadius: 1,
                    showLine: true,
                    fill: false,
                    borderDash: [4, 4],
                    borderWidth: 2
                  }]
                : [])
            ]
          }}
          options={{
            responsive: true,
            plugins: {
              legend: { display: true, position: "bottom" },
              tooltip: {
                callbacks: {
                  label: (ctx: any) => {
                    if (ctx.dataset.label === "Target") {
                      return `Target: €${ctx.parsed.y.toFixed(2)}`;
                    }
                    const e = ctx.raw;
                    let amt = e?.amount !== undefined ? `Δ: €${e.amount.toFixed(2)}` : "";
                    let cum = e?.y !== undefined ? `Cumulative: €${e.y.toFixed(2)}` : "";
                    let date = e?.date ? `Date: ${new Date(e.date).toLocaleDateString()}` : "";
                    let desc = e?.description ? `Desc: ${e.description}` : "";
                    return [amt, cum, date, desc].filter(Boolean);
                  }
                }
              }
            },
            scales: {
              x: {
                type: "time" as const,
                min: xMin,
                max: xMax,
                time: { unit: "month" },
                title: { display: true, text: "Date" }
              },
              y: {
                beginAtZero: true,
                title: { display: true, text: "Cumulative Expense (€)" }
              }
            }
          }}
        />
        {target > 0 && (
          <Typography variant="caption" color="text.secondary">
            Yearly Target: €{target.toFixed(2)} (target increases linearly per month, shown as points)
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Box mt={4}>
      <Paper sx={{ p: 2, mb: 4, cursor: "pointer" }} onClick={() => setPopup({ type: "total" })}>
        <Typography variant="h6" gutterBottom>
          Cumulative Total Income vs. Total Expenses (per transaction)
        </Typography>
        <Line
          data={{
            datasets: [
              {
                label: "Total Expenses",
                data: expensePoints,
                parsing: { xAxisKey: "x", yAxisKey: "y" },
                borderColor: "#e53935",
                backgroundColor: "#e57373",
                fill: false,
                tension: 0,
                pointRadius: 2,
                borderWidth: 2,
              },
              {
                label: "Total Income",
                data: incomePoints,
                parsing: { xAxisKey: "x", yAxisKey: "y" },
                borderColor: "#43a047",
                backgroundColor: "#81c784",
                fill: false,
                tension: 0,
                pointRadius: 2,
                borderWidth: 2,
              }
            ]
          }}
          options={{
            responsive: true,
            plugins: {
              legend: { display: true, position: "bottom" },
              tooltip: {
                callbacks: {
                  label: (ctx: any) => {
                    const e = ctx.raw;
                    let amt = e?.amount !== undefined ? `Δ: €${e.amount.toFixed(2)}` : "";
                    let cum = e?.y !== undefined ? `Cumulative: €${e.y.toFixed(2)}` : "";
                    let date = e?.date ? `Date: ${new Date(e.date).toLocaleDateString()}` : "";
                    let desc = e?.description ? `Desc: ${e.description}` : "";
                    return [amt, cum, date, desc].filter(Boolean);
                  }
                }
              }
            },
            scales: {
              x: {
                type: "time" as const,
                min: xMin,
                max: xMax,
                time: { unit: "month" },
                title: { display: true, text: "Date" }
              },
              y: {
                beginAtZero: true,
                title: { display: true, text: "Cumulative Amount (€)" }
              }
            }
          }}
        />
        <Typography variant="caption" color="text.secondary">
          Red line: total cumulative expenses (see sign rules). Green line: cumulative income.<br/>
          <b>Click the chart to enlarge</b>
        </Typography>
      </Paper>

      <Grid container spacing={4}>
        {expenseCategories.map((cat, i) => {
          const catExpenses = expenses.filter(e => e.category === cat);
          const points = getCumulativePoints(catExpenses, cat);
          const target = targets[cat] || 0;
          const targetLine = buildLinearTargetLine(catExpenses, target);
          const remark = remarks[cat] || "";
          return (
            <Grid item xs={12} md={6} key={cat}>
              <Paper sx={{ p: 2, cursor: "pointer" }} onClick={() => setPopup({ type: "category", cat })}>
                <Typography variant="subtitle1" gutterBottom>
                  {cat}
                </Typography>
                {remark && (
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <b>Remark:</b> {remark}
                  </Typography>
                )}
                <Line
                  data={{
                    datasets: [
                      {
                        label: `${cat}`,
                        data: points,
                        parsing: { xAxisKey: "x", yAxisKey: "y" },
                        borderColor: palette[i % palette.length],
                        backgroundColor: palette[i % palette.length],
                        fill: false,
                        tension: 0,
                        pointRadius: 1,
                        borderWidth: 2,
                      },
                      ...(target > 0
                        ? [{
                            label: "Target",
                            data: targetLine,
                            parsing: { xAxisKey: "x", yAxisKey: "y" },
                            borderColor: "#e53935",
                            backgroundColor: "#e53935",
                            pointRadius: 1,
                            showLine: true,
                            fill: false,
                            borderDash: [4, 4],
                            borderWidth: 2
                          }]
                        : [])
                    ]
                  }}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: { display: true, position: "bottom" },
                      tooltip: {
                        callbacks: {
                          label: (ctx: any) => {
                            if (ctx.dataset.label === "Target") {
                              return `Target: €${ctx.parsed.y.toFixed(2)}`;
                            }
                            const e = ctx.raw;
                            let amt = e?.amount !== undefined ? `Δ: €${e.amount.toFixed(2)}` : "";
                            let cum = e?.y !== undefined ? `Cumulative: €${e.y.toFixed(2)}` : "";
                            let date = e?.date ? `Date: ${new Date(e.date).toLocaleDateString()}` : "";
                            let desc = e?.description ? `Desc: ${e.description}` : "";
                            return [amt, cum, date, desc].filter(Boolean);
                          }
                        }
                      }
                    },
                    scales: {
                      x: {
                        type: "time" as const,
                        min: xMin,
                        max: xMax,
                        time: { unit: "month" },
                        title: { display: true, text: "Date" }
                      },
                      y: {
                        beginAtZero: true,
                        title: { display: true, text: "Cumulative Expense (€)" }
                      }
                    }
                  }}
                />
                {target > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    Yearly Target: €{target.toFixed(2)} (target increases linearly per month, shown as points)
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary">
                  <b>Click the chart to enlarge</b>
                </Typography>
              </Paper>
            </Grid>
          );
        })}
      </Grid>

      <Dialog open={Boolean(popup)} onClose={() => setPopup(null)} maxWidth="xl">
        <Box sx={{ position: "absolute", right: 10, top: 10, zIndex: 10 }}>
          <IconButton onClick={() => setPopup(null)}>
            <CloseIcon />
          </IconButton>
        </Box>
        {popupChart}
      </Dialog>
    </Box>
  );
}

export default ExpenseDashboard;