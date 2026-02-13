import { describe, expect, it } from 'vitest'
import { EndOfGameStateHandler } from './endOfGame.js'
import { GameResult } from '@tabletop/common'
import { ContainerColor } from '../model/container.js'
import { createMachineContext, createTestGameState } from '../utils/testUtils.js'

describe('EndOfGameStateHandler', () => {
    it('resolves pending broker auction and sets winners', () => {
        const state = createTestGameState({ useInvestmentBank: true })
        const bank = state.investmentBank
        expect(bank).toBeDefined()
        if (!bank) {
            return
        }

        const winner = state.players[0]
        const loser = state.players[1]
        winner.money = 20
        loser.money = 5

        bank.brokers[0].money = 2
        bank.paymentCard = {
            bidderId: winner.playerId,
            brokerIndex: 0,
            offerType: 'money',
            bidType: 'containers',
            bidAmount: 1,
            bidContainers: [
                { color: ContainerColor.Blue, price: 1, source: 'factory' }
            ]
        }

        const handler = new EndOfGameStateHandler()
        const context = createMachineContext(state)
        handler.enter(context)

        expect(bank.paymentCard).toBeUndefined()
        expect(winner.money).toBe(22)
        expect(state.winningPlayerIds).toEqual([winner.playerId])
        expect(state.result).toBe(GameResult.Win)
    })
})
