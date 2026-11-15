import { ActionType } from '@tabletop/oath'

/** R-6.6.1 — the relic whose two powers are the Offer Citizenship and Exile Citizen minors. */
export const GRAND_SCEPTER = 'relic.grand-scepter'

/** R-6.7, R-6.8 — the Scepter's uses its one "Use" offers, in the grid's order. */
const SCEPTER_ACTIONS = [ActionType.OfferCitizenship, ActionType.ExileCitizen] as const

/**
 * The Grand Scepter's uses the seat can take now: the engine offers each only to its holder,
 * when not taken this turn (R-6.6.1), and with someone to offer to or exile.
 */
export function scepterActions(valid: readonly string[]): ActionType[] {
    return SCEPTER_ACTIONS.filter((type) => valid.includes(type))
}
