import { assertExists, type MachineContext } from '@tabletop/common'
import { PlaceBid } from '../actions/placeBid.js'
import { ResolveAuction } from '../actions/resolveAuction.js'
import { CompleteAntiqueSet } from '../actions/completeAntiqueSet.js'
import { EndTurn } from '../actions/endTurn.js'
import { MaxShopsPerPlayer } from '../components/payments.js'
import type { HydratedMarracashGameState } from '../model/gameState.js'

export function queueAutomaticPasses(context: MachineContext<HydratedMarracashGameState>) {
    const state = context.gameState
    const auction = state.auction
    assertExists(auction, 'Automatic passes require an auction')
    for (const participant of auction.participants) {
        if (state.ownedShopCount(participant.playerId) >= MaxShopsPerPlayer) {
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

export function queueEndTurn(context: MachineContext<HydratedMarracashGameState>) {
    context.addSystemAction(EndTurn, {})
}
