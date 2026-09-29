import { HydratedOathGameState, type RelicSlot } from '../model/gameState.js'
import { IMPERIAL_COLOR } from '../model/oathEnums.js'
import { GRAND_SCEPTER_ID, RELIQUARY_SIZE } from '../data/relics.js'
import { countOf } from './warbands.js'

/** R-2.3, R-1.17 */
export const RELIQUARY_SPACES = RELIQUARY_SIZE

/** R-6.4, R-6.6.1, R-6.7, R-6.8 */
export function holdsGrandScepter(state: HydratedOathGameState, playerId: string): boolean {
    return state.getPlayerState(playerId).relicIds.includes(GRAND_SCEPTER_ID)
}

/** "You cannot use this if you took it on this turn" */
export function canUseGrandScepter(state: HydratedOathGameState, playerId: string): boolean {
    if (!holdsGrandScepter(state, playerId)) return false
    // R-1.8's setup grant stamps no marker, and two undefineds must not read as "locked".
    if (state.grandScepterTakenOnTurnStart === undefined) return true
    return state.grandScepterTakenOnTurnStart !== state.turnManager.currentTurn()?.start
}

/** R-1.8 — the setup grant does not call this. */
export function recordGrandScepterTaken(state: HydratedOathGameState): void {
    state.grandScepterTakenOnTurnStart = state.turnManager.currentTurn()?.start
}

export function grandScepterHolderId(state: HydratedOathGameState): string | undefined {
    return state.relicHolderOf(GRAND_SCEPTER_ID)?.playerId
}

/** R-1.8, R-5.2.2 — the Chancellor's bank is the Empire's pool, so a Citizen musters from it. */
export function imperialWarbandBankOwner(state: HydratedOathGameState): string {
    return state.chancellorId()
}

/** R-6.6.2, R-9.3 */
export function availableImperialWarbands(state: HydratedOathGameState): number {
    return countOf(
        state.getPlayerState(state.chancellorId()).warbandsInPersonalBank,
        IMPERIAL_COLOR
    )
}

/** R-2.3 — a taken relic's slot leaves the array, so an absent slot is an uncovered space. */
export function reliquarySlot(state: HydratedOathGameState, slotId: string): RelicSlot | undefined {
    return state.reliquarySlots().find((slot) => slot.slotId === slotId)
}

/** R-2.3, R-6.6.2.a — each uncovered space grants the Chancellor its modifier. */
export function uncoveredReliquarySpaces(state: HydratedOathGameState): number {
    return RELIQUARY_SPACES - state.reliquarySlots().length
}
