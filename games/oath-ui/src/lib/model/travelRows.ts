import {
    ActionType,
    tollsFor,
    type HydratedOathGameState,
    type ModifierUse,
    type Region
} from '@tabletop/oath'
import { travelWays, type TravelWay } from './actionOffers.js'
import { fittingModifiers } from './modifierFit.js'

export type TravelChoice = TravelWay & { favorTo: (string | undefined)[] }

export type TravelRow = {
    slotId: string
    region: Region
    /** Absent while the site is facedown (R-9.4). */
    cardId?: string
    ways: TravelChoice[]
    /** The cards in use that fit this destination: its ways are priced and sent with them. */
    modifiers: ModifierUse[]
}

/** R-7.4 — the cards in use a Travel to this site is judged and sent with. */
export function travelModifiers(
    state: HydratedOathGameState,
    playerId: string,
    slotId: string,
    declared: readonly ModifierUse[]
): ModifierUse[] {
    return fittingModifiers(state, playerId, ActionType.Travel, declared, {
        destinationSiteId: slotId
    })
}

/** R-5.6, R-7.1.4, R-11.12 — every Travel the player can make now, read from the engine's terms. */
export function travelRows(
    state: HydratedOathGameState,
    playerId: string,
    declared: readonly ModifierUse[]
): TravelRow[] {
    return state.allSiteIds().flatMap((slotId): TravelRow[] => {
        const modifiers = travelModifiers(state, playerId, slotId, declared)
        const terms = travelWays(state, playerId, slotId, modifiers)
        if (terms.length === 0) return []
        const tolls = tollsFor(state, playerId, { kind: 'travel', toSiteId: slotId })
        const ways = terms.map((way) => ({
            ...way,
            favorTo: way.tolls.map((cardId) => tolls.find((t) => t.cardId === cardId)?.payeeId)
        }))
        const cardId = state.isSiteFaceup(slotId) ? state.siteCardAt(slotId) : undefined
        return [
            {
                slotId,
                region: state.regionOf(slotId),
                ...(cardId ? { cardId } : {}),
                ways,
                modifiers
            }
        ]
    })
}
