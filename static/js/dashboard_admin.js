document.addEventListener('DOMContentLoaded', function () {
  const datePicker = document.getElementById('datePicker');
  const generateBtn = document.getElementById('generateBtn');
  const toggleButton = document.getElementById('darkModeToggle');
  const rootElement = document.documentElement;
  const jarvisBtn = document.getElementById('jarvisBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const visualSelect = document.getElementById('visualSelect');
  const kpiSection = document.getElementById('kpiSection');
  const weeklyKPISection = document.getElementById('weeklyKPISection');
  const monthlyChartRow1 = document.getElementById('monthlyChartRow1');
  const monthlyChartRow2 = document.getElementById("monthlyChartRow2");
  const monthlyRow3 = document.getElementById('monthlyRow3');  




  generateBtn.addEventListener('click', async () => {
    const selectedDate = datePicker.value;
    const selectedVisual = visualSelect.value;
    const viewMode = document.getElementById("viewMode").value;

    if (!selectedDate) return showError("Please select a valid date.");
    if (!selectedVisual) return showError("Please select a visualization type.");

    await playJarvisProcessing();

    // Hide all sections
    kpiSection.style.display = "none";
    weeklyKPISection.style.display = "none";
    monthlyChartRow1.style.display = "none";
    monthlyChartRow2.style.display = "none";
    monthlyRow3.style.display = "none";

    if (selectedVisual === "kpi") {
      if (viewMode === "Daily") {
        if (typeof loadKPIData === 'function') {
          loadKPIData(selectedDate);
        } else {
          console.error("❌ loadKPIData function not found.");
        }
      } else if (viewMode === "Weekly") {
        if (typeof fetchWeeklyKPI === 'function') {
          fetchWeeklyKPI(selectedDate);
        } else {
          console.error("❌ fetchWeeklyKPI function not found.");
        }
      } else if (viewMode === "Monthly") {
        const selectedMonth = selectedDate.slice(0, 7); // 'YYYY-MM'
        if (!selectedMonth) {
          alert("Please select a month.");
          return;
        }
        await fetchMonthlyView(selectedMonth);




      }
    }

    console.log("Selected Visual:", selectedVisual);
    console.log("View Mode:", viewMode);
  });

  toggleButton.addEventListener('click', () => {
    rootElement.classList.toggle('dark-mode');
  });

  async function playJarvisProcessing() {
    const muted = localStorage.getItem("jarvis_muted") === "true";
    if (!muted) {
      const audio = new Audio('/static/audio/jarvis_working.mp3');
      try {
        await audio.play();
        await new Promise(resolve => audio.onended = resolve);
      } catch (err) {
        console.warn("Audio failed:", err);
      }
    }
  }

  async function fetchMonthlyView(month) {
  const trendSuccess = await fetchMonthlyAttendanceTrend(month);
  const summarySuccess = await fetchMonthlyPresenceSummary(month);
  const kpiSuccess = await fetchMonthlyKPIBlock(month);
  const row3Success = await fetchMonthlyRow3Charts(month);

  const allFail = !trendSuccess && !summarySuccess && !kpiSuccess && !row3Success;
  
}


  if (jarvisBtn) {
    jarvisBtn.addEventListener('click', () => {
      const muted = localStorage.getItem("jarvis_muted") === "true";
      if (!muted) {
        const voiceOptions = [
          "/static/audio/all-systems-loading.mp3",
          "/static/audio/jarvis_music.mp3",
          "/static/audio/jarvis_wakeup.mp3",
          "/static/audio/jarvis_welcomeback.mp3",
          "/static/audio/jarvis_yes.mp3",
          "/static/audio/all-systems-online.mp3",
          "/static/audio/jarvis_how_re_you.mp3",
          "/static/audio/jarvis_security_online.mp3",
          "/static/audio/jarvis_tea.mp3",
          "/static/audio/jarvis_rest.mp3"
        ];
        const selected = voiceOptions[Math.floor(Math.random() * voiceOptions.length)];
        new Audio(selected).play();
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const muted = localStorage.getItem("jarvis_muted") === "true";
      const farewell = new Audio('/static/audio/shutting-down.mp3');

      if (!muted) {
        farewell.play().then(() => {
          setTimeout(() => {
            window.location.href = logoutBtn.href;
          }, 4000);
        });

        farewell.onended = () => {
          window.location.href = logoutBtn.href;
        };
      } else {
        window.location.href = logoutBtn.href;
      }
    });
  }

  function showError(message) {
    let existing = document.getElementById("error-toast");
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = "error-toast";
    toast.innerText = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast) toast.remove();
    }, 3000);
  }

  window.fetchWeeklyKPI = async function (selectedDate) {
    try {
      const response = await fetch(`/get_weekly_kpi_data?date=${selectedDate}`);
      const data = await response.json();
      if (typeof renderWeeklyKPI === 'function') {
        renderWeeklyKPI(data);
      } else {
        console.error("❌ renderWeeklyKPI is not defined.");
      }
    } catch (error) {
      console.error("Failed to load weekly KPI data:", error);
    }
  };

  let attendanceTrendChart;
  let presenceSummaryChart;
  let presenceHoursChart;
  let lateArrivalsChart;
  function fetchMonthlyAttendanceTrend(month) {
    fetch(`/get_monthly_attendance_trend?month=${month}`)
      .then(response => response.json())
      .then(data => {
        if (!data || !Array.isArray(data.dates) || data.dates.length === 0) {
          monthlyChartRow1.style.display = "none";
          return;
        }

        monthlyChartRow1.style.display = "flex";

        const formattedDates = data.dates.map(dateStr => {
          const [year, month, day] = dateStr.split("-");
          return `${day}-${month}-${year.slice(2)}`;
        });

        renderAttendanceTrendChart({
          ...data,
          dates: formattedDates
        });
      })
      .catch(error => {
        monthlyChartRow1.style.display = "none";
        console.error("[ERROR] Attendance Trend:", error);
        
      });
  }

  function fetchMonthlyPresenceSummary(month) {
    fetch(`/get_monthly_presence_summary?month=${month}`)
      .then(response => response.json())
      .then(data => {
        if (!data || !Array.isArray(data.dates) || data.dates.length === 0) {
          monthlyChartRow1.style.display = "none";
          return;
        }

        monthlyChartRow1.style.display = "flex";

        const formattedDates = data.dates.map(dateStr => {
          const [year, month, day] = dateStr.split("-");
          return `${day}-${month}-${year.slice(2)}`;
        });

        renderPresenceSummaryChart({
          ...data,
          dates: formattedDates
        });
      })
      .catch(error => {
        monthlyChartRow1.style.display = "none";
        console.error("[ERROR] Presence Summary:", error);
        showError("Failed to load monthly presence summary.");
      });
  }

  function renderAttendanceTrendChart(data) {
    const ctx = document.getElementById('attendanceTrendChart').getContext('2d');
    if (attendanceTrendChart) attendanceTrendChart.destroy();

    attendanceTrendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.dates,
        datasets: [{
          label: 'Present',
          data: data.present_counts,
          borderColor: getComputedStyle(document.documentElement).getPropertyValue('--line-border').trim(),
          backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--line-fill').trim(),
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Monthly Attendance Trend'
          },
          tooltip: {
            callbacks: {
              label: context => `Present: ${context.parsed.y}`,
              title: context => {
                const [day, month, year] = context[0].label.split("-");
                const fullDateStr = `20${year}-${month}-${day}`;
                const dateObj = new Date(fullDateStr);
                const options = { weekday: 'long' };
                return `${new Intl.DateTimeFormat('en-US', options).format(dateObj)}, ${context[0].label}`;
              }
            }
          }
        }
      }
    });
  }

  function renderPresenceSummaryChart(data) {
    const ctx = document.getElementById('presenceSummaryChart').getContext('2d');
    if (presenceSummaryChart) presenceSummaryChart.destroy();

    presenceSummaryChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.dates,
        datasets: [
          {
            label: 'Present',
            data: data.present,
            backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bar-present').trim()
          },
          {
            label: 'Absent',
            data: data.absent,
            backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bar-absent').trim()
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Present vs Absent Summary'
          },
          tooltip: {
            callbacks: {
              label: context => {
                const total = context.chart.data.datasets.reduce((sum, dataset) => {
                  return sum + (dataset.data[context.dataIndex] || 0);
                }, 0);
                const value = context.parsed.y || 0;
                const percentage = total ? ((value / total) * 100).toFixed(1) : 0;
                return `${context.dataset.label}: ${value} (${percentage}%)`;
              },
              title: context => {
                const [day, month, year] = context[0].label.split("-");
                const fullDateStr = `20${year}-${month}-${day}`;
                const dateObj = new Date(fullDateStr);
                if (isNaN(dateObj)) return context[0].label;
                return dateObj.toLocaleDateString('en-GB', {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                });
              }
            }
          }
        },
        scales: {
          x: { stacked: true },
          y: { stacked: true, beginAtZero: true }
        }
      }
    });
  }


// =============== FETCH Monthly Avg Attendance (Gauge-style) ===============
function fetchMonthlyKPIBlock(month) {
  const avgPromise = fetch(`/get_monthly_avg_attendance?month=${month}`).then(res => res.json());
  const punctualPromise = fetch(`/get_monthly_most_punctual_day?month=${month}`).then(res => res.json());

  Promise.all([avgPromise, punctualPromise])
    .then(([avgData, punctualData]) => {
      let valid = true;

      if (!avgData || typeof avgData.avg_attendance_percent !== "number") {
        valid = false;
      }

      if (!punctualData || !punctualData.most_punctual_day || !punctualData.avg_punch_in) {
        valid = false;
      }

      if (!valid) {
        monthlyChartRow2.style.display = "none";
        return;
      }

      // ✅ Both APIs returned valid data, show the section
      monthlyChartRow2.style.display = "flex";

      renderAvgAttendanceChart(avgData.avg_attendance_percent);
      document.getElementById("punctualDayText").textContent = punctualData.most_punctual_day;
      document.getElementById("punctualTimeText").textContent = `Avg Punch-In: ${punctualData.avg_punch_in}`;
    })
    .catch(err => {
      console.error("[ERROR] Monthly KPI Block:", err);
      monthlyChartRow2.style.display = "none";
    });
}



let monthlyGaugeChart;

function renderAvgAttendanceChart(value) {
  const ctx = document.getElementById("monthlyAvgAttendanceChart").getContext("2d");
  if (monthlyGaugeChart) monthlyGaugeChart.destroy();

  monthlyGaugeChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Attendance", "Remaining"],
      datasets: [{
        data: [value, 100 - value],
        backgroundColor: [
          getComputedStyle(document.documentElement).getPropertyValue('--gauge-fill').trim() || '#4CAF50',
          getComputedStyle(document.documentElement).getPropertyValue('--gauge-empty').trim() || '#e0e0e0'
        ],
        borderWidth: 0
      }]
    },
    options: {
      cutout: "75%",
      plugins: {
        tooltip: { enabled: false },
        legend: { display: false },
        title: {
          display: true,
          text: `Monthly Attendance: ${value}%`,
          font: {
            size: 16
          }
        }
      }
    }
  });
}


function fetchMonthlyRow3Charts(month) {
  fetch(`/get_monthly_row3_data?month=${month}`)
    .then(response => response.json())
    .then(data => {
      console.log("[Row 3 API Response]", data);

      const row3 = document.getElementById('monthlyRow3');
      const lateCard = document.getElementById('lateArrivalsCard');
      const presenceCard = document.getElementById('presenceHoursCard');

      let hasData = false;

      // ========== Chart 1: Late Arrivals ==========
      if (data.late_trend && data.late_trend.length > 0) {
        hasData = true;
        const lateLabels = data.late_trend.map(item => {
          const d = new Date(item.DATE_NEW);
          return d.toLocaleDateString('en-GB');
        });
        const lateData = data.late_trend.map(item => item.Late);

        if (lateArrivalsChart) lateArrivalsChart.destroy();
        const lateCtx = document.getElementById('lateArrivalsChart').getContext('2d');
        lateArrivalsChart = new Chart(lateCtx, {
          type: 'line',
          data: {
            labels: lateLabels,
            datasets: [{
              label: 'Late Arrivals',
              data: lateData,
              borderColor: 'rgba(255, 99, 132, 1)',
              backgroundColor: 'rgba(255, 99, 132, 0.2)',
              fill: true,
              tension: 0.4
            }]
          },
          options: {
            responsive: true,
            plugins: {
              title: { display: true, text: 'Late Arrivals Trend' },
              tooltip: {
                callbacks: {
                  title: context => {
                    const [day, month, year] = context[0].label.split('/');
                    const dateObj = new Date(`${year}-${month}-${day}`);
                    const formattedDate = dateObj.toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    }).replace(/ /g, '-').toUpperCase();
                    const dayName = dateObj.toLocaleDateString('en-GB', {
                      weekday: 'long'
                    });
                    return [formattedDate, dayName];  // ✅ Two lines in tooltip
                    }
                  }
                }
            },
            scales: {
              y: { beginAtZero: true },
              x: { ticks: { autoSkip: true, maxTicksLimit: 10 } }
            }
          }
        });

        lateCard.style.display = "block";
      } else {
        lateCard.style.display = "none";
      }

      // ========== Chart 2: Presence Hours ==========
      if (data.presence_trend && data.presence_trend.length > 0) {
        hasData = true;
        const presenceLabels = data.presence_trend.map(item => {
          const d = new Date(item.DATE_NEW);
          return d.toLocaleDateString('en-GB');
        });
        const presenceData = data.presence_trend.map(item => item.Presence_Hours);

        if (presenceHoursChart) presenceHoursChart.destroy();
        const presenceCtx = document.getElementById('presenceHoursChart').getContext('2d');
        presenceHoursChart = new Chart(presenceCtx, {
          type: 'line',
          data: {
            labels: presenceLabels,
            datasets: [{
              label: 'Avg. Presence Hours',
              data: presenceData,
              borderColor: getComputedStyle(document.documentElement).getPropertyValue('--presence-line').trim(),backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--presence-fill').trim(),
              fill: true,
              tension: 0.4
            }]
          },
          options: {
            responsive: true,
            plugins: {
              title: { display: true, text: 'Avg. Presence Hours Trend' },
              tooltip: {
                callbacks: {
                  title: context => {
                    const [day, month, year] = context[0].label.split('/');
                    const dateObj = new Date(`${year}-${month}-${day}`);
                    const formattedDate = dateObj.toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    }).replace(/ /g, '-').toUpperCase();
                    const dayName = dateObj.toLocaleDateString('en-GB', {
                      weekday: 'long'
                    });
                    return [formattedDate, dayName];  // ✅ Two lines in tooltip
                    }
                  }
                }
              },
              scales: {
                y: { beginAtZero: true },
                x: { ticks: { autoSkip: true, maxTicksLimit: 10 } }
              }
            }
          });
          
          presenceCard.style.display = "block";
        } else {
          presenceCard.style.display = "none";
        }
        row3.style.display = hasData ? "flex" : "none";
        if (!hasData) {
          showError("No data available for Monthly Trends.");
        }
      })
      .catch(err => {
        console.error("[ERROR] Row 3 Charts:", err);
        document.getElementById('monthlyRow3').style.display = "none";
      });
    }
  
  });
