import type { TownTileKindId } from '@tabletop/promontory-point'
import plus1 from './tiles/tile.price.plus-1.webp'
import plus2 from './tiles/tile.price.plus-2.webp'
import plus3 from './tiles/tile.price.plus-3.webp'
import minus1 from './tiles/tile.price.minus-1.webp'
import minus2 from './tiles/tile.price.minus-2.webp'
import minus3 from './tiles/tile.price.minus-3.webp'
import dividend from './tiles/tile.red.dividend.webp'
import repairs from './tiles/tile.red.hammer.webp'
import type { SizedImage } from './sizedImage.js'

const TOWN_TILE_FACES: Record<TownTileKindId, string> = {
    'tile.price.plus-1': plus1,
    'tile.price.plus-2': plus2,
    'tile.price.plus-3': plus3,
    'tile.price.minus-1': minus1,
    'tile.price.minus-2': minus2,
    'tile.price.minus-3': minus3,
    'tile.red.dividend': dividend,
    'tile.red.hammer': repairs
}

// R-1.1, R-1.3 — one supplied face per town tile kind; tiles lie face up, so the back is never shown.
export function townTileImage(kindId: TownTileKindId): SizedImage {
    return { src: TOWN_TILE_FACES[kindId], width: 300, height: 300 }
}
