const preloader = document.getElementById("preloader");
const introScreen = document.getElementById("introScreen");
const experience = document.getElementById("experience");
const openGiftBtn = document.getElementById("openGiftBtn");
const replayBtn = document.getElementById("replayBtn");
const musicToggle = document.getElementById("musicToggle");
const bgMusic = document.getElementById("bgMusic");
const easterEggBtn = document.getElementById("easterEggBtn");
const surpriseNote = document.getElementById("surpriseNote");
const typedLetter = document.getElementById("typedLetter");
const heartBurst = document.getElementById("heartBurst");
const finaleSection = document.getElementById("finale");
const starCanvas = document.getElementById("star-canvas");
const puzzleBoard = document.getElementById("puzzleBoard");
const puzzleSlots = document.getElementById("puzzleSlots");
const puzzleTray = document.getElementById("puzzleTray");
const puzzleHint = document.getElementById("puzzleHint");
const puzzleHeadline = document.getElementById("puzzleHeadline");
const revealElements = document.querySelectorAll(".reveal");

const LETTER_TEXT = `كل سنة وأنتي طيبة 
وعقبال 100 سنة يارب فى صحة وسعادة 
و إن شاء الله السنة الجاية تكوني خلصتي ثانوية وتحققي كل اللى بتتمنيه.
17 Years 🎂💗
`

;

const PUZZLE_COLUMNS = 2;
const PUZZLE_ROWS = 2;
const PUZZLE_LAYOUT = [
  { id: 0, col: 0, row: 0 },
  { id: 1, col: 1, row: 0 },
  { id: 2, col: 1, row: 1 },
  { id: 3, col: 0, row: 1 }
];

let hasStartedExperience = false;
let isMuted = false;
let hasTypedLetter = false;
let hasTriggeredFinale = false;
let noteTimeout;
let audioFadeFrame;
let lastScrollY = 0;
let selectedPieceId = null;
let placedPieces = 0;
let puzzleSolved = false;

const starState = {
  ctx: null,
  width: 0,
  height: 0,
  stars: []
};

const puzzlePieces = new Map();

window.addEventListener("load", () => {
  initStarfield();
  initPuzzle();
  tryStartMusic();

  setTimeout(() => {
    preloader.classList.add("is-hidden");
  }, 2400);
});

window.addEventListener("pointerdown", () => {
  tryStartMusic();
}, { once: true, passive: true });

window.addEventListener("keydown", () => {
  tryStartMusic();
}, { once: true });

openGiftBtn.addEventListener("click", startExperience);
replayBtn.addEventListener("click", replayExperience);
musicToggle.addEventListener("click", toggleMusic);

easterEggBtn.addEventListener("click", () => {
  surpriseNote.classList.add("is-visible");
  clearTimeout(noteTimeout);
  noteTimeout = setTimeout(() => {
    surpriseNote.classList.remove("is-visible");
  }, 2800);
});

window.addEventListener("scroll", () => {
  lastScrollY = window.scrollY;
  updateScrollProgress();
  updateParallax();
}, { passive: true });

window.addEventListener("resize", () => {
  resizeCanvas();
  createStars();
});

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) {
      return;
    }

    entry.target.classList.add("reveal-visible");

    if (entry.target.id === "letter" && !hasTypedLetter) {
      startTypingLetter();
    }

    if (entry.target.id === "finale" && !hasTriggeredFinale) {
      triggerFinale();
    }

    revealObserver.unobserve(entry.target);
  });
}, {
  threshold: 0.18
});

revealElements.forEach((element) => {
  revealObserver.observe(element);
});

revealObserver.observe(document.getElementById("letter"));
revealObserver.observe(finaleSection);

function startExperience() {
  if (hasStartedExperience) {
    return;
  }

  hasStartedExperience = true;
  introScreen.classList.add("is-exiting");
  experience.classList.remove("experience--locked");
  experience.classList.add("experience--unlocked");
  musicToggle.classList.remove("music-toggle--hidden");
  easterEggBtn.classList.remove("easter-egg--hidden");
  document.body.classList.add("experience-active");

  tryStartMusic();

  setTimeout(() => {
    introScreen.setAttribute("aria-hidden", "true");
  }, 900);
}

function replayExperience() {
  document.body.classList.add("page-restart");
  setTimeout(() => {
    window.location.reload();
  }, 420);
}

function tryStartMusic() {
  if (!bgMusic || isMuted) {
    return;
  }

  if (!bgMusic.paused) {
    return;
  }

  cancelAnimationFrame(audioFadeFrame);
  bgMusic.volume = 0;

  const playAttempt = bgMusic.play();
  if (playAttempt && typeof playAttempt.then === "function") {
    playAttempt.then(() => {
      fadeMusicTo(0.48, 2200);
    }).catch(() => {
      // Browsers may block autoplay until a gesture; the pointer/keydown retry covers this.
    });
    return;
  }

  fadeMusicTo(0.48, 2200);
}

function fadeMusicTo(targetVolume, duration) {
  const startVolume = bgMusic.volume;
  const startTime = performance.now();

  const step = (timestamp) => {
    const progress = Math.min((timestamp - startTime) / duration, 1);
    bgMusic.volume = startVolume + ((targetVolume - startVolume) * progress);

    if (progress < 1) {
      audioFadeFrame = requestAnimationFrame(step);
    }
  };

  audioFadeFrame = requestAnimationFrame(step);
}

function toggleMusic() {
  if (!bgMusic) {
    return;
  }

  isMuted = !isMuted;
  musicToggle.classList.toggle("is-muted", isMuted);
  musicToggle.setAttribute("aria-pressed", String(isMuted));

  if (isMuted) {
    cancelAnimationFrame(audioFadeFrame);
    bgMusic.pause();
    bgMusic.volume = 0;
    return;
  }

  tryStartMusic();
}

function initPuzzle() {
  if (!puzzleBoard || !puzzleSlots || !puzzleTray) {
    return;
  }

  const puzzleImage = puzzleBoard.dataset.image;
  puzzleBoard.style.setProperty("--puzzle-image", `url("${puzzleImage}")`);
  const shuffledLayout = [...PUZZLE_LAYOUT].sort(() => Math.random() - 0.5);

  PUZZLE_LAYOUT.forEach((piece) => {
    const slot = document.createElement("button");
    slot.type = "button";
    slot.className = "puzzle-slot";
    slot.dataset.pieceId = String(piece.id);
    slot.style.gridColumn = `${piece.col + 1}`;
    slot.style.gridRow = `${piece.row + 1}`;
    slot.style.backgroundImage = `linear-gradient(rgba(11, 11, 15, 0.72), rgba(11, 11, 15, 0.72)), url("${puzzleImage}")`;
    slot.style.backgroundSize = `${PUZZLE_COLUMNS * 100}% ${PUZZLE_ROWS * 100}%`;
    slot.style.backgroundPosition = `${(piece.col / (PUZZLE_COLUMNS - 1)) * 100}% ${(piece.row / (PUZZLE_ROWS - 1)) * 100}%`;
    slot.setAttribute("aria-label", `Puzzle slot ${piece.id + 1}`);
    slot.addEventListener("click", () => tryPlacePiece(slot));
    slot.addEventListener("dragover", (event) => {
      event.preventDefault();
      slot.classList.add("is-targeted");
    });
    slot.addEventListener("dragleave", () => {
      slot.classList.remove("is-targeted");
    });
    slot.addEventListener("drop", (event) => {
      event.preventDefault();
      slot.classList.remove("is-targeted");
      const droppedId = Number(event.dataTransfer.getData("text/plain"));
      placePieceById(droppedId, slot);
    });
    puzzleSlots.appendChild(slot);
  });

  shuffledLayout.forEach((piece) => {
    const pieceElement = document.createElement("button");
    pieceElement.type = "button";
    pieceElement.className = "puzzle-piece";
    pieceElement.draggable = true;
    pieceElement.dataset.pieceId = String(piece.id);
    pieceElement.style.backgroundImage = `url("${puzzleImage}")`;
    pieceElement.style.backgroundSize = `${PUZZLE_COLUMNS * 100}% ${PUZZLE_ROWS * 100}%`;
    pieceElement.style.backgroundPosition = `${(piece.col / (PUZZLE_COLUMNS - 1)) * 100}% ${(piece.row / (PUZZLE_ROWS - 1)) * 100}%`;
    pieceElement.setAttribute("aria-label", `Puzzle piece ${piece.id + 1}`);
    pieceElement.addEventListener("click", () => selectPiece(piece.id));
    pieceElement.addEventListener("dragstart", (event) => {
      selectPiece(piece.id);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(piece.id));
    });
    pieceElement.addEventListener("dragend", () => {
      pieceElement.classList.remove("is-dragging");
      clearSelection();
    });
    pieceElement.addEventListener("pointerdown", () => {
      pieceElement.classList.add("is-dragging");
    });

    puzzlePieces.set(piece.id, pieceElement);
    puzzleTray.appendChild(pieceElement);
  });
}

function selectPiece(pieceId) {
  if (puzzleSolved) {
    return;
  }

  selectedPieceId = pieceId;
  puzzlePieces.forEach((element, id) => {
    element.classList.toggle("is-selected", id === pieceId);
  });
  puzzleHint.textContent = "Now tap the matching place on the board.";
}

function clearSelection() {
  selectedPieceId = null;
  puzzlePieces.forEach((element) => {
    element.classList.remove("is-selected", "is-dragging");
  });
}

function tryPlacePiece(slot) {
  if (selectedPieceId === null || puzzleSolved) {
    return;
  }

  placePieceById(selectedPieceId, slot);
}

function placePieceById(pieceId, slot) {
  if (puzzleSolved || Number.isNaN(pieceId)) {
    return;
  }

  const expectedId = Number(slot.dataset.pieceId);
  const pieceElement = puzzlePieces.get(pieceId);

  if (!pieceElement || slot.querySelector(".puzzle-piece")) {
    return;
  }

  if (pieceId !== expectedId) {
    slot.classList.add("is-wrong");
    puzzleHint.textContent = "Almost. That piece belongs somewhere else.";
    setTimeout(() => {
      slot.classList.remove("is-wrong");
    }, 520);
    return;
  }

  slot.appendChild(pieceElement);
  slot.classList.add("is-filled");
  pieceElement.classList.remove("is-selected", "is-dragging");
  pieceElement.draggable = false;
  pieceElement.disabled = true;
  placedPieces += 1;
  clearSelection();

  if (placedPieces < PUZZLE_LAYOUT.length) {
    const piecesLeft = PUZZLE_LAYOUT.length - placedPieces;
    puzzleHint.textContent = `${piecesLeft} piece${piecesLeft === 1 ? "" : "s"} left until the reveal.`;
    return;
  }

  finishPuzzle();
}

function finishPuzzle() {
  if (puzzleSolved) {
    return;
  }

  puzzleSolved = true;
  puzzleBoard.classList.add("is-complete");
  puzzleTray.classList.add("is-complete");
  puzzleHint.textContent = "";
  puzzleHeadline.textContent = "You did it.\nNow we can see the real moon.";
}

function updateScrollProgress() {
  const scrollTop = window.scrollY;
  const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
  document.documentElement.style.setProperty("--scroll-progress", progress.toFixed(2));
}

function updateParallax() {
  document.documentElement.style.setProperty("--parallax-shift", `${lastScrollY * -0.18}px`);
}

function startTypingLetter() {
  hasTypedLetter = true;
  let index = 0;

  const typeNextCharacter = () => {
    if (index >= LETTER_TEXT.length) {
      return;
    }

    typedLetter.textContent += LETTER_TEXT.charAt(index);
    index += 1;

    const currentChar = LETTER_TEXT.charAt(index - 1);
    const delay = currentChar === "\n" ? 140 : currentChar === "." || currentChar === "," ? 45 : 24;
    setTimeout(typeNextCharacter, delay);
  };

  typeNextCharacter();
}

function triggerFinale() {
  hasTriggeredFinale = true;
  createHeartBurst();
}

function createHeartBurst() {
  heartBurst.innerHTML = "";

  for (let i = 0; i < 22; i += 1) {
    const heart = document.createElement("span");
    heart.className = "heart";
    heart.style.left = `${Math.random() * 100}%`;
    heart.style.bottom = `${-5 + Math.random() * 12}%`;
    heart.style.animationDelay = `${Math.random() * 1.2}s`;
    heart.style.setProperty("--x-shift", `${-140 + Math.random() * 280}px`);
    heart.style.opacity = "0";
    heartBurst.appendChild(heart);
  }
}

function initStarfield() {
  const context = starCanvas.getContext("2d");
  if (!context) {
    return;
  }

  starState.ctx = context;
  resizeCanvas();
  createStars();
  animateStars();
}

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  starState.width = window.innerWidth;
  starState.height = window.innerHeight;
  starCanvas.width = starState.width * ratio;
  starCanvas.height = starState.height * ratio;
  starCanvas.style.width = `${starState.width}px`;
  starCanvas.style.height = `${starState.height}px`;
  starState.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function createStars() {
  const starCount = Math.min(200, Math.floor((starState.width * starState.height) / 7000));
  starState.stars = Array.from({ length: starCount }, () => ({
    x: Math.random() * starState.width,
    y: Math.random() * starState.height,
    radius: Math.random() * 1.6 + 0.4,
    alpha: Math.random() * 0.7 + 0.2,
    drift: Math.random() * 0.18 + 0.04,
    speed: Math.random() * 0.12 + 0.02
  }));
}

function animateStars() {
  const { ctx, width, height, stars } = starState;

  ctx.clearRect(0, 0, width, height);

  stars.forEach((star) => {
    star.y += star.speed;
    star.x += Math.sin((performance.now() * 0.0001) + star.drift) * 0.04;

    if (star.y > height + 6) {
      star.y = -6;
      star.x = Math.random() * width;
    }

    ctx.beginPath();
    ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
    ctx.shadowBlur = 12;
    ctx.shadowColor = "rgba(255, 209, 233, 0.35)";
    ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    ctx.fill();
  });

  requestAnimationFrame(animateStars);
}
