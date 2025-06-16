document.addEventListener("DOMContentLoaded", () => {
  const dateInput = document.querySelector("#datePicker");

  // Load error audio
  const errorAudio = new Audio("/static/audio/jarvis_anomaly.mp3");

  function fetchKPI(date) {
    fetch(`/get_kpi_data?date=${date}`)
      .then(res => res.json())
      .then(data => {
        // Correctly mapped element IDs
        const idMap = {
          totalEmployees: data.total_employees,
          avgLogin: data.avg_login,
          mismatchesToday: data.mismatches_today,
          earliestLogin: data.earliest_login,
          earliestLoginUser: `User: ${data.earliest_user ?? "N/A"}`,
          lastLogout: data.last_logout,
          lastLogoutUser: `User: ${data.last_user ?? "N/A"}`
        };

        // Update all elements if they exist
        for (let id in idMap) {
          const el = document.getElementById(id);
          if (el) el.textContent = idMap[id] ?? "N/A";
          else console.warn(`Missing element with ID: ${id}`);
        }

        // Play error sound if anomaly is detected
        if (data.anomaly_detected) {
          errorAudio.play();
        }
      })
      .catch(err => console.error("Error fetching KPI:", err));
  }

  // Set default to today and fetch initial KPI
  const today = new Date().toISOString().split("T")[0];
  if (dateInput) {
    dateInput.value = today;
    fetchKPI(today);
    dateInput.addEventListener("change", () => fetchKPI(dateInput.value));
  }
});
