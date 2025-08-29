import React from "react";
import { Expense } from "../types";
import { Bar } from "react-chartjs-2";
import { Typography, Box, Paper } from "@mui/material";
import {
  Chart,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  ChartOptions
} from "chart.js";

Chart.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

type Props = { expenses: Expense[] };

const categories = [
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

function ExpenseDashboard({ expenses }: Props) {
  // Calculate sums per category
  const sums: Record<string, number> = Object.fromEntries(categories.map((c) => [c, 0]));

  expenses.forEach(e => {
    const cat = categories.includes(e.category) ? e.category : "Other";
    sums[cat] += e.amount;
  });

  // Calculate YTD and monthly averages for overspend highlighting
  const thisYear = new Date().getFullYear();
  const monthsThisYear = new Set(
    expenses.filter(e => e.date.getFullYear() === thisYear).map(e => e.date.getMonth())
  );
  const monthsCount = Math.max(monthsThisYear.size, 1);

  // Overspend logic: highlight if this year's category spend > YTD average + 20%
  const month = new Date().getMonth();
  const thisMonthExpenses = expenses.filter(
    e => e.date.getFullYear() === thisYear && e.date.getMonth() === month
  );
  const thisMonthSums: Record<string, number> = Object.fromEntries(categories.map((c) => [c, 0]));
  thisMonthExpenses.forEach(e => {
    const cat = categories.includes(e.category) ? e.category : "Other";
    thisMonthSums[cat] += e.amount;
  });

  // Prepare chart data and highlighting
  const data = {
    labels: categories,
    datasets: [
      {
        label: "Total Spend (€)",
        data: categories.map(cat => Math.abs(sums[cat])),
        backgroundColor: categories.map((cat, idx) => {
          const ytdAvg = Math.abs(sums[cat]) / monthsCount;
          const highlight = Math.abs(thisMonthSums[cat]) > ytdAvg * 1.2;
          return highlight ? "#e53935" : palette[idx % palette.length];
        }),
      }
    ]
  };

  const options: ChartOptions<"bar"> = {
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: ctx => `€${ctx.parsed.y.toFixed(2)}`
        }
      }
    },
    responsive: true,
    indexAxis: "y",
    scales: {
      x: { beginAtZero: true }
    }
  };

  return (
    <Box mt={4}>
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Expense by Category (EUR)
        </Typography>
        <Bar data={data} options={options} />
        <Typography variant="caption" color="text.secondary">
          Red bar = likely overspend this month (20%+ above YTD avg)
        </Typography>
      </Paper>
    </Box>
  );
}

export default ExpenseDashboard;
