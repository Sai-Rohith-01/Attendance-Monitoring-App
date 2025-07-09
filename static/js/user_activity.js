let USER_ID = null;
let activityChart = null;

// ===== Fetch user ID from session =====
async function fetchUserIdFromSession() {
  try {
    const res = await fetch('/get_session_info');
    const data = await res.json();
    if (data.userid) {
      USER_ID = data.userid;
      console.log("[✔] USER_ID:", USER_ID);
      setupActivityEventListeners();
      initializeMonthSelector();
      fetchAndRenderActivity("weekly");
    } else {
      console.warn("No active session.");
    }
  } catch (err) {
    console.error("Session fetch error:", err);
  }
}

// ===== Setup Buttons and Event Listeners =====
function setupActivityEventListeners() {
  const weeklyBtn = document.getElementById("weeklyViewBtn");
  const monthlyBtn = document.getElementById("monthlyViewBtn");
  const weekPicker = document.getElementById("weekPicker");
  const monthSelector = document.getElementById("monthSelector");

  weeklyBtn.addEventListener("click", () => setActiveView("weekly"));
  monthlyBtn.addEventListener("click", () => setActiveView("monthly"));
  weekPicker.addEventListener("change", () => fetchAndRenderActivity("weekly"));
  monthSelector.addEventListener("change", () => fetchAndRenderActivity("monthly"));
}

// ===== Set View State =====
function setActiveView(view) {
  const isWeekly = view === "weekly";
  document.getElementById("weeklyControls").style.display = isWeekly ? "block" : "none";
  document.getElementById("monthlyControls").style.display = isWeekly ? "none" : "block";
  document.getElementById("weeklyViewBtn").classList.toggle("active", isWeekly);
  document.getElementById("monthlyViewBtn").classList.toggle("active", !isWeekly);
  fetchAndRenderActivity(view);
}

// ===== Fetch Activity Data =====
async function fetchAndRenderActivity(view) {
  if (!USER_ID) return;

  const params = new URLSearchParams({ userid: USER_ID, view });

  if (view === "weekly") {
    let date = document.getElementById("weekPicker").value;
    if (!date) {
      const today = new Date();
      date = today.toISOString().split("T")[0];
      document.getElementById("weekPicker").value = date;
    }
    params.append("date", date);
  }

  if (view === "monthly") {
    const month = document.getElementById("monthSelector").value;
    if (!month) return;
    params.append("month", month);
  }

  try {
    const res = await fetch(`/get_user_activity_data?${params}`);
    const data = await res.json();
    console.log(`[✔] ${view} data:`, data);
    renderActivity(data, view);
  } catch (err) {
    console.error(`Error fetching ${view} data:`, err);
  }
}

// ===== Render Cards and Chart =====
function renderActivity(data, view) {
  renderMetricCards(data);
  renderActivityChart(data.chart_labels || [], data.chart_values || []);
}

// ===== Render Metric Cards =====
function renderMetricCards(data) {
  const container = document.getElementById("activityCardsRow");
  container.innerHTML = "";

  // Flip card for Days
  const daysCard = document.createElement("div");
  daysCard.className = "activity-card flip-card";
  daysCard.innerHTML = `
    <div class="flip-card-inner">
      <div class="flip-card-front">
        <h4>Today</h4>
        <p>${data.present_date || "-"}</p>
      </div>
      <div class="flip-card-back">
        <h4>Attendance %</h4>
        <p>${data.attendance_percent ?? 0}%</p>
      </div>
    </div>`;
  container.appendChild(daysCard);

  

  const metrics = [
    { label: "Avg Hours", value: data.avg_hours },
    { label: "Late INs", value: data.late_ins },
    { label: "Early OUTs", value: data.early_outs },
    { label: "Present Days", value: data.present_days },
    { label: "Absent Days", value: data.absent_days }
  ];

  for (const { label, value } of metrics) {
    const card = document.createElement("div");
    card.className = "activity-card";
    card.innerHTML = `<h4>${label}</h4><p>${value ?? "-"}</p>`;
    container.appendChild(card);
  }
}

// ===== Render Trend Chart =====
function renderActivityChart(labels, values) {
  const ctx = document.getElementById("activityTrendChart").getContext("2d");

  if (activityChart) activityChart.destroy();

  activityChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Presence Hours",
        data: values,
        borderColor: "#00e5ff",
        backgroundColor: "rgba(0, 229, 255, 0.2)",
        pointBackgroundColor: "#fff",
        tension: 0.3,
        pointRadius: 5,
        pointHoverRadius: 7,
        fill: true
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: {
            color: "#ccc",
            font: {
              size: 14
            }
          }
        },
        tooltip: {
          mode: "index",
          intersect: false
        }
      },
      scales: {
        x: {
          ticks: {
            color: "#bbb",
            font: {
              size: 12
            }
          },
          grid: {
            color: "rgba(255,255,255,0.1)"
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: "#bbb",
            stepSize: 1
          },
          grid: {
            color: "rgba(255,255,255,0.1)"
          }
        }
      }
    }
  });
}

// ===== Populate Month Selector =====
function initializeMonthSelector() {
  const selector = document.getElementById("monthSelector");
  const now = new Date();

  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const option = document.createElement("option");
    const monthStr = d.toISOString().slice(0, 7);
    option.value = monthStr;
    option.textContent = monthStr;
    selector.appendChild(option);
  }
}

document.addEventListener("DOMContentLoaded", fetchUserIdFromSession);
