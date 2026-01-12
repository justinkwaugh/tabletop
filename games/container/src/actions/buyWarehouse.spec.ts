import { describe, expect, it } from 'vitest'
import { BuyWarehouse, HydratedBuyWarehouse } from './buyWarehouse.js'
import { createActionBase, createTestGameState } from '../utils/testUtils.js'

describe('BuyWarehouse', () => {
    it('adds a warehouse, reduces supply, and pays the cost', () => {
        const state = createTestGameState({ useInvestmentBank: false })
        const player = state.players[0]
        const cost = state.getWarehouseCost(player.warehouses)
        const previousSupply = state.supply.warehouses

        player.money = cost

        const action = new HydratedBuyWarehouse({
            ...createActionBase(BuyWarehouse, state),
            playerId: player.playerId
        })

        action.apply(state)

        expect(player.warehouses).toBe(2)
        expect(state.supply.warehouses).toBe(previousSupply - 1)
        expect(player.money).toBe(0)
    })
})
