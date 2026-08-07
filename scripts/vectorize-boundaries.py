#!/usr/bin/env python3
"""
Boundary vectorization debug pipeline (v2).

Extracts colored boundary lines from congregation map images and produces
visual debug artifacts (masks, skeletons, overlays, preview HTML, report JSON).

Designed for memory-constrained environments — avoids loading extra copies of
full-resolution images and outputs preview-scale PNGs by default.

Usage:
    .venv-boundaries/bin/python scripts/vectorize-boundaries.py \
        --input public/maps/nanzih-1-89.png \
        --map-id nanzih \
        --output-dir public/maps/generated \
        --preview-scale 0.25
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import cv2
import numpy as np


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Extract colored boundary lines from a map image and "
                    "produce debug/preview artifacts.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("--input", required=True, type=Path,
                   help="Path to the source map PNG.")
    p.add_argument("--map-id", required=True,
                   help="Identifier used in output filenames (e.g. 'nanzih').")
    p.add_argument("--output-dir", type=Path, default=Path("public/maps/generated"),
                   help="Directory for all output artifacts (created if missing).")
    p.add_argument("--preview-scale", type=float, default=0.25,
                   help="Scale factor for preview-size outputs (default 0.25).")

    # --- colour-threshold knobs (HSV) ---
    g = p.add_argument_group("HSV threshold tuning")
    g.add_argument("--cyan-h-low", type=int, default=75,
                   help="Lower H for pale cyan (default 75).")
    g.add_argument("--cyan-h-high", type=int, default=100,
                   help="Upper H for pale cyan (default 100).")
    g.add_argument("--cyan-s-low", type=int, default=30,
                   help="Lower S for pale cyan (default 30).")
    g.add_argument("--cyan-s-high", type=int, default=180,
                   help="Upper S for pale cyan (default 180).")
    g.add_argument("--cyan-v-low", type=int, default=100,
                   help="Lower V for pale cyan (default 100).")
    g.add_argument("--cyan-v-high", type=int, default=255,
                   help="Upper V for pale cyan (default 255).")

    g.add_argument("--purple-h-low", type=int, default=120,
                   help="Lower H for blue-purple / purple (default 120).")
    g.add_argument("--purple-h-high", type=int, default=170,
                   help="Upper H for blue-purple / purple (default 170).")
    g.add_argument("--purple-s-low", type=int, default=25,
                   help="Lower S for blue-purple / purple (default 25).")
    g.add_argument("--purple-s-high", type=int, default=255,
                   help="Upper S for blue-purple / purple (default 255).")
    g.add_argument("--purple-v-low", type=int, default=30,
                   help="Lower V for blue-purple / purple (default 30).")
    g.add_argument("--purple-v-high", type=int, default=255,
                   help="Upper V for blue-purple / purple (default 255).")

    # --- morphology knobs ---
    g2 = p.add_argument_group("Morphology tuning")
    g2.add_argument("--close-kernel", type=int, default=3,
                    help="Kernel size for morphological close (default 3).")
    g2.add_argument("--open-kernel", type=int, default=3,
                    help="Kernel size for morphological open (default 3).")
    g2.add_argument("--min-object-area", type=int, default=100,
                    help="Remove connected components smaller than this (px, default 100).")
    g2.add_argument("--dilate-iterations", type=int, default=1,
                    help="Dilation iterations on clean mask (default 1).")
    g2.add_argument("--erode-iterations", type=int, default=1,
                    help="Erosion iterations on clean mask (default 1, applied after dilate).")

    # --- line simplification knobs ---
    g3 = p.add_argument_group("Line simplification (v3 compact JSON)")
    g3.add_argument("--line-simplify-tolerance", type=float, default=2.0,
                    help="Ramer-Douglas-Peucker epsilon in px (default 2.0).")
    g3.add_argument("--line-min-points", type=int, default=2,
                    help="Minimum points per line after simplification (default 2).")
    g3.add_argument("--line-min-length", type=float, default=8.0,
                    help="Minimum approximate Euclidean path length in px (default 8.0).")
    g3.add_argument("--no-geojson", action="store_true",
                    help="Skip verbose GeoJSON output.")

    return p.parse_args(argv)


# ---------------------------------------------------------------------------
# Image loading
# ---------------------------------------------------------------------------

def load_image(path: Path) -> np.ndarray:
    """Read image as BGR (cv2 default). Raise on failure."""
    if not path.exists():
        raise FileNotFoundError(f"Input image not found: {path}")
    img = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if img is None:
        raise IOError(f"cv2 could not read image: {path}")
    return img


# ---------------------------------------------------------------------------
# Mask building
# ---------------------------------------------------------------------------

def _hsv_range_mask(hsv: np.ndarray,
                    h_lo: int, h_hi: int,
                    s_lo: int, s_hi: int,
                    v_lo: int, v_hi: int) -> np.ndarray:
    return cv2.inRange(
        hsv,
        np.array([h_lo, s_lo, v_lo], dtype=np.uint8),
        np.array([h_hi, s_hi, v_hi], dtype=np.uint8),
    )


def build_mask(bgr: np.ndarray, args: argparse.Namespace) -> np.ndarray:
    """Create combined binary mask for boundary colours (cyan + blue-purple)."""
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)

    # Pale cyan
    cyan = _hsv_range_mask(
        hsv,
        args.cyan_h_low, args.cyan_h_high,
        args.cyan_s_low, args.cyan_s_high,
        args.cyan_v_low, args.cyan_v_high,
    )

    # Blue-purple / purple
    purple = _hsv_range_mask(
        hsv,
        args.purple_h_low, args.purple_h_high,
        args.purple_s_low, args.purple_s_high,
        args.purple_v_low, args.purple_v_high,
    )

    combined = cv2.bitwise_or(cyan, purple)
    return combined


# ---------------------------------------------------------------------------
# Mask cleaning
# ---------------------------------------------------------------------------

def clean_mask(mask: np.ndarray, args: argparse.Namespace) -> np.ndarray:
    """Remove small objects, close/open, dilate/erode."""
    from skimage.morphology import remove_small_objects

    # Boolean array for skimage
    bool_mask = mask.astype(bool)
    # max_size removes objects with <= max_size pixels.
    # We want to remove objects strictly smaller than min_object_area.
    bool_mask = remove_small_objects(bool_mask, max_size=args.min_object_area - 1)
    cleaned = (bool_mask.astype(np.uint8)) * 255

    k_close = args.close_kernel
    k_open = args.open_kernel

    if k_close > 0:
        kc = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k_close, k_close))
        cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_CLOSE, kc)

    if k_open > 0:
        ko = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k_open, k_open))
        cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_OPEN, ko)

    # Optional dilation then erosion (controlled, not aggressive)
    k3 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    if args.dilate_iterations > 0:
        cleaned = cv2.dilate(cleaned, k3, iterations=args.dilate_iterations)
    if args.erode_iterations > 0:
        cleaned = cv2.erode(cleaned, k3, iterations=args.erode_iterations)

    return cleaned


# ---------------------------------------------------------------------------
# Skeletonisation
# ---------------------------------------------------------------------------

def make_skeleton(clean_mask: np.ndarray) -> np.ndarray:
    """Thin the clean mask to a 1-pixel-wide skeleton."""
    from skimage.morphology import skeletonize

    skel_bool = skeletonize(clean_mask.astype(bool))
    return (skel_bool.astype(np.uint8)) * 255


# ---------------------------------------------------------------------------
# Lightweight skeleton → line segments (optional GeoJSON)
# ---------------------------------------------------------------------------

def skeleton_to_line_segments(skel: np.ndarray):
    """
    Extract ordered pixel-coordinate line segments from a binary skeleton image.

    Returns a list of polylines, each polyline is [[x, y], ...] in original
    image coordinates. This traces graph edges between endpoints/junctions and
    avoids the unordered BFS traversal that creates visual spaghetti in Canvas.
    """
    coords = np.argwhere(skel > 0)  # (row, col) = (y, x)
    if len(coords) == 0:
        return []

    skel_set: set[tuple[int, int]] = {(int(r), int(c)) for r, c in coords}
    nbr_offsets = [(-1, -1), (-1, 0), (-1, 1),
                   (0, -1),           (0, 1),
                   (1, -1),  (1, 0),  (1, 1)]

    def neighbors(rc: tuple[int, int]) -> list[tuple[int, int]]:
        r, c = rc
        return [(r + dr, c + dc) for dr, dc in nbr_offsets
                if (r + dr, c + dc) in skel_set]

    degree_cache: dict[tuple[int, int], int] = {}

    def degree(rc: tuple[int, int]) -> int:
        if rc not in degree_cache:
            degree_cache[rc] = len(neighbors(rc))
        return degree_cache[rc]

    def edge_key(a: tuple[int, int], b: tuple[int, int]) -> tuple[tuple[int, int], tuple[int, int]]:
        return (a, b) if a <= b else (b, a)

    keypoints = {p for p in skel_set if degree(p) != 2}
    visited_edges: set[tuple[tuple[int, int], tuple[int, int]]] = set()
    segments: list[list[list[int]]] = []

    def append_path(path: list[tuple[int, int]]):
        if len(path) >= 2:
            segments.append([[int(c), int(r)] for r, c in path])

    def trace_from(start: tuple[int, int], nxt: tuple[int, int]) -> list[tuple[int, int]]:
        path = [start, nxt]
        visited_edges.add(edge_key(start, nxt))
        prev, cur = start, nxt
        while cur not in keypoints and degree(cur) == 2:
            cands = [n for n in neighbors(cur) if n != prev]
            if not cands:
                break
            nn = cands[0]
            ek = edge_key(cur, nn)
            if ek in visited_edges:
                break
            visited_edges.add(ek)
            path.append(nn)
            prev, cur = cur, nn
        return path

    # Trace all graph edges that start/end at endpoints or junctions.
    for kp in sorted(keypoints):
        for nb in neighbors(kp):
            if edge_key(kp, nb) in visited_edges:
                continue
            append_path(trace_from(kp, nb))

    # Trace remaining closed loops where every pixel has degree 2.
    for p in sorted(skel_set):
        for nb in neighbors(p):
            if edge_key(p, nb) in visited_edges:
                continue
            path = [p, nb]
            visited_edges.add(edge_key(p, nb))
            prev, cur = p, nb
            while True:
                cands = [n for n in neighbors(cur) if n != prev]
                if not cands:
                    break
                nn = cands[0]
                ek = edge_key(cur, nn)
                if ek in visited_edges:
                    if nn == p:
                        path.append(nn)
                    break
                visited_edges.add(ek)
                path.append(nn)
                prev, cur = cur, nn
            append_path(path)

    return segments


def write_geojson(segments: list, output_path: Path, img_w: int, img_h: int):
    """Write line segments as a FeatureCollection in pixel coordinates."""
    features = []
    for i, seg in enumerate(segments):
        if len(seg) < 2:
            continue
        features.append({
            "type": "Feature",
            "id": i,
            "geometry": {
                "type": "LineString",
                "coordinates": seg,
            },
            "properties": {
                "segment_id": i,
                "point_count": len(seg),
            },
        })

    geojson = {
        "type": "FeatureCollection",
        "crs": {
            "type": "name",
            "properties": {
                "name": "pixel-coordinates",
                "image_width": img_w,
                "image_height": img_h,
            },
        },
        "features": features,
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)


# ---------------------------------------------------------------------------
# Compact simplified line JSON (v3)
# ---------------------------------------------------------------------------

def _path_length(pts: list[list[int]]) -> float:
    """Approximate Euclidean path length for a list of [x, y] points."""
    total = 0.0
    for i in range(1, len(pts)):
        dx = pts[i][0] - pts[i - 1][0]
        dy = pts[i][1] - pts[i - 1][1]
        total += (dx * dx + dy * dy) ** 0.5
    return total


def _rdp(pts: list[list[int]], epsilon: float) -> list[list[int]]:
    """Ramer-Douglas-Peucker simplification (iterative). Always keeps endpoints."""
    n = len(pts)
    if n <= 2:
        return list(pts)

    keep = [False] * n
    keep[0] = True
    keep[-1] = True

    stack = [(0, n - 1)]
    while stack:
        start_idx, end_idx = stack.pop()
        if end_idx - start_idx < 2:
            continue

        start = pts[start_idx]
        end = pts[end_idx]
        dx = end[0] - start[0]
        dy = end[1] - start[1]
        line_len_sq = dx * dx + dy * dy

        max_dist = 0.0
        max_idx = start_idx
        for i in range(start_idx + 1, end_idx):
            if line_len_sq == 0:
                d = ((pts[i][0] - start[0]) ** 2 + (pts[i][1] - start[1]) ** 2) ** 0.5
            else:
                t = ((pts[i][0] - start[0]) * dx + (pts[i][1] - start[1]) * dy) / line_len_sq
                t = max(0.0, min(1.0, t))
                proj_x = start[0] + t * dx
                proj_y = start[1] + t * dy
                d = ((pts[i][0] - proj_x) ** 2 + (pts[i][1] - proj_y) ** 2) ** 0.5
            if d > max_dist:
                max_dist = d
                max_idx = i

        if max_dist > epsilon:
            keep[max_idx] = True
            stack.append((start_idx, max_idx))
            stack.append((max_idx, end_idx))

    return [pts[i] for i in range(n) if keep[i]]


def simplify_segments(segments: list[list[list[int]]],
                      tolerance: float,
                      min_points: int,
                      min_length: float) -> list[list[list[int]]]:
    """Simplify line segments via RDP, then filter by point count and path length."""
    result = []
    for seg in segments:
        simplified = _rdp(seg, tolerance)
        if len(simplified) < min_points:
            continue
        if _path_length(simplified) < min_length:
            continue
        result.append(simplified)
    return result


def write_compact_line_json(segments: list[list[list[int]]],
                            output_path: Path,
                            map_id: str,
                            source_name: str,
                            img_w: int, img_h: int,
                            simplify_tolerance: float) -> dict:
    """Write the v3 compact line JSON. Returns summary metadata dict."""
    total_pts = sum(len(s) for s in segments)
    data = {
        "version": 1,
        "mapId": map_id,
        "source": source_name,
        "imageSize": [img_w, img_h],
        "units": "px",
        "encoding": "polyline-xy-array",
        "simplifyTolerance": simplify_tolerance,
        "lineCount": len(segments),
        "pointCount": total_pts,
        "lines": segments,
    }
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    return {
        "line_count": len(segments),
        "point_count": total_pts,
        "file_size": output_path.stat().st_size,
    }


# ---------------------------------------------------------------------------
# Canvas preview HTML (v3)
# ---------------------------------------------------------------------------

def save_canvas_preview_html(map_id: str, output_dir: Path,
                             json_filename: str, source_filename: str,
                             src_w: int, src_h: int) -> Path:
    """Generate an HTML page that loads the source image + compact JSON and
    draws vector lines on a <canvas>."""
    html_fn = f"{map_id}-boundary-lines-canvas-preview-v3.html"
    html_path = output_dir / html_fn

    # Compute relative path from generated/ back to public/maps/
    img_src = f"../{source_filename}"

    html = f"""<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Boundary Lines Canvas Preview — {map_id}</title>
<style>
  body {{ font-family: system-ui, sans-serif; margin: 1rem; background: #1a1a2e; color: #eee; }}
  h1 {{ font-size: 1.1rem; }}
  #info {{ font-size: 0.8rem; color: #aaa; margin-bottom: 0.5rem; }}
  .controls {{ margin: 0.5rem 0; }}
  .controls label {{ margin-right: 1rem; font-size: 0.85rem; }}
  canvas {{ border: 1px solid #444; max-width: 100%; cursor: crosshair; }}
</style>
</head>
<body>
<h1>Boundary Lines — {map_id}</h1>
<div id="info">Loading …</div>
<div class="controls">
  <label>Stroke: <input type="color" id="strokeColor" value="#00ff88" /></label>
  <label>Width: <input type="range" id="strokeWidth" min="0.5" max="6" step="0.5" value="1.5" />
    <span id="widthVal">1.5</span>px</label>
  <label><input type="checkbox" id="showImage" checked /> Show image</label>
</div>
<canvas id="canvas"></canvas>

<script>
(async function() {{
  const jsonURL = "./{json_filename}";
  const imgURL  = "{img_src}";

  // --- Fetch data ---
  let data;
  try {{
    const resp = await fetch(jsonURL);
    if (!resp.ok) throw new Error(resp.statusText);
    data = await resp.json();
  }} catch (e) {{
    document.getElementById("info").textContent = "Failed to load JSON: " + e.message;
    return;
  }}

  const [imgW, imgH] = data.imageSize;
  const info = document.getElementById("info");
  info.textContent = `Lines: ${{data.lineCount}} | Points: ${{data.pointCount}} | `
    + `Image: ${{imgW}}×${{imgH}} | Tolerance: ${{data.simplifyTolerance}}px`;

  // --- Load image ---
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = imgURL;

  // --- Canvas setup ---
  // Render to a display-size canvas for browser performance, while preserving
  // original pixel coordinates in JSON. WebUI should apply the same scale.
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const maxDisplayW = Math.min(window.innerWidth - 32, 1400);
  const displayScale = maxDisplayW / imgW;
  const displayW = Math.round(imgW * displayScale);
  const displayH = Math.round(imgH * displayScale);
  canvas.width = displayW;
  canvas.height = displayH;

  const strokeColorEl = document.getElementById("strokeColor");
  const strokeWidthEl = document.getElementById("strokeWidth");
  const widthValEl    = document.getElementById("widthVal");
  const showImageEl   = document.getElementById("showImage");

  function draw() {{
    const color = strokeColorEl.value;
    const width = parseFloat(strokeWidthEl.value);
    const showImg = showImageEl.checked;

    ctx.clearRect(0, 0, displayW, displayH);

    if (showImg && img.complete && img.naturalWidth) {{
      ctx.globalAlpha = 0.5;
      ctx.drawImage(img, 0, 0, displayW, displayH);
      ctx.globalAlpha = 1.0;
    }}

    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.lineCap  = "round";

    for (const line of data.lines) {{
      if (line.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(line[0][0] * displayScale, line[0][1] * displayScale);
      for (let i = 1; i < line.length; i++) {{
        ctx.lineTo(line[i][0] * displayScale, line[i][1] * displayScale);
      }}
      ctx.stroke();
    }}
  }}

  strokeWidthEl.addEventListener("input", () => {{
    widthValEl.textContent = strokeWidthEl.value;
    draw();
  }});
  strokeColorEl.addEventListener("input", draw);
  showImageEl.addEventListener("change", draw);

  img.onload = draw;
  // Draw even if image fails
  img.onerror = draw;
  // If image is already cached
  if (img.complete) draw();
}})();
</script>
</body>
</html>"""
    html_path.write_text(html, encoding="utf-8")
    return html_path


# ---------------------------------------------------------------------------
# Overlay & preview helpers
# ---------------------------------------------------------------------------

def make_overlay(bgr: np.ndarray, clean: np.ndarray, skeleton: np.ndarray,
                 preview_scale: float) -> np.ndarray:
    """
    Draw clean boundary in red and skeleton in magenta over the original image,
    then resize to preview scale.
    """
    vis = bgr.copy()

    # Red boundary for clean mask
    vis[clean > 0] = (0, 0, 255)       # BGR: red

    # Magenta skeleton on top
    vis[skeleton > 0] = (255, 0, 255)   # BGR: magenta

    if preview_scale != 1.0:
        h, w = vis.shape[:2]
        new_w = max(1, int(w * preview_scale))
        new_h = max(1, int(h * preview_scale))
        vis = cv2.resize(vis, (new_w, new_h), interpolation=cv2.INTER_AREA)

    return vis


def _scale_mask(mask: np.ndarray, scale: float) -> np.ndarray:
    """Resize a single-channel mask."""
    if scale == 1.0:
        return mask
    h, w = mask.shape[:2]
    return cv2.resize(
        mask,
        (max(1, int(w * scale)), max(1, int(h * scale))),
        interpolation=cv2.INTER_NEAREST,
    )


# ---------------------------------------------------------------------------
# Preview HTML
# ---------------------------------------------------------------------------

def save_preview_html(map_id: str, output_dir: Path, filenames: dict,
                      src_w: int, src_h: int, preview_scale: float):
    """Generate a simple HTML preview page referencing generated PNGs."""
    pw = int(src_w * preview_scale)
    ph = int(src_h * preview_scale)

    layers = [
        ("Boundary mask", filenames["mask"], "Grayscale mask of detected boundary pixels"),
        ("Cleaned mask", filenames["clean"], "Mask after morphology + small-object removal"),
        ("Skeleton", filenames["skeleton"], "1-pixel-wide skeleton of cleaned boundaries"),
        ("Overlay", filenames["overlay"], f"Boundaries drawn over original (red=clean, magenta=skeleton, {pw}×{ph})"),
    ]

    layer_items = "\n".join(
        f'<li><a href="{fn}">{label}</a> — <small>{desc}</small></li>'
        for label, fn, desc in layers
    )

    geojson_link = ""
    if "geojson" in filenames:
        geojson_link = (
            f'<li><a href="{filenames["geojson"]}">Line segments GeoJSON</a> '
            f"— <small>skeleton traced to polylines (pixel coords)</small></li>"
        )

    html = f"""\
<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Boundary Debug Preview — {map_id}</title>
<style>
  body {{ font-family: system-ui, sans-serif; margin: 1.5rem; background: #f5f5f5; }}
  h1 {{ font-size: 1.2rem; }}
  h2 {{ font-size: 1rem; margin-top: 1.5rem; }}
  ul {{ padding-left: 1.2rem; }}
  li {{ margin-bottom: 0.4rem; }}
  img {{ max-width: 100%; border: 1px solid #ccc; margin: 0.5rem 0; }}
  .note {{ color: #666; font-size: 0.85rem; }}
</style>
</head>
<body>
<h1>Boundary Debug Preview — {map_id}</h1>
<p class="note">
  Source: {src_w}×{src_h} &nbsp;|&nbsp; Preview scale: {preview_scale} &nbsp;|&nbsp;
  Preview size: {pw}×{ph}
</p>

<h2>Output Layers</h2>
<ul>
{layer_items}
{geojson_link}
</ul>

<h2>Overlay Preview</h2>
<img src="{filenames['overlay']}" alt="Boundary overlay" />

<h2>Skeleton Preview</h2>
<img src="{filenames['skeleton']}" alt="Skeleton" />

<h2>Raw Mask</h2>
<img src="{filenames['mask']}" alt="Raw boundary mask" />

<h2>Cleaned Mask</h2>
<img src="{filenames['clean']}" alt="Cleaned boundary mask" />

</body>
</html>
"""
    html_path = output_dir / filenames["preview_html"]
    html_path.write_text(html, encoding="utf-8")
    return html_path


# ---------------------------------------------------------------------------
# Report JSON
# ---------------------------------------------------------------------------

def save_report(map_id: str, args: argparse.Namespace,
                src_h: int, src_w: int,
                mask_px: int, clean_px: int, skel_px: int,
                filenames: dict, output_paths: dict,
                compact_meta: dict | None = None) -> Path:
    report = {
        "map_id": map_id,
        "input": str(args.input),
        "source_dimensions": {"width": src_w, "height": src_h},
        "preview_scale": args.preview_scale,
        "thresholds": {
            "cyan_hsv": [
                [args.cyan_h_low, args.cyan_s_low, args.cyan_v_low],
                [args.cyan_h_high, args.cyan_s_high, args.cyan_v_high],
            ],
            "purple_hsv": [
                [args.purple_h_low, args.purple_s_low, args.purple_v_low],
                [args.purple_h_high, args.purple_s_high, args.purple_v_high],
            ],
        },
        "morphology": {
            "close_kernel": args.close_kernel,
            "open_kernel": args.open_kernel,
            "min_object_area": args.min_object_area,
            "dilate_iterations": args.dilate_iterations,
            "erode_iterations": args.erode_iterations,
        },
        "pixel_counts": {
            "raw_mask": int(mask_px),
            "clean_mask": int(clean_px),
            "skeleton": int(skel_px),
        },
        "output_files": {
            "mask": str(output_paths.get("mask", "")),
            "clean": str(output_paths.get("clean", "")),
            "skeleton": str(output_paths.get("skeleton", "")),
            "overlay": str(output_paths.get("overlay", "")),
            "preview_html": str(output_paths.get("preview_html", "")),
            "report": str(output_paths.get("report", "")),
        },
    }
    if "geojson" in output_paths:
        report["output_files"]["geojson"] = str(output_paths["geojson"])

    # v3 compact lines info
    if compact_meta:
        report["compact_lines"] = {
            "path": str(output_paths.get("compact_lines_json", "")),
            "line_count": compact_meta.get("line_count", 0),
            "point_count": compact_meta.get("point_count", 0),
            "simplify_tolerance": args.line_simplify_tolerance,
            "file_size": compact_meta.get("file_size", 0),
        }
        if "canvas_preview_html" in output_paths:
            report["compact_lines"]["canvas_preview"] = str(output_paths["canvas_preview_html"])

    report_path = args.output_dir / filenames["report"]
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    return report_path


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    # Validate input
    args.input = args.input.resolve()
    if not args.input.exists():
        print(f"ERROR: input not found: {args.input}", file=sys.stderr)
        return 1

    # Create output dir
    args.output_dir.mkdir(parents=True, exist_ok=True)

    # Filenames (deterministic)
    mid = args.map_id
    filenames = {
        "mask":         f"{mid}-boundary-mask-v2.png",
        "clean":        f"{mid}-boundary-clean-v2.png",
        "skeleton":     f"{mid}-boundary-skeleton-v2.png",
        "overlay":      f"{mid}-boundary-overlay-v2.png",
        "preview_html": f"{mid}-boundary-preview-v2.html",
        "report":       f"{mid}-boundary-report-v2.json",
        "compact_lines_json": f"{mid}-boundary-lines-simplified-v3.json",
        "canvas_preview_html": f"{mid}-boundary-lines-canvas-preview-v3.html",
    }

    # Step 1: Load image
    print(f"[1/9] Loading image: {args.input}")
    bgr = load_image(args.input)
    src_h, src_w = bgr.shape[:2]
    print(f"      Source dimensions: {src_w} × {src_h}")

    # Step 2: Build raw colour mask
    print("[2/9] Building colour mask …")
    raw_mask = build_mask(bgr, args)
    mask_px = int(np.count_nonzero(raw_mask))
    print(f"      Raw mask pixels: {mask_px:,}")

    # Step 3: Clean mask
    print("[3/9] Cleaning mask …")
    cleaned = clean_mask(raw_mask, args)
    clean_px = int(np.count_nonzero(cleaned))
    print(f"      Clean mask pixels: {clean_px:,}")

    # Step 4: Skeletonize
    print("[4/9] Skeletonizing …")
    skel = make_skeleton(cleaned)
    skel_px = int(np.count_nonzero(skel))
    print(f"      Skeleton pixels: {skel_px:,}")

    # Step 5: Generate outputs
    scale = args.preview_scale
    print(f"[5/9] Saving outputs (preview scale {scale}) …")

    # Build preview-scale versions before freeing full-res data
    # Save raw mask BEFORE del raw_mask
    raw_mask_prev = _scale_mask(raw_mask, scale)
    clean_prev = _scale_mask(cleaned, scale)
    skel_prev = _scale_mask(skel, scale)

    # Overlay (also at preview scale)
    overlay = make_overlay(bgr, cleaned, skel, scale)

    # Free full-res data to reclaim memory
    del raw_mask, bgr

    output_paths: dict[str, Path] = {}
    for key, fn in [("mask", filenames["mask"]),
                    ("clean", filenames["clean"]),
                    ("skeleton", filenames["skeleton"])]:
        output_paths[key] = args.output_dir / fn

    # Save mask/clean/skeleton at preview scale
    cv2.imwrite(str(output_paths["mask"]), raw_mask_prev)
    cv2.imwrite(str(output_paths["clean"]), clean_prev)
    cv2.imwrite(str(output_paths["skeleton"]), skel_prev)

    # Overlay
    overlay_path = args.output_dir / filenames["overlay"]
    cv2.imwrite(str(overlay_path), overlay)
    output_paths["overlay"] = overlay_path

    # Step 6: Extract line segments (shared by GeoJSON + compact JSON)
    print("[6/9] Extracting line segments from skeleton …")
    segments_raw: list = []
    try:
        segments_raw = skeleton_to_line_segments(skel)
        if segments_raw:
            raw_pts = sum(len(s) for s in segments_raw)
            print(f"      Raw segments: {len(segments_raw)}, points: {raw_pts}")
        else:
            print("      No segments extracted.")
    except Exception as exc:
        print(f"      Segment extraction failed ({exc})")

    # Step 7: GeoJSON (optional, can be skipped with --no-geojson)
    if not args.no_geojson and segments_raw:
        print("[7/9] Writing verbose GeoJSON …")
        try:
            geojson_fn = f"{mid}-boundary-lines-v2.geojson"
            geojson_path = args.output_dir / geojson_fn
            write_geojson(segments_raw, geojson_path, src_w, src_h)
            filenames["geojson"] = geojson_fn
            output_paths["geojson"] = geojson_path
            total_pts = sum(len(s) for s in segments_raw)
            print(f"      GeoJSON: {len(segments_raw)} segments, {total_pts} points")
        except Exception as exc:
            print(f"      GeoJSON write failed ({exc})")
    else:
        print("[7/9] GeoJSON skipped (--no-geojson or no segments).")

    # Step 8: Compact simplified line JSON + Canvas preview HTML (v3)
    print("[8/9] Writing compact line JSON & canvas preview (v3) …")
    compact_meta: dict = {}
    try:
        simplified = simplify_segments(
            segments_raw,
            tolerance=args.line_simplify_tolerance,
            min_points=args.line_min_points,
            min_length=args.line_min_length,
        )
        compact_path = args.output_dir / filenames["compact_lines_json"]
        compact_meta = write_compact_line_json(
            simplified, compact_path,
            map_id=mid,
            source_name=args.input.name,
            img_w=src_w, img_h=src_h,
            simplify_tolerance=args.line_simplify_tolerance,
        )
        output_paths["compact_lines_json"] = compact_path
        print(f"      Compact JSON: {compact_meta.get('line_count', 0)} lines, "
              f"{compact_meta.get('point_count', 0)} points, "
              f"{compact_meta.get('file_size', 0):,} bytes")

        # Canvas preview HTML
        canvas_path = save_canvas_preview_html(
            mid, args.output_dir,
            json_filename=filenames["compact_lines_json"],
            source_filename=args.input.name,
            src_w=src_w, src_h=src_h,
        )
        output_paths["canvas_preview_html"] = canvas_path
        print(f"      Canvas preview: {canvas_path.name}")
    except Exception as exc:
        print(f"      v3 output failed ({exc})")

    # Step 9: Report & preview HTML
    print("[9/9] Writing report & preview HTML …")
    output_paths["preview_html"] = args.output_dir / filenames["preview_html"]
    output_paths["report"] = args.output_dir / filenames["report"]

    save_preview_html(mid, args.output_dir, filenames, src_w, src_h, scale)
    save_report(mid, args, src_h, src_w, mask_px, clean_px, skel_px,
                filenames, output_paths,
                compact_meta=compact_meta)

    # Summary
    print()
    print("=" * 60)
    print(f"  Boundary vectorization v2+v3 complete — {mid}")
    print(f"  Source: {src_w}×{src_h}  |  Preview: {int(src_w*scale)}×{int(src_h*scale)}")
    print(f"  Pixels: raw={mask_px:,}  clean={clean_px:,}  skel={skel_px:,}")
    print(f"  Outputs written to: {args.output_dir}")
    for key, path in output_paths.items():
        print(f"    {key}: {path.name}")
    print("=" * 60)

    return 0


if __name__ == "__main__":
    sys.exit(main())
