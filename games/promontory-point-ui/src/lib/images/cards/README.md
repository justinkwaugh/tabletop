# Share faces

One face per railroad, the whole share as supplied ("ONE SHARE" and the railroad's home-hex emblem). The share back is not shipped: the decks lie face up (R-1.3).

| File            | Railroad         | Source        | Size       | Bytes  |
| --------------- | ---------------- | ------------- | ---------- | ------ |
| `share.cp.webp` | Central Pacific  | supplied face | 675 × 1050 | 26,994 |
| `share.up.webp` | Union Pacific    | supplied face | 675 × 1050 | 24,844 |
| `share.kp.webp` | Kansas Pacific   | supplied face | 675 × 1050 | 26,480 |
| `share.sp.webp` | Southern Pacific | supplied face | 675 × 1050 | 24,660 |

Ceiling: 70 KB each, 280 KB for the four.

## How they are made

Kept at the supplied 675 × 1050. The supplied faces carry an alpha channel that no pixel uses (every pixel is opaque), so it is dropped. Each is encoded with libwebp 1.6 as lossy WebP at quality 82 with sharp RGB→YUV conversion (`-sharp_yuv`), method 6. Nothing is cropped or retouched. The tools ran outside the repository.

## Rendered size

| Render                                     | Width (CSS px) |
| ------------------------------------------ | -------------- |
| Enlarged on a phone: the screen less 32 px | up to 343      |
| Enlarged on a desktop                      | 300            |
| Deck in the sea, full-screen desktop board | about 54       |
| Panel face                                 | 38             |
| Seat card stack                            | 30             |

The largest ordinary render is 343 wide; 675 is under 2× it, so the supplied size is kept and one file serves every size.
