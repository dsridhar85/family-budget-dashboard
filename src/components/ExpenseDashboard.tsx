import React from "react";
import { Expense } from "../types";
import { Line } from "react-chartjs-2";
import { Typography, Box, Paper, Grid } from "@mui/material";
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

function getYearDates(year: number) {
  // Array of Date objects, one per month start (Jan 1 to Dec 1)
  return Array.from({ length: 12 }, (_, i) => new Date(year, i, 1));
}

function getCumulativePerMonth(expenses: Expense[], category: string, year: number) {
  let cumSum = 0;
  const cum: number[] = [];
  for (let m = 0; m < 12; ++m) {
    const filtered = expenses.filter(e =>
      e.category === category &&
      e.date.getFullYear() === year &&
      e.date.getMonth() === m
    );
    let monthSum = filtered.reduce((sum, e) => sum + (category === "income" ? e.amount : Math.abs(e.amount)), 0);
    cumSum += monthSum;
    cum.push(cumSum);
  }
  return cum;
}

function getLinearTargetProgress(target: number) {
  // Returns an array [target * 1/12, target * 2/12, ..., target]
  return Array.from({ length: 12 }, (_, i) => target * ((i + 1) / 12));
}

function getCumulativeTotal(expenses: Expense[], kind: "expenses" | "income", year: number) {
  let cumSum = 0;
  const cum: number[] = [];
  for (let m = 0; m < 12; ++m) {
    let monthSum = 0;
    if (kind === "income") {
      monthSum = expenses.filter(e =>
        e.category === "income" &&
        e.date.getFullYear() === year &&
        e.date.getMonth() === m
      ).reduce((sum, e) => sum + e.amount, 0);
    } else {
      monthSum = expenses.filter(e =>
        e.category !== "income" &&
        e.date.getFullYear() === year &&
        e.date.getMonth() === m
      ).reduce((sum, e) => sum + Math.abs(e.amount), 0);
    }
    cumSum += monthSum;
    cum.push(cumSum);
  }
  return cum;
}

function ExpenseDashboard({ expenses, targets, remarks }: Props) {
  const thisYear = new Date().getFullYear();
  const yearDates = getYearDates(thisYear);

  // Individual category charts (except income)
  const expenseCategories = categories.filter(cat => cat !== "income");

  // Combined chart: total expenses and income
  const totalExpensesCumulative = getCumulativeTotal(expenses, "expenses", thisYear);
  const totalIncomeCumulative = getCumulativeTotal(expenses, "income", thisYear);

  return (
    <Box mt={4}>
      <Paper sx={{ p: 2, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Cumulative Total Income vs. Total Expenses (YTD)
        </Typography>
        <Line
          data={{
            labels: yearDates.map(d => d.toISOString().substring(0, 10)),
            datasets: [
              {
                label: "Total Expenses",
                data: totalExpensesCumulative,
                borderColor: "#e53935",
                backgroundColor: "#e57373",
                fill: false,
                tension: 0.1,
                pointRadius: 2,
                borderWidth: 2
              },
              {
                label: "Total Income",
                data: totalIncomeCumulative,
                borderColor: "#43a047",
                backgroundColor: "#81c784",
                fill: false,
                tension: 0.1,
                pointRadius: 2,
                borderWidth: 2
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
                    const label = ctx.dataset.label || '';
                    return `${label}: €${ctx.parsed.y.toFixed(2)}`;
                  }
                }
              }
            },
            scales: {
              x: {
                type: "time" as const,
                time: { unit: "month" },
                title: { display: true, text: "Month" }
              },
              y: {
                beginAtZero: true,
                title: { display: true, text: "Cumulative Amount (€)" }
              }
            }
          }}
        />
        <Typography variant="caption" color="text.secondary">
          Red line: total cumulative expenses (positive values). Green line: cumulative income.
        </Typography>
      </Paper>

      <Grid container spacing={4}>
        {expenseCategories.map((cat, i) => {
          const cum = getCumulativePerMonth(expenses, cat, thisYear);
          const target = targets[cat] || 0;
          const targetLine = getLinearTargetProgress(target);
          const remark = remarks[cat] || "";
          return (
            <Grid item xs={12} md={6} key={cat}>
              <Paper sx={{ p: 2 }}>
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
                    labels: yearDates.map(d => d.toISOString().substring(0, 10)),
                    datasets: [
                      {
                        label: `${cat} (YTD)`,
                        data: cum,
                        borderColor: palette[i % palette.length],
                        backgroundColor: palette[i % palette.length],
                        fill: false,
                        tension: 0.1,
                        pointRadius: 2,
                        borderWidth: 2
                      },
                      ...(target > 0
                        ? [{
                            label: "Target Progress",
                            data: targetLine,
                            borderColor: "#e53935",
                            borderWidth: 1,
                            borderDash: [8, 4],
                            pointRadius: 0,
                            fill: false
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
                            const label = ctx.dataset.label || '';
                            return `${label}: €${ctx.parsed.y.toFixed(2)}`;
                          }
                        }
                      }
                    },
                    scales: {
                      x: {
                        type: "time" as const,
                        time: { unit: "month" },
                        title: { display: true, text: "Month" }
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
                    Target (by Dec): €{target.toFixed(2)} | This line shows expected progress linearly over the year.
                  </Typography>
                )}
              </Paper>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}

export default ExpenseDashboard;