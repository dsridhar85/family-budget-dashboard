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

// Generate a sorted array of all dates present in expenses, for X axis labels if needed
function getSortedExpenseDates(expenses: Expense[]): Date[] {
  return Array.from(new Set(expenses.map(e => e.date.getTime())))
    .sort((a, b) => a - b)
    .map(ts => new Date(ts));
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
    const points = getCumulativePoints(
      expenses.filter(e => e.category === cat),
      cat
    );
    const target = targets[cat] || 0;
    const remark = remarks[cat] || "";
    const i = expenseCategories.indexOf(cat);
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
                pointRadius: 3,
                borderWidth: 3,
              },
              ...(target > 0
                ? [{
                    label: "Target",
                    data: points.length > 0
                      ? [
                          { x: points[0].x, y: 0 },
                          { x: points[points.length - 1].x, y: target }
                        ]
                      : [],
                    borderColor: "#e53935",
                    backgroundColor: "#e53935",
                    pointRadius: 0,
                    borderWidth: 2,
                    borderDash: [8, 4],
                    fill: false,
                    showLine: true
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
            Yearly Target: €{target.toFixed(2)}
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
          const points = getCumulativePoints(
            expenses.filter(e => e.category === cat),
            cat
          );
          const target = targets[cat] || 0;
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
                        pointRadius: 2,
                        borderWidth: 2,
                      },
                      ...(target > 0
                        ? [{
                            label: "Target",
                            data: points.length > 0
                              ? [
                                  { x: points[0].x, y: 0 },
                                  { x: points[points.length - 1].x, y: target }
                                ]
                              : [],
                            borderColor: "#e53935",
                            backgroundColor: "#e53935",
                            pointRadius: 0,
                            borderWidth: 2,
                            borderDash: [8, 4],
                            fill: false,
                            showLine: true
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
                    Yearly Target: €{target.toFixed(2)}
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