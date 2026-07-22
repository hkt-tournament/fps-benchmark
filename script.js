/**
 * WebGL Volumetric Shader Benchmark Engine
 * Inspired by Volume Shader BM (3D Raymarching Engine)
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const glCanvas = document.getElementById('gl-canvas');
  const graphCanvas = document.getElementById('graph-canvas');
  const btnStart = document.getElementById('btn-start');
  const btnStop = document.getElementById('btn-stop');
  const btnReset = document.getElementById('btn-reset');
  const progressBar = document.getElementById('progress-bar');
  const statusBadge = document.getElementById('status-badge');
  const resultsCard = document.getElementById('results');

  // Metrics DOM
  const valFps = document.getElementById('val-fps');
  const valFrameTime = document.getElementById('val-frametime');
  const valAvgFps = document.getElementById('val-avg-fps');
  const valMinFps = document.getElementById('val-min-fps');
  const valMaxFps = document.getElementById('val-max-fps');
  const valHz = document.getElementById('val-hz');
  const valScore = document.getElementById('val-score');
  const scoreRating = document.getElementById('score-rating');

  const gCtx = graphCanvas.getContext('2d');

  // WebGL Setup
  const gl = glCanvas.getContext('webgl2') || glCanvas.getContext('webgl');
  if (!gl) {
    alert('WebGL is not supported on this device/browser.');
    return;
  }

  // --- WebGL Shaders (Volumetric 3D Raymarching Engine) ---
  const vsSource = `
    attribute vec2 position;
    void main() {
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  // Fragment Shader: 3D Volumetric Volume Shader Algorithm
  const fsSource = `
    precision highp float;
    uniform vec2 u_resolution;
    uniform float u_time;

    // 3D Volume Density Function (Procedural Volumetric Noise)
    float mapVolume(vec3 p) {
      vec3 q = p;
      q.z += u_time * 0.5;
      
      // Volumetric Noise Layers
      float d = length(p) - 1.2;
      float wave = sin(q.x * 3.0 + u_time) * cos(q.y * 3.0 + u_time) * sin(q.z * 3.0);
      return max(-d, wave);
    }

    // Light Attenuation & Density Accumulation
    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
      
      // Ray setup
      vec3 ro = vec3(0.0, 0.0, -3.0); // Camera Ray Origin
      vec3 rd = normalize(vec3(uv, 1.2)); // Ray Direction

      float t = 0.0;
      vec3 color = vec3(0.0);
      float density = 0.0;

      // Volumetric Marching Loop
      for (int i = 0; i < 96; i++) {
        vec3 p = ro + rd * t;
        float d = mapVolume(p);

        if (d > 0.0) {
          float stepDensity = d * 0.05;
          density += stepDensity;
          
          // Color Gradients (Blue-Purple Dynamic Glow)
          vec3 lightCol = mix(vec3(0.23, 0.51, 0.96), vec3(0.55, 0.36, 0.96), p.z * 0.5 + 0.5);
          color += lightCol * stepDensity * (1.0 - density);
        }

        t += 0.04; // Step size
        if (density >= 1.0 || t > 6.0) break;
      }

      // Final Volumetric Pixel Output
      gl_FragColor = vec4(color, 1.0);
    }
  `;

  // Compile Shader Helper
  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram();

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.useProgram(program);

  // Fullscreen Quad Geometry
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,  1, -1, -1,  1,
    -1,  1,  1, -1,  1,  1
  ]), gl.STATIC_DRAW);

  const positionLocation = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  // Uniform Locations
  const resolutionLoc = gl.getUniformLocation(program, "u_resolution");
  const timeLoc = gl.getUniformLocation(program, "u_time");

  // --- Benchmark State ---
  let isRunning = false;
  let startTime = 0;
  const duration = 30000; // 30s
  let animId = null;

  let fpsHistory = [];
  let lastTime = performance.now();
  let currentFps = 0;
  let minFps = Infinity;
  let maxFps = 0;
  let estimatedHz = 60;

  // Refresh Rate Detection
  detectRefreshRate((hz) => {
    estimatedHz = hz;
    valHz.innerText = `${hz} Hz`;
  });

  detectSystemSpecs();
  loadHistory();

  // Resize WebGL viewport dynamically
  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const displayWidth = Math.floor(glCanvas.clientWidth * dpr);
    const displayHeight = Math.floor(glCanvas.clientHeight * dpr);

    if (glCanvas.width !== displayWidth || glCanvas.height !== displayHeight) {
      glCanvas.width = displayWidth;
      glCanvas.height = displayHeight;
      gl.viewport(0, 0, glCanvas.width, glCanvas.height);
    }
  }

  // Loop Function
  function render(timestamp) {
    if (!isRunning) return;

    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime;

    const delta = timestamp - lastTime;
    lastTime = timestamp;

    if (delta > 0) {
      currentFps = Math.round(1000 / delta);
      const frameTimeMs = delta.toFixed(1);

      if (elapsed > 500) { // Discard warm-up frame drops
        fpsHistory.push(currentFps);
        minFps = Math.min(minFps, currentFps);
        maxFps = Math.max(maxFps, currentFps);
      }

      valFps.innerText = currentFps;
      valFrameTime.innerHTML = `${frameTimeMs} <small>ms</small>`;
      valMinFps.innerText = minFps === Infinity ? 0 : minFps;
      valMaxFps.innerText = maxFps;

      const avg = fpsHistory.length ? Math.round(fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length) : 0;
      valAvgFps.innerText = avg;

      drawGraph(currentFps);
    }

    // Render WebGL Frame
    resizeCanvas();
    gl.uniform2f(resolutionLoc, glCanvas.width, glCanvas.height);
    gl.uniform1f(timeLoc, elapsed * 0.001);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Update Progress
    const progress = Math.min((elapsed / duration) * 100, 100);
    progressBar.style.width = `${progress}%`;

    if (elapsed < duration) {
      animId = requestAnimationFrame(render);
    } else {
      stopBenchmark(true);
    }
  }

  // --- Controls ---
  function startBenchmark() {
    resetMetrics();
    isRunning = true;
    startTime = 0;
    lastTime = performance.now();

    btnStart.disabled = true;
    btnStop.disabled = false;
    statusBadge.innerText = 'Testing...';
    statusBadge.classList.add('running');
    resultsCard.classList.add('hidden');

    animId = requestAnimationFrame(render);
  }

  function stopBenchmark(completed = false) {
    isRunning = false;
    cancelAnimationFrame(animId);

    btnStart.disabled = false;
    btnStop.disabled = true;
    statusBadge.innerText = completed ? 'Finished' : 'Stopped';
    statusBadge.classList.remove('running');

    if (completed) {
      calculateFinalScore();
    }
  }

  function resetMetrics() {
    stopBenchmark(false);
    fpsHistory = [];
    minFps = Infinity;
    maxFps = 0;
    currentFps = 0;

    valFps.innerText = '00';
    valFrameTime.innerHTML = '0.0 <small>ms</small>';
    valAvgFps.innerText = '0';
    valMinFps.innerText = '0';
    valMaxFps.innerText = '0';
    progressBar.style.width = '0%';
    
    gl.clear(gl.COLOR_BUFFER_BIT);
    gCtx.clearRect(0, 0, graphCanvas.width, graphCanvas.height);
    resultsCard.classList.add('hidden');
  }

  function calculateFinalScore() {
    const avgFps = fpsHistory.length ? Math.round(fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length) : 0;
    const baseScore = Math.round((avgFps * 60) + (minFps * 30));
    valScore.innerText = baseScore.toLocaleString();

    let rating = 'Standard Performance';
    if (baseScore > 4500) rating = 'Ultra High-End GPU Performance 🚀';
    else if (baseScore > 2800) rating = 'Great Smooth Gaming Grade Performance ⚡';
    else if (baseScore < 1500) rating = 'Entry Level / Thermal Throttled ⚠️';

    scoreRating.innerText = rating;
    resultsCard.classList.remove('hidden');

    saveResult(avgFps, minFps === Infinity ? 0 : minFps, baseScore);
  }

  function saveResult(avg, min, score) {
    const history = JSON.parse(localStorage.getItem('volumetric_bench_history') || '[]');
    history.unshift({ date: new Date().toLocaleDateString(), avg, min, score });
    if (history.length > 5) history.pop();
    localStorage.setItem('volumetric_bench_history', JSON.stringify(history));
    loadHistory();
  }

  function loadHistory() {
    const tbody = document.querySelector('#history-table tbody');
    const history = JSON.parse(localStorage.getItem('volumetric_bench_history') || '[]');
    tbody.innerHTML = '';

    if (history.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: var(--text-muted)">No past benchmarks found</td></tr>';
      return;
    }

    history.forEach(item => {
      tbody.innerHTML += `<tr>
        <td>${item.date}</td>
        <td>${item.avg} FPS</td>
        <td>${item.min} FPS</td>
        <td><strong>${item.score}</strong></td>
      </tr>`;
    });
  }

  const graphData = new Array(50).fill(0);
  function drawGraph(newFps) {
    graphData.push(newFps);
    graphData.shift();

    gCtx.clearRect(0, 0, graphCanvas.width, graphCanvas.height);
    gCtx.beginPath();
    gCtx.strokeStyle = '#8b5cf6';
    gCtx.lineWidth = 2;

    const step = graphCanvas.width / (graphData.length - 1);
    for (let i = 0; i < graphData.length; i++) {
      const y = graphCanvas.height - (graphData[i] / (estimatedHz || 120)) * graphCanvas.height;
      const x = i * step;

      if (i === 0) gCtx.moveTo(x, y);
      else gCtx.lineTo(x, y);
    }
    gCtx.stroke();
  }

  function detectSystemSpecs() {
    document.getElementById('spec-res').innerText = `${window.screen.width} x ${window.screen.height}`;
    document.getElementById('spec-dpr').innerText = `${window.devicePixelRatio.toFixed(2)}x`;
    document.getElementById('spec-cpu').innerText = navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} Cores` : 'N/A';
    document.getElementById('spec-ram').innerText = navigator.deviceMemory ? `~${navigator.deviceMemory} GB` : 'N/A';

    const ua = navigator.userAgent;
    let browserName = "Browser Engine";
    if (ua.includes("Chrome")) browserName = "Chrome Engine";
    else if (ua.includes("Firefox")) browserName = "Firefox Engine";
    else if (ua.includes("Safari")) browserName = "Safari Engine";
    else if (ua.includes("Edg")) browserName = "Edge Engine";
    document.getElementById('spec-browser').innerText = browserName;

    try {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      document.getElementById('spec-webgl').innerText = gl instanceof WebGL2RenderingContext ? 'WebGL 2.0' : 'WebGL 1.0';
      if (debugInfo) {
        document.getElementById('spec-gpu').innerText = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      } else {
        document.getElementById('spec-gpu').innerText = 'Generic GPU Context';
      }
    } catch (e) {
      document.getElementById('spec-gpu').innerText = 'Software Rendering';
    }
  }

  function detectRefreshRate(callback) {
    let frames = 0;
    let start = performance.now();

    function check(now) {
      frames++;
      if (now - start >= 1000) {
        callback(Math.round((frames * 1000) / (now - start)));
      } else {
        requestAnimationFrame(check);
      }
    }
    requestAnimationFrame(check);
  }

  btnStart.addEventListener('click', startBenchmark);
  btnStop.addEventListener('click', () => stopBenchmark(false));
  btnReset.addEventListener('click', resetMetrics);
});
