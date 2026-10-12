import { assertExists } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import type { PowerChoice, PowerChoiceKind } from '../model/powerChoice.js'
import { cardPower, powerIndexOf, PowerTiming, type CardPower } from '../data/cardPowers.js'
import { usableFavor } from './favor.js'
import { reasonPersistentForbidsGivingSecrets } from './persistent.js'
import { secretsNeeded } from './powerCost.js'

// "Action: Give [secret] to a player whose pawn is at your site to take [favor][favor] from them,
//  or give [favor][favor] for [secret], any number of times." Cost: place 1 secret.
export const WITCHS_BARGAIN = 'denizen.arcane.witchs-bargain'

/** One player's exchanges in a use from revision 7: its Q&A lets one use deal with several. */
export type BargainEntry = Extract<PowerChoice, { kind: PowerChoiceKind.Bargain }>

function witchsBargainPower(): CardPower {
    const power = cardPower(WITCHS_BARGAIN, powerIndexOf(WITCHS_BARGAIN, PowerTiming.Action))
    assertExists(power, `${WITCHS_BARGAIN} prints no Action power`)
    return power
}

/** R-7.1.2 — the cost is paid before the power resolves, so its secrets cannot also be given. */
export function secretsToGiveAfterCost(
    state: HydratedOathGameState,
    playerId: string,
    power: CardPower = witchsBargainPower()
): number {
    return Math.max(0, state.getPlayerState(playerId).secrets - secretsNeeded(power.cost))
}

export interface WitchsBargainBounds {
    /** Secrets the entry may give, two of their favor taken for each: none under Vow of Silence. */
    secrets: number
    /** Pairs of favor the entry may give, one of their secrets taken for each. */
    pairs: number
    /** Vow of Silence: "You cannot … give anyone [secret]." */
    silenced: boolean
}

/**
 * The most one entry with `withId` may give beside the other entries named, which share what the
 * user holds after the cost. Their last secret can be taken (its Q&A: "Yup!"). Read-only: the
 * effect's own check is the rule, and this agrees with it.
 */
export function witchsBargainBounds(
    state: HydratedOathGameState,
    playerId: string,
    withId: string,
    others: readonly BargainEntry[] = []
): WitchsBargainBounds {
    const rest = others.filter((entry) => entry.playerId !== withId)
    const them = state.getPlayerState(withId)
    const silenced = reasonPersistentForbidsGivingSecrets(state, playerId) !== undefined
    const secretsLeft =
        secretsToGiveAfterCost(state, playerId) -
        rest.reduce((n, entry) => n + entry.secretsGiven, 0)
    const pairsLeft =
        Math.floor(usableFavor(state, playerId) / 2) -
        rest.reduce((n, entry) => n + entry.pairsGiven, 0)
    return {
        secrets: silenced ? 0 : Math.max(0, Math.min(secretsLeft, Math.floor(them.favor / 2))),
        pairs: Math.max(0, Math.min(pairsLeft, them.secrets)),
        silenced
    }
}
