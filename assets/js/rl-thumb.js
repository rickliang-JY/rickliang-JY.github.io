/* Self-contained grid-world BFS pathfinding animation for project card
   thumbnails. Ported from RLStudio's hero canvas. Auto-inits on any
   <canvas data-anim="rl">, is theme-aware, and pauses when off-screen. */
(function () {
  "use strict";

  function colors() {
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    return dark
      ? { line: "#272727", obst: "#242424", trail: "rgba(96,165,250,0.14)",
          agent: "#60a5fa", glow: "rgba(96,165,250,0.45)" }
      : { line: "#e9e9ee", obst: "#e3e6ee", trail: "rgba(43,108,240,0.10)",
          agent: "#2b6cf0", glow: "rgba(43,108,240,0.45)" };
  }

  function makeAnim(canvas) {
    var ctx = canvas.getContext("2d");
    var W = 0, H = 0, dpr = 1, cell = 26, cols = 0, rows = 0;
    var grid, path = [], pathIdx = 0, t = 0, agent = null, goal = null;
    var phase = "move", phaseT = 0, raf = null, running = false;

    function key(r, c) { return r + "," + c; }

    function bfs(start, end, blocked) {
      var q = [start], prev = {}; prev[key(start.r, start.c)] = null;
      var dirs = [[1,0],[-1,0],[0,1],[0,-1]];
      while (q.length) {
        var cur = q.shift();
        if (cur.r === end.r && cur.c === end.c) {
          var out = [], k = key(cur.r, cur.c);
          while (k !== null) {
            var p = k.split(",").map(Number);
            out.push({ r: p[0], c: p[1] }); k = prev[k];
          }
          return out.reverse();
        }
        for (var i = 0; i < dirs.length; i++) {
          var nr = cur.r + dirs[i][0], nc = cur.c + dirs[i][1], kk = key(nr, nc);
          if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
          if (blocked.has(kk) || kk in prev) continue;
          prev[kk] = key(cur.r, cur.c); q.push({ r: nr, c: nc });
        }
      }
      return null;
    }

    function newEpisode() {
      var blocked = new Set();
      var density = 0.16;
      for (var r = 0; r < rows; r++)
        for (var c = 0; c < cols; c++)
          if (Math.random() < density) blocked.add(key(r, c));
      var start, end, p = null, tries = 0;
      do {
        start = { r: Math.floor(Math.random() * rows),
                  c: Math.floor(Math.random() * Math.max(1, cols * 0.3)) };
        end = { r: Math.floor(Math.random() * rows),
                c: cols - 1 - Math.floor(Math.random() * Math.max(1, cols * 0.25)) };
        blocked.delete(key(start.r, start.c)); blocked.delete(key(end.r, end.c));
        p = bfs(start, end, blocked); tries++;
      } while (!p && tries < 40);
      if (!p) { blocked.clear(); p = bfs(start, end, blocked); }
      grid = { blocked: blocked }; agent = start; goal = end;
      path = p || [start]; pathIdx = 0; t = 0; phase = "move"; phaseT = 0;
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      var rect = canvas.getBoundingClientRect();
      W = rect.width; H = rect.height;
      if (!W || !H) return;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(W / cell) + 1;
      rows = Math.ceil(H / cell) + 1;
      newEpisode();
    }

    function rr(x, y, w, h, r) {
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    function xy(r, c) { return { x: c * cell, y: r * cell }; }

    function draw() {
      var C = colors();
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = C.line; ctx.lineWidth = 1;
      ctx.beginPath();
      for (var c = 0; c <= cols; c++) { ctx.moveTo(c*cell+0.5, 0); ctx.lineTo(c*cell+0.5, H); }
      for (var r = 0; r <= rows; r++) { ctx.moveTo(0, r*cell+0.5); ctx.lineTo(W, r*cell+0.5); }
      ctx.stroke();
      ctx.fillStyle = C.obst;
      grid.blocked.forEach(function (k) {
        var p = k.split(",").map(Number), o = xy(p[0], p[1]);
        rr(o.x+4, o.y+4, cell-8, cell-8, 4); ctx.fill();
      });
      ctx.fillStyle = C.trail;
      for (var i = 0; i <= Math.min(pathIdx, path.length-1); i++) {
        var o2 = xy(path[i].r, path[i].c);
        rr(o2.x+3, o2.y+3, cell-6, cell-6, 5); ctx.fill();
      }
      var g = xy(goal.r, goal.c);
      ctx.strokeStyle = C.agent; ctx.lineWidth = 2;
      rr(g.x+5, g.y+5, cell-10, cell-10, 4); ctx.stroke();
      ctx.fillStyle = C.agent; ctx.globalAlpha = 0.18;
      rr(g.x+5, g.y+5, cell-10, cell-10, 4); ctx.fill();
      ctx.globalAlpha = 1;
      var ar, ac;
      if (pathIdx < path.length-1) {
        var a = path[pathIdx], b = path[pathIdx+1];
        var e = t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2;
        ar = a.r + (b.r-a.r)*e; ac = a.c + (b.c-a.c)*e;
      } else { ar = path[path.length-1].r; ac = path[path.length-1].c; }
      var ax = ac*cell, ay = ar*cell;
      ctx.save();
      ctx.shadowColor = C.glow; ctx.shadowBlur = 12;
      ctx.fillStyle = C.agent;
      rr(ax+4, ay+4, cell-8, cell-8, 5); ctx.fill();
      ctx.restore();
    }

    function tick() {
      if (!running) return;
      if (phase === "move") {
        t += 0.05;
        if (t >= 1) {
          t = 0; pathIdx++;
          if (pathIdx >= path.length-1) { phase = "pause"; phaseT = 0; }
        }
      } else {
        phaseT += 1;
        if (phaseT > 55) newEpisode();
      }
      draw();
      raf = requestAnimationFrame(tick);
    }

    function start() {
      if (running) return;
      if (!grid) resize();
      if (!W || !H) { resize(); if (!W || !H) return; }
      running = true; draw();
      raf = requestAnimationFrame(tick);
    }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = null; }

    return { start: start, stop: stop, resize: resize, isRunning: function () { return running; } };
  }

  function init() {
    var canvases = document.querySelectorAll('canvas[data-anim="rl"]');
    if (!canvases.length) return;
    var anims = [];
    canvases.forEach(function (cv) { anims.push({ el: cv, anim: makeAnim(cv) }); });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var match = anims.filter(function (a) { return a.el === en.target; })[0];
        if (!match) return;
        if (en.isIntersecting) match.anim.start();
        else match.anim.stop();
      });
    }, { threshold: 0.1 });
    anims.forEach(function (a) { io.observe(a.el); });

    var rt;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        anims.forEach(function (a) { if (a.anim.isRunning()) a.anim.resize(); });
      }, 150);
    });
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();
