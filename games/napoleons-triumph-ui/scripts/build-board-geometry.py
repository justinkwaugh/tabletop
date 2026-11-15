"""Generate src/lib/map/boardGeometry.ts from the transcribed board and the public map file's bars.

Usage: python3 -I scripts/build-board-geometry.py /workspace/artassets/napoleons-triumph

Board units are half a pixel of the 5100x6600 render of the public map file. Locale outlines are
rebuilt from the file's printed bars, each side on the centre line of its bar, by
scripts/pdf_locale_outlines.py in the source folder (public-map-derived/pdf-locale-outlines.json);
approach bars are the file's own.
"""
import json
import math
import os
import sys
from collections import deque

SCALE = 0.5
STEP = 4
# The public map file draws Lösch's capacity box in a way pdf_approaches.py does not read; its centre is measured off board-150dpi.png.
CAPACITY_BOXES_BY_HAND = {23: (170.0, 578.3)}
# Stars read off the board scan, which lies on the 5100x6600 render; the fainter hits are pieces of the red set-up marks.
STAR_LEAST_FILL = 0.1


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


def rasterize(polygon):
    xs = [p[0] for p in polygon]
    ys = [p[1] for p in polygon]
    x0, y0 = min(xs) - 2 * STEP, min(ys) - 2 * STEP
    cols = int((max(xs) - x0) / STEP) + 4
    rows = int((max(ys) - y0) / STEP) + 4
    mask = [[False] * cols for _ in range(rows)]
    for r in range(rows):
        cy = y0 + (r + 0.5) * STEP
        for c in range(cols):
            mask[r][c] = inside(x0 + (c + 0.5) * STEP, cy, polygon)
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


def interior_point(mask, wanted=None):
    """The cell furthest from the edge; among cells as good to within two steps, the one nearest `wanted`, or the middle."""
    rows, cols = len(mask), len(mask[0])
    distance = [[0 if not mask[r][c] else -1 for c in range(cols)] for r in range(rows)]
    queue = deque((r, c) for r in range(rows) for c in range(cols) if not mask[r][c])
    deepest = 0
    while queue:
        r, c = queue.popleft()
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            nr, nc = r + dr, c + dc
            if 0 <= nr < rows and 0 <= nc < cols and distance[nr][nc] == -1:
                distance[nr][nc] = distance[r][c] + 1
                deepest = max(deepest, distance[nr][nc])
                queue.append((nr, nc))
    filled = [(r, c) for r in range(rows) for c in range(cols) if mask[r][c]]
    if wanted is None:
        wanted = (sum(r for r, _ in filled) / len(filled), sum(c for _, c in filled) / len(filled))
    r, c = min(
        ((r, c) for r, c in filled if distance[r][c] >= deepest - 2),
        key=lambda cell: (cell[0] - wanted[0]) ** 2 + (cell[1] - wanted[1]) ** 2,
    )
    return distance[r][c], r, c


def fmt(value):
    return ('%.1f' % value).rstrip('0').rstrip('.')


def fmt_unit(value):
    return ('%.4f' % (round(value, 4) + 0.0)).rstrip('0').rstrip('.')


def main(source):
    notes = os.path.join(source, 'notes')
    skeleton = json.load(open(os.path.join(notes, 'vassal-skeleton.json')))
    bars = {bar['id']: bar for bar in json.load(open(os.path.join(notes, 'bars.json')))}
    features = json.load(open(os.path.join(notes, 'locale-features.json')))
    roads = json.load(open(os.path.join(notes, 'roads.json')))
    printed = json.load(open(os.path.join(source, 'public-map-derived', 'pdf-approaches.json')))
    marks = json.load(open(os.path.join(source, 'public-map-derived', 'pdf-approach-marks.json')))

    outlines = json.load(open(os.path.join(source, 'public-map-derived', 'pdf-locale-outlines.json')))
    # Where reserve stacks stood before the outlines were rebuilt; a stack stays there while the spot is still as roomy as any.
    stack_points = json.load(open(os.path.join(notes, 'stack-points.json')))

    locales = {}
    for number, outline in sorted((int(number), outline) for number, outline in outlines.items()):
        mask, x0, y0 = rasterize([(x / SCALE, y / SCALE) for x, y in outline])
        mask = largest_component(mask)
        stood = stack_points.get(str(number))
        wanted = ((stood[1] / SCALE - y0) / STEP - 0.5, (stood[0] / SCALE - x0) / STEP - 0.5) if stood else None
        depth, r, c = interior_point(mask, wanted)
        anchor = (x0 + (c + 0.5) * STEP, y0 + (r + 0.5) * STEP)
        locales[number] = {
            'outline': [(x, y) for x, y in outline],
            'anchor': (anchor[0] * SCALE, anchor[1] * SCALE),
            'clearance': depth * STEP * SCALE,
        }

    capacity_boxes = dict(CAPACITY_BOXES_BY_HAND)
    for box in printed['capacities']:
        x, y = box['at']
        holding = [number for number, locale in locales.items() if inside(x, y, locale['outline'])]
        if len(holding) == 1:
            assert holding[0] not in capacity_boxes, f'two capacity boxes in locale {holding[0]}'
            capacity_boxes[holding[0]] = (x, y)
    assert sorted(capacity_boxes) == sorted(locales), 'a locale without its capacity box'

    printed_stars = {}
    for mark in json.load(open(os.path.join(notes, 'colour-marks.json'))):
        if mark['kind'] == 'star' and mark['fill'] >= STAR_LEAST_FILL:
            x, y = mark['centre']
            printed_stars.setdefault(mark['locale'], []).append((x * SCALE, y * SCALE))

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
        'export interface PrintedBar {',
        '    centre: Point',
        '    /** Direction of the bar in degrees, clockwise from the x axis. */',
        '    angle: number',
        '    length: number',
        '}',
        '',
        '/** I infantry, C cavalry and A artillery penalised; O obstructed; X impassable. */',
        "export type PrintedMark = 'I' | 'C' | 'A' | 'O' | 'X'",
        '',
        'export interface PrintedMarks {',
        '    /** Centre of the bar the marks belong to. */',
        '    bar: Point',
        '    centre: Point',
        '    /** Direction in degrees, clockwise from the x axis, along which the marks are listed. */',
        '    angle: number',
        '    marks: PrintedMark[]',
        '}',
        '',
        '/** Side of the square box a locale\'s capacity is printed in. */',
        'export const CAPACITY_BOX_SIZE = 12.8',
        '',
        '/** Side of the square a printed objective star fits in. */',
        'export const STAR_MARK_SIZE = 16',
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
        lines.append(f"    {number}: {{ outline: [{outline}], anchor: p({fmt(locale['anchor'][0])}, {fmt(locale['anchor'][1])}), clearance: {fmt(locale['clearance'])} }},")
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
            lines.append(f"    {approach['id'] * 2 + side}: {{ centre: p({fmt(cx)}, {fmt(cy)}), angle: {fmt(bar['angle'] % 180)}, length: {fmt(length)}, inward: p({fmt_unit(sign * normal[0])}, {fmt_unit(sign * normal[1])}) }},")
    lines += ['}', '', 'export const ENTRY_GEOMETRY: Record<string, EntryGeometry> = {']
    for entry in roads['entries']:
        lines.append(f"    {entry['id']}: {{ at: p({fmt(entry['at'][0] * SCALE)}, {fmt(entry['at'][1] * SCALE)}) }},")
    lines += [
        '}',
        '',
        '/** Every approach bar printed on the map, the impassable ones included, from the public map file. */',
        'export const PRINTED_BARS: PrintedBar[] = [',
    ]
    for bar in printed['approaches']:
        length = (522 if bar['wide'] else 262) * SCALE
        lines.append(f"    {{ centre: p({fmt(bar['centre'][0])}, {fmt(bar['centre'][1])}), angle: {fmt(bar['angle'] % 180)}, length: {fmt(length)} }},")
    lines += [
        ']',
        '',
        '/** The marks printed on each side of each approach, in their printed order along the bar, from the public map file. */',
        'export const PRINTED_MARKS: PrintedMarks[] = [',
    ]
    for side in marks:
        letters = ', '.join(f"'{mark}'" for mark in side['marks'])
        lines.append(f"    {{ bar: p({fmt(side['bar'][0])}, {fmt(side['bar'][1])}), centre: p({fmt(side['centre'][0])}, {fmt(side['centre'][1])}), angle: {fmt(side['angle'])}, marks: [{letters}] }},")
    lines += [
        ']',
        '',
        '/** Where each locale\'s capacity is printed, the middle of its box, from the public map file. */',
        'export const CAPACITY_BOXES: Record<number, Point> = {',
    ]
    for number, (x, y) in sorted(capacity_boxes.items()):
        lines.append(f'    {number}: p({fmt(x)}, {fmt(y)}),')
    lines += [
        '}',
        '',
        '/** Where each objective locale\'s stars are printed, the middle of each star, top to bottom. */',
        'export const PRINTED_STARS: Record<number, Point[]> = {',
    ]
    for number, stars in sorted(printed_stars.items()):
        points = ', '.join(f'p({fmt(x)}, {fmt(y)})' for x, y in sorted(stars, key=lambda star: star[1]))
        lines.append(f'    {number}: [{points}],')
    lines += ['}', '']
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'lib', 'map', 'boardGeometry.ts')
    open(out, 'w', encoding='utf-8').write('\n'.join(lines))
    sizes = [len(locale['outline']) for locale in locales.values()]
    print('wrote', os.path.normpath(out), len(locales), 'locales; outline points min/avg/max', min(sizes), sum(sizes) // len(sizes), max(sizes))


if __name__ == '__main__':
    main(sys.argv[1])
