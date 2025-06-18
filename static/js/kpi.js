document.addEventListener("DOMContentLoaded", () => {
  const kpiSection = document.getElementById("kpiSection");
  const kpiContainer = document.querySelector(".kpi-container");
  const anomalyCard = document.getElementById("anomalyCard");

  const errorAudio = new Audio("/static/audio/jarvis_error.mp3");

  function setLoadingState(isLoading) {
    if (kpiContainer) {
      kpiContainer.classList.toggle("kpi-loader", isLoading);
    }
  }

  window.loadKPIData = function (date) {
    setLoadingState(true);

    fetch(`/get_kpi_data?date=${date}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) throw new Error(data.error);

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

        // Only play error alert if there's an anomaly
        if (isThreat) {
          try {
            errorAudio.pause();
            errorAudio.currentTime = 0;
            errorAudio.play();
          } catch (e) {
            console.warn("Error audio playback failed:", e);
          }
        }
      })
      .catch(err => {
        console.error("Error fetching KPI:", err);
        alert("Failed to fetch KPI data.");
      })
      .finally(() => setLoadingState(false));
  };
});
