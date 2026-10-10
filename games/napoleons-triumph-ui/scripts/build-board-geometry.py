"""Generate src/lib/map/boardGeometry.ts from the transcribed board.

Usage: python3 -I scripts/build-board-geometry.py /workspace/artassets/napoleons-triumph

Board units are half a pixel of the 5100x6600 scan. Locale outlines come from the union of the
wedge zones around each locale; approach bars come from the fit against the printed bars.
"""
import json
import math
import os
import sys
from collections import deque

SCALE = 0.5
STEP = 4
SIMPLIFY = 7


def inside(x, y, polygon):
    result = False
    j = len(polygon) - 1
    for i in range(len(polygon)):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            result = not result
        j = i
    return result


def rasterize(wedges):
    xs = [p[0] for w in wedges for p in w]
    ys = [p[1] for w in wedges for p in w]
    x0, y0 = min(xs) - 2 * STEP, min(ys) - 2 * STEP
    cols = int((max(xs) - x0) / STEP) + 4
    rows = int((max(ys) - y0) / STEP) + 4
    mask = [[False] * cols for _ in range(rows)]
    for wedge in wedges:
        wx = [p[0] for p in wedge]
        wy = [p[1] for p in wedge]
        for r in range(max(0, int((min(wy) - y0) / STEP)), min(rows, int((max(wy) - y0) / STEP) + 2)):
            cy = y0 + (r + 0.5) * STEP
            for c in range(max(0, int((min(wx) - x0) / STEP)), min(cols, int((max(wx) - x0) / STEP) + 2)):
                if not mask[r][c] and inside(x0 + (c + 0.5) * STEP, cy, wedge):
                    mask[r][c] = True
    # close slivers between hand-drawn wedges: a cell with filled cells on opposite sides is filled
    for _ in range(2):
        for r in range(1, rows - 1):
            for c in range(1, cols - 1):
                if not mask[r][c] and ((mask[r][c - 1] and mask[r][c + 1]) or (mask[r - 1][c] and mask[r + 1][c])):
                    mask[r][c] = True
    return mask, x0, y0


def largest_component(mask):
    rows, cols = len(mask), len(mask[0])
    seen = [[False] * cols for _ in range(rows)]
    best = []
    for r in range(rows):
        for c in range(cols):
            if not mask[r][c] or seen[r][c]:
                continue
            cells = []
            queue = deque([(r, c)])
            seen[r][c] = True
            while queue:
                cr, cc = queue.popleft()
                cells.append((cr, cc))
                for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nr, nc = cr + dr, cc + dc
                    if 0 <= nr < rows and 0 <= nc < cols and mask[nr][nc] and not seen[nr][nc]:
                        seen[nr][nc] = True
                        queue.append((nr, nc))
            if len(cells) > len(best):
                best = cells
    kept = [[False] * cols for _ in range(rows)]
    for r, c in best:
        kept[r][c] = True
    return kept


def trace(mask):
    """Outline of the filled cells as corner points, walking with the region on the right."""
    rows, cols = len(mask), len(mask[0])
    filled = lambda r, c: 0 <= r < rows and 0 <= c < cols and mask[r][c]
    edges = {}
    for r in range(rows):
        for c in range(cols):
            if not mask[r][c]:
                continue
            if not filled(r - 1, c):
                edges[(c, r)] = (c + 1, r)
            if not filled(r, c + 1):
                edges[(c + 1, r)] = (c + 1, r + 1)
            if not filled(r + 1, c):
                edges[(c + 1, r + 1)] = (c, r + 1)
            if not filled(r, c - 1):
                edges[(c, r + 1)] = (c, r)
    start = min(edges)
    path = [start]
    current = edges[start]
    while current != start and len(path) < len(edges) + 2:
        path.append(current)
        current = edges[current]
    return path


def simplify(points, epsilon):
    if len(points) < 3:
        return points
    first, last = points[0], points[-1]
    dx, dy = last[0] - first[0], last[1] - first[1]
    norm = math.hypot(dx, dy) or 1
    index, distance = 0, -1
    for i in range(1, len(points) - 1):
        d = abs((points[i][0] - first[0]) * dy - (points[i][1] - first[1]) * dx) / norm
        if d > distance:
            index, distance = i, d
    if distance <= epsilon:
        return [first, last]
    return simplify(points[:index + 1], epsilon)[:-1] + simplify(points[index:], epsilon)


def simplify_ring(points, epsilon):
    far = max(range(len(points)), key=lambda i: math.dist(points[i], points[0]))
    first = simplify(points[:far + 1], epsilon)
    second = simplify(points[far:] + [points[0]], epsilon)
    return first[:-1] + second[:-1]


def interior_point(mask):
    rows, cols = len(mask), len(mask[0])
    distance = [[0 if not mask[r][c] else -1 for c in range(cols)] for r in range(rows)]
    queue = deque((r, c) for r in range(rows) for c in range(cols) if not mask[r][c])
    best = (0, 0, 0)
    while queue:
        r, c = queue.popleft()
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            nr, nc = r + dr, c + dc
            if 0 <= nr < rows and 0 <= nc < cols and distance[nr][nc] == -1:
                distance[nr][nc] = distance[r][c] + 1
                if distance[nr][nc] > best[0]:
                    best = (distance[nr][nc], nr, nc)
                queue.append((nr, nc))
    return best


def fmt(value):
    return ('%.1f' % value).rstrip('0').rstrip('.')


def main(source):
    notes = os.path.join(source, 'notes')
    skeleton = json.load(open(os.path.join(notes, 'vassal-skeleton.json')))
    bars = {bar['id']: bar for bar in json.load(open(os.path.join(notes, 'bars.json')))}
    features = json.load(open(os.path.join(notes, 'locale-features.json')))
    capacities = json.load(open(os.path.join(notes, 'capacities.json')))
    roads = json.load(open(os.path.join(notes, 'roads.json')))

    wedges = {}
    for approach in skeleton['approaches']:
        for side, wedge in enumerate(approach['wedges']):
            wedges.setdefault(approach['locales'][side], []).append(wedge)

    locales = {}
    for number, polygons in sorted(wedges.items()):
        mask, x0, y0 = rasterize(polygons)
        mask = largest_component(mask)
        ring = [(x0 + c * STEP, y0 + r * STEP) for c, r in trace(mask)]
        outline = simplify_ring(ring, SIMPLIFY)
        depth, r, c = interior_point(mask)
        anchor = (x0 + (c + 0.5) * STEP, y0 + (r + 0.5) * STEP)
        box = capacities[str(number)]['box']
        locales[number] = {
            'outline': [(x * SCALE, y * SCALE) for x, y in outline],
            'anchor': (anchor[0] * SCALE, anchor[1] * SCALE),
            'clearance': depth * STEP * SCALE,
            'capacityBox': ((box[0] + box[2] / 2) * SCALE, (box[1] + box[2] / 2) * SCALE),
        }

    lines = [
        '// Generated by scripts/build-board-geometry.py from the transcribed board. Do not edit by hand.',
        "import type { Point } from '@tabletop/common'",
        '',
        f'export const BOARD_WIDTH = {int(5100 * SCALE)}',
        f'export const BOARD_HEIGHT = {int(6600 * SCALE)}',
        '',
        'export interface LocaleGeometry {',
        '    outline: Point[]',
        '    /** The point of the locale furthest from its edges, where reserve pieces gather. */',
        '    anchor: Point',
        '    /** Distance from the anchor to the nearest edge. */',
        '    clearance: number',
        '    capacityBox: Point',
        '}',
        '',
        'export interface ApproachGeometry {',
        '    /** Centre of the printed approach bar. */',
        '    centre: Point',
        '    /** Direction of the bar in degrees, clockwise from the x axis. */',
        '    angle: number',
        '    length: number',
        '    /** Unit vector from the bar into the locale this side of the approach belongs to. */',
        '    inward: Point',
        '}',
        '',
        'export interface EntryGeometry {',
        '    at: Point',
        '}',
        '',
        'const p = (x: number, y: number): Point => ({ x, y })',
        '',
        'export const LOCALE_GEOMETRY: Record<number, LocaleGeometry> = {',
    ]
    for number, locale in locales.items():
        outline = ', '.join(f'p({fmt(x)}, {fmt(y)})' for x, y in locale['outline'])
        lines.append(f"    {number}: {{ outline: [{outline}], anchor: p({fmt(locale['anchor'][0])}, {fmt(locale['anchor'][1])}), clearance: {fmt(locale['clearance'])}, capacityBox: p({fmt(locale['capacityBox'][0])}, {fmt(locale['capacityBox'][1])}) }},")
    lines += ['}', '', 'export const APPROACH_GEOMETRY: Record<number, ApproachGeometry> = {']
    for approach in skeleton['approaches']:
        bar = bars[approach['id']]
        cx, cy = bar['centre'][0] * SCALE, bar['centre'][1] * SCALE
        length = (522 if bar['width'] == 'wide' else 262) * SCALE
        theta = math.radians(bar['angle'])
        normal = (-math.sin(theta), math.cos(theta))
        for side, number in enumerate(approach['locales']):
            ax, ay = locales[number]['anchor']
            sign = 1 if (ax - cx) * normal[0] + (ay - cy) * normal[1] >= 0 else -1
            lines.append(f"    {approach['id'] * 2 + side}: {{ centre: p({fmt(cx)}, {fmt(cy)}), angle: {fmt(bar['angle'] % 180)}, length: {fmt(length)}, inward: p({fmt(sign * normal[0] * 1000 / 1000)}, {fmt(sign * normal[1])}) }},")
    lines += ['}', '', 'export const ENTRY_GEOMETRY: Record<string, EntryGeometry> = {']
    for entry in roads['entries']:
        lines.append(f"    {entry['id']}: {{ at: p({fmt(entry['at'][0] * SCALE)}, {fmt(entry['at'][1] * SCALE)}) }},")
    lines += ['}', '']
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'lib', 'map', 'boardGeometry.ts')
    open(out, 'w', encoding='utf-8').write('\n'.join(lines))
    sizes = [len(locale['outline']) for locale in locales.values()]
    print('wrote', os.path.normpath(out), len(locales), 'locales; outline points min/avg/max', min(sizes), sum(sizes) // len(sizes), max(sizes))


if __name__ == '__main__':
    main(sys.argv[1])
