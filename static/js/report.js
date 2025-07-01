// report.js - Enhanced Dashboard Logic

document.addEventListener("DOMContentLoaded", () => {
  const loadBtn = document.getElementById("loadReportBtn");
  const viewMode = document.getElementById("reportViewMode");

  const metricsRow = document.getElementById("reportMetricsRow");
  const flaggedCardsContainer = document.getElementById("flaggedUserCards");

  if (!loadBtn || !metricsRow || !flaggedCardsContainer) {
    console.error("[REPORT JS] Required DOM elements not found.");
    return;
  }

  let barChart, pieChart, lineChart;

  loadBtn.addEventListener("click", async () => {
    metricsRow.innerHTML = `<p class='report-loading'>Loading...</p>`;
    flaggedCardsContainer.innerHTML = "";

    try {
      const res = await fetch("/get_reports_data");
      const json = await res.json();
      if (json.status !== "success") throw new Error(json.message);

      let data = json.data;
      if (!data || data.length === 0) throw new Error("No data available");

      // Normalize Final_Score if it's in 0–1 range
      data.forEach(d => {
        if (d.Final_Score && d.Final_Score <= 1) {
          d.Final_Score = Math.round(d.Final_Score * 100);
        }
      });

// === 1. Metric Cards ===
metricsRow.innerHTML = "";

const metrics = [
  { label: "Total Users", value: data.length },
  { label: "Total Absences", value: sum(data, "Absences") },
  { label: "Total Mismatches", value: sum(data, "Mismatch_Count") },
  { label: "Unmatched INs", value: sum(data, "Unmatched_INs") },
  { label: "Unmatched OUTs", value: sum(data, "Unmatched_OUTs") }
];

metrics.forEach(m => {
  let card;

  // === Special: Total Absences ===
  if (m.label === "Total Absences") {
    const totalAbsences = m.value;
    const workingDays = 105;
    const absenteeRate = ((totalAbsences / (data.length * workingDays)) * 100).toFixed(1);
    const avgAbsences = (totalAbsences / data.length).toFixed(1);
    const highAbsentees = data.filter(u => u.Absences > 25).length;

    const flipCard = document.createElement("div");
    flipCard.className = "report-card neon-hover flip-card";
    flipCard.id = "absencesCard";
    flipCard.innerHTML = `
      <div class="flip-card-inner">
        <div class="flip-card-front">
          <h4>${m.label}</h4>
          <p>${m.value}</p>
        </div>
        <div class="flip-card-back">
          <h4>Absence Insights 
            <span class="info-icon pulse-icon" id="absInsightInfo" title="Click for details">🔍</span>
          </h4>
          <ul>
            <li><strong>Absentee Rate:</strong> ${absenteeRate}%</li>
            <li><strong>Avg/Employee:</strong> ${avgAbsences} days</li>
            <li><strong>>25 Absences:</strong> ${highAbsentees} users</li>
          </ul>
        </div>
      </div>
    `;

    metricsRow.appendChild(flipCard);

    // Flip on click
    flipCard.addEventListener("click", () => {
      flipCard.classList.toggle("flipped");
    });

    // Show floating card
    setTimeout(() => {
      const icon = document.getElementById("absInsightInfo");
      if (icon) {
        icon.addEventListener("click", (e) => {
          e.stopPropagation();
          showAbsenceInterpretationCard(avgAbsences, highAbsentees, absenteeRate);
        });
      }
    }, 0);

    return; // ✅ prevent duplicate
  }

  // === Flip cards for other insights ===
  let backHTML = "";

  if (m.label === "Total Mismatches") {
    const highMismatchUsers = data.filter(u => u.Mismatch_Count > 5).length;
    const avgMismatch = (sum(data, "Mismatch_Count") / data.length).toFixed(1);
    backHTML = `
      <ul>
        <li><strong>${highMismatchUsers} users</strong> had over 5 mismatches</li>
        <li><strong>Average:</strong> ${avgMismatch} per user</li>
        <li>Mismatch in punch pairs (IN/OUT)</li>
      </ul>`;
  }

  else if (m.label === "Unmatched INs") {
    const frequentIN = data.filter(u => u.Unmatched_INs > 3).length;
    const avgIN = (sum(data, "Unmatched_INs") / data.length).toFixed(1);
    backHTML = `
      <ul>
        <li><strong>${frequentIN} users</strong> missed 3+ IN punches</li>
        <li><strong>Average:</strong> ${avgIN} per user</li>
        <li>Indicates late/missing morning punch-ins</li>
      </ul>`;
  }

  else if (m.label === "Unmatched OUTs") {
    const frequentOUT = data.filter(u => u.Unmatched_OUTs > 3).length;
    const avgOUT = (sum(data, "Unmatched_OUTs") / data.length).toFixed(1);
    backHTML = `
      <ul>
        <li><strong>${frequentOUT} users</strong> missed 3+ OUT punches</li>
        <li><strong>Average:</strong> ${avgOUT} per user</li>
        <li>Often reflects missed evening sign-outs</li>
      </ul>`;
  }

  // === Render flip or static card
  if (backHTML) {
    card = document.createElement("div");
    card.className = "report-card neon-hover flip-card";
    card.innerHTML = `
      <div class="flip-card-inner">
        <div class="flip-card-front">
          <h4>${m.label}</h4>
          <p>${m.value}</p>
        </div>
        <div class="flip-card-back">
          <h4>${m.label} Insights</h4>
          ${backHTML}
        </div>
      </div>
    `;
    card.addEventListener("click", () => {
      card.classList.toggle("flipped");
    });
  } else {
    // Static card (Total Users)
    card = document.createElement("div");
    card.className = "report-card neon-hover";
    card.innerHTML = `<h4>${m.label}</h4><p>${m.value}</p>`;
  }

  metricsRow.appendChild(card);
});


// === Floating Insight Popup ===
function showAbsenceInterpretationCard(avgAbsences, highAbsentees, absenteeRate) {
  const existing = document.getElementById("absenceInsightCard");
  if (existing) existing.remove();

  const card = document.createElement("div");
  card.id = "absenceInsightCard";
  card.className = "floating-insight-card";
  card.innerHTML = `
    <div class="insight-content">
      <button class="close-btn">&times;</button>
      <h4>📊 Absence Breakdown</h4>
      <ul>
        <li><strong>${absenteeRate}% Absentee Rate:</strong> 1 in 5 workdays were missed</li>
        <li><strong>${avgAbsences} Days/Employee:</strong> Average leave taken by each user</li>
        <li><strong>${highAbsentees} High Absentees:</strong> Missed more than 25 days</li>
      </ul>
    </div>
  `;
  document.body.appendChild(card);

  card.querySelector(".close-btn").addEventListener("click", () => card.remove());

  setTimeout(() => {
    document.addEventListener("click", function handler(e) {
      if (!card.contains(e.target)) {
        card.remove();
        document.removeEventListener("click", handler);
      }
    });
  }, 10);
}


      // === 2. Bar Chart: Deviation from 8 hrs ===
      const deviations = data.map(u => ({
        Userid: u.Userid,
        Deviation: Math.abs((parseFloat(u.Avg_Hours || u.Avg_Hours_x || 0)) - 8).toFixed(2)
      })).sort((a, b) => b.Deviation - a.Deviation).slice(0, 8);
      renderBarChart(deviations);

      // === 3. Pie Chart: Mismatch Summary ===
      const mismatchTotals = {
        "Unmatched INs": sum(data, "Unmatched_INs"),
        "Unmatched OUTs": sum(data, "Unmatched_OUTs"),
        "Punch Issues": sum(data, "Punch_Issues")
      };
      renderPieChart(mismatchTotals);

      // === 4. Line Chart: Final Score Trend ===
      const sortedByScore = [...data].sort((a, b) => a.Final_Score - b.Final_Score);
      renderLineChart(sortedByScore);

      // === 5. Flagged Summary Chart ===
      const totalUsers = data.length;

const flaggedTier1 = data.filter(u => {
  const avg = parseFloat(u.Avg_Hours || u.Avg_Hours_x || 0);
  const score = parseFloat(u.Final_Score || 0);
  return avg > 12 && score <= 30;
});

const flaggedTier2 = data.filter(u => {
  const avg = parseFloat(u.Avg_Hours || u.Avg_Hours_x || 0);
  const score = parseFloat(u.Final_Score || 0);
  return avg > 10 && score <= 60 && !(avg > 12 && score <= 30);
});

const flaggedTier3 = data.filter(u => {
  const avg = parseFloat(u.Avg_Hours || u.Avg_Hours_x || 0);
  const score = parseFloat(u.Final_Score || 0);
  return avg > 9 && score <= 75 && !(avg > 12 && score <= 30) && !(avg > 10 && score <= 60);
});

renderFlagSummary({
  tier1: flaggedTier1,
  tier2: flaggedTier2,
  tier3: flaggedTier3
}, totalUsers);





      // === 6. Fetch and Render Anomaly Line Chart ===
      fetch("/get_anomaly_trend")
        .then(res => res.json())
        .then(json => {
          if (json.status === "success") {
            renderAnomalyTrendChart(json.trend);
          } else {
            console.warn("Anomaly trend failed:", json.message);
          }
        });

    } catch (err) {
      console.error("[REPORT ERROR]", err);
      metricsRow.innerHTML = `<p class='report-error'>Error loading report.</p>`;
    }
  });

  function sum(arr, key) {
    return arr.map(o => parseFloat(o[key]) || 0).reduce((a, b) => a + b, 0).toFixed(0);
  }

  function renderBarChart(users) {
    const ctx = document.getElementById("reportBarChart")?.getContext("2d");
    if (!ctx) return;
    if (barChart) barChart.destroy();
    barChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: users.map(u => u.Userid),
        datasets: [{
          label: "Deviation from 8 hrs",
          data: users.map(u => u.Deviation),
          backgroundColor: "#f39c12"
        }]
      },
      options: {
        responsive: true,
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  function renderPieChart(obj) {
    const ctx = document.getElementById("reportPieChart")?.getContext("2d");
    if (!ctx) return;
    if (pieChart) pieChart.destroy();
    pieChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: Object.keys(obj),
        datasets: [{
          data: Object.values(obj),
          backgroundColor: ["#ff7675", "#74b9ff", "#ffeaa7"]
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "bottom" }
        }
      }
    });
  }

  function renderLineChart(users) {
    const ctx = document.getElementById("reportLineChart")?.getContext("2d");
    if (!ctx) return;
    if (lineChart) lineChart.destroy();
    lineChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: users.map(u => u.Userid),
        datasets: [{
          label: "Final Score",
          data: users.map(u => u.Final_Score),
          borderColor: "#6a5acd",
          fill: false,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            suggestedMin: 0,
            suggestedMax: 100
          }
        }
      }
    });
  }

  function renderFlagSummary(tiersData, totalUsers) {
  flaggedCardsContainer.innerHTML = "";

  const tiers = [
    {
      label: "Tier 1 (Critical)",
      count: tiersData.tier1.length,
      color: "#e74c3c",
      desc: "Users with extreme overwork and poor performance."
    },
    {
      label: "Tier 2 (Warning)",
      count: tiersData.tier2.length,
      color: "#f39c12",
      desc: "Moderately overworked with low scores."
    },
    {
      label: "Tier 3 (Notice)",
      count: tiersData.tier3.length,
      color: "#f1c40f",
      desc: "Mild overwork and borderline scores."
    }
  ];

  // === Create Cards ===
  tiers.forEach(tier => {
    const percent = totalUsers > 0 ? Math.round((tier.count / totalUsers) * 100) : 0;

    const card = document.createElement("div");
    card.className = "report-card neon-hover";
    card.style.display = "flex";
    card.style.flexDirection = "column";
    card.style.alignItems = "center";

    const title = document.createElement("h4");
    title.textContent = tier.label;
    title.style.marginBottom = "10px";

    const circleHTML = `
      <div class="circular-progress-wrapper">
        <div class="circular-progress" data-color="${tier.color}" data-percent="${percent}">
          <svg viewBox="0 0 120 120">
            <defs>
              <linearGradient id="grad-${tier.label.replace(/\s+/g, '')}" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="${tier.color}" />
                <stop offset="100%" stop-color="#ffffff" />
              </linearGradient>
            </defs>
            <circle class="background" cx="60" cy="60" r="50" stroke="#333" stroke-width="10" fill="none" />
            <circle class="progress" cx="60" cy="60" r="50" stroke="url(#grad-${tier.label.replace(/\s+/g, '')})" stroke-width="10" fill="none" />
          </svg>
          <div class="progress-text">0%</div>
        </div>
        <p style="text-align:center; margin-top:6px; font-size: 13px;">${tier.count} users</p>
      </div>
    `;

    const desc = document.createElement("p");
    desc.textContent = tier.desc;
    desc.style.fontSize = "12px";
    desc.style.textAlign = "center";
    desc.style.marginTop = "8px";

    card.appendChild(title);
    const wrapper = document.createElement("div");
    wrapper.innerHTML = circleHTML;
    card.appendChild(wrapper);
    card.appendChild(desc);
    flaggedCardsContainer.appendChild(card);
  });

  // === Animate Circular Progress ===
  setTimeout(() => {
    flaggedCardsContainer.querySelectorAll('.circular-progress').forEach(progressEl => {
      const svg = progressEl.querySelector('svg');
      const bg = svg.querySelector('.background');
      const fg = svg.querySelector('.progress');
      const text = progressEl.querySelector('.progress-text');

      if (!text || !fg || !bg) return;

      const percent = parseFloat(progressEl.getAttribute('data-percent')) || 0;
      const color = progressEl.getAttribute('data-color') || '#ccc';
      const r = parseFloat(bg.getAttribute('r') || 50);
      const circumference = 2 * Math.PI * r;
      const offset = circumference * (1 - percent / 100);

      // fg.setAttribute('stroke', color);
      fg.setAttribute('stroke-dasharray', circumference);
      fg.setAttribute('stroke-dashoffset', circumference);
      fg.setAttribute('stroke-linecap', 'round');
      fg.style.transition = 'stroke-dashoffset 1s ease-out';

      // Animate stroke
      setTimeout(() => {
        fg.setAttribute('stroke-dashoffset', offset);
      }, 50);

      // Animate % text
      let current = 0;
      const step = Math.max(1, Math.ceil(percent / 30));
      const interval = setInterval(() => {
        current += step;
        if (current >= percent) {
          current = percent;
          clearInterval(interval);
        }
        text.textContent = `${current}%`;
      }, 20);
    });
  }, 50);
}



  function renderAnomalyTrendChart(data) {
    const ctx = document.getElementById("anomalyLineChart")?.getContext("2d");
    if (!ctx) return;
    if (window.anomalyChart) window.anomalyChart.destroy();

    const labels = data.map(d => d.Date);
    const counts = data.map(d => d.Count);

    const monthSpans = [];
    let currentMonth = labels[0].slice(3, 5);
    let startIdx = 0;
    labels.forEach((label, idx) => {
      const month = label.slice(3, 5);
      if (month !== currentMonth) {
        monthSpans.push({ start: startIdx, end: idx - 1, month: currentMonth });
        currentMonth = month;
        startIdx = idx;
      }
    });
    monthSpans.push({ start: startIdx, end: labels.length - 1, month: currentMonth });

    const backgroundColors = [
      "rgba(106, 90, 205, 0.05)",
      "rgba(255, 99, 132, 0.05)",
      "rgba(0, 255, 204, 0.05)",
      "rgba(255, 215, 0, 0.05)",
      "rgba(52, 152, 219, 0.05)",
      "rgba(155, 89, 182, 0.05)"
    ];

    const monthBackgroundPlugin = {
      id: "monthBackground",
      beforeDraw: chart => {
        const { chartArea, scales } = chart;
        const ctx = chart.ctx;
        ctx.save();
        monthSpans.forEach((span, i) => {
          const color = backgroundColors[i % backgroundColors.length];
          const startX = scales.x.getPixelForValue(labels[span.start]);
          const endX = scales.x.getPixelForValue(labels[span.end]);
          ctx.fillStyle = color;
          ctx.fillRect(startX, chartArea.top, endX - startX, chartArea.bottom - chartArea.top);
        });
        ctx.restore();
      }
    };

    window.anomalyChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Anomalies",
          data: counts,
          fill: true,
          borderColor: "#f39c12",
          backgroundColor: "rgba(243, 156, 18, 0.2)",
          pointBackgroundColor: "#f39c12",
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "top" },
          tooltip: { mode: "index", intersect: false }
        },
        scales: {
          x: { ticks: { maxRotation: 45, minRotation: 45 } },
          y: { beginAtZero: true }
        }
      },
      plugins: [monthBackgroundPlugin]
    });
  }


});