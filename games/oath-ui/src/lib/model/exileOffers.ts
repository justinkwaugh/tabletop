import { assertExists } from '@tabletop/common'
import {
    HydratedExileCitizen,
    HydratedSelfExile,
    grandScepterHolderId,
    type HydratedOathGameState
} from '@tabletop/oath'

/** R-6.7 — each Citizen this seat may exile, with the favor the exile gives them. */
export function exileCitizenOffers(
    state: HydratedOathGameState,
    playerId: string
): { citizenPlayerId: string; favor: number }[] {
    return HydratedExileCitizen.legalTargets(state, playerId).map((citizenPlayerId) => ({
        citizenPlayerId,
        favor: HydratedExileCitizen.exileCost(state, playerId, citizenPlayerId)
    }))
}

/** R-6.8, R-10.11 — what exiling yourself gives the Grand Scepter's holder, when it is allowed. */
export function selfExileOffer(
    state: HydratedOathGameState,
    playerId: string
): { favor: number; holderId: string } | undefined {
    if (HydratedSelfExile.reasonCannotSelfExile(state, playerId) !== undefined) return undefined
    const holderId = grandScepterHolderId(state)
    assertExists(holderId, 'A self-exile the engine allows has a Scepter holder to pay')
    return { favor: HydratedSelfExile.selfExileCost(state, playerId).total, holderId }
}
