#!/usr/bin/env bash
# Extracts the board, route tiles, bonus tiles and raid chits from rvtk's Kogge print-and-play
# redesign (BGG thread 2501796, shared with Andreas Steding's permission) into
# src/lib/images/redesign. Needs poppler-utils and ImageMagick with WebP.
#
# Usage: scripts/import-redesign-art.sh <folder with the redesign PDFs>
set -euo pipefail

SOURCE=$(cd "$1" && pwd)
ROOT=$(cd "$(dirname "$0")/.." && pwd)
OUT="$ROOT/src/lib/images/redesign"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$OUT"

pdfimages -j "$SOURCE/kogge_board_fullwbleed.pdf" "$WORK/board"
pdfimages -j "$SOURCE/kogge_route_tiles_front_A4.pdf" "$WORK/front"
pdfimages -j "$SOURCE/kogge_route_tiles_back_A4.pdf" "$WORK/back"
pdftoppm -r 300 -png "$SOURCE/kogge_misc_tiles_A4.pdf" "$WORK/misc"

convert "$WORK/board-000.jpg" -resize 2400x -quality 82 "$OUT/board.webp"

# Route tiles: one 290px tile per value, centred on its numeral and ornaments.
TILE_CENTRES=(290,300 290,660 290,1020 291,1426 291,1779 290,2193 877,2193 1766,2191 2060,2191)
for value in "${!TILE_CENTRES[@]}"; do
    centre=${TILE_CENTRES[$value]}
    x=$((${centre%,*} - 145))
    y=$((${centre#*,} - 145))
    convert "$WORK/front-000.jpg" -crop "290x290+$x+$y" +repage -resize 160x160 -quality 85 \
        "$OUT/tile-$value.webp"
done
convert "$WORK/back-000.jpg" -crop 290x290+151+228 +repage -resize 160x160 -quality 85 \
    "$OUT/tile-back.webp"

MISC="$WORK/misc-1.png"
convert "$MISC" -crop 538x372+290+317 +repage -resize 50% -quality 85 "$OUT/bonus-extra-route-marker.webp"
convert "$MISC" -crop 538x372+827+317 +repage -resize 50% -quality 85 "$OUT/bonus-move-two.webp"
convert "$MISC" -crop 538x400+290+703 +repage -resize 50% -quality 85 "$OUT/bonus-secret-passage.webp"
convert "$MISC" -crop 538x400+827+703 +repage -resize 50% -quality 85 "$OUT/bonus-three-for-one.webp"

convert "$MISC" -crop 276x292+1594+171 +repage -resize 50% -quality 85 "$OUT/raid-blue.webp"
convert "$MISC" -crop 276x292+1594+463 +repage -resize 50% -quality 85 "$OUT/raid-red.webp"
convert "$MISC" -crop 276x292+1594+758 +repage -resize 50% -quality 85 "$OUT/raid-yellow.webp"
convert "$MISC" -crop 276x292+1594+1053 +repage -resize 50% -quality 85 "$OUT/raid-green.webp"

ls -la "$OUT"
