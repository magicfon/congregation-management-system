#!/usr/bin/env python3
"""Offline image-pixel drafts; never reads or replaces production area geometry.

Install: python -m pip install -r scripts/requirements-map-candidates.txt
Run from repository root: python scripts/rebuild-map-candidates.py
"""
import argparse
import hashlib
import html
import json
from pathlib import Path

import cv2
import numpy as np

MAPS = {
    "nanzih": ("楠梓", "nanzih-1-89.png", 1, 89),
    "chiaotou": ("橋頭", "chiaotou-90-148.png", 90, 148),
    "tzuguan": ("梓官", "tzuguan-149-213.png", 149, 213),
}


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


def extract(map_id, spec, anchors_data, output, width, close_size):
    name, filename, first, last = spec
    source = Path("public/maps") / filename
    original = cv2.imread(str(source))
    if original is None:
        raise ValueError(f"Cannot read {source}")
    height0, width0 = original.shape[:2]
    height = round(height0 * width / width0)
    small = cv2.resize(original, (width, height), interpolation=cv2.INTER_AREA)
    sx, sy = width0 / width, height0 / height
    hsv = cv2.cvtColor(small, cv2.COLOR_BGR2HSV)
    # Low-saturation violet ink, excluding cyan rivers and saturated map labels.
    mask = cv2.inRange(hsv, np.array([117, 15, 110]), np.array([128, 75, 250]))
    # The same translucent ink looks grey-brown over yellow arterial roads.
    # These samples are from the original Tzuguan map, not inferred geometry.
    road_swatches = [[189, 195, 203], [183, 191, 203]]
    for swatch in road_swatches:
        color = np.array(swatch, dtype=np.int16)
        mask |= cv2.inRange(small, np.uint8(color-2), np.uint8(color+2))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((close_size, close_size), np.uint8))
    mask = cv2.dilate(mask, np.ones((3, 3), np.uint8))
    count, labels, stats, _ = cv2.connectedComponentsWithStats(255 - mask, connectivity=4)
    anchors = []
    by_component = {}
    preview_width = anchors_data["previewWidth"]
    for token in anchors_data["maps"][map_id].split():
        number, xy = token.split(":")
        x, y = map(float, xy.split(","))
        px, py = round(x * width / preview_width), round(y * width / preview_width)
        if not (0 <= px < width and 0 <= py < height):
            raise ValueError(f"Out-of-bounds anchor: {map_id} {token}")
        component = int(labels[py, px])
        anchor = {"number": int(number), "point": [round(x * width0 / preview_width, 2), round(y * width0 / preview_width, 2)], "component": component or None}
        anchors.append(anchor)
        if component:
            by_component.setdefault(component, []).append(int(number))
    candidates = []
    for label in range(1, count):
        x, y, w, h, area = map(int, stats[label])
        numbers = sorted(set(by_component.get(label, [])))
        if area < 150 and not numbers:
            continue
        local = np.uint8(labels[y:y+h, x:x+w] == label) * 255
        contours, hierarchy = cv2.findContours(local, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
        if hierarchy is None:
            continue
        polygons = []
        for i, contour in enumerate(contours):
            if hierarchy[0][i][3] != -1:
                continue
            indices = [i]
            child = hierarchy[0][i][2]
            while child != -1:
                indices.append(child)
                child = hierarchy[0][child][0]
            rings = []
            for j in indices:
                # Preserve topology of holes; simplify only the external boundary.
                pts = cv2.approxPolyDP(contours[j], 1.0 if j == i else 0.0, True).reshape(-1, 2)
                if len(pts) < 3:
                    continue
                ring = [[round((float(a)+x)*sx, 2), round((float(b)+y)*sy, 2)] for a, b in pts]
                ring.append(ring[0])
                rings.append(ring)
            if rings:
                polygons.append(rings)
        if not polygons:
            continue
        edge = x == 0 or y == 0 or x+w == width or y+h == height
        issues = []
        if edge:
            issues.append("image-edge")
        if len(numbers) > 1:
            issues.append("multiple-numbers")
        if not numbers:
            issues.append("no-number")
        candidates.append({"candidateId": f"{map_id}-component-{label}", "component": label,
                           "numberCandidates": numbers, "status": "needs-review", "issues": issues,
                           "pixelArea": round(area*sx*sy), "polygons": polygons})
    covered = {n for c in candidates for n in c["numberCandidates"]}
    seen = {a["number"] for a in anchors}
    summary = {"expectedNumbers": last-first+1, "locatedNumbers": len(seen),
               "missingLabelNumbers": sorted(set(range(first, last+1))-seen),
               "unmatchedLabelNumbers": sorted(seen-covered),
               "candidateCount": len(candidates),
               "singleNumberInteriorCandidates": sum(len(c["numberCandidates"]) == 1 and not c["issues"] for c in candidates),
               "mergedNumberGroups": [c["numberCandidates"] for c in candidates if len(c["numberCandidates"]) > 1],
               "edgeCandidates": sum("image-edge" in c["issues"] for c in candidates),
               "approvedCount": 0}
    data = {"schemaVersion": 1, "mapId": map_id, "name": name, "sourceImage": filename,
            "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
            "imageSize": [width0, height0],
            "coordinateSystem": {"type": "image-pixel", "order": "xy", "origin": "top-left", "yDirection": "down"},
            "geometryEncoding": "polygons -> rings (outer first, holes after) -> closed [x,y] points",
            "parameters": {"processingWidth": width, "closeKernel": close_size, "dilateKernel": 3, "hsvLower": [117,15,110], "hsvUpper": [128,75,250], "roadSwatchesBgr": road_swatches, "swatchTolerance": 2, "minimumComponentPixels": 150},
            "warnings": ["Draft only. Number positions are visually transcribed approximations.", "Morphological closing can bridge unrelated lines; even single-number candidates require review.", "Candidate IDs are specific to this extraction, not persistent territory IDs."],
            "summary": summary, "labelAnchors": anchors, "candidates": candidates}
    write_json(output / f"{map_id}.json", data)
    cv2.imwrite(str(output / f"{map_id}.jpg"), cv2.resize(original, (1500, round(height0*1500/width0))), [cv2.IMWRITE_JPEG_QUALITY, 88])
    cv2.imwrite(str(output / f"{map_id}-mask.png"), mask)
    paths = []
    for c in candidates:
        color = "#f97316" if c["issues"] else "#22c55e"
        d = " ".join("M" + " L".join(f"{x},{y}" for x,y in ring) + " Z" for poly in c["polygons"] for ring in poly)
        title = f"{c['candidateId']}｜編號 {','.join(map(str,c['numberCandidates'])) or '未配對'}｜{','.join(c['issues']) or '單一編號，待核對'}"
        paths.append(f'<path class="candidate" data-title="{html.escape(title, quote=True)}" d="{d}" fill="{color}" fill-opacity=".20" fill-rule="evenodd" stroke="{color}" stroke-width="2"><title>{html.escape(title)}</title></path>')
    anchor_svg = ''.join(f'<circle cx="{a["point"][0]}" cy="{a["point"][1]}" r="9" fill="#e11d48"><title>編號 {a["number"]} 判讀位置</title></circle>' for a in anchors)
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width0} {height0}" role="img" aria-label="{name}分區草稿"><image href="{map_id}.jpg" width="{width0}" height="{height0}"/><g class="boundaries">' + ''.join(paths) + f'</g><g class="anchors">{anchor_svg}</g></svg>'
    (output / f"{map_id}.svg").write_text(svg, encoding="utf-8")
    print(json.dumps({"map":map_id, **summary}, ensure_ascii=False))
    return data, svg


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("public/maps/reconstruction-v1"))
    parser.add_argument("--width", type=int, default=2400)
    parser.add_argument("--close", type=int, default=9)
    args = parser.parse_args()
    if args.width < 300 or args.close < 1 or args.close % 2 == 0:
        parser.error("width >= 300 and close must be a positive odd integer")
    args.output.mkdir(parents=True, exist_ok=True)
    anchors = json.loads(Path("scripts/map-label-anchors.json").read_text(encoding="utf-8"))
    results = [extract(mid, spec, anchors, args.output, args.width, args.close) for mid, spec in MAPS.items()]
    sections = []
    for data, svg in results:
        s = data["summary"]
        sections.append(f'<section id="{data["mapId"]}" hidden><p>{data["name"]}：已定位 {s["locatedNumbers"]}/{s["expectedNumbers"]} 個編號；單一編號且未碰圖片邊緣 {s["singleNumberInteriorCandidates"]} 塊；缺線合併 {len(s["mergedNumberGroups"])} 組。全部待核對。 <a href="{data["mapId"]}.json" download>下載 JSON</a> · <a href="{data["mapId"]}.svg">SVG</a></p><div class="viewport"><div class="canvas">{svg}</div></div></section>')
    page = '''<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>三區地圖分區重建草稿</title>
<style>body{margin:0;background:#101827;color:#e5e7eb;font:15px system-ui}header,main>p,section>p{padding:8px 16px;margin:0}header{position:sticky;top:0;background:#101827;z-index:1}h1{font-size:20px;margin:0 0 8px}button,select{padding:6px;margin-right:10px}a{color:#7dd3fc}.viewport{height:76vh;overflow:auto;background:#333}.canvas{width:100%}svg{display:block;width:100%}.candidate{cursor:pointer}.candidate:hover,.candidate.selected{fill-opacity:.6;stroke:#ef4444;stroke-width:6}.hide-boundaries .boundaries,.hide-anchors .anchors{display:none}#detail{min-height:24px;color:#fcd34d}label{display:inline-block;margin:5px}</style>
<header><h1>三區地圖分區重建草稿</h1><select id="map" aria-label="地圖"><option value="nanzih">楠梓 1–89</option><option value="chiaotou">橋頭 90–148</option><option value="tzuguan">梓官 149–213</option></select><label>放大 <select id="zoom"><option value="100">100%</option><option value="150">150%</option><option value="200">200%</option><option value="300">300%</option></select></label><label><input id="overlay" type="checkbox" checked>候選邊界</label><label><input id="anchors" type="checkbox" checked>編號位置</label><div id="detail" aria-live="polite">點選色塊查看配對編號與問題。</div></header>
<main><p>綠色：單一編號候選；橘色：多個編號、未配對或碰圖片邊緣。紅點是原圖編號位置。所有結果尚未核准，未匯入正式地圖。</p>''' + ''.join(sections) + '''</main><script>
const map=document.querySelector('#map'),zoom=document.querySelector('#zoom');
function show(){document.querySelectorAll('section').forEach(s=>s.hidden=s.id!==map.value);document.querySelectorAll('.canvas').forEach(c=>c.style.width=zoom.value+'%');}map.onchange=show;zoom.onchange=show;show();
document.querySelector('#overlay').onchange=e=>document.body.classList.toggle('hide-boundaries',!e.target.checked);
document.querySelector('#anchors').onchange=e=>document.body.classList.toggle('hide-anchors',!e.target.checked);
document.querySelectorAll('.candidate').forEach(p=>p.onclick=()=>{document.querySelectorAll('.selected').forEach(x=>x.classList.remove('selected'));p.classList.add('selected');document.querySelector('#detail').textContent=p.dataset.title;});
</script></html>'''
    (args.output / "index.html").write_text(page, encoding="utf-8")


if __name__ == "__main__":
    main()
