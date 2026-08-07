import { ActionSource, Color } from '@tabletop/common'
import type { HydratedLowenherzGameState } from '../model/gameState.js'
import { ActionCardType } from '../definition/actionCards.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { BOARD_COLS, BOARD_ROWS, castleSquaresForColor } from '../model/board.js'
import { HydratedPlaceWall } from '../actions/placeWall.js'

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

// The rulebook's "when a prince has three regions, he can place no more boundary walls",
// expressed as what that number actually means: a region contains exactly one castle, so a
// prince with a region per castle has nothing left to enclose. Three is simply how many
// castles a prince has in the standard game; the 2-player variant gives each of them four
// (see buildPlacementPlan), which a hardcoded 3 would lock out one castle early.
// Neutral-colour castles belong to no player and are counted for nobody.
export function hasEveryCastleEnclosed(state: HydratedLowenherzGameState, color: Color): boolean {
    const castleCount = castleSquaresForColor(state.board, color).length
    // No castles on the board at all: vacuously "all enclosed", but read as UNcapped
    // rather than capped. The cap exists to stop wall placement that can't accomplish
    // anything, and silently locking a colour out of walls on a count of zero is the worse
    // failure. Real games always place castles during setup, so this only comes up in
    // synthetic states.
    if (castleCount === 0) return false
    const regionCount = state.regions.filter((r) => r.ownerColor === color).length
    return regionCount >= castleCount
}

// Whether ANY wall could legally be placed anywhere on the board right now, by the
// given player - scans every adjacent square pair the same way the UI's
// legalWallEdges does, reusing PlaceWall's own validity check rather than
// re-deriving the rules. Used to detect the "won the border action, but the board's
// too full to place a wall anywhere" case up front, instead of making the winner
// manually Pass out of a phase that was never actually possible.
export function anyLegalWallPlacement(state: HydratedLowenherzGameState, playerId: string): boolean {
    for (let row = 0; row < BOARD_ROWS; row++) {
        for (let col = 0; col < BOARD_COLS; col++) {
            if (col + 1 < BOARD_COLS) {
                const candidate = new HydratedPlaceWall({
                    id: 'candidate',
                    gameId: state.gameId,
                    source: ActionSource.System,
                    type: ActionType.PlaceWall,
                    playerId,
                    col1: col,
                    row1: row,
                    col2: col + 1,
                    row2: row
                })
                if (candidate.isValidPlaceWall(state)) return true
            }
            if (row + 1 < BOARD_ROWS) {
                const candidate = new HydratedPlaceWall({
                    id: 'candidate',
                    gameId: state.gameId,
                    source: ActionSource.System,
                    type: ActionType.PlaceWall,
                    playerId,
                    col1: col,
                    row1: row,
                    col2: col,
                    row2: row + 1
                })
                if (candidate.isValidPlaceWall(state)) return true
            }
        }
    }
    return false
}

export type SlotRouting = {
    nextState: MachineState
    // Present whenever a solo winner's slot was a border/knight band - lets history
    // describe what they actually won (and, if placementSkippedReason is set, why
    // they immediately lost the chance to act on it) even though this metadata is
    // read long after wallsRemaining/knightsRemaining have moved on.
    bandKind?: 'border' | 'knight'
    bandCount?: number
    placementSkippedReason?:
        | 'regionCap'
        | 'noKnightsInStock'
        | 'noLegalWallSpots'
        | 'noPoliticsCardsLeft'
}

// Called right after a slot's contest is settled (money bag payout, solo win,
// negotiation accept, or duel win/giveup) to decide what happens next. A border-slot
// winner hands off to PlacingWalls (unless they've already hit the rulebook's 3-region
// cap, or there's genuinely nowhere left to place one); a knight-slot winner hands off
// to PlacingKnights (capped by their knight stock - region expansion, the other half of
// the knight action, isn't built yet, so this always means "place a knight").
// Everything else (no winner, or Money Bag) just continues the ResolvingActions
// cascade to the next slot.
export function routeAfterSlotResolved(state: HydratedLowenherzGameState): SlotRouting {
    const lastResolved = state.resolvedSlots[state.resolvedSlots.length - 1]
    const winnerId = lastResolved?.winnerPlayerId
    if (!winnerId) return { nextState: MachineState.ResolvingActions }

    const card = state.currentActionCard
    if (!card || card.type !== ActionCardType.Standard) return { nextState: MachineState.ResolvingActions }

    // Slot 1 is income or politics - Money Bag is handled directly in
    // ResolvingActionsStateHandler (it never has a real winner, so it can't reach
    // here), so the only slot-1 case reaching here with a winner is Crown and Scepter.
    if (lastResolved.slot === 1 && card.top.kind === 'politics') {
        // Both piles exhausted: there is nothing to look through and nothing to take, and
        // TakingPoliticsCard has no Pass, so entering it would strand its only active
        // player with no legal action. They won the slot; it just can't pay out.
        if (state.politicsCardPileA.length === 0 && state.politicsCardPileB.length === 0) {
            return {
                nextState: MachineState.ResolvingActions,
                placementSkippedReason: 'noPoliticsCardsLeft'
            }
        }
        state.politicsTakingPlayerId = winnerId
        return { nextState: MachineState.TakingPoliticsCard }
    }

    // Slot 1 is handled above; band is only defined for slots 2/3.
    const band = lastResolved.slot === 2 ? card.middle : lastResolved.slot === 3 ? card.bottom : undefined
    if (!band) return { nextState: MachineState.ResolvingActions }

    if (band.kind === 'border') {
        const winnerColor = state.getPlayerState(winnerId).color
        // "When a prince has three regions, he can place no more boundary walls" - they
        // still won the action, they just can't do anything with it.
        //
        // Three is the count of castles a prince has in the standard game, and a region
        // holds exactly one castle, so the real rule is "every one of your castles is
        // already enclosed". Counting castles rather than hardcoding 3 is what makes the
        // 2-player variant work: there each prince places FOUR castles of their own, and a
        // hardcoded 3 locked them out of wall placement with a castle still unenclosed -
        // permanently, since that castle could then never be sealed or scored.
        if (hasEveryCastleEnclosed(state, winnerColor)) {
            return {
                nextState: MachineState.ResolvingActions,
                bandKind: 'border',
                bandCount: band.count,
                placementSkippedReason: 'regionCap'
            }
        }

        state.wallsRemaining = band.count
        state.wallPlacingPlayerId = winnerId

        if (!anyLegalWallPlacement(state, winnerId)) {
            state.wallsRemaining = undefined
            state.wallPlacingPlayerId = undefined
            return {
                nextState: MachineState.ResolvingActions,
                bandKind: 'border',
                bandCount: band.count,
                placementSkippedReason: 'noLegalWallSpots'
            }
        }

        return { nextState: MachineState.PlacingWalls, bandKind: 'border', bandCount: band.count }
    }

    if (band.kind === 'knight') {
        const winnerState = state.getPlayerState(winnerId)
        // "If he has no more knights, he may place no more" closes off only the placing
        // half of this action - the other half ("or extend one of his regions by two
        // spaces") needs no knights from stock at all, so an empty stock only wastes the
        // whole action when there's also no region of their own to extend.
        const canExpand = state.regions.some((r) => r.ownerColor === winnerState.color)
        if (winnerState.knightsInStock <= 0 && !canExpand) {
            return {
                nextState: MachineState.ResolvingActions,
                bandKind: 'knight',
                bandCount: band.count,
                placementSkippedReason: 'noKnightsInStock'
            }
        }

        // The card's full sword count, NOT capped by knight stock - a sword the player
        // can't place a knight with is still spendable on an expansion, and PlaceKnight
        // enforces the stock limit itself.
        state.knightsRemaining = band.count
        state.knightPlacingPlayerId = winnerId
        state.expandingRegionId = undefined
        state.expansionStrandings = undefined
        state.expansionUsed = undefined
        return { nextState: MachineState.PlacingKnights, bandKind: 'knight', bandCount: band.count }
    }

    return { nextState: MachineState.ResolvingActions }
}
