import { describe, expect, it } from 'vitest'
import { CallBroker, HydratedCallBroker } from './callBroker.js'
import { ContainerColor } from '../model/container.js'
import { createActionBase, createTestGameState } from '../utils/testUtils.js'

describe('CallBroker', () => {
    it('creates a container bid when auctioning broker money', () => {
        const state = createTestGameState({ useInvestmentBank: true })
        const player = state.players[0]
        const bank = state.investmentBank
        expect(bank).toBeDefined()
        if (!bank) {
            return
        }

        bank.brokers[0].money = 2
        player.factoryStore = [
            { color: ContainerColor.Blue, price: 1 },
            { color: ContainerColor.Red, price: 2 }
        ]
        player.harborStore = []

        const action = new HydratedCallBroker({
            ...createActionBase(CallBroker, state),
            playerId: player.playerId,
            brokerIndex: 0,
            offerType: 'money',
            factoryIndices: [0, 1],
            harborIndices: []
        })

        action.apply(state)

        expect(state.calledBrokerThisTurn).toBe(true)
        expect(bank.paymentCard).toEqual(
            expect.objectContaining({
                bidderId: player.playerId,
                brokerIndex: 0,
                offerType: 'money',
                bidType: 'containers',
                bidAmount: 2
            })
        )
        expect(bank.paymentCard?.bidContainers).toEqual([
            { color: ContainerColor.Blue, price: 1, source: 'factory' },
            { color: ContainerColor.Red, price: 2, source: 'factory' }
        ])
        expect(player.factoryStore).toEqual([])
    })
})
