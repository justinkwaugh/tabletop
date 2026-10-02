import {
    tollsFor,
    type HydratedOathGameState,
    type ModifierUse,
    type Region,
    HydratedTravel
} from '@tabletop/oath'
import { travelWays, type TravelWay } from './actionOffers.js'

export type TravelChoice = TravelWay & { favorTo: (string | undefined)[] }

export type TravelRow = {
    slotId: string
    region: Region
    /** Absent while the site is facedown (R-9.4). */
    cardId?: string
    ways: TravelChoice[]
}

/** R-5.6, R-7.1.4, R-11.12 — every Travel the player can make now, read from the engine's terms. */
export function travelRows(
    state: HydratedOathGameState,
    playerId: string,
    modifiers: ModifierUse[]
): TravelRow[] {
    return HydratedTravel.legalDestinations(state, playerId, modifiers).map((slotId) => {
        const tolls = tollsFor(state, playerId, { kind: 'travel', toSiteId: slotId })
        const ways = travelWays(state, playerId, slotId, modifiers).map((way) => ({
            ...way,
            favorTo: way.tolls.map((cardId) => tolls.find((t) => t.cardId === cardId)?.payeeId)
        }))
        const cardId = state.isSiteFaceup(slotId) ? state.siteCardAt(slotId) : undefined
        return { slotId, region: state.regionOf(slotId), ...(cardId ? { cardId } : {}), ways }
    })
}
