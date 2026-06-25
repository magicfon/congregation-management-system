#!/usr/bin/env python3
"""
Polygonize extracted territory boundary lines into area JSON preview files.

This is intentionally preview-first: outputs go under public/maps/generated and do
not overwrite formal *-areas.json files.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import math
import sys
from pathlib import Path
from typing import Any

import cv2
import numpy as np


MAP_METADATA: dict[str, dict[str, int]] = {
    "nanzih": {"id_min": 1, "id_max": 89, "expected_count": 89},
    "chiaotou": {"id_min": 90, "id_max": 148, "expected_count": 59},
    "tzuguan": {"id_min": 149, "id_max": 213, "expected_count": 65},
}


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Create polygonized area preview from boundary-color mask or compact line JSON")
    p.add_argument("--input", type=Path, help="Source map PNG (required unless --input-lines given)")
    p.add_argument("--input-lines", type=Path,
                   help="Compact boundary-line JSON with encoding 'polyline-xy-array'. "
                        "Skips PNG colour extraction; rasterises lines directly as walls.")
    p.add_argument("--map-id", required=True, help="Map id, e.g. nanzih")
    p.add_argument("--output-dir", default=Path("public/maps/generated"), type=Path)
    p.add_argument("--reference-areas", type=Path, help="Existing app/editor areas JSON for id centers")
    p.add_argument("--expected-count", type=int, default=0)
    p.add_argument("--reference-id-min", type=int, default=0,
                   help="Optional lower bound for numeric reference area ids")
    p.add_argument("--reference-id-max", type=int, default=0,
                   help="Optional upper bound for numeric reference area ids")
    p.add_argument("--wall-dilate", type=int, default=7, help="Odd kernel size to thicken walls before flood-fill")
    p.add_argument("--border-thickness", type=int, default=8, help="Image border wall thickness")
    p.add_argument("--min-component-area", type=int, default=3000)
    p.add_argument("--simplify-epsilon", type=float, default=4.0)
    p.add_argument("--max-search-radius", type=int, default=80, help="Find nearest free pixel if reference center lands on boundary")
    p.add_argument("--vectorize-script", type=Path, default=Path("scripts/vectorize-boundaries.py"))
    # Mirror the current successful extraction defaults; exposed for tuning later.
    p.add_argument("--cyan-h-low", type=int, default=75)
    p.add_argument("--cyan-h-high", type=int, default=100)
    p.add_argument("--cyan-s-low", type=int, default=30)
    p.add_argument("--cyan-s-high", type=int, default=180)
    p.add_argument("--cyan-v-low", type=int, default=100)
    p.add_argument("--cyan-v-high", type=int, default=255)
    p.add_argument("--purple-h-low", type=int, default=120)
    p.add_argument("--purple-h-high", type=int, default=170)
    p.add_argument("--purple-s-low", type=int, default=25)
    p.add_argument("--purple-s-high", type=int, default=255)
    p.add_argument("--purple-v-low", type=int, default=30)
    p.add_argument("--purple-v-high", type=int, default=255)
    p.add_argument("--close-kernel", type=int, default=3)
    p.add_argument("--open-kernel", type=int, default=3)
    p.add_argument("--min-object-area", type=int, default=100)
    p.add_argument("--dilate-iterations", type=int, default=1)
    p.add_argument("--erode-iterations", type=int, default=1)
    # v2 endpoint repair options
    p.add_argument("--version-suffix", type=str, default="v2",
                   help="Version suffix for output filenames (default v2)")
    g = p.add_argument_group("Endpoint repair (v2 topology)")
    g.add_argument("--endpoint-repair-radius", type=int, default=30,
                   help="Max pixel distance to connect skeleton endpoints (0 = disable, default 30)")
    g.add_argument("--endpoint-repair-max-links", type=int, default=3000,
                   help="Max number of endpoint links to add (default 3000)")
    g.add_argument("--endpoint-direction-window", type=int, default=7,
                   help="Window size in px for estimating endpoint tangent direction (default 7)")
    g.add_argument("--endpoint-angle-tolerance", type=float, default=150.0,
                   help="Max angle in degrees between two endpoint directions to consider compatible (default 150)")
    p.add_argument("--seeded-watershed", action="store_true",
                   help="v2: force one polygon per reference center using watershed constrained by boundary walls")
    return p.parse_args()


def load_vectorize_module(path: Path):
    spec = importlib.util.spec_from_file_location("vectorize_boundaries", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load vectorize script: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def normalize_reference_area(area: dict[str, Any]) -> dict[str, Any] | None:
    if "id" not in area or "center" not in area:
        return None
    center = area["center"]
    if not isinstance(center, list) or len(center) < 2:
        return None
    # Existing map JSON stores coordinates as [y, x]; area-marker converts to {x:center[1], y:center[0]}.
    y, x = float(center[0]), float(center[1])
    return {"id": area["id"], "x": x, "y": y}


def load_reference_centers(path: Path | None, id_min: int = 0, id_max: int = 0) -> list[dict[str, Any]]:
    if not path:
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    areas = data.get("areas", []) if isinstance(data, dict) else []
    refs = []
    seen = set()
    for area in areas:
        ref = normalize_reference_area(area)
        if not ref:
            continue
        try:
            num_id = int(ref["id"])
        except Exception:
            num_id = None
        if num_id is not None and (id_min > 0 or id_max > 0):
            if id_min > 0 and num_id < id_min:
                continue
            if id_max > 0 and num_id > id_max:
                continue
        if ref["id"] in seen:
            continue
        seen.add(ref["id"])
        refs.append(ref)
    refs.sort(key=lambda r: int(r["id"]) if str(r["id"]).isdigit() else str(r["id"]))
    return refs


def nearest_label(label_img: np.ndarray, x: int, y: int, max_radius: int) -> tuple[int, int, int] | None:
    h, w = label_img.shape
    x = min(max(x, 0), w - 1)
    y = min(max(y, 0), h - 1)
    label = int(label_img[y, x])
    if label > 0:
        return label, x, y
    for r in range(1, max_radius + 1):
        x0, x1 = max(0, x - r), min(w - 1, x + r)
        y0, y1 = max(0, y - r), min(h - 1, y + r)
        candidates = []
        # sample square ring
        for xx in range(x0, x1 + 1):
            candidates.append((xx, y0))
            candidates.append((xx, y1))
        for yy in range(y0 + 1, y1):
            candidates.append((x0, yy))
            candidates.append((x1, yy))
        best = None
        best_d = 1e18
        for xx, yy in candidates:
            lab = int(label_img[yy, xx])
            if lab <= 0:
                continue
            d = (xx - x) ** 2 + (yy - y) ** 2
            if d < best_d:
                best_d = d
                best = (lab, xx, yy)
        if best:
            return best
    return None


def nearest_free_pixel(free_mask: np.ndarray, x: int, y: int, max_radius: int) -> tuple[int, int] | None:
    """Return nearest (x,y) inside a boolean free-space mask."""
    h, w = free_mask.shape
    x = min(max(x, 0), w - 1)
    y = min(max(y, 0), h - 1)
    if free_mask[y, x]:
        return x, y
    for r in range(1, max_radius + 1):
        x0, x1 = max(0, x - r), min(w - 1, x + r)
        y0, y1 = max(0, y - r), min(h - 1, y + r)
        best = None
        best_d = 1e18
        for xx in range(x0, x1 + 1):
            for yy in (y0, y1):
                if free_mask[yy, xx]:
                    d = (xx - x) ** 2 + (yy - y) ** 2
                    if d < best_d:
                        best_d, best = d, (xx, yy)
        for yy in range(y0 + 1, y1):
            for xx in (x0, x1):
                if free_mask[yy, xx]:
                    d = (xx - x) ** 2 + (yy - y) ** 2
                    if d < best_d:
                        best_d, best = d, (xx, yy)
        if best:
            return best
    return None


def component_polygon(label_img: np.ndarray, label: int, simplify_epsilon: float) -> tuple[list[list[float]], list[float], float] | None:
    mask = (label_img == label).astype(np.uint8) * 255
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    contour = max(contours, key=cv2.contourArea)
    area = float(cv2.contourArea(contour))
    if area <= 0:
        return None
    if simplify_epsilon > 0:
        contour = cv2.approxPolyDP(contour, simplify_epsilon, True)
    pts_xy = contour.reshape(-1, 2)
    if len(pts_xy) < 3:
        return None
    m = cv2.moments(contour)
    if m["m00"]:
        cx, cy = float(m["m10"] / m["m00"]), float(m["m01"] / m["m00"])
    else:
        cx, cy = float(np.mean(pts_xy[:, 0])), float(np.mean(pts_xy[:, 1]))
    # App/editor import format uses [y, x].
    polygon_yx = [[float(y), float(x)] for x, y in pts_xy]
    center_yx = [cy, cx]
    return polygon_yx, center_yx, area


def nearest_free_pixel_unoccupied(
    free_mask: np.ndarray,
    occupied: np.ndarray,
    x: int,
    y: int,
    max_radius: int,
) -> tuple[int, int] | None:
    """Return nearest free, unoccupied (x,y) pixel.

    Seeded watershed previously allowed multiple reference centers to collapse onto
    the same nearest free pixel when a center landed on a thickened wall. Later
    markers overwrote earlier ones, so output counts could be far below the number
    of reference centers. Keep seeds unique by rejecting occupied pixels.
    """
    h, w = free_mask.shape
    x = min(max(x, 0), w - 1)
    y = min(max(y, 0), h - 1)
    if free_mask[y, x] and not occupied[y, x]:
        return x, y
    for r in range(1, max_radius + 1):
        x0, x1 = max(0, x - r), min(w - 1, x + r)
        y0, y1 = max(0, y - r), min(h - 1, y + r)
        best = None
        best_d = 1e18
        for xx in range(x0, x1 + 1):
            for yy in (y0, y1):
                if free_mask[yy, xx] and not occupied[yy, xx]:
                    d = (xx - x) ** 2 + (yy - y) ** 2
                    if d < best_d:
                        best_d, best = d, (xx, yy)
        for yy in range(y0 + 1, y1):
            for xx in (x0, x1):
                if free_mask[yy, xx] and not occupied[yy, xx]:
                    d = (xx - x) ** 2 + (yy - y) ** 2
                    if d < best_d:
                        best_d, best = d, (xx, yy)
        if best:
            return best
    return None


def build_seeded_watershed_labels(
    free_mask: np.ndarray,
    wall_mask: np.ndarray,
    refs: list[dict[str, Any]],
    max_search_radius: int,
) -> tuple[np.ndarray, dict[str, Any]]:
    """Split free space into one region per reference center, constrained by boundary walls.

    This is a pragmatic v2 fallback when boundary topology is not closed enough for
    pure connected components. Existing purple/cyan boundaries act as hard walls;
    within each still-merged component, reference centers partition the component.

    The implementation runs watershed per connected free-space component instead
    of on the full image. Components with one seed are assigned directly. This is
    much faster on large maps and avoids global marker collisions.
    """
    from scipy import ndimage as ndi

    markers = np.zeros(free_mask.shape, dtype=np.int32)
    occupied = np.zeros(free_mask.shape, dtype=bool)
    seed_stats = {
        "seeded": 0,
        "unseeded": 0,
        "movedSeeds": 0,
        "seedIds": [],
        "seedCollisionsAvoided": 0,
        "componentWatersheds": 0,
        "singleSeedComponents": 0,
    }
    for idx, ref in enumerate(refs, start=1):
        x0, y0 = int(round(ref["x"])), int(round(ref["y"]))
        naive = nearest_free_pixel(free_mask, x0, y0, max_search_radius)
        found = nearest_free_pixel_unoccupied(free_mask, occupied, x0, y0, max_search_radius)
        if not found:
            seed_stats["unseeded"] += 1
            continue
        x, y = found
        if naive and naive != found:
            seed_stats["seedCollisionsAvoided"] += 1
        if (x, y) != (x0, y0):
            seed_stats["movedSeeds"] += 1
        markers[y, x] = idx
        occupied[y, x] = True
        seed_stats["seeded"] += 1
        seed_stats["seedIds"].append(ref["id"])

    labels_out = np.zeros(free_mask.shape, dtype=np.int32)
    num_components, component_labels, component_stats, _ = cv2.connectedComponentsWithStats(
        free_mask.astype(np.uint8), connectivity=4
    )

    for component_id in range(1, num_components):
        x = int(component_stats[component_id, cv2.CC_STAT_LEFT])
        y = int(component_stats[component_id, cv2.CC_STAT_TOP])
        w = int(component_stats[component_id, cv2.CC_STAT_WIDTH])
        h = int(component_stats[component_id, cv2.CC_STAT_HEIGHT])
        comp_slice = np.s_[y:y + h, x:x + w]
        comp_mask = component_labels[comp_slice] == component_id
        comp_markers = markers[comp_slice] * comp_mask
        marker_ids = np.unique(comp_markers[comp_markers > 0])
        if len(marker_ids) == 0:
            continue
        if len(marker_ids) == 1:
            out_view = labels_out[comp_slice]
            out_view[comp_mask] = int(marker_ids[0])
            seed_stats["singleSeedComponents"] += 1
            continue

        # Component-local seeded Voronoi: assign every free pixel in this merged
        # component to the nearest reference seed. This guarantees that all seeds
        # get an area even when the extracted wall network is not fully closed.
        # The assignment is constrained to free-space pixels so detected walls
        # remain holes/boundaries in the preview polygons.
        nearest_y, nearest_x = ndi.distance_transform_edt(
            comp_markers == 0,
            return_distances=False,
            return_indices=True,
        )
        comp_labels = comp_markers[nearest_y, nearest_x]
        comp_labels = np.where(comp_mask, comp_labels, 0)
        out_view = labels_out[comp_slice]
        out_view[comp_labels > 0] = comp_labels[comp_labels > 0]
        seed_stats["componentWatersheds"] += 1

    return labels_out.astype(np.int32), seed_stats


def make_preview_html(map_id: str, source_name: str, areas_json_name: str, report_name: str, out: Path) -> None:
    html = f"""<!DOCTYPE html>
<html lang=\"zh-TW\">
<head>
<meta charset=\"UTF-8\">
<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
<title>{map_id} polygonize preview</title>
<style>
body {{ margin: 16px; background: #0f172a; color: #e2e8f0; font-family: system-ui, sans-serif; }}
canvas {{ max-width: 100%; border: 1px solid #334155; background: #111827; }}
.controls {{ margin: 8px 0 12px; display:flex; gap: 12px; flex-wrap: wrap; }}
label {{ font-size: 13px; }}
</style>
</head>
<body>
<h1>{map_id} polygonize preview</h1>
<div id=\"info\">Loading…</div>
<div class=\"controls\">
  <label><input type=\"checkbox\" id=\"showImage\" checked> 顯示底圖</label>
  <label><input type=\"checkbox\" id=\"showFill\" checked> 顯示區域填色</label>
  <label><input type=\"checkbox\" id=\"showLabels\" checked> 顯示編號</label>
  <a href=\"{areas_json_name}\" style=\"color:#93c5fd\">areas JSON</a>
  <a href=\"{report_name}\" style=\"color:#93c5fd\">report</a>
</div>
<canvas id=\"canvas\"></canvas>
<script>
(async function() {{
  const [img, data] = await Promise.all([
    new Promise(resolve => {{ const im = new Image(); im.onload=()=>resolve(im); im.src='../{source_name}'; }}),
    fetch('{areas_json_name}', {{cache:'no-cache'}}).then(r=>r.json())
  ]);
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const scale = Math.min((window.innerWidth - 48) / img.width, 1400 / img.width, 1);
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  document.getElementById('info').textContent = `areas: ${{data.areas.length}} | source: ${{img.width}}×${{img.height}} | scale: ${{scale.toFixed(3)}}`;
  function draw() {{
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if (document.getElementById('showImage').checked) {{ ctx.globalAlpha=0.55; ctx.drawImage(img,0,0,canvas.width,canvas.height); ctx.globalAlpha=1; }}
    for (const area of data.areas) {{
      const poly = area.polygon || [];
      if (poly.length < 3) continue;
      ctx.beginPath();
      ctx.moveTo(poly[0][1]*scale, poly[0][0]*scale);
      for (const p of poly.slice(1)) ctx.lineTo(p[1]*scale, p[0]*scale);
      ctx.closePath();
      if (document.getElementById('showFill').checked) {{ ctx.fillStyle='rgba(34,197,94,0.18)'; ctx.fill(); }}
      ctx.strokeStyle='#00ff88'; ctx.lineWidth=1.5; ctx.stroke();
      if (document.getElementById('showLabels').checked) {{
        ctx.fillStyle='rgba(15,23,42,0.85)'; ctx.strokeStyle='#fff';
        const x=area.center[1]*scale, y=area.center[0]*scale;
        ctx.beginPath(); ctx.arc(x,y,11,0,Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.fillStyle='#fff'; ctx.font='bold 12px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(String(area.id),x,y);
      }}
    }}
  }}
  document.querySelectorAll('input').forEach(el=>el.addEventListener('change', draw));
  draw();
}})().catch(e=>{{ document.getElementById('info').textContent = 'ERROR: '+e.message; console.error(e); }});
</script>
</body>
</html>"""
    out.write_text(html, encoding="utf-8")


def find_skeleton_endpoints(skel: np.ndarray) -> list[tuple[int, int]]:
    """Find degree-1 pixels (endpoints) on a binary skeleton image."""
    from scipy import ndimage as ndi
    # 8-connected neighbor count via convolution
    kernel = np.array([[1, 1, 1],
                       [1, 0, 1],
                       [1, 1, 1]], dtype=np.uint8)
    neighbor_count = ndi.convolve((skel > 0).astype(np.uint8), kernel, mode="constant", cval=0)
    # Endpoints: skeleton pixel with exactly 1 neighbor
    endpoint_mask = (skel > 0) & (neighbor_count == 1)
    ys, xs = np.where(endpoint_mask)
    return [(int(y), int(x)) for y, x in zip(ys, xs)]


def _endpoint_direction(skel: np.ndarray, pt: tuple[int, int], window: int) -> tuple[float, float]:
    """Estimate tangent direction at an endpoint by walking along the skeleton.
    
    Returns unit direction vector (dx, dy) pointing *into* the skeleton (away from the tip).
    """
    h, w = skel.shape
    y0, x0 = pt
    skel_set = skel > 0

    path = [(y0, x0)]
    visited = {(y0, x0)}
    cur = pt

    for _ in range(window):
        cy, cx = cur
        best = None
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dy == 0 and dx == 0:
                    continue
                ny, nx = cy + dy, cx + dx
                if 0 <= ny < h and 0 <= nx < w and skel_set[ny, nx] and (ny, nx) not in visited:
                    best = (ny, nx)
                    break
            if best:
                break
        if best is None:
            break
        visited.add(best)
        path.append(best)
        cur = best

    if len(path) < 2:
        return (0.0, 0.0)

    # Direction from endpoint into skeleton
    ey, ex = path[-1]
    dy = float(ey - y0)
    dx = float(ex - x0)
    length = (dx * dx + dy * dy) ** 0.5
    if length < 1e-9:
        return (0.0, 0.0)
    return (dx / length, dy / length)


def repair_endpoints(
    skel: np.ndarray,
    wall_mask: np.ndarray,
    max_radius: int,
    max_links: int,
    direction_window: int,
    angle_tolerance_deg: float,
) -> tuple[np.ndarray, dict[str, int]]:
    """Connect nearby compatible skeleton endpoints by drawing lines on wall_mask.

    Returns (updated wall_mask, stats_dict) with stats including endpoint count and links added.
    """
    stats: dict[str, int] = {
        "endpointCount": 0,
        "linksAdded": 0,
        "linksSkippedAngle": 0,
        "linksSkippedMaxLinks": 0,
    }

    if max_radius <= 0:
        return wall_mask, stats

    endpoints = find_skeleton_endpoints(skel)
    stats["endpointCount"] = len(endpoints)

    if not endpoints:
        return wall_mask, stats

    # Pre-compute directions for all endpoints
    directions: dict[tuple[int, int], tuple[float, float]] = {}
    for pt in endpoints:
        directions[pt] = _endpoint_direction(skel, pt, direction_window)

    # Build spatial index: bucket endpoints into grid cells of size max_radius
    cell_size = max_radius
    grid: dict[tuple[int, int], list[tuple[int, int]]] = {}
    for pt in endpoints:
        cy, cx = pt[0] // cell_size, pt[1] // cell_size
        grid.setdefault((cy, cx), []).append(pt)

    used: set[tuple[int, int]] = set()
    links_added = 0
    angle_tol_rad = math.radians(angle_tolerance_deg)

    for pt_a in endpoints:
        if pt_a in used:
            continue
        if links_added >= max_links:
            stats["linksSkippedMaxLinks"] += 1
            continue

        ay, ax = pt_a
        da = directions[pt_a]
        da_len = (da[0] ** 2 + da[1] ** 2) ** 0.5
        if da_len < 1e-9:
            continue

        gy, gx = ay // cell_size, ax // cell_size
        best_pt = None
        best_dist = float("inf")
        best_angle_ok = False

        # Check neighboring grid cells
        for dcy in range(-1, 2):
            for dcx in range(-1, 2):
                cell = (gy + dcy, gx + dcx)
                for pt_b in grid.get(cell, []):
                    if pt_b == pt_a or pt_b in used:
                        continue
                    by, bx = pt_b
                    dist = ((by - ay) ** 2 + (bx - ax) ** 2) ** 0.5
                    if dist > max_radius or dist >= best_dist:
                        continue

                    # Check angle compatibility
                    db = directions[pt_b]
                    db_len = (db[0] ** 2 + db[1] ** 2) ** 0.5
                    if db_len < 1e-9:
                        continue

                    # Dot product of the two direction vectors
                    dot = da[0] * db[0] + da[1] * db[1]
                    # Directions pointing away from tips should be roughly opposite
                    # for a natural connection, so we want dot < 0 (angle > 90°).
                    # But we also check the vector from a→b against both directions.
                    vab_dx = float(bx - ax)
                    vab_dy = float(by - ay)
                    vab_len = (vab_dx ** 2 + vab_dy ** 2) ** 0.5
                    if vab_len < 1e-9:
                        continue
                    vab_dx /= vab_len
                    vab_dy /= vab_len

                    # da should align with a→b, db should align with b→a (or close)
                    dot_a_ab = da[0] * vab_dx + da[1] * vab_dy
                    dot_b_ba = db[0] * (-vab_dx) + db[1] * (-vab_dy)

                    # Accept if both endpoint directions point towards each other
                    # (da · a→b > cos(angle_tolerance)) and (db · b→a > cos(angle_tolerance))
                    cos_tol = math.cos(angle_tol_rad)
                    angle_ok = dot_a_ab >= cos_tol and dot_b_ba >= cos_tol

                    if dist < best_dist:
                        best_dist = dist
                        best_pt = pt_b
                        best_angle_ok = angle_ok

        if best_pt is None:
            continue

        if not best_angle_ok:
            stats["linksSkippedAngle"] += 1
            # Still try the best candidate if distance is very short
            if best_dist > max_radius * 0.3:
                continue

        # Draw line on wall mask
        by, bx = best_pt
        cv2.line(wall_mask, (ax, ay), (bx, by), 255, thickness=1, lineType=cv2.LINE_8)
        used.add(pt_a)
        used.add(best_pt)
        links_added += 1

    stats["linksAdded"] = links_added
    return wall_mask, stats


def load_compact_lines(path: Path) -> tuple[list[list[list[int]]], int, int]:
    """Load compact boundary-line JSON (encoding 'polyline-xy-array').

    Returns (lines, width, height) where each line is [[x,y], ...].
    """
    data = json.loads(path.read_text(encoding="utf-8"))
    enc = data.get("encoding", "")
    if enc != "polyline-xy-array":
        raise ValueError(f"Unsupported encoding '{enc}' in {path}; expected 'polyline-xy-array'")
    img_size = data.get("imageSize")
    if not img_size or len(img_size) < 2:
        raise ValueError(f"Missing imageSize in {path}")
    w, h = int(img_size[0]), int(img_size[1])
    lines = data.get("lines", [])
    if not lines:
        raise ValueError(f"No lines found in {path}")
    return lines, w, h


def rasterize_lines(lines: list[list[list[int]]], w: int, h: int) -> np.ndarray:
    """Rasterise polylines onto a blank binary mask (uint8, 0/255).

    Each line is [[x,y], [x,y], ...] in pixel coordinates.
    """
    mask = np.zeros((h, w), dtype=np.uint8)
    for line in lines:
        if len(line) < 2:
            # Single-point line: mark the pixel
            if len(line) == 1:
                x, y = int(line[0][0]), int(line[0][1])
                if 0 <= x < w and 0 <= y < h:
                    mask[y, x] = 255
            continue
        pts = np.array(line, dtype=np.int32).reshape(-1, 2)
        for i in range(len(pts) - 1):
            cv2.line(mask, (int(pts[i][0]), int(pts[i][1])),
                     (int(pts[i + 1][0]), int(pts[i + 1][1])),
                     255, thickness=1, lineType=cv2.LINE_8)
    return mask


def main() -> int:
    args = parse_args()

    if not args.input and not args.input_lines:
        print("Error: either --input or --input-lines is required", file=sys.stderr)
        return 1

    args.output_dir.mkdir(parents=True, exist_ok=True)
    vectorize = load_vectorize_module(args.vectorize_script)

    # ---- Branch: --input-lines (compact JSON) vs --input (PNG) ----
    input_lines_mode = bool(args.input_lines)
    source_name: str  # for report / preview HTML
    if input_lines_mode:
        compact_lines, w, h = load_compact_lines(args.input_lines)
        source_name = args.input_lines.name
        # Rasterise lines directly → clean mask (lines *are* the boundary)
        clean = rasterize_lines(compact_lines, w, h)
        raw = clean.copy()  # no separate raw/clean distinction for JSON input
        bgr = None  # not needed
    else:
        if not args.input:
            print("Error: --input is required when --input-lines is not given", file=sys.stderr)
            return 1
        bgr = vectorize.load_image(args.input)
        h, w = bgr.shape[:2]
        raw = vectorize.build_mask(bgr, args)
        clean = vectorize.clean_mask(raw, args)
        source_name = args.input.name

    # --- v2: skeletonize clean mask for endpoint repair ---
    repair_stats: dict[str, int] = {}
    repaired_wall_preview: np.ndarray | None = None
    if args.endpoint_repair_radius > 0:
        skel = vectorize.make_skeleton(clean)
    else:
        skel = None

    k = max(1, int(args.wall_dilate))
    if k % 2 == 0:
        k += 1
    wall = cv2.dilate(clean, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)), iterations=1)
    bt = max(0, int(args.border_thickness))
    if bt:
        cv2.rectangle(wall, (0, 0), (w - 1, h - 1), 255, bt)

    # --- v2: endpoint repair ---
    if skel is not None and args.endpoint_repair_radius > 0:
        wall, repair_stats = repair_endpoints(
            skel, wall,
            max_radius=args.endpoint_repair_radius,
            max_links=args.endpoint_repair_max_links,
            direction_window=args.endpoint_direction_window,
            angle_tolerance_deg=args.endpoint_angle_tolerance,
        )
        # Debug preview: show repaired wall mask at reduced scale
        preview_scale = 0.25
        small_h, small_w = int(h * preview_scale), int(w * preview_scale)
        repaired_wall_preview = cv2.resize(wall, (small_w, small_h), interpolation=cv2.INTER_NEAREST)

    free = cv2.bitwise_not(wall)
    free_bool = free > 0
    num_labels, labels, stats, _centroids = cv2.connectedComponentsWithStats(free_bool.astype(np.uint8), connectivity=4)

    meta = MAP_METADATA.get(args.map_id)
    if meta:
        id_min = args.reference_id_min or meta["id_min"]
        id_max = args.reference_id_max or meta["id_max"]
        expected_count = args.expected_count or meta["expected_count"]
    else:
        # For custom maps, --expected-count is a reporting/validation value only.
        # Do not infer an id range from it; reference ids may be arbitrary.
        id_min = args.reference_id_min
        id_max = args.reference_id_max
        expected_count = args.expected_count
    refs = load_reference_centers(args.reference_areas, id_min=id_min, id_max=id_max)
    if not expected_count:
        expected_count = len(refs)
    unmatched = []
    duplicate_label_refs = {}
    watershed_stats = None
    areas = []

    if args.seeded_watershed and refs:
        labels_ws, watershed_stats = build_seeded_watershed_labels(
            free_bool, wall, refs, args.max_search_radius
        )
        # Watershed labels are 1-based marker indices corresponding to refs order.
        for idx, ref in enumerate(refs, start=1):
            if not np.any(labels_ws == idx):
                unmatched.append(ref["id"])
                continue
            poly = component_polygon(labels_ws, idx, args.simplify_epsilon)
            if not poly:
                unmatched.append(ref["id"])
                continue
            polygon_yx, center_yx, contour_area = poly
            comp_area = int(np.count_nonzero(labels_ws == idx))
            areas.append({
                "id": ref["id"],
                "center": center_yx,
                "polygon": polygon_yx,
                "meta": {
                    "watershedLabel": int(idx),
                    "componentAreaPx": comp_area,
                    "contourAreaPx": contour_area,
                    "matchedReferenceCenter": [ref["y"], ref["x"]],
                    "method": "seeded-watershed",
                }
            })
        labels_for_debug = labels_ws
    else:
        ref_by_label: dict[int, list[dict[str, Any]]] = {}
        for ref in refs:
            found = nearest_label(labels, int(round(ref["x"])), int(round(ref["y"])), args.max_search_radius)
            if not found:
                unmatched.append(ref["id"])
                continue
            lab, fx, fy = found
            ref_by_label.setdefault(lab, []).append({**ref, "matched_x": fx, "matched_y": fy})

        for lab, lab_refs in sorted(ref_by_label.items(), key=lambda kv: min(int(r["id"]) for r in kv[1] if str(r["id"]).isdigit())):
            comp_area = int(stats[lab, cv2.CC_STAT_AREA])
            if comp_area < args.min_component_area:
                for r in lab_refs:
                    unmatched.append(r["id"])
                continue
            poly = component_polygon(labels, lab, args.simplify_epsilon)
            if not poly:
                for r in lab_refs:
                    unmatched.append(r["id"])
                continue
            polygon_yx, center_yx, contour_area = poly
            primary = sorted(lab_refs, key=lambda r: int(r["id"]) if str(r["id"]).isdigit() else str(r["id"]))[0]
            if len(lab_refs) > 1:
                duplicate_label_refs[str(lab)] = [r["id"] for r in lab_refs]
            areas.append({
                "id": primary["id"],
                "center": center_yx,
                "polygon": polygon_yx,
                "meta": {
                    "componentLabel": int(lab),
                    "componentAreaPx": comp_area,
                    "contourAreaPx": contour_area,
                    "matchedReferenceCenter": [primary["y"], primary["x"]],
                    "referenceIdsInSameComponent": [r["id"] for r in lab_refs],
                    "method": "connected-components",
                }
            })

    areas.sort(key=lambda a: int(a["id"]) if str(a["id"]).isdigit() else str(a["id"]))

    areas_json = {
        "mapName": args.map_id,
        "imageSize": [w, h],
        "source": source_name,
        "generator": "scripts/polygonize-boundary-lines.py",
        "formatNote": "Preview only. Coordinates use [y,x] to match area-marker loadCV2Areas().",
        "totalAreas": len(areas),
        "expectedCount": expected_count or None,
        "areas": areas,
    }

    mid = args.map_id
    vs = args.version_suffix
    areas_path = args.output_dir / f"{mid}-areas-polygonize-preview-{vs}.json"
    report_path = args.output_dir / f"{mid}-polygonize-report-{vs}.json"
    html_path = args.output_dir / f"{mid}-polygonize-preview-{vs}.html"

    areas_path.write_text(json.dumps(areas_json, ensure_ascii=False, indent=2), encoding="utf-8")

    comp_areas = [int(stats[i, cv2.CC_STAT_AREA]) for i in range(1, num_labels)]
    report = {
        "mapId": mid,
        "versionSuffix": vs,
        "input": str(args.input_lines) if input_lines_mode else str(args.input),
        "referenceAreas": str(args.reference_areas) if args.reference_areas else None,
        "imageSize": [w, h],
        "params": {
            "wallDilate": k,
            "borderThickness": bt,
            "minComponentArea": args.min_component_area,
            "simplifyEpsilon": args.simplify_epsilon,
            "maxSearchRadius": args.max_search_radius,
            "endpointRepairRadius": args.endpoint_repair_radius,
            "endpointRepairMaxLinks": args.endpoint_repair_max_links,
            "endpointDirectionWindow": args.endpoint_direction_window,
            "endpointAngleTolerance": args.endpoint_angle_tolerance,
        },
        "counts": {
            "rawMaskPixels": int(np.count_nonzero(raw)),
            "cleanMaskPixels": int(np.count_nonzero(clean)),
            "wallPixels": int(np.count_nonzero(wall)),
            "freeComponents": int(num_labels - 1),
            "freeComponentsAboveMinArea": int(sum(a >= args.min_component_area for a in comp_areas)),
            "referenceCenters": len(refs),
            "areasOutput": len(areas),
            "expectedCount": expected_count or None,
            "unmatchedReferenceIds": len(unmatched),
            "componentsWithMultipleReferenceIds": len(duplicate_label_refs),
        },
        "endpointRepair": repair_stats if repair_stats else None,
        "seededWatershed": watershed_stats,
        "unmatchedReferenceIds": unmatched,
        "componentsWithMultipleReferenceIds": duplicate_label_refs,
        "outputFiles": {
            "areasPreview": str(areas_path),
            "report": str(report_path),
            "htmlPreview": str(html_path),
        },
        "warnings": [],
    }
    if expected_count and len(areas) != expected_count:
        report["warnings"].append(f"Output area count {len(areas)} != expected {expected_count}")
    if duplicate_label_refs:
        report["warnings"].append("Some reference IDs landed in the same connected component; boundaries are probably not fully closed there.")
    if unmatched:
        report["warnings"].append("Some reference centers could not be matched to a free-space component.")

    # Use the real map image as preview background even when polygonizing from
    # pre-extracted compact line JSON.
    preview_source_name = source_name
    if input_lines_mode:
        preview_source_name = {
            "nanzih": "nanzih-1-89.png",
            "chiaotou": "chiaotou-90-148.png",
            "tzuguan": "tzuguan-149-213.png",
        }.get(mid, "")
    make_preview_html(mid, preview_source_name, areas_path.name, report_path.name, html_path)

    # Debug: save repaired-wall preview PNG
    if repaired_wall_preview is not None:
        wall_preview_path = args.output_dir / f"{mid}-repaired-wall-preview-{vs}.png"
        cv2.imwrite(str(wall_preview_path), repaired_wall_preview)
        report["outputFiles"]["repairedWallPreview"] = str(wall_preview_path)

    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps({
        "areasPreview": str(areas_path),
        "htmlPreview": str(html_path),
        "report": str(report_path),
        "areasOutput": len(areas),
        "expectedCount": expected_count or None,
        "endpointRepair": repair_stats if repair_stats else None,
        "warnings": report["warnings"],
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
