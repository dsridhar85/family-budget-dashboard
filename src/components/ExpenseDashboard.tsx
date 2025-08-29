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
  categories: string[];
};

const palette = [
  "#26a69a", "#ff7043", "#8d6e63", "#42a5f5", "#d4e157", "#ab47bc",
  "#ec407a", "#ffa726", "#789262", "#bdbdbd", "#29b6f6", "#757575"
];

function getYearDates(year: number) {
  return Array.from({ length: 12 }, (_, i) => new Date(year, i, 1));
}

function getCumulativePerMonthAndDataMonths(expenses: Expense[], category: string, year: number) {
  let cumSum = 0;
  const cum: number[] = [];
  const hasData: boolean[] = [];
  let started = false;

  for (let m = 0; m < 12; ++m) {
    const filtered = expenses.filter(e =>
      e.category === category &&
      e.date.getFullYear() === year &&
      e.date.getMonth() === m
    );
    let monthSum = filtered.reduce((sum, e) => sum + (category.toLowerCase() === "income" ? e.amount : Math.abs(e.amount)), 0);

    if (!started && monthSum === 0) {
      cum.push(0);
      hasData.push(false);
      continue;
    }
    if (!started && monthSum !== 0) {
      started = true;
    }

    cumSum += monthSum;
    cum.push(cumSum);
    hasData.push(filtered.length > 0);
  }
  return { cum, hasData };
}

function getLinearTargetProgress(target: number) {
  return Array.from({ length: 12 }, (_, i) => target * ((i + 1) / 12));
}

function getCumulativeTotalAndDataMonths(expenses: Expense[], kind: "expenses" | "income", year: number, categories: string[]) {
  let cumSum = 0;
  const cum: number[] = [];
  const hasData: boolean[] = [];
  let started = false;

  for (let m = 0; m < 12; ++m) {
    let filtered: Expense[];
    if (kind === "income") {
      filtered = expenses.filter(e =>
        e.category.toLowerCase() === "income" &&
        e.date.getFullYear() === year &&
        e.date.getMonth() === m
      );
    } else {
      filtered = expenses.filter(e =>
        e.category.toLowerCase() !== "income" &&
        e.date.getFullYear() === year &&
        e.date.getMonth() === m
      );
    }
    let monthSum = filtered.reduce((sum, e) =>
      kind === "income" ? sum + e.amount : sum + Math.abs(e.amount), 0);

    if (!started && monthSum === 0) {
      cum.push(0);
      hasData.push(false);
      continue;
    }
    if (!started && monthSum !== 0) {
      started = true;
    }

    cumSum += monthSum;
    cum.push(cumSum);
    hasData.push(filtered.length > 0);
  }
  return { cum, hasData };
}

function getSegmentBorderDash(hasData: boolean[]) {
  return (ctx: any) => {
    const idx0 = ctx.p0DataIndex;
    const idx1 = ctx.p1DataIndex;
    if (idx1 - idx0 === 1) {
      if (hasData[idx0] && hasData[idx1]) {
        return undefined;
      } else if (!hasData[idx0] && !hasData[idx1]) {
        return [2, 6];
      } else {
        return [2, 6];
      }
    } else if (idx1 - idx0 > 1) {
      return [2, 6];
    }
    return undefined;
  };
}

type ChartPopupState = 
  | { type: "total" }
  | { type: "category", cat: string }
  | null;

function ExpenseDashboard({ expenses, targets, remarks, categories }: Props) {
  const thisYear = new Date().getFullYear();
  const yearDates = getYearDates(thisYear);

  // Popup state for enlarged chart
  const [popup, setPopup] = useState<ChartPopupState>(null);

  // Individual category charts (except income)
  const expenseCategories = categories.filter(cat => cat.toLowerCase() !== "income");

  // Combined chart: total expenses and income
  const total = getCumulativeTotalAndDataMonths(expenses, "expenses", thisYear, categories);
  const income = getCumulativeTotalAndDataMonths(expenses, "income", thisYear, categories);

  // Chart data/options for popup
  let popupChart: React.ReactNode = null;
  if (popup?.type === "total") {
    popupChart = (
      <Box p={2} sx={{ width: "90vw", maxWidth: 1200, height: "70vh" }}>
        <Typography variant="h5" gutterBottom>
          Cumulative Total Income vs. Total Expenses (YTD)
        </Typography>
        <Line
          data={{
            labels: yearDates.map(d => d.toISOString().substring(0, 10)),
            datasets: [
              {
                label: "Total Expenses",
                data: total.cum,
                borderColor: "#e53935",
                backgroundColor: "#e57373",
                fill: false,
                tension: 0.1,
                pointRadius: 3,
                borderWidth: 3,
                segment: {
                  borderDash: getSegmentBorderDash(total.hasData),
                },
              },
              {
                label: "Total Income",
                data: income.cum,
                borderColor: "#43a047",
                backgroundColor: "#81c784",
                fill: false,
                tension: 0.1,
                pointRadius: 3,
                borderWidth: 3,
                segment: {
                  borderDash: getSegmentBorderDash(income.hasData),
                },
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
      </Box>
    );
  }
  if (popup?.type === "category") {
    const cat = popup.cat;
    const { cum, hasData } = getCumulativePerMonthAndDataMonths(expenses, cat, thisYear);
    const target = targets[cat] || 0;
    const targetLine = getLinearTargetProgress(target);
    const remark = remarks[cat] || "";
    const i = expenseCategories.indexOf(cat);
    popupChart = (
      <Box p={2} sx={{ width: "90vw", maxWidth: 900, height: "70vh" }}>
        <Typography variant="h5" gutterBottom>
          {cat}
        </Typography>
        {remark && (
          <Typography variant="body1" color="text.secondary" gutterBottom>
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
                pointRadius: 3,
                borderWidth: 3,
                segment: {
                  borderDash: getSegmentBorderDash(hasData),
                },
              },
              ...(target > 0
                ? [{
                    label: "Target Progress",
                    data: targetLine,
                    borderColor: "#e53935",
                    borderWidth: 2,
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
      </Box>
    );
  }

  return (
    <Box mt={4}>
      <Paper sx={{ p: 2, mb: 4, cursor: "pointer" }} onClick={() => setPopup({ type: "total" })}>
        <Typography variant="h6" gutterBottom>
          Cumulative Total Income vs. Total Expenses (YTD)
        </Typography>
        <Line
          data={{
            labels: yearDates.map(d => d.toISOString().substring(0, 10)),
            datasets: [
              {
                label: "Total Expenses",
                data: total.cum,
                borderColor: "#e53935",
                backgroundColor: "#e57373",
                fill: false,
                tension: 0.1,
                pointRadius: 2,
                borderWidth: 2,
                segment: {
                  borderDash: getSegmentBorderDash(total.hasData),
                },
              },
              {
                label: "Total Income",
                data: income.cum,
                borderColor: "#43a047",
                backgroundColor: "#81c784",
                fill: false,
                tension: 0.1,
                pointRadius: 2,
                borderWidth: 2,
                segment: {
                  borderDash: getSegmentBorderDash(income.hasData),
                },
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
          Red line: total cumulative expenses (positive values). Green line: cumulative income. Dotted lines indicate months with no new data.<br/>
          <b>Click the chart to enlarge</b>
        </Typography>
      </Paper>

      <Grid container spacing={4}>
        {expenseCategories.map((cat, i) => {
          const { cum, hasData } = getCumulativePerMonthAndDataMonths(expenses, cat, thisYear);
          const target = targets[cat] || 0;
          const targetLine = getLinearTargetProgress(target);
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
                        borderWidth: 2,
                        segment: {
                          borderDash: getSegmentBorderDash(hasData),
                        },
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
                    Target (by Dec): €{target.toFixed(2)} | This line shows expected progress linearly over the year.<br/>
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
