/* app.js → Home
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see app.js). */

export function install(ctx) {
  Object.assign(ctx, { renderHome, setupHero, setupCategoryScroller, setupCountdowns, observeReveals });
  function renderHome() {
    const root = document.getElementById("home-root");
    if (!root) return;
    const renderers = {
      hero: ctx.heroHTML,
      trust: ctx.trustBarHTML,
      renewed: ctx.renewedHTML,
      categories: ctx.categoriesHTML,
      offer: ctx.offerHTML,
      products: ctx.productSectionsHTML,
      sustain: ctx.sustainHTML,
      service: ctx.serviceHTML,
      video: ctx.videoHTML,
      reviews: ctx.reviewsHTML,
      press: ctx.pressHTML
    };
    const order = (ctx.SET.pageSections || [])
      .filter((s) => s.visible !== false)
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
    root.innerHTML = order.map((section) => (renderers[section.id] ? renderers[section.id]() : "")).join("");
    setupHero();
    setupCategoryScroller();
    setupCountdowns();
    ctx.hydrateIcons(root);
    observeReveals();
  }

  function setupHero() {
    const hero = document.getElementById("hero");
    if (!hero) return;
    const slides = [...hero.querySelectorAll(".hero-slide")];
    const dots = [...hero.querySelectorAll(".hero-dots button")];
    if (!slides.length) return;
    let idx = 0;
    let timer;
    const show = (n) => {
      idx = (n + slides.length) % slides.length;
      slides.forEach((slide, i) => slide.classList.toggle("active", i === idx));
      dots.forEach((dot, i) => dot.classList.toggle("active", i === idx));
    };
    const play = () => {
      clearInterval(timer);
      if (slides.length > 1) timer = setInterval(() => show(idx + 1), 6500);
    };
    hero.querySelector(".prev")?.addEventListener("click", () => {
      show(idx - 1);
      play();
    });
    hero.querySelector(".next")?.addEventListener("click", () => {
      show(idx + 1);
      play();
    });
    dots.forEach((dot, i) =>
      dot.addEventListener("click", () => {
        show(i);
        play();
      })
    );
    hero.addEventListener("mouseenter", () => clearInterval(timer));
    hero.addEventListener("mouseleave", play);
    play();
  }

  function setupCategoryScroller() {
    const track = document.getElementById("cat-track");
    document
      .querySelector(".cat-arrow")
      ?.addEventListener("click", () =>
        track?.scrollBy({ left: (ctx.R.lang === "ar" ? -1 : 1) * 380, behavior: "smooth" })
      );
  }

  function setupCountdowns() {
    const nodes = [...document.querySelectorAll("[data-countdown]")];
    if (!nodes.length) return;
    const tick = () => {
      nodes.forEach((node) => {
        const end = Date.parse(node.dataset.countdown || "");
        if (!end) {
          node.innerHTML = "";
          return;
        }
        const diff = end - Date.now();
        if (diff <= 0) {
          node.innerHTML = `<span class="countdown-ended">${ctx.R.lang === "ar" ? "انتهى العرض" : "Offre terminée"}</span>`;
          return;
        }
        const days = Math.floor(diff / 864e5);
        const hours = Math.floor((diff % 864e5) / 36e5);
        const mins = Math.floor((diff % 36e5) / 6e4);
        const secs = Math.floor((diff % 6e4) / 1000);
        node.innerHTML = `
          <span class="countdown-label">${ctx.esc(ctx.t("offerEnds"))}</span>
          <span class="countdown-box"><b>${days}</b><small>${ctx.esc(ctx.t("days"))}</small></span>
          <span class="countdown-box"><b>${String(hours).padStart(2, "0")}</b><small>${ctx.esc(ctx.t("hours"))}</small></span>
          <span class="countdown-box"><b>${String(mins).padStart(2, "0")}</b><small>${ctx.esc(ctx.t("minutes"))}</small></span>
          <span class="countdown-box"><b>${String(secs).padStart(2, "0")}</b><small>${ctx.esc(ctx.t("seconds"))}</small></span>`;
      });
    };
    tick();
    clearInterval(window.__restoreCountdown);
    window.__restoreCountdown = setInterval(tick, 1000);
  }

  ctx.revealObserver = undefined;
  function observeReveals() {
    const nodes = document.querySelectorAll(".reveal:not(.in)");
    if (!nodes.length) return;
    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      nodes.forEach((node) => node.classList.add("in"));
      return;
    }
    ctx.revealObserver =
      ctx.revealObserver ||
      new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("in");
              ctx.revealObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.08, rootMargin: "0px 0px -30px" }
      );
    nodes.forEach((node) => ctx.revealObserver.observe(node));
  }
}
