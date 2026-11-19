import { LOOK_URLS } from './lookUrls.js'
import { STONE_COLORS, stoneLook } from './looks.js'

// WebKit decodes an image when it first paints it, so a stone drawn for the first time could stay
// blank through its 0.16 s fall and show up already landed. Decoding both stones as the board
// opens, and holding on to them, keeps their pictures ready for every drop.
const held: HTMLImageElement[] = []

export function keepStonesDecoded() {
    if (held.length > 0) return
    for (const look of STONE_COLORS.flatMap((color) =>
        [false, true].map((flat) => stoneLook(color, flat))
    )) {
        const image = new Image()
        image.src = LOOK_URLS[look]
        held.push(image)
        image.decode().catch(() => {
            // A picture that fails to decode here is still drawn by the board as usual.
        })
    }
}
