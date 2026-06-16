const heroImages = Array.from(
  { length: 10 },
  (_, index) => `/src/customer-home/images/tlz-${String(index + 1).padStart(2, "0")}.png`
);

const frameDuration = 3000;

const slides = Array.from(document.querySelectorAll(".hero-slide"));
const count = document.querySelector(".hero-count");
const progress = document.querySelector(".hero-progress-track i");

let activeLayer = 0;
let activeImage = 0;

function preloadImage(src) {
  const image = new Image();
  image.src = src;
}

function setFrameStyle(slide, frameIndex) {
  const progress = frameIndex / (heroImages.length - 1);
  slide.style.setProperty("--frame-blur", `${(2.6 * (1 - progress)).toFixed(2)}px`);
  slide.style.setProperty("--frame-sepia", (progress * 0.16).toFixed(3));
  slide.style.setProperty("--frame-saturation", (0.92 + progress * 0.16).toFixed(3));
  slide.style.setProperty("--frame-brightness", (0.98 + progress * 0.05).toFixed(3));
  slide.style.setProperty("--frame-scale-start", (1.015 + progress * 0.012).toFixed(3));
  slide.style.setProperty("--frame-scale-end", (1.075 + progress * 0.025).toFixed(3));
  slide.style.setProperty("--frame-shift-x", `${(-0.35 - progress * 0.45).toFixed(2)}%`);
  slide.style.setProperty("--frame-shift-y", `${(-0.12 - progress * 0.28).toFixed(2)}%`);
}

function showNextImage() {
  const nextImage = (activeImage + 1) % heroImages.length;
  const nextLayer = activeLayer === 0 ? 1 : 0;
  const incoming = slides[nextLayer];
  const outgoing = slides[activeLayer];

  incoming.src = heroImages[nextImage];
  setFrameStyle(incoming, nextImage);
  incoming.classList.remove("is-active", "is-retiring");

  requestAnimationFrame(() => {
    incoming.classList.add("is-active");
    outgoing.classList.add("is-retiring");
    outgoing.classList.remove("is-active");
  });

  activeLayer = nextLayer;
  activeImage = nextImage;
  count.textContent = String(activeImage + 1).padStart(2, "0");
  progress.style.transform = `scaleX(${(activeImage + 1) / heroImages.length})`;
  preloadImage(heroImages[(activeImage + 1) % heroImages.length]);
}

setFrameStyle(slides[0], 0);
progress.style.transform = `scaleX(${1 / heroImages.length})`;
heroImages.slice(1).forEach(preloadImage);

if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  window.setInterval(showNextImage, frameDuration);
}
