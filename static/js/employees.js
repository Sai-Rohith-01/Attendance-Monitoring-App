document.addEventListener('DOMContentLoaded', () => {
  const employeeContainer = document.getElementById('employeeContainer');
  const searchInput = document.getElementById('employeeSearchInput');
  const presenceFilter = document.getElementById('presenceFilter');
  const avgPresenceStat = document.getElementById('avgPresenceStat');
  const above8Count = document.getElementById('above8Count');
  const below6Count = document.getElementById('below6Count');
  const flaggedOnlyCheckbox = document.getElementById('flaggedOnlyCheckbox'); // Presence checkbox
  const flaggedContainer = document.getElementById('flaggedEmployeesContainer');

  let allEmployees = [];
  let performanceEmployees = [];

  function isAnomalousEmployee(emp) {
    return parseFloat(emp.Avg_Presence_Hours) > 12;
  }

  // Sidebar navigation
  document.getElementById('dashboardBtn').addEventListener('click', () => showSection('dashboardSection'));
  document.getElementById('employeesBtn').addEventListener('click', () => {
    showSection('employeeSection');
    document.querySelectorAll('.employee-subsection').forEach(sec => sec.style.display = 'none');
    document.querySelectorAll('.employee-toggle').forEach(btn => btn.classList.remove('active'));
  });
  document.getElementById('reportsBtn').addEventListener('click', () => showSection('reportsSection'));
  document.getElementById('analyticsBtn').addEventListener('click', () => showSection('analyticsSection'));

  function showSection(sectionIdToShow) {
    const allSections = ['dashboardSection', 'employeeSection', 'reportsSection', 'analyticsSection'];
    allSections.forEach(sectionId => {
      const el = document.getElementById(sectionId);
      if (el) el.style.display = sectionId === sectionIdToShow ? 'block' : 'none';
    });

    const dashboardHeader = document.getElementById('dashboardHeader');
    if (dashboardHeader) dashboardHeader.style.display = sectionIdToShow === 'dashboardSection' ? 'block' : 'none';

    const dashboardControls = document.getElementById('dashboardControls');
    if (dashboardControls) dashboardControls.style.display = sectionIdToShow === 'dashboardSection' ? 'flex' : 'none';

    const buttonMap = {
      dashboardSection: 'dashboardBtn',
      employeeSection: 'employeesBtn',
      reportsSection: 'reportsBtn',
      analyticsSection: 'analyticsBtn'
    };

    document.querySelectorAll('.sidebar-item').forEach(item => item.classList.remove('active'));
    const btnId = buttonMap[sectionIdToShow];
    const activeBtn = document.getElementById(btnId);
    if (activeBtn) activeBtn.classList.add('active');
  }

  window.collapseSection = function (sectionId) {
    const section = document.getElementById(sectionId);
    if (section) section.style.display = 'none';

    const toggleId = sectionId.replace('Section', 'Toggle');
    const toggleBtn = document.getElementById(toggleId);
    if (toggleBtn) toggleBtn.classList.remove('active');
  };

  document.querySelectorAll('.employee-toggle').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.employee-toggle').forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');

      document.querySelectorAll('.employee-subsection').forEach(section => section.style.display = 'none');

      const targetId = button.getAttribute('data-target');
      const targetSection = document.getElementById(targetId);
      if (targetSection) targetSection.style.display = 'block';

      if (targetId === 'employeeDirectory') {
        if (allEmployees.length === 0) {
          fetchEmployeeData();
        } else {
          applyFilters();
        }
      }
    });
  });

  async function fetchEmployeeData() {
    try {
      const response = await fetch('/get_all_employees');
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('Invalid response');
      allEmployees = data;
      applyFilters();
    } catch (err) {
      console.error('[ERROR] Fetching employee data:', err);
      employeeContainer.innerHTML = '<p>Error loading employee records.</p>';
    }
  }

  async function fetchPerformanceData() {
    try {
      const response = await fetch('/get_performance_scores');
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('Invalid response');
      performanceEmployees = data;
    } catch (err) {
      console.error('[ERROR] Fetching performance scores:', err);
    }
  }

  function applyFilters() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    const presenceLevel = presenceFilter.value;
    const showFlaggedOnly = flaggedOnlyCheckbox && flaggedOnlyCheckbox.checked;

    let filtered = [...allEmployees];

    // Search by ID
    if (searchTerm !== '') {
      if (/^\d+$/.test(searchTerm)) {
        filtered = filtered.filter(emp => emp.EmployeeID.toString() === searchTerm);
      }
    }

    // Filter by presence level
    filtered = filtered.filter(emp => {
      const hours = parseFloat(emp.Avg_Presence_Hours);
      if (presenceLevel === 'high') return hours > 8;
      if (presenceLevel === 'medium') return hours >= 6 && hours <= 8;
      if (presenceLevel === 'low') return hours < 6;
      return true;
    });

    // Filter only flagged if checked
    if (showFlaggedOnly) {
      filtered = filtered.filter(isAnomalousEmployee);
    }

    renderEmployeeCards(filtered);
    if (showFlaggedOnly) {
      renderFlaggedEmployeesSection(filtered);
    } else {
      flaggedContainer.innerHTML = '';
    }
    updateStats(filtered);
  }

  function renderEmployeeCards(list) {
    employeeContainer.innerHTML = '';
    if (list.length === 0) {
      employeeContainer.innerHTML = '<p>No matching employees found.</p>';
      return;
    }

    list.forEach(emp => {
      const card = document.createElement('div');
      card.className = 'employee-card';
      if (isAnomalousEmployee(emp)) {
        card.classList.add('flagged');
        card.setAttribute('title', 'Avg Hours exceeds threshold');
      }
      card.innerHTML = `
        <div class="employee-id">Employee #${emp.EmployeeID}</div>
        <div class="employee-stats">
          <p><strong>Avg Hours:</strong> ${emp.Avg_Presence_Hours} hrs</p>
          <p><strong>Total Days:</strong> ${emp.Total_Days}</p>
        </div>
      `;
      employeeContainer.appendChild(card);
    });
  }

  function updateStats(filteredList) {
    if (!Array.isArray(filteredList) || filteredList.length === 0) {
      avgPresenceStat.textContent = '--';
      above8Count.textContent = '--';
      below6Count.textContent = '--';
      return;
    }

    const totalHours = filteredList.reduce((sum, emp) => sum + parseFloat(emp.Avg_Presence_Hours || 0), 0);
    const avg = (totalHours / filteredList.length).toFixed(2);
    const above8 = filteredList.filter(emp => parseFloat(emp.Avg_Presence_Hours) > 8).length;
    const below6 = filteredList.filter(emp => parseFloat(emp.Avg_Presence_Hours) < 6).length;

    avgPresenceStat.textContent = avg;
    above8Count.textContent = above8;
    below6Count.textContent = below6;
  }

  function renderFlaggedEmployeesSection(list) {
    if (!flaggedContainer) return;
    const flagged = list.filter(isAnomalousEmployee);
    flaggedContainer.innerHTML = '';

    if (flagged.length === 0) {
      flaggedContainer.innerHTML = '<p>No flagged employees for this filter.</p>';
      return;
    }

    flagged.forEach(emp => {
      const card = document.createElement('div');
      card.className = 'employee-card flagged';
      card.setAttribute('title', 'Avg Hours exceeds threshold');
      card.innerHTML = `
        <div class="employee-id">Employee #${emp.EmployeeID}</div>
        <div class="employee-stats">
          <p><strong>Avg Hours:</strong> ${emp.Avg_Presence_Hours} hrs</p>
          <p><strong>Total Days:</strong> ${emp.Total_Days}</p>
        </div>
      `;
      flaggedContainer.appendChild(card);
    });
  }

  // Event bindings
  searchInput.addEventListener('input', applyFilters);
  presenceFilter.addEventListener('change', applyFilters);
  if (flaggedOnlyCheckbox) {
    flaggedOnlyCheckbox.addEventListener('change', applyFilters);
  }

  document.getElementById('performanceSectionToggle').addEventListener('click', () => {
    document.querySelectorAll('.employee-toggle').forEach(btn => btn.classList.remove('active'));
    document.getElementById('performanceSectionToggle').classList.add('active');

    document.querySelectorAll('.employee-subsection').forEach(sec => sec.style.display = 'none');
    document.getElementById('performanceSection').style.display = 'block';

    fetchPerformanceData().then(() => {
      renderTopEmployees();
      renderBottomEmployees();
    });
  });

  function renderTopEmployees() {
    const topContainer = document.getElementById('topEmployeesContainer');
    if (!topContainer) return;

    topContainer.innerHTML = '';
    const data = performanceEmployees.slice().sort((a, b) => b.Final_Score - a.Final_Score).slice(0, 5);

    data.forEach(emp => {
      const card = document.createElement('div');
      card.className = 'employee-card';
      card.innerHTML = `
        <div class="employee-id">Employee #${emp.EmployeeID}</div>
        <div class="employee-stats">
          <p><strong>Final Score:</strong> ${emp.Final_Score}</p>
          <p><strong>Avg Hours:</strong> ${emp.Avg_Presence_Hours} hrs</p>
          <p><strong>Total Days:</strong> ${emp.Total_Days}</p>
        </div>
      `;
      topContainer.appendChild(card);
    });
  }

  function renderBottomEmployees() {
    const bottomContainer = document.getElementById('bottomEmployeesContainer');
    if (!bottomContainer) return;

    bottomContainer.innerHTML = '';
    const data = performanceEmployees.slice().sort((a, b) => a.Final_Score - b.Final_Score).slice(0, 5);

    data.forEach(emp => {
      const card = document.createElement('div');
      card.className = 'employee-card';
      card.innerHTML = `
        <div class="employee-id">Employee #${emp.EmployeeID}</div>
        <div class="employee-stats">
          <p><strong>Final Score:</strong> ${emp.Final_Score}</p>
          <p><strong>Avg Hours:</strong> ${emp.Avg_Presence_Hours} hrs</p>
          <p><strong>Total Days:</strong> ${emp.Total_Days}</p>
        </div>
      `;
      bottomContainer.appendChild(card);
    });
  }

  function renderGlobalFlaggedSection() {
  const container = document.getElementById('flaggedOnlyContainer');
  if (!container || !Array.isArray(allEmployees)) return;

  const flagged = allEmployees.filter(isAnomalousEmployee);
  container.innerHTML = '';

  if (flagged.length === 0) {
    container.innerHTML = '<p>No flagged employees found.</p>';
    return;
  }

  flagged.forEach(emp => {
    const card = document.createElement('div');
    card.className = 'employee-card flagged';
    card.setAttribute('title', 'Avg Hours exceeds threshold');
    card.innerHTML = `
      <div class="employee-id">Employee #${emp.EmployeeID}</div>
      <div class="employee-stats">
        <p><strong>Avg Hours:</strong> ${emp.Avg_Presence_Hours} hrs</p>
        <p><strong>Total Days:</strong> ${emp.Total_Days}</p>
      </div>
    `;
    container.appendChild(card);
  });
}
document.getElementById('flaggedSectionToggle').addEventListener('click', () => {
  document.querySelectorAll('.employee-toggle').forEach(btn => btn.classList.remove('active'));
  document.getElementById('flaggedSectionToggle').classList.add('active');

  document.querySelectorAll('.employee-subsection').forEach(sec => sec.style.display = 'none');
  document.getElementById('flaggedSection').style.display = 'block';

  renderGlobalFlaggedSection();
});


// ========= Chart Instances (optional for future chart display) =========
let employeeChart1 = null;
let employeeChart2 = null;
let employeeChart3 = null; 

// ========= Known Date Columns =========
const dateColumns = ['DATE_NEW', 'DATE_SORT', 'IN', 'OUT'];

// ========= Load Employee Data & Render =========
document.getElementById('loadEmployeeBtn').addEventListener('click', async () => {
  const userId = document.getElementById('employeeIdInput').value.trim();
  const view = document.getElementById('employeeView').value;
  const month = document.getElementById('employeeMonth').value;
  const displayMode = document.getElementById('employeeDisplayMode').value;
  const output = document.getElementById('employeeOutput');
  const chartContainer = document.getElementById('employeeVisualOutput');

  // Clear UI
  output.innerHTML = '';
  if (chartContainer) chartContainer.style.display = 'none';

  if (!userId) {
    output.innerHTML = `<p class="no-data">⚠️ Please enter a valid Employee ID.</p>`;
    return;
  }

  const url = new URL('/get_employee_data', window.location.origin);
  url.searchParams.append('user_id', userId);
  url.searchParams.append('view', view);
  if (month) url.searchParams.append('month', month);

  try {
    const res = await fetch(url);
    const result = await res.json();
console.log('[DEBUG] Employee data response:', result);

let records = [];

if (Array.isArray(result)) {
  records = result;
} else if (Array.isArray(result.data)) {
  records = result.data;
} else {
  output.innerHTML = `<p class="no-data">❗ Invalid response format.</p>`;
  return;
}

if (records.length === 0) {
  output.innerHTML = `<p class="no-data">❗ No records found for the selected employee and month.</p>`;
  return;
}



    if (displayMode === 'charts') {
  output.innerHTML = '';
  if (chartContainer) {
    chartContainer.style.display = 'block';
    renderEmployeeCharts(records, view);
  }
} else {
  if (chartContainer) chartContainer.style.display = 'none';
  output.appendChild(renderEmployeeTable(records, view));
}


  } catch (err) {
    console.error(err);
    output.innerHTML = `<p class="no-data">🚫 Failed to load employee data. Please try again later.</p>`;
  }
});

// ========= Generate Report (OPEN IN NEW TAB) =========
document.getElementById('generateReportBtn').addEventListener('click', () => {
  const empId = document.getElementById('employeeIdInput').value.trim();
  const monthInput = document.getElementById('employeeMonth').value;

  let month = '';
if (monthInput) {
  const num = parseInt(monthInput);
  if (!isNaN(num) && num >= 1 && num <= 12) {
    const currentYear = new Date().getFullYear();
    month = `${currentYear}-${String(num).padStart(2, '0')}`;
  } else {
    alert('Invalid month selected.');
    return;
  }
}


  if (!empId) {
    alert('Please enter a valid employee ID');
    return;
  }

  const url = `/view_employee_report?empid=${encodeURIComponent(empId)}${month ? `&month=${month}` : ''}`;
  const win = window.open(url, '_blank');
  if (!win) {
    alert('Popup blocked! Please allow popups for this site.');
  }
});


// ========= Render Table View =========
function renderEmployeeTable(data, view) {
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const tbody = document.createElement('tbody');

  const columnLabels = {
    'Userid': 'User ID',
    'DATE_NEW': 'Date',
    'IN': 'Punch-In',
    'OUT': 'Punch-Out',
    'Duration': 'Total Hours',
    'Mismatch_Flag': 'Status'
  };

  const ignoredColumns = ['DATE_SORT', 'Presence_Hours_Capped'];
  let columns = Object.keys(data[0]).filter(col => !ignoredColumns.includes(col));

  // Move 'Userid' to the front if it exists
  if (columns.includes('Userid')) {
    columns = ['Userid', ...columns.filter(c => c !== 'Userid')];
  }

  // Header
  const headerRow = document.createElement('tr');
  columns.forEach(col => {
    const th = document.createElement('th');
    th.textContent = columnLabels[col] || col;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  // Rows
  data.forEach(row => {
    const tr = document.createElement('tr');

    columns.forEach(col => {
      const td = document.createElement('td');

      if (col === 'Mismatch_Flag') {
        const status = String(row[col]).trim().toLowerCase();
        if (status === 'ok') {
          td.textContent = 'OK';
          td.style.color = 'green';
        } else {
          td.textContent = 'Mismatch';
          td.style.color = 'red';
        }
        td.style.fontWeight = 'bold';
      }

      else if (col === 'Duration') {
        const val = parseFloat(row[col]);
        td.textContent = isNaN(val) ? '—' : val.toFixed(2);
      }

      else if (col === 'IN' || col === 'OUT') {
        const val = row[col];
        const time = new Date(val);
        if (!isNaN(time.getTime())) {
          td.textContent = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
          td.textContent = '—';
        }
      }

      else {
        td.textContent = row[col] !== null && row[col] !== undefined ? String(row[col]) : '—';
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(thead);
  table.appendChild(tbody);
  return table;
}


// ========= Format Cell Values =========
function formatCell(value, column) {
  if (value === null || value === undefined || value === 'NaT') return '—';

  // Format IN/OUT as HH:mm
  if ((column === 'IN' || column === 'OUT') && !isNaN(Date.parse(value))) {
    const time = new Date(value);
    return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Format DATE_NEW
  if (column === 'DATE_NEW' && !isNaN(Date.parse(value))) {
    const date = new Date(value);
    return `${String(date.getDate()).padStart(2, '0')}/` +
           `${String(date.getMonth() + 1).padStart(2, '0')}/` +
           `${date.getFullYear()}`;
  }

  // Format hours
  if ((column === 'Duration' || column === 'Presence_Hours') && typeof value === 'number') {
    return value.toFixed(2);
  }

  // Format boolean
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  return value;
}







// ========= OPTIONAL: Render Charts (future extension) =========
function renderEmployeeCharts(data, view) {
  const ctx1 = document.getElementById('employeeChart1')?.getContext('2d');
  const ctx2 = document.getElementById('employeeChart2')?.getContext('2d');

  if (employeeChart1) employeeChart1.destroy();
  if (employeeChart2) employeeChart2.destroy();
  if (employeeChart3) employeeChart3.destroy();

  if (view === 'attendance') {
    const labels = data.map(d => formatChartDate(d.DATE_NEW));
    const hours = data.map(d => d.Presence_Hours);
    const expectedHours = 8;
    const deviations = data.map(d => (d.Presence_Hours ?? 0) - expectedHours);

    employeeChart1 = new Chart(ctx1, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Presence Hours',
          data: hours,
          borderColor: 'blue',
          backgroundColor: 'rgba(0, 0, 255, 0.1)',
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Daily Presence Hours'
          },
          tooltip: {
            callbacks: {
              title: function(tooltipItems) {
                const rawDate = tooltipItems[0].label; // this is "dd/mm/yyyy"
                const [day, month, year] = rawDate.split('/');
                const dateObj = new Date(`${year}-${month}-${day}`);
                const dayName = dateObj.toLocaleDateString(undefined, { weekday: 'long' });
                return `${dayName}, ${rawDate}`;  // e.g., "Monday, 24/06/2025"
                }
                
              }
            }
          }
        }
      });

employeeChart2 = new Chart(ctx2, {
  type: 'bar',
  data: {
    labels: labels,
    datasets: [{
      label: 'Deviation from Expected Hours (8 hrs)',
      data: deviations,
      backgroundColor: deviations.map(val => val >= 0 ? '#27ae60' : '#e74c3c') // green for overwork, red for under
    }]
  },
  options: {
    responsive: true,
    plugins: {
      title: {
        display: true,
        text: 'Daily Deviation from 8-Hour Standard'
      },
      tooltip: {
        callbacks: {
          title: function(tooltipItems) {
                const rawDate = tooltipItems[0].label; // this is "dd/mm/yyyy"
                const [day, month, year] = rawDate.split('/');
                const dateObj = new Date(`${year}-${month}-${day}`);
                const dayName = dateObj.toLocaleDateString(undefined, { weekday: 'long' });
                return `${dayName}, ${rawDate}`;  // e.g., "Monday, 24/06/2025"
                },
          label: function(context) {
            const value = context.raw;
            return (value >= 0 ? '+' : '') + value.toFixed(2) + ' hrs';
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: false,
        title: {
          display: true,
          text: 'Hours (+/-)'
        },
        grid: {
          color: function(context) {
            return context.tick.value === 0 ? '#000' : '#ccc';
          },
          lineWidth: function(context) {
            return context.tick.value === 0 ? 2 : 1;
          }
        }
      }
    }
  }
});

  }

  if (view === 'punchlog') {
  const ctx1 = document.getElementById('employeeChart1').getContext('2d');
  if (employeeChart1) employeeChart1.destroy();
  if (employeeChart2) employeeChart2.destroy();
  if (employeeChart3) employeeChart3.destroy();

 

  const inData = [];
  const outData = [];

  data.forEach(entry => {
    const rawDate = entry.DATE_NEW;
    const dateObj = new Date(rawDate);  // ISO or parseable date string
    const label = formatChartDate(rawDate); // formatted for axis
    const day = dateObj.toLocaleDateString('en-US', { weekday: 'short' });

    if (entry.IN) {
      const inTime = new Date(entry.IN);
      inData.push({
        x: label,
        y: inTime.getHours() + inTime.getMinutes() / 60,
        fullTime: inTime.toLocaleTimeString(),
        day
      });
    }

    if (entry.OUT) {
      const outTime = new Date(entry.OUT);
      outData.push({
        x: label,
        y: outTime.getHours() + outTime.getMinutes() / 60,
        fullTime: outTime.toLocaleTimeString(),
        day
      });
    }
  });

  employeeChart1 = new Chart(ctx1, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'IN',
          data: inData,
          backgroundColor: '#3498db',
          pointStyle: 'circle',
          pointRadius: 6,
          hoverRadius: 8
        },
        {
          label: 'OUT',
          data: outData,
          backgroundColor: '#e67e22',
          pointStyle: 'triangle',
          pointRadius: 6,
          hoverRadius: 8
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            usePointStyle: true,
            padding: 20
          }
        },
        title: {
          display: true,
          text: 'Employee Punch Log',
          font: {
            size: 18
          }
        },
        tooltip: {
          callbacks: {
            title: (ctx) => {
              const { x, day } = ctx[0].raw;
              return `${x} (${day})`;
            },
            label: (ctx) => {
              return `Time: ${ctx.raw.fullTime}`;
            }
          }
        }
      },
      animation: {
        duration: 800,
        easing: 'easeOutQuart'
      },
      scales: {
        x: {
          type: 'category',
          title: {
            display: true,
            text: 'Date'
          },
          ticks: {
            autoSkip: true,
            maxRotation: 60,
            minRotation: 45
          },
          grid: {
            color: '#eee'
          }
        },
        y: {
          min: 0,
          max: 24,
          title: {
            display: true,
            text: 'Time (HH:mm)'
          },
          ticks: {
            stepSize: 1,
            callback: val => {
              const h = Math.floor(val);
              const m = Math.round((val - h) * 60);
              return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            }
          },
          grid: {
            color: '#eee'
          }
        }
      }
    }
  });
}

if (view === 'performance') {
  const ctx3 = document.getElementById('employeeChart3').getContext('2d');

  if (employeeChart1) employeeChart1.destroy();
  if (employeeChart2) employeeChart2.destroy();
  if (employeeChart3) employeeChart3.destroy();

  const radarCanvas = document.getElementById('employeeChart3');
  radarCanvas.style.display = 'block';
  radarCanvas.style.width = '500px';
  radarCanvas.style.height = '500px';
  radarCanvas.style.margin = '-30px auto 0 auto';

  const avgPresence = data[0].Avg_Hours_Norm ?? 0;
  const avgPunctuality = data[0].Days_Worked_Norm ?? 0;
  const avgConsistency = data[0].Consistency_Score ?? 0;

  employeeChart3 = new Chart(ctx3, {
    type: 'radar',
    data: {
      labels: ['Avg Hours', 'Days Worked', 'Consistency'],
      datasets: [{
        label: 'Performance Components',
        data: [avgPresence, avgPunctuality, avgConsistency],
        backgroundColor: 'rgba(52, 152, 219, 0.2)',
        borderColor: '#3498db',
        pointBackgroundColor: '#3498db'
      }]
    },
    options: {
      responsive: true,
      layout: {
        padding: 10
      },
      plugins: {
        title: {
          display: true,
          text: 'Normalized Component Scores'
        },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.label}: ${ctx.raw?.toFixed(2)}`
          }
        }
      },
      scales: {
        r: {
          min: 0,
          max: 1,
          ticks: {
            stepSize: 0.2,
            backdropColor: 'transparent'
          },
          grid: {
            circular: true,
            color: '#ccc'
          },
          pointLabels: {
            font: {
              size: 12
            }
          }
        }
      }
    }
  });
}








  

  // You can later add punchlog/performance chart render logic here
}

function formatChartDate(dateStr) {
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function average(arr) {
  const filtered = arr.filter(v => typeof v === 'number' && !isNaN(v));
  if (filtered.length === 0) return 0;
  const sum = filtered.reduce((a, b) => a + b, 0);
  return sum / filtered.length;
}




});
