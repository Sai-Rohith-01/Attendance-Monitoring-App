document.addEventListener('DOMContentLoaded', function () {
    const datePicker = document.getElementById('datePicker');
    const chartCard = document.getElementById('chartCard');
    const chartCanvas = document.getElementById('arrivalPieChart');
    const chartCtx = chartCanvas.getContext('2d');
    let pieChart;

    const today = new Date().toISOString().split('T')[0];
    datePicker.value = today;
    loadChartData(today);

    // 🎛️ Generate button + spinner
    const generateBtn = document.getElementById('generateBtn');
    const loadingSpinner = document.getElementById('loadingSpinner');

    generateBtn.addEventListener('click', async () => {
        const selectedDate = datePicker.value;
        if (!selectedDate) {
            showError("Please select a valid date.");
            return;
        }

        // 🔊 Play "Working on it, sir"
        await playJarvisProcessing();

        // ⏳ Show spinner
        loadingSpinner.classList.remove('hidden');

        // 🎯 Delay and load
        setTimeout(() => {
            loadChartData(selectedDate);
            loadingSpinner.classList.add('hidden');
        }, 1500);
    });

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

    function generateGradient(ctx, baseColor) {
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, baseColor);
        gradient.addColorStop(0.5, 'white');
        gradient.addColorStop(1, baseColor);
        return gradient;
    }

    function loadChartData(date) {
        fetch(`/get_pie_data?date=${date}`)
            .then(response => response.json())
            .then(data => {
                if (!data || data.length === 0) {
                    chartCard.style.display = 'none';
                    if (pieChart) pieChart.destroy();
                    showError("No attendance data. Please try another day.");
                    return;
                }

                chartCard.style.display = 'block';

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
                        const endHour = parseInt(timeRange[1].split(':')[0]);
                        const startHour = parseInt(timeRange[0].split(':')[0]);
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
                chartCard.style.display = 'none';
                showError("Error loading data. Please try again later.");
                console.error(err);
            });
    }

    // 🌙 Dark Mode Toggle
    const toggleButton = document.getElementById('darkModeToggle');
    const rootElement = document.documentElement;

    toggleButton.addEventListener('click', () => {
        rootElement.classList.toggle('dark-mode');
    });

    // 🧠 JARVIS reusable processing voice
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

    // 🔘 JARVIS Icon Random Voice
    const jarvisBtn = document.getElementById('jarvisBtn');
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

    // 🔚 Logout Handler
    const logoutBtn = document.getElementById('logoutBtn');
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
});
