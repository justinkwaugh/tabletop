#!/usr/bin/env python3
from __future__ import annotations

import argparse
import math
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np
from scipy.interpolate import splprep, splev
from skimage.morphology import skeletonize


NEIGHBORS = [
    (-1, -1),
    (-1, 0),
    (-1, 1),
    (0, -1),
    (0, 1),
    (1, -1),
    (1, 0),
    (1, 1),
]


@dataclass(frozen=True)
class Pix:
    y: int
    x: int


def fmt(v: float) -> str:
    v = round(float(v), 2)
    iv = int(round(v))
    if abs(v - iv) < 1e-9:
        return str(iv)
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s == "-0" else s


def edge_weight(a: Pix, b: Pix) -> float:
    return math.hypot(a.x - b.x, a.y - b.y)


def rdp(points: np.ndarray, eps: float) -> np.ndarray:
    if len(points) < 3:
        return points
    keep = np.zeros(len(points), dtype=bool)
    keep[0] = True
    keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        i, j = stack.pop()
        a = points[i]
        b = points[j]
        ab = b - a
        lab = np.hypot(ab[0], ab[1])
        if lab < 1e-9:
            continue
        seg = points[i + 1 : j]
        if len(seg) == 0:
            continue
        t = ((seg - a) @ ab) / (lab * lab)
        proj = a + t[:, None] * ab
        d = np.hypot(seg[:, 0] - proj[:, 0], seg[:, 1] - proj[:, 1])
        k = int(np.argmax(d))
        dmax = float(d[k])
        if dmax > eps:
            m = i + 1 + k
            keep[m] = True
            stack.append((i, m))
            stack.append((m, j))
    return points[keep]


def _dedupe_consecutive(points_xy: np.ndarray) -> np.ndarray:
    if len(points_xy) < 2:
        return points_xy
    out = [points_xy[0]]
    for p in points_xy[1:]:
        if np.hypot(*(p - out[-1])) > 1e-6:
            out.append(p)
    return np.asarray(out, dtype=float)


def smooth_points(points_xy: np.ndarray) -> np.ndarray:
    pts = _dedupe_consecutive(points_xy.astype(float))
    n = len(pts)
    if n < 4:
        return pts
    eps = 0.9 if n < 90 else 1.2
    simp = rdp(pts, eps)
    if len(simp) < 4:
        simp = pts
    if len(simp) > 80:
        idx = np.linspace(0, len(simp) - 1, 80)
        simp = simp[np.round(idx).astype(int)]
    try:
        x = simp[:, 0]
        y = simp[:, 1]
        s = max(0.0, len(simp) * 0.12)
        k = min(3, len(simp) - 1)
        tck, _ = splprep([x, y], s=s, k=k)
        m = max(8, min(90, len(simp)))
        uu = np.linspace(0, 1, m)
        xs, ys = splev(uu, tck)
        sm = np.stack([xs, ys], axis=1)
        return rdp(sm, 0.7)
    except Exception:
        return simp


def path_length(points_xy: np.ndarray) -> float:
    if len(points_xy) < 2:
        return 0.0
    return float(np.sum(np.hypot(np.diff(points_xy[:, 0]), np.diff(points_xy[:, 1]))))


def path_midpoint(points_xy: np.ndarray) -> np.ndarray:
    if len(points_xy) == 0:
        return np.array([0.0, 0.0], dtype=float)
    if len(points_xy) == 1:
        return points_xy[0]
    seg = np.hypot(np.diff(points_xy[:, 0]), np.diff(points_xy[:, 1]))
    total = float(np.sum(seg))
    if total < 1e-9:
        return points_xy[len(points_xy) // 2]
    target = 0.5 * total
    acc = 0.0
    for i, d in enumerate(seg):
        if acc + float(d) >= target:
            t = (target - acc) / max(1e-9, float(d))
            return points_xy[i] + t * (points_xy[i + 1] - points_xy[i])
        acc += float(d)
    return points_xy[-1]


def path_label_anchor(points_xy: np.ndarray, offset: float = 10.0) -> tuple[float, float]:
    if len(points_xy) < 2:
        p = path_midpoint(points_xy)
        return float(p[0]), float(p[1])
    p = path_midpoint(points_xy)
    i = int(np.argmin(np.hypot(points_xy[:, 0] - p[0], points_xy[:, 1] - p[1])))
    i0 = max(0, i - 1)
    i1 = min(len(points_xy) - 1, i + 1)
    t = points_xy[i1] - points_xy[i0]
    n = np.array([-t[1], t[0]], dtype=float)
    nn = float(np.hypot(n[0], n[1]))
    if nn < 1e-9:
        return float(p[0]), float(p[1])
    n /= nn
    a = p + offset * n
    return float(a[0]), float(a[1])


def catmull_rom_to_cubic(points: np.ndarray) -> str:
    if len(points) < 2:
        return ""
    if len(points) == 2:
        return f"M {fmt(points[0,0])} {fmt(points[0,1])} L {fmt(points[1,0])} {fmt(points[1,1])}"
    ext = np.vstack([points[0], points, points[-1]])
    out = [f"M {fmt(points[0,0])} {fmt(points[0,1])}"]
    for i in range(1, len(ext) - 2):
        p0, p1, p2, p3 = ext[i - 1], ext[i], ext[i + 1], ext[i + 2]
        c1 = p1 + (p2 - p0) / 6.0
        c2 = p2 - (p3 - p1) / 6.0
        out.append(
            f"C {fmt(c1[0])} {fmt(c1[1])} {fmt(c2[0])} {fmt(c2[1])} {fmt(p2[0])} {fmt(p2[1])}"
        )
    return " ".join(out)


def _cluster_indices(idxs: list[int], tol: int = 3) -> list[tuple[float, int]]:
    if not idxs:
        return []
    idxs = sorted(idxs)
    groups: list[list[int]] = [[idxs[0]]]
    for v in idxs[1:]:
        if abs(v - groups[-1][-1]) <= tol:
            groups[-1].append(v)
        else:
            groups.append([v])
    return [(float(np.mean(g)), len(g)) for g in groups]


def _pick_inner_peak(
    profile: np.ndarray,
    min_strength: float,
    side: str,
    offset: int = 0,
) -> float:
    idxs = [i for i, v in enumerate(profile.tolist()) if v >= min_strength]
    clusters = _cluster_indices(idxs, tol=3)
    if not clusters:
        return float(offset)
    centers = [c[0] for c in clusters]
    # "inner" means farther from outer edge on left/top, closer to outer edge on right/bottom
    if side in ("left", "top"):
        return float(offset + max(centers))
    return float(offset + min(centers))


def detect_board_frame(img_bgr: np.ndarray) -> tuple[float, float, float, float]:
    h, w = img_bgr.shape[:2]
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    dark = (gray < 90).astype(np.uint8)

    band = 120
    left_prof = dark[:, :band].mean(axis=0)
    right_prof = dark[:, w - band :].mean(axis=0)
    top_prof = dark[:band, :].mean(axis=1)
    bot_prof = dark[h - band :, :].mean(axis=1)

    # tune for border lines that span most of the board width/height
    x_left = _pick_inner_peak(left_prof, min_strength=0.80, side="left", offset=0)
    x_right = _pick_inner_peak(right_prof, min_strength=0.80, side="right", offset=w - band)
    y_top = _pick_inner_peak(top_prof, min_strength=0.80, side="top", offset=0)
    y_bottom = _pick_inner_peak(bot_prof, min_strength=0.80, side="bottom", offset=h - band)

    # sanity fallback
    if x_right - x_left < 2000 or y_bottom - y_top < 900:
        x_left, y_top, x_right, y_bottom = 30.0, 30.0, float(w - 30), float(h - 30)
    return x_left, y_top, x_right, y_bottom


def build_blue_mask(
    img_bgr: np.ndarray,
    component_area_min: int,
    morph_kernel: int,
    open_iters: int,
    close_iters: int,
    h_min: int,
    h_max: int,
    s_min: int,
    s_max: int,
    v_min: int,
    v_max: int,
) -> np.ndarray:
    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
    low = np.array([h_min, s_min, v_min], dtype=np.uint8)
    high = np.array([h_max, s_max, v_max], dtype=np.uint8)
    mask = cv2.inRange(hsv, low, high)
    k = max(1, int(morph_kernel))
    kernel = np.ones((k, k), np.uint8)
    if close_iters > 0:
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=close_iters)
    if open_iters > 0:
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=open_iters)

    num, labels, stats, _ = cv2.connectedComponentsWithStats((mask > 0).astype(np.uint8), connectivity=8)
    keep = np.zeros_like(mask)
    for i in range(1, num):
        area = int(stats[i, cv2.CC_STAT_AREA])
        if area >= component_area_min:
            keep[labels == i] = 255
    return keep


def pix_neighbors(p: Pix, pixset: set[Pix]) -> list[Pix]:
    out: list[Pix] = []
    for dy, dx in NEIGHBORS:
        q = Pix(p.y + dy, p.x + dx)
        if q in pixset:
            out.append(q)
    return out


def _edge_key(a: Pix, b: Pix) -> tuple[Pix, Pix]:
    return (a, b) if (a.x, a.y) <= (b.x, b.y) else (b, a)


def _trace_from(
    start: Pix,
    nxt: Pix,
    neighbors: dict[Pix, list[Pix]],
    key_nodes: set[Pix],
    visited: set[tuple[Pix, Pix]],
) -> list[Pix]:
    chain = [start, nxt]
    visited.add(_edge_key(start, nxt))
    prev = start
    cur = nxt
    max_steps = 30000
    steps = 0
    while steps < max_steps:
        steps += 1
        if cur in key_nodes and cur != start:
            break
        cand = [q for q in neighbors[cur] if q != prev]
        if not cand:
            break
        unvisited = [q for q in cand if _edge_key(cur, q) not in visited]
        q = sorted(unvisited or cand, key=lambda p: (p.x, p.y))[0]
        e = _edge_key(cur, q)
        if e in visited and q != chain[0]:
            break
        chain.append(q)
        visited.add(e)
        prev, cur = cur, q
        if cur == chain[0]:
            break
    return chain


def extract_branch_paths(skel: np.ndarray) -> list[np.ndarray]:
    ys, xs = np.where(skel > 0)
    pixset = set(Pix(int(y), int(x)) for y, x in zip(ys, xs))
    if not pixset:
        return []

    neighbors = {p: pix_neighbors(p, pixset) for p in pixset}
    deg = {p: len(neighbors[p]) for p in pixset}
    key_nodes = {p for p, d in deg.items() if d != 2}
    visited: set[tuple[Pix, Pix]] = set()
    raw_chains: list[list[Pix]] = []

    # First pass: maximal chains between key nodes (junctions/endpoints).
    for k in sorted(key_nodes, key=lambda p: (p.x, p.y)):
        for n in sorted(neighbors[k], key=lambda p: (p.x, p.y)):
            if _edge_key(k, n) in visited:
                continue
            raw_chains.append(_trace_from(k, n, neighbors, key_nodes, visited))

    # Second pass: any remaining degree-2 cycles/components not touched in pass one.
    for a in sorted(pixset, key=lambda p: (p.x, p.y)):
        for b in sorted(neighbors[a], key=lambda p: (p.x, p.y)):
            if _edge_key(a, b) in visited:
                continue
            raw_chains.append(_trace_from(a, b, neighbors, key_nodes, visited))

    paths: list[np.ndarray] = []
    for chain in raw_chains:
        if len(chain) < 3:
            continue
        pts = np.array([(p.x, p.y) for p in chain], dtype=float)
        sm = smooth_points(pts)
        if len(sm) < 3:
            continue
        paths.append(sm)

    # De-duplicate by endpoint/center/length rough key
    uniq: list[np.ndarray] = []
    keys: set[tuple[tuple[int, int], tuple[int, int], int, int, int]] = set()
    for p in paths:
        s = (int(round(p[0, 0] / 2)), int(round(p[0, 1] / 2)))
        e = (int(round(p[-1, 0] / 2)), int(round(p[-1, 1] / 2)))
        if s > e:
            s, e = e, s
        cx = int(round(float(np.mean(p[:, 0])) / 8.0))
        cy = int(round(float(np.mean(p[:, 1])) / 8.0))
        ln = int(round(path_length(p) / 4.0))
        k = (s, e, cx, cy, ln)
        if k in keys:
            continue
        keys.add(k)
        uniq.append(p)

    # stable order
    uniq.sort(key=lambda arr: (float(np.mean(arr[:, 0])), float(np.mean(arr[:, 1]))))
    return uniq


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", default="games/indonesia-ui/src/lib/images/indo_map_sm.jpg")
    parser.add_argument("--out-svg", default="games/indonesia-ui/src/lib/images/sea_lines_boardedge_curved.svg")
    parser.add_argument(
        "--out-txt",
        default="games/indonesia-ui/src/lib/images/sea_lines_boardedge_curved_paths.txt",
    )
    parser.add_argument(
        "--out-debug",
        default="games/indonesia-ui/src/lib/images/sea_lines_boardedge_curved_debug.png",
    )
    parser.add_argument(
        "--out-labeled-svg",
        default="games/indonesia-ui/src/lib/images/sea_lines_boardedge_curved_labeled.svg",
    )
    parser.add_argument(
        "--out-labeled-png",
        default="games/indonesia-ui/src/lib/images/sea_lines_boardedge_curved_labeled.png",
    )
    parser.add_argument(
        "--out-labeled-dark-png",
        default="games/indonesia-ui/src/lib/images/sea_lines_boardedge_curved_labeled_dark.png",
    )
    parser.add_argument(
        "--out-report",
        default="games/indonesia-ui/src/lib/images/sea_lines_boardedge_curved_labeled_report.txt",
    )
    parser.add_argument(
        "--out-mask",
        default="games/indonesia-ui/src/lib/images/sea_lines_boardedge_mask_preview.png",
    )
    parser.add_argument("--component-area-min", type=int, default=240)
    parser.add_argument("--segment-length-min", type=float, default=18.0)
    parser.add_argument("--morph-kernel", type=int, default=3)
    parser.add_argument("--open-iters", type=int, default=1)
    parser.add_argument("--close-iters", type=int, default=2)
    parser.add_argument("--h-min", type=int, default=78)
    parser.add_argument("--h-max", type=int, default=116)
    parser.add_argument("--s-min", type=int, default=8)
    parser.add_argument("--s-max", type=int, default=170)
    parser.add_argument("--v-min", type=int, default=90)
    parser.add_argument("--v-max", type=int, default=250)
    args = parser.parse_args()

    image_path = Path(args.image)
    out_svg = Path(args.out_svg)
    out_txt = Path(args.out_txt)
    out_dbg = Path(args.out_debug)
    out_labeled_svg = Path(args.out_labeled_svg)
    out_labeled_png = Path(args.out_labeled_png)
    out_labeled_dark_png = Path(args.out_labeled_dark_png)
    out_report = Path(args.out_report)
    out_mask = Path(args.out_mask)

    img = cv2.imread(str(image_path))
    if img is None:
        raise SystemExit(f"failed to read image: {image_path}")
    h, w = img.shape[:2]

    frame = detect_board_frame(img)
    blue = build_blue_mask(
        img,
        args.component_area_min,
        args.morph_kernel,
        args.open_iters,
        args.close_iters,
        args.h_min,
        args.h_max,
        args.s_min,
        args.s_max,
        args.v_min,
        args.v_max,
    )
    cv2.imwrite(str(out_mask), blue)
    skel = skeletonize((blue > 0)).astype(np.uint8)
    paths = extract_branch_paths(skel)

    # filter tiny branches
    filtered: list[np.ndarray] = []
    for p in paths:
        plen = path_length(p)
        if plen >= args.segment_length_min:
            filtered.append(p)
    paths = filtered

    # write text output
    x_left, y_top, x_right, y_bottom = frame
    txt = [
        f"BOARD_EDGE= M {fmt(x_left)} {fmt(y_top)} L {fmt(x_right)} {fmt(y_top)} L {fmt(x_right)} {fmt(y_bottom)} L {fmt(x_left)} {fmt(y_bottom)} Z"
    ]
    for i, p in enumerate(paths, start=1):
        d = catmull_rom_to_cubic(p)
        txt.append(f"SEA_LINE_{i:02d}= {d}")
    out_txt.write_text("\n".join(txt) + "\n")

    # write basic svg overlay
    base_svg = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">',
        f'<image href="indo_map_sm.jpg" x="0" y="0" width="{w}" height="{h}"/>',
        f'<rect x="{fmt(x_left)}" y="{fmt(y_top)}" width="{fmt(x_right - x_left)}" height="{fmt(y_bottom - y_top)}" fill="none" stroke="#ffd000" stroke-width="2"/>',
    ]
    labeled_svg = base_svg.copy()
    report_lines = ["Labeled sea divider paths (curved extracted)", ""]

    labeled_png = img.copy()
    labeled_dark = cv2.convertScaleAbs(img, alpha=0.4, beta=0)
    cv2.rectangle(
        labeled_png,
        (int(round(x_left)), int(round(y_top))),
        (int(round(x_right)), int(round(y_bottom))),
        (0, 255, 255),
        2,
    )
    cv2.rectangle(
        labeled_dark,
        (int(round(x_left)), int(round(y_top))),
        (int(round(x_right)), int(round(y_bottom))),
        (0, 255, 255),
        2,
    )

    for i, p in enumerate(paths, start=1):
        d = catmull_rom_to_cubic(p)
        sid = f"SEA_LINE_{i:02d}"
        pid = f"P{i:02d}"
        plen = path_length(p)
        sx, sy = float(p[0, 0]), float(p[0, 1])
        ex, ey = float(p[-1, 0]), float(p[-1, 1])
        ax, ay = path_label_anchor(p)

        base_svg.append(
            f'<path id="{sid}" d="{d}" fill="none" stroke="#00d9ff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.92"/>'
        )
        labeled_svg.append(
            f'<path id="{sid}" d="{d}" fill="none" stroke="#ff2200" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.95"/>'
        )
        labeled_svg.append(
            f'<text x="{fmt(ax)}" y="{fmt(ay)}" font-size="11" fill="#ffe500" stroke="#000" stroke-width="0.9" paint-order="stroke">{pid}</text>'
        )
        report_lines.append(
            f"{pid}: {sid} | len={plen:.2f} | start=({sx:.2f},{sy:.2f}) | end=({ex:.2f},{ey:.2f})"
        )

        pts = np.round(p).astype(np.int32)
        cv2.polylines(labeled_png, [pts], False, (0, 0, 255), 2, cv2.LINE_AA)
        cv2.polylines(labeled_dark, [pts], False, (0, 0, 255), 2, cv2.LINE_AA)
        label = pid
        (tw, th), baseline = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.4, 1)
        x = int(round(ax))
        y = int(round(ay))
        for canvas in (labeled_png, labeled_dark):
            cv2.rectangle(canvas, (x - 2, y - th - 2), (x + tw + 2, y + baseline + 2), (0, 0, 0), -1)
            cv2.putText(
                canvas,
                label,
                (x, y),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.4,
                (0, 240, 255),
                1,
                cv2.LINE_AA,
            )
            cv2.circle(canvas, (x, y), 2, (0, 240, 255), -1, cv2.LINE_AA)

    base_svg.append("</svg>")
    labeled_svg.append("</svg>")
    out_svg.write_text("\n".join(base_svg))
    out_labeled_svg.write_text("\n".join(labeled_svg))
    out_report.write_text("\n".join(report_lines) + "\n")

    # write debug png
    dbg = img.copy()
    cv2.rectangle(
        dbg,
        (int(round(x_left)), int(round(y_top))),
        (int(round(x_right)), int(round(y_bottom))),
        (0, 255, 255),
        2,
    )
    for p in paths:
        pts = np.round(p).astype(np.int32)
        cv2.polylines(dbg, [pts], False, (255, 0, 0), 2, cv2.LINE_AA)
    cv2.imwrite(str(out_dbg), dbg)
    cv2.imwrite(str(out_labeled_png), labeled_png)
    cv2.imwrite(str(out_labeled_dark_png), labeled_dark)

    print("frame", round(x_left, 2), round(y_top, 2), round(x_right, 2), round(y_bottom, 2))
    print("paths", len(paths))
    print("wrote", out_svg)
    print("wrote", out_txt)
    print("wrote", out_dbg)
    print("wrote", out_labeled_svg)
    print("wrote", out_labeled_png)
    print("wrote", out_labeled_dark_png)
    print("wrote", out_report)
    print("wrote", out_mask)


if __name__ == "__main__":
    main()
