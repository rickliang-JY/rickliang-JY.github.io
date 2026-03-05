"""
Sync Hiking Journal trips from Obsidian vault to website.

Usage:
    python sync_trips.py

Reads V5 markdown + GPX + photos from the Obsidian plugin folder,
converts to web JSON format, copies photos, and updates trips.json.
"""

import os
import json
import re
import shutil
import glob

# ── Paths (edit these if your folders move) ──────────────────────────
SRC_DIR = r"E:\Explore\Project\Obsidian Plugins\Obsidian-Plugins-Developing\Travel Recording\Travel Journal Testing\Travel Journal\hiking-journal"
WEB_ROOT = r"E:\Explore\rickliang-JY.github.io"
DATA_DIR = os.path.join(WEB_ROOT, "hiking-journal", "data")
IMAGES_DIR = os.path.join(WEB_ROOT, "images", "hiking-journal")

MAX_GPX_POINTS = 70  # simplify GPX track to this many points


# ── Frontmatter Parser ───────────────────────────────────────────────
def parse_frontmatter(md_text):
    """Extract YAML frontmatter from markdown text (between --- lines)."""
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)", md_text, re.DOTALL)
    if not m:
        return {}, md_text

    yaml_block = m.group(1)
    body = m.group(2)
    fm = {}

    for line in yaml_block.split("\n"):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        # Handle key: 'json string' or key: "value" or key: value
        match = re.match(r"^(\w+):\s*(.+)$", line)
        if match:
            key = match.group(1)
            val = match.group(2).strip()
            # Remove surrounding quotes
            if (val.startswith('"') and val.endswith('"')) or \
               (val.startswith("'") and val.endswith("'")):
                val = val[1:-1]
            fm[key] = val

    return fm, body


# ── Markdown Section Parser ──────────────────────────────────────────
def parse_sections(body):
    """Parse markdown body into sections with titles, photos, and blog text."""
    sections = []
    # Split by ### headings
    parts = re.split(r"^### (.+)$", body, flags=re.MULTILINE)

    # parts[0] is content before first ###, then alternating title/content
    for i in range(1, len(parts), 2):
        title = parts[i].strip()
        content = parts[i + 1] if i + 1 < len(parts) else ""

        # Extract photo references: ![[filename.jpg]]
        photos = re.findall(r"!\[\[([^\]]+\.(?:jpg|jpeg|png|gif|webp))\]\]", content, re.IGNORECASE)

        # Extract blog text (everything that's not an image embed or blank)
        blog_lines = []
        for line in content.split("\n"):
            line = line.strip()
            if not line:
                continue
            if re.match(r"^!\[\[.+\]\]$", line):
                continue
            if line.startswith("## ") or line.startswith("# "):
                continue
            blog_lines.append(line)

        blog = "\n\n".join(blog_lines).strip()
        sections.append({"title": title, "photos": photos, "blog": blog})

    return sections


# ── GPX Parser ───────────────────────────────────────────────────────
def parse_gpx(gpx_path, max_points=MAX_GPX_POINTS):
    """Parse GPX file and return simplified track points."""
    with open(gpx_path, "r", encoding="utf-8") as f:
        gpx_text = f.read()

    # Extract all track points with regex
    pts = []
    for m in re.finditer(
        r'<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)">\s*<ele>([^<]+)</ele>',
        gpx_text
    ):
        pts.append({
            "lat": round(float(m.group(1)), 6),
            "lng": round(float(m.group(2)), 6),
            "ele": round(float(m.group(3)), 2)
        })

    if not pts:
        return []

    # Simplify by uniform sampling
    if len(pts) <= max_points:
        return pts

    step = max(1, len(pts) // max_points)
    simplified = [pts[i] for i in range(0, len(pts), step)]
    # Always include last point
    if simplified[-1] != pts[-1]:
        simplified.append(pts[-1])

    return simplified


# ── Photo Sync ───────────────────────────────────────────────────────
def sync_photos(src_photos_dir, dest_photos_dir):
    """Copy photos from source to destination, skipping unchanged files."""
    if not os.path.isdir(src_photos_dir):
        return []

    os.makedirs(dest_photos_dir, exist_ok=True)
    copied = []

    for src_path in glob.glob(os.path.join(src_photos_dir, "*")):
        if not os.path.isfile(src_path):
            continue
        filename = os.path.basename(src_path)
        dest_path = os.path.join(dest_photos_dir, filename)

        # Skip if destination exists and is same size + same or newer mtime
        if os.path.exists(dest_path):
            src_size = os.path.getsize(src_path)
            dst_size = os.path.getsize(dest_path)
            src_mtime = os.path.getmtime(src_path)
            dst_mtime = os.path.getmtime(dest_path)
            if src_size == dst_size and dst_mtime >= src_mtime:
                continue

        shutil.copy2(src_path, dest_path)
        copied.append(filename)

    return copied


# ── Build Trip JSON ──────────────────────────────────────────────────
def build_trip_json(trip_id, fm, sections, gpx_track):
    """Convert parsed data into the web JSON format."""
    # Parse locations from frontmatter
    locations = json.loads(fm.get("locations_json", "[]"))
    locations.sort(key=lambda loc: loc.get("sort", 0))

    # Build photo → section mapping
    photo_to_section = {}
    for sec in sections:
        for photo in sec["photos"]:
            photo_to_section[photo] = sec["title"]

    # Track which sections have had blog text assigned
    blog_assigned = set()

    # Build waypoints
    waypoints = []
    for loc in locations:
        # Determine section from first photo
        section_title = ""
        if loc.get("photos"):
            first_photo_fn = loc["photos"][0].get("filename", "")
            section_title = photo_to_section.get(first_photo_fn, "")

        # Assign blog text to first location in each section
        blog = ""
        if section_title and section_title not in blog_assigned:
            for sec in sections:
                if sec["title"] == section_title and sec["blog"]:
                    blog = sec["blog"]
                    blog_assigned.add(section_title)
                    break

        # Transform photos
        photos = []
        for p in loc.get("photos", []):
            photos.append({
                "id": p.get("id", ""),
                "imageUrl": f"/images/hiking-journal/{trip_id}/{p['filename']}",
                "title": p.get("title", "")
            })

        waypoints.append({
            "id": loc.get("id", ""),
            "title": loc.get("title", ""),
            "sectionTitle": section_title,
            "lat": loc.get("lat"),
            "lng": loc.get("lng"),
            "alt": loc.get("alt"),
            "blog": blog,
            "photos": photos
        })

    # Parse stats
    distance_km = float(fm.get("distance_km", 0))
    elevation_gain = int(float(fm.get("elevation_gain", 0)))
    elevation_loss = int(float(fm.get("elevation_loss", 0)))

    # Map style: frontmatter uses underscores, web uses hyphens
    map_style = fm.get("map_style", "opentopomap")

    return {
        "version": 5,
        "name": fm.get("name", trip_id),
        "description": fm.get("description", ""),
        "region": fm.get("region", ""),
        "date": fm.get("date", ""),
        "mapStyle": map_style,
        "stats": {
            "distanceKm": distance_km,
            "elevationGainM": elevation_gain,
            "elevationLossM": elevation_loss
        },
        "gpxTrack": gpx_track,
        "waypoints": waypoints
    }


# ── Sync a Single Trip ──────────────────────────────────────────────
def sync_trip(trip_dir, trip_id):
    """Process one trip folder and return summary for trips.json."""
    # Find the markdown file
    md_files = glob.glob(os.path.join(trip_dir, "*.md"))
    if not md_files:
        print(f"  [SKIP] No .md file found in {trip_id}")
        return None

    md_path = md_files[0]
    print(f"  Parsing {os.path.basename(md_path)}...")

    with open(md_path, "r", encoding="utf-8") as f:
        md_text = f.read()

    fm, body = parse_frontmatter(md_text)
    sections = parse_sections(body)

    # Parse routes to find GPX file
    routes = json.loads(fm.get("routes_json", "[]"))
    gpx_track = []
    if routes:
        gpx_filename = routes[0].get("gpx", "")
        if gpx_filename:
            gpx_path = os.path.join(trip_dir, gpx_filename)
            if os.path.exists(gpx_path):
                gpx_track = parse_gpx(gpx_path)
                print(f"  Parsed GPX: {len(gpx_track)} points")
            else:
                print(f"  [WARN] GPX file not found: {gpx_filename}")

    # Build trip JSON
    trip_json = build_trip_json(trip_id, fm, sections, gpx_track)

    # Write trip JSON
    os.makedirs(DATA_DIR, exist_ok=True)
    trip_json_path = os.path.join(DATA_DIR, f"{trip_id}.json")
    with open(trip_json_path, "w", encoding="utf-8") as f:
        json.dump(trip_json, f, indent=2, ensure_ascii=False)
    print(f"  Wrote {trip_id}.json ({len(trip_json['waypoints'])} waypoints)")

    # Sync photos
    src_photos = os.path.join(trip_dir, "photos")
    dest_photos = os.path.join(IMAGES_DIR, trip_id)
    copied = sync_photos(src_photos, dest_photos)
    if copied:
        print(f"  Copied {len(copied)} photos")
    else:
        print(f"  Photos up to date")

    # Calculate center point
    lats = [w["lat"] for w in trip_json["waypoints"] if w.get("lat")]
    lngs = [w["lng"] for w in trip_json["waypoints"] if w.get("lng")]
    center_lat = sum(lats) / len(lats) if lats else 0
    center_lng = sum(lngs) / len(lngs) if lngs else 0

    # Find cover image
    cover_image = None
    for wp in trip_json["waypoints"]:
        if wp.get("photos"):
            cover_image = wp["photos"][0]["imageUrl"]
            break

    return {
        "name": trip_json["name"],
        "region": trip_json["region"],
        "date": trip_json["date"],
        "description": trip_json["description"],
        "coverImage": cover_image,
        "file": f"{trip_id}.json",
        "lat": round(center_lat, 3),
        "lng": round(center_lng, 3),
        "stats": {
            "distanceKm": trip_json["stats"]["distanceKm"],
            "elevationGainM": trip_json["stats"]["elevationGainM"]
        }
    }


# ── Main ─────────────────────────────────────────────────────────────
def main():
    print("=== Hiking Journal Sync ===\n")
    print(f"Source:  {SRC_DIR}")
    print(f"Target:  {WEB_ROOT}\n")

    if not os.path.isdir(SRC_DIR):
        print(f"ERROR: Source directory not found: {SRC_DIR}")
        return

    # Find trip folders (directories that contain a .md file)
    trip_summaries = []
    for entry in sorted(os.listdir(SRC_DIR)):
        trip_dir = os.path.join(SRC_DIR, entry)
        if not os.path.isdir(trip_dir):
            continue
        # Check if it contains a markdown file
        if not glob.glob(os.path.join(trip_dir, "*.md")):
            continue

        print(f"[{entry}]")
        summary = sync_trip(trip_dir, entry)
        if summary:
            trip_summaries.append(summary)
        print()

    if not trip_summaries:
        print("No trips found to sync.")
        return

    # Load existing trips.json and merge
    trips_json_path = os.path.join(DATA_DIR, "trips.json")
    existing_trips = []
    if os.path.exists(trips_json_path):
        with open(trips_json_path, "r", encoding="utf-8") as f:
            existing_trips = json.load(f)

    # Keep entries not in source (e.g. kumano-kodo demo data)
    synced_files = {s["file"] for s in trip_summaries}
    preserved = [t for t in existing_trips if t.get("file") not in synced_files]

    # Merge: preserved entries + newly synced
    all_trips = preserved + trip_summaries
    # Sort by date descending
    all_trips.sort(key=lambda t: t.get("date", ""), reverse=True)

    with open(trips_json_path, "w", encoding="utf-8") as f:
        json.dump(all_trips, f, indent=2, ensure_ascii=False)

    print(f"Updated trips.json: {len(all_trips)} trips total")
    for t in all_trips:
        src = "synced" if t["file"] in synced_files else "preserved"
        print(f"  - {t['name']} ({src})")

    print("\nDone!")


if __name__ == "__main__":
    main()
