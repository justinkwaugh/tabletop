#!/usr/bin/env python3
"""Draws the Baltic coastline for the Kogge board.

Natural Earth land, lakes and rivers (public domain) are projected with Mercator, then
bent with a thin-plate spline so that each city's real harbour lands where its panel meets
the sea on the board (src/lib/board/layout.json). The result is written to
src/lib/board/balticMap.ts as SVG path data, and copies the layout to src/lib/board/layoutData.ts.

Usage: python3 scripts/build-baltic-map.py [natural-earth-cache-dir]
"""

import json
import math
import os
import sys
import urllib.request

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
LAYOUT = json.load(open(os.path.join(ROOT, 'src/lib/board/layout.json')))
OUTPUT = os.path.join(ROOT, 'src/lib/board/balticMap.ts')
LAYOUT_OUTPUT = os.path.join(ROOT, 'src/lib/board/layoutData.ts')
CACHE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '.natural-earth')
SOURCE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/'
LAYERS = {
    'land': 'ne_10m_land.geojson',
    'lakes': 'ne_10m_lakes.geojson',
    'rivers': 'ne_10m_rivers_lake_centerlines.geojson',
}

CLIP = (-2.0, 46.0, 40.0, 67.0)  # lon min, lat min, lon max, lat max
TOLERANCE = 0.7  # board units for Douglas-Peucker
MARGIN = 60


def load(layer):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, LAYERS[layer])
    if not os.path.exists(path):
        urllib.request.urlretrieve(SOURCE + LAYERS[layer], path)
    return json.load(open(path))['features']


def mercator(lon, lat):
    return lon, math.degrees(math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)))


def harbour(city):
    card = LAYOUT['card']
    offset = LAYOUT['harbourOffset']
    x, y, side = city['x'], city['y'], city['side']
    if side == 'top':
        return x + card['width'] / 2, y + card['height'] + offset
    if side == 'bottom':
        return x + card['width'] / 2, y - offset
    if side == 'left':
        return x + card['width'] + offset, y + card['height'] / 2
    return x - offset, y + card['height'] / 2


class ThinPlateSpline:
    def __init__(self, source, target, regularisation=0.0):
        source = np.asarray(source, float)
        target = np.asarray(target, float)
        n = len(source)
        kernel = self.kernel(source, source) + regularisation * np.eye(n)
        affine = np.hstack([np.ones((n, 1)), source])
        system = np.zeros((n + 3, n + 3))
        system[:n, :n] = kernel
        system[:n, n:] = affine
        system[n:, :n] = affine.T
        rhs = np.zeros((n + 3, 2))
        rhs[:n] = target
        solution = np.linalg.solve(system, rhs)
        self.source = source
        self.weights = solution[:n]
        self.affine = solution[n:]

    @staticmethod
    def kernel(a, b):
        r2 = ((a[:, None, :] - b[None, :, :]) ** 2).sum(-1)
        with np.errstate(divide='ignore', invalid='ignore'):
            k = r2 * np.log(np.sqrt(r2))
        return np.nan_to_num(k)

    def __call__(self, points):
        points = np.asarray(points, float)
        k = self.kernel(points, self.source)
        affine = np.hstack([np.ones((len(points), 1)), points]) @ self.affine
        return affine + k @ self.weights


def clip_ring(ring):
    """Sutherland-Hodgman against the lon/lat clip box."""
    lon0, lat0, lon1, lat1 = CLIP
    edges = [
        (lambda p: p[0] >= lon0, lambda a, b: cross_x(a, b, lon0)),
        (lambda p: p[0] <= lon1, lambda a, b: cross_x(a, b, lon1)),
        (lambda p: p[1] >= lat0, lambda a, b: cross_y(a, b, lat0)),
        (lambda p: p[1] <= lat1, lambda a, b: cross_y(a, b, lat1)),
    ]
    points = ring
    for inside, cross in edges:
        if not points:
            break
        result = []
        previous = points[-1]
        for point in points:
            if inside(point):
                if not inside(previous):
                    result.append(cross(previous, point))
                result.append(point)
            elif inside(previous):
                result.append(cross(previous, point))
            previous = point
        points = result
    return points


def cross_x(a, b, x):
    t = (x - a[0]) / (b[0] - a[0])
    return (x, a[1] + t * (b[1] - a[1]))


def cross_y(a, b, y):
    t = (y - a[1]) / (b[1] - a[1])
    return (a[0] + t * (b[0] - a[0]), y)


def simplify(points, tolerance):
    if len(points) < 3:
        return points
    keep = np.zeros(len(points), bool)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        start, end = stack.pop()
        a, b = points[start], points[end]
        segment = b - a
        length = np.hypot(*segment)
        between = points[start + 1:end]
        if len(between) == 0:
            continue
        if length == 0:
            distances = np.hypot(*(between - a).T)
        else:
            distances = np.abs(np.cross(segment, between - a)) / length
        index = int(np.argmax(distances))
        if distances[index] > tolerance:
            middle = start + 1 + index
            keep[middle] = True
            stack.append((start, middle))
            stack.append((middle, end))
    return points[keep]


def overlaps_board(points):
    w, h = LAYOUT['width'], LAYOUT['height']
    return (
        points[:, 0].max() > -MARGIN
        and points[:, 0].min() < w + MARGIN
        and points[:, 1].max() > -MARGIN
        and points[:, 1].min() < h + MARGIN
    )


def path_data(lines, closed):
    parts = []
    for line in lines:
        coords = ' '.join(f'{x:.1f} {y:.1f}' for x, y in line)
        parts.append(f'M{coords}{"Z" if closed else ""}')
    return ''.join(parts).replace('.0 ', ' ').replace('.0Z', 'Z')


def polygons(features):
    for feature in features:
        geometry = feature['geometry']
        if geometry is None:
            continue
        if geometry['type'] == 'Polygon':
            yield feature, geometry['coordinates']
        elif geometry['type'] == 'MultiPolygon':
            for polygon in geometry['coordinates']:
                yield feature, polygon


def lines(features):
    for feature in features:
        geometry = feature['geometry']
        if geometry is None:
            continue
        if geometry['type'] == 'LineString':
            yield feature, geometry['coordinates']
        elif geometry['type'] == 'MultiLineString':
            for line in geometry['coordinates']:
                yield feature, line


def in_clip(lon, lat):
    return CLIP[0] <= lon <= CLIP[2] and CLIP[1] <= lat <= CLIP[3]


def main():
    cities = [(mercator(c['lon'], c['lat']), harbour(c)) for c in LAYOUT['cities']]
    affine = ThinPlateSpline([s for s, _ in cities], [t for _, t in cities], 1e7)
    # The outskirts keep the plain fit so the coast only bends near the harbours.
    frame = [
        (mercator(lon, lat), affine([mercator(lon, lat)])[0])
        for lon in np.linspace(CLIP[0], CLIP[2], 9)
        for lat in np.linspace(CLIP[1], CLIP[3], 7)
        if not (5 < lon < 31 and 53 < lat < 62)
    ]
    controls = cities + frame
    regularisation = float(os.environ.get('WARP_REGULARISATION', '0.5'))
    warp = ThinPlateSpline([s for s, _ in controls], [t for _, t in controls], regularisation)

    def board_points(ring):
        return warp([mercator(lon, lat) for lon, lat in ring])

    land = []
    for _, polygon in polygons(load('land')):
        for ring in polygon:
            clipped = clip_ring([tuple(p[:2]) for p in ring])
            if len(clipped) < 3:
                continue
            points = simplify(board_points(clipped), TOLERANCE)
            if len(points) >= 3 and overlaps_board(points):
                land.append(points)

    lakes = []
    for feature, polygon in polygons(load('lakes')):
        if feature['properties'].get('scalerank', 10) > 3:
            continue
        ring = [tuple(p[:2]) for p in polygon[0]]
        if not all(in_clip(*p) for p in ring):
            continue
        points = simplify(board_points(ring), TOLERANCE)
        if len(points) >= 3 and overlaps_board(points):
            lakes.append(points)

    rivers = []
    for feature, line in lines(load('rivers')):
        if feature['properties'].get('scalerank', 10) > 4:
            continue
        coords = [tuple(p[:2]) for p in line if in_clip(*p[:2])]
        if len(coords) < 2:
            continue
        points = simplify(board_points(coords), TOLERANCE)
        if len(points) >= 2 and overlaps_board(points):
            rivers.append(points)

    harbours = {c['number']: [round(v, 1) for v in harbour(c)] for c in LAYOUT['cities']}
    with open(OUTPUT, 'w') as out:
        out.write('// Generated by scripts/build-baltic-map.py from Natural Earth (public domain).\n')
        out.write(f"export const LAND_PATH =\n    '{path_data(land, True)}'\n\n")
        out.write(f"export const LAKES_PATH =\n    '{path_data(lakes, True)}'\n\n")
        out.write(f"export const RIVERS_PATH =\n    '{path_data(rivers, False)}'\n")
    with open(LAYOUT_OUTPUT, 'w') as out:
        out.write('// Generated by scripts/build-baltic-map.py from layout.json.\n')
        out.write(f'export const LAYOUT = {json.dumps(LAYOUT, indent=4)} as const\n')
    print(f'land rings {len(land)}, lakes {len(lakes)}, rivers {len(rivers)}')
    print(f'wrote {os.path.getsize(OUTPUT)} bytes; harbours {harbours}')


if __name__ == '__main__':
    main()
