// ========== Utility Functions ==========
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB');
}

function getDayName(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { weekday: 'long' });
}

function round1(num) {
  return (typeof num === 'number') ? num.toFixed(1) : '-';
}

function getRatingStars(score) {
  const fullStars = Math.round(score * 5);
  return '★'.repeat(fullStars) + '☆'.repeat(5 - fullStars);
}

function getRatingLabel(score) {
  if (score >= 0.9) return { label: 'Excellent', class: 'rating-excellent' };
  if (score >= 0.75) return { label: 'Good', class: 'rating-good' };
  if (score >= 0.5) return { label: 'Average', class: 'rating-average' };
  return { label: 'Poor', class: 'rating-poor' };
}

// ========== Toggle Tables ==========
// document.getElementById('toggleTablesBtn').addEventListener('click', function () {
//   const tables = document.querySelectorAll('.table-container');
//   const isVisible = tables[0].style.display !== 'none';
//   tables.forEach(tbl => tbl.style.display = isVisible ? 'none' : 'flex');
//   this.textContent = isVisible ? 'Show Tables' : 'Hide Tables';
// });



// ========== Narrative and Pills ==========
function renderNarrative(performance, empId, month) {
  const p = performance[0] || {};
  const avg = p.Avg_Hours ?? 0;
  const total = p.Total_Hours ?? 0;
  const days = p.Days_Worked ?? 0;
  const score = p.Final_Score ?? 0;

  const rating = getRatingLabel(score);
  const stars = getRatingStars(score);

  document.getElementById('starRating').textContent = stars;
  const badge = document.getElementById('ratingBadge');
  badge.textContent = rating.label;
  badge.className = rating.class;

  const narrative = `
    This report provides an overview of <strong>Employee ID: ${empId}</strong>
    ${month ? `for <strong>${month}</strong>` : ''}. 
    The employee worked for <strong>${days}</strong> days, averaging <strong>${round1(avg)} hours/day</strong> 
    and contributing a total of <strong>${round1(total)} hours</strong>. 
    Overall performance is rated as <strong>${rating.label}</strong>.
  `;
  document.getElementById('narrativeText').innerHTML = narrative;

  const insights = [];
  if (avg >= 9) insights.push("Very high daily working hours; verify for overwork.");
  else if (avg >= 8) insights.push("Meets expected daily working hours.");
  else if (avg >= 7) insights.push("Slightly under target daily hours.");
  else insights.push("Below standard daily working hours.");

  if (days >= 25) insights.push("Excellent attendance consistency.");
  else if (days >= 20) insights.push("Good attendance, but missed a few days.");
  else insights.push("Poor attendance; improvement needed.");

  if (total >= 200) insights.push("Strong monthly contribution in total hours.");
  else if (total < 150) insights.push("Low total contribution this period.");

  if (score >= 0.9) insights.push("Top-tier performer.");
  else if (score < 0.5) insights.push("Flagged for review due to low performance.");

  const getPillClass = (text) => {
    const lower = text.toLowerCase();
    if (lower.includes('excellent') || lower.includes('outstanding') || lower.includes('top-tier') || lower.includes('meets') || lower.includes('strong')) {
      return 'pill-positive';
    } else if (lower.includes('verify') || lower.includes('under') || lower.includes('missed') || lower.includes('review') || lower.includes('low') || lower.includes('poor')) {
      return 'pill-negative';
    } else {
      return 'pill-neutral';
    }
  };

  const getShortReason = (tag) => {
    const lower = tag.toLowerCase();
    if (lower.includes('verify')) return 'This may indicate overwork. Check for policy violations.';
    if (lower.includes('meets')) return 'The employee meets expected standards.';
    if (lower.includes('under')) return 'Working hours slightly below standard.';
    if (lower.includes('missed')) return 'Multiple absences recorded.';
    if (lower.includes('excellent attendance')) return 'Very regular presence throughout the month.';
    if (lower.includes('poor attendance')) return 'Attendance levels are critically low.';
    if (lower.includes('top-tier')) return 'Outstanding performance across parameters.';
    if (lower.includes('low performance')) return 'Performance score is below expected range.';
    if (lower.includes('strong')) return 'High contribution of total hours.';
    if (lower.includes('low total')) return 'Overall hours are low this period.';
    return 'General observation about attendance or performance.';
  };

  const pillContainer = document.getElementById('pillContainer');
  const infoBox = document.getElementById('pillInfoBox');
  const infoText = document.getElementById('pillInfoText');
  const closeBtn = document.getElementById('closePillInfo');

  pillContainer.innerHTML = '';
  infoBox.classList.add('d-none');

  insights.forEach((text) => {
    const pill = document.createElement('span');
    pill.className = `pill ${getPillClass(text)}`;
    pill.textContent = text;

    pill.addEventListener('click', () => {
      document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      infoText.textContent = getShortReason(text);
      infoBox.classList.remove('d-none');
    });

    pillContainer.appendChild(pill);
  });

  closeBtn.addEventListener('click', () => {
    infoBox.classList.add('d-none');
    document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
  });
}

// The remaining chart and table rendering functions stay unchanged.



// ========== Chart Rendering Functions ==========
function renderAttendanceLineChart(data) {
  const ctx = document.getElementById('attendanceChart').getContext('2d');
  const labels = data.map(d => formatDate(d.DATE_NEW));
  const values = data.map(d => d.Presence_Hours);

  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Presence Hours',
        data: values,
        borderColor: '#007bff',
        backgroundColor: 'rgba(0,123,255,0.1)',
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      plugins: {
        title: { display: true, text: 'Daily Presence Hours' },
        tooltip: {
          callbacks: {
            title: items => {
              const d = new Date(items[0].label.split('/').reverse().join('-'));
              return `${d.toLocaleDateString('en-GB', { weekday: 'long' })}, ${items[0].label}`;
            }
          }
        }
      }
    }
  });
}

function renderDeviationBarChart(data) {
  const ctx = document.getElementById('deviationChart').getContext('2d');
  const labels = data.map(d => formatDate(d.DATE_NEW));
  const deviations = data.map(d => (d.Presence_Hours ?? 0) - 8);

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Deviation from 8 hrs',
        data: deviations,
        backgroundColor: deviations.map(v => v >= 0 ? '#28a745' : '#dc3545')
      }]
    },
    options: {
      plugins: {
        title: { display: true, text: 'Deviation from Expected Hours' },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.raw >= 0 ? '+' : ''}${round1(ctx.raw)} hrs`
          }
        }
      },
      scales: {
        y: {
          grid: {
            color: ctx => ctx.tick.value === 0 ? '#000' : '#ccc',
            lineWidth: ctx => ctx.tick.value === 0 ? 2 : 1
          }
        }
      }
    }
  });
}

function renderPunchInScatterChart(data) {
  const ctx = document.getElementById('punchInChart').getContext('2d');
  const inData = [], outData = [];

  data.forEach(row => {
    const label = formatDate(row.DATE_NEW);
    const day = getDayName(row.DATE_NEW);

    if (row.IN) {
      try {
        const t = new Date(row.IN.replace(' ', 'T'));
        inData.push({
          x: label,
          y: t.getHours() + t.getMinutes() / 60,
          fullTime: t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          day
        });
      } catch (e) {}
    }

    if (row.OUT) {
      try {
        const t = new Date(row.OUT.replace(' ', 'T'));
        outData.push({
          x: label,
          y: t.getHours() + t.getMinutes() / 60,
          fullTime: t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          day
        });
      } catch (e) {}
    }
  });

  new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'IN',
          data: inData,
          backgroundColor: '#3498db',
          pointRadius: 6,
          pointStyle: 'circle'
        },
        {
          label: 'OUT',
          data: outData,
          backgroundColor: '#e67e22',
          pointRadius: 6,
          pointStyle: 'triangle'
        }
      ]
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: 'Punch Log Timeline'
        },
        tooltip: {
          callbacks: {
            title: ctx => `${ctx[0].raw.x} (${ctx[0].raw.day})`,
            label: ctx => `Time: ${ctx.raw.fullTime}`
          }
        }
      },
      scales: {
        y: {
          min: 0,
          max: 24,
          ticks: {
            callback: val => {
              const hours = String(Math.floor(val)).padStart(2, '0');
              const minutes = String(Math.round((val % 1) * 60)).padStart(2, '0');
              return `${hours}:${minutes}`;
            }
          }
        },
        x: {
          type: 'category'
        }
      }
    }
  });
}


function renderPerformanceChart(data) {
  const p = data[0];
  const ctx = document.getElementById('performanceChart').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Avg Hours', 'Days Worked', 'Total Hours'],
      datasets: [{
        label: 'Performance Metrics',
        data: [p.Avg_Hours, p.Days_Worked, p.Total_Hours, p.Final_Score],
        backgroundColor: ['#4e73df', '#1cc88a', '#36b9cc', '#f6c23e']
      }]
    },
    options: {
      plugins: {
        title: { display: true, text: 'Performance Overview' }
      },
      indexAxis: 'y'
    }
  });
}

// ========== Table Rendering ==========
function renderAttendanceTable(data) {
  const tbl = document.getElementById('attendanceTable');
  const rows = data.map(d => `
    <tr>
      <td>${formatDate(d.DATE_NEW)}</td>
      <td>${getDayName(d.DATE_NEW)}</td>
      <td>${round1(d.Presence_Hours)}</td>
    </tr>
  `).join('');
  tbl.innerHTML = `<thead><tr><th>Date</th><th>Day</th><th>Presence Hours</th></tr></thead><tbody>${rows}</tbody>`;
}

function renderPunchLogTable(data) {
  const tbl = document.getElementById('punchLogTable');

  const rows = data.map(d => {
    const inTime = d.IN ? formatTime(d.IN) : '-';
    const outTime = d.OUT ? formatTime(d.OUT) : '-';
    const isMismatch = d.Mismatch_Flag && d.Mismatch_Flag !== 'OK';

    return `
      <tr class="${isMismatch ? 'mismatch-row' : 'ok-row'}">
        <td>${formatDate(d.DATE_NEW)}</td>
        <td>${getDayName(d.DATE_NEW)}</td>
        <td>${inTime}</td>
        <td>${outTime}</td>
      </tr>
    `;
  }).join('');

  tbl.innerHTML = `
    <thead>
      <tr><th>Date</th><th>Day</th><th>IN</th><th>OUT</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  `;
}


function formatTime(datetimeStr) {
  try {
    const dateObj = new Date(datetimeStr.replace(' ', 'T'));
    return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '-';
  }
}


function renderPerformanceTable(data) {
  const p = data[0];
  document.getElementById('performanceTable').innerHTML = `
    <thead><tr><th>Avg Hours</th><th>Total Hours</th><th>Days Worked</th><th>Final Score</th></tr></thead>
    <tbody><tr>
      <td>${round1(p.Avg_Hours)}</td>
      <td>${round1(p.Total_Hours)}</td>
      <td>${p.Days_Worked}</td>
      <td>${round1(p.Final_Score)}</td>
    </tr></tbody>`;
}

// ========== Init ==========
document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const empid = params.get('empid');
  const month = params.get('month');
  let url = `/get_employee_report_data?empid=${empid}`;
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    url += `&month=${month}`;
  }

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      console.error('[EMPLOYEE REPORT ERROR] Backend error:', data.error);
      document.body.innerHTML = `<p style="color:red">${data.error}</p>`;
      return;
    }

    console.log('[DEBUG] API data:', data);  // <-- See the full object

    // Now try to render
    renderAttendanceLineChart(data.attendance);
    renderDeviationBarChart(data.attendance);
    renderPunchInScatterChart(data.punchlog);
    renderPerformanceChart(data.performance);

    renderAttendanceTable(data.attendance);
    renderPunchLogTable(data.punchlog);
    renderPerformanceTable(data.performance);

    renderNarrative(data.performance, empid, month);
  } catch (err) {
    console.error('[EMPLOYEE REPORT ERROR] Exception:', err);
    document.body.innerHTML = '<p style="color:red">Failed to load report data.</p>';
  }


  // ========== Toggle Tables ==========
document.getElementById('toggleTablesBtn').addEventListener('click', function () {
  const tables = document.querySelectorAll('#attendanceTable, #punchLogTable, #performanceTable');
  const shouldHide = this.textContent.trim() === 'Hide Tables';

  tables.forEach(tbl => {
    const parent = tbl.closest('.table-container') || tbl;
    parent.classList.toggle('d-none', shouldHide);
  });

  this.textContent = shouldHide ? 'Show Tables' : 'Hide Tables';
});

});






