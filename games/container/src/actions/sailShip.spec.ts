import { describe, expect, it } from 'vitest'
import { HydratedSailShip, SailShip } from './sailShip.js'
import { ContainerColor } from '../model/container.js'
import { createActionBase, createTestGameState } from '../utils/testUtils.js'

describe('SailShip', () => {
    it('purchases containers from a harbor after sailing in', () => {
        const state = createTestGameState({ useInvestmentBank: false })
        const buyer = state.players[0]
        const seller = state.players[1]

        buyer.ship.location = { type: 'open_sea' }
        buyer.ship.cargo = []
        buyer.money = 5

        seller.harborStore = [
            { color: ContainerColor.Blue, price: 2 },
            { color: ContainerColor.Red, price: 3 }
        ]
        seller.money = 0

        const action = new HydratedSailShip({
            ...createActionBase(SailShip, state),
            playerId: buyer.playerId,
            destination: { type: 'harbor', ownerId: seller.playerId },
            purchaseIndices: [1]
        })

        action.apply(state)

        expect(buyer.ship.location).toEqual({ type: 'harbor', ownerId: seller.playerId })
        expect(buyer.ship.cargo).toEqual([ContainerColor.Red])
        expect(buyer.money).toBe(2)
        expect(seller.money).toBe(3)
        expect(seller.harborStore).toEqual([{ color: ContainerColor.Blue, price: 2 }])
    })
})
