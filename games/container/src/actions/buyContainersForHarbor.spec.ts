import { describe, expect, it } from 'vitest'
import { BuyContainersForHarbor, HydratedBuyContainersForHarbor } from './buyContainersForHarbor.js'
import { ContainerColor } from '../model/container.js'
import { createActionBase, createTestGameState } from '../utils/testUtils.js'

describe('BuyContainersForHarbor', () => {
    it('moves containers from another factory store into the harbor store', () => {
        const state = createTestGameState({ useInvestmentBank: false })
        const buyer = state.players[0]
        const seller = state.players[1]

        buyer.warehouses = 2
        buyer.harborStore = []
        buyer.money = 10

        seller.factoryStore = [
            { color: ContainerColor.Blue, price: 2 },
            { color: ContainerColor.Red, price: 3 }
        ]
        seller.money = 0

        const action = new HydratedBuyContainersForHarbor({
            ...createActionBase(BuyContainersForHarbor, state),
            playerId: buyer.playerId,
            sellerId: seller.playerId,
            purchaseIndices: [0, 1],
            harborPrices: [4, 5]
        })

        action.apply(state)

        expect(buyer.harborStore).toEqual([
            { color: ContainerColor.Blue, price: 4 },
            { color: ContainerColor.Red, price: 5 }
        ])
        expect(seller.factoryStore).toEqual([])
        expect(buyer.money).toBe(5)
        expect(seller.money).toBe(5)
    })
})
