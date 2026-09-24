#!/usr/bin/env python3
"""Extract Shikoku 1889 alternate-art assets from the raw print files in artassets/shikoku.

Outputs (under --out):
  shares/<ID>-share.jpg, shares/<ID>-president.jpg   mini-card certificates (63.5x44 mm, rotated upright)
  trains/<type>.jpg                                   one card per train type
  privates/<letter>-<slug>.jpg                        the seven private company cards (63.5x88 mm)
  tiles/<style>/<index>.svg                           every die-cut hex from the punchboards, two styles
"""
import argparse, io, pathlib, sys
import pymupdf as fitz
from PIL import Image

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from pdfsvg import region_svg  # noqa: E402

SRC = pathlib.Path('artassets/shikoku/Base game')
MINI = SRC / '63,5x44 mini cards sized items' / '63,5x44 mm cards front 1.pdf'
STD = SRC / '63,5x88 mm sized item' / '63,5x88 mm card front.pdf'
PUNCH = [SRC / 'Punchboards' / f'Punchboards #{n}.pdf' for n in (1, 2, 3)]

# Mini sheet is 11 columns x 9 rows of 125x180 pt cells, cards printed sideways.
# Cell index = row * 11 + column (rows top to bottom, columns left to right).
SHARES = {'UR': (4, 32), 'TR': (5, 43), 'KO': (6, 54), 'SR': (7, 65), 'KU': (8, 76), 'IR': (9, 87), 'AR': (10, 98)}
TRAINS = {'2': 3, '3': 2, '4': 45, '5': 12, '6': 1, 'D': 14}
# Standard sheet: 8 columns x 7 rows; the privates fill the last column, G at the top.
PRIVATES = ['A-takamatsu-electric-track', 'B-mitsubishi-ferry', 'C-ehime-railroad', 'D-sumitomo-besshi-mine-railroad',
            'E-dogo-railway', 'F-pilgrimage-railway', 'G-uno-takamatsu-ferry']
# Printed tile number for every die-cut hex, in extraction order (sheet 1..3, patterned side
# then plain side, rows top to bottom). Read off the punchboards; 0 marks an empty punch position.
HEX_NUMBERS = [
    # sheet 1 patterned
    57, 9, 9, 9, 9, 9, 8, 8, 9, 8, 8, 8, 8, 7, 7, 7, 6, 6, 6, 6, 5, 5, 3, 3,
    # sheet 1 plain
    9, 9, 9, 57, 8, 8, 9, 9, 8, 8, 8, 9, 7, 7, 7, 8, 6, 6, 6, 6, 3, 3, 5, 5,
    # sheet 2 patterned
    26, 25, 24, 24, 23, 24, 23, 23, 20, 19, 16, 15, 15, 15, 14, 13, 12, 438, 437, 58, 58, 58, 57, 57,
    # sheet 2 plain
    24, 24, 25, 26, 23, 23, 24, 23, 15, 16, 19, 20, 13, 14, 15, 15, 58, 437, 438, 12, 57, 57, 58, 58,
    # sheet 3 patterned
    0, 611, 611, 492, 466, 465, 448, 448, 448, 448, 47, 46, 45, 42, 41, 40, 39, 206, 205, 440, 439, 29, 28, 27,
    # sheet 3 plain
    492, 611, 611, 0, 448, 448, 465, 466, 46, 47, 448, 448, 40, 41, 42, 45, 440, 205, 206, 39, 27, 28, 29, 439,
]
CUT_PINK = (0.926, 0.0, 0.548)
CUT_RED = (0.93, 0.11, 0.14)


def is_color(c, ref, tol=0.02):
    return c is not None and all(abs(a - b) < tol for a, b in zip(c, ref))


def cut_rects(page, color, width):
    rects = [d['rect'] for d in page.get_drawings()
             if d['type'] == 's' and is_color(d.get('color'), color) and abs((d.get('width') or 0) - width) < 0.05]
    return rects


def render_jpg(page, rect, dest: pathlib.Path, scale=6.0, rotate=0, quality=88, inset=1.5):
    """Render a die-cut cell; ``inset`` (pt) trims the printed cut guide from the edge."""
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), clip=fitz.Rect(rect) + (inset, inset, -inset, -inset))
    im = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
    if rotate:
        im = im.rotate(rotate, expand=True)
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, 'JPEG', quality=quality, optimize=True, progressive=True)
    return im.size


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True, type=pathlib.Path)
    ap.add_argument('--tiles-only', action='store_true')
    args = ap.parse_args()
    out = args.out

    if not args.tiles_only:
        page = fitz.open(MINI)[0]
        cells = sorted(cut_rects(page, CUT_PINK, 1.0), key=lambda r: (round(r.y0 / 10), r.x0))
        assert len(cells) == 99, len(cells)
        for company, (share, president) in SHARES.items():
            print('share', company, render_jpg(page, cells[share], out / 'shares' / f'{company}-share.jpg', rotate=-90))
            print('president', company, render_jpg(page, cells[president], out / 'shares' / f'{company}-president.jpg', rotate=-90))
        for train, cell in TRAINS.items():
            print('train', train, render_jpg(page, cells[cell], out / 'trains' / f'{train}.jpg', rotate=-90))

        page = fitz.open(STD)[0]
        cells = sorted(cut_rects(page, CUT_RED, 0.5), key=lambda r: (round(r.y0 / 10), r.x0))
        assert len(cells) == 56, len(cells)
        column = sorted([r for r in cells if r.x0 > 1300], key=lambda r: -r.y0)  # bottom (A) to top (G)
        for name, rect in zip(PRIVATES, column):
            print('private', name, render_jpg(page, rect, out / 'privates' / f'{name}.jpg'))

    index = 0
    chosen: set[tuple[str, int]] = set()
    for pdf in PUNCH:
        page = fitz.open(pdf)[0]
        drawings = page.get_drawings(extended=True)
        hexes = [d for d in drawings if d['type'] == 's' and is_color(d.get('color'), CUT_PINK, 0.01)
                 and abs(d['rect'].width - 108) < 2]
        hexes.sort(key=lambda d: (d['rect'].x0 > 650, round(d['rect'].y0 / 20), d['rect'].x0))
        for d in hexes:
            polygon = [it[1] for it in d['items']] + [d['items'][-1][2]]
            style = 'patterned' if d['rect'].x0 < 650 else 'plain'
            number = HEX_NUMBERS[index]
            index += 1
            if not number or (style, number) in chosen:
                continue  # empty punch position, or a duplicate copy of a tile already exported
            chosen.add((style, number))
            # Bleed hexes overlap at the corners, so keep only drawings centred on this die-cut
            # (neighbouring tiles' bleed and track would otherwise show through at the corners).
            own = fitz.Rect(d['rect']) + (-2, -2, 2, 2)

            def foreign(x, own=own):
                r = x['rect']
                return not own.contains(fitz.Point((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2))

            svg = region_svg(page, d['rect'], polygon=polygon, drawings=drawings,
                             skip=lambda x: (x['type'] == 's' and is_color(x.get('color'), CUT_PINK, 0.01)) or foreign(x))
            dest = out / 'tiles' / style / f'{number}.svg'
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(svg)
    assert index == len(HEX_NUMBERS), index
    print('tiles per style', sorted({n for _, n in chosen}), len(chosen))


if __name__ == '__main__':
    main()
