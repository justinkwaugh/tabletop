import { ReserveBidAuction } from '@tabletop/18xx'
import type { ExamplePlay } from '@tabletop/18xx/scenarios'
import { EighteenThirtyTwoAuctionRules } from '../index.js'

export function buyOpeningPrivates(
    play: ExamplePlay,
    stopBeforeLotId?: string
): Record<string, string> {
    const buyers: Record<string, string> = {}
    const auction = () => new ReserveBidAuction(play.state, EighteenThirtyTwoAuctionRules)
    while (play.state.machineState === 'WaterfallAuction' && !play.state.pendingPar) {
        const lotId = auction().auction.remainingLotIds[0]
        if (lotId === stopBeforeLotId) break
        buyers[lotId] = play.state.activePlayerIds[0]
        play.act('BuyAuctionLot', { lotId, expectedPrice: auction().price(lotId) })
    }
    return buyers
}

export function completeOpeningAuction(play: ExamplePlay, centralParSpaceId = '0:6'): void {
    buyOpeningPrivates(play)
    play.act('ParCompany', { companyId: 'CG', marketSpaceId: centralParSpaceId })
}
