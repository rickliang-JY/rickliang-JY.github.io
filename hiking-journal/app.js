/* ================================================
   Hiking Journal — Standalone Web App
   Ported from Obsidian plugin v6.0
   ================================================ */

// === Constants ===
const TILE = 256;
const POOL = 600;
const CAM_OX = 0.7;
const CAM_OY = 0.5;

const MAP_STYLES = {
  "opentopomap": {
    name: "OpenTopoMap",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    subs: ["a", "b", "c"],
    filter: "grayscale(100%) contrast(1.5) opacity(0.4)"
  },
  "carto-voyager": {
    name: "CARTO Voyager",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
    subs: ["a", "b", "c", "d"],
    filter: "opacity(0.45) saturate(0.7)"
  },
  "esri-satellite": {
    name: "Esri Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    subs: [],
    filter: "opacity(0.5) saturate(0.6)"
  },
  "osm": {
    name: "OpenStreetMap",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    subs: [],
    filter: "grayscale(100%) contrast(1.3) opacity(0.35)"
  },
  "carto-light": {
    name: "CARTO Positron",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
    subs: ["a", "b", "c", "d"],
    filter: "opacity(0.5)"
  },
  "carto-dark": {
    name: "CARTO Dark Matter",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
    subs: ["a", "b", "c", "d"],
    filter: "opacity(0.5)"
  }
};

// === DOM Helpers (replacing Obsidian's createDiv/createEl) ===
function createDiv(parent, opts = {}) {
  const div = document.createElement("div");
  if (opts.cls) div.className = opts.cls;
  if (opts.text) div.textContent = opts.text;
  if (opts.attr) for (const [k, v] of Object.entries(opts.attr)) div.setAttribute(k, v);
  if (parent) parent.appendChild(div);
  return div;
}

function createEl(parent, tag, opts = {}) {
  const el = document.createElement(tag);
  if (opts.cls) el.className = opts.cls;
  if (opts.text) el.textContent = opts.text;
  if (opts.value !== undefined) el.value = opts.value;
  if (opts.attr) for (const [k, v] of Object.entries(opts.attr)) el.setAttribute(k, v);
  if (parent) parent.appendChild(el);
  return el;
}

// === Projection Math (pure functions, copied verbatim) ===
function lon2t(lon, z) {
  return (lon + 180) / 360 * (1 << z);
}

function lat2t(lat, z) {
  return (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * (1 << z);
}

function autoZoom(latSpan, lngSpan, minZ, maxZ) {
  const lo = minZ || 11, hi = maxZ || 15;
  const narrow = Math.min(latSpan, lngSpan);
  let z;
  if (narrow > 100) z = 2;
  else if (narrow > 50) z = 3;
  else if (narrow > 25) z = 4;
  else if (narrow > 10) z = 5;
  else if (narrow > 5) z = 6;
  else if (narrow > 2) z = 7;
  else if (narrow > 1) z = 8;
  else if (narrow > 0.4) z = 11;
  else if (narrow > 0.2) z = 12;
  else if (narrow > 0.1) z = 13;
  else if (narrow > 0.04) z = 14;
  else z = 15;
  z = Math.max(lo, Math.min(hi, z));
  const wide = Math.max(latSpan, lngSpan);
  if (wide > 1 && z > 11) z = Math.max(lo, 11);
  else if (wide > 0.5 && z > 12) z = Math.max(lo, 12);
  return z;
}

function buildGeo(bounds, zoomOverride) {
  const latSpan = bounds.north - bounds.south;
  const lngSpan = bounds.east - bounds.west;
  const zoom = zoomOverride || autoZoom(latSpan, lngSpan);
  const pad = 0.15;
  const rMinTX = lon2t(bounds.west - lngSpan * pad, zoom);
  const rMaxTX = lon2t(bounds.east + lngSpan * pad, zoom);
  const rMinTY = lat2t(bounds.north + latSpan * pad, zoom);
  const rMaxTY = lat2t(bounds.south - latSpan * pad, zoom);
  return { zoom, w: (rMaxTX - rMinTX) * TILE, h: (rMaxTY - rMinTY) * TILE, minTX: rMinTX, minTY: rMinTY };
}

function proj(lat, lng, g) {
  return { x: (lon2t(lng, g.zoom) - g.minTX) * TILE, y: (lat2t(lat, g.zoom) - g.minTY) * TILE };
}

function projectTrack(track, g) {
  const route = track.map(p => proj(p.lat, p.lng, g));
  const dists = [0];
  let total = 0;
  for (let i = 1; i < route.length; i++) {
    total += Math.hypot(route[i].x - route[i - 1].x, route[i].y - route[i - 1].y);
    dists.push(total);
  }
  return { route, dists, total };
}

function nearestIdx(wp, route) {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < route.length; i++) {
    const d = (wp.x - route[i].x) ** 2 + (wp.y - route[i].y) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

function interpAt(dist, route, dists) {
  if (dist <= 0) return route[0];
  if (dist >= dists[dists.length - 1]) return route[route.length - 1];
  for (let k = 1; k < route.length; k++) {
    if (dists[k] >= dist) {
      const seg = dists[k] - dists[k - 1];
      const t = seg === 0 ? 0 : (dist - dists[k - 1]) / seg;
      return {
        x: route[k - 1].x + (route[k].x - route[k - 1].x) * t,
        y: route[k - 1].y + (route[k].y - route[k - 1].y) * t
      };
    }
  }
  return route[route.length - 1];
}

// === SVG Helpers ===
function S(tag, attrs, parent) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (parent) parent.appendChild(el);
  return el;
}

function mkIcon() {
  const g = S("g", { fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" });
  S("circle", { cx: "12", cy: "5", r: "1.5" }, g);
  S("path", { d: "m9 20 3-6 3 6" }, g);
  S("path", { d: "m6 8 6 2 6-2" }, g);
  S("path", { d: "M12 10v4" }, g);
  return g;
}

// === HikingJournalViewer Class ===
class HikingJournalViewer {
  constructor(container) {
    this.container = container;
    this.pts = [];
    this.route = [];
    this.routeDists = [];
    this.totalDist = 0;
    this.hasTrack = false;
    this.cards = [];
    this.tilePool = [];
    this.pathLine = null;
    this.segs = [];
    this.iBgs = [];
    this.iGs = [];
    this.raf = 0;
    this.cx = 0;
    this.cy = 0;
    this.kx = 0;
    this.ky = 0;
    this.ai = 0;
    this.cones = [];
    this.coneSvg = null;
    this.mainSvg = null;
    this.bubble = null;
    this.userScale = 1;
    this.userOffX = 0;
    this.userOffY = 0;
    this.userPanning = false;
    this._dragState = null;
    this._panTimer = null;
    this._cleanupMapListeners = null;
    this._resizeObs = null;
  }

  loadTrip(data) {
    this.trip = data;
    this.rebuild();
  }

  destroy() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.tilePool = [];
    this.cards = [];
    this.segs = [];
    this.pathLine = null;
    if (this.bubble) { this.bubble.remove(); this.bubble = null; }
    if (this._cleanupMapListeners) this._cleanupMapListeners();
    if (this._panTimer) clearTimeout(this._panTimer);
    if (this._resizeObs) this._resizeObs.disconnect();
    this.container.innerHTML = "";
  }

  rebuild() {
    const c = this.container;
    c.innerHTML = "";
    if (this.raf) cancelAnimationFrame(this.raf);

    const trip = this.trip;
    if (!trip) { createDiv(c, { text: "No trip data.", cls: "hj-empty" }); return; }

    this.mapStyle = trip.mapStyle || "opentopomap";
    const gpxTrack = trip.gpxTrack || [];
    const hasGpx = gpxTrack.length >= 2;
    let wps = (trip.waypoints || []).filter(w => w.lat && w.lng);

    if (!wps.length && hasGpx) {
      wps = this.generateTrackStops(gpxTrack, trip.stats?.distanceKm || 0);
    }
    if (!wps.length && !hasGpx) {
      createDiv(c, { text: "No GPS data.", cls: "hj-empty" });
      return;
    }
    if (!wps.length) {
      wps = [
        { id: "start", lat: gpxTrack[0].lat, lng: gpxTrack[0].lng, alt: gpxTrack[0].ele, title: "Start", photos: [] },
        { id: "end", lat: gpxTrack[gpxTrack.length - 1].lat, lng: gpxTrack[gpxTrack.length - 1].lng, alt: gpxTrack[gpxTrack.length - 1].ele, title: "Finish", photos: [] }
      ];
    }

    const allLats = wps.map(w => w.lat);
    const allLngs = wps.map(w => w.lng);
    this.hasTrack = hasGpx;
    this.tripVersion = trip.version || 5;

    if (this.hasTrack) {
      for (const tp of gpxTrack) { allLats.push(tp.lat); allLngs.push(tp.lng); }
    }

    const pad = 0.01;
    const bounds = {
      north: Math.max(...allLats) + pad,
      south: Math.min(...allLats) - pad,
      east: Math.max(...allLngs) + pad,
      west: Math.min(...allLngs) - pad
    };

    this.geo = buildGeo(bounds);

    if (this.hasTrack) {
      const pt = projectTrack(gpxTrack, this.geo);
      this.route = pt.route;
      this.routeDists = pt.dists;
      this.totalDist = pt.total;
    } else {
      this.route = [];
      this.routeDists = [];
      this.totalDist = 0;
    }

    this.pts = wps.map(w => {
      const xy = proj(w.lat, w.lng, this.geo);
      let pathIdx = 0, trackDist = 0;
      if (this.hasTrack) {
        pathIdx = nearestIdx(xy, this.route);
        trackDist = this.routeDists[pathIdx];
      }
      return { ...w, ...xy, pathIdx, trackDist };
    });

    if (this.hasTrack) {
      this.pts.sort((a, b) => a.pathIdx - b.pathIdx);
    }

    this.cx = 0;
    this.cy = 0;
    this.kx = this.pts[0].x;
    this.ky = this.pts[0].y;
    this.ai = 0;
    this.cards = [];
    this.cardCtrs = [];
    this.dotRefs = [];
    this.segs = [];
    this.iBgs = [];
    this.iGs = [];
    this.tilePool = [];
    this.pathLine = null;
    this._lastTileCx = -9999;
    this._lastTileCy = -9999;
    this._svgRect = null;

    // Build DOM
    const wrap = createDiv(c, { cls: "hj-wrapper" });
    this.scrollEl = createDiv(wrap, { cls: "hj-scroll" });

    const backBtn = createDiv(this.scrollEl, { text: "\u2190 Back to Map", cls: "hj-back-btn" });
    backBtn.addEventListener("click", () => backToList());

    this.mkHeader(this.scrollEl, trip);

    let lastSection = "";
    for (let i = 0; i < this.pts.length; i++) {
      if (this.tripVersion >= 5 && this.pts[i].sectionTitle && this.pts[i].sectionTitle !== lastSection) {
        lastSection = this.pts[i].sectionTitle;
        const secHeader = createDiv(this.scrollEl, { cls: "hj-section-divider" });
        createEl(secHeader, "h2", { text: lastSection, cls: "hj-section-divider-title" });
      }
      this.cards.push(this.mkCard(this.scrollEl, this.pts[i], i));
    }

    // SVG Map
    this.svgBox = createDiv(wrap, { cls: "hj-map" });
    const svg = S("svg", {
      viewBox: `0 0 ${this.geo.w} ${this.geo.h}`,
      preserveAspectRatio: "xMidYMid slice",
      class: "hj-fullsvg",
      style: "overflow:visible"
    });
    this.svgBox.appendChild(svg);
    this.mainSvg = svg;

    // SVG defs (glow filters)
    const defs = S("defs", {}, svg);
    const gf = S("filter", { id: "glow", x: "-20%", y: "-20%", width: "140%", height: "140%" }, defs);
    S("feGaussianBlur", { stdDeviation: "3", result: "b" }, gf);
    S("feComposite", { in: "SourceGraphic", in2: "b", operator: "over" }, gf);
    const lg = S("filter", { id: "lGlow" }, defs);
    S("feGaussianBlur", { stdDeviation: "1.5", result: "cb" }, lg);
    const fm = S("feMerge", {}, lg);
    S("feMergeNode", { in: "cb" }, fm);
    S("feMergeNode", { in: "SourceGraphic" }, fm);

    // Main transform group
    this.mGrp = S("g", {}, svg);

    // Tile layer
    const tileFilter = (MAP_STYLES[this.mapStyle] || MAP_STYLES["opentopomap"]).filter;
    this.tileGroup = S("g", { style: `mix-blend-mode:multiply; filter:${tileFilter};` }, this.mGrp);
    for (let i = 0; i < POOL; i++) {
      const img = S("image", {
        width: `${TILE + 0.5}`,
        height: `${TILE + 0.5}`,
        preserveAspectRatio: "none",
        style: "display:none"
      }, this.tileGroup);
      this.tilePool.push(img);
    }

    // Route + dots
    this.mkRoute(this.mGrp);
    this.mkDots(this.mGrp);

    // Cone shadow layer
    const coneSvg = S("svg", {
      viewBox: `0 0 ${this.geo.w} ${this.geo.h}`,
      preserveAspectRatio: "xMidYMid slice",
      class: "hj-fullsvg hj-cone-layer",
      style: "overflow:visible"
    });
    wrap.appendChild(coneSvg);
    const coneDefs = S("defs", {}, coneSvg);
    const coneGrad = S("linearGradient", { id: "coneG", x1: "0%", y1: "50%", x2: "100%", y2: "50%" }, coneDefs);
    S("stop", { offset: "0%", "stop-color": "rgba(0,0,0,0.18)" }, coneGrad);
    S("stop", { offset: "100%", "stop-color": "rgba(0,0,0,0)" }, coneGrad);
    this.coneSvg = coneSvg;
    this.cones = [];

    // Map style switcher
    const mapSwitcher = createDiv(wrap, { cls: "hj-map-switcher" });
    const mapSelect = createEl(mapSwitcher, "select", { cls: "hj-map-switcher-select" });
    for (const [key, style] of Object.entries(MAP_STYLES)) {
      const opt = createEl(mapSelect, "option", { text: style.name });
      opt.value = key;
      if (key === this.mapStyle) opt.selected = true;
    }
    mapSelect.addEventListener("change", () => this.switchMapStyle(mapSelect.value));

    this.svgBox.addEventListener("click", (e) => {
      if (e.target.tagName === "svg") this.rmBubble();
    });

    // Map interaction: drag, zoom, touch
    this._setupMapInteraction();

    // Cache card centers; recalculate on resize
    this._cacheCardCtrs();
    this._svgRect = this.svgBox.getBoundingClientRect();
    this._resizeObs = new ResizeObserver(() => {
      this._cacheCardCtrs();
      this._svgRect = this.svgBox.getBoundingClientRect();
    });
    this._resizeObs.observe(this.scrollEl);
    this._resizeObs.observe(this.svgBox);

    // Activate first card + dot
    this.syncCards(-1, 0);
    this.syncDots(-1, 0);
    this.startLoop();
  }

  _setupMapInteraction() {
    this.userScale = 1;
    this.userOffX = 0;
    this.userOffY = 0;
    this.userPanning = false;
    this._dragState = null;
    this.svgBox.style.cursor = "grab";

    // Mouse drag
    this.svgBox.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      this._dragState = { x: e.clientX, y: e.clientY };
      this.userPanning = true;
      this.svgBox.style.cursor = "grabbing";
      if (this._panTimer) clearTimeout(this._panTimer);
    });

    const onMouseMove = (e) => {
      if (!this._dragState) return;
      const sr = this.svgBox.getBoundingClientRect();
      const vbW = this.geo.w / this.userScale;
      const sc = Math.max(sr.width / vbW, sr.height / (this.geo.h / this.userScale));
      const dx = (e.clientX - this._dragState.x) / sc;
      const dy = (e.clientY - this._dragState.y) / sc;
      this.userOffX += dx;
      this.userOffY += dy;
      this._dragState.x = e.clientX;
      this._dragState.y = e.clientY;
    };

    const onMouseUp = () => {
      if (!this._dragState) return;
      this._dragState = null;
      this.svgBox.style.cursor = "grab";
      this._panTimer = setTimeout(() => { this.userPanning = false; }, 3000);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    // Wheel zoom
    this.svgBox.addEventListener("wheel", (e) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      this.userScale = Math.max(0.5, Math.min(5, this.userScale * factor));
      this.updateMapViewBox();
      this.userPanning = true;
      if (this._panTimer) clearTimeout(this._panTimer);
      this._panTimer = setTimeout(() => { this.userPanning = false; }, 3000);
    }, { passive: false });

    // Double-click reset
    this.svgBox.addEventListener("dblclick", (e) => {
      e.preventDefault();
      this.userScale = 1;
      this.userOffX = 0;
      this.userOffY = 0;
      this.userPanning = false;
      if (this._panTimer) clearTimeout(this._panTimer);
      this.updateMapViewBox();
    });

    // Touch support
    let lastTouchDist = 0;
    this.svgBox.addEventListener("touchstart", (e) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastTouchDist = Math.hypot(dx, dy);
      } else if (e.touches.length === 1) {
        this._dragState = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        this.userPanning = true;
        if (this._panTimer) clearTimeout(this._panTimer);
      }
    }, { passive: true });

    this.svgBox.addEventListener("touchmove", (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        if (lastTouchDist > 0) {
          const factor = dist / lastTouchDist;
          this.userScale = Math.max(0.5, Math.min(5, this.userScale * factor));
          this.updateMapViewBox();
        }
        lastTouchDist = dist;
      } else if (e.touches.length === 1 && this._dragState) {
        const sr = this.svgBox.getBoundingClientRect();
        const vbW = this.geo.w / this.userScale;
        const sc = Math.max(sr.width / vbW, sr.height / (this.geo.h / this.userScale));
        const tdx = (e.touches[0].clientX - this._dragState.x) / sc;
        const tdy = (e.touches[0].clientY - this._dragState.y) / sc;
        this.userOffX += tdx;
        this.userOffY += tdy;
        this._dragState.x = e.touches[0].clientX;
        this._dragState.y = e.touches[0].clientY;
      }
    }, { passive: false });

    this.svgBox.addEventListener("touchend", () => {
      lastTouchDist = 0;
      this._dragState = null;
      this._panTimer = setTimeout(() => { this.userPanning = false; }, 3000);
    }, { passive: true });

    this._cleanupMapListeners = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }

  updateMapViewBox() {
    const s = this.userScale;
    const vbW = this.geo.w / s;
    const vbH = this.geo.h / s;
    const vbX = this.geo.w * CAM_OX * (1 - 1 / s);
    const vbY = this.geo.h * CAM_OY * (1 - 1 / s);
    const vb = `${vbX} ${vbY} ${vbW} ${vbH}`;
    this.mainSvg.setAttribute("viewBox", vb);
    this.coneSvg.setAttribute("viewBox", vb);
    this._lastTileCx = -9999;
    this._lastTileCy = -9999;
  }

  switchMapStyle(styleKey) {
    const ms = MAP_STYLES[styleKey];
    if (!ms) return;
    this.mapStyle = styleKey;
    if (this.tileGroup) {
      this.tileGroup.setAttribute("style", `mix-blend-mode:multiply; filter:${ms.filter};`);
    }
    for (const node of this.tilePool) {
      node.removeAttribute("href");
      node.style.display = "none";
    }
    this._lastTileCx = -9999;
    this._lastTileCy = -9999;
  }

  generateTrackStops(track, totalKm) {
    if (track.length < 2) return [];
    const R = 6371;
    const dists = [0];
    let cumDist = 0;
    for (let i = 1; i < track.length; i++) {
      const dLat = (track[i].lat - track[i - 1].lat) * Math.PI / 180;
      const dLon = (track[i].lng - track[i - 1].lng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(track[i - 1].lat * Math.PI / 180) * Math.cos(track[i].lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
      cumDist += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      dists.push(cumDist);
    }
    const actualKm = totalKm > 0 ? totalKm : cumDist;
    const numStops = Math.max(3, Math.min(10, Math.round(actualKm / 1.5)));
    const stops = [];
    for (let s = 0; s < numStops; s++) {
      const frac = s / (numStops - 1);
      const targetDist = frac * cumDist;
      let lat = track[0].lat, lng = track[0].lng, ele = track[0].ele;
      for (let k = 1; k < track.length; k++) {
        if (dists[k] >= targetDist) {
          const seg = dists[k] - dists[k - 1];
          const t = seg === 0 ? 0 : (targetDist - dists[k - 1]) / seg;
          lat = track[k - 1].lat + (track[k].lat - track[k - 1].lat) * t;
          lng = track[k - 1].lng + (track[k].lng - track[k - 1].lng) * t;
          if (track[k - 1].ele != null && track[k].ele != null) {
            ele = track[k - 1].ele + (track[k].ele - track[k - 1].ele) * t;
          }
          break;
        }
      }
      const km = frac * actualKm;
      let title;
      if (s === 0) title = "Start";
      else if (s === numStops - 1) title = "Finish";
      else title = `${km.toFixed(1)} km`;
      stops.push({
        id: `track-stop-${s}`, lat, lng,
        alt: ele != null ? Math.round(ele) : undefined,
        title, description: s === 0 ? "Beginning of route" : s === numStops - 1 ? "End of route" : `${km.toFixed(1)} km along the route`,
        photos: []
      });
    }
    return stops;
  }

  // === Route Rendering ===
  mkRoute(g) {
    if (this.hasTrack) {
      const pts = this.route.map(p => `${p.x},${p.y}`).join(" ");
      S("polyline", { points: pts, fill: "none", stroke: "#cbd5e1", "stroke-width": "2.5", "stroke-dasharray": "6,6", "stroke-linecap": "round", "stroke-linejoin": "round" }, g);
      this.pathLine = S("polyline", { points: pts, fill: "none", stroke: "#ef4444", "stroke-width": "3.5", "stroke-linecap": "round", "stroke-linejoin": "round", filter: "url(#lGlow)" }, g);
      this.pathLine.style.strokeDasharray = `${this.totalDist}`;
      this.pathLine.style.strokeDashoffset = `${this.totalDist}`;
      for (let i = 0; i < this.pts.length - 1; i++) {
        const a = this.pts[i], b = this.pts[i + 1];
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const ig = S("g", { transform: `translate(${mx},${my})` }, g);
        this.iBgs[i] = S("circle", { r: "11", fill: "#fff", stroke: "#cbd5e1", "stroke-width": "1.5" }, ig);
        const sv = S("g", { transform: "translate(-7,-7) scale(0.58)", class: "hj-icon hj-icon-gray" }, ig);
        sv.appendChild(mkIcon());
        this.iGs[i] = sv;
      }
    } else {
      for (let i = 0; i < this.pts.length - 1; i++) {
        const a = this.pts[i], b = this.pts[i + 1];
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const sg = S("g", {}, g);
        S("line", { x1: `${a.x}`, y1: `${a.y}`, x2: `${b.x}`, y2: `${b.y}`, stroke: "#cbd5e1", "stroke-width": "2", "stroke-dasharray": "4,6", "stroke-linecap": "round" }, sg);
        const rl = S("line", { x1: `${a.x}`, y1: `${a.y}`, x2: `${b.x}`, y2: `${b.y}`, stroke: "#ef4444", "stroke-width": "3", "stroke-linecap": "round", filter: "url(#lGlow)" }, sg);
        rl.style.strokeDasharray = "0";
        rl.style.strokeDashoffset = "0";
        this.segs[i] = rl;
        const ig = S("g", { transform: `translate(${mx},${my})` }, sg);
        this.iBgs[i] = S("circle", { r: "11", fill: "#fff", stroke: "#cbd5e1", "stroke-width": "1.5" }, ig);
        const sv = S("g", { transform: "translate(-7,-7) scale(0.58)", class: "hj-icon hj-icon-gray" }, ig);
        sv.appendChild(mkIcon());
        this.iGs[i] = sv;
      }
    }
  }

  // === Dots + Labels ===
  mkDots(g) {
    if (this.hasTrack && this.route.length >= 2) {
      const startPt = this.route[0];
      const endPt = this.route[this.route.length - 1];
      S("text", { x: `${startPt.x - 25}`, y: `${startPt.y - 18}`, "font-size": "10", fill: "#dc2626", "font-weight": "bold", "letter-spacing": "1", class: "hj-noptr" }, g).textContent = "START";
      S("circle", { cx: `${startPt.x}`, cy: `${startPt.y}`, r: "4", fill: "#dc2626" }, g);
      S("text", { x: `${endPt.x - 28}`, y: `${endPt.y - 18}`, "font-size": "10", fill: "#dc2626", "font-weight": "bold", "letter-spacing": "1", class: "hj-noptr" }, g).textContent = "FINISH";
      S("circle", { cx: `${endPt.x}`, cy: `${endPt.y}`, r: "4", fill: "#dc2626" }, g);
    }
    for (let i = 0; i < this.pts.length; i++) {
      const p = this.pts[i];
      const dg = S("g", { transform: `translate(${p.x},${p.y})`, "data-idx": `${i}` }, g);
      const h = S("g", { class: "hj-hit" }, dg);
      S("circle", { r: "30", fill: "transparent" }, h);
      const ping = S("circle", { r: "16", fill: "none", stroke: "#dc2626", "stroke-width": "1.5", class: "hj-ping", opacity: "0" }, h);
      const dot = S("circle", { r: "4", fill: "#475569", class: "hj-dot" }, h);
      const t = p.title.split(" ")[0] || p.title;
      const lbl = S("text", { x: "16", y: "5", "font-size": "12", "font-weight": "500", fill: "#64748b", class: "hj-lbl hj-noptr" }, h);
      lbl.textContent = t;
      this.dotRefs[i] = { dot, ping, lbl };
      h.addEventListener("click", (e) => { e.stopPropagation(); this.tapDot(i); });
    }
  }

  // === Header ===
  mkHeader(el, trip) {
    const h = createDiv(el, { cls: "hj-header" });
    createEl(h, "h1", { text: trip.name, cls: "hj-title" });
    const sub = [];
    if (trip.region) sub.push(trip.region);
    if (trip.date) sub.push(trip.date);
    if (sub.length) createEl(h, "p", { text: sub.join(" \u00B7 "), cls: "hj-subtitle" });
    createDiv(h, { cls: "hj-divider" });
    if (trip.stats && (trip.stats.distanceKm || trip.stats.elevationGainM)) {
      const s = createDiv(h, { cls: "hj-stats" });
      if (trip.stats.distanceKm) createEl(s, "span", { text: `\u{1F4CF} ${trip.stats.distanceKm} km` });
      if (trip.stats.elevationGainM) createEl(s, "span", { text: `\u2B06\uFE0F ${trip.stats.elevationGainM}m` });
      if (trip.stats.elevationLossM) createEl(s, "span", { text: `\u2B07\uFE0F ${trip.stats.elevationLossM}m` });
      createEl(s, "span", { text: `\u{1F4F8} ${(trip.waypoints || []).length} stops` });
    }
    if (trip.description) createEl(h, "p", { text: trip.description, cls: "hj-header-desc" });
  }

  // === Card ===
  mkCard(el, p, i) {
    const card = createDiv(el, { cls: "hj-card", attr: { "data-i": `${i}` } });
    const photos = p.photos && p.photos.length > 0 ? p.photos : [];
    const hasImage = photos.length > 0;

    if (hasImage) {
      // First photo: cone anchor
      const iw = createDiv(card, { cls: "hj-img-wrap hj-cone-anchor" });
      const firstImg = createEl(iw, "img", { cls: "hj-img hj-img-inactive" });
      firstImg.src = photos[0].imageUrl || "";
      firstImg.alt = p.title;
      firstImg.loading = "lazy";
      // Extra photos
      for (let pi = 1; pi < photos.length; pi++) {
        const extraWrap = createDiv(card, { cls: "hj-img-wrap hj-img-extra" });
        const extraImg = createEl(extraWrap, "img", { cls: "hj-img hj-img-inactive" });
        extraImg.src = photos[pi].imageUrl || "";
        extraImg.alt = photos[pi].title || p.title;
        extraImg.loading = "lazy";
      }
    } else {
      // Track marker (no photo)
      const marker = createDiv(card, { cls: "hj-track-marker hj-cone-anchor" });
      const icon = createDiv(marker, { cls: "hj-track-icon" });
      if (i === 0) icon.textContent = "\u{1F6A9}";
      else if (i === this.pts.length - 1) icon.textContent = "\u{1F3C1}";
      else icon.textContent = "\u{1F4CD}";
      createEl(marker, "h3", { text: p.title, cls: "hj-track-title" });
      const coords = createDiv(marker, { cls: "hj-track-coords" });
      if (p.lat && p.lng) createEl(coords, "span", { text: `${p.lat.toFixed(4)}\u00B0, ${p.lng.toFixed(4)}\u00B0` });
      if (p.alt != null) createEl(coords, "span", { text: `${p.alt}m elev.` });
    }

    // V5: blog text only; V4: full card info
    if (this.tripVersion >= 5) {
      if (p.blog && p.blog.trim()) {
        const blogDiv = createDiv(card, { cls: "hj-blog" });
        blogDiv.innerHTML = marked.parse(p.blog);
      }
    } else {
      const info = createDiv(card, { cls: "hj-card-info" });
      const lb = createDiv(info, { cls: "hj-card-label" });
      createDiv(lb, { cls: "hj-dot-sm" });
      createEl(lb, "span", { text: p.title, cls: "hj-card-name" });
      createEl(info, "h2", { text: p.title, cls: "hj-card-title" });
      if (p.description) createEl(info, "p", { text: p.description, cls: "hj-card-desc" });
      const meta = createDiv(info, { cls: "hj-card-meta" });
      if (p.lat && p.lng) createEl(meta, "span", { text: `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}` });
      if (p.alt != null) createEl(meta, "span", { text: `${p.alt}m` });
      if (p.datetime) createEl(meta, "span", { text: new Date(p.datetime).toLocaleString() });
      if (p.blog && p.blog.trim()) {
        const b = createDiv(info, { cls: "hj-blog" });
        b.innerHTML = marked.parse(p.blog);
      }
    }
    return card;
  }

  // === Animation Loop ===
  _cacheCardCtrs() {
    this.cardCtrs = this.cards.map(c => c.offsetTop + c.offsetHeight / 2);
  }

  startLoop() {
    const loop = () => {
      if (!this.scrollEl || !this.svgBox) return;
      const vc = this.scrollEl.scrollTop + this.scrollEl.clientHeight / 2;
      const ctrs = this.cardCtrs;
      let sp = 0;
      if (ctrs.length) {
        if (vc <= ctrs[0]) sp = 0;
        else if (vc >= ctrs[ctrs.length - 1]) {
          const lastCtr = ctrs[ctrs.length - 1];
          const scrollEnd = this.scrollEl.scrollHeight - this.scrollEl.clientHeight / 2;
          const extraRange = scrollEnd - lastCtr;
          sp = extraRange > 0 ? (ctrs.length - 1) + Math.min(1, (vc - lastCtr) / extraRange) : ctrs.length - 1;
        } else {
          for (let i = 0; i < ctrs.length - 1; i++) {
            if (vc >= ctrs[i] && vc <= ctrs[i + 1]) {
              sp = i + (vc - ctrs[i]) / (ctrs[i + 1] - ctrs[i]);
              break;
            }
          }
        }
      }

      const ni = Math.max(0, Math.min(this.pts.length - 1, Math.round(sp)));
      if (ni !== this.ai) {
        const oldAi = this.ai;
        this.ai = ni;
        this.syncCards(oldAi, ni);
        this.syncDots(oldAi, ni);
      }

      const ap = this.pts[this.ai];
      if (!ap) { this.raf = requestAnimationFrame(loop); return; }

      let tipX, tipY;
      let targetDist = 0;
      const fi = Math.floor(sp), fp = sp - fi;

      if (this.hasTrack) {
        const d1 = this.pts[fi].trackDist;
        const d2 = fi < this.pts.length - 1 ? this.pts[fi + 1].trackDist : this.totalDist;
        targetDist = d1 + (d2 - d1) * fp;
        const tip = interpAt(targetDist, this.route, this.routeDists);
        tipX = tip.x;
        tipY = tip.y;
      } else {
        tipX = this.pts[fi].x;
        tipY = this.pts[fi].y;
        if (fi < this.pts.length - 1) {
          tipX += (this.pts[fi + 1].x - this.pts[fi].x) * fp;
          tipY += (this.pts[fi + 1].y - this.pts[fi].y) * fp;
        }
      }

      const tcx = this.geo.w * CAM_OX - tipX + this.userOffX;
      const tcy = this.geo.h * CAM_OY - tipY + this.userOffY;
      if (!this.userPanning) {
        this.userOffX *= 0.92;
        this.userOffY *= 0.92;
        if (Math.abs(this.userOffX) < 0.5) this.userOffX = 0;
        if (Math.abs(this.userOffY) < 0.5) this.userOffY = 0;
      }
      this.cx += (tcx - this.cx) * 0.18;
      this.cy += (tcy - this.cy) * 0.18;
      if (this.mGrp) this.mGrp.setAttribute("transform", `translate(${this.cx},${this.cy})`);

      if (Math.abs(this.cx - this._lastTileCx) > TILE / 2 || Math.abs(this.cy - this._lastTileCy) > TILE / 2) {
        this.syncTiles();
        this._lastTileCx = this.cx;
        this._lastTileCy = this.cy;
      }

      this.syncCone(tipX, tipY);
      this.syncLines(sp, targetDist);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  // === Dynamic Tile Loading ===
  syncTiles() {
    const sr = this._svgRect || this.svgBox.getBoundingClientRect();
    if (!sr.width || !sr.height) return;
    const s = this.userScale || 1;
    const vbW = this.geo.w / s, vbH = this.geo.h / s;
    const vbX = this.geo.w * CAM_OX * (1 - 1 / s);
    const vbY = this.geo.h * CAM_OY * (1 - 1 / s);
    const scale = Math.max(sr.width / vbW, sr.height / vbH);
    const vw = sr.width / scale, vh = sr.height / scale;
    const mapCX = (vbX + vbW / 2) - this.cx;
    const mapCY = (vbY + vbH / 2) - this.cy;
    const buf = 2;
    const xMin = Math.floor(this.geo.minTX + (mapCX - vw / 2) / TILE) - buf;
    const xMax = Math.floor(this.geo.minTX + (mapCX + vw / 2) / TILE) + buf;
    const yMin = Math.floor(this.geo.minTY + (mapCY - vh / 2) / TILE) - buf;
    const yMax = Math.floor(this.geo.minTY + (mapCY + vh / 2) / TILE) + buf;
    const ms = MAP_STYLES[this.mapStyle] || MAP_STYLES["opentopomap"];
    const srv = ms.subs;
    let idx = 0;
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        if (idx >= this.tilePool.length) break;
        const node = this.tilePool[idx];
        let url = ms.url.replace("{z}", this.geo.zoom).replace("{x}", x).replace("{y}", y);
        if (srv.length > 0) url = url.replace("{s}", srv[Math.abs(x + y) % srv.length]);
        if (node.getAttribute("href") !== url) {
          node.setAttribute("href", url);
          node.setAttribute("x", `${(x - this.geo.minTX) * TILE}`);
          node.setAttribute("y", `${(y - this.geo.minTY) * TILE}`);
        }
        if (node.style.display === "none") node.style.display = "";
        idx++;
      }
    }
    while (idx < this.tilePool.length) {
      if (this.tilePool[idx].style.display !== "none") this.tilePool[idx].style.display = "none";
      idx++;
    }
  }

  // === Cone Shadow ===
  syncCone(tipX, tipY) {
    const card = this.cards[this.ai];
    if (!card || !this.coneSvg) return;
    let wraps = Array.from(card.querySelectorAll(".hj-img-wrap"));
    if (!wraps.length) {
      const marker = card.querySelector(".hj-cone-anchor");
      if (marker) wraps = [marker];
      else return;
    }
    const sr = this._svgRect || this.svgBox.getBoundingClientRect();
    if (!sr.width || !sr.height) return;
    const zs = this.userScale || 1;
    const vbW = this.geo.w / zs, vbH = this.geo.h / zs;
    const vbX = this.geo.w * CAM_OX * (1 - 1 / zs);
    const vbY = this.geo.h * CAM_OY * (1 - 1 / zs);
    const sc = Math.max(sr.width / vbW, sr.height / vbH);
    if (!sc || !isFinite(sc)) return;
    const oY = (vbH * sc - sr.height) / 2;
    const oX = (vbW * sc - sr.width) / 2;
    const s2y = (sy) => (sy - sr.top + oY) / sc + vbY;
    const s2x = (sx) => (sx - sr.left + oX) / sc + vbX;
    while (this.cones.length < wraps.length) {
      const poly = S("polygon", { fill: "url(#coneG)", style: "mix-blend-mode:multiply;" }, this.coneSvg);
      this.cones.push(poly);
    }
    for (let i = 0; i < this.cones.length; i++) {
      this.cones[i].setAttribute("visibility", i < wraps.length ? "visible" : "hidden");
    }
    const tx = tipX + this.cx, ty = tipY + this.cy;
    const scrollRect = this.scrollEl.getBoundingClientRect();
    const scrollH = scrollRect.height;
    for (let i = 0; i < wraps.length; i++) {
      const ir = wraps[i].getBoundingClientRect();
      if (!ir.width || !ir.height) continue;
      const photoMid = (ir.top + ir.bottom) / 2;
      const rawT = Math.max(0, Math.min(1, 1 - (photoMid - scrollRect.top) / scrollH));
      const t = 1 - Math.pow(1 - rawT, 4);
      const p1x = s2x(ir.left + (ir.right - ir.left) * t);
      const p1y = s2y(ir.top);
      const p2x = s2x(ir.right);
      const p2y = s2y(ir.bottom);
      if (isFinite(p1x) && isFinite(tx)) {
        this.cones[i].setAttribute("points", `${p1x},${p1y} ${p2x},${p2y} ${tx},${ty}`);
      }
    }
  }

  // === Route Progress ===
  syncLines(sp, targetDist) {
    if (this.hasTrack && this.pathLine) {
      this.pathLine.style.strokeDashoffset = `${Math.max(0, this.totalDist - targetDist)}`;
    } else {
      for (let j = 0; j < this.pts.length - 1; j++) {
        const dr = Math.max(0, Math.min(1, sp - j));
        const len = Math.hypot(this.pts[j + 1].x - this.pts[j].x, this.pts[j + 1].y - this.pts[j].y);
        const l = this.segs[j];
        if (l) {
          l.style.strokeDasharray = `${len}`;
          l.style.strokeDashoffset = `${len * (1 - dr)}`;
        }
      }
    }
    for (let j = 0; j < this.pts.length - 1; j++) {
      const passed = this.hasTrack ? targetDist >= (this.pts[j].trackDist + this.pts[j + 1].trackDist) / 2 : Math.max(0, Math.min(1, sp - j)) >= 0.5;
      if (this.iBgs[j]) {
        this.iBgs[j].setAttribute("fill", passed ? "#ef4444" : "#fff");
        this.iBgs[j].setAttribute("stroke", passed ? "none" : "#cbd5e1");
      }
      if (this.iGs[j]) {
        this.iGs[j].classList.toggle("hj-icon-gray", !passed);
        this.iGs[j].classList.toggle("hj-icon-white", passed);
      }
    }
  }

  // === Active States ===
  syncCards(oldIdx, newIdx) {
    const deactivate = (c) => {
      c.classList.remove("hj-card-active");
      c.classList.add("hj-card-dim");
      c.querySelectorAll(".hj-img").forEach(img => { img.classList.remove("hj-img-active"); img.classList.add("hj-img-inactive"); });
      const m = c.querySelector(".hj-track-marker");
      if (m) { m.classList.remove("hj-marker-active"); m.classList.add("hj-marker-dim"); }
    };
    const activate = (c) => {
      c.classList.add("hj-card-active");
      c.classList.remove("hj-card-dim");
      c.querySelectorAll(".hj-img").forEach(img => { img.classList.add("hj-img-active"); img.classList.remove("hj-img-inactive"); });
      const m = c.querySelector(".hj-track-marker");
      if (m) { m.classList.add("hj-marker-active"); m.classList.remove("hj-marker-dim"); }
    };
    if (oldIdx >= 0 && oldIdx < this.cards.length) deactivate(this.cards[oldIdx]);
    if (newIdx >= 0 && newIdx < this.cards.length) activate(this.cards[newIdx]);
  }

  _setDot(ref, active) {
    if (!ref) return;
    if (ref.dot) {
      ref.dot.setAttribute("r", active ? "7" : "4");
      ref.dot.setAttribute("fill", active ? "#dc2626" : "#475569");
      active ? ref.dot.setAttribute("filter", "url(#glow)") : ref.dot.removeAttribute("filter");
    }
    if (ref.ping) {
      ref.ping.setAttribute("opacity", active ? "0.6" : "0");
      ref.ping.classList.toggle("hj-ping-anim", active);
    }
    if (ref.lbl) {
      ref.lbl.setAttribute("font-size", active ? "15" : "12");
      ref.lbl.setAttribute("font-weight", active ? "600" : "500");
      ref.lbl.setAttribute("fill", active ? "#0f172a" : "#64748b");
    }
  }

  syncDots(oldIdx, newIdx) {
    this._setDot(this.dotRefs[oldIdx], false);
    this._setDot(this.dotRefs[newIdx], true);
  }

  // === Map Click ===
  tapDot(i) {
    if (this.cards[i]) this.cards[i].scrollIntoView({ behavior: "smooth", block: "center" });
    this.showBubble(i);
  }

  showBubble(i) {
    this.rmBubble();
    const p = this.pts[i];
    if (!p) return;
    const fo = S("foreignObject", { x: `${p.x - 90}`, y: `${p.y - 120}`, width: "180", height: "95", class: "hj-bubble-fo" });
    const d = document.createElement("div");
    d.className = "hj-bubble-inner";
    const t = document.createElement("div");
    t.className = "hj-bubble-title";
    t.textContent = "Location Data";
    d.appendChild(t);
    if (p.lat && p.lng) {
      const r = document.createElement("div");
      r.className = "hj-bubble-row";
      r.innerHTML = `<span>Lat/Lng</span><span class="hj-mono">${p.lat.toFixed(4)}\u00B0, ${p.lng.toFixed(4)}\u00B0</span>`;
      d.appendChild(r);
    }
    if (p.alt != null) {
      const r = document.createElement("div");
      r.className = "hj-bubble-row";
      r.innerHTML = `<span>Elevation</span><span class="hj-mono">${p.alt}m</span>`;
      d.appendChild(r);
    }
    const cr = document.createElement("div");
    cr.className = "hj-bubble-caret";
    d.appendChild(cr);
    fo.appendChild(d);
    this.mGrp.appendChild(fo);
    this.bubble = fo;
  }

  rmBubble() {
    if (this.bubble) { this.bubble.remove(); this.bubble = null; }
  }
}

// === Global Map Viewer ===
class GlobalMapViewer {
  constructor(svg) {
    this.svg = svg;
    this.trips = [];
    this.geo = null;
    this.mGrp = null;
    this.tileGroup = null;
    this.tilePool = [];
    this.markerGroup = null;
    this.cx = 0;
    this.cy = 0;
    this.userScale = 1;
    this.userOffX = 0;
    this.userOffY = 0;
    this.userPanning = false;
    this._dragState = null;
    this._panTimer = null;
    this._cleanupListeners = null;
    this._lastTileCx = -9999;
    this._lastTileCy = -9999;
    this.raf = 0;
    this.mapStyle = "carto-voyager";
  }

  loadTrips(trips) {
    this.trips = trips;
    this.build();
  }

  destroy() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this._cleanupListeners) this._cleanupListeners();
    if (this._panTimer) clearTimeout(this._panTimer);
    this.tilePool = [];
    this.svg.innerHTML = "";
  }

  build() {
    this.svg.innerHTML = "";
    const trips = this.trips;
    if (!trips.length) return;

    // Calculate bounds across all trips
    const lats = trips.map(t => t.lat);
    const lngs = trips.map(t => t.lng);
    const pad = 2; // generous padding for global view
    const bounds = {
      north: Math.max(...lats) + pad,
      south: Math.min(...lats) - pad,
      east: Math.max(...lngs) + pad,
      west: Math.min(...lngs) - pad
    };

    const latSpan = bounds.north - bounds.south;
    const lngSpan = bounds.east - bounds.west;
    const zoom = autoZoom(latSpan, lngSpan, 2, 10);
    this.geo = buildGeo(bounds, zoom);

    // Set viewBox
    this.svg.setAttribute("viewBox", `0 0 ${this.geo.w} ${this.geo.h}`);
    this.svg.setAttribute("preserveAspectRatio", "xMidYMid slice");

    // Defs
    const defs = S("defs", {}, this.svg);
    const gf = S("filter", { id: "gm-glow", x: "-30%", y: "-30%", width: "160%", height: "160%" }, defs);
    S("feGaussianBlur", { stdDeviation: "4", result: "b" }, gf);
    S("feComposite", { in: "SourceGraphic", in2: "b", operator: "over" }, gf);

    // Main transform group
    this.mGrp = S("g", {}, this.svg);

    // Tile layer
    const ms = MAP_STYLES[this.mapStyle];
    this.tileGroup = S("g", { style: `filter:${ms.filter};` }, this.mGrp);
    this.tilePool = [];
    for (let i = 0; i < POOL; i++) {
      const img = S("image", {
        width: `${TILE + 0.5}`,
        height: `${TILE + 0.5}`,
        preserveAspectRatio: "none",
        style: "display:none"
      }, this.tileGroup);
      this.tilePool.push(img);
    }

    // Marker group (on top of tiles)
    this.markerGroup = S("g", {}, this.mGrp);
    this.createMarkers();

    // Center the map on the midpoint
    const midLat = (Math.max(...lats) + Math.min(...lats)) / 2;
    const midLng = (Math.max(...lngs) + Math.min(...lngs)) / 2;
    const mid = proj(midLat, midLng, this.geo);
    this.cx = this.geo.w / 2 - mid.x;
    this.cy = this.geo.h / 2 - mid.y;

    this.setupInteraction();
    this.syncTiles();
    this.startLoop();
  }

  createMarkers() {
    for (const trip of this.trips) {
      const p = proj(trip.lat, trip.lng, this.geo);
      const g = S("g", { transform: `translate(${p.x},${p.y})`, class: "global-marker" }, this.markerGroup);

      // Ping ring
      S("circle", { r: "20", class: "global-marker-ping" }, g);

      // Outer glow circle
      S("circle", { r: "14", fill: "rgba(220,38,38,0.15)", class: "global-marker-glow" }, g);

      // Main dot
      S("circle", { r: "8", class: "global-marker-dot" }, g);

      // Inner dot
      S("circle", { r: "3", fill: "white", opacity: "0.9" }, g);

      // Label background
      const name = trip.name;
      const labelY = -22;
      const bgW = Math.max(60, name.length * 7 + 16);
      S("rect", {
        x: `${-bgW / 2}`, y: `${labelY - 12}`, width: `${bgW}`, height: "20", rx: "4",
        fill: "rgba(255,255,255,0.9)", stroke: "rgba(0,0,0,0.08)", "stroke-width": "0.5",
        class: "global-marker-label-bg"
      }, g);

      // Trip name
      const lbl = S("text", {
        x: "0", y: `${labelY}`,
        class: "global-marker-label"
      }, g);
      lbl.textContent = name;

      // Region subtitle
      if (trip.region) {
        const sub = S("text", {
          x: "0", y: `${labelY + 12}`,
          class: "global-marker-region"
        }, g);
        sub.textContent = trip.region;
      }

      // Click handler
      g.addEventListener("click", (e) => {
        e.stopPropagation();
        openTrip(trip.file);
      });
    }
  }

  setupInteraction() {
    const svg = this.svg;
    svg.style.cursor = "grab";

    // Mouse drag
    const onMouseDown = (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      this._dragState = { x: e.clientX, y: e.clientY };
      this.userPanning = true;
      svg.style.cursor = "grabbing";
      if (this._panTimer) clearTimeout(this._panTimer);
    };

    const onMouseMove = (e) => {
      if (!this._dragState) return;
      const sr = svg.getBoundingClientRect();
      const vbW = this.geo.w / this.userScale;
      const sc = Math.max(sr.width / vbW, sr.height / (this.geo.h / this.userScale));
      const dx = (e.clientX - this._dragState.x) / sc;
      const dy = (e.clientY - this._dragState.y) / sc;
      this.cx += dx;
      this.cy += dy;
      this._dragState.x = e.clientX;
      this._dragState.y = e.clientY;
    };

    const onMouseUp = () => {
      if (!this._dragState) return;
      this._dragState = null;
      svg.style.cursor = "grab";
      this._panTimer = setTimeout(() => { this.userPanning = false; }, 3000);
    };

    svg.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    // Wheel zoom
    svg.addEventListener("wheel", (e) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      this.userScale = Math.max(0.3, Math.min(8, this.userScale * factor));
      this.updateViewBox();
      this._lastTileCx = -9999;
      this._lastTileCy = -9999;
    }, { passive: false });

    // Double-click reset
    svg.addEventListener("dblclick", (e) => {
      e.preventDefault();
      this.userScale = 1;
      const lats = this.trips.map(t => t.lat);
      const lngs = this.trips.map(t => t.lng);
      const mid = proj((Math.max(...lats) + Math.min(...lats)) / 2, (Math.max(...lngs) + Math.min(...lngs)) / 2, this.geo);
      this.cx = this.geo.w / 2 - mid.x;
      this.cy = this.geo.h / 2 - mid.y;
      this.updateViewBox();
      this._lastTileCx = -9999;
    });

    // Touch support
    let lastTouchDist = 0;
    svg.addEventListener("touchstart", (e) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastTouchDist = Math.hypot(dx, dy);
      } else if (e.touches.length === 1) {
        this._dragState = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        this.userPanning = true;
        if (this._panTimer) clearTimeout(this._panTimer);
      }
    }, { passive: true });

    svg.addEventListener("touchmove", (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        if (lastTouchDist > 0) {
          const factor = dist / lastTouchDist;
          this.userScale = Math.max(0.3, Math.min(8, this.userScale * factor));
          this.updateViewBox();
          this._lastTileCx = -9999;
        }
        lastTouchDist = dist;
      } else if (e.touches.length === 1 && this._dragState) {
        const sr = svg.getBoundingClientRect();
        const vbW = this.geo.w / this.userScale;
        const sc = Math.max(sr.width / vbW, sr.height / (this.geo.h / this.userScale));
        this.cx += (e.touches[0].clientX - this._dragState.x) / sc;
        this.cy += (e.touches[0].clientY - this._dragState.y) / sc;
        this._dragState.x = e.touches[0].clientX;
        this._dragState.y = e.touches[0].clientY;
      }
    }, { passive: false });

    svg.addEventListener("touchend", () => {
      lastTouchDist = 0;
      this._dragState = null;
      this._panTimer = setTimeout(() => { this.userPanning = false; }, 3000);
    }, { passive: true });

    this._cleanupListeners = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }

  updateViewBox() {
    const s = this.userScale;
    const vbW = this.geo.w / s;
    const vbH = this.geo.h / s;
    const vbX = (this.geo.w - vbW) / 2;
    const vbY = (this.geo.h - vbH) / 2;
    this.svg.setAttribute("viewBox", `${vbX} ${vbY} ${vbW} ${vbH}`);
  }

  syncTiles() {
    const sr = this.svg.getBoundingClientRect();
    if (!sr.width || !sr.height) return;
    const s = this.userScale || 1;
    const vbW = this.geo.w / s, vbH = this.geo.h / s;
    const vbX = (this.geo.w - vbW) / 2;
    const vbY = (this.geo.h - vbH) / 2;
    const scale = Math.max(sr.width / vbW, sr.height / vbH);
    const vw = sr.width / scale, vh = sr.height / scale;
    const mapCX = (vbX + vbW / 2) - this.cx;
    const mapCY = (vbY + vbH / 2) - this.cy;
    const buf = 2;
    const xMin = Math.floor(this.geo.minTX + (mapCX - vw / 2) / TILE) - buf;
    const xMax = Math.floor(this.geo.minTX + (mapCX + vw / 2) / TILE) + buf;
    const yMin = Math.floor(this.geo.minTY + (mapCY - vh / 2) / TILE) - buf;
    const yMax = Math.floor(this.geo.minTY + (mapCY + vh / 2) / TILE) + buf;
    const ms = MAP_STYLES[this.mapStyle];
    const srv = ms.subs;
    let idx = 0;
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        if (idx >= this.tilePool.length) break;
        if (y < 0 || y >= (1 << this.geo.zoom)) continue;
        const wx = ((x % (1 << this.geo.zoom)) + (1 << this.geo.zoom)) % (1 << this.geo.zoom);
        const node = this.tilePool[idx];
        let url = ms.url.replace("{z}", this.geo.zoom).replace("{x}", wx).replace("{y}", y);
        if (srv.length > 0) url = url.replace("{s}", srv[Math.abs(x + y) % srv.length]);
        if (node.getAttribute("href") !== url) {
          node.setAttribute("href", url);
          node.setAttribute("x", `${(x - this.geo.minTX) * TILE}`);
          node.setAttribute("y", `${(y - this.geo.minTY) * TILE}`);
        }
        if (node.style.display === "none") node.style.display = "";
        idx++;
      }
    }
    while (idx < this.tilePool.length) {
      if (this.tilePool[idx].style.display !== "none") this.tilePool[idx].style.display = "none";
      idx++;
    }
  }

  startLoop() {
    const loop = () => {
      if (this.mGrp) this.mGrp.setAttribute("transform", `translate(${this.cx},${this.cy})`);
      if (Math.abs(this.cx - this._lastTileCx) > TILE / 2 || Math.abs(this.cy - this._lastTileCy) > TILE / 2) {
        this.syncTiles();
        this._lastTileCx = this.cx;
        this._lastTileCy = this.cy;
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
}

// === App State & Navigation ===
let viewer = null;
let globalMap = null;
let tripsData = null;

async function loadTripIndex() {
  const resp = await fetch("data/trips.json");
  return resp.json();
}

async function loadTripData(filename) {
  const resp = await fetch(`data/${filename}`);
  return resp.json();
}

function showGlobalMap() {
  document.getElementById("global-map").style.display = "";
  document.getElementById("trip-view").style.display = "none";
  if (globalMap) globalMap.destroy();
  const svg = document.getElementById("global-svg");
  globalMap = new GlobalMapViewer(svg);
  globalMap.loadTrips(tripsData);
}

async function openTrip(filename) {
  if (globalMap) { globalMap.destroy(); globalMap = null; }
  document.getElementById("global-map").style.display = "none";
  const container = document.getElementById("trip-view");
  container.style.display = "";
  const data = await loadTripData(filename);
  container.className = `hj-root${(data.version || 5) >= 5 ? " hj-v5" : ""}`;
  if (viewer) viewer.destroy();
  viewer = new HikingJournalViewer(container);
  viewer.loadTrip(data);
}

function backToList() {
  if (viewer) { viewer.destroy(); viewer = null; }
  document.getElementById("trip-view").style.display = "none";
  showGlobalMap();
}

// === Init ===
document.addEventListener("DOMContentLoaded", async () => {
  try {
    tripsData = await loadTripIndex();
    showGlobalMap();
  } catch (err) {
    console.error("Failed to load trip index:", err);
  }
});
