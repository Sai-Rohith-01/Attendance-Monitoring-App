// 📊 Analytics Dashboard JS

document.addEventListener("DOMContentLoaded", () => {
  let presenceChart, lateEarlyChart, correlationChart, flaggedUserChart;

  // 🔁 Toggle between Card and Chart View
  document.getElementById("toggleAnalyticsViewBtn").addEventListener("click", () => {
    const cardView = document.getElementById("analyticsCardView");
    const chartView = document.getElementById("analyticsChartView");
    const toggleBtn = document.getElementById("toggleAnalyticsViewBtn");

    const isCardVisible = cardView.style.display !== "none";
    // Use 'block' here instead of 'flex' for proper layout
    cardView.style.display = isCardVisible ? "none" : "block";
    chartView.style.display = isCardVisible ? "block" : "none";
    toggleBtn.textContent = isCardVisible ? "Switch to Card View" : "Switch to Graph View";
  });

  // 📥 Load Analytics (overall)
  document.getElementById("viewAllAnalyticsBtn").addEventListener("click", () => {
    loadAnalytics("all");
  });

  // 📦 Main Loader Function
  async function loadAnalytics(month) {
    clearAnalyticsCards();
    destroyAllCharts();

    await Promise.all([
      loadAttendanceData(month),
      loadBehaviorData(month),
      loadPerformanceData(month),
      loadFlaggedData(month)
    ]);
  }

  // ✅ Attendance Trends Data
  async function loadAttendanceData(month) {
    try {
      const res = await fetch(`/get_attendance_trends?month=${month}`);
      if (!res.ok) throw new Error("API returned " + res.status);
      const data = await res.json();

      const presence = data.avg_presence_hours ?? "--";
      const lateIns = data.late_ins ?? "--";
      const earlyOuts = data.early_outs ?? "--";

      updateCard("cardPresenceHours", presence !== "--" ? presence + " hrs" : "--");
      updateCard("cardLateIns", lateIns);
      updateCard("cardEarlyOuts", earlyOuts);

      if (!isNaN(presence)) {
        presenceChart = createBarChart(
          "trendChartPresence",
          ["Presence Hours"],
          [presence],
          "#4CAF50"
        );
      }

      if (!isNaN(lateIns) && !isNaN(earlyOuts)) {
        lateEarlyChart = createBarChart(
          "trendChartLateEarly",
          ["Late-INs", "Early-OUTs"],
          [lateIns, earlyOuts],
          ["#FF9800", "#03A9F4"]
        );
      }

    } catch (err) {
      console.error("[ERROR] loadAttendanceData:", err);
    }
  }

  // ⚠️ Behavioral Patterns (e.g., mismatches)
  async function loadBehaviorData(month) {
    try {
      const res = await fetch(`/get_behavior_patterns?month=${month}`);
      if (!res.ok) throw new Error("API returned " + res.status);
      const data = await res.json();
      const irr = data.irregularities;
      updateCard("cardMismatches", irr?.mismatches ?? "--");
    } catch (err) {
      console.error("[ERROR] loadBehaviorData:", err);
    }
  }

  // 📈 Performance Correlation (scatter plot)
  async function loadPerformanceData(month) {
    try {
      const res = await fetch(`/get_performance_correlation?month=${month}`);
      if (!res.ok) throw new Error("API returned " + res.status);
      const data = await res.json();

      correlationChart = new Chart(document.getElementById("correlationChart"), {
        type: "scatter",
        data: {
          datasets: [{
            label: "Employees",
            data: data.map(d => ({
              x: d.Avg_Hours,
              y: d.Final_Score,
              empid: d.Userid
            })),
            backgroundColor: "#3F51B5"
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: {
            padding: { top: 20, bottom: 10, left: 10, right: 20 }
          },
          scales: {
            x: { title: { display: true, text: "Avg Hours" } },
            y: { title: { display: true, text: "Performance Score" } }
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: ctx => `ID: ${ctx.raw.empid} | Hours: ${ctx.raw.x.toFixed(2)} | Score: ${ctx.raw.y.toFixed(2)}`
              }
            }
          }
        }
      });

    } catch (err) {
      console.error("[ERROR] loadPerformanceData:", err);
    }
  }

  // 🚩 Flagged Employees Chart
  async function loadFlaggedData(month) {
    try {
      const res = await fetch(`/get_flagged_users?month=${month}`);
      if (!res.ok) throw new Error("API returned " + res.status);
      const data = await res.json();

      updateCard("cardFlagged", data.length);

      // Destroy old chart if exists
      if (flaggedUserChart) flaggedUserChart.destroy();

      flaggedUserChart = new Chart(document.getElementById("flaggedUserChart"), {
        type: "bar",
        data: {
          labels: data.map(d => d.empid),
          datasets: [{
            label: "Avg Hours",
            data: data.map(d => d.avg_hours),
            backgroundColor: "#FF5252",
            barPercentage: 0.4,
            categoryPercentage: 0.5,
            maxBarThickness: 30
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: {
            padding: { left: 20, right: 20, top: 15, bottom: 10 }
          },
          scales: {
            x: {
              title: { display: true, text: "Employee ID" },
              ticks: {
                autoSkip: true,
                maxRotation: 30,
                minRotation: 0,
                callback: function (val, idx, ticks) {
                  let label = this.getLabelForValue(val);
                  return label.length > 5 ? label.slice(0, 5) + "…" : label;
                }
              }
            },
            y: {
              beginAtZero: true,
              title: { display: true, text: "Avg Hours" }
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => `Emp: ${ctx.label} | Hours: ${ctx.parsed.y.toFixed(2)}`
              }
            }
          }
        }
      });

    } catch (err) {
      console.error("[ERROR] loadFlaggedData:", err);
    }
  }

  // 🧩 Helpers
  function updateCard(id, value) {
    const card = document.querySelector(`#${id} .value`);
    if (card) card.textContent = value;
  }

  function clearAnalyticsCards() {
    document.querySelectorAll(".info-card .value").forEach(el => el.textContent = "--");
  }

  function destroyAllCharts() {
    [presenceChart, lateEarlyChart, correlationChart, flaggedUserChart].forEach((c) => {
      if (c && typeof c.destroy === "function") c.destroy();
    });
    presenceChart = lateEarlyChart = correlationChart = flaggedUserChart = null;
  }

  function createBarChart(canvasId, labels, data, bg) {
    return new Chart(document.getElementById(canvasId), {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Value",
          data,
          backgroundColor: Array.isArray(bg) ? bg : [bg],
          barThickness: 40,
          categoryPercentage: 0.7,
          barPercentage: 0.6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: { top: 10, bottom: 10, left: 15, right: 15 }
        },
        scales: {
          x: {
            ticks: {
              maxRotation: 20,
              minRotation: 0
            }
          },
          y: { beginAtZero: true }
        }
      }
    });
  }
});
