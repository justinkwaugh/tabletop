import { MachineState } from '../definition/states.js'
import { CompanyId } from '../components/companies.js'
import { ACTIONS_PER_ROUND } from '../model/actionSpaces.js'
import { AuctionKind } from '../model/auction.js'
import type { HydratedHcgGameState } from '../model/gameState.js'
import { openInitialAuction, type ShareSale } from '../model/shareAuctionRules.js'

// After each turn's action the tracker pawn moves on; the game end or the eleventh action pays
// dividends, otherwise the next player takes a turn.
export function finishTurnAction(state: HydratedHcgGameState): MachineState {
    state.roundTrack.push(state.turnPlayerId())
    if (state.isGameEndTriggered() || state.roundTrack.length >= ACTIONS_PER_ROUND) {
        return MachineState.PayingDividends
    }
    return endTurn(state)
}

export function endTurn(state: HydratedHcgGameState): MachineState {
    state.turnManager.endTurn(state.actionCount)
    return MachineState.ChoosingAction
}

export function afterSale(state: HydratedHcgGameState, sale: ShareSale): MachineState {
    if (
        sale.companyId === CompanyId.Streamside &&
        state.nextCubeHexes(CompanyId.Streamside).length > 0
    ) {
        state.bonusCube = {
            playerId: sale.buyerId,
            initialAuction: sale.kind === AuctionKind.Initial
        }
        return MachineState.PlacingBonusCube
    }
    return continueAfterSale(state, sale.kind === AuctionKind.Initial, sale.buyerId)
}

// The winner of each initial auction starts the next one.
export function continueAfterSale(
    state: HydratedHcgGameState,
    initialAuction: boolean,
    buyerId: string
): MachineState {
    if (!initialAuction) {
        return finishTurnAction(state)
    }
    const next = state.nextInitialAuction()
    if (next === undefined) {
        return MachineState.ChoosingAction
    }
    openInitialAuction(state, next, buyerId)
    return MachineState.Bidding
}
