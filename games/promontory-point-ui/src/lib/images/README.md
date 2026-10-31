# Images

| Folder or file | What                                              |
| -------------- | ------------------------------------------------- |
| `board/`       | the map (`boardImages.ts`)                        |
| `cards/`       | the four share faces (`cardImages.ts`)            |
| `tiles/`       | the eight town tile faces (`tileImages.ts`)       |
| `cover.webp`   | the catalogue cover (`definitions/definition.ts`) |

Each folder's README says how its files were made and how large they render. Every file is imported by URL. `imageCoverage.spec.ts` checks that every railroad and town tile kind has a face, that no file is orphaned, and each file's encoding, size and byte ceiling.

## Cover

`cover.webp`, 544 × 680, 34,122 bytes (ceiling 120 KB). Rendered 340 px tall on the large catalogue card and 150 px tall on the compact one; 680 is 2× the larger.

Composed once from the supplied art: the map, scaled to 0.27 of its original size and cropped around Promontory with the Central Pacific and Union Pacific homes in view; the four share faces fanned across the lower half; and "PROMONTORY POINT" in Oswald 600, 80 px, on a tan band across the top in the palette's paper, paper-line and ink colours. The composition was laid out as HTML in a browser, captured at 2× (1088 × 1360), resized to 544 × 680 with a Lanczos-3 filter and encoded with libwebp 1.6 as lossy WebP at quality 82 with sharp RGB→YUV conversion, no alpha channel. The title was checked readable at 150 and 340 px tall. The composition file and the tools are not in the repository.
