import { describe, expect, it } from 'vitest'
import { AuctionBiddingStateHandler } from './auctionBidding.js'
import { MachineState } from '../definition/states.js'
import { HydratedForeignIslandAuction } from '../components/foreignIslandAuction.js'
import { HydratedSubmitBid, SubmitBid } from '../actions/submitBid.js'
import { createActionBase, createMachineContext, createTestGameState } from '../utils/testUtils.js'

describe('AuctionBiddingStateHandler', () => {
    it('advances to resolve after all bids are submitted', () => {
        const state = createTestGameState({ useInvestmentBank: false })
        const seller = state.players[0]
        const participants = state.players.slice(1)

        participants.forEach((player) => {
            player.money = 5
        })

        const round = HydratedForeignIslandAuction.createRound(
            participants.map((player) => player.playerId),
            seller.playerId,
            'round-1'
        )

        state.auction = new HydratedForeignIslandAuction({
            sellerId: seller.playerId,
            containers: [],
            phase: 'initial',
            round: round.dehydrate(),
            totalBids: {},
            winningBid: undefined,
            winningBidderId: undefined,
            tiedPlayerIds: undefined
        })

        const handler = new AuctionBiddingStateHandler()
        const context = createMachineContext(state)
        handler.enter(context)

        const firstBid = new HydratedSubmitBid({
            ...createActionBase(SubmitBid, state),
            playerId: participants[0].playerId,
            bidAmount: 2
        })
        firstBid.apply(state)
        const afterFirst = handler.onAction(firstBid, context)
        expect(afterFirst).toBe(MachineState.AuctionBidding)

        const secondBid = new HydratedSubmitBid({
            ...createActionBase(SubmitBid, state),
            playerId: participants[1].playerId,
            bidAmount: 3
        })
        secondBid.apply(state)
        const afterSecond = handler.onAction(secondBid, context)

        expect(afterSecond).toBe(MachineState.AuctionResolve)
        expect(state.activePlayerIds).toEqual([seller.playerId])
    })
})
