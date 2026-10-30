# Town tile faces

One face per town tile kind, square as supplied. The board clips each to a pointy-top hex and turns the number tiles a quarter turn so the number reads upright (O-6). The tile back is not shipped: the tiles lie face up (R-1.3).

| File                      | Kind     | Source       | Size      | Bytes |
| ------------------------- | -------- | ------------ | --------- | ----- |
| `tile.price.plus-1.webp`  | +1       | `+1.png`     | 300 × 300 | 6,744 |
| `tile.price.plus-2.webp`  | +2       | `+2.png`     | 300 × 300 | 7,280 |
| `tile.price.plus-3.webp`  | +3       | `+3.png`     | 300 × 300 | 7,330 |
| `tile.price.minus-1.webp` | −1       | `-1.png`     | 300 × 300 | 6,738 |
| `tile.price.minus-2.webp` | −2       | `-2.png`     | 300 × 300 | 7,162 |
| `tile.price.minus-3.webp` | −3       | `-3.png`     | 300 × 300 | 7,260 |
| `tile.red.dividend.webp`  | Dividend | `$.png`      | 300 × 300 | 6,132 |
| `tile.red.hammer.webp`    | Repairs  | `Hammer.png` | 300 × 300 | 5,888 |

Ceiling: 20 KB each, 160 KB for the eight.

## How they are made

Kept at the supplied 300 × 300 and encoded with libwebp 1.6 as lossy WebP at quality 82 with sharp RGB→YUV conversion (`-sharp_yuv`), method 6, no alpha channel. Nothing is cropped, turned or retouched; the board turns the number tiles. The tools ran outside the repository.

## Rendered size

| Render                         | Width (CSS px) |
| ------------------------------ | -------------- |
| Enlarged                       | 160            |
| On a full-screen desktop board | about 70       |
| In text (Dividend, Repairs)    | 16             |

The largest ordinary render is 160; 300 is under 2× it, so the supplied size is kept.
