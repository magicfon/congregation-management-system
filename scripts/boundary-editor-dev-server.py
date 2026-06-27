#!/usr/bin/env python3
"""
Local dev server for the Boundary Line Editor one-click polygonize workflow.

Serves public/ as static files and exposes a POST endpoint that:
  1. Saves the edited boundary-line compact JSON to public/maps/generated/
  2. Runs scripts/polygonize-boundary-lines.py --input-lines ...
  3. Returns the preview JSON + file paths so the browser can auto-load.

Usage:
    python3 scripts/boundary-editor-dev-server.py [--port 18831] [--repo .]

Security: This server is for LOCAL DEVELOPMENT ONLY. It binds to 127.0.0.1.
Do NOT expose it to the internet. No secrets are read or exposed.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.parse
import urllib.request
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DIR = REPO_ROOT / "public"
GENERATED_DIR = PUBLIC_DIR / "maps" / "generated"
POLYGONIZE_SCRIPT = REPO_ROOT / "scripts" / "polygonize-boundary-lines.py"

# ---------------------------------------------------------------------------


class DevHandler(SimpleHTTPRequestHandler):
    """Serve public/ static files + POST /api/boundary-lines/polygonize."""

    # Map URL → on-disk directory
    _static_dir: str = str(PUBLIC_DIR)

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=self._static_dir, **kwargs)

    # ---- POST endpoint ----

    def do_POST(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/boundary-lines/polygonize":
            self._handle_polygonize()
        else:
            self._respond_json(404, {"error": "Not found"})

    def _handle_polygonize(self) -> None:
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length > 20 * 1024 * 1024:  # 20 MB safety cap
            self._respond_json(413, {"error": "Payload too large"})
            return

        body = self.rfile.read(content_length)
        try:
            payload = json.loads(body)
        except json.JSONDecodeError as exc:
            self._respond_json(400, {"error": f"Invalid JSON: {exc}"})
            return

        # --- Validate payload ---
        lines = payload.get("lines")
        image_size = payload.get("imageSize")
        encoding = payload.get("encoding")
        if not isinstance(lines, list):
            self._respond_json(400, {"error": "Missing or invalid 'lines' array"})
            return
        if encoding != "polyline-xy-array":
            self._respond_json(400, {"error": "Expected encoding 'polyline-xy-array'"})
            return
        if not isinstance(image_size, list) or len(image_size) < 2:
            self._respond_json(400, {"error": "Missing 'imageSize'"})
            return

        _MAP_EXPECTED_COUNTS: dict[str, int] = {"nanzih": 89, "chiaotou": 59, "tzuguan": 65}
        map_id_raw = payload.get("mapId")
        if not map_id_raw:
            self._respond_json(400, {"error": "Missing required field 'mapId'"})
            return
        map_id: str = map_id_raw
        version_suffix: str = payload.get("versionSuffix") or "edited-dev"
        safe_token = re.compile(r"^[A-Za-z0-9_-]+$")
        if not safe_token.match(map_id):
            self._respond_json(400, {"error": "Invalid mapId"})
            return
        if not safe_token.match(version_suffix):
            self._respond_json(400, {"error": "Invalid versionSuffix"})
            return

        # --- Save compact JSON ---
        GENERATED_DIR.mkdir(parents=True, exist_ok=True)
        lines_filename = f"{map_id}-boundary-lines-{version_suffix}.json"
        lines_path = GENERATED_DIR / lines_filename
        lines_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

        # Prefer the formal app areas file because cross-map ids are global
        # (nanzih 1-89, chiaotou 90-148, tzuguan 149-213). The cv2 files use
        # detector-local ids and may include extra candidates.
        ref_areas_path = PUBLIC_DIR / "maps" / f"{map_id}-areas.json"
        if not ref_areas_path.exists():
            ref_areas_path = PUBLIC_DIR / "maps" / f"{map_id}-areas-cv2.json"
        ref_areas_arg = ["--reference-areas", str(ref_areas_path)] if ref_areas_path.exists() else []

        # --- Run polygonize script ---
        expected_count_arg = []
        if map_id in _MAP_EXPECTED_COUNTS:
            expected_count_arg = ["--expected-count", str(_MAP_EXPECTED_COUNTS[map_id])]
        python_executable = sys.executable
        venv_python = REPO_ROOT / ".venv-boundaries" / "bin" / "python"
        if venv_python.exists():
            python_executable = str(venv_python)

        cmd = [
            python_executable,
            str(POLYGONIZE_SCRIPT),
            "--input-lines", str(lines_path),
            "--map-id", map_id,
            *ref_areas_arg,
            *expected_count_arg,
            "--seeded-watershed",
            "--output-dir", str(GENERATED_DIR),
            "--version-suffix", version_suffix,
        ]

        print(f"[dev-server] Running: {' '.join(cmd)}", flush=True)
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=120,
                cwd=str(REPO_ROOT),
            )
        except subprocess.TimeoutExpired:
            self._respond_json(504, {"error": "polygonize script timed out (>120s)"})
            return
        except Exception as exc:
            self._respond_json(500, {"error": f"Failed to run polygonize: {exc}"})
            return

        stdout = result.stdout.strip()
        stderr = result.stderr.strip()

        if result.returncode != 0:
            self._respond_json(500, {
                "error": "polygonize script failed",
                "returnCode": result.returncode,
                "stderr": stderr[:4000],
                "stdout": stdout[:4000],
            })
            return

        # Parse script's JSON summary from stdout. The polygonize script may print
        # pretty JSON, so parse the full stdout first (not only the last line).
        script_summary = {}
        if stdout:
            try:
                script_summary = json.loads(stdout)
            except Exception:
                try:
                    start = stdout.find("{")
                    end = stdout.rfind("}")
                    if start >= 0 and end > start:
                        script_summary = json.loads(stdout[start:end + 1])
                except Exception:
                    script_summary = {}

        # Build paths relative to web root (public/)
        vs = version_suffix
        areas_preview_rel = f"/maps/generated/{map_id}-areas-polygonize-preview-{vs}.json"
        report_rel = f"/maps/generated/{map_id}-polygonize-report-{vs}.json"
        html_preview_rel = f"/maps/generated/{map_id}-polygonize-preview-{vs}.html"

        response: dict[str, Any] = {
            "success": True,
            "savedLinesPath": f"/maps/generated/{lines_filename}",
            "areasPreviewUrl": areas_preview_rel,
            "areasPreviewPath": str(GENERATED_DIR / f"{map_id}-areas-polygonize-preview-{vs}.json"),
            "reportUrl": report_rel,
            "reportPath": str(GENERATED_DIR / f"{map_id}-polygonize-report-{vs}.json"),
            "htmlPreviewUrl": html_preview_rel,
            "stdout": stdout[:8000],
            "summary": script_summary,
        }
        self._respond_json(200, response)

    # ---- Helpers ----

    def _respond_json(self, code: int, obj: dict[str, Any]) -> None:
        payload = json.dumps(obj, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        # CORS: allow everything for local dev
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self) -> None:
        """Handle CORS preflight."""
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def log_message(self, fmt: str, *args: Any) -> None:
        """Quiet logging: only show POST /api calls."""
        msg = fmt % args
        if "/api/" in msg or "POST" in msg:
            super().log_message(fmt, *args)


def main() -> int:
    parser = argparse.ArgumentParser(description="Boundary Editor dev server (local only)")
    parser.add_argument("--port", type=int, default=18831, help="Port (default 18831)")
    parser.add_argument("--host", default="127.0.0.1", help="Bind host (default 127.0.0.1)")
    args = parser.parse_args()

    server = HTTPServer((args.host, args.port), DevHandler)
    print(f"🚀 Boundary Editor dev server")
    print(f"   Static files : http://{args.host}:{args.port}/")
    print(f"   API endpoint : POST http://{args.host}:{args.port}/api/boundary-lines/polygonize")
    print(f"   Serving from : {PUBLIC_DIR}")
    print(f"   Press Ctrl+C to stop.\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Server stopped.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
