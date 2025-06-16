document.addEventListener("DOMContentLoaded", () => {
  // Slideshow
  const slides = document.querySelectorAll(".slide");
  let current = 0;
  function showSlide(index) {
    slides.forEach((slide) => slide.classList.remove("active"));
    slides[index].classList.add("active");
  }
  if (slides.length > 0) {
    setInterval(() => {
      current = (current + 1) % slides.length;
      showSlide(current);
    }, 4000);
  }

  // Password toggle
  const togglePassword = document.getElementById("togglePassword");
  const passwordInput = document.getElementById("password");
  if (togglePassword && passwordInput) {
    togglePassword.addEventListener("click", () => {
      const type = passwordInput.type === "password" ? "text" : "password";
      passwordInput.type = type;
      togglePassword.classList.toggle("fa-eye-slash");
      togglePassword.classList.toggle("fa-eye");
    });
  }

  // Toast auto-hide
  const toast = document.getElementById("toastError");
  if (toast) {
    setTimeout(() => {
      toast.style.display = "none";
    }, 5000);
  }

  // Mute setting
  const muteCheckbox = document.getElementById("muteJarvis");
  if (muteCheckbox) {
    muteCheckbox.checked = localStorage.getItem("jarvis_muted") === "true";
    muteCheckbox.addEventListener("change", () => {
      localStorage.setItem("jarvis_muted", muteCheckbox.checked ? "true" : "false");
    });
  }

  const muted = localStorage.getItem("jarvis_muted") === "true";
  const loginResult = document.getElementById("loginResult")?.value;
  const loginRole = document.getElementById("loginRole")?.value;

  const playVoice = (filename, callback = null) => {
    if (!muted) {
      const audio = new Audio(`/static/audio/${filename}`);
      audio.play().then(() => {
        if (callback) audio.onended = callback;
      }).catch((err) => console.warn("Audio failed:", err));
    } else if (callback) {
      callback();
    }
  };

  // Access Denied
  if (loginResult === "fail") {
    playVoice("jarvis_denied.mp3");
  }

  // Access Granted
  else if (loginResult === "success") {
    const redirectTo = loginRole === "admin" ? "/dashboard_admin" : "/dashboard_user";
    const successAudio = loginRole === "admin" ? "jarvis_admin_success.mp3" : "jarvis_user_success.mp3";
    playVoice(successAudio, () => {
      window.location.href = redirectTo;
    });
  }

  // JARVIS Icon Trigger
  const jarvisIcon = document.getElementById("jarvisFloatingIcon");
  if (jarvisIcon) {
    jarvisIcon.addEventListener("click", () => {
      playVoice("jarvis_welcome.mp3");
    });
  }
});
