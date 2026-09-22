#!/usr/bin/env python3
"""Extract The Old Prince alternate-art assets from the raw Boda Games print files.

Inputs live in artassets/the-old-prince (not committed). Outputs:
  privates/*.webp  one card per private company (1200 px) plus a -600 inline thumbnail
  shares/v1|v2/*.webp  share certificates, two art variants (1100 px)
  peirs/v1|v2/*.webp   the seven PEIR "private-share" certificates (1200 px plus -600 thumbnail)
  tokens/*.svg     vector charter tokens: coloured disc + Pantone 9200 icon path

Run: python3 tools/art-extraction/extract_top.py --out <dir>
"""
import argparse, io, pathlib, re, xml.etree.ElementTree as ET
import pymupdf as fitz
from PIL import Image, ImageDraw

SRC = pathlib.Path('artassets/the-old-prince')

# Charter order follows the Boda Games wood specification sheet; disc colours are the
# sheet's own CMYK->sRGB conversion of the listed Pantone swatches.
# (company id used by @tabletop/the-old-prince, wood-spec sheet index, disc colour, Pantone)
TOKENS = [
    ('C',    1, '#ac483b', 'PANTONE 7627 C'),        # Charlottetown
    ('MS',   2, '#cc9945', 'PANTONE 7510 C'),        # Mount Stewart
    ('S',    3, '#607963', 'PANTONE 2408 C'),        # Summerside
    ('Gt',   4, '#4d82ac', 'PANTONE 7688 C'),        # Georgetown
    ('A',    5, '#7b69a5', 'PANTONE 2665 C'),        # Alberton
    ('So',   6, '#b56e9a', 'PANTONE 2353 C'),        # Souris
    ('MR',   7, '#908c89', 'PANTONE Cool Gray 8 C'), # Murray River
    ('CB',   8, '#618e92', 'PANTONE 7475 C'),        # Cornwall Branch
    ('WB',   9, '#5969b1', 'PANTONE 2726 C'),        # Wellington Branch
    ('HRB', 10, '#7a5e74', 'PANTONE 7656 C'),        # Hunter River Branch
    ('SB',  11, '#be7047', 'PANTONE 7584 C'),        # Stratford Branch
    ('BB',  12, '#8a8f55', 'PANTONE 2279 C'),        # Belfast Branch
    ('MB',  13, '#7d6c6a', 'PANTONE 438 C'),         # Morell Branch
    ('PEIR', 14, '#353f47', 'PANTONE 7545 C'),       # Prince Edward Island Railway
]
ICON_FILL = '#eae1d7'  # PANTONE 9200 C

# share_N.pdf numbering: odd = variant 01, even = variant 02; pairs are (share, president).
SHARE_ORDER = ['charlottetown', 'morell', 'belfast', 'stratford', 'hunter-river', 'wellington',
               'cornwall', 'murray-river', 'souris', 'alberton', 'georgetown', 'summerside',
               'mount-stewart']
PEIR_ORDER = {7: 'charlottetown', 6: 'georgetown', 5: 'summerside', 4: 'murray-river',
              3: 'mount-stewart', 2: 'alberton', 1: 'souris'}
PRIVATES = {
    'HUNSLET': 'hunslet-steam-engine', 'ICE': 'ice-boats', 'KING': 'kings-mail',
    'MAINLINE': 'mainline-concession', 'MERCHANTS': 'merchants-and-co', 'RAILCAR': 'railcar-ferry',
    'ROYAL': 'royal-agricultural-society', 'SCHREIBER': 'schreiber-and-burpee-construction',
    'SHIPBUILDING': 'shipbuilding', 'SHORTLINE': 'shortline-concession', 'UNION': 'union-bank',
    'VERNON': 'vernon-river-bridge-company',
}


def page_image(pdf: pathlib.Path, out: pathlib.Path, *, heights=(1200,), quality=78):
    """Save the single embedded raster of a one-page PDF as WebP at each requested height.

    The first height writes ``out``; further heights add a ``-<height>`` suffix. Card art is
    shown at most about 360 CSS px tall inline and viewport-height in the lightbox, so the
    defaults are a 1200 px full image and, when requested, a 600 px inline thumbnail.
    """
    doc = fitz.open(pdf)
    page = doc[0]
    imgs = page.get_images(full=True)
    assert len(imgs) == 1, (pdf, len(imgs))
    pix = fitz.Pixmap(doc, imgs[0][0])
    if pix.n - pix.alpha >= 4:
        pix = fitz.Pixmap(fitz.csRGB, pix)
    im = Image.open(io.BytesIO(pix.tobytes('png'))).convert('RGB')
    out.parent.mkdir(parents=True, exist_ok=True)
    sizes = []
    for index, height in enumerate(heights):
        scaled = im.resize((round(im.width * height / im.height), height), Image.LANCZOS) if im.height > height else im
        dest = out if index == 0 else out.with_name(f'{out.stem}-{height}{out.suffix}')
        scaled.save(dest, 'WEBP', quality=quality, method=6)
        sizes.append(scaled.size)
    return sizes[0]


def token_svg(pdf: pathlib.Path, fill: str, label: str) -> str:
    """Wrap the single icon path of a token PDF in a coloured disc, normalised to a 100x100 viewBox."""
    page = fitz.open(pdf)[0]
    w, h = page.rect.width, page.rect.height
    root = ET.fromstring(page.get_svg_image())
    ns = {'svg': 'http://www.w3.org/2000/svg'}
    paths = root.findall('.//svg:path', ns)
    assert len(paths) == 1, (pdf, len(paths))
    d = paths[0].get('d')
    transform = paths[0].get('transform', '')
    s = 100 / max(w, h)
    ox, oy = (100 - w * s) / 2, (100 - h * s) / 2
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="{label}">\n'
        f'  <circle cx="50" cy="50" r="50" fill="{fill}"/>\n'
        f'  <g transform="translate({ox:.3f} {oy:.3f}) scale({s:.5f})">\n'
        f'    <path transform="{transform}" fill="{ICON_FILL}" fill-rule="nonzero" d="{d}"/>\n'
        '  </g>\n'
        '</svg>\n'
    )


# Representative die-cut tiles from the raster punch sheets (sheet, index in die-cut order), one or two
# per colour tier and marker type, kept as style reference rather than a full labelled tile set.
TILE_REFERENCE = {
    'yellow-town-straight': ('01', 0), 'yellow-town-curve': ('01', 1), 'yellow-city': ('01', 2),
    'yellow-city-ringed': ('01', 15), 'yellow-city-hex-marked': ('01', 18), 'yellow-plain-curve': ('03', 53),
    'yellow-plain-straight': ('03', 51), 'green-town': ('04', 76), 'green-junction': ('05', 100),
    'green-double-city': ('06', 121), 'green-city-hex-marked': ('06', 135), 'brown-track': ('04', 74),
    'brown-double-city': ('07', 145), 'brown-triple-city': ('07', 146), 'gray-triple-city': ('07', 155),
    'gray-charlottetown': ('07', 158),
}


def tile_reference(out: pathlib.Path):
    import subprocess
    cut = fitz.open(SRC / 'hexes' / 'PUNCH-TILES-00 -CUT.pdf')[0]
    polys = [[it[1] for it in d['items']] + [d['items'][-1][2]] for d in cut.get_drawings() if len(d['items']) == 6]
    polys.sort(key=lambda p: (round(min(q.y for q in p) / 40), min(q.x for q in p)))
    sheets = {}
    for name, (sheet, index) in TILE_REFERENCE.items():
        if sheet not in sheets:
            png = f'/tmp/top-punch-{sheet}.png'
            subprocess.run(['convert', str(SRC / 'hexes' / f'PUNCH-TILES-{sheet}.tiff'), '-colorspace', 'sRGB', png], check=True)
            sheets[sheet] = Image.open(png).convert('RGB')
        im = sheets[sheet]
        scale = im.width / cut.rect.width
        p = polys[index % 24]
        xs = [q.x * scale for q in p]
        ys = [q.y * scale for q in p]
        box = (int(min(xs)), int(min(ys)), int(max(xs)) + 1, int(max(ys)) + 1)
        tile = im.crop(box).convert('RGBA')
        mask = Image.new('L', tile.size, 0)
        ImageDraw.Draw(mask).polygon([(x - box[0], y - box[1]) for x, y in zip(xs, ys)], fill=255)
        tile.putalpha(mask)
        tile = tile.resize((tile.width // 2, tile.height // 2), Image.LANCZOS)
        dest = out / 'tiles' / 'reference' / f'{name}.png'
        dest.parent.mkdir(parents=True, exist_ok=True)
        tile.save(dest, optimize=True)
        print('tile reference', name, tile.size)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True, type=pathlib.Path)
    args = ap.parse_args()
    out = args.out

    for key, slug in PRIVATES.items():
        size = page_image(SRC / 'privates+peirs' / 'private companies' / f'PRIVATE-{key}.pdf',
                          out / 'privates' / f'{slug}.webp', heights=(1200, 600))
        print('private', slug, size)

    for variant in (1, 2):
        folder = SRC / 'shares' / f'shares variant 0{variant}'
        for i, company in enumerate(SHARE_ORDER):
            for kind, offset in (('share', 0), ('president', 1)):
                n = (2 * i + offset) * 2 + variant  # odd for v1, even for v2
                src = folder / ('share.pdf' if n == 1 else f'share_{n}.pdf')
                size = page_image(src, out / 'shares' / f'v{variant}' / f'{company}-{kind}.webp', heights=(1100,))
                print('share', variant, company, kind, src.name, size)
        pfolder = SRC / 'privates+peirs' / f'peir variant 0{variant}'
        for n, town in PEIR_ORDER.items():
            # file suffix k holds peir number 8-k; the unsuffixed file is peir 7
            k = 8 - n
            src = pfolder / (f'private-share-0{variant}.pdf' if k == 1 else f'private-share-0{variant}_{k}.pdf')
            size = page_image(src, out / 'peirs' / f'v{variant}' / f'peir-{n}-{town}.webp', heights=(1200, 600))
            print('peir', variant, n, town, size)
        page_image(pfolder / f'private-share-0{variant}-REVERSE.pdf', out / 'peirs' / f'v{variant}' / 'peir-back.webp')

    tile_reference(out)

    for slug, n, fill, pantone in TOKENS:
        svg = token_svg(SRC / 'wood' / '15 mm' / f'token-15mm-charter-{n:02d}.pdf', fill, slug)
        dest = out / 'tokens' / f'{slug}.svg'
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(svg)
        print('token', slug, pantone, len(svg))


if __name__ == '__main__':
    main()
