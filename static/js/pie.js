let pieChartInstance = null;

async function fetchDailyPieChart() {
  const viewMode = document.getElementById("viewMode").value;
  const selectedDate = document.getElementById("datePicker").value;
  const pieCard = document.getElementById("dailyPieCard");

  pieCard.style.display = "none";
  if (viewMode !== "Daily") return;

  try {
    const response = await fetch(`/get_daily_pie_data?date=${selectedDate}`);
    const result = await response.json();

    if (!result.data || result.data.length === 0) {
      handlePieChartError();
      return;
    }

    // Standardize labels for sorting
    const timeBinOrder = ["Before 9", "9-10", "10-11", "11-12", "12-1", "1-2", "After 2"];
    result.data.sort((a, b) => {
      const getKey = (label) => {
        const trimmed = label.trim();
        if (trimmed === "Before 9") return "Before 9";
        if (trimmed === "After 2") return "After 2";
        if (trimmed.includes("-")) {
          const parts = trimmed.split("-").map(p => p.trim());
          return `${parts[0]}-${parts[1]}`;
        }
        return trimmed;
      };
    return timeBinOrder.indexOf(getKey(a.label)) - timeBinOrder.indexOf(getKey(b.label));
    });
    
    // Format labels for display
    const formattedLabels = result.data.map(item => {
      const bin = item.label.trim();
      if (bin === "Before 9") return "Before 9:00";
      if (bin === "After 2") return "After 2:00";
      const [start, end] = bin.split("-").map(p => p.trim());
      return `${start}:00 - ${end}:00`;
    });


    const counts = result.data.map(item => item.count);
    const percentages = result.data.map(item => item.percentage);
    const backgroundColors = [
      "#4CAF50", "#2196F3", "#FFC107", "#FF5722",
      "#9C27B0", "#3F51B5", "#795548", "#00BCD4"
    ];

    // ✅ Show pie card before rendering
    pieCard.style.display = "block";

    // ✅ Wait for DOM to update before rendering chart
    requestAnimationFrame(() => {
      const ctx = document.getElementById("dailyPieChart").getContext("2d");

      if (pieChartInstance) pieChartInstance.destroy();

      const legendColor = getComputedStyle(document.documentElement).getPropertyValue('--pie-label-color').trim();

      pieChartInstance = new Chart(ctx, {
        type: "pie",
        data: {
          labels: formattedLabels,
          datasets: [{
            data: counts,
            backgroundColor: backgroundColors.slice(0, formattedLabels.length),
            borderWidth: 1,
            borderColor: "#fff",
            borderRadius: 6,
            hoverOffset: 12
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            animateRotate: true,
            animateScale: true,
            duration: 1500,
            easing: 'easeOutCirc'
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: function (context) {
                  const label = context.label || "";
                  const count = context.raw;
                  const percent = percentages[context.dataIndex] || 0;
                  return `${label}\n ${count} employees (${percent}%)`;
                }
              }
            },
            legend: {
              position: 'right',
              labels: {
                boxWidth: 16,
                padding: 10,
                color: legendColor,
                font: {
                  size: 13,
                  weight: '500'
                },
                generateLabels: function (chart) {
                  const data = chart.data;
                  if (data.labels.length && data.datasets.length) {
                    return data.labels.map((label, i) => {
                      const backgroundColor = data.datasets[0].backgroundColor[i];
                      return {
                        text: label,
                        fillStyle: backgroundColor,
                        strokeStyle: "#fff",
                        lineWidth: 1,
                        hidden: false,
                        index: i
                      };
                    });
                  }
                  return [];
                }
              }
            },
            title: {
              display: true,
              text: 'Attendance In-Time Statistics',
              font: {
                size: 18,
                weight: 'bold'
              }
            }
          },
          layout: {
            padding: 10
          }
        }
      });

      // ✅ Explicit resize for safety
      pieChartInstance.resize();
    });

  } catch (error) {
    console.error("Error fetching pie chart:", error);
    handlePieChartError();
  }
}

function handlePieChartError() {
  const pieCard = document.getElementById("dailyPieCard");
  pieCard.style.display = "none";
  Toastify({
    text: "No punch-in data available for the selected date.",
    duration: 3000,
    gravity: "top", // must be set, but will be overridden by custom style
    position: "center",
    backgroundColor: "#ff6b6b",
    close: true,
    className: "center-toast" // 👈 Add this custom class
  }).showToast();
}
