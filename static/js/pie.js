let pieChart;

function loadPieChart(date) {
    const chartCard = document.getElementById('chartCard');
    const chartCanvas = document.getElementById('arrivalPieChart');
    const chartCtx = chartCanvas.getContext('2d');
    const loadingSpinner = document.getElementById('loadingSpinner');

    if (!date) return;

    chartCard.style.display = 'block';
    loadingSpinner.classList.remove('hidden');

    fetch(`/get_pie_data?date=${date}`)
        .then(response => response.json())
        .then(data => {
            loadingSpinner.classList.add('hidden');

            if (!data || data.length === 0) {
                chartCard.style.display = 'none';
                if (pieChart) pieChart.destroy();
                showError("No attendance data. Please try another day.");
                return;
            }

            const labels = data.map(row => row['Time Interval']);
            const counts = data.map(row => row['Employee Count']);

            const suspiciousColor = '#ff3c3c';
            const normalColors = [
                '#4CAF50', '#2196F3', '#FFC107', '#FF9800',
                '#9C27B0', '#00BCD4', '#8BC34A', '#FFEB3B',
                '#795548', '#03A9F4', '#E91E63', '#CDDC39'
            ];

            const colors = labels.map(label => {
                const timeRange = label.split('–');
                if (timeRange.length === 2) {
                    const startHour = parseInt(timeRange[0].split(':')[0]);
                    const endHour = parseInt(timeRange[1].split(':')[0]);
                    if (startHour < 6 || endHour > 18) return suspiciousColor;
                }
                const base = normalColors[Math.floor(Math.random() * normalColors.length)];
                return generateGradient(chartCtx, base);
            });

            if (pieChart) pieChart.destroy();

            pieChart = new Chart(chartCtx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: counts,
                        backgroundColor: colors,
                        borderWidth: 2,
                        borderColor: '#f0f0f0',
                        hoverOffset: 12,
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: context => `${context.label}: ${context.parsed} employees`
                            }
                        }
                    },
                    cutout: '50%',
                    animation: {
                        animateRotate: true,
                        animateScale: true
                    }
                }
            });
        })
        .catch(err => {
            loadingSpinner.classList.add('hidden');
            chartCard.style.display = 'none';
            showError("Error loading data. Please try again later.");
            console.error(err);
        });
}

function generateGradient(ctx, baseColor) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, baseColor);
    gradient.addColorStop(0.5, 'white');
    gradient.addColorStop(1, baseColor);
    return gradient;
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

// ✅ Expose function globally so kpi.js can trigger it
window.loadPieChart = loadPieChart;
