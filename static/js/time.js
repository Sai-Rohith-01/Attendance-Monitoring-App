// ===== Toggle Timing Insights View =====
document.addEventListener('DOMContentLoaded', () => {
  const timingTab = document.getElementById('timingInsightsTab');
  const timingSection = document.getElementById('timingInsightsSection');

  if (!timingTab || !timingSection) return;

  timingTab.addEventListener('click', () => {
    // Hide ALL sections first
    document.querySelectorAll('.main-section, #dashboardSection, #employeeSection, #analyticsSection, #reportsSection').forEach(sec => {
      sec.style.display = 'none';
    });

    // Activate this section
    timingSection.style.display = 'block';

    // Remove 'active' from all sidebar items
    document.querySelectorAll('.sidebar-item').forEach(item => item.classList.remove('active'));
    timingTab.classList.add('active');

    // Load insights
    loadTimingInsights(); // Call only if data needs fetching
  });
});

function switchSection(sectionId) {
  document.querySelectorAll('.main-section, #dashboardSection, #employeeSection, #analyticsSection, #reportsSection').forEach(sec => {
    sec.style.display = 'none';
  });
  document.getElementById(sectionId).style.display = 'block';

  document.querySelectorAll('.sidebar-item').forEach(item => item.classList.remove('active'));
  document.querySelector(`[id$="${sectionId.replace('Section','')}Tab"]`)?.classList.add('active');
}


// ======= Timing Insights JS =======

document.addEventListener('DOMContentLoaded', () => {
  const timingTab = document.getElementById('timingInsightsTab');
  const timingSection = document.getElementById('timingInsightsSection');

  if (!timingTab || !timingSection) {
    console.warn('[Timing] Sidebar or section not found.');
    return;
  }

  timingTab.addEventListener('click', () => {
    // Hide all sections
    document.querySelectorAll('.main-section').forEach(sec => sec.style.display = 'none');
    
    // Show Timing Insights section
    timingSection.style.display = 'block';

    // Load insights (only if not loaded already or always if dynamic)
    loadTimingInsights();
  });
});

function loadTimingInsights() {
  console.log('[Timing] Loading timing insights...');
  
  fetch('/get_timing_insights')
    .then(res => res.json())
    .then(data => {
      if (data.error) throw new Error(data.error);
      
      renderTimingCards(data);
      renderAvgInOutChart(data);
      // Other renderers can be added later
    })
    .catch(err => {
      console.error('[Timing ERROR]', err);
      document.getElementById('timingCardsRow').innerHTML = `<p class="text-danger">Failed to load insights.</p>`;
    });
}

function renderTimingCards(data) {
  const row = document.getElementById('timingCardsRow');
  row.innerHTML = '';

  const cardMap = {
    avg_in_time: 'Average IN Time',
    avg_out_time: 'Average OUT Time',
    avg_duration: 'Avg Daily Duration',
    punctual_count: 'Punctual Employees',
    consistent_count: 'Consistent Workers'
  };

  Object.entries(cardMap).forEach(([key, label]) => {
    const value = data[key] ?? '-';
    const card = document.createElement('div');
    card.className = 'col-md-2 timing-card';
    card.innerHTML = `
      <div class="card text-center p-3 shadow-sm">
        <h6 class="text-muted">${label}</h6>
        <h4>${value}</h4>
      </div>
    `;
    row.appendChild(card);
  });
}

function renderAvgInOutChart(data) {
  const ctx = document.getElementById('avgInOutChart').getContext('2d');

  const labels = data.avg_times_by_day?.map(d => d.day) || [];
  const inTimes = data.avg_times_by_day?.map(d => parseFloat(d.avg_in)) || [];
  const outTimes = data.avg_times_by_day?.map(d => parseFloat(d.avg_out)) || [];

  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Avg IN Time',
          data: inTimes,
          borderColor: '#007bff',
          tension: 0.3
        },
        {
          label: 'Avg OUT Time',
          data: outTimes,
          borderColor: '#28a745',
          tension: 0.3
        }
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
          min: 6,
          max: 22,
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
