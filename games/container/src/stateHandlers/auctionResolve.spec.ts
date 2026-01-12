import { describe, expect, it } from 'vitest'
import { AuctionResolveStateHandler } from './auctionResolve.js'
import { MachineState } from '../definition/states.js'
import { ContainerColor } from '../model/container.js'
import { HydratedForeignIslandAuction } from '../components/foreignIslandAuction.js'
import { HydratedResolveAuction, ResolveAuction } from '../actions/resolveAuction.js'
import { createActionBase, createMachineContext, createTestGameState } from '../utils/testUtils.js'

describe('AuctionResolveStateHandler', () => {
    it('returns to play when the game has not ended', () => {
        const state = createTestGameState({ useInvestmentBank: false })
        const seller = state.players[0]
        const winner = state.players[1]
        winner.money = 5
        seller.ship.cargo = [ContainerColor.Blue]

        const round = HydratedForeignIslandAuction.createRound(
            [winner.playerId],
            seller.playerId,
            'round-1'
        )

        state.auction = new HydratedForeignIslandAuction({
            sellerId: seller.playerId,
            containers: [...seller.ship.cargo],
            phase: 'initial',
            round: round.dehydrate(),
            totalBids: {},
            winningBid: 3,
            winningBidderId: winner.playerId,
            tiedPlayerIds: undefined
        })

        const action = new HydratedResolveAuction({
            ...createActionBase(ResolveAuction, state),
            playerId: seller.playerId,
            accept: true
        })

        action.apply(state)

        const handler = new AuctionResolveStateHandler()
        const context = createMachineContext(state)
        const next = handler.onAction(action, context)

        expect(next).toBe(MachineState.TakingActions)
    })

    it('moves to end-of-game when endTriggered is set', () => {
        const state = createTestGameState({ useInvestmentBank: false })
        const seller = state.players[0]
        const winner = state.players[1]
        winner.money = 5
        seller.ship.cargo = [ContainerColor.Blue]

        const round = HydratedForeignIslandAuction.createRound(
            [winner.playerId],
            seller.playerId,
            'round-2'
        )

        state.auction = new HydratedForeignIslandAuction({
            sellerId: seller.playerId,
            containers: [...seller.ship.cargo],
            phase: 'initial',
            round: round.dehydrate(),
            totalBids: {},
            winningBid: 3,
            winningBidderId: winner.playerId,
            tiedPlayerIds: undefined
        })
        state.endTriggered = true

        const action = new HydratedResolveAuction({
            ...createActionBase(ResolveAuction, state),
            playerId: seller.playerId,
            accept: true
        })

        action.apply(state)

        const handler = new AuctionResolveStateHandler()
        const context = createMachineContext(state)
        const next = handler.onAction(action, context)

        expect(next).toBe(MachineState.EndOfGame)
    })
})
