import { describe, expect, it } from 'vitest'
import { HydratedResolveAuction, ResolveAuction } from './resolveAuction.js'
import { ContainerColor } from '../model/container.js'
import { HydratedForeignIslandAuction } from '../components/foreignIslandAuction.js'
import { createActionBase, createTestGameState } from '../utils/testUtils.js'

describe('ResolveAuction', () => {
    it('accepts a winning bid and awards subsidy', () => {
        const state = createTestGameState({ useInvestmentBank: false })
        const seller = state.players[0]
        const winner = state.players[1]
        const other = state.players[2]

        seller.ship.cargo = [ContainerColor.Blue, ContainerColor.Red]
        seller.money = 0
        winner.money = 10
        other.money = 0

        const round = HydratedForeignIslandAuction.createRound(
            [winner.playerId, other.playerId],
            seller.playerId,
            'round-1'
        )

        state.auction = new HydratedForeignIslandAuction({
            sellerId: seller.playerId,
            containers: [...seller.ship.cargo],
            phase: 'initial',
            round: round.dehydrate(),
            totalBids: {},
            winningBid: 5,
            winningBidderId: winner.playerId,
            tiedPlayerIds: undefined
        })

        const action = new HydratedResolveAuction({
            ...createActionBase(ResolveAuction, state),
            playerId: seller.playerId,
            accept: true
        })

        action.apply(state)

        expect(winner.money).toBe(5)
        expect(seller.money).toBe(10)
        expect(winner.island).toEqual([ContainerColor.Blue, ContainerColor.Red])
        expect(seller.ship.cargo).toEqual([])
        expect(state.auction).toBeUndefined()
        expect(state.actionsRemaining).toBe(0)
        expect(state.turnNeedsStart).toBe(true)
    })
})
