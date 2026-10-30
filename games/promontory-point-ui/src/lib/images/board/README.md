# Board art

`map.webp`, 3100 × 1998, 300,086 bytes (ceiling 800 KB): the supplied map, and the surface every board layer positions against.

## Source and how it is made

The supplied `Map.jpg`, 3571 × 2302. Resized to 3100 wide (1998 tall, the aspect kept) with a Lanczos-3 filter, then encoded with libwebp 1.6 as lossy WebP at quality 82 with sharp RGB→YUV conversion (`-sharp_yuv`), method 6, no alpha channel. Nothing is cropped or retouched. The tools ran outside the repository.

Board geometry stays in the original's 3571 × 2302 units; the board scales this image to fill that box, so the resize changes no coordinate.

## Rendered size

| Render                                                               | Width (CSS px) |
| -------------------------------------------------------------------- | -------------- |
| Desktop full screen at 1920 × 1080: height-bound, about 1000 px tall | about 1550     |
| Phone pick framing (the board fitted to the hex field's width)       | about 1470     |

The largest ordinary render is about 1550 wide, so 3100 is 2× it. Re-measure when the board's layout changes and keep the file within 2× its largest render.
