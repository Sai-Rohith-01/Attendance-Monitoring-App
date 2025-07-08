document.addEventListener('DOMContentLoaded', () => {

  // ========== DOM CACHE ==========
  const homeSection = document.getElementById('homeSection');
  const logoutLink = document.getElementById('logoutLink');
  const autobotsBtn = document.getElementById('AutobotsBtn');
  const audioToggleBtn = document.getElementById('audioToggleBtn');
  const typingToggle = document.getElementById('autobotTypingToggle');
  const pauseBtn = document.getElementById('pauseTimerBtn');
  const extrasToggle = document.getElementById('extrasToggle');
  const extrasDropdown = document.getElementById('extrasDropdown');
  const activityTimerDisplay = document.getElementById('activityTimer');

  // ========== SECTION MAPPING ==========
  const sectionMap = {
    Home: 'homeSection',
    'My Activity': 'activitySection',
    'My Applications': 'applicationsSection',
    Settings: 'settingsSection'
  };

  // ========== SHOW HOME BY DEFAULT ==========
  if (homeSection) homeSection.style.display = 'block';

  // ========== AUDIO SETUP ==========
  const welcomeAudio = new Audio('/static/audio/autobots/greetings humans.mp3');
  const logoutAudio = new Audio('/static/audio/autobots/bye.mp3');
  const errorAudio = new Audio('/static/audio/autobots/system crashed.mp3');
  const autobotsBtnAudio = new Audio('/static/audio/autobots/oh no.mp3');
  const timeoutAudio = new Audio('/static/audio/autobots/time over.mp3');

  const randomVoices = [
    new Audio('/static/audio/autobots/i am prime.mp3'),
    new Audio('/static/audio/autobots/present.mp3'),
    new Audio('/static/audio/autobots/rollout.mp3'),
    new Audio('/static/audio/autobots/standby.mp3'),
    new Audio('/static/audio/autobots/stop.mp3'),
    new Audio('/static/audio/autobots/time over.mp3'),
    new Audio('/static/audio/autobots/sorry.mp3'),
    new Audio('/static/audio/autobots/and.mp3')
  ];

  // ========== AUDIO MUTE TOGGLE ==========
  let isMuted = false;
  function toggleAudioMute() {
    isMuted = !isMuted;
    [...randomVoices, welcomeAudio, logoutAudio, errorAudio, autobotsBtnAudio, timeoutAudio].forEach(audio => {
      audio.muted = isMuted;
    });
    if (audioToggleBtn) audioToggleBtn.textContent = isMuted ? '🔇' : '🔊';
  }

  if (audioToggleBtn) {
    audioToggleBtn.addEventListener('click', toggleAudioMute);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'm') {
      toggleAudioMute();
      audioToggleBtn?.classList.add('key-toggled');
      setTimeout(() => audioToggleBtn?.classList.remove('key-toggled'), 150);
    }
  });

  // ========== AUTOBOT TYPING TOGGLE ==========
  let autobotTypingEnabled = false;
  typingToggle?.addEventListener('change', (e) => {
    autobotTypingEnabled = e.target.checked;
  });

  document.addEventListener('keydown', (e) => {
    const char = e.key.toLowerCase();
    if (!autobotTypingEnabled || isMuted) return;
    if (char >= 'a' && char <= 'z') {
      const audioPath = `/static/audio/autobots/letters/${char}.mp3`;
      const letterAudio = new Audio(audioPath);
      letterAudio.play().catch(() => console.warn(`No audio for letter '${char}'`));
    }
  });

  // ========== AUTOBOTS BUTTON ==========
  autobotsBtn?.addEventListener('click', () => {
    const voice = randomVoices[Math.floor(Math.random() * randomVoices.length)];
    voice.currentTime = 0;
    voice.play();
  });

  // ========== LOGOUT ==========
  logoutLink?.addEventListener('click', (e) => {
    e.preventDefault();
    logoutAudio.play().catch(() => (window.location.href = '/logout'));
    setTimeout(() => (window.location.href = '/logout'), 2000);
  });

  // ========== DROPDOWN TOGGLE ==========
  extrasToggle?.addEventListener('click', () => {
    extrasDropdown?.classList.toggle('extras-visible');
    extrasDropdown?.classList.toggle('extras-hidden');
  });

  // ========== SECTION ACTIVITY TIMER ==========
  let sectionTimer = null;
  let activityInterval = null;
  let reminderInterval = null;
  let activitySeconds = 0;
  let isTimerPaused = false;

  function updateActivityDisplay() {
    if (!activityTimerDisplay) return;
    const minutes = String(Math.floor(activitySeconds / 60)).padStart(2, '0');
    const seconds = String(activitySeconds % 60).padStart(2, '0');
    activityTimerDisplay.textContent = `${minutes}:${seconds}`;
  }

  function resetActivityTimer() {
    clearInterval(activityInterval);
    clearInterval(reminderInterval);
    activitySeconds = 0;
    updateActivityDisplay();
    isTimerPaused = false;

    activityInterval = setInterval(() => {
      if (!isTimerPaused) {
        activitySeconds++;
        updateActivityDisplay();
      }
    }, 1000);

    reminderInterval = setInterval(() => {
      if (!isTimerPaused && !isMuted) {
        timeoutAudio.play().catch(() => console.warn("Autoplay blocked"));
      }
    }, 30 * 1000); // 30 sec reminder
  }

  pauseBtn?.addEventListener('click', () => {
    isTimerPaused = !isTimerPaused;
    pauseBtn.textContent = isTimerPaused ? 'Resume' : 'Pause';
    pauseBtn.style.borderColor = isTimerPaused ? 'green' : 'red';
  });

  // ========== SECTION NAVIGATION ==========
  document.querySelectorAll('.sidebar nav ul li').forEach((item) => {
  item.addEventListener('click', () => {
    const text = item.textContent.trim();

    // 🔒 Skip Extras (we handle it separately)
    if (item.id === 'extrasToggle') return;

    const sectionId = sectionMap[text];
    if (!sectionId) return;

    clearTimeout(sectionTimer);
    clearInterval(activityInterval);
    clearInterval(reminderInterval);

    document.querySelectorAll('.dashboard-section').forEach(sec => sec.style.display = 'none');

    const sectionElement = document.getElementById(sectionId);
    if (sectionElement) {
      sectionElement.style.display = 'block';
      resetActivityTimer();
    }

    document.querySelectorAll('.sidebar nav ul li').forEach(li => li.classList.remove('active'));
    item.classList.add('active');
  });
});


  // ========== WELCOME VOICE ==========
  welcomeAudio.play().catch(() => console.warn('🔇 Autoplay blocked'));

  // ========== STAR RATING ==========
  const idCard = document.querySelector('.id-card');
  if (idCard) {
    const rating = parseInt(idCard.dataset.rating);
    const starContainer = document.getElementById('starRating');
    if (starContainer) {
      const starCount = Math.round(rating / 20);
      let starsHTML = "";
      for (let i = 1; i <= 5; i++) {
        starsHTML += `<span class="star ${i <= starCount ? 'filled' : ''}">★</span>`;
      }
      starContainer.innerHTML = starsHTML;
    }

    if (rating >= 90) {
      idCard.classList.add('gold-tier');
    } else if (rating >= 75) {
      idCard.classList.add('silver-tier');
    } else if (rating >= 60) {
      idCard.classList.add('bronze-tier');
    } else {
      idCard.classList.add('standard-tier');
    }
  }

  // ========== GLOBAL ERROR HELPER ==========
  window.playErrorSound = () => {
    errorAudio.currentTime = 0;
    errorAudio.play();
  };

});


