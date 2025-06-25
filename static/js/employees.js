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

});
