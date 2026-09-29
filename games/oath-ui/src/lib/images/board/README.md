# Board art

`map.jpg`, 2572 × 1024: the whole map in one image, and the surface every board layer
positions against.

## How it is made

The three map scans are placed left to right (4096 + 4096 + 2098 × 4096 = 10290 × 4096),
resampled with Lanczos to a quarter scale, and encoded as progressive JPEG at quality 86
with 4:2:0 chroma subsampling. The 0.02%
horizontal squeeze from 2572.5 to 2572 buys whole-number board coordinates and is smaller
than a source pixel.

**Regenerating it invalidates the board geometry,** whose every number is in this image's
pixel space. Keep 2572 × 1024 or re-measure.

## Licensing

Third-party copyrighted art, not covered by the platform's MIT licence. Permission to use it
is on file with the repository owner.
