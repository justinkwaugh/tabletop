import { secretsFlipped, type HydratedOathGameState, type TollOccasion } from '@tabletop/oath'
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
    // R-11.13 — the secrets every legal way flips facedown: one, or two (R-11.13-H2).
    const flipped =
        travelWays.length > 0
            ? Math.min(...travelWays.map((way) => secretsFlipped(way.flipSecret)))
            : 0
    if (flipped === 1) parts.push('a secret flipped')
    if (flipped > 1) parts.push(`${flipped} secrets flipped`)
    return parts.length ? ` + ${parts.join(' + ')}` : ''
}
