# Images

`cover.webp` is the catalog image, drawn by `scripts/make-cover.mjs` from the palette, the colorizer's seat colours and the shape module. It is our own work. Rerun the script after changing any of those; it keeps the image at 544 × 680, lossy WebP, at most 120 KB.

Run with `--art <image> --titled --out src/lib/art/supplied/cover.webp`, the script makes the supplied cover from the publisher's printed cover, cropped to 544 × 680's 4:5: the image is the whole cover, since it prints its own title. Without `--titled`, a supplied scene stands behind the same title band as the drawn cover. The asset map prefers the supplied file when it is there.
