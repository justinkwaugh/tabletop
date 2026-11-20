import { describe, expect, it } from 'vitest'
import { MachineState } from '../definition/states.js'
import { stateAfterCardStep } from '../stateHandlers/cardTurns.js'
import { tableAtPlayingCards } from '../testing/table.js'
import { queueFollowUp } from './followUps.js'
import { FeudumGameStateValidator } from './gameState.js'

describe('the seats still nourishing are kept in no order', () => {
    it('R-4.10-H4 the turn manager orders the seats asked', () => {
        const table = tableAtPlayingCards()
        const { order } = table
        table.moveTo((state) => {
            state.flow.turn = undefined
            state.flow.nourish = { pending: [...order].reverse() }
            return MachineState.Nourishing
        })
        expect(table.state.activePlayerIds).toEqual(order)
    })
})

describe('a follow-up names no seat', () => {
    it('R-3.2, R-4.9.1 the turn manager names who decides it', () => {
        const table = tableAtPlayingCards()
        const playerId = table.asked
        table.moveTo((state, context) => {
            queueFollowUp(state, { kind: 'military' })
            return stateAfterCardStep(context)
        })
        expect(table.state.machineState).toBe(MachineState.PlacingDisc)
        expect(table.state.activePlayerIds).toEqual([playerId])
        expect(table.state.flow.turn?.followUps).toEqual([{ kind: 'military' }])
    })

    it('R-3.2 the state takes no seat on a follow-up', () => {
        const table = tableAtPlayingCards()
        const { state } = table
        const turn = { secondCard: false, followUps: [{ kind: 'military', playerId: table.asked }] }
        expect(FeudumGameStateValidator.Check({ ...state, flow: { turn } })).toBe(false)
    })
})
