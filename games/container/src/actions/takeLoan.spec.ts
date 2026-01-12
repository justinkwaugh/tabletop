import { describe, expect, it } from 'vitest'
import { HydratedTakeLoan, TakeLoan } from './takeLoan.js'
import { createActionBase, createTestGameState } from '../utils/testUtils.js'

describe('TakeLoan', () => {
    it('adds a loan and credits the player', () => {
        const state = createTestGameState({ useInvestmentBank: false })
        const player = state.players[0]
        player.loans = 0
        player.money = 0

        const action = new HydratedTakeLoan({
            ...createActionBase(TakeLoan, state),
            playerId: player.playerId
        })

        action.apply(state)

        expect(player.loans).toBe(1)
        expect(player.money).toBe(10)
    })
})
