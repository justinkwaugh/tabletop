#!/usr/bin/env bash
# Makes the board art in src/lib/images, and the two cards the cover shows, from the Locomotive
# Werks source files, which stay out of git in this package's artassets/ folder:
#
#   artassets/cards/card-NN.png  the card PNGs "LocowerksCards Singles 4-6 v2-NN.png", the
#                                locomotives in print order
#   artassets/map.pdf            the tabloid map, whose first embedded image is the Crystal Palace
#                                banner
#
#   scripts/prepare-art.sh
#
# Needs ImageMagick with WebP and poppler's pdfimages.
set -euo pipefail

package=$(cd "$(dirname "$0")/.." && pwd)
sources="$package/artassets"
images="$package/src/lib/images"
cover="$package/scripts/cover-art"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

# scripts/render-cover.mjs shows cards 05 and 40: the card face inside its bleed and crop marks.
for n in 05 40; do
    convert "$sources/cards/card-$n.png" -crop 730x486+36+36 +repage -resize 440x -quality 78 \
        -define webp:method=6 "$cover/card-$n.webp"
done

pdfimages -png -f 1 -l 1 "$sources/map.pdf" "$work/map"
# The banner is toned from sepia to the steel grey of the rest of the interface. The board shows
# only its middle band; the cover shows all of it.
convert "$work/map-000.png" -colorspace Gray -fill "#5d7a8f" -tint 60 "$work/palace.png"
convert "$work/palace.png" -quality 72 "$cover/palace.webp"
convert "$work/palace.png" -gravity center -crop 1201x121+0+0 +repage -quality 72 \
    "$images/palace.webp"

# A fine paper grain that tiles unseen, softened into a steel-grey paper.
convert -size 160x160 xc:"#e3e9ed" \( -size 160x160 xc:gray50 -seed 7 -attenuate 1 +noise Random \
    -colorspace Gray -blur 0x0.45 -auto-level +level 33%,67% \) -compose softlight -composite \
    -define webp:filter-strength=0 -define webp:sns-strength=0 -quality 88 "$images/paper.webp"
