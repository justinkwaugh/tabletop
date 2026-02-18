#!/usr/bin/env python3
"""Simplify Indonesia board area paths with Shapely without contour drift.

This script only simplifies linear closed subpaths (M/L/Z). It skips paths
containing curve/arc commands because converting those while preserving exact
SVG contours is not lossless.

Usage:
  /tmp/shapely-env/bin/python3 games/indonesia-ui/scripts/simplify-areas-shapely.py \
      --file games/indonesia-ui/src/lib/definitions/boardGeometry.ts \
      --file games/indonesia-ui/src/lib/definitions/boardGeometrySmoothed.ts \
      --write
"""

from __future__ import annotations

import argparse
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from shapely.geometry import LineString, Polygon

AREA_RE = re.compile(r"\{ id: '([^']+)', path: '([^']+)' \}")
TOKEN_RE = re.compile(r"([AaCcHhLlMmQqSsTtVvZz])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)")


@dataclass
class ParsedLinearPath:
    rings: list[list[tuple[float, float]]]
    error: str | None = None


def tokenize_path(path: str) -> list[tuple[str, str | float]]:
    tokens: list[tuple[str, str | float]] = []
    for match in TOKEN_RE.finditer(path):
        if match.group(1):
            tokens.append(("cmd", match.group(1)))
        else:
            tokens.append(("num", float(match.group(2))))
    return tokens


def parse_linear_path(path: str) -> ParsedLinearPath:
    tokens = tokenize_path(path)
    commands = {value.lower() for kind, value in tokens if kind == "cmd"}
    if not commands.issubset({"m", "l", "z"}):
        return ParsedLinearPath([], "nonlinear")

    i = 0
    x = 0.0
    y = 0.0
    start_x = 0.0
    start_y = 0.0
    rings: list[list[tuple[float, float]]] = []
    current_ring: list[tuple[float, float]] | None = None
    current_cmd: str | None = None

    while i < len(tokens):
        kind, value = tokens[i]
        if kind == "cmd":
            current_cmd = str(value)
            i += 1
        elif current_cmd is None:
            return ParsedLinearPath([], "path_must_start_with_command")

        if current_cmd in ("M", "m"):
            is_relative = current_cmd == "m"
            if i + 1 >= len(tokens):
                return ParsedLinearPath([], "moveto_missing_coords")

            x0 = float(tokens[i][1])
            y0 = float(tokens[i + 1][1])
            i += 2

            x = x + x0 if is_relative else x0
            y = y + y0 if is_relative else y0
            start_x, start_y = x, y
            current_ring = [(x, y)]

            # Implicit line-to command sequence after moveto.
            while i < len(tokens) and tokens[i][0] == "num":
                if i + 1 >= len(tokens):
                    return ParsedLinearPath([], "implicit_lineto_missing_coords")
                x1 = float(tokens[i][1])
                y1 = float(tokens[i + 1][1])
                i += 2
                nx = x + x1 if is_relative else x1
                ny = y + y1 if is_relative else y1
                if (nx, ny) != current_ring[-1]:
                    current_ring.append((nx, ny))
                x, y = nx, ny

        elif current_cmd in ("L", "l"):
            if current_ring is None:
                return ParsedLinearPath([], "lineto_before_moveto")
            is_relative = current_cmd == "l"
            while i < len(tokens) and tokens[i][0] == "num":
                if i + 1 >= len(tokens):
                    return ParsedLinearPath([], "lineto_odd_coord_count")
                x1 = float(tokens[i][1])
                y1 = float(tokens[i + 1][1])
                i += 2
                nx = x + x1 if is_relative else x1
                ny = y + y1 if is_relative else y1
                if (nx, ny) != current_ring[-1]:
                    current_ring.append((nx, ny))
                x, y = nx, ny

        elif current_cmd in ("Z", "z"):
            if current_ring is None:
                return ParsedLinearPath([], "closepath_before_moveto")
            if current_ring[-1] != (start_x, start_y):
                current_ring.append((start_x, start_y))
            rings.append(current_ring)
            current_ring = None
            x, y = start_x, start_y

        else:
            return ParsedLinearPath([], f"unsupported_command_{current_cmd}")

    if current_ring is not None:
        return ParsedLinearPath([], "subpath_not_closed")

    return ParsedLinearPath(rings)


def format_num(value: float) -> str:
    if abs(value - round(value)) < 1e-9:
        return str(int(round(value)))
    return f"{value:.6f}".rstrip("0").rstrip(".")


def ring_to_path(ring: Iterable[tuple[float, float]]) -> str:
    coords = list(ring)
    if len(coords) > 1 and coords[0] == coords[-1]:
        coords = coords[:-1]
    return "M " + " L ".join(f"{format_num(x)} {format_num(y)}" for x, y in coords) + " Z"


def simplify_linear_path(path: str) -> tuple[str | None, str | None]:
    parsed = parse_linear_path(path)
    if parsed.error:
        return None, parsed.error

    subpaths: list[str] = []
    for ring in parsed.rings:
        if len(ring) < 4:
            return None, "degenerate_ring"

        original_poly = Polygon(ring)
        original_line = LineString(ring)
        if original_line.is_empty or len(original_line.coords) < 2:
            return None, "empty_linestring"
        if original_poly.is_empty:
            return None, "empty_polygon"

        simplified_line = LineString(ring).simplify(0, preserve_topology=True)
        if simplified_line.geom_type != "LineString":
            return None, "collapsed_linestring"
        if not original_line.equals(simplified_line):
            return None, "line_geometry_changed"

        simplified_coords = list(simplified_line.coords)
        if simplified_coords[0] != simplified_coords[-1]:
            simplified_coords.append(simplified_coords[0])
        if len(simplified_coords) < 4:
            return None, "collapsed_ring"

        # Exact-shape guardrail for valid polygons.
        if original_poly.is_valid:
            simplified_poly = Polygon(simplified_coords)
            if not original_poly.equals(simplified_poly):
                return None, "geometry_changed"

        subpaths.append(ring_to_path(simplified_coords))

    return " ".join(subpaths), None


def process_file(path: Path, write: bool) -> dict[str, object]:
    text = path.read_text()
    matches = list(AREA_RE.finditer(text))

    changes: list[tuple[tuple[int, int], str]] = []
    skipped: dict[str, str] = {}
    unchanged = 0

    for match in matches:
        area_id = match.group(1)
        area_path = match.group(2)
        simplified, reason = simplify_linear_path(area_path)
        if simplified is None:
            skipped[area_id] = reason or "unknown"
            continue
        if simplified == area_path:
            unchanged += 1
            continue

        start, end = match.span(2)
        changes.append(((start, end), simplified))

    if write and changes:
        updated = text
        for (start, end), replacement in reversed(changes):
            updated = updated[:start] + replacement + updated[end:]
        path.write_text(updated)

    return {
        "file": str(path),
        "total_areas": len(matches),
        "changed": len(changes),
        "unchanged": unchanged,
        "skipped": skipped,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", action="append", required=True, help="TS file(s) containing area path definitions")
    parser.add_argument("--write", action="store_true", help="Write updated paths back to file")
    args = parser.parse_args()

    total_changed = 0
    total_areas = 0
    skipped_total: dict[str, str] = {}

    for file_arg in args.file:
        result = process_file(Path(file_arg), args.write)
        total_changed += int(result["changed"])
        total_areas += int(result["total_areas"])
        skipped_total.update(result["skipped"])  # type: ignore[arg-type]
        print(
            f"{result['file']}: areas={result['total_areas']} changed={result['changed']} "
            f"unchanged={result['unchanged']} skipped={len(result['skipped'])}"
        )

    print(f"TOTAL: areas={total_areas} changed={total_changed} skipped={len(skipped_total)}")
    if skipped_total:
        print("SKIPPED_IDS:")
        for area_id in sorted(skipped_total):
            print(f"  {area_id}: {skipped_total[area_id]}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
