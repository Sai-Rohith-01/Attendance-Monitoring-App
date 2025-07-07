""// Global Chart Instances to avoid canvas reuse issues
let avgInOutChartInstance = null;
let topConsistentChartInstance = null;
let intervalBarChartInstance = null;
let topConsistentEmployees = [];  // 🔓 global reference to use in filter

// ====== DOM READY ======
document.addEventListener('DOMContentLoaded', () => {
  const timingTab = document.getElementById('timingInsightsTab');
  const timingSection = document.getElementById('timingInsightsSection');
  const leaderboardSection = document.getElementById('leaderboardSection');
  const leaderboardBtn = document.getElementById('viewLeaderboardBtn');
  const backBtn = document.getElementById('backToInsightsBtn');

  if (!timingTab || !timingSection || !leaderboardBtn || !backBtn) return;

  timingTab.addEventListener('click', () => {
    document.querySelectorAll('.main-section').forEach(sec => sec.style.display = 'none');
    timingSection.style.display = 'block';
    leaderboardSection.style.display = 'none';

    document.querySelectorAll('.sidebar-item').forEach(item => item.classList.remove('active'));
    timingTab.classList.add('active');

    setTimeout(() => {
      loadTimingInsights();
    }, 1500);
  });

  leaderboardBtn.addEventListener('click', () => {
    timingSection.style.display = 'none';
    leaderboardSection.style.display = 'block';
    loadTopConsistentEmployees();
  });

  backBtn.addEventListener('click', () => {
    leaderboardSection.style.display = 'none';
    timingSection.style.display = 'block';
  });
});

// ===== Load Timing Insights =====
function loadTimingInsights() {
  console.log('[Timing] Loading timing insights...');
  document.querySelectorAll('#timingInsightsSection .dynamic-chart-container').forEach(el => el.remove());

  fetch('/get_timing_insights')
    .then(res => res.json())
    .then(data => {
      if (data.error) throw new Error(data.error);
      renderTimingCards(data);
      renderAvgInOutChart(data);
      renderArrivalIntervalChart(data);
      renderWorkCategoryChart(data);
    })
    .catch(err => {
      console.error('[Timing ERROR]', err);
      document.getElementById('timingCardsRow').innerHTML = `<p class="text-danger">Failed to load insights.</p>`;
    });
}

// ===== Metric Cards =====
function renderTimingCards(data) {
  const row = document.getElementById('timingCardsRow');
  row.innerHTML = '';

  const cardMap = {
    avg_in_time: 'Average IN Time',
    avg_out_time: 'Average OUT Time',
    punctual_count: 'Punctual Employees',
    consistent_count: 'Top 5 Workers'
  };

  Object.entries(cardMap).forEach(([key, label]) => {
    const value = data[key] ?? '--';
    const displayVal = typeof value === 'string' ? value : value.toLocaleString();

    const card = document.createElement('div');
    card.className = 'timing-card';

    if (key === 'consistent_count') {
      card.innerHTML = `
  <div class="card-flip text-center p-3 shadow-sm" data-key="${key}">
    <div class="card-flip-inner">
      <div class="card-front">
        <h6 class="text-muted">${label}</h6>
        <h4>-</h4>
      </div>
      <div class="card-back">
        <h6>Consistent Employees:</h6>
        <ul class="list-unstyled mb-0" id="consistentEmpList">
          <li>Loading...</li>
        </ul>
      </div>
    </div>
  </div>
`;
      row.appendChild(card);
      const flipCard = card.querySelector('.card-flip');
      flipCard.addEventListener('click', () => {
        flipCard.classList.toggle('flipped');

        const listEl = flipCard.querySelector('#consistentEmpList');
        if (listEl && listEl.children[0].innerText === 'Loading...') {
          fetch('/get_top_consistent_employees')
            .then(res => res.json())
            .then(data => {
              if (data?.top_employees?.length) {
                listEl.innerHTML = '';
                data.top_employees.slice(0, 5).forEach(emp => {
                  const li = document.createElement('li');
                  li.innerHTML = `👤 <strong>${emp.empid}</strong>: IN ${formatHour(emp.avg_in)}, SD ${emp.std_dev}`;
                  listEl.appendChild(li);
                });
              } else {
                listEl.innerHTML = '<li>No data found.</li>';
              }
            })
            .catch(() => {
              listEl.innerHTML = '<li>Error loading data.</li>';
            });
        }
      });
    } else {
      card.innerHTML = `
        <h6>${label}</h6>
        <h4>${displayVal}</h4>
      `;
      row.appendChild(card);
    }
  });
}

// ===== IN/OUT Line Chart =====
function renderAvgInOutChart(data) {
  const ctx = document.getElementById('avgInOutChart').getContext('2d');
  if (avgInOutChartInstance) avgInOutChartInstance.destroy();

  const weekdayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const orderedData = (data.avg_times_by_day || []).sort((a, b) => weekdayOrder.indexOf(a.day) - weekdayOrder.indexOf(b.day));

  const labels = orderedData.map(d => d.day);
  const inTimes = orderedData.map(d => parseFloat(d.avg_in));
  const outTimes = orderedData.map(d => parseFloat(d.avg_out));

  avgInOutChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Avg IN Time', data: inTimes, borderColor: '#007bff', tension: 0.3 },
        { label: 'Avg OUT Time', data: outTimes, borderColor: '#28a745', tension: 0.3 }
      ]
    },
    options: {
      plugins: {
        title: { display: true, text: 'Avg IN/OUT Times by Weekday' },
        tooltip: {
          callbacks: {
            label: ctx => {
              const val = ctx.raw;
              const h = Math.floor(val);
              const m = Math.round((val - h) * 60);
              return `${ctx.dataset.label}: ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            }
          }
        }
      },
      scales: {
        y: {
          min: 6, max: 22,
          ticks: {
            callback: val => {
              const h = Math.floor(val);
              const m = Math.round((val - h) * 60);
              return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            }
          }
        }
      }
    }
  });
}

// ===== Arrival Interval Chart =====
function renderArrivalIntervalChart(data) {
  const container = document.createElement('div');
  container.className = 'timing-chart-container dynamic-chart-container';
  container.innerHTML = `<canvas id="intervalBarChart" height="100"></canvas>`;
  document.getElementById('timingInsightsSection').appendChild(container);

  const ctx = document.getElementById('intervalBarChart').getContext('2d');
  if (intervalBarChartInstance) intervalBarChartInstance.destroy();

  const labels = ['Before 8', '8–9', '9–10', '10–11', 'After 11'];
  const values = labels.map(label => data.interval_distribution?.[label] ?? 0);

  intervalBarChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Employees (Consistent)',
        data: values,
        backgroundColor: '#6f42c1'
      }]
    },
    options: {
      plugins: {
        title: { display: true, text: 'Arrival Interval Consistency (Unique Employees)' },
        tooltip: {
          callbacks: {
            label: ctx => `Count: ${Number(ctx.raw).toLocaleString()}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, callback: v => Number(v).toLocaleString() }
        }
      }
    }
  });
}

// ===== Work Category Pie Chart =====
function renderWorkCategoryChart(data) {
  const container = document.createElement('div');
  container.className = 'timing-chart-container dynamic-chart-container';
  container.innerHTML = `<canvas id="workCategoryChart" height="100"></canvas>`;
  document.getElementById('timingInsightsSection').appendChild(container);

  const ctx = document.getElementById('workCategoryChart').getContext('2d');
  const labels = Object.keys(data.work_categories || {});
  const values = Object.values(data.work_categories || {});

  new Chart(ctx, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        label: 'Employees',
        data: values,
        backgroundColor: ['#ffc107', '#17a2b8', '#dc3545']
      }]
    },
    options: {
      plugins: {
        title: { display: true, text: 'Employee Work Categories' },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.label}: ${Number(ctx.raw).toLocaleString()}`
          }
        }
      }
    }
  });
}

// ===== Load Leaderboard Data =====
function loadTopConsistentEmployees() {
  fetch('/get_top_consistent_employees')
    .then(res => res.json())
    .then(data => {
      if (data.error) throw new Error(data.error);
      renderTopConsistentCards(data.top_employees);
      renderTopConsistentChart(data.top_employees);
    })
    .catch(err => {
      console.error('[Leaderboard ERROR]', err);
      document.getElementById('topConsistentList').innerHTML = `<p class='text-danger'>Failed to load leaderboard.</p>`;
    });
}

// ===== Leaderboard Cards =====
function renderTopConsistentCards(employees) {
  const list = document.getElementById('topConsistentList');
  list.innerHTML = '';
  employees.forEach(emp => {
    const card = document.createElement('div');
    card.className = 'leaderboard-card';
    card.innerHTML = `
      <h6 class="text-yellow-300">Employee ID: ${emp.empid}</h6>
      <p><strong>Avg IN:</strong> ${formatHour(emp.avg_in)}</p>
      <p><strong>Deviation:</strong> ${emp.std_dev} hrs</p>
    `;
    list.appendChild(card);
  });
}

// ===== Leaderboard Chart =====
function renderTopConsistentChart(employees) {
  topConsistentEmployees = employees;
  const ctx = document.getElementById('topConsistentChart').getContext('2d');
  if (topConsistentChartInstance) topConsistentChartInstance.destroy();

  const datasets = employees.map((emp, idx) => ({
    label: `Emp ${emp.empid}`,
    data: emp.in_times,
    borderColor: getColor(idx),
    fill: false,
    tension: 0.5,
    cubicInterpolationMode: 'monotone',
    pointRadius: 2,
    pointHoverRadius: 4
  }));

  // Calculate dynamic y-axis range
  const allTimes = employees.flatMap(e => e.in_times);
  const minY = Math.floor(Math.min(...allTimes)) - 1;
  const maxY = Math.ceil(Math.max(...allTimes)) + 1;

  topConsistentChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: Array.from({ length: 100 }, (_, i) => `Day ${i + 1}`),
      datasets
    },
    options: {
      plugins: {
        title: { display: true, text: 'IN Time Consistency Patterns' },
        tooltip: {
          callbacks: {
            label: ctx => {
              const val = ctx.raw;
              const h = Math.floor(val);
              const m = Math.round((val - h) * 60);
              return `${ctx.dataset.label}: ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            }
          }
        }
      },
      scales: {
        y: {
          min: Math.max(minY, 5), // clamp at least 5AM
          max: Math.min(maxY, 24), // clamp max to 24hr
          ticks: {
            callback: val => {
              const h = Math.floor(val);
              const m = Math.round((val - h) * 60);
              return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            }
          }
        }
      }
    }
  });

  const input = document.getElementById('filterUserId');
  if (input) {
    input.oninput = () => {
      const userId = input.value.trim();
      if (!userId) {
        renderTopConsistentChart(topConsistentEmployees);
        return;
      }
      fetch(`/get_employee_in_pattern?empid=${userId}`)
        .then(res => res.json())
        .then(data => {
          if (!data || !data.in_times) throw new Error('Invalid data');
          const dataset = [{
            label: `Emp ${userId}`,
            data: data.in_times,
            borderColor: getColor(0),
            fill: false,
            tension: 0.5,
            cubicInterpolationMode: 'monotone',
            pointRadius: 2,
            pointHoverRadius: 4
          }];

          const minY = Math.floor(Math.min(...data.in_times)) - 1;
          const maxY = Math.ceil(Math.max(...data.in_times)) + 1;

          topConsistentChartInstance.data.labels = data.in_times.map((_, i) => `Day ${i + 1}`);
          topConsistentChartInstance.data.datasets = dataset;
          topConsistentChartInstance.options.scales.y.min = Math.max(minY, 5);
          topConsistentChartInstance.options.scales.y.max = Math.min(maxY, 24);
          topConsistentChartInstance.update();
        })
        .catch(err => console.error('[Filter ERROR]', err));
    };
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const compareBtn = document.getElementById('compareUsersBtn');
  if (compareBtn) {
    compareBtn.addEventListener('click', () => {
      const empid1 = document.getElementById('compareUser1').value.trim();
      const empid2 = document.getElementById('compareUser2').value.trim();

      if (!empid1 && !empid2) return alert("Enter at least one UserID to compare.");

      const fetchPromises = [];
      if (empid1) fetchPromises.push(fetch(`/get_employee_in_pattern?empid=${empid1}`).then(r => r.json()));
      if (empid2) fetchPromises.push(fetch(`/get_employee_in_pattern?empid=${empid2}`).then(r => r.json()));

      Promise.all(fetchPromises)
        .then(results => {
          const datasets = results.map((data, idx) => {
            if (data.error || !Array.isArray(data.in_times)) return null;
            return {
              label: `Emp ${data.empid}`,
              data: data.in_times,
              borderColor: getColor(idx + 5), // Avoid color clash
              fill: false,
              tension: 0.4,
              pointRadius: 2,
              pointHoverRadius: 4
            };
          }).filter(Boolean);

          if (!datasets.length) {
            alert("No valid IN time data to compare.");
            return;
          }

          const allTimes = datasets.flatMap(ds => ds.data);
          const minY = Math.floor(Math.min(...allTimes)) - 1;
          const maxY = Math.ceil(Math.max(...allTimes)) + 1;

          const ctx = document.getElementById('topConsistentChart').getContext('2d');
          if (topConsistentChartInstance) topConsistentChartInstance.destroy();

          topConsistentChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
              labels: datasets[0].data.map((_, i) => `Day ${i + 1}`),
              datasets
            },
            options: {
              plugins: {
                title: { display: true, text: 'IN Time Comparison' },
                tooltip: {
                  callbacks: {
                    label: ctx => {
                      const val = ctx.raw;
                      const h = Math.floor(val);
                      const m = Math.round((val - h) * 60);
                      return `${ctx.dataset.label}: ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                    }
                  }
                }
              },
              scales: {
                y: {
                  min: Math.max(minY, 5),
                  max: Math.min(maxY, 24),
                  ticks: {
                    callback: val => {
                      const h = Math.floor(val);
                      const m = Math.round((val - h) * 60);
                      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                    }
                  }
                }
              }
            }
          });
          document.getElementById('revertTopChartBtn').style.display = 'inline-block';

        })
        .catch(err => {
          console.error('[Compare ERROR]', err);
          alert("Something went wrong while comparing.");
        });
    });
  }
});
document.addEventListener('DOMContentLoaded', () => {
  const revertBtn = document.getElementById('revertTopChartBtn');
  if (revertBtn) {
    revertBtn.addEventListener('click', () => {
      if (topConsistentEmployees.length > 0) {
        renderTopConsistentChart(topConsistentEmployees);
      } else {
        alert("Top 5 data not available. Please reload the section.");
      }

      // Clear inputs and hide button
      document.getElementById('compareUser1').value = '';
      document.getElementById('compareUser2').value = '';
      revertBtn.style.display = 'none';
    });
  }
});




// ===== Utilities =====
function formatHour(decimal) {
  const h = Math.floor(decimal);
  const m = Math.round((decimal - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getColor(index) {
  const colors = ['#007bff', '#28a745', '#ffc107', '#17a2b8', '#dc3545'];
  return colors[index % colors.length];
}
