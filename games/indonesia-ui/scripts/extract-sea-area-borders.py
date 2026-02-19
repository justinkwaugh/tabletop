#!/usr/bin/env python3
from __future__ import annotations

import argparse
import math
import random
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path

from shapely.geometry import LineString, MultiPolygon, Point, Polygon
from shapely.ops import polygonize, snap, unary_union
from shapely.prepared import prep
from svgpathtools import Arc, CubicBezier, Line, QuadraticBezier, parse_path


AREA_RE = re.compile(r"\{\s*id:\s*'([^']+)'\s*,\s*path:\s*'([^']+)'\s*\}")
SEA_NAME_RE = re.compile(r"SEA LINE\s*(\d+)")
AREA_ENTRY_RE = re.compile(r"\{\s*id:\s*'([^']+)'\s*,\s*path:\s*([^}]+?)\s*\}", re.S)
CONST_PATH_RE = re.compile(
    r"const\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:`([^`]*)`|'([^']*)'|\"([^\"]*)\")\s*;",
    re.S,
)


@dataclass(frozen=True)
class AreaPoly:
    id: str
    polygon: Polygon


@dataclass(frozen=True)
class SeaPath:
    id_num: int
    d: str
    line: LineString


@dataclass(frozen=True)
class SourceSeg:
    idx: int
    kind: str  # sea|board|coast
    source: str  # Pxx|TOP/RIGHT/BOTTOM/LEFT|Axx etc
    seg: object
    bbox: tuple[float, float, float, float]


@dataclass(frozen=True)
class Piece:
    idx: int
    kind: str
    source: str
    seg: object
    u: int
    v: int


@dataclass(frozen=True)
class SeaZone:
    zone: Polygon
    geometry: Polygon | MultiPolygon
    clipped_area: float


class NodeCluster:
    def __init__(self, tol: float) -> None:
        self.tol = tol
        self.inv = 1.0 / tol
        self.nodes: list[list[float]] = []  # [x, y, count]
        self.grid: dict[tuple[int, int], list[int]] = {}

    def _cell(self, x: float, y: float) -> tuple[int, int]:
        return (int(round(x * self.inv)), int(round(y * self.inv)))

    def add(self, x: float, y: float) -> int:
        cx, cy = self._cell(x, y)
        best_idx = -1
        best_d2 = self.tol * self.tol
        for gx in (cx - 1, cx, cx + 1):
            for gy in (cy - 1, cy, cy + 1):
                for nid in self.grid.get((gx, gy), []):
                    nx, ny, _ = self.nodes[nid]
                    d2 = (nx - x) ** 2 + (ny - y) ** 2
                    if d2 <= best_d2:
                        best_d2 = d2
                        best_idx = nid
        if best_idx >= 0:
            nx, ny, n = self.nodes[best_idx]
            n2 = n + 1.0
            self.nodes[best_idx] = [nx + (x - nx) / n2, ny + (y - ny) / n2, n2]
            return best_idx
        nid = len(self.nodes)
        self.nodes.append([x, y, 1.0])
        self.grid.setdefault((cx, cy), []).append(nid)
        return nid


def fmt(v: float) -> str:
    v = round(float(v), 2)
    iv = int(round(v))
    if abs(v - iv) < 1e-9:
        return str(iv)
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s == "-0" else s


def sample_segment(seg, px_step: float = 2.8) -> list[tuple[float, float]]:
    try:
        length = float(seg.length(error=1e-3))
    except Exception:
        length = 40.0
    n = max(6, min(220, int(math.ceil(length / px_step))))
    return [(float(seg.point(i / n).real), float(seg.point(i / n).imag)) for i in range(n + 1)]


def seg_bbox(seg) -> tuple[float, float, float, float]:
    pts = sample_segment(seg, px_step=8.0)
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return (min(xs), min(ys), max(xs), max(ys))


def bbox_intersects(a, b, pad: float = 0.0) -> bool:
    return not (a[2] + pad < b[0] or b[2] + pad < a[0] or a[3] + pad < b[1] or b[3] + pad < a[1])


def path_to_linestring(d: str) -> LineString | None:
    path = parse_path(d)
    coords: list[tuple[float, float]] = []
    for seg in path:
        pts = sample_segment(seg)
        if coords:
            coords.extend(pts[1:])
        else:
            coords.extend(pts)
    if len(coords) < 2:
        return None
    line = LineString(coords)
    if line.length < 1e-6:
        return None
    return line


def path_to_polygons(d: str) -> list[Polygon]:
    path = parse_path(d)
    out: list[Polygon] = []
    for sub in path.continuous_subpaths():
        coords: list[tuple[float, float]] = []
        for seg in sub:
            pts = sample_segment(seg)
            if coords:
                coords.extend(pts[1:])
            else:
                coords.extend(pts)
        if len(coords) < 4:
            continue
        if coords[0] != coords[-1]:
            coords.append(coords[0])
        poly = Polygon(coords)
        if not poly.is_valid:
            poly = poly.buffer(0)
        if poly.is_empty:
            continue
        if isinstance(poly, MultiPolygon):
            out.extend([g for g in poly.geoms if g.area > 4.0])
        elif poly.area > 4.0:
            out.append(poly)
    return out


def flatten_polygons(geom, min_area: float) -> list[Polygon]:
    if geom.is_empty:
        return []
    if isinstance(geom, Polygon):
        return [geom] if geom.area >= min_area else []
    if isinstance(geom, MultiPolygon):
        return [g for g in geom.geoms if g.area >= min_area]
    if hasattr(geom, "geoms"):
        out: list[Polygon] = []
        for g in geom.geoms:
            out.extend(flatten_polygons(g, min_area))
        return out
    return []


def parse_land(board_geometry_path: Path):
    text = board_geometry_path.read_text()
    area_paths: list[tuple[str, str]] = []
    area_polys: list[AreaPoly] = []
    for m in AREA_RE.finditer(text):
        aid = m.group(1)
        d = m.group(2)
        area_paths.append((aid, d))
        for p in path_to_polygons(d):
            area_polys.append(AreaPoly(id=aid, polygon=p))
    if not area_polys:
        raise RuntimeError("No area polygons parsed from boardGeometry.ts")
    land_union = unary_union([a.polygon for a in area_polys])
    return area_paths, area_polys, land_union


def parse_all_area_paths(board_geometry_path: Path) -> dict[str, str]:
    text = board_geometry_path.read_text()
    const_paths: dict[str, str] = {}
    for m in CONST_PATH_RE.finditer(text):
        name = m.group(1)
        value = m.group(2) if m.group(2) is not None else (m.group(3) if m.group(3) is not None else m.group(4))
        if value is not None:
            const_paths[name] = value

    out: dict[str, str] = {}
    for m in AREA_ENTRY_RE.finditer(text):
        aid = m.group(1)
        expr = m.group(2).strip()
        d: str | None = None
        if expr.startswith("'") and expr.endswith("'"):
            d = expr[1:-1]
        elif expr.startswith("`") and expr.endswith("`"):
            d = expr[1:-1]
        else:
            ident = expr.rstrip(",")
            if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", ident):
                d = const_paths.get(ident)
        if d:
            out[aid] = d
    return out


def parse_sea_svg(sea_svg_path: Path):
    root = ET.fromstring(sea_svg_path.read_text())
    board_d = None
    paths: list[SeaPath] = []
    for node in root.findall(".//{http://www.w3.org/2000/svg}path"):
        d = node.attrib.get("d")
        if not d:
            continue
        if node.attrib.get("class") == "av":
            board_d = d
            continue
        data_name = node.attrib.get("data-name", "")
        m = SEA_NAME_RE.search(data_name)
        if not m:
            continue
        sid = int(m.group(1))
        ln = path_to_linestring(d)
        if ln is None:
            continue
        paths.append(SeaPath(id_num=sid, d=d, line=ln))
    if board_d is None:
        raise RuntimeError("Could not find board-edge path in sea svg")
    board_polys = path_to_polygons(board_d)
    if not board_polys:
        raise RuntimeError("Could not parse board-edge polygon from sea svg")
    board_poly = unary_union(board_polys)
    paths.sort(key=lambda x: x.id_num)
    return board_poly, board_d, paths


def is_coast_segment(seg, land_union_prepped, eps: float = 1.6) -> bool:
    if abs(seg.end - seg.start) < 1e-8:
        return False
    votes = 0
    for t in (0.25, 0.5, 0.75):
        p = seg.point(t)
        try:
            d = seg.derivative(t)
        except Exception:
            d = seg.end - seg.start
        if abs(d) < 1e-8:
            d = seg.end - seg.start
        if abs(d) < 1e-8:
            continue
        n = complex(-d.imag, d.real) / abs(d)
        p1 = Point(float((p + n * eps).real), float((p + n * eps).imag))
        p2 = Point(float((p - n * eps).real), float((p - n * eps).imag))
        in1 = land_union_prepped.contains(p1)
        in2 = land_union_prepped.contains(p2)
        if in1 != in2:
            votes += 1
    return votes >= 2


def nearest_t_on_seg(seg, p: complex) -> tuple[float, float]:
    # coarse sample + local ternary refinement
    best_t = 0.5
    best_d2 = 1e30
    samples = 41
    for i in range(samples):
        t = i / (samples - 1)
        q = seg.point(t)
        d2 = (q.real - p.real) ** 2 + (q.imag - p.imag) ** 2
        if d2 < best_d2:
            best_d2 = d2
            best_t = t
    lo = max(0.0, best_t - 1.0 / (samples - 1))
    hi = min(1.0, best_t + 1.0 / (samples - 1))
    for _ in range(12):
        t1 = lo + (hi - lo) / 3.0
        t2 = hi - (hi - lo) / 3.0
        q1 = seg.point(t1)
        q2 = seg.point(t2)
        d1 = (q1.real - p.real) ** 2 + (q1.imag - p.imag) ** 2
        d2 = (q2.real - p.real) ** 2 + (q2.imag - p.imag) ** 2
        if d1 <= d2:
            hi = t2
        else:
            lo = t1
    t = 0.5 * (lo + hi)
    q = seg.point(t)
    d = math.hypot(q.real - p.real, q.imag - p.imag)
    return t, d


def segment_cmd(seg) -> str:
    end = seg.end
    if isinstance(seg, Line):
        return f"L {fmt(end.real)} {fmt(end.imag)}"
    if isinstance(seg, CubicBezier):
        c1 = seg.control1
        c2 = seg.control2
        return (
            f"C {fmt(c1.real)} {fmt(c1.imag)} {fmt(c2.real)} {fmt(c2.imag)} "
            f"{fmt(end.real)} {fmt(end.imag)}"
        )
    if isinstance(seg, QuadraticBezier):
        c = seg.control
        return f"Q {fmt(c.real)} {fmt(c.imag)} {fmt(end.real)} {fmt(end.imag)}"
    if isinstance(seg, Arc):
        rx = abs(seg.radius.real)
        ry = abs(seg.radius.imag)
        laf = 1 if seg.large_arc else 0
        sw = 1 if seg.sweep else 0
        return (
            f"A {fmt(rx)} {fmt(ry)} {fmt(seg.rotation)} {laf} {sw} "
            f"{fmt(end.real)} {fmt(end.imag)}"
        )
    return f"L {fmt(end.real)} {fmt(end.imag)}"


def subpath_to_d(segments: list[object]) -> str:
    if not segments:
        return ""
    parts = [f"M {fmt(segments[0].start.real)} {fmt(segments[0].start.imag)}"]
    for seg in segments:
        parts.append(segment_cmd(seg))
    if abs(segments[-1].end - segments[0].start) <= 1e-6:
        parts.append("Z")
    return " ".join(parts)


def reverse_path_d(d: str) -> str:
    out_parts: list[str] = []
    for sub in parse_path(d).continuous_subpaths():
        segs = list(sub)
        rev = [s.reversed() for s in reversed(segs)]
        out_parts.append(subpath_to_d(rev))
    return " ".join([p for p in out_parts if p])


def unit_vec(z: complex) -> complex:
    n = abs(z)
    return z / n if n > 1e-9 else complex(1.0, 0.0)


def seg_tangent(seg, t: float) -> complex:
    try:
        d = seg.derivative(t)
    except Exception:
        d = seg.end - seg.start
    if abs(d) < 1e-9:
        d = seg.end - seg.start
    return unit_vec(d)


def extract_zones(board_poly, sea_paths: list[SeaPath], snap_tol: float, min_zone_area: float):
    sea_line_union = unary_union([s.line for s in sea_paths])
    snapped = snap(sea_line_union, sea_line_union, snap_tol)
    network = unary_union([board_poly.boundary, snapped])
    zones = list(polygonize(network))
    zones = [z for z in zones if z.area >= min_zone_area and board_poly.buffer(0.5).contains(z.representative_point())]
    zones.sort(key=lambda g: g.area, reverse=True)
    return zones


def classify_and_clip_sea_zones(zones: list[Polygon], land_union, min_piece_area: float):
    out: list[SeaZone] = []
    for z in zones:
        rp = z.representative_point()
        if land_union.buffer(0.2).contains(rp):
            continue
        clipped = z.difference(land_union)
        parts = flatten_polygons(clipped, min_piece_area)
        if not parts:
            continue
        geom = unary_union(parts)
        out.append(SeaZone(zone=z, geometry=geom, clipped_area=float(geom.area)))
    out.sort(key=lambda s: s.clipped_area, reverse=True)
    return out


def build_loops_for_zone(zone_piece_ids: set[int], pieces: list[Piece]):
    adj: dict[int, list[int]] = {}
    for pid in zone_piece_ids:
        p = pieces[pid]
        adj.setdefault(p.u, []).append(pid)
        adj.setdefault(p.v, []).append(pid)

    unused = set(zone_piece_ids)
    loops: list[list[tuple[int, bool]]] = []

    def try_walk(seed_pid: int, seed_forward: bool):
        local_used: list[int] = [seed_pid]
        start_node = pieces[seed_pid].u if seed_forward else pieces[seed_pid].v
        prev_node = start_node
        curr_node = pieces[seed_pid].v if seed_forward else pieces[seed_pid].u
        curr_seg = pieces[seed_pid].seg if seed_forward else pieces[seed_pid].seg.reversed()
        loop: list[tuple[int, bool]] = [(seed_pid, seed_forward)]

        for _ in range(len(zone_piece_ids) + 10):
            if curr_node == start_node:
                return loop, local_used, True

            cands = [pid for pid in adj.get(curr_node, []) if pid in unused and pid not in local_used]
            if not cands:
                return loop, local_used, False

            incoming = seg_tangent(curr_seg, 1.0 - 1e-4)

            scored: list[tuple[float, int, bool, int, object]] = []
            for pid in cands:
                p = pieces[pid]
                if p.u == curr_node:
                    fwd = True
                    nxt = p.v
                    use_seg = p.seg
                else:
                    fwd = False
                    nxt = p.u
                    use_seg = p.seg.reversed()
                out = seg_tangent(use_seg, 1e-4)
                # prefer straight continuation; avoid immediate backtrack
                score = incoming.real * out.real + incoming.imag * out.imag
                if nxt == prev_node:
                    score -= 2.0
                scored.append((score, pid, fwd, nxt, use_seg))

            scored.sort(key=lambda t: t[0], reverse=True)
            _, pid, fwd, nxt, use_seg = scored[0]
            loop.append((pid, fwd))
            local_used.append(pid)
            prev_node, curr_node = curr_node, nxt
            curr_seg = use_seg

        return loop, local_used, False

    while unused:
        seed = next(iter(unused))
        best = None
        for fwd in (True, False):
            loop, used_local, ok = try_walk(seed, fwd)
            if ok:
                best = (loop, used_local)
                break
        if best is None:
            # consume seed to avoid infinite loop
            unused.remove(seed)
            continue
        loop, used_local = best
        for pid in used_local:
            unused.discard(pid)
        loops.append(loop)

    return loops


def loops_to_path_d(loops: list[list[tuple[int, bool]]], pieces: list[Piece]):
    parts: list[str] = []
    for loop in loops:
        if not loop:
            continue
        first_pid, first_fwd = loop[0]
        first_seg = pieces[first_pid].seg if first_fwd else pieces[first_pid].seg.reversed()
        parts.append(f"M {fmt(first_seg.start.real)} {fmt(first_seg.start.imag)}")
        for pid, fwd in loop:
            seg = pieces[pid].seg if fwd else pieces[pid].seg.reversed()
            parts.append(segment_cmd(seg))
        parts.append("Z")
    return " ".join(parts)


def build_face_loops(pieces: list[Piece]):
    # Directed half-edge ids: hid = piece_idx*2 + (0 forward, 1 reverse)
    def hid_piece(hid: int) -> int:
        return hid // 2

    def hid_fwd(hid: int) -> bool:
        return (hid % 2) == 0

    def hid_start_end(hid: int) -> tuple[int, int]:
        p = pieces[hid_piece(hid)]
        if hid_fwd(hid):
            return p.u, p.v
        return p.v, p.u

    outgoing: dict[int, list[tuple[float, int]]] = {}
    for p in pieces:
        f_seg = p.seg
        r_seg = p.seg.reversed()
        f_ang = math.atan2(seg_tangent(f_seg, 1e-4).imag, seg_tangent(f_seg, 1e-4).real)
        r_ang = math.atan2(seg_tangent(r_seg, 1e-4).imag, seg_tangent(r_seg, 1e-4).real)
        f_hid = p.idx * 2
        r_hid = p.idx * 2 + 1
        outgoing.setdefault(p.u, []).append((f_ang, f_hid))
        outgoing.setdefault(p.v, []).append((r_ang, r_hid))

    outgoing_sorted: dict[int, list[int]] = {}
    for nid, arr in outgoing.items():
        arr.sort(key=lambda t: t[0])  # CCW
        outgoing_sorted[nid] = [hid for _, hid in arr]

    visited: set[int] = set()
    loops: list[list[int]] = []
    max_hid = len(pieces) * 2
    for start_hid in range(max_hid):
        if start_hid in visited:
            continue
        loop: list[int] = []
        h = start_hid
        ok = False
        for _ in range(max_hid + 10):
            if h in visited:
                if h == start_hid:
                    ok = True
                break
            visited.add(h)
            loop.append(h)

            _, v = hid_start_end(h)
            outs = outgoing_sorted.get(v, [])
            if not outs:
                break
            twin = h ^ 1
            try:
                idx = outs.index(twin)
            except ValueError:
                break
            # next edge for left-face traversal
            h = outs[(idx - 1) % len(outs)]
            if h == start_hid:
                ok = True
                break
        if ok and loop:
            loops.append(loop)

    return loops


def face_loop_to_oriented_edges(loop: list[int], pieces: list[Piece]) -> list[tuple[int, bool]]:
    out: list[tuple[int, bool]] = []
    for hid in loop:
        pid = hid // 2
        fwd = (hid % 2) == 0
        out.append((pid, fwd))
    return out


def loop_to_polygon(loop: list[int], pieces: list[Piece]) -> Polygon | None:
    coords: list[tuple[float, float]] = []
    oriented = face_loop_to_oriented_edges(loop, pieces)
    for pid, fwd in oriented:
        seg = pieces[pid].seg if fwd else pieces[pid].seg.reversed()
        pts = sample_segment(seg, px_step=3.0)
        if coords:
            coords.extend(pts[1:])
        else:
            coords.extend(pts)
    if len(coords) < 4:
        return None
    if coords[0] != coords[-1]:
        coords.append(coords[0])
    poly = Polygon(coords)
    if not poly.is_valid:
        poly = poly.buffer(0)
    if poly.is_empty or not isinstance(poly, Polygon):
        return None
    if poly.area < 1.0:
        return None
    return poly


def seg_len(seg) -> float:
    try:
        return float(seg.length(error=1e-3))
    except Exception:
        return float(abs(seg.end - seg.start))


def shortest_oriented_path(
    pieces: list[Piece],
    start_node: int,
    end_node: int,
    *,
    kind: str,
    allow_sources: set[str],
) -> list[tuple[int, bool]] | None:
    import heapq

    adj: dict[int, list[tuple[int, float, int, bool]]] = {}
    for p in pieces:
        if p.kind != kind or p.source not in allow_sources:
            continue
        w = seg_len(p.seg)
        adj.setdefault(p.u, []).append((p.v, w, p.idx, True))
        adj.setdefault(p.v, []).append((p.u, w, p.idx, False))

    pq: list[tuple[float, int]] = [(0.0, start_node)]
    dist: dict[int, float] = {start_node: 0.0}
    prev: dict[int, tuple[int, int, bool]] = {}
    while pq:
        d, u = heapq.heappop(pq)
        if d != dist.get(u):
            continue
        if u == end_node:
            break
        for v, w, pid, fwd in adj.get(u, []):
            nd = d + w
            if nd < dist.get(v, 1e30):
                dist[v] = nd
                prev[v] = (u, pid, fwd)
                heapq.heappush(pq, (nd, v))

    if end_node not in dist:
        return None

    seq: list[tuple[int, bool]] = []
    cur = end_node
    while cur != start_node:
        u, pid, fwd = prev[cur]
        seq.append((pid, fwd))
        cur = u
    seq.reverse()
    return seq


def nearest_sea_coast_node(
    pieces: list[Piece],
    *,
    sea_source: str,
    coast_sources: set[str],
) -> int | None:
    node_pt: dict[int, complex] = {}
    coast_nodes: set[int] = set()
    coast_pts: list[complex] = []

    for p in pieces:
        node_pt.setdefault(p.u, p.seg.start)
        node_pt.setdefault(p.v, p.seg.end)
        if p.kind == "coast" and p.source in coast_sources:
            coast_nodes.add(p.u)
            coast_nodes.add(p.v)
            coast_pts.append(p.seg.start)
            coast_pts.append(p.seg.end)

    if not coast_pts:
        return None

    best_d = 1e30
    best_node: int | None = None
    for p in pieces:
        if p.kind != "sea" or p.source != sea_source:
            continue
        for node, pt in ((p.u, p.seg.start), (p.v, p.seg.end)):
            if node in coast_nodes:
                d = 0.0
            else:
                d = min(abs(pt - cp) for cp in coast_pts)
            if d < best_d:
                best_d = d
                best_node = node
    return best_node


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--board-geometry", default="games/indonesia-ui/src/lib/definitions/boardGeometry.ts")
    parser.add_argument("--sea-svg", default="games/indonesia-ui/src/lib/images/sea_lines.svg")
    parser.add_argument("--target-count", type=int, default=20)
    parser.add_argument("--snap-tol", type=float, default=3.0)
    parser.add_argument("--min-zone-area", type=float, default=75.0)
    parser.add_argument("--min-piece-area", type=float, default=10.0)
    parser.add_argument("--match-tol", type=float, default=2.0)
    parser.add_argument("--node-snap", type=float, default=2.4)
    parser.add_argument("--attach-tol", type=float, default=2.0)
    parser.add_argument("--out-report", default="games/indonesia-ui/src/lib/images/sea_area_borders_report.txt")
    parser.add_argument("--out-overlay", default="games/indonesia-ui/src/lib/images/sea_area_borders_labels.svg")
    parser.add_argument("--out-paths", default="games/indonesia-ui/src/lib/images/sea_areas_curved_paths.txt")
    parser.add_argument("--out-face-debug", default="games/indonesia-ui/src/lib/images/sea_area_face_debug.txt")
    parser.add_argument(
        "--out-p24-candidates",
        default="games/indonesia-ui/src/lib/images/sea_area_p24_candidates.txt",
    )
    parser.add_argument(
        "--out-targeted-overlay",
        default="games/indonesia-ui/src/lib/images/sea_area_targeted_p24_overlay.svg",
    )
    parser.add_argument(
        "--out-p24-split-paths",
        default="games/indonesia-ui/src/lib/images/sea_areas_p24_split_paths.txt",
    )
    parser.add_argument("--label-size", type=float, default=14.0)
    args = parser.parse_args()

    area_paths, area_polys, land_union = parse_land(Path(args.board_geometry))
    area_path_by_id = parse_all_area_paths(Path(args.board_geometry))
    board_poly, board_d, sea_paths = parse_sea_svg(Path(args.sea_svg))

    # Coastline source segments (from board geometry area curves/lines)
    land_prepped = prep(land_union.buffer(0.2))
    sources: list[SourceSeg] = []
    src_idx = 0
    for aid, d in area_paths:
        for seg in parse_path(d):
            if is_coast_segment(seg, land_prepped):
                sources.append(SourceSeg(src_idx, "coast", aid, seg, seg_bbox(seg)))
                src_idx += 1

    # Sea divider source segments
    for sp in sea_paths:
        for seg in parse_path(sp.d):
            sources.append(SourceSeg(src_idx, "sea", f"P{sp.id_num:02d}", seg, seg_bbox(seg)))
            src_idx += 1

    # Board edges source segments
    board_path = parse_path(board_d)
    edge_names = ["TOP", "RIGHT", "BOTTOM", "LEFT"]
    for i, seg in enumerate(board_path):
        sources.append(SourceSeg(src_idx, "board", edge_names[i % 4], seg, seg_bbox(seg)))
        src_idx += 1

    n = len(sources)
    split_map: list[set[float]] = [set([0.0, 1.0]) for _ in range(n)]

    # Exact curve intersections (skip coast-coast to keep runtime tractable)
    for i in range(n):
        a = sources[i]
        for j in range(i + 1, n):
            b = sources[j]
            if a.kind == "coast" and b.kind == "coast":
                continue
            if a.kind == "board" and b.kind == "board":
                continue
            if not bbox_intersects(a.bbox, b.bbox, pad=2.0):
                continue
            try:
                hits = a.seg.intersect(b.seg)
            except Exception:
                hits = []
            for ta, tb in hits:
                ta = float(ta)
                tb = float(tb)
                if 1e-6 < ta < 1.0 - 1e-6:
                    split_map[i].add(ta)
                if 1e-6 < tb < 1.0 - 1e-6:
                    split_map[j].add(tb)

    # Near-attach sea/board endpoints to nearby segment interiors
    by_idx = {s.idx: s for s in sources}
    target_ids = [s.idx for s in sources if s.kind in ("coast", "sea", "board")]
    for s in sources:
        if s.kind not in ("sea", "board"):
            continue
        for ep in (s.seg.start, s.seg.end):
            px, py = float(ep.real), float(ep.imag)
            for tid in target_ids:
                if tid == s.idx:
                    continue
                tseg = by_idx[tid]
                if not bbox_intersects((px, py, px, py), tseg.bbox, pad=args.attach_tol + 1.0):
                    continue
                if abs(ep - tseg.seg.start) <= args.attach_tol or abs(ep - tseg.seg.end) <= args.attach_tol:
                    continue
                t, d = nearest_t_on_seg(tseg.seg, ep)
                if d <= args.attach_tol and 1e-4 < t < 1.0 - 1e-4:
                    split_map[tseg.idx].add(float(t))

    # Split to curve pieces
    raw_pieces: list[tuple[str, str, object]] = []
    for s in sources:
        ts = sorted(split_map[s.idx])
        dedup: list[float] = []
        for t in ts:
            if not dedup or abs(t - dedup[-1]) > 1e-6:
                dedup.append(t)
        for a, b in zip(dedup, dedup[1:]):
            if b - a <= 1e-6:
                continue
            seg = s.seg.cropped(a, b)
            try:
                length = float(seg.length(error=1e-3))
            except Exception:
                length = abs(seg.end - seg.start)
            if length < 0.35:
                continue
            raw_pieces.append((s.kind, s.source, seg))

    # Cluster endpoints into graph nodes
    cluster = NodeCluster(args.node_snap)
    pieces: list[Piece] = []
    for kind, source, seg in raw_pieces:
        u = cluster.add(float(seg.start.real), float(seg.start.imag))
        v = cluster.add(float(seg.end.real), float(seg.end.imag))
        if u == v:
            continue
        pieces.append(Piece(len(pieces), kind, source, seg, u, v))

    # Build planar faces directly from the curve graph
    face_loops = build_face_loops(pieces)
    sea_faces: list[tuple[Polygon, list[tuple[int, bool]], str]] = []
    face_debug_rows: list[str] = []
    p24_debug_rows: list[str] = []
    p24_candidates: list[tuple[Polygon, list[tuple[int, bool]], str, list[str], list[str], list[str]]] = []
    missing_a_candidate: tuple[Polygon, str, list[str], list[str], list[str]] | None = None
    target_missing_a_sea = {"P07", "P08", "P11"}
    target_missing_a_coast = {"A25", "A28", "A30", "A31"}
    for loop in face_loops:
        poly = loop_to_polygon(loop, pieces)
        if poly is None:
            continue
        oriented = face_loop_to_oriented_edges(loop, pieces)
        d = loops_to_path_d([oriented], pieces)
        sea_ids = sorted({pieces[pid].source for pid, _ in oriented if pieces[pid].kind == "sea"})
        board_ids = sorted({pieces[pid].source for pid, _ in oriented if pieces[pid].kind == "board"})
        coast_ids = sorted({pieces[pid].source for pid, _ in oriented if pieces[pid].kind == "coast"})
        rp = poly.representative_point()
        in_board = board_poly.buffer(0.5).contains(rp)
        in_land = land_union.buffer(0.2).contains(rp)
        if "P24" in sea_ids:
            p24_debug_rows.append(
                f"area={poly.area:.2f} in_board={in_board} in_land={in_land} "
                f"sea={','.join(sea_ids) if sea_ids else 'none'} "
                f"board={','.join(board_ids) if board_ids else 'none'} coast={','.join(coast_ids) if coast_ids else 'none'}"
            )
            if in_board:
                p24_candidates.append((poly, oriented, d, sea_ids, board_ids, coast_ids))
        if not in_board:
            continue
        if in_land:
            if target_missing_a_sea.issubset(set(sea_ids)) and target_missing_a_coast.issubset(set(coast_ids)):
                if missing_a_candidate is None or poly.area > missing_a_candidate[0].area:
                    missing_a_candidate = (poly, d, sea_ids, board_ids, coast_ids)
            continue
        face_debug_rows.append(
            f"area={poly.area:.2f} edges={len(oriented)} sea={','.join(sea_ids) if sea_ids else 'none'} "
            f"board={','.join(board_ids) if board_ids else 'none'} coast={','.join(coast_ids) if coast_ids else 'none'}"
        )
        sea_faces.append((poly, oriented, d))

    sea_faces.sort(key=lambda t: t[0].area, reverse=True)
    chosen_faces = sea_faces[: args.target_count]
    dropped_faces = sea_faces[args.target_count :]

    manual_cutouts: dict[str, list[str]] = {
        "S01": ["E01", "E02", "E03", "E10", "E04", "E05", "E06"],
        "S04": ["C19", "C20"],
        "S06": ["A05", "A06", "A09"],
        "S07": ["E08", "E09", "E07", "E11", "C18"],
        "S08": ["C25", "C28", "C27", "C29", "C30"],
        "S11": ["A33"],
        "S14": ["A02"],
        "S15": ["C16"],
    }

    face_path_overrides: dict[str, str] = {}
    for i, (_poly, _oriented, d) in enumerate(chosen_faces, start=1):
        sid = f"S{i:02d}"
        cutouts = manual_cutouts.get(sid, [])
        hole_parts = [reverse_path_d(area_path_by_id[c]) for c in cutouts if c in area_path_by_id]
        face_path_overrides[sid] = " ".join([d] + hole_parts).strip() if hole_parts else d

    # Report
    report_lines = [
        "Sea Area Border Components",
        "",
        f"Sea SVG: {args.sea_svg}",
        f"Sea divider paths parsed: {len(sea_paths)}",
        f"Source segments: {len(sources)}",
        f"Split curve pieces: {len(pieces)}",
        f"Snap tolerance (zones helper): {args.snap_tol}",
        f"Target sea areas: {args.target_count}",
        f"Candidate sea faces: {len(sea_faces)}",
        f"Chosen faces: {len(chosen_faces)}",
        f"Dropped faces: {len(dropped_faces)}",
        "",
        "Note: Sea paths below are closed curved paths assembled from source sea lines, board edge segments, and coastline segments.",
        "",
    ]

    out_path_lines: list[str] = []
    for i, (poly, oriented, d) in enumerate(chosen_faces, start=1):
        sid = f"S{i:02d}"
        draw_d = face_path_overrides.get(sid, d)
        out_path_lines.append(f"{sid}= {draw_d}")

        sea_ids = sorted({pieces[pid].source for pid, _ in oriented if pieces[pid].kind == "sea"})
        board_ids = sorted({pieces[pid].source for pid, _ in oriented if pieces[pid].kind == "board"})
        coast_ids = sorted({pieces[pid].source for pid, _ in oriented if pieces[pid].kind == "coast"})

        report_lines.append(
            f"{sid}: face_area={poly.area:.2f} edges={len(oriented)}"
        )
        report_lines.append("  sea_paths=" + (", ".join(sea_ids) if sea_ids else "none"))
        report_lines.append("  board_edges=" + (", ".join(board_ids) if board_ids else "none"))
        report_lines.append("  coast_areas=" + (", ".join(coast_ids) if coast_ids else "none"))
        cutouts = [c for c in manual_cutouts.get(sid, []) if c in area_path_by_id]
        if cutouts:
            report_lines.append("  manual_cutouts=" + ", ".join(cutouts))

    Path(args.out_report).write_text("\n".join(report_lines) + "\n")
    Path(args.out_paths).write_text("\n".join(out_path_lines) + "\n")
    face_debug_rows.sort(reverse=True)
    debug_text = ["[WATER FACES]"] + face_debug_rows + ["", "[P24 LOOPS ANY CLASS]"] + p24_debug_rows
    Path(args.out_face_debug).write_text("\n".join(debug_text) + "\n")

    # P24 targeted candidates (for splitting combined residual)
    p24_lines: list[str] = []
    p24_split_lines: list[str] = []
    p24_idx = 1
    split_defs: dict[str, str] = {}
    split_outer_defs: dict[str, str] = {}
    split_label_polys: dict[str, Polygon] = {}
    for poly, oriented, d, sea_ids, board_ids, coast_ids in p24_candidates:
        tag = f"P24C{p24_idx:02d}"
        cutouts: list[str] = []
        if "C21" in coast_ids and "C22" in coast_ids:
            tag = "MISSING_C21C22"
            cutouts = ["C23", "C24", "C26"]
        elif "D10" in coast_ids and "D11" in coast_ids:
            tag = "S17_DSIDE"
            # Temporary fallback; overridden below by explicit piece-chain build.
            cutouts = ["D13"]
        hole_parts = [reverse_path_d(area_path_by_id[c]) for c in cutouts if c in area_path_by_id]
        split_path_d = " ".join([d] + hole_parts).strip()
        if tag == "S17_DSIDE":
            split_defs["S17"] = split_path_d
            split_outer_defs["S17"] = d
            split_label_polys["S17"] = poly
        if tag == "MISSING_C21C22":
            split_defs["S18"] = split_path_d
            split_outer_defs["S18"] = d
            split_label_polys["S18"] = poly
        p24_lines.append(f"{tag}: area={poly.area:.2f}")
        p24_lines.append("  sea_paths=" + (", ".join(sea_ids) if sea_ids else "none"))
        p24_lines.append("  board_edges=" + (", ".join(board_ids) if board_ids else "none"))
        p24_lines.append("  coast_areas=" + (", ".join(coast_ids) if coast_ids else "none"))
        p24_lines.append("  suggested_cutouts=" + (", ".join(cutouts) if cutouts else "none"))
        p24_lines.append(f"  path= {split_path_d}")
        p24_idx += 1

    if missing_a_candidate is not None:
        poly, d, sea_ids, board_ids, coast_ids = missing_a_candidate
        cutouts = ["A32"]
        hole_parts = [reverse_path_d(area_path_by_id[c]) for c in cutouts if c in area_path_by_id]
        split_path_d = " ".join([d] + hole_parts).strip()
        split_defs["S19"] = split_path_d
        split_outer_defs["S19"] = d
        split_label_polys["S19"] = poly
        p24_lines.append(f"MISSING_A25A28A30A31: area={poly.area:.2f}")
        p24_lines.append("  sea_paths=" + (", ".join(sea_ids) if sea_ids else "none"))
        p24_lines.append("  board_edges=" + (", ".join(board_ids) if board_ids else "none"))
        p24_lines.append("  coast_areas=" + (", ".join(coast_ids) if coast_ids else "none"))
        p24_lines.append("  suggested_cutouts=A32")
        p24_lines.append(f"  path= {split_path_d}")

    # Rebuild S17 from true segment chains:
    # sea chain on P25/P23/P24/P27/P30/P40/P41 plus coast chain on D08/D09/D10/D11,
    # with only D13 as cutout.
    s17_sea_allow = {"P23", "P24", "P25", "P27", "P30", "P40", "P41"}
    s17_coast_allow = {"D08", "D09", "D10", "D11"}
    s17_n25 = nearest_sea_coast_node(pieces, sea_source="P25", coast_sources=s17_coast_allow)
    s17_n40 = nearest_sea_coast_node(pieces, sea_source="P40", coast_sources=s17_coast_allow)
    if s17_n25 is not None and s17_n40 is not None:
        s17_sea_path = shortest_oriented_path(
            pieces,
            s17_n25,
            s17_n40,
            kind="sea",
            allow_sources=s17_sea_allow,
        )
        s17_coast_path = shortest_oriented_path(
            pieces,
            s17_n40,
            s17_n25,
            kind="coast",
            allow_sources=s17_coast_allow,
        )
        if s17_sea_path and s17_coast_path:
            s17_oriented = s17_sea_path + s17_coast_path
            s17_outer = loops_to_path_d([s17_oriented], pieces)
            d13_hole = reverse_path_d(area_path_by_id["D13"]) if "D13" in area_path_by_id else ""
            split_defs["S17"] = " ".join([s17_outer, d13_hole]).strip()
            split_outer_defs["S17"] = s17_outer
            s17_loop_hids = [pid * 2 + (0 if fwd else 1) for pid, fwd in s17_oriented]
            s17_poly = loop_to_polygon(s17_loop_hids, pieces)
            if s17_poly is not None:
                split_label_polys["S17"] = s17_poly
            p24_lines.append("S17_OVERRIDE: reconstructed from sea/coast piece chains")
            p24_lines.append("  sea_paths=P23, P24, P25, P27, P30, P40, P41")
            p24_lines.append("  coast_chain=D08, D09, D10, D11")
            p24_lines.append("  cutout=D13")
            p24_lines.append(f"  path= {split_defs['S17']}")

    Path(args.out_p24_candidates).write_text("\n".join(p24_lines) + "\n")
    if "S17" in split_defs:
        p24_split_lines.append(f"S17= {split_defs['S17']}")
    if "S18" in split_defs:
        p24_split_lines.append(f"S18= {split_defs['S18']}")
    if "S19" in split_defs:
        p24_split_lines.append(f"S19= {split_defs['S19']}")
    Path(args.out_p24_split_paths).write_text("\n".join(p24_split_lines) + "\n")

    # Overlay: source dividers + reconstructed closed sea paths
    minx, miny, maxx, maxy = board_poly.bounds
    overlay = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{int(maxx+65)}" height="{int(maxy+67)}" viewBox="0 0 {int(maxx+65)} {int(maxy+67)}">',
        '<image href="indo_map_sm.jpg" x="0" y="0" width="2646" height="1280"/>',
        f'<path d="{board_d}" fill="none" stroke="#ffd000" stroke-width="2"/>',
    ]

    for sp in sea_paths:
        overlay.append(
            f'<path d="{sp.d}" fill="none" stroke="#77bfff" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>'
        )

    random.seed(12)
    for i, (poly, _oriented, d) in enumerate(chosen_faces, start=1):
        sid = f"S{i:02d}"
        if not d:
            continue
        draw_d = face_path_overrides.get(sid, d)
        r = random.randint(90, 220)
        g = random.randint(90, 220)
        b = random.randint(90, 220)
        overlay.append(
            f'<path d="{draw_d}" fill="rgb({r},{g},{b})" fill-opacity="0.22" fill-rule="evenodd" stroke="none"/>'
        )
        overlay.append(
            f'<path d="{d}" fill="none" stroke="#cc0000" stroke-width="1.4"/>'
        )
        rp = poly.representative_point()
        overlay.append(
            f'<text x="{fmt(rp.x)}" y="{fmt(rp.y)}" font-size="{fmt(args.label_size)}" fill="#111" stroke="#fff" stroke-width="1.2" paint-order="stroke">{sid}</text>'
        )

    overlay.append("</svg>")
    Path(args.out_overlay).write_text("\n".join(overlay))

    # Targeted overlay: keep known-good set filled, plus P24 split candidates highlighted
    targeted = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{int(maxx+65)}" height="{int(maxy+67)}" viewBox="0 0 {int(maxx+65)} {int(maxy+67)}">',
        '<image href="indo_map_sm.jpg" x="0" y="0" width="2646" height="1280"/>',
        f'<path d="{board_d}" fill="none" stroke="#ffd000" stroke-width="2"/>',
    ]
    # Sea dividers
    for sp in sea_paths:
        targeted.append(
            f'<path d="{sp.d}" fill="none" stroke="#7ec3ff" stroke-width="1.1" opacity="0.7"/>'
        )
    # Fill current known-good set (exclude S09 and replace S17 via split_defs below)
    for i, (poly, _oriented, d) in enumerate(chosen_faces, start=1):
        sid = f"S{i:02d}"
        if sid in ("S09", "S17"):
            continue
        draw_d = face_path_overrides.get(sid, d)
        targeted.append(
            f'<path d="{draw_d}" fill="#4caf50" fill-opacity="0.20" fill-rule="evenodd" stroke="none"/>'
        )
        targeted.append(
            f'<path d="{d}" fill="none" stroke="#2e7d32" stroke-width="1.1"/>'
        )
        rp = poly.representative_point()
        targeted.append(
            f'<text x="{fmt(rp.x)}" y="{fmt(rp.y)}" font-size="12" fill="#1b5e20" stroke="#fff" stroke-width="0.9" paint-order="stroke">{sid}</text>'
        )

    # Render corrected S17/S18/S19 as good areas
    for sid in ("S17", "S18", "S19"):
        draw_d = split_defs.get(sid, "")
        if not draw_d:
            continue
        outer_d = split_outer_defs.get(sid, draw_d)
        targeted.append(
            f'<path d="{draw_d}" fill="#4caf50" fill-opacity="0.20" fill-rule="evenodd" stroke="none"/>'
        )
        targeted.append(
            f'<path d="{outer_d}" fill="none" stroke="#2e7d32" stroke-width="1.1"/>'
        )
        candidate_poly = split_label_polys.get(sid)
        if candidate_poly is None:
            continue
        rp = candidate_poly.representative_point()
        targeted.append(
            f'<text x="{fmt(rp.x)}" y="{fmt(rp.y)}" font-size="12" fill="#1b5e20" stroke="#fff" stroke-width="0.9" paint-order="stroke">{sid}</text>'
        )

    targeted.append("</svg>")
    Path(args.out_targeted_overlay).write_text("\n".join(targeted))

    print("sea_paths", len(sea_paths))
    print("source_segments", len(sources))
    print("pieces", len(pieces))
    print("candidate_sea_faces", len(sea_faces))
    print("chosen", len(chosen_faces))
    print("wrote", args.out_report)
    print("wrote", args.out_paths)
    print("wrote", args.out_face_debug)
    print("wrote", args.out_p24_candidates)
    print("wrote", args.out_p24_split_paths)
    print("wrote", args.out_targeted_overlay)
    print("wrote", args.out_overlay)


if __name__ == "__main__":
    main()
