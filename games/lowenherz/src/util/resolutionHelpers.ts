import type { HydratedLowenherzGameState } from '../model/gameState.js'
import { ActionCardType } from '../definition/actionCards.js'
import { MachineState } from '../definition/states.js'

// Money Bag never negotiates or duels - the rulebook's one exception to "an action can
// only be performed by one player." Ducats split evenly among every chooser, truncating
// fractions; a no-op if no one chose it.
export function distributeMoneyBag(
    state: HydratedLowenherzGameState,
    amount: number,
    chooserIds: string[]
) {
    if (chooserIds.length === 0) return
    const share = Math.floor(amount / chooserIds.length)
    for (const playerId of chooserIds) {
        state.getPlayerState(playerId).money += share
    }
}

// Ends the round once every slot is resolved: the first player castle passes to the
// next player in seating order, and the per-round tracking fields reset for the next
// card draw.
export function advanceRound(state: HydratedLowenherzGameState) {
    const currentIndex = state.turnOrder.indexOf(state.firstPlayerId)
    state.firstPlayerId = state.turnOrder[(currentIndex + 1) % state.turnOrder.length]
    state.decisions = []
    state.currentActionCard = undefined
    state.resolvedSlots = []
}

// Called right after a slot's contest is settled (money bag payout, solo win,
// negotiation accept, or duel win/giveup) to decide what happens next. A border-slot
// winner hands off to PlacingWalls (unless they've already hit the rulebook's 3-region
// cap); a knight-slot winner hands off to PlacingKnights (capped by their knight
// stock - region expansion, the other half of the knight action, isn't built yet, so
// this always means "place a knight"). Everything else (no winner, or Money Bag) just
// continues the ResolvingActions cascade to the next slot.
export function routeAfterSlotResolved(state: HydratedLowenherzGameState): MachineState {
    const lastResolved = state.resolvedSlots[state.resolvedSlots.length - 1]
    const winnerId = lastResolved?.winnerPlayerId
    if (!winnerId) return MachineState.ResolvingActions

    const card = state.currentActionCard
    if (!card || card.type !== ActionCardType.Standard) return MachineState.ResolvingActions

    // Slot 1 is always income/politics, never border/knight - band is only defined
    // for slots 2/3.
    const band = lastResolved.slot === 2 ? card.middle : lastResolved.slot === 3 ? card.bottom : undefined
    if (!band) return MachineState.ResolvingActions

    if (band.kind === 'border') {
        const winnerColor = state.getPlayerState(winnerId).color
        const winnerRegionCount = state.regions.filter((r) => r.ownerColor === winnerColor).length
        // "When a prince has three regions, he can place no more boundary walls" -
        // they still won the action, they just can't do anything with it.
        if (winnerRegionCount >= 3) return MachineState.ResolvingActions

        state.wallsRemaining = band.count
        state.wallPlacingPlayerId = winnerId
        return MachineState.PlacingWalls
    }

    if (band.kind === 'knight') {
        const winnerKnightsInStock = state.getPlayerState(winnerId).knightsInStock
        const knightsToPlace = Math.min(band.count, winnerKnightsInStock)
        // "If he has no more knights, he may place no more" - they still won, they
        // just can't do anything with it.
        if (knightsToPlace <= 0) return MachineState.ResolvingActions

        state.knightsRemaining = knightsToPlace
        state.knightPlacingPlayerId = winnerId
        return MachineState.PlacingKnights
    }

    return MachineState.ResolvingActions
}
