# 114g5x.com

Site for the CTF team **114g5x** (leetspeak for "I lag and sux"). Presents
as a deadly serious dark-cyberpunk offensive security collective. Reads, on
inspection, as an extremely self-deprecating joke about a one-person team
that has never placed in the top half of anything.

The gag only works if the chrome stays straight-faced. Keep the visual
language severe and let the copy do all the comedy.

## Team designations

Two official names, applied strictly by headcount:

- **WE CAMP, AND LAG, AND SUCK** when anyone else is on the team
- **I CAMP, AND LAG, AND SUCK** when flying solo

The nav bar has a SOLO/SQUAD toggle that swaps every instance across the
site. It defaults to solo and persists in `localStorage` under `x_squad`.
Any element with `data-solo` and `data-squad` attributes gets swapped, so
new copy picks this up automatically.

## The two modes are two colour schemes

The toggle repaints the entire site, shader included.

- **SOLO**: cyan against magenta. Cold, and everything reads flagged.
- **SQUAD**: acid green against cyan. The magenta disappears completely and
  the whole interface reads nominal, while the numbers stay exactly as bad.
  That contradiction is the joke; keep it if you retheme.

**How it is wired.** Components never reference the raw palette
(`--cyan`, `--magenta`). They use the semantic `--accent` / `--accent2`
pair, plus `--accent-rgb` / `--accent2-rgb` channel variables for every
`rgba()` glow and border. `body.squad-mode` overrides those four, and
`bg.js` watches the same class and eases a `u_mode` uniform from 0 to 1,
mixing the shader's five colours per pixel so the background sweeps.

Three things that will bite anyone editing this:

- **Never hardcode `rgba(0, 240, 255, …)` again.** Those do not follow a
  variable swap. Use `rgba(var(--accent-rgb), …)`. Converting the original
  32 hardcoded values is what made theming possible at all.
- **The body class is `squad-mode`, not `squad`.** The toggle buttons carry
  class `squad`, so naming the body class the same made
  `querySelectorAll(".squad")` match the body too, which then collected an
  `.on` class and an `aria-pressed` attribute it had no business having.
- **Order of operations in `paintSquad()` is load-bearing.** The `shifting`
  transition class must be added, and a style flush forced
  (`void document.body.offsetWidth`), *before* `squad-mode` toggles. Do both
  in one frame and the computed colours stay stuck on their old values: the
  transition never observes a start state, so nothing animates. The
  variables update correctly and the colours simply do not follow, which is
  a confusing thing to debug.

## Stack

Dependency-free static site. No framework, npm, backend, build step,
analytics, third-party scripts, or tracking.

- `index.html` (hero, telemetry, doctrine, capabilities, live log),
  `roster.html`, `ops.html`, `recruit.html`, `404.html`
- `styles.css`: glass panels, neon, glitch text, notched corners
- `bg.js`: WebGL fragment shader background
- `script.js`: shared interactions
- `favicon.svg`, `wrangler.jsonc`

## The background shader

`bg.js` renders a raw WebGL fragment shader on a single oversized triangle.
No three.js, no CDN. It layers two drifting fbm noise fields (cold cyan and
hot magenta), a receding perspective grid pinned to the bottom as a horizon,
a slow scan sweep, scanlines, grain, and a vignette, plus a soft bloom that
follows the cursor.

Notes if you tune it:

- The grid is deliberately dim and confined to the lower strip. Earlier
  values washed it across the body copy and killed readability. If you
  raise the intensity, re-check the hero and button contrast.
- Device pixel ratio is capped at 1.75. The shader is fill-rate bound and
  full retina resolution costs a lot for no visible gain.
- It renders one static frame under `prefers-reduced-motion`, stops entirely
  when the tab is hidden, and falls back to a CSS gradient (`body.no-webgl`)
  if WebGL or shader compilation fails.
- Verifying it with `gl.readPixels` returns black. That is expected: the
  context is created without `preserveDrawingBuffer`, so the buffer is
  undefined after compositing. Check it with a screenshot instead.

## Interactive bits

- Decoder line in the hero that scrambles and resolves to the translation
- Glitch effect on headings via `data-text` and dual clipped pseudo-elements
- Hover scramble on any element with `data-scramble`
- Count-up stats via `data-count`, with `data-dec` and `data-suffix`
- Skill bars via `data-pct`, animated on scroll
- Pointer tilt on `.tilt` cards, cursor spotlight, scroll reveals
- Konami code easter egg
- Recruitment quiz that reacts locally and scores nothing

Everything degrades under `prefers-reduced-motion`, which is honored
throughout rather than just in the shader.

## Privacy

Nothing is collected, stored remotely, or transmitted. There is no backend
and no form that POSTs anywhere. `localStorage` holds exactly one value, the
solo/squad preference. The recruitment quiz is pure client-side theater.

## Content notes

Every event, placement, and result on `ops.html` is invented. No real
competition, team, or person is described. Keep the footer disclaimer on any
new page, and keep it to one line: the joke dies if the page starts
apologizing for itself.

## Local preview

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## Deploy with Cloudflare

1. In Cloudflare dashboard: **Workers & Pages > Create application > Pages
   > Connect to Git**, and select the `114g5x.com` GitHub repo.
   - Framework preset: `None`
   - Build command: *(leave blank)*
   - Build output directory: `/`
2. Deploy. Cloudflare gives you a `*.pages.dev` preview URL.
3. In the project, add the custom domain `114g5x.com`.
4. Point the domain's nameservers at Cloudflare, same as sageschiller.com:
   in your registrar, switch nameservers to the two Cloudflare provides.

No environment variables or secrets are needed; there is no backend.
