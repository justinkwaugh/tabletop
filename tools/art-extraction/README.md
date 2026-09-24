# Art extraction

One-off scripts that turn the raw publisher print files in `artassets/` (untracked, multi-GB) into
the committed assets under `games/<title>-ui/src/lib/images/published/`.

Requirements: `python3` with `pymupdf`, `pillow`, `numpy`, and ImageMagick `convert` (for the
CMYK TIFF punch sheets).

```sh
python3 tools/art-extraction/extract_top.py --out games/the-old-prince-ui/src/lib/images/published
python3 tools/art-extraction/extract_shikoku.py --out games/shikoku-1889-ui/src/lib/images/published
```

`pdfsvg.py` re-emits a region of a PDF page's vector drawings as a compact SVG (PyMuPDF's own SVG
export always carries the whole page). The Shikoku hex-to-tile-number table and the Old Prince
share/peir numbering were read off the sheets by eye and live at the top of each script.
