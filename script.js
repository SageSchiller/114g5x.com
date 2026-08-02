// 114g5x :: shared interactions. No libraries, no network calls, no tracking.

(function () {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- cursor spotlight ---------- */

  function initSpotlight() {
    if (reduced || !window.matchMedia("(pointer: fine)").matches) return;
    const spot = document.createElement("div");
    spot.id = "spot";
    document.body.appendChild(spot);
    let x = innerWidth / 2, y = innerHeight / 2, tx = x, ty = y;
    addEventListener("pointermove", (e) => {
      tx = e.clientX; ty = e.clientY;
      spot.classList.add("on");
    }, { passive: true });
    (function loop() {
      x += (tx - x) * 0.12;
      y += (ty - y) * 0.12;
      spot.style.transform = `translate(${x}px, ${y}px)`;
      requestAnimationFrame(loop);
    })();
  }

  /* ---------- squad mode: "I" vs "WE" ---------- */
  // The team is named differently depending on whether anyone else showed up.
  // Persisted so the choice survives navigation between pages.

  function squadOn() { return localStorage.getItem("x_squad") === "1"; }

  let shiftTimer = null;

  function paintSquad(animate) {
    const on = squadOn();

    // Ordering matters here. The transition must be in effect BEFORE the
    // custom properties change, with a style flush between the two. Enabling
    // the transition and swapping the variables in the same frame leaves the
    // computed colours stuck on their old values: the transition never sees a
    // start state, so it has nothing to animate from.
    if (animate && !reduced) {
      document.body.classList.add("shifting");
      void document.body.offsetWidth;              // force a style flush
      clearTimeout(shiftTimer);
      shiftTimer = setTimeout(() => document.body.classList.remove("shifting"), 900);
    }

    // body.squad-mode swaps the accent variables; bg.js watches the same class
    // and eases the shader palette across to match.
    document.body.classList.toggle("squad-mode", on);

    document.querySelectorAll("[data-solo]").forEach((el) => {
      el.textContent = on ? el.dataset.squad : el.dataset.solo;
    });
    document.querySelectorAll(".squad").forEach((b) => {
      b.classList.toggle("on", on);
      const lbl = b.querySelector(".lbl");
      if (lbl) lbl.textContent = on ? "SQUAD MODE" : "SOLO MODE";
      b.setAttribute("aria-pressed", String(on));
    });
  }

  function initSquad() {
    document.querySelectorAll(".squad").forEach((b) => {
      b.addEventListener("click", () => {
        localStorage.setItem("x_squad", squadOn() ? "0" : "1");
        paintSquad(true);
      });
    });
    paintSquad();
  }

  /* ---------- decoder typing on the hero ---------- */

  function initDecode() {
    const el = document.getElementById("decode");
    if (!el) return;
    const full = el.dataset.text || "";
    const caret = '<span class="caret">&nbsp;</span>';
    if (reduced) { el.innerHTML = full + caret; return; }

    const CHARS = "01!<>[]{}/\\#$%&*+=?";
    let i = 0;

    function step() {
      if (i > full.length) { el.innerHTML = full + caret; return; }
      // Settled prefix, then a few scrambling characters at the edge.
      let out = full.slice(0, i);
      for (let k = 0; k < 3 && i + k < full.length; k++) {
        out += CHARS[Math.floor(Math.random() * CHARS.length)];
      }
      el.innerHTML = out + caret;
      i++;
      setTimeout(step, 45 + Math.random() * 45);
    }
    setTimeout(step, 500);
  }

  /* ---------- scramble text on hover ---------- */

  function initScramble() {
    if (reduced) return;
    const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+=?";
    document.querySelectorAll("[data-scramble]").forEach((el) => {
      const original = el.textContent;
      let timer = null;
      el.addEventListener("mouseenter", () => {
        let frame = 0;
        clearInterval(timer);
        timer = setInterval(() => {
          el.textContent = original
            .split("")
            .map((c, idx) => {
              if (c === " ") return " ";
              return idx < frame / 2 ? original[idx] : CHARS[Math.floor(Math.random() * CHARS.length)];
            })
            .join("");
          frame++;
          if (frame / 2 >= original.length) {
            clearInterval(timer);
            el.textContent = original;
          }
        }, 28);
      });
      el.addEventListener("mouseleave", () => {
        clearInterval(timer);
        el.textContent = original;
      });
    });
  }

  /* ---------- reveal + count up + skill bars ---------- */

  function animateCount(el) {
    const target = parseFloat(el.dataset.count);
    const dec = parseInt(el.dataset.dec || "0", 10);
    const suffix = el.dataset.suffix || "";
    if (reduced) {
      el.textContent = target.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + suffix;
      return;
    }
    const dur = 1400;
    const t0 = performance.now();
    (function tick(now) {
      const p = Math.min(1, (now - t0) / dur);
      // easeOutExpo
      const e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      const v = (target * e).toFixed(dec);
      el.textContent = String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + suffix;
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }

  function initReveal() {
    const items = document.querySelectorAll(".rv");
    if (!("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("in"));
      document.querySelectorAll("[data-count]").forEach(animateCount);
      document.querySelectorAll(".bar-fill").forEach((b) => { b.style.width = b.dataset.pct + "%"; });
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add("in");
        en.target.querySelectorAll("[data-count]").forEach(animateCount);
        en.target.querySelectorAll(".bar-fill").forEach((b) => {
          setTimeout(() => { b.style.width = b.dataset.pct + "%"; }, 180);
        });
        io.unobserve(en.target);
      });
    }, { threshold: 0.18, rootMargin: "0px 0px -60px 0px" });
    items.forEach((el) => io.observe(el));
  }

  /* ---------- pointer tilt on cards ---------- */

  function initTilt() {
    if (reduced || !window.matchMedia("(pointer: fine)").matches) return;
    document.querySelectorAll(".tilt").forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform =
          `perspective(900px) rotateY(${px * 5}deg) rotateX(${-py * 5}deg) translateY(-3px)`;
      });
      card.addEventListener("pointerleave", () => { card.style.transform = ""; });
    });
  }

  /* ---------- boot log typing ---------- */

  function initBootLog() {
    const pre = document.getElementById("bootlog");
    if (!pre) return;
    const lines = JSON.parse(pre.dataset.lines || "[]");
    if (reduced) {
      pre.innerHTML = lines.join("\n");
      return;
    }
    let i = 0;
    function next() {
      if (i >= lines.length) return;
      pre.innerHTML += (i ? "\n" : "") + lines[i];
      pre.scrollTop = pre.scrollHeight;
      i++;
      setTimeout(next, 90 + Math.random() * 160);
    }
    const io = new IntersectionObserver((en) => {
      if (en[0].isIntersecting) { next(); io.disconnect(); }
    }, { threshold: 0.3 });
    io.observe(pre);
  }

  /* ---------- konami ---------- */

  function initKonami() {
    const seq = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"];
    let pos = 0;
    addEventListener("keydown", (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      pos = (k === seq[pos]) ? pos + 1 : (k === seq[0] ? 1 : 0);
      if (pos === seq.length) {
        pos = 0;
        document.body.style.transition = "filter 0.4s";
        document.body.style.filter = "hue-rotate(180deg) saturate(1.6)";
        setTimeout(() => {
          alert("CHEAT CODE ACCEPTED\n\nGod mode enabled.\nYou still placed 41st.");
          document.body.style.filter = "";
        }, 450);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initSpotlight();
    initSquad();
    initDecode();
    initScramble();
    initReveal();
    initTilt();
    initBootLog();
    initKonami();
  });
})();
