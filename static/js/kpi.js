document.addEventListener("DOMContentLoaded", () => {
  const kpiSection = document.getElementById("kpiSection");
  const kpiContainer = document.querySelector("#kpiSection .kpi-container");
  const weeklyKPISection = document.getElementById("weeklyKPISection");
  const weeklyKPIContainer = document.querySelector("#weeklyKPISection");
  const anomalyCard = document.getElementById("anomalyCard");
  const errorAudio = new Audio("/static/audio/jarvis_error.mp3");

  function setLoadingState(isLoading, mode = "daily") {
    if (mode === "daily" && kpiContainer) {
      kpiContainer.classList.toggle("kpi-loader", isLoading);
    }
    if (mode === "weekly" && weeklyKPIContainer) {
      weeklyKPIContainer.classList.toggle("kpi-loader", isLoading);
    }
  }

  // ================= DAILY KPI =================
  window.loadKPIData = function (date) {
    setLoadingState(true, "daily");
    kpiSection.style.display = "none";
    console.log("🔍 Fetching Daily KPI for:", date);

    fetch(`/get_kpi_data?date=${date}`)
      .then(res => res.json())
      .then(data => {
        if (!data || data.total_employees === 0) {
          showError("No data found for the selected date.");
          return;
        }


        const idMap = {
          totalEmployees: data.total_employees,
          avgLogin: data.avg_login,
          mismatchesToday: data.mismatches_today,
          earliestLogin: data.earliest_login,
          earliestLoginUser: `User: ${data.earliest_user ?? "N/A"}`,
          lastLogout: data.last_logout,
          lastLogoutUser: `User: ${data.last_user ?? "N/A"}`
        };

        for (let id in idMap) {
          const el = document.getElementById(id);
          if (el) el.textContent = idMap[id] ?? "N/A";
        }

        document.getElementById("earlyLoginCount").textContent = data.early_login_count ?? 0;
        document.getElementById("earlyLoginUsers").textContent = `Users: ${(data.early_login_users || []).join(", ") || "--"}`;
        document.getElementById("lateLogoutCount").textContent = data.late_logout_count ?? 0;
        document.getElementById("lateLogoutUsers").textContent = `Users: ${(data.late_logout_users || []).join(", ") || "--"}`;

        const isThreat = (data.early_login_count > 0 || data.late_logout_count > 0);
        anomalyCard?.classList.toggle("threat", isThreat);
        anomalyCard?.classList.toggle("safe", !isThreat);

        // ✅ Play JARVIS error audio only if anomaly is detected
        if (isThreat) {
          try {
            errorAudio.pause();
            errorAudio.currentTime = 0;
            errorAudio.play();
          } catch (e) {
            console.warn("Error audio playback failed:", e);
          }
        }

        kpiSection.style.display = "block";
      })
      .catch(err => {
        console.error("Error fetching Daily KPI:", err);
        kpiSection.style.display = "none";
        showError("Failed to fetch KPI data.");
      })
      .finally(() => setLoadingState(false, "daily"));
  };

  // ================= WEEKLY KPI =================
  window.renderWeeklyKPI = function (data) {
    setLoadingState(true, "weekly");

    try {
      if (!data || !Array.isArray(data.attendance_by_day) || data.attendance_by_day.length === 0) {
        weeklyKPISection.style.display = "none";
        return showError("No weekly KPI data found for the selected date.");
      }

      const avgAttendance = data.average_attendance_percent || '--';
      const punctualDay = data.most_punctual_day || {};

      const attendanceValueEl = document.getElementById("weeklyAvgAttendanceValue");
      const punctualDayEl = document.getElementById("mostPunctualDayValue");
      const punctualTimeEl = document.getElementById("mostPunctualTimeValue");

      if (attendanceValueEl) attendanceValueEl.textContent = `${avgAttendance}%`;
      if (punctualDayEl) punctualDayEl.textContent = punctualDay.day || '--';
      if (punctualTimeEl) punctualTimeEl.textContent = punctualDay.avg_punch_in || '--';

      weeklyKPISection.style.display = "flex";
      console.log("✅ Weekly KPI data rendered:", data);
    } catch (err) {
      console.error("Error rendering Weekly KPI:", err);
      weeklyKPISection.style.display = "none";
      showError("Failed to render Weekly KPI.");
    } finally {
      setLoadingState(false, "weekly");
    }
  };

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
});
