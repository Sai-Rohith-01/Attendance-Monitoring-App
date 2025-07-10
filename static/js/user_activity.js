// ===== USER ACTIVITY SECTION =====
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
    } else {
      console.warn("No active session.");
    }
  } catch (err) {
    console.error("Session fetch error:", err);
  }
}

// ===== Setup Buttons and Event Listeners =====
function setupActivityEventListeners() {
  document.getElementById("weeklyViewBtn").addEventListener("click", () => setActiveView("weekly"));
  document.getElementById("monthlyViewBtn").addEventListener("click", () => setActiveView("monthly"));
  document.getElementById("loadActivityBtn").addEventListener("click", () => {
    const view = document.getElementById("weeklyControls").style.display === "block" ? "weekly" : "monthly";
    fetchAndRenderActivity(view);
  });
}

// ===== Set View State =====
function setActiveView(view) {
  const isWeekly = view === "weekly";
  document.getElementById("weeklyControls").style.display = isWeekly ? "block" : "none";
  document.getElementById("monthlyControls").style.display = isWeekly ? "none" : "block";
  document.getElementById("weeklyViewBtn").classList.toggle("active", isWeekly);
  document.getElementById("monthlyViewBtn").classList.toggle("active", !isWeekly);
  clearActivityContent();
}

// ===== Clear Cards and Chart =====
function clearActivityContent() {
  document.getElementById("activityCardsRow").innerHTML = "";
  const chartWrapper = document.getElementById("activityChartWrapper");
  if (chartWrapper) chartWrapper.style.display = "none";
  const ctx = document.getElementById("activityTrendChart").getContext("2d");
  if (activityChart) {
    activityChart.destroy();
    activityChart = null;
  }
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

// ===== Show Prompt & Play Audio Scoped =====
function triggerActivityError(message) {
  const section = document.getElementById("activitySection");
  let prompt = section.querySelector(".error-prompt");
  if (!prompt) {
    prompt = document.createElement("div");
    prompt.className = "error-prompt";
    section.appendChild(prompt);
  }
  prompt.innerText = message;
  prompt.style.display = "flex";
  prompt.classList.remove("fadeOut");
  setTimeout(() => prompt.classList.add("fadeOut"), 2500);
  setTimeout(() => (prompt.style.display = "none"), 3000);

  const audio = document.getElementById("autobotsAudio");
  if (audio) {
    audio.currentTime = 0;
    audio.play();
  }
}

// ===== Fetch Activity Data =====
async function fetchAndRenderActivity(view) {
  if (!USER_ID) return;

  const params = new URLSearchParams({ userid: USER_ID, view });

  if (view === "weekly") {
    const date = document.getElementById("weekPicker").value;
    if (!date || isNaN(new Date(date))) {
      clearActivityContent();
      triggerActivityError("Please select a valid week date.");
      return;
    }
    params.append("date", date);
  } else {
    const month = document.getElementById("monthSelector").value;
    if (!month) {
      clearActivityContent();
      triggerActivityError("Please select a valid month.");
      return;
    }
    params.append("month", month);
  }

  try {
    const res = await fetch(`/get_user_activity_data?${params}`);
    const data = await res.json();

    if (!data || !data.chart_labels || data.chart_labels.length === 0) {
      clearActivityContent();
      triggerActivityError("No data found for the selected period.");
      return;
    }

    renderActivity(data);
  } catch (err) {
    console.error(`Error fetching ${view} data:`, err);
    clearActivityContent();
    triggerActivityError("Failed to fetch activity data.");
  }
}

// ===== Render Cards and Chart =====
function renderActivity(data) {
  renderMetricCards(data);
  renderActivityChart(data.chart_labels || [], data.chart_values || []);
}

function renderMetricCards(data) {
  const container = document.getElementById("activityCardsRow");
  container.innerHTML = "";

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

function renderActivityChart(labels, values) {
  const chartWrapper = document.getElementById("activityChartWrapper");
  chartWrapper.style.display = "block";

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
          labels: { color: "#ccc", font: { size: 14 } }
        },
        tooltip: {
          mode: "index",
          intersect: false,
          callbacks: {
            title: function (items) {
              const dateStr = items[0].label;
              const date = new Date(dateStr);
              if (isNaN(date)) return dateStr;
              const day = date.toLocaleDateString('en-US', { weekday: 'short' });
              return `${day}, ${dateStr}`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: "#bbb", font: { size: 12 } },
          grid: { color: "rgba(255,255,255,0.1)" }
        },
        y: {
          beginAtZero: true,
          ticks: { color: "#bbb", stepSize: 1 },
          grid: { color: "rgba(255,255,255,0.1)" }
        }
      }
    }
  });
}

// ===== Populate Month Selector with Month Names =====
function initializeMonthSelector() {
  const selector = document.getElementById("monthSelector");
  const now = new Date();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  selector.innerHTML = "";

  for (let i = 0; i < 12; i++) {
    const monthDate = new Date(now.getFullYear(), i, 1);
    const value = `${monthDate.getFullYear()}-${String(i + 1).padStart(2, '0')}`;
    const option = document.createElement("option");
    option.value = value;
    option.textContent = monthNames[i];
    selector.appendChild(option);
  }
}

document.addEventListener("DOMContentLoaded", fetchUserIdFromSession);

// ===== SETTINGS SECTION LOGIC =====
document.addEventListener("DOMContentLoaded", () => {
  const updateBtn = document.getElementById("updatePasswordBtn");
  const saveAvatarBtn = document.getElementById("saveAvatarBtn");
  const avatarGrid = document.getElementById("avatarGrid");
  const profileAvatar = document.getElementById("profileAvatar");   // Navbar
  const homeAvatar = document.getElementById("homeAvatar");         // Home card

  let selectedAvatar = sessionStorage.getItem("selected_avatar") || null;

  // === Apply avatar to all locations
  function applyAvatar(avatarFile) {
    if (profileAvatar) profileAvatar.src = `/static/Pictures/${avatarFile}`;
    if (homeAvatar) homeAvatar.src = `/static/Pictures/${avatarFile}`;
  }

  // === Load avatar from sessionStorage if exists
  if (selectedAvatar) {
    applyAvatar(selectedAvatar);
  }

  // === Load from server session if not in sessionStorage
  if (!selectedAvatar) {
    fetch("/get_session_info")
      .then(res => res.json())
      .then(data => {
        if (data.avatar) {
          selectedAvatar = data.avatar;
          sessionStorage.setItem("selected_avatar", selectedAvatar);
          applyAvatar(selectedAvatar);
        }
      })
      .catch(() => console.warn("Failed to fetch avatar from session"));
  }

  // === Simulate Password Change ===
  updateBtn?.addEventListener("click", () => {
    const current = document.getElementById("currentPassword").value.trim();
    const newPass = document.getElementById("newPassword").value.trim();
    const errorBox = document.getElementById("passwordError");

    errorBox.style.display = "none";

    if (!current || !newPass) {
      return showError(errorBox, "Both fields are required.");
    }

    updateBtn.textContent = "✔ Updated!";
    setTimeout(() => (updateBtn.textContent = "Update Password"), 2000);
    document.getElementById("currentPassword").value = "";
    document.getElementById("newPassword").value = "";
  });

  // === Avatar Select & Save (Simulated) ===
  avatarGrid?.addEventListener("click", (e) => {
    if (e.target.tagName === "IMG") {
      document.querySelectorAll(".avatar-option").forEach((img) =>
        img.classList.remove("selected")
      );
      e.target.classList.add("selected");
      selectedAvatar = e.target.dataset.avatar;
    }
  });

  saveAvatarBtn?.addEventListener("click", () => {
    const errorBox = document.getElementById("avatarError");
    errorBox.style.display = "none";

    if (!selectedAvatar) {
      return showError(errorBox, "Select an avatar first.");
    }

    sessionStorage.setItem("selected_avatar", selectedAvatar);
    applyAvatar(selectedAvatar);

    saveAvatarBtn.textContent = "✔ Saved!";
    setTimeout(() => (saveAvatarBtn.textContent = "Save Avatar"), 2000);
  });

  // === Show error animation
  function showError(el, msg) {
    el.textContent = msg;
    el.style.display = "block";
    el.classList.add("shake");
    setTimeout(() => el.classList.remove("shake"), 500);
  }
  
});
document.addEventListener("DOMContentLoaded", () => {
  setupActivityEventListeners();       // ✅ Sets up buttons

  setActiveView("monthly");            // ✅ Forces monthly view on first load
});
