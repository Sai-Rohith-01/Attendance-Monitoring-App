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
  const typingMuteBtn = document.getElementById('typingAudioMuteBtn');
  const waveBar = document.getElementById('autobotWave');
  const tronContainer = document.getElementById('tronWaveContainer');
  const tronBars = document.querySelectorAll('.tron-bar');
  const mainContent = document.getElementById('mainContent');
  const autobotToggle = document.getElementById('autobotTypingToggle');
  
  // ========== STATE ==========
  let isMuted = false;
  let isTypingAudioMuted = false;
  let autobotTypingEnabled = false;
  let sectionTimer = null;
  let activityInterval = null;
  let reminderInterval = null;
  let activitySeconds = 0;
  let isTimerPaused = false;

  // ========== SECTION MAPPING ==========
  const sectionMap = {
    Home: 'homeSection',
    'My Activity': 'activitySection',
    'My Applications': 'applicationsSection',
    Settings: 'settingsSection'
  };

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

  // ========== SHOW HOME BY DEFAULT ==========
  if (homeSection) homeSection.style.display = 'block';

  // ========== AUDIO TOGGLE (GENERAL) ==========
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

  // ========== M KEY TOGGLE FOR GENERAL AUDIO ==========
  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'm') {
      toggleAudioMute();
      audioToggleBtn?.classList.add('key-toggled');
      setTimeout(() => audioToggleBtn?.classList.remove('key-toggled'), 150);
    }
  });

  // ========== AUTOBOT TYPING TOGGLE ==========
  typingToggle?.addEventListener('change', (e) => {
    autobotTypingEnabled = e.target.checked;
  });

  // ========== AUTOBOT LETTER SOUND ==========
  document.addEventListener('keydown', (e) => {
    if (!autobotTypingEnabled || isTypingAudioMuted) return;
    const char = e.key.toLowerCase();
    if (char >= 'a' && char <= 'z') {
      const audioPath = `/static/audio/autobots/letters/${char}.mp3`;
      const letterAudio = new Audio(audioPath);
      letterAudio.play().catch(() => console.warn(`No audio for letter '${char}'`));
    }
  });

  // ========== AUTOBOTS BUTTON VOICE ==========
  autobotsBtn?.addEventListener('click', () => {
    const voice = randomVoices[Math.floor(Math.random() * randomVoices.length)];
    voice.currentTime = 0;
    voice.play();
  });

  // ========== LOGOUT HANDLER ==========
  logoutLink?.addEventListener('click', (e) => {
    e.preventDefault();
    logoutAudio.play().catch(() => (window.location.href = '/logout'));
    setTimeout(() => (window.location.href = '/logout'), 2000);
  });

  // ========== DROPDOWN HANDLER ==========
  extrasToggle?.addEventListener('click', () => {
    extrasDropdown?.classList.toggle('extras-visible');
    extrasDropdown?.classList.toggle('extras-hidden');
  });

  // ========== SECTION NAVIGATION ==========
  document.querySelectorAll('.sidebar nav ul li').forEach((item) => {
    item.addEventListener('click', () => {
      const text = item.textContent.trim();
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

  // ========== ACTIVITY TIMER ==========
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
    }, 30 * 1000);
  }

  pauseBtn?.addEventListener('click', () => {
    isTimerPaused = !isTimerPaused;
    pauseBtn.textContent = isTimerPaused ? 'Resume' : 'Pause';
    pauseBtn.style.borderColor = isTimerPaused ? 'green' : 'red';
  });

  // ========== WELCOME SOUND ==========
  welcomeAudio.play().catch(() => console.warn('🔇 Autoplay blocked'));

  // ========== STAR RATING ==========
  const idCard = document.querySelector('.id-card');
  if (idCard) {
    const rating = parseInt(idCard.dataset.rating);
    const starContainer = document.getElementById('starRating');
    if (starContainer) {
      const starCount = Math.round(rating / 20);
      starContainer.innerHTML = Array.from({ length: 5 }, (_, i) => `<span class="star ${i < starCount ? 'filled' : ''}">★</span>`).join('');
    }
    idCard.classList.add(rating >= 90 ? 'gold-tier' : rating >= 75 ? 'silver-tier' : rating >= 60 ? 'bronze-tier' : 'standard-tier');
  }

  // ========== AUTOBOT OVERLAY MODE ==========
  let overlay = document.getElementById('autobotOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'autobotOverlay';
    document.body.insertBefore(overlay, document.body.firstChild);
  }

  typingToggle?.addEventListener('change', () => {
    if (typingToggle.checked) {
      mainContent?.classList.add('fade-out');
      overlay?.classList.add('active');
      autobotsBtn?.classList.add('animate-to-center');
      document.body.style.overflow = 'hidden';
    } else {
      mainContent?.classList.remove('fade-out');
      overlay?.classList.remove('active');
      autobotsBtn?.classList.remove('animate-to-center');
      document.body.style.overflow = '';
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && typingToggle?.checked) {
      typingToggle.checked = false;
      typingToggle.dispatchEvent(new Event('change'));
    }
  });
  // Stop any currently playing typing audio
  document.querySelectorAll('audio[data-typing-letter]').forEach(audio => {
  audio.pause();
  audio.currentTime = 0;
});


  // ========== AUTOBOT KEY FX ==========
  document.addEventListener('keydown', (e) => {
    if (!autobotTypingEnabled) return;
    const key = e.key.length === 1 ? e.key.toUpperCase() : '';
    if (!key) return;

    const fx = document.createElement('div');
    fx.classList.add('key-fx');
    fx.textContent = key;
    fx.style.left = `${Math.random() * (window.innerWidth - 100)}px`;
    fx.style.top = `${Math.random() * (window.innerHeight - 100)}px`;
    document.body.appendChild(fx);
    setTimeout(() => fx.remove(), 800);
  });

  // ========== WAVE BAR ==========
  document.addEventListener('keydown', () => {
    if (!autobotTypingEnabled) {
      waveBar?.classList.remove('active');
      return;
    }
    waveBar?.classList.add('active');
    waveBar?.classList.remove('pulse');
    void waveBar?.offsetWidth;
    waveBar?.classList.add('pulse');
  });

  // ========== TRON BARS ==========
  document.addEventListener('keydown', () => {
    if (!autobotTypingEnabled) {
      tronContainer?.classList.remove('active');
      return;
    }

    tronContainer?.classList.add('active');
    tronBars.forEach(bar => {
      const rand = 30 + Math.random() * 70;
      bar.style.height = `${rand}px`;
      if (Math.random() > 0.8) bar.style.background = '#0ff';
    });
    setTimeout(() => {
      tronBars.forEach(bar => {
        bar.style.height = '12px';
        bar.style.background = '#00f0ff';
      });
    }, 200);
  });

  // ========== GLOBAL ERROR HELPER ==========
  window.playErrorSound = () => {
    errorAudio.currentTime = 0;
    errorAudio.play();
  };
});
