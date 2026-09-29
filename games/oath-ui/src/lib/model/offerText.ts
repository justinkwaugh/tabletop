import type { HydratedOathGameState, TollOccasion } from '@tabletop/oath'
import { chosenTolls, type TravelWay } from './actionOffers.js'

export const START_HERE = 'start here'

/** R-7.1.4 — what rides on the tap beyond Supply, as the site's chip reads it. */
export function tollLabel(
    state: HydratedOathGameState,
    playerId: string,
    occasion: TollOccasion,
    nameOf: (playerId: string) => string,
    travelWays: readonly TravelWay[] = []
): string {
    const tolls = chosenTolls(state, playerId, occasion)
    const parts: string[] = []
    if (tolls.length > 0) {
        const to = tolls.map((t) => (t.payeeId ? nameOf(t.payeeId) : 'the fire'))
        parts.push(`${tolls.length} favor to ${[...new Set(to)].join(', ')}`)
    }
    // R-11.13 — a secret flipped facedown when every legal way asks for one.
    if (travelWays.length > 0 && travelWays.every((way) => way.flipSecret)) {
        parts.push('a secret flipped')
    }
    return parts.length ? ` + ${parts.join(' + ')}` : ''
}
