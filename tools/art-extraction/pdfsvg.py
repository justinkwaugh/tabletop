"""Re-emit a region of a PDF page's vector drawings as a compact standalone SVG.

PyMuPDF's page SVG export always carries the whole page; this walks
``page.get_drawings(extended=True)`` instead, keeps only the paths that touch the
requested region, honours rectangular clip scissors, and clips everything to an
optional polygon (the die-cut outline of a tile or card).
"""
from __future__ import annotations
import pymupdf as fitz


def _hex(color) -> str:
    return '#%02x%02x%02x' % tuple(int(round(c * 255)) for c in color)


def _fmt(v: float) -> str:
    return f'{v:.3f}'.rstrip('0').rstrip('.')


def path_data(items, close: bool) -> str:
    parts = []
    cursor = None
    for it in items:
        kind = it[0]
        if kind == 'l':
            p1, p2 = it[1], it[2]
            if cursor != p1:
                parts.append(f'M{_fmt(p1.x)} {_fmt(p1.y)}')
            parts.append(f'L{_fmt(p2.x)} {_fmt(p2.y)}')
            cursor = p2
        elif kind == 'c':
            p1, c1, c2, p2 = it[1], it[2], it[3], it[4]
            if cursor != p1:
                parts.append(f'M{_fmt(p1.x)} {_fmt(p1.y)}')
            parts.append(f'C{_fmt(c1.x)} {_fmt(c1.y)} {_fmt(c2.x)} {_fmt(c2.y)} {_fmt(p2.x)} {_fmt(p2.y)}')
            cursor = p2
        elif kind == 're':
            r = it[1]
            parts.append(f'M{_fmt(r.x0)} {_fmt(r.y0)}H{_fmt(r.x1)}V{_fmt(r.y1)}H{_fmt(r.x0)}Z')
            cursor = None
        elif kind == 'qu':
            q = it[1]
            parts.append(f'M{_fmt(q.ul.x)} {_fmt(q.ul.y)}L{_fmt(q.ur.x)} {_fmt(q.ur.y)}L{_fmt(q.lr.x)} {_fmt(q.lr.y)}L{_fmt(q.ll.x)} {_fmt(q.ll.y)}Z')
            cursor = None
    if close and parts and not parts[-1].endswith('Z'):
        parts.append('Z')
    return ''.join(parts)


def region_svg(page: fitz.Page, region: fitz.Rect, *, polygon: list[fitz.Point] | None = None,
               skip=lambda d: False, drawings=None) -> str:
    """Return an SVG string for the drawings intersecting ``region``.

    ``polygon`` (page coordinates) becomes the outer clip; ``skip(drawing)`` drops
    individual drawings (e.g. die-cut guide lines).
    """
    drawings = drawings if drawings is not None else page.get_drawings(extended=True)
    clip_stack: list[dict] = []
    clip_defs: dict[str, str] = {}
    body: list[str] = []
    ox, oy = region.x0, region.y0

    def clip_id_for(rect: fitz.Rect) -> str:
        key = f'r{_fmt(rect.x0 - ox)}_{_fmt(rect.y0 - oy)}_{_fmt(rect.width)}_{_fmt(rect.height)}'.replace('.', 'p').replace('-', 'n')
        if key not in clip_defs:
            clip_defs[key] = (f'<clipPath id="{key}"><rect x="{_fmt(rect.x0 - ox)}" y="{_fmt(rect.y0 - oy)}" '
                              f'width="{_fmt(rect.width)}" height="{_fmt(rect.height)}"/></clipPath>')
        return key

    for d in drawings:
        level = d.get('level', 0)
        if d['type'] == 'clip':
            while clip_stack and clip_stack[-1]['level'] >= level:
                clip_stack.pop()
            clip_stack.append(d)
            continue
        if d['type'] == 'group':
            continue
        while clip_stack and clip_stack[-1]['level'] >= level:
            clip_stack.pop()
        rect = d['rect']
        if not rect.intersects(region) or skip(d):
            continue
        effective = fitz.Rect(region)
        for c in clip_stack:
            if c.get('scissor'):
                effective &= c['scissor']
        if effective.is_empty:
            continue
        attrs = []
        if d.get('fill') is not None:
            attrs.append(f'fill="{_hex(d["fill"])}"')
            if d.get('fill_opacity', 1) not in (None, 1):
                attrs.append(f'fill-opacity="{_fmt(d["fill_opacity"])}"')
            if d.get('even_odd'):
                attrs.append('fill-rule="evenodd"')
        else:
            attrs.append('fill="none"')
        if d.get('color') is not None and d['type'] in ('s', 'fs'):
            attrs.append(f'stroke="{_hex(d["color"])}"')
            attrs.append(f'stroke-width="{_fmt(d.get("width") or 1)}"')
            if d.get('stroke_opacity', 1) not in (None, 1):
                attrs.append(f'stroke-opacity="{_fmt(d["stroke_opacity"])}"')
            cap = d.get('lineCap')
            if cap and cap[0] in (1, 2):
                attrs.append(f'stroke-linecap="{"round" if cap[0] == 1 else "square"}"')
            join = d.get('lineJoin')
            if join in (1, 2):
                attrs.append(f'stroke-linejoin="{"round" if join == 1 else "bevel"}"')
            if d.get('dashes') and d['dashes'] not in ('[] 0', '[]'):
                dash = d['dashes'].split(']')[0].strip('[ ')
                if dash:
                    attrs.append(f'stroke-dasharray="{dash.replace(" ", ",")}"')
        clip_attr = ''
        # Only emit a rect clip when the scissor actually crops inside the region.
        if not effective.contains(region):
            clip_attr = f' clip-path="url(#{clip_id_for(effective)})"'
        body.append(f'<path{clip_attr} {" ".join(attrs)} d="{path_data(d["items"], bool(d.get("closePath")))}"/>')

    w, h = region.width, region.height
    outer_clip = ''
    if polygon:
        pts = ' '.join(f'{_fmt(p.x - ox)},{_fmt(p.y - oy)}' for p in polygon)
        clip_defs['outline'] = f'<clipPath id="outline"><polygon points="{pts}"/></clipPath>'
        outer_clip = ' clip-path="url(#outline)"'
    defs = ''.join(clip_defs.values())
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {_fmt(w)} {_fmt(h)}">'
            f'<defs>{defs}</defs>'
            f'<g transform="translate({_fmt(-ox)} {_fmt(-oy)})"{outer_clip}>{"".join(body)}</g></svg>\n')
