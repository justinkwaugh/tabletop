import { describe, expect, it } from 'vitest'
import { HydratedRepayLoan, RepayLoan } from './repayLoan.js'
import { createActionBase, createTestGameState } from '../utils/testUtils.js'

describe('RepayLoan', () => {
    it('repays a loan after interest is paid', () => {
        const state = createTestGameState({ useInvestmentBank: false })
        const player = state.players[0]
        player.loans = 1
        player.money = 10
        state.interestPaidThisTurn = true

        const action = new HydratedRepayLoan({
            ...createActionBase(RepayLoan, state),
            playerId: player.playerId
        })

        action.apply(state)

        expect(player.loans).toBe(0)
        expect(player.money).toBe(0)
    })
})
