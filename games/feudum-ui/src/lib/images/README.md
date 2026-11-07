# Images

`cover.webp` is the catalog image, drawn by `scripts/make-cover.mjs` from the palette, the colorizer's seat colours and the shape module. It is our own work. Rerun the script after changing any of those; it keeps the image at 544 × 680, lossy WebP, at most 120 KB.

Run with `--art <image> --out src/lib/art/supplied/cover.webp`, the script makes the supplied cover from an image in the asset folder's sources, with the same title band; the asset map then prefers that file.
