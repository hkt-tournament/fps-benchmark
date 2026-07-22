/**
 * FPS Benchmark Core Engine
 * Copyright Safe / Original Implementation
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const renderCanvas = document.getElementById('render-canvas');
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

  // Contexts
  const ctx = renderCanvas.getContext('2d');
  const gCtx = graphCanvas.getContext('2d');

  // --- Benchmark State ---
  let isRunning = false;
  let startTime = 0;
  let duration = 30000; // 30 seconds
  let animationFrameId = null;

  // Frame Tracking
  let frameCount = 0;
  let lastFrameTime = performance.now();
  let fpsHistory = [];
  let currentFps = 0;
  let minFps = Infinity;
  let maxFps = 0;

  // Real Refresh Rate Estimation
  let estimatedHz = 60;
  detectRefreshRate((hz) => {
    estimatedHz = hz;
    document.getElementById('val-hz').innerText = `${hz} Hz`;
  });

  // System Information Detection
  detectSystemSpecs();
  loadHistory();

  // --- WebGL-inspired 2D Raymarching Simulation (Stress Engine) ---
  function renderScene(time) {
    const width = renderCanvas.width;
    const height = renderCanvas.height;
    
    // Process heavy dynamic image buffer manipulation
    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    const t = time * 0.001; // Time scale

    // Procedural math pattern generator for GPU/CPU stress
    for (let x = 0; x < width; x += 2) {
      for (let y = 0; y < height; y += 2) {
        const u = x / width;
        const v = y / height;

        // Mathematical sine wave distortion layers
        const val1 = Math.sin(u * 10 + t);
        const val2 = Math.cos(v * 10 + t);
        const val3 = Math.sin((u + v) * 20 + t * 2);
        
        const color = Math.floor(((val1 + val2 + val3) / 3 + 1) * 127);

        const index = (x + y * width) * 4;
        data[index] = color;                   // Red
        data[index + 1] = Math.floor(color * 0.5); // Green
        data[index + 2] = 255 - color;         // Blue
        data[index + 3] = 255;                 // Alpha
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }

  // --- Loop & Metrics Tracker ---
  function benchmarkLoop(timestamp) {
    if (!isRunning) return;

    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime;

    // Delta calculation
    const delta = timestamp - lastFrameTime;
    lastFrameTime = timestamp;

    if (delta > 0) {
      currentFps = Math.round(1000 / delta);
      const frameTimeMs = delta.toFixed(1);

      // Track Metrics
      if (elapsed > 500) { // Exclude initial warm-up frame drops
        fpsHistory.push(currentFps);
        minFps = Math.min(minFps, currentFps);
        maxFps = Math.max(maxFps, currentFps);
      }

      // Update UI Metrics
      valFps.innerText = currentFps;
      valFrameTime.innerHTML = `${frameTimeMs} <small>ms</small>`;
      valMinFps.innerText = minFps === Infinity ? 0 : minFps;
      valMaxFps.innerText = maxFps;

      const avg = fpsHistory.length ? Math.round(fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length) : 0;
      valAvgFps.innerText = avg;

      drawGraph(currentFps);
    }

    // Render graphic stress layer
    renderScene(timestamp);

    // Update Progress
    const progress = Math.min((elapsed / duration) * 100, 100);
    progressBar.style.width = `${progress}%`;

    if (elapsed < duration) {
      animationFrameId = requestAnimationFrame(benchmarkLoop);
    } else {
      stopBenchmark(true);
    }
  }

  // --- Controls ---
  function startBenchmark() {
    resetMetrics();
    isRunning = true;
    startTime = 0;
    lastFrameTime = performance.now();

    // UI Updates
    btnStart.disabled = true;
    btnStop.disabled = false;
    statusBadge.innerText = 'Testing...';
    statusBadge.classList.add('running');
    resultsCard.classList.add('hidden');

    // Handle HiDPI Canvas Scaling
    renderCanvas.width = 480;
    renderCanvas.height = 270;

    animationFrameId = requestAnimationFrame(benchmarkLoop);
  }

  function stopBenchmark(completed = false) {
    isRunning = false;
    cancelAnimationFrame(animationFrameId);

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
    
    // Clear canvas
    ctx.clearRect(0, 0, renderCanvas.width, renderCanvas.height);
    gCtx.clearRect(0, 0, graphCanvas.width, graphCanvas.height);
    resultsCard.classList.add('hidden');
  }

  // --- Scoring & LocalStorage ---
  function calculateFinalScore() {
    const avgFps = fpsHistory.length ? Math.round(fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length) : 0;
    
    // Normalized performance scoring algorithm
    const baseScore = Math.round((avgFps * 50) + (minFps * 25));
    valScore.innerText = baseScore.toLocaleString();

    let rating = 'Standard Performance';
    if (baseScore > 4000) rating = 'Ultra / High-End Browser Performance 🚀';
    else if (baseScore > 2500) rating = 'Great / Smooth Performance ⚡';
    else if (baseScore < 1500) rating = 'Entry Level / Hardware Throttled ⚠️';

    scoreRating.innerText = rating;
    resultsCard.classList.remove('hidden');

    saveResult(avgFps, minFps === Infinity ? 0 : minFps, baseScore);
  }

  function saveResult(avg, min, score) {
    const history = JSON.parse(localStorage.getItem('fps_bench_history') || '[]');
    const record = {
      date: new Date().toLocaleDateString(),
      avg,
      min,
      score
    };
    history.unshift(record);
    if (history.length > 5) history.pop(); // Keep last 5 entries
    localStorage.setItem('fps_bench_history', JSON.stringify(history));
    loadHistory();
  }

  function loadHistory() {
    const tbody = document.querySelector('#history-table tbody');
    const history = JSON.parse(localStorage.getItem('fps_bench_history') || '[]');
    tbody.innerHTML = '';

    if (history.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: var(--text-muted)">No past benchmarks found</td></tr>';
      return;
    }

    history.forEach(item => {
      const row = `<tr>
        <td>${item.date}</td>
        <td>${item.avg} FPS</td>
        <td>${item.min} FPS</td>
        <td><strong>${item.score}</strong></td>
      </tr>`;
      tbody.innerHTML += row;
    });
  }

  // --- Realtime Graph Rendering ---
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
      // Normalize FPS to Canvas Height (Assuming Max 144 FPS scale)
      const y = graphCanvas.height - (graphData[i] / (estimatedHz || 120)) * graphCanvas.height;
      const x = i * step;

      if (i === 0) gCtx.moveTo(x, y);
      else gCtx.lineTo(x, y);
    }
    gCtx.stroke();
  }

  // --- Hardware & System Diagnostics ---
  function detectSystemSpecs() {
    // Screen Details
    document.getElementById('spec-res').innerText = `${window.screen.width} x ${window.screen.height}`;
    document.getElementById('spec-dpr').innerText = `${window.devicePixelRatio.toFixed(2)}x`;
    
    // CPU Cores
    document.getElementById('spec-cpu').innerText = navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} Cores` : 'N/A';

    // Device Memory (RAM)
    document.getElementById('spec-ram').innerText = navigator.deviceMemory ? `~${navigator.deviceMemory} GB` : 'N/A (Browser Restricted)';

    // User Agent / Browser
    const ua = navigator.userAgent;
    let browserName = "Unknown Browser";
    if (ua.includes("Chrome")) browserName = "Google Chrome";
    else if (ua.includes("Firefox")) browserName = "Mozilla Firefox";
    else if (ua.includes("Safari")) browserName = "Apple Safari";
    else if (ua.includes("Edg")) browserName = "Microsoft Edge";
    document.getElementById('spec-browser').innerText = browserName;

    // WebGL & GPU Detection
    try {
      const glCanvas = document.createElement('canvas');
      const gl = glCanvas.getContext('webgl2') || glCanvas.getContext('webgl');
      
      if (gl) {
        document.getElementById('spec-webgl').innerText = 'Supported (WebGL2)';
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
          document.getElementById('spec-gpu').innerText = renderer;
        } else {
          document.getElementById('spec-gpu').innerText = 'Generic WebGL Engine';
        }
      } else {
        document.getElementById('spec-webgl').innerText = 'Not Supported';
        document.getElementById('spec-gpu').innerText = 'Software Render';
      }
    } catch (e) {
      document.getElementById('spec-webgl').innerText = 'Disabled';
      document.getElementById('spec-gpu').innerText = 'Unavailable';
    }
  }

  // Frame rate (Hz) Detection Engine
  function detectRefreshRate(callback) {
    let frames = 0;
    let startTime = performance.now();

    function checkHz(now) {
      frames++;
      if (now - startTime >= 1000) {
        const hz = Math.round((frames * 1000) / (now - startTime));
        callback(hz);
      } else {
        requestAnimationFrame(checkHz);
      }
    }
    requestAnimationFrame(checkHz);
  }

  // --- Event Listeners ---
  btnStart.addEventListener('click', startBenchmark);
  btnStop.addEventListener('click', () => stopBenchmark(false));
  btnReset.addEventListener('click', resetMetrics);
});
