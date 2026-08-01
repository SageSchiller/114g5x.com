// 114g5x :: animated background.
// Raw WebGL fragment shader on a fullscreen triangle. No libraries, no CDN.
// Degrades to a CSS gradient if WebGL is unavailable, freezes on
// prefers-reduced-motion, and stops rendering when the tab is hidden.

(function () {
  "use strict";

  const canvas = document.getElementById("bg");
  if (!canvas) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let gl = null;
  try {
    gl = canvas.getContext("webgl", { antialias: false, alpha: false, depth: false })
      || canvas.getContext("experimental-webgl");
  } catch (e) { gl = null; }

  if (!gl) {
    document.body.classList.add("no-webgl");
    return;
  }

  const VERT = `
    attribute vec2 a_pos;
    void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
  `;

  const FRAG = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif

    uniform vec2  u_res;
    uniform float u_time;
    uniform vec2  u_mouse;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i),               hash(i + vec2(1.0, 0.0)), u.x),
                 mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }

    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p = p * 2.03;
        a *= 0.5;
      }
      return v;
    }

    void main() {
      vec2 frag = gl_FragCoord.xy;
      vec2 uv   = (frag - 0.5 * u_res) / u_res.y;
      float t   = u_time * 0.05;

      // Deep base. Everything else adds light on top of near-black.
      vec3 col = vec3(0.018, 0.026, 0.040);

      // Two drifting noise fields: cold cyan, hot magenta.
      float n1 = fbm(uv * 2.2 + vec2(t, -t * 0.6));
      float n2 = fbm(uv * 3.4 - vec2(t * 0.8, t * 0.35));
      col += vec3(0.00, 0.55, 0.78) * pow(n1, 3.5) * 0.38;
      col += vec3(0.72, 0.10, 0.44) * pow(n2, 4.0) * 0.34;

      // Cursor bloom, so the page reacts to the pointer.
      float md = length(uv - u_mouse);
      col += vec3(0.0, 0.42, 0.60) * smoothstep(0.55, 0.0, md) * 0.16;

      // Receding perspective grid, confined to the very bottom so it reads
      // as a horizon rather than washing over the copy.
      vec2 g = vec2(uv.x, -uv.y - 0.30);
      if (g.y > 0.0) {
        float persp = 1.0 / (g.y * 7.0 + 0.05);
        vec2  gp    = vec2(g.x * persp, persp + u_time * 0.35);
        vec2  cell  = abs(fract(gp) - 0.5);
        float line  = min(cell.x, cell.y);
        float glow  = smoothstep(0.032, 0.0, line);
        float fade  = smoothstep(0.55, 0.0, g.y);
        col += vec3(0.0, 0.78, 0.98) * glow * fade * 0.22;
      }

      // Slow scan bar sweeping vertically.
      float sweep = fract(u_time * 0.035);
      float band  = smoothstep(0.035, 0.0, abs(uv.y + 0.5 - sweep * 1.0));
      col += vec3(0.0, 0.45, 0.65) * band * 0.18;

      // CRT-ish scanlines and grain.
      col *= 0.90 + 0.10 * sin(frag.y * 2.1);
      col += (hash(frag + fract(u_time)) - 0.5) * 0.030;

      // Vignette keeps the copy readable in the middle.
      float d = length(uv * vec2(0.72, 1.0));
      col *= smoothstep(1.40, 0.20, d);

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error("shader compile failed:", gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { document.body.classList.add("no-webgl"); return; }

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error("program link failed:", gl.getProgramInfoLog(prog));
    document.body.classList.add("no-webgl");
    return;
  }
  gl.useProgram(prog);

  // One oversized triangle covers the viewport with no index buffer.
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "a_pos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uRes   = gl.getUniformLocation(prog, "u_res");
  const uTime  = gl.getUniformLocation(prog, "u_time");
  const uMouse = gl.getUniformLocation(prog, "u_mouse");

  let mouse = [0, 0];
  let target = [0, 0];

  window.addEventListener("pointermove", (e) => {
    target = [
      (e.clientX - window.innerWidth / 2) / window.innerHeight,
      -(e.clientY - window.innerHeight / 2) / window.innerHeight,
    ];
  }, { passive: true });

  function resize() {
    // Cap DPR: the shader is fill-rate bound and 3x retina buys nothing here.
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    const w = Math.floor(window.innerWidth * dpr);
    const h = Math.floor(window.innerHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }

  let running = true;
  let raf = null;
  const start = performance.now();

  function frame(now) {
    if (!running) return;
    resize();
    mouse[0] += (target[0] - mouse[0]) * 0.05;
    mouse[1] += (target[1] - mouse[1]) * 0.05;
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, (now - start) / 1000);
    gl.uniform2f(uMouse, mouse[0], mouse[1]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    raf = requestAnimationFrame(frame);
  }

  if (reduced) {
    // Render a single static frame so the page still has depth.
    resize();
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, 12.0);
    gl.uniform2f(uMouse, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    window.addEventListener("resize", () => {
      resize();
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    });
  } else {
    raf = requestAnimationFrame(frame);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        running = false;
        if (raf) cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        raf = requestAnimationFrame(frame);
      }
    });
  }
})();
