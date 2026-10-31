# Board art

`map.webp`, 3100 × 1998, 300,086 bytes (ceiling 800 KB): the supplied map, and the surface every board layer positions against.

## Source and how it is made

The supplied map, 3571 × 2302. Resized to 3100 wide (1998 tall, the aspect kept) with a Lanczos-3 filter, then encoded with libwebp 1.6 as lossy WebP at quality 82 with sharp RGB→YUV conversion (`-sharp_yuv`), method 6, no alpha channel. Nothing is cropped or retouched. The tools ran outside the repository.

Board geometry stays in the original's 3571 × 2302 units; the board scales this image to fill that box, so the resize changes no coordinate.

## Rendered size

| Render                                                               | Width (CSS px) |
| -------------------------------------------------------------------- | -------------- |
| Desktop full screen at 1920 × 1080: height-bound, about 1000 px tall | about 1550     |
| Phone pick framing (the board fitted to the hex field's width)       | about 1470     |

The largest ordinary render is about 1550 wide, so 3100 is 2× it. Re-measure when the board's layout changes and keep the file within 2× its largest render.

## Board geometry, measured

`src/lib/utils/boardGeometry.ts` holds every position in the original's 3571 × 2302 pixels. Each value was measured off the supplied map at that native size by a pixel-analysis script run outside the repository (pure Python over a BMP copy of the map, no imaging library); nothing was placed by eye.

### Method

- **Hex grid.** The printed grid lines are light (luminance 185 or more) on the olive hexes. Along each of the 13 hex rows the script finds every vertical hex edge, a 3–9 px light run between darker fill, and averages its centre over 13 scan lines; it then follows each edge segment up and down (gaps of up to 5 px allowed for paper speckle) to find its vertical extent. A least-squares fit of the edge centres to `x = x0 + w·(q + r/2 + 1/2)` uses 117 edges; a fit of the segments' midpoints to `y = y0 + h·r` uses the 104 edges inside the board (edges on its rim run on into the light ground).
- **Price track.** The sea is the region where blue exceeds red by more than 10. Its top, bottom and left edges come from scans at two columns and three rows. The rules between its rows are the light runs (luminance 150 or more, at most 5 px thick) on two columns, averaged; the column split is the thin vertical light rule below the full-width rule. Each space spans from one rule (or sea edge) to the next. The printed numerals are the light connected components of 60 px or more (smaller ones are speckle); each column's four railroad slots share the width beside its numerals, 10 px clear of them: from the sea's left edge to the left column's numerals, and from the right column's numerals to the end of its rules.
- **Border track.** The rules between the band's spaces are grey-green (green exceeds red by more than 5); a pixel column (or row) is a rule where 60 % of the band's depth is that colour. The band's inner edges are the outlines of the four corner squares, found by walking in from the image edge until the plain ground resumes. Each space spans from one rule to the next, and from the image edge to the band's inner edge; the corner squares run from the image edges to those inner edges. A space shared by two or more seats is split into four equal quarters (the 2×2 grid).
- **Sea slots (share decks, bag, end tracker).** The coast right of the price track is the first point, scanning right from the end of the price track's rules, where 12 consecutive pixels are all land, every 20 px down to the full-width rule. The sea slots are laid inside that outline, and the script checks each slot, grown by a 15 px margin on every side, is at least 98 % sea and clear of the price track.

### Measured values

| What                             | Value                                                                                                                                                                                         |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hex origin (Promontory, 0,0)     | x0 = 2228.73, y0 = 1152.09                                                                                                                                                                    |
| Hex pitch                        | w = 188.09 across (largest residual 0.78 px, rms 0.31), h = 153.45 down (largest residual 3.75 px, rms 0.60)                                                                                  |
| Hex half-width, vertical radius  | 94.05, 102.30 (h ÷ 1.5)                                                                                                                                                                       |
| Sea edges                        | top 127, bottom 2177, left 130                                                                                                                                                                |
| Price-track rules (y)            | 204, 294, 384, 474, 564, 654, 743.75, 833.75, 923.5, 1013.5, 1103.5, 1193.5, 1283, 1373, 1463, 1553, 1643, 1733, 1823, 1913, 2003, 2093                                                       |
| Price-track columns              | split at x 624.5; right column's rules end at 1120; numerals at 549–604 (left) and 657–684 (right)                                                                                            |
| Price slots (x span of the four) | left column 130–539 (each 102.25 wide), right column 694–1120 (each 106.5)                                                                                                                    |
| Border inner edges               | left 115, top 111, right 3460, bottom 2192                                                                                                                                                    |
| Border rules, top (x)            | 227.5, 343.5, 459, 574, 689, 805.5, 920.5, 1035.5, 1150, 1269.5, 1383.5, 1499, 1614, 1729, 1845.5, 1961, 2075.5, 2192, 2304.5, 2424, 2538.5, 2654, 2769.5, 2885.5, 3001, 3115.5, 3231, 3347.5 |
| Border rules, bottom (x)         | 227.5, 343.5, 459, 574, 689, 805.5, 920.5, 1035.5, 1150, 1270, 1383.5, 1499, 1614, 1729, 1845.5, 1961, 2075.5, 2192, 2305, 2424, 2539.5, 2654, 2769.5, 2885.5, 3001.5, 3115.5, 3231, 3347.5   |
| Border rules, left (y)           | 219, 328, 437.5, 547.5, 657, 766, 875.5, 984, 1092.5, 1212, 1319.5, 1429.5, 1536.5, 1648, 1758, 1865.5, 1975.5, 2085.5                                                                        |
| Border rules, right (y)          | 219, 328, 437.5, 547.5, 657, 766, 875.5, 985.5, 1092.5, 1212, 1319.5, 1429.5, 1537, 1647.5, 1758, 1866.5, 1975.5, 2085.5                                                                      |
| Bag                              | x 642, y 225, 140 × 170 (99.2 % sea with margin)                                                                                                                                              |
| Share decks, 124 × 193           | CP 643, 744; UP 788, 744; KP 643, 964; SP 788, 964 (98.1 % to 100 % sea)                                                                                                                      |
| End tracker                      | x 645, y 1270, 380 × 250 (99.6 % sea)                                                                                                                                                         |

The price track's left column holds 25 down to 3 (index 29 to 7); its right column holds, from the bottom, 2 and 1 (index 6 and 5) and then the five 0 spaces upward (index 4 to 0), so index 0, the last 0, faces 9. The border track starts with 0 in the bottom-left corner and runs clockwise: 1–19 up the left, 20 top-left, 21–49 along the top, 50 top-right, 51–69 down the right, 70 bottom-right, 71–99 along the bottom.

### Pitch

The printed runs are not perfectly even, and the table keeps them as printed. Mean pitch and largest step off it: price track left column 89.52 (6.02, the short top row 25), right column 89.50 (2.50); border track top and bottom 115.27 (3.52), sides 109.58 (4.42, the wider tabs at 10, 30, 40, 60, 80 and 90). `boardGeometry.spec.ts` holds every run to 8 px.

### Overlay check

The dev harness's `/geometry` page draws every measured position over the map: each space's and home hex's centre with its hex outline, each price slot, each border space with its 2×2 quarters, and the sea slots. A screenshot at desktop width (1920 × 1080) showed every centre inside its printed space, the hex outlines on the printed grid lines (the coastal space −6,5 included), the price slots inside their rows clear of the numerals, the border spaces on the printed rules, and the sea slots in open sea.
