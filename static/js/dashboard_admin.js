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
        fetchMonthlyAttendanceTrend(selectedMonth);
        fetchMonthlyPresenceSummary(selectedMonth);
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

  function fetchMonthlyAttendanceTrend(month) {
    fetch(`/get_monthly_attendance_trend?month=${month}`)
      .then(response => response.json())
      .then(data => {
        if (!data || !Array.isArray(data.dates) || data.dates.length === 0) {
          monthlyChartRow1.style.display = "none";
          showError("No attendance trend data available for the selected month.");
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
        showError("Failed to load monthly attendance trend.");
      });
  }

  function fetchMonthlyPresenceSummary(month) {
    fetch(`/get_monthly_presence_summary?month=${month}`)
      .then(response => response.json())
      .then(data => {
        if (!data || !Array.isArray(data.dates) || data.dates.length === 0) {
          monthlyChartRow1.style.display = "none";
          showError("No presence summary data available for the selected month.");
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
              label: context => `${context.dataset.label}: ${context.parsed.y || 0}`,
              title: context => {
                const [day, month, year] = context[0].label.split("-");
                const fullDateStr = `20${year}-${month}-${day}`;
                const dateObj = new Date(fullDateStr);
                const options = { weekday: 'long' };
                return `${new Intl.DateTimeFormat('en-US', options).format(dateObj)}, ${context[0].label}`;
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

});
