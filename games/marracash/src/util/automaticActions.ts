import { assertExists, type MachineContext } from '@tabletop/common'
import { PlaceBid } from '../actions/placeBid.js'
import { ResolveAuction } from '../actions/resolveAuction.js'
import { CompleteAntiqueSet } from '../actions/completeAntiqueSet.js'
import { EndTurn } from '../actions/endTurn.js'
import type { HydratedMarracashGameState } from '../model/gameState.js'

export function queueAutomaticPasses(context: MachineContext<HydratedMarracashGameState>) {
    const state = context.gameState
    const auction = state.auction
    assertExists(auction, 'Automatic passes require an auction')
    for (const participant of auction.bidding.participants) {
        if (state.isAtShopLimit(participant.playerId)) {
            context.addSystemAction(PlaceBid, { playerId: participant.playerId, amount: 0 })
        }
    }
}

export function queueAuctionResolution(context: MachineContext<HydratedMarracashGameState>) {
    context.addSystemAction(ResolveAuction, { revealsInfo: true })
}

export function queueAntiqueSetCompletions(context: MachineContext<HydratedMarracashGameState>) {
    for (const collectorId of context.gameState.pendingAntiqueSets) {
        context.addSystemAction(CompleteAntiqueSet, { collectorId, revealsInfo: true })
    }
}

// Undo stops only where hidden information is revealed. Ending a turn reveals nothing, except
// that the game's last turn shows Concealed Cash. Games from 0.1.0 stop at every end of turn.
export function queueEndTurn(context: MachineContext<HydratedMarracashGameState>) {
    const revealsConcealedCash =
        context.gameState.turnEndsGame() && context.gameConfig.concealedCash === true
    context.addSystemAction(EndTurn, {
        revealsInfo: !context.gameState.undoStopsOnlyAtReveals || revealsConcealedCash
    })
}

export function queueTurnCommit(context: MachineContext<HydratedMarracashGameState>) {
    queueAntiqueSetCompletions(context)
    queueEndTurn(context)
}
