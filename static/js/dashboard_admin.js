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
      }
    }
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

  // ============ Fetch Weekly KPI =============
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
});
