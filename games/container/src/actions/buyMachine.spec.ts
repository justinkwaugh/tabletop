import { describe, expect, it } from 'vitest'
import { BuyMachine, HydratedBuyMachine } from './buyMachine.js'
import { CONTAINER_COLORS } from '../definition/constants.js'
import { ContainerColor } from '../model/container.js'
import { createActionBase, createTestGameState } from '../utils/testUtils.js'

describe('BuyMachine', () => {
    it('adds a machine, reduces supply, and pays the cost', () => {
        const state = createTestGameState({ useInvestmentBank: false })
        const player = state.players[0]
        const color = CONTAINER_COLORS.find(
            (entry) =>
                !player.machines.includes(entry) && state.supply.machines[entry] > 0
        )
        expect(color).toBeDefined()
        if (!color) {
            return
        }

        const cost = state.getMachineCost(player.machines.length)
        const previousSupply = state.supply.machines[color]
        player.money = cost

        const action = new HydratedBuyMachine({
            ...createActionBase(BuyMachine, state),
            playerId: player.playerId,
            color: color as ContainerColor
        })

        action.apply(state)

        expect(player.machines).toContain(color)
        expect(state.supply.machines[color]).toBe(previousSupply - 1)
        expect(player.money).toBe(0)
    })
})
