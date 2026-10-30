import {
    RAILROAD_IDS,
    sharePriceAt,
    uncoveredRedTileCount,
    type PromontoryPointProjectedState,
    type RailroadId
} from '@tabletop/promontory-point'
import { RAILROAD_TAGS } from './railroadTags.js'

export type StatusStripPrice = { railroadId: RailroadId; text: string }

export type StatusStrip = {
    prices: StatusStripPrice[]
    bag: string
    redTiles: string
    // The whole line in words, for a screen reader.
    label: string
}

// O-4, R-1.2, R-5, R-6.1: on a phone the price track and the sea sit a pan away, so one line
// tells the four prices, the bag and the red tiles uncovered, all read from the displayed state.
export function statusStrip(
    state: Pick<PromontoryPointProjectedState, 'priceIndex' | 'bag' | 'towns' | 'track'>
): StatusStrip {
    const prices = RAILROAD_IDS.map((railroadId) => ({
        railroadId,
        text: `${RAILROAD_TAGS[railroadId]} $${sharePriceAt(state.priceIndex[railroadId])}`
    }))
    const remaining = state.bag.remaining
    const red = uncoveredRedTileCount(state)
    const bagWords = `${remaining} ${remaining === 1 ? 'piece' : 'pieces'} in the bag`
    const redWords = `${red} red ${red === 1 ? 'tile' : 'tiles'} uncovered`
    return {
        prices,
        bag: `bag ${remaining}`,
        redTiles: `red ${red}`,
        label: [...prices.map((price) => price.text), bagWords, redWords].join(', ')
    }
}
