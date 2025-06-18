document.addEventListener('DOMContentLoaded', function () {
    const datePicker = document.getElementById('datePicker');
    const generateBtn = document.getElementById('generateBtn');
    const toggleButton = document.getElementById('darkModeToggle');
    const rootElement = document.documentElement;
    const jarvisBtn = document.getElementById('jarvisBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const visualSelect = document.getElementById('visualSelect');
    const kpiSection = document.getElementById('kpiSection');
    const chartCard = document.getElementById('chartCard');

    generateBtn.addEventListener('click', async () => {
        const selectedDate = datePicker.value;
        const selectedVisual = visualSelect.value;

        if (!selectedDate) {
            showError("Please select a valid date.");
            return;
        }

        if (!selectedVisual) {
            showError("Please select a visualization type.");
            return;
        }

        await playJarvisProcessing();

        if (selectedVisual === "kpi") {
            kpiSection.style.display = "block";
            chartCard.style.display = "none";
            if (typeof loadKPIData === 'function') {
                loadKPIData(selectedDate);
            }
        } else if (selectedVisual === "pie") {
            chartCard.style.display = "block";
            kpiSection.style.display = "none";
            if (typeof loadPieChart === 'function') {
                loadPieChart(selectedDate);
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
});
