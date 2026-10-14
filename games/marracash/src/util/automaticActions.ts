import { assertExists, type MachineContext } from '@tabletop/common'
import { PlaceBid } from '../actions/placeBid.js'
import { ResolveAuction } from '../actions/resolveAuction.js'
import { CompleteAntiqueSet } from '../actions/completeAntiqueSet.js'
import { EndTurn } from '../actions/endTurn.js'
import type { HydratedMarracashGameState } from '../model/gameState.js'

function queueAutomaticPasses(context: MachineContext<HydratedMarracashGameState>) {
    const state = context.gameState
    const auction = state.auction
    assertExists(auction, 'Automatic passes require an auction')
    for (const participant of auction.bidding.participants) {
        if (state.mustPassAuction(participant.playerId, context.gameConfig)) {
            context.addSystemAction(PlaceBid, { playerId: participant.playerId, amount: 0 })
        }
    }
}

// Games started under logic 1.0.0 queued their passes before any antique payout; they keep that
// order so their recorded Actions replay the same way.
export function queueAutomaticPassesAfterAntiquePayouts(
    context: MachineContext<HydratedMarracashGameState>
) {
    const state = context.gameState
    if (state.passesBiddersWhoCannotWin && state.pendingAntiqueSets.length > 0) {
        return
    }
    queueAutomaticPasses(context)
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
// that the game's last turn shows Concealed Cash and every unfinished antique hand.
export function queueEndTurn(context: MachineContext<HydratedMarracashGameState>) {
    const { gameState } = context
    const revealsConcealedCash = context.gameConfig.concealedCash === true
    const revealsHands =
        gameState.antiqueCards && gameState.players.some((player) => player.antiques.length > 0)
    context.addSystemAction(EndTurn, {
        revealsInfo: gameState.turnEndsGame() && (revealsConcealedCash || revealsHands)
    })
}

export function queueTurnCommit(context: MachineContext<HydratedMarracashGameState>) {
    queueAntiqueSetCompletions(context)
    queueEndTurn(context)
}
