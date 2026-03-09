/**
 * Sync Hiking Journal trips from Obsidian vault to website.
 *
 * Usage:
 *     node sync_trips.js
 *
 * Reads V5 markdown + GPX + photos from the Obsidian plugin folder,
 * converts to web JSON format, copies photos, and updates trips.json.
 */

const fs = require("fs");
const path = require("path");

// ── Paths (edit these if your folders move) ──────────────────────────
const SRC_DIR = String.raw`E:\Explore\Project\Obsidian Plugins\Obsidian-Plugins-Developing\Travel Recording\Travel Journal Testing\Travel Journal\hiking-journal`;
const WEB_ROOT = String.raw`E:\Explore\rickliang-JY.github.io`;
const DATA_DIR = path.join(WEB_ROOT, "hiking-journal", "data");
const IMAGES_DIR = path.join(WEB_ROOT, "images", "hiking-journal");

const MAX_GPX_POINTS = 70;

// ── Frontmatter Parser ───────────────────────────────────────────────
function parseFrontmatter(mdText) {
  const m = mdText.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)/);
  if (!m) {
    return [{}, mdText];
  }

  const yamlBlock = m[1];
  const body = m[2];
  const fm = {};

  for (let line of yamlBlock.split("\n")) {
    line = line.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      const key = match[1];
      let val = match[2].trim();
      // Remove surrounding quotes
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1);
      } else if (val.startsWith("'") && val.endsWith("'")) {
        // YAML single-quote escaping: '' inside single-quoted strings means literal '
        val = val.slice(1, -1).replace(/''/g, "'");
      }
      fm[key] = val;
    }
  }

  return [fm, body];
}

// ── Markdown Section Parser ──────────────────────────────────────────
function parseSections(body) {
  const sections = [];
  // Split by ### headings
  const parts = body.split(/^### (.+)$/m);

  // parts[0] is content before first ###, then alternating title/content
  for (let i = 1; i < parts.length; i += 2) {
    const title = parts[i].trim();
    const content = i + 1 < parts.length ? parts[i + 1] : "";

    // Extract photo references: ![[filename.jpg]]
    const photoRegex = /!\[\[([^\]]+\.(?:jpg|jpeg|png|gif|webp))\]\]/gi;
    const photos = [];
    let pm;
    while ((pm = photoRegex.exec(content)) !== null) {
      photos.push(pm[1]);
    }

    // Extract blog text (everything that's not an image embed or blank)
    const blogLines = [];
    for (let line of content.split("\n")) {
      line = line.trim();
      if (!line) continue;
      if (/^!\[\[.+\]\]$/.test(line)) continue;
      if (line.startsWith("## ") || line.startsWith("# ")) continue;
      blogLines.push(line);
    }

    const blog = blogLines.join("\n\n").trim();
    sections.push({ title, photos, blog });
  }

  return sections;
}

// ── GPX Parser ───────────────────────────────────────────────────────
function parseGpx(gpxPath, maxPoints = MAX_GPX_POINTS) {
  const gpxText = fs.readFileSync(gpxPath, "utf-8");

  // Extract all track points with regex
  const pts = [];
  const regex = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)">\s*<ele>([^<]+)<\/ele>/g;
  let m;
  while ((m = regex.exec(gpxText)) !== null) {
    pts.push({
      lat: Math.round(parseFloat(m[1]) * 1e6) / 1e6,
      lng: Math.round(parseFloat(m[2]) * 1e6) / 1e6,
      ele: Math.round(parseFloat(m[3]) * 100) / 100,
    });
  }

  if (pts.length === 0) return [];

  // Simplify by uniform sampling
  if (pts.length <= maxPoints) return pts;

  const step = Math.max(1, Math.floor(pts.length / maxPoints));
  const simplified = [];
  for (let i = 0; i < pts.length; i += step) {
    simplified.push(pts[i]);
  }
  // Always include last point
  const last = pts[pts.length - 1];
  const lastSimp = simplified[simplified.length - 1];
  if (lastSimp.lat !== last.lat || lastSimp.lng !== last.lng || lastSimp.ele !== last.ele) {
    simplified.push(last);
  }

  return simplified;
}

// ── Photo Sync ───────────────────────────────────────────────────────
function syncPhotos(srcPhotosDir, destPhotosDir) {
  if (!fs.existsSync(srcPhotosDir) || !fs.statSync(srcPhotosDir).isDirectory()) {
    return [];
  }

  fs.mkdirSync(destPhotosDir, { recursive: true });
  const copied = [];

  for (const filename of fs.readdirSync(srcPhotosDir)) {
    const srcPath = path.join(srcPhotosDir, filename);
    if (!fs.statSync(srcPath).isFile()) continue;

    const destPath = path.join(destPhotosDir, filename);

    // Skip if destination exists and is same size + same or newer mtime
    if (fs.existsSync(destPath)) {
      const srcStat = fs.statSync(srcPath);
      const dstStat = fs.statSync(destPath);
      if (srcStat.size === dstStat.size && dstStat.mtimeMs >= srcStat.mtimeMs) {
        continue;
      }
    }

    fs.copyFileSync(srcPath, destPath);
    // Preserve mtime/atime
    const srcStat = fs.statSync(srcPath);
    fs.utimesSync(destPath, srcStat.atime, srcStat.mtime);
    copied.push(filename);
  }

  return copied;
}

// ── Build Trip JSON ──────────────────────────────────────────────────
function buildTripJson(tripId, fm, sections, gpxTrack) {
  // Parse locations from frontmatter
  const locations = JSON.parse(fm.locations_json || "[]");
  locations.sort((a, b) => (a.sort || 0) - (b.sort || 0));

  // Build photo → section mapping
  const photoToSection = {};
  for (const sec of sections) {
    for (const photo of sec.photos) {
      photoToSection[photo] = sec.title;
    }
  }

  // Track which sections have had blog text assigned
  const blogAssigned = new Set();

  // Build waypoints
  const waypoints = [];
  for (const loc of locations) {
    // Determine section from first photo
    let sectionTitle = "";
    if (loc.photos && loc.photos.length > 0) {
      const firstPhotoFn = loc.photos[0].filename || "";
      sectionTitle = photoToSection[firstPhotoFn] || "";
    }

    // Assign blog text to first location in each section
    let blog = "";
    if (sectionTitle && !blogAssigned.has(sectionTitle)) {
      for (const sec of sections) {
        if (sec.title === sectionTitle && sec.blog) {
          blog = sec.blog;
          blogAssigned.add(sectionTitle);
          break;
        }
      }
    }

    // Transform photos
    const photos = [];
    for (const p of loc.photos || []) {
      photos.push({
        id: p.id || "",
        imageUrl: `/images/hiking-journal/${tripId}/${p.filename}`,
        title: p.title || "",
      });
    }

    waypoints.push({
      id: loc.id || "",
      title: loc.title || "",
      sectionTitle,
      lat: loc.lat,
      lng: loc.lng,
      alt: loc.alt,
      blog,
      photos,
    });
  }

  // Parse stats
  const distanceKm = parseFloat(fm.distance_km || "0");
  const elevationGain = Math.floor(parseFloat(fm.elevation_gain || "0"));
  const elevationLoss = Math.floor(parseFloat(fm.elevation_loss || "0"));

  // Map style
  const mapStyle = fm.map_style || "opentopomap";

  return {
    version: 5,
    name: fm.name || tripId,
    description: fm.description || "",
    region: fm.region || "",
    date: fm.date || "",
    mapStyle,
    stats: {
      distanceKm,
      elevationGainM: elevationGain,
      elevationLossM: elevationLoss,
    },
    gpxTrack,
    waypoints,
  };
}

// ── Sync a Single Trip ──────────────────────────────────────────────
function syncTrip(tripDir, tripId) {
  // Find the markdown file
  const mdFiles = fs.readdirSync(tripDir).filter((f) => f.endsWith(".md"));
  if (mdFiles.length === 0) {
    console.log(`  [SKIP] No .md file found in ${tripId}`);
    return null;
  }

  const mdPath = path.join(tripDir, mdFiles[0]);
  console.log(`  Parsing ${mdFiles[0]}...`);

  const mdText = fs.readFileSync(mdPath, "utf-8");
  const [fm, body] = parseFrontmatter(mdText);
  const sections = parseSections(body);

  // Parse routes to find GPX file
  const routes = JSON.parse(fm.routes_json || "[]");
  let gpxTrack = [];
  if (routes.length > 0) {
    const gpxFilename = routes[0].gpx || "";
    if (gpxFilename) {
      const gpxPath = path.join(tripDir, gpxFilename);
      if (fs.existsSync(gpxPath)) {
        gpxTrack = parseGpx(gpxPath);
        console.log(`  Parsed GPX: ${gpxTrack.length} points`);
      } else {
        console.log(`  [WARN] GPX file not found: ${gpxFilename}`);
      }
    }
  }

  // Build trip JSON
  const tripJson = buildTripJson(tripId, fm, sections, gpxTrack);

  // Write trip JSON
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tripJsonPath = path.join(DATA_DIR, `${tripId}.json`);
  fs.writeFileSync(tripJsonPath, JSON.stringify(tripJson, null, 2), "utf-8");
  console.log(`  Wrote ${tripId}.json (${tripJson.waypoints.length} waypoints)`);

  // Sync photos
  const srcPhotos = path.join(tripDir, "photos");
  const destPhotos = path.join(IMAGES_DIR, tripId);
  const copied = syncPhotos(srcPhotos, destPhotos);
  if (copied.length > 0) {
    console.log(`  Copied ${copied.length} photos`);
  } else {
    console.log(`  Photos up to date`);
  }

  // Calculate center point
  const lats = tripJson.waypoints.filter((w) => w.lat).map((w) => w.lat);
  const lngs = tripJson.waypoints.filter((w) => w.lng).map((w) => w.lng);
  const centerLat = lats.length > 0 ? lats.reduce((a, b) => a + b, 0) / lats.length : 0;
  const centerLng = lngs.length > 0 ? lngs.reduce((a, b) => a + b, 0) / lngs.length : 0;

  // Find cover image
  let coverImage = null;
  for (const wp of tripJson.waypoints) {
    if (wp.photos && wp.photos.length > 0) {
      coverImage = wp.photos[0].imageUrl;
      break;
    }
  }

  return {
    name: tripJson.name,
    region: tripJson.region,
    date: tripJson.date,
    description: tripJson.description,
    coverImage,
    file: `${tripId}.json`,
    lat: Math.round(centerLat * 1000) / 1000,
    lng: Math.round(centerLng * 1000) / 1000,
    stats: {
      distanceKm: tripJson.stats.distanceKm,
      elevationGainM: tripJson.stats.elevationGainM,
    },
  };
}

// ── Main ─────────────────────────────────────────────────────────────
function main() {
  console.log("=== Hiking Journal Sync ===\n");
  console.log(`Source:  ${SRC_DIR}`);
  console.log(`Target:  ${WEB_ROOT}\n`);

  if (!fs.existsSync(SRC_DIR) || !fs.statSync(SRC_DIR).isDirectory()) {
    console.log(`ERROR: Source directory not found: ${SRC_DIR}`);
    return;
  }

  // Find trip folders (directories that contain a .md file)
  const tripSummaries = [];
  const entries = fs.readdirSync(SRC_DIR).sort();

  for (const entry of entries) {
    const tripDir = path.join(SRC_DIR, entry);
    if (!fs.statSync(tripDir).isDirectory()) continue;

    // Check if it contains a markdown file
    const hasMd = fs.readdirSync(tripDir).some((f) => f.endsWith(".md"));
    if (!hasMd) continue;

    console.log(`[${entry}]`);
    const summary = syncTrip(tripDir, entry);
    if (summary) {
      tripSummaries.push(summary);
    }
    console.log();
  }

  if (tripSummaries.length === 0) {
    console.log("No trips found to sync.");
    return;
  }

  // Load existing trips.json and merge
  const tripsJsonPath = path.join(DATA_DIR, "trips.json");
  let existingTrips = [];
  if (fs.existsSync(tripsJsonPath)) {
    existingTrips = JSON.parse(fs.readFileSync(tripsJsonPath, "utf-8"));
  }

  // Keep entries not in source (e.g. kumano-kodo demo data)
  const syncedFiles = new Set(tripSummaries.map((s) => s.file));
  const preserved = existingTrips.filter((t) => !syncedFiles.has(t.file));

  // Merge: preserved entries + newly synced
  const allTrips = [...preserved, ...tripSummaries];
  // Sort by date descending
  allTrips.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  fs.writeFileSync(tripsJsonPath, JSON.stringify(allTrips, null, 2), "utf-8");

  console.log(`Updated trips.json: ${allTrips.length} trips total`);
  for (const t of allTrips) {
    const src = syncedFiles.has(t.file) ? "synced" : "preserved";
    console.log(`  - ${t.name} (${src})`);
  }

  console.log("\nDone!");
}

main();
