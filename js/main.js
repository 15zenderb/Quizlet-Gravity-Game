 
  const ASSETS = {
  win: "https://github.com/15zenderb/Quizlet-Gravity-Game/blob/main/assets/sounds/Win.wav?raw=true",
  explosion: "https://github.com/15zenderb/Quizlet-Gravity-Game/blob/main/assets/sounds/explosion.wav?raw=true",
  correct: "https://github.com/15zenderb/Quizlet-Gravity-Game/blob/main/assets/sounds/correct.mp3?raw=true",
  incorrectSound: "https://github.com/15zenderb/Quizlet-Gravity-Game/blob/main/assets/sounds/incorrect.mp3?raw=true",
  menuBackground: "https://raw.githubusercontent.com/15zenderb/Quizlet-Gravity-Game/main/assets/images/Astronaut%20background.jpg",
  gameBackground: "https://github.com/15zenderb/Quizlet-Gravity-Game/blob/main/assets/images/Background.jpg?raw=true",
  pauseBackground: "https://github.com/15zenderb/Quizlet-Gravity-Game/blob/main/assets/images/pause_background.jpg?raw=true",
  background: "https://github.com/15zenderb/Quizlet-Gravity-Game/blob/main/assets/images/Background.jpg?raw=true",
  earth: "https://github.com/15zenderb/Quizlet-Gravity-Game/blob/main/assets/images/Earth.png?raw=true",
  asteroid: "https://github.com/15zenderb/Quizlet-Gravity-Game/blob/3ac77616a4f808c26577326c386ecaca3bd7e2ef/assets/images/Asteroid.png?raw=true",
  musicStart: "https://raw.githubusercontent.com/15zenderb/Quizlet-Gravity-Game/main/assets/sounds/start%20screen%20music.wav",
  musicGame: "https://github.com/15zenderb/Quizlet-Gravity-Game/blob/3ac77616a4f808c26577326c386ecaca3bd7e2ef/assets/sounds/Ambiance.wav?raw=true",
  soundPause: "https://github.com/15zenderb/Quizlet-Gravity-Game/blob/main/assets/sounds/pause.mp3?raw=true",
  soundUnpause: "https://github.com/15zenderb/Quizlet-Gravity-Game/blob/main/assets/sounds/unpause.mp3?raw=true",
  recordStart: "https://github.com/15zenderb/Quizlet-Gravity-Game/blob/main/assets/sounds/record_start.mp3?raw=true",
  recordEnd: "https://github.com/15zenderb/Quizlet-Gravity-Game/blob/main/assets/sounds/record_end.mp3?raw=true"
};

const cacheBuster = Date.now();

for (const key in ASSETS) {
  if (ASSETS[key].includes("?")) {
    ASSETS[key] += `&cb=${cacheBuster}`;
  } else {
    ASSETS[key] += `?cb=${cacheBuster}`;
  }
}

// Preload large background images
const preloadMenuBg = new Image();
preloadMenuBg.src = ASSETS.menuBackground;
const preloadGameBg = new Image();
preloadGameBg.src = ASSETS.gameBackground;
const preloadPauseBg = new Image();
preloadPauseBg.src = ASSETS.pauseBackground;

const userInput = document.getElementById("userInput");
const hud = document.getElementById("hud");
const music = new Audio(ASSETS.musicStart);
const ambiance = new Audio(ASSETS.musicGame);
music.loop = true;
ambiance.loop = true;
let canvas, ctx, asteroid = null, animationId, asteroidImg = new Image(), gameStarted = false;
let isPaused = false;
const pauseSound = new Audio(ASSETS.soundPause);
const unpauseSound = new Audio(ASSETS.soundUnpause);
asteroidImg.src = ASSETS.asteroid;
let quizData = [];
try {
  const saved = localStorage.getItem("quizData");
  quizData = saved ? JSON.parse(saved) : [
    { question: "a", answer: "one" },
    { question: "b", answer: "two" },
    { question: "c", answer: "three" }
  ];
} catch (e) {
  console.error("Failed to load quiz data from localStorage:", e);
  quizData = [
    { question: "a", answer: "one" },
    { question: "b", answer: "two" },
    { question: "c", answer: "three" }
  ];
}
let score = 0;
let lives = 3;
let missedAnswers = [];
let currentIndex = 0;
let level = 1;
let totalCorrect = 0;
let settings = {
  lives: 3,
  livesEnabled: true,
  questionsPerLevel: 7,
  fallSpeed: .5,
  ttsEnabled: false,
  ttsLanguage: 'en-US'
};

let suppressNextEnter = false;
let suppressEnterUntil = 0; 
let shuffledQuestions = [];
let shuffledIndex = 0;
let fallSpeedSliderPercent = 50; // default slider percent (0–100)
let gameInputFocusHandler = null;
let questionAnswered = false;

const savedLang = localStorage.getItem("ttsLanguage");

const API_BASE = "https://user-auth-worker.15zenderb.workers.dev/api";
const token = localStorage.getItem("token");

if (savedLang) {
  settings.ttsLanguage = savedLang;
}

if (!settings.voiceInputLanguage) {
  settings.voiceInputLanguage = "en-US";
}

let ambianceUnlocked = false;

document.body.addEventListener("click", () => {
  if (!ambianceUnlocked) {
    const keysToUnlock = ['correct', 'incorrect', 'win', 'explosion', 'soundPause', 'soundUnpause'];
    for (const key of keysToUnlock) {
      const s = new Audio(ASSETS[key]);
      s.play().then(() => s.pause()).catch(() => {});
    }

    ambiance.play().then(() => {
      ambiance.pause();
      ambianceUnlocked = true;
    }).catch(() => {});
  }
});
document.documentElement.style.setProperty('--menu-bg', `url('${ASSETS.menuBackground}') no-repeat center center/cover`);
document.documentElement.style.setProperty('--game-bg', `url('${ASSETS.gameBackground}') no-repeat center center/cover`);
document.documentElement.style.setProperty('--pause-bg', `url('${ASSETS.pauseBackground}') no-repeat center center/cover`);

userInput.addEventListener("input", () => {
  // Create a temporary span to measure text width
  const tempSpan = document.createElement("span");
  tempSpan.style.position = "absolute";
  tempSpan.style.visibility = "hidden";
  tempSpan.style.font = window.getComputedStyle(userInput).font;
  tempSpan.textContent = userInput.value;

  document.body.appendChild(tempSpan);
  const textWidth = tempSpan.offsetWidth;
  const inputWidth = userInput.offsetWidth;
  document.body.removeChild(tempSpan);

  // Adjust alignment based on whether text is overflowing
  if (textWidth > inputWidth - 20) {
    userInput.style.textAlign = "left";
  } else {
    userInput.style.textAlign = "center";
  }
});

// Globals
let recognition = null;
let isRecording = false;
let silenceTimer = null;
let speechDetected = false;
let micInitialized = false;

// Call this ONCE after DOM is loaded
function initMic() {
  const micButton = document.getElementById("micButton");
  const inputBox = document.getElementById("userInput");

  if (!("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) {
    console.warn("❌ Speech recognition not supported.");
    micButton.style.display = "none";
    return;
  }

  const isAndroidChrome = /Android/i.test(navigator.userAgent) && /Chrome/i.test(navigator.userAgent);
  const playMicSound = !isAndroidChrome;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = settings.voiceInputLanguage || "en-US";

  recognition.onstart = () => {
    isRecording = true;
    speechDetected = false;
    micButton.classList.add("glow");

    if (playMicSound) new Audio(ASSETS.recordStart).play();

    silenceTimer = setTimeout(() => {
      console.warn("⏱️ No speech detected — forcing stop");
      recognition.abort();
    }, 4000);
  };

  recognition.onspeechstart = () => {
    speechDetected = true;
    console.log("🗣️ Speech started");
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript.trim();
    console.log("🎙️ Transcript:", transcript);
    if (transcript) {
      inputBox.value = transcript;
      submitMicInput();
    }
  };

  recognition.onend = () => {
    isRecording = false;
    micButton.classList.remove("glow");
    if (playMicSound) new Audio(ASSETS.recordEnd).play();
    clearTimeout(silenceTimer);
  };

  recognition.onerror = (event) => {
    console.error("🚫 Speech error:", event.error);
    isRecording = false;
    micButton.classList.remove("glow");
    if (playMicSound) new Audio(ASSETS.recordEnd).play();
    clearTimeout(silenceTimer);
  };

  micButton.addEventListener("click", () => {
    if (isRecording) {
      console.log("⚠️ Already recording — ignoring click");
      return;
    }

    // 🔇 Stop TTS before recording starts
    if (window.currentTTS) {
      window.currentTTS.pause?.();
      window.currentTTS = null;
    }

    try {
      recognition.start();
    } catch (err) {
      console.error("🎤 Could not start mic:", err);
    }
  });

  micInitialized = true;
}

// Call this to simulate Enter key for voice submission
function submitMicInput() {
  const inputBox = document.getElementById("userInput");

  setTimeout(() => {
    const event = new KeyboardEvent("keydown", { key: "Enter" });
    inputBox.dispatchEvent(event);
  }, 100); // small delay to avoid audio overlap
}


//end of mic stuff

function lockScroll(lock) {
  document.body.style.overflow = lock ? "hidden" : "";
}

function toggleFullscreen() {
  const el = document.documentElement;

  if (!document.fullscreenElement && !document.webkitFullscreenElement) {
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  } else {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  }
}


document.body.addEventListener("click", () => {
  if (music.paused && !gameStarted) {
    music.play().catch(error => console.log("User interaction required for audio playback."));
  }
});


function showScreen(screenId) {
  // Hide all screens
  document.querySelectorAll('.screen').forEach(screen => {
    screen.style.display = 'none';
  });

  // Show canvas only during game
  const canvas = document.getElementById("asteroidCanvas");
  if (canvas) {
    if (screenId === "gameScreen") {
      canvas.style.display = "block";
    } else {
      canvas.style.display = "none";
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height); // clear asteroids
    }
  }

  // Show selected screen
  const screen = document.getElementById(screenId);
  if (screen) screen.style.display = 'flex';

  // Handle music/ambiance and input UI
  const inputBox = document.getElementById("userInput");
  const micButton = document.getElementById("micButton");

  if (screenId === 'gameScreen') {
    isPaused = false;
    gameStarted = true;
    music.pause();

    if (ambiance.paused) {
      ambiance.play().catch(err => console.warn("🔇 Ambiance blocked:", err));
    }

    inputBox.style.display = "block";
    micButton.style.display = "block";

    if (window.innerWidth <= 768) {
      inputBox.blur();
    } else {
      inputBox.focus();
    }

    gameInputFocusHandler = function (event) {
      if (
        event.target !== inputBox &&
        event.target !== micButton &&
        !event.target.closest('input[type="range"]')
      ) {
        event.preventDefault();
        if (window.innerWidth > 768) inputBox.focus();
      }
    };
    document.addEventListener('mousedown', gameInputFocusHandler, true);

    startAsteroids();

  } else {
    isPaused = true;
    gameStarted = false;
    ambiance.pause();
    music.play();

    inputBox.style.display = "none";
    micButton.style.display = "none";

    if (gameInputFocusHandler) {
      document.removeEventListener('mousedown', gameInputFocusHandler, true);
      gameInputFocusHandler = null;
    }

    if (screenId === 'settingsScreen') {
      const slider = document.querySelector('input[type="range"][onchange*="adjustedFallSpeed"]');
      const display = document.getElementById("fallSpeedDisplay");

      if (slider) {
        const minSpeed = 0.3;
        const maxSpeed = 20;
        const curveFactor = 2;

        const percent = Math.pow(
          Math.log(settings.fallSpeed / minSpeed) / Math.log(maxSpeed / minSpeed),
          1 / curveFactor
        );
        const sliderValue = Math.round(percent * 100);
        slider.value = sliderValue;

        if (display) {
          display.textContent = settings.fallSpeed.toFixed(2);
        }
      }

      document.getElementById("ttsLanguageSelector").value = settings.ttsLanguage;
    }
  }

  // Fix scroll lock on mobile
  if (window.innerWidth <= 768) {
    document.body.style.overflow = screenId === 'gameScreen' ? 'hidden' : '';
  }
}


function getNextShuffledQuestion() {
  if (shuffledIndex >= shuffledQuestions.length || shuffledQuestions.length === 0) {
    shuffledQuestions = [...quizData];
    for (let i = shuffledQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledQuestions[i], shuffledQuestions[j]] = [shuffledQuestions[j], shuffledQuestions[i]];
    }
    shuffledIndex = 0;
  }
  return shuffledQuestions[shuffledIndex++];

function shuffleQuestions() {
  shuffledQuestions = quizData.slice(); // copy array
  for (let i = shuffledQuestions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledQuestions[i], shuffledQuestions[j]] = [shuffledQuestions[j], shuffledQuestions[i]];
  }
  shuffledIndex = 0;
}}

function getNextQuestion() {
  if (shuffledIndex >= shuffledQuestions.length) {
    shuffleQuestions();
  }
  return shuffledQuestions[shuffledIndex++];
}

function adjustedFallSpeed(sliderValue) {
  const minSpeed = 0.15; // ✅ slower base speed (used to be 0.3)
  const maxSpeed = 20;
  const curveFactor = 2;

  const percent = sliderValue / 100;
  const curvedSpeed = minSpeed * Math.pow(maxSpeed / minSpeed, Math.pow(percent, curveFactor));

  settings.fallSpeed = curvedSpeed;
  fallSpeedMultiplier = curvedSpeed;

  const display = document.getElementById("fallSpeedDisplay");
  if (display) {
    display.textContent = curvedSpeed.toFixed(2);
  }
}


function updateVolume(value) {
  const vol = parseFloat(value);
  music.volume = vol;
  ambiance.volume = vol;
  pauseSound.volume = vol;
  unpauseSound.volume = vol;
  correctSound.volume = vol;
  incorrectSound.volume = vol;
}

function pauseGame() {
  isPaused = true;
  document.getElementById("gameScreen").style.display = "none";
  document.getElementById("pauseScreen").style.display = "flex";
  new Audio(ASSETS.soundPause).play().catch(() => {});
}

function resumeGame() {
  isPaused = false;
  document.getElementById("pauseScreen").style.display = "none";
  document.getElementById("gameScreen").style.display = "flex";
  new Audio(ASSETS.soundUnpause).play().catch(() => {});
  const inputBox = document.getElementById("userInput");
  if (inputBox) inputBox.focus();
  requestAnimationFrame(updateAsteroids);
}

        function quitGame() {
            window.open('', '_self', '');
            window.close();
        }

        function startAsteroids() {
  canvas = document.getElementById("asteroidCanvas");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  ctx = canvas.getContext("2d");

  cancelAnimationFrame(animationId);
  asteroid = null;

  score = 0;
  totalCorrect = 0; 
  lives = settings.livesEnabled ? settings.lives : Infinity;
  level = 1;
  fallSpeedMultiplier = settings.fallSpeed;
  missedAnswers = [];
  currentIndex = 0;

  document.getElementById("score").innerText = score;
  document.getElementById("lives").innerText = lives === Infinity ? "∞" : lives;
  document.getElementById("level").innerText = level;

  nextQuestion();
  requestAnimationFrame(updateAsteroids);
}

function showLevelUpMessage(level) {
  const levelMsg = document.createElement("div");
  levelMsg.className = "level-up-message";
  levelMsg.innerText = `LEVEL ${level}`;
  document.body.appendChild(levelMsg);

  isPaused = true;
  suppressEnterUntil = Date.now() + 1500;;

  // Trigger animation by forcing reflow and adding a class
  void levelMsg.offsetWidth;
  levelMsg.classList.add("show");

  setTimeout(() => {
    levelMsg.classList.remove("show");
    setTimeout(() => {
      document.body.removeChild(levelMsg);
      isPaused = false;
      suppressNextEnter = false;
      requestAnimationFrame(updateAsteroids);
    }, 500); // match fade-out duration
  }, 1500);
}

function createAsteroid(q) {
  const isMobile = window.innerWidth <= 768;
  const baseSize = isMobile ? 200 : 400;

  const ctx = document.getElementById("asteroidCanvas").getContext("2d");
  ctx.font = "16px Courier New"; // Match canvas text style
  const textWidth = ctx.measureText(q.question).width;

  const padding = 20;
  const maxX = canvas.width - Math.max(baseSize, textWidth) - padding;
  const minX = padding;
  const xPos = Math.random() * (maxX - minX) + minX;

  const direction = Math.random() < 0.5 ? -1 : 1;
  const rotationSpeed = direction * (Math.random() * 0.000000001 - 0.01);

  return {
    x: xPos,
    y: -50,
    size: baseSize,
    speed: 0.5 * fallSpeedMultiplier,
    angle: 0,
    rotationSpeed: rotationSpeed,
    question: q.question,
    answer: q.answer,
    raw: q
  };
}





function updateAsteroids() {
  if (isPaused) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!asteroid) {
    const q = getNextQuestion();
    asteroid = createAsteroid(q);
  }

  asteroid.y += asteroid.speed;

  // Draw asteroid with rotation
  ctx.save();
  ctx.translate(asteroid.x + asteroid.size / 2, asteroid.y + asteroid.size / 2);
  ctx.rotate(asteroid.angle);
  ctx.drawImage(asteroidImg, -asteroid.size / 2, -asteroid.size / 2, asteroid.size, asteroid.size);
  ctx.restore();

  // Draw question text
  ctx.font = "32px Courier New";
  ctx.fillStyle = "white";
  ctx.textAlign = "center";
  ctx.shadowColor = "black";
  ctx.shadowBlur = 4;

  const maxWidth = asteroid.size;
  const words = asteroid.question.split(' ');
  let line = '';
  let y = asteroid.y + asteroid.size / 2 - 33;

  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + ' ';
    const testWidth = ctx.measureText(testLine).width;
    if (testWidth > maxWidth) {
      ctx.fillText(line, asteroid.x + asteroid.size / 2, y);
      line = words[i] + ' ';
      y += 32; // spacing for asteroid text
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, asteroid.x + asteroid.size / 2, y);
  ctx.shadowBlur = 0;

  asteroid.angle += asteroid.rotationSpeed;

  // 🚨 Collision detection
  const textBox = document.getElementById("userInput");
  const canvasRect = canvas.getBoundingClientRect();

  const collisionY = canvas.height; // Always detect collision at bottom of canvas


  const asteroidBottom = asteroid.y + asteroid.size;

  if (
  asteroidBottom >= collisionY &&
  document.getElementById("gameScreen").style.display === "flex"
  ) {
    new Audio(ASSETS.explosion).play();
    lives--;
    missedAnswers.push({
      question: asteroid.question,
      answer: asteroid.answer
    });

    document.getElementById("lives").innerText = lives === Infinity ? "∞" : lives;
    isPaused = true;

    showOverlay(
      {
        title: "-1 Life",
        message: "Correct answer was: " + asteroid.answer
      },
      () => {
        if (lives <= 0) {
          new Audio(ASSETS.win).play();
          document.getElementById("gameScreen").style.display = "none";
          showGameOver();
        } else {
          isPaused = false;
          currentIndex = (currentIndex + 1) % quizData.length;
          nextQuestion();
          requestAnimationFrame(updateAsteroids);
        }
      }
    );
  }

  animationId = requestAnimationFrame(updateAsteroids);
}


window.addEventListener('resize', () => {
  if (canvas) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
});

/*
function handleCSVUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const text = e.target.result;
    const rows = text.split('\n').filter(r => r.trim());

    const data = rows.map(row => {
      const [question, answer] = row.split(',');
      return {
        question: question?.trim(),
        answer: answer?.trim()
      };
    }).filter(item => item.question && item.answer);

    const status = document.getElementById("csvStatus");

    if (data.length > 0) {
      quizData = data;
      localStorage.setItem("quizData", JSON.stringify(data));
      currentIndex = 0;
      console.log("✅ Imported CSV questions:", quizData);

      status.textContent = "✅ Questions updated!";
      status.style.color = "lime";
      status.style.opacity = "1";
    } else {
      status.textContent = "❌ Invalid CSV format. Use: question,answer";
      status.style.color = "red";
      status.style.opacity = "1";
    }

    // Fade out after 3 seconds
    setTimeout(() => {
      status.style.opacity = "0";
    }, 3000);
  };

  reader.readAsText(file);
} 
*/
function nextQuestion() {
  let questionObj;

  const customBank = JSON.parse(localStorage.getItem("currentQuestionBank") || "[]");
  if (Array.isArray(customBank) && customBank.length > 0) {
    if (!window.customQuestionIndex) window.customQuestionIndex = 0;

    questionObj = customBank[window.customQuestionIndex];

    // Shuffle logic (loop back to start or randomize as desired)
    window.customQuestionIndex++;
    if (window.customQuestionIndex >= customBank.length) {
      window.customQuestionIndex = 0;
    }
  } else {
    questionObj = getNextShuffledQuestion(); // fallback
  }

  asteroid = createAsteroid(questionObj);
  questionAnswered = false;

  if (window.currentTTS) {
    window.currentTTS.pause?.();
    window.currentTTS = null;
  }

  if (settings.ttsEnabled) {
    setTimeout(() => {
      if (questionAnswered) return;

      const langMap = {
        'en-US': 'en',
        'fil-PH': 'tl',
        'es-ES': 'es'
      };
      const lang = langMap[settings.ttsLanguage] || 'en';
      const text = asteroid.question;
      const url = `https://googlettsworkaround.15zenderb.workers.dev/?text=${encodeURIComponent(text)}&lang=${lang}`;

      const audio = new Audio(url);
      audio.play().catch(err => {
        console.warn("🔇 TTS audio failed:", err);
      });

      window.currentTTS = audio;
    }, 500);
  }
}




document.getElementById("userInput").addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    const now = Date.now();
    if (now < suppressEnterUntil) {
      this.value = "";
      return;
    }

    const input = this.value.trim().toLowerCase();
    const expected = asteroid.answer?.toLowerCase();

    if (input === expected) {
      questionAnswered = true;

      // Stop TTS if it's playing
      if (window.currentTTS) {
        try {
          window.currentTTS.pause?.();
          window.currentTTS.currentTime = 0;
        } catch (e) {}
        window.currentTTS = null;
      }

      try {
        new Audio(ASSETS.correct).play().catch(err => {
          console.warn("🔇 Correct sound failed:", err);
        });
      } catch (e) {
        console.warn("🔇 correctSound error:", e);
      }

      score++;
      totalCorrect++;
      document.getElementById("score").innerText = score;
      this.value = "";

      if (
        settings.questionsPerLevel > 0 &&
        totalCorrect % settings.questionsPerLevel === 0
      ) {
        level++;
        fallSpeedMultiplier += 0.5;
        document.getElementById("level").innerText = level;
        showLevelUpMessage(level);
      }

      currentIndex = (currentIndex + 1) % quizData.length;
      nextQuestion();

    } else {
      questionAnswered = true;

      // Cancel TTS before playing incorrectSound
      if (window.currentTTS) {
        try {
          window.currentTTS.pause?.();
          window.currentTTS.currentTime = 0;
        } catch (e) {}
        window.currentTTS = null;
      }

      try {
        new Audio(ASSETS.incorrect).play().catch(err => {
          console.warn("🔇 Incorrect sound failed:", err);
        });
      } catch (e) {
        console.warn("🔇 incorrectSound error:", e);
      }

      score--;
      document.getElementById("score").innerText = score;
    }
  }
});




function showGameOver() {
  const overlay = document.createElement("div");
  overlay.id = "endGameScreen";
  overlay.className = "screen end-game";
  overlay.style.position = "absolute";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100vw";
  overlay.style.height = "100vh";
  overlay.style.display = "flex";
  overlay.style.flexDirection = "column";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.padding = "20px";
  overlay.style.boxSizing = "border-box";
  overlay.style.overflowY = "auto";

  const msg = document.createElement("div");
  msg.className = '';
  msg.style.fontSize = "4vw";
  msg.style.marginBottom = "20px";
  msg.innerText = `Game Over! Final Score: ${score}`;

  const menu = document.createElement("div");
  menu.className = 'menu-option';
  menu.innerText = "Main Menu";
  menu.onclick = () => {
    document.body.removeChild(overlay);
    showScreen('menuScreen');
  };

  const retry = document.createElement("div");
  retry.className = 'menu-option';
  retry.innerText = "Retry";
  //retry handler
  retry.onclick = () => {
    document.body.removeChild(overlay);
    lives = settings.livesEnabled ? settings.lives : Infinity;
    score = 0;
    currentIndex = 0;
    missedAnswers = [];
    level = 1;
    correctStreak = 0;
    document.getElementById("level").innerText = level;
    document.getElementById("lives").innerText = lives;
    document.getElementById("score").innerText = score;
    document.getElementById("lives").innerText = lives === Infinity ? "∞" : lives;
    showScreen('gameScreen');
  };

  const missedHeader = document.createElement("div");
  missedHeader.innerText = "Incorrect Answers:";
  missedHeader.style.color = "white";
  missedHeader.style.fontSize = "24px";
  missedHeader.style.marginTop = "30px";
  missedHeader.style.fontFamily = "'Courier New', monospace";

  overlay.appendChild(msg);
  overlay.appendChild(menu);
  overlay.appendChild(retry);
  overlay.appendChild(missedHeader);

  missedAnswers.forEach((item, index) => {
    const miss = document.createElement("div");
    miss.innerText = `${index + 1}. ${item.question} → ${item.answer}`;
    miss.style.color = "red";
    miss.style.fontFamily = "'Courier New', monospace";
    miss.style.fontSize = "20px";
    miss.style.margin = "5px";
    overlay.appendChild(miss);
  });

  document.body.appendChild(overlay);

  function handleEndKeys(e) {
    if (e.key === 'Enter') {
      document.body.removeChild(overlay);
      lives = 3;
      score = 0;
      currentIndex = 0;
      document.getElementById("lives").innerText = lives;
      document.getElementById("score").innerText = score;
      showScreen('gameScreen');
    } else if (e.key === 'Escape') {
      document.body.removeChild(overlay);
      showScreen('menuScreen');
    }
  }

  document.addEventListener("keydown", handleEndKeys);
}

function changeSetting(key, delta) {
  if (key === 'lives' && settings.livesEnabled) {
    settings.lives = Math.max(1, Math.min(10, settings.lives + delta));
    document.getElementById("livesSetting").innerText = settings.lives;
  } else if (key === 'questionsPerLevel') {
    settings.questionsPerLevel = Math.max(1, Math.min(10, settings.questionsPerLevel + delta));
    document.getElementById("questionsPerLevelSetting").innerText = settings.questionsPerLevel;
  }
}

function toggleSetting(key) {
  if (key === 'livesEnabled') {
    settings.livesEnabled = !settings.livesEnabled;
    const label = document.getElementById("livesEnabledSetting");
    const livesText = document.getElementById("livesSetting");
    const minusBtn = document.getElementById("livesMinus");
    const plusBtn = document.getElementById("livesPlus");

    label.innerText = settings.livesEnabled ? "Yes" : "No";
    livesText.innerText = settings.livesEnabled ? settings.lives : "Infinity";
    minusBtn.disabled = !settings.livesEnabled;
    plusBtn.disabled = !settings.livesEnabled;
  } else if (key === 'ttsEnabled') {
    settings.ttsEnabled = !settings.ttsEnabled;
    document.getElementById("ttsEnabledSetting").innerText = settings.ttsEnabled ? "Yes" : "No";
  }
}

function skipQuestion() {
  questionAnswered = true;

  if (window.currentTTS) {
    window.currentTTS.pause?.();
    window.currentTTS = null;
  }

  new Audio(ASSETS.incorrectSound).play();
  score -= 1;
  document.getElementById("score").innerText = score;

  isPaused = true;
  showOverlay(
    {
      title: "-1 Point (Skipped)",
      message: "Correct answer was: " + asteroid.answer
    },
    () => {
      isPaused = false;
      nextQuestion();
      requestAnimationFrame(updateAsteroids);
    }
  );
}



function showOverlay({ title, message, titleColor = "red" }, callback) {
  suppressEnterUntil = Date.now() + 1500;; // 🚫 block next Enter key

  const overlay = document.createElement("div");
  overlay.id = "lifeLostOverlay";
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100vw";
  overlay.style.height = "100vh";
  overlay.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
  overlay.style.color = "white";
  overlay.style.fontFamily = "'Courier New', monospace";
  overlay.style.fontSize = "24px";
  overlay.style.display = "flex";
  overlay.style.flexDirection = "column";
  overlay.style.justifyContent = "center";
  overlay.style.alignItems = "center";
  overlay.style.zIndex = "9999";

  const titleText = document.createElement("div");
  titleText.textContent = title;
  titleText.style.color = titleColor;
  titleText.style.fontSize = "32px";
  titleText.style.marginBottom = "20px";

  const messageText = document.createElement("div");
  messageText.textContent = message;
  messageText.style.color = "white";

  overlay.appendChild(titleText);
  overlay.appendChild(messageText);
  document.body.appendChild(overlay);

  const proceed = () => {
    document.removeEventListener("keydown", onKey);
    document.removeEventListener("mousedown", onClick);
    if (overlay) document.body.removeChild(overlay);
    callback();
  };

  const onKey = (e) => {
    if (e.key === "Enter" || e.key === "Escape") {
      e.preventDefault();
      proceed();
    }
  };

  const onClick = () => {
    proceed();
  };

  document.addEventListener("keydown", onKey);
  document.addEventListener("mousedown", onClick);
}


function showCSVHelp() {
  alert("Your CSV file should have two columns, formatted like this:\n\nWhat is 2+2?,4\nCapital of France?,Paris");
}


function showQuestionData() {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100vw";
  overlay.style.height = "100vh";
  overlay.style.backgroundColor = "rgba(0, 0, 0, 0.85)";
  overlay.style.zIndex = "9999";
  overlay.style.overflowY = "auto";
  overlay.style.padding = "20px";
  overlay.style.boxSizing = "border-box";
  overlay.style.color = "white";
  overlay.style.fontFamily = "'Courier New', monospace";

  const title = document.createElement("h2");
  title.textContent = "Current Question Bank";
  title.style.fontSize = "28px";
  title.style.marginBottom = "20px";

  const close = document.createElement("div");
  close.textContent = "✖ Close";
  close.style.cursor = "pointer";
  close.style.marginBottom = "20px";
  close.style.color = "red";
  close.style.fontSize = "18px";
  close.onclick = () => document.body.removeChild(overlay);

  overlay.appendChild(close);
  overlay.appendChild(title);

  if (quizData.length === 0) {
    const empty = document.createElement("div");
    empty.textContent = "No questions loaded.";
    overlay.appendChild(empty);
  } else {
    quizData.forEach((q, i) => {
      const item = document.createElement("div");
      item.textContent = `${i + 1}. Q: ${q.question} → A: ${q.answer}`;
      item.style.marginBottom = "8px";
      overlay.appendChild(item);
    });
  }

  document.body.appendChild(overlay);
}

function updateTTSLanguage(lang) {
  settings.ttsLanguage = lang;
  localStorage.setItem("ttsLanguage", lang);
}


function toggleMobileMenu() {
  const menu = document.getElementById("mobileMenuOptions");
  menu.style.display = menu.style.display === "flex" ? "none" : "flex";
}

function login() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  })
    .then(res => res.json())
    .then(data => {
      if (data.token) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("username", username);
        showUserOptions(username);

        // ⬇️ Immediately fetch the user's question banks
        loadAllBanks(); // <-- Make sure this function updates the UI

      } else {
        showAuthMessage("Login failed.");
      }
    })
    .catch(() => showAuthMessage("Login failed."));
}

function loadAllBanks() {
  const token = localStorage.getItem("token");
  if (!token) return;

  fetch(`${API_BASE}/questions`, {
    method: "GET",
    headers: { "Authorization": token }
  })
    .then(res => res.json())
    .then(banks => {
      localStorage.setItem("cachedBanks", JSON.stringify(banks));
      updateBankListDropdown(banks); // 🔄 Refresh UI dropdown
    })
    .catch(err => {
      console.warn("⚠️ Could not load question banks.", err);
    });
}


function register() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  fetch(`${API_BASE}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  })
    .then(res => {
      if (res.ok) {
        showAuthMessage("Registration successful. You can now log in.");
      } else {
        res.text().then(txt => showAuthMessage(txt));
      }
    })
    .catch(() => showAuthMessage("Registration failed."));
}

function showAuthMessage(message) {
  document.getElementById("authMessage").innerText = message;
}

function showUserOptions(username) {
  document.getElementById("loginForm").style.display = "none";
  document.getElementById("userOptions").style.display = "flex";
  document.getElementById("welcomeUser").innerText = `Logged in as ${username}`;
  document.getElementById("logoutButton").style.display = "inline-block";
}

function checkAuthOnLoad() {
  const token = localStorage.getItem("token");
  const username = localStorage.getItem("username");
  if (token && username) {
    showUserOptions(username);
  } else {
    document.getElementById("loginForm").style.display = "flex";
    document.getElementById("userOptions").style.display = "none";
  }
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("username");

  // Reset UI
  document.getElementById("userOptions").style.display = "none";
  document.getElementById("loginForm").style.display = "flex";
  document.getElementById("authMessage").innerText = "Logged out.";
}


function loadUserBanks() {
  const token = localStorage.getItem("token");
  fetch(`${API_BASE}/questions`, {
    method: "GET",
    headers: { "Authorization": token }
  })
    .then(res => res.json())
    .then(banks => {
      const list = document.getElementById("bankList");
      list.innerHTML = "";
      banks.forEach(bank => {
        const option = document.createElement("option");
        option.value = bank.name;
        option.textContent = bank.name;
        list.appendChild(option);
      });
      if (banks.length > 0) {
        list.value = banks[0].name;
        document.getElementById("bankEditor").value = csvFromQuestions(banks[0].questions);
        document.getElementById("bankNameInput").value = banks[0].name;
      }
    });
}

function loadSelectedBank() {
  const name = document.getElementById("bankList").value;
  const token = localStorage.getItem("token");
  fetch(`${API_BASE}/questions`, {
    method: "GET",
    headers: { "Authorization": token }
  })
    .then(res => res.json())
    .then(banks => {
      const bank = banks.find(b => b.name === name);
      if (bank) {
        document.getElementById("bankEditor").value = csvFromQuestions(bank.questions);
        document.getElementById("bankNameInput").value = bank.name;
      }
    });
}

function saveCurrentBank() {
  const token = localStorage.getItem("token");
  const name = document.getElementById("bankNameInput").value.trim();
  const csvText = document.getElementById("bankEditor").value;

  const questions = csvToQuestions(csvText);

  fetch(`${API_BASE}/questions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": token
    },
    body: JSON.stringify({ name, questions })
  })
    .then(res => res.text())
    .then(txt => {
      document.getElementById("bankMessage").innerText = txt;
      loadUserBanks();
    });
}

// 🔄 CSV helper functions
function csvFromQuestions(questions) {
  return questions.map(q => `${q.question},${q.answer}`).join("\n");
}

function csvToQuestions(csv) {
  return csv.split("\n").map(line => {
    const [question, answer] = line.split(",");
    return { question: question?.trim() || "", answer: answer?.trim() || "" };
  }).filter(q => q.question && q.answer);
}

function openQuestionBank() {
  document.getElementById("questionBankPanel").style.display = "flex";
  loadQuestionBanks();
}

function closeQuestionBank() {
  document.getElementById("questionBankPanel").style.display = "none";
}

function loadQuestionBanks() {
  const token = localStorage.getItem("token");
  if (!token) {
    console.warn("No token found. Cannot load question banks.");
    return;
  }

  fetch(`${API_BASE}/questions`, {
    method: "GET",
    headers: {
      "Authorization": token
    }
  })
    .then(res => res.json())
    .then(data => {
      // Cache for local use
      localStorage.setItem("cachedBanks", JSON.stringify(data));
      window.questionBanks = data;

      // Update the dropdown
      const list = document.getElementById("bankList");
      list.innerHTML = "";
      data.forEach(bank => {
        const opt = document.createElement("option");
        opt.value = bank.name;
        opt.textContent = bank.name;
        list.appendChild(opt);
      });

      // Auto-load the first bank if one exists
      if (data.length > 0) {
        list.value = data[0].name;
        loadSelectedBank();
      }
    })
    .catch(err => {
      console.warn("⚠️ Could not load question banks.", err);
      document.getElementById("bankMessage").innerText = "⚠️ Failed to load banks.";
    });
}


function loadSelectedBank() {
  const selected = document.getElementById("bankList").value;
  const bank = window.questionBanks.find(b => b.name === selected);
  if (bank) {
    document.getElementById("bankNameInput").value = bank.name;
    document.getElementById("bankEditor").value = bank.questions.map(q => q.join(",")).join("\n");
  }
}

function saveCurrentBank() {
  const name = document.getElementById("bankNameInput").value.trim();
  const raw = document.getElementById("bankEditor").value.trim();
  if (!name || !raw) return;

  const questions = raw.split("\n").map(line => {
    const [q, a] = line.split(",").map(s => s.trim());
    return [q, a];
  });

  fetch(`${API_BASE}/questions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": token
    },
    body: JSON.stringify({ name, questions })
  })
    .then(res => res.text())
    .then(() => {
      document.getElementById("bankMessage").innerText = "✅ Bank saved.";
      loadQuestionBanks();
    });
}

function showQuestionBankScreen() {
  showScreen('questionBankScreen');
  loadQuestionBanks();
}

function loadBankForGame() {
  const name = document.getElementById("bankNameInput").value.trim();
  const csv = document.getElementById("bankEditor").value.trim();

  if (!name || !csv) {
    document.getElementById("bankMessage").innerText = "⚠️ Please enter a bank name and questions.";
    return;
  }

  const rows = csv.split('\n').filter(line => line.trim());
  const questions = rows.map(row => {
    const [question, answer] = row.split(',');
    return {
      question: question?.trim(),
      answer: answer?.trim()
    };
  }).filter(item => item.question && item.answer);

  if (questions.length === 0) {
    document.getElementById("bankMessage").innerText = "⚠️ No valid questions found.";
    return;
  }

  localStorage.setItem("currentQuestionBank", JSON.stringify(questions));
  document.getElementById("bankMessage").innerText = `✅ Loaded "${name}" into game.`;
}

function updateBankListDropdown(banks) {
  const selector = document.getElementById("bankList");
  selector.innerHTML = ""; // clear old options

  banks.forEach(bank => {
    const option = document.createElement("option");
    option.value = bank.name;
    option.textContent = bank.name;
    selector.appendChild(option);
  });
}

function updateVoiceInputLanguage(lang) {
  settings.voiceInputLanguage = lang;
  localStorage.setItem("settings", JSON.stringify(settings));

  if (recognition) {
    recognition.abort(); // stop any ongoing session
    recognition = null;
  }

  initMic(); // reinitialize with new language
}


// Run on page load
window.addEventListener("DOMContentLoaded", () => {
  checkAuthOnLoad();
  initMic();

  // Restore voice input language
  const selector = document.getElementById("voiceInputLanguageSelector");
  if (selector && settings.voiceInputLanguage) {
    selector.value = settings.voiceInputLanguage;
  }
});