import { describe, expect, it } from 'vitest'
import { HydratedProduceContainers, ProduceContainers } from './produceContainers.js'
import { ContainerColor } from '../model/container.js'
import { createActionBase, createTestGameState } from '../utils/testUtils.js'

describe('ProduceContainers', () => {
    it('produces the maximum containers and pays the union boss', () => {
        const state = createTestGameState({ useInvestmentBank: false })
        const player = state.players[0]
        const unionBossId = state.getRightNeighborId(player.playerId)
        const unionBoss = state.getPlayerState(unionBossId)

        player.machines = [ContainerColor.Blue, ContainerColor.Red]
        player.factoryStore = []
        state.supply.containers[ContainerColor.Blue] = 3
        state.supply.containers[ContainerColor.Red] = 3

        player.money = 4
        unionBoss.money = 0
        state.producedThisTurn = false

        const action = new HydratedProduceContainers({
            ...createActionBase(ProduceContainers, state),
            playerId: player.playerId,
            produceColors: [ContainerColor.Blue, ContainerColor.Red],
            factoryPrices: [2, 3]
        })

        action.apply(state)

        expect(player.money).toBe(3)
        expect(unionBoss.money).toBe(1)
        expect(player.factoryStore).toEqual([
            { color: ContainerColor.Blue, price: 2 },
            { color: ContainerColor.Red, price: 3 }
        ])
        expect(state.supply.containers[ContainerColor.Blue]).toBe(2)
        expect(state.supply.containers[ContainerColor.Red]).toBe(2)
        expect(state.producedThisTurn).toBe(true)
    })
})
