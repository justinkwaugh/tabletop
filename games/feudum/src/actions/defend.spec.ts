import { describe, expect, it } from 'vitest'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import {
    answer,
    Battlefield,
    commit,
    conquer,
    PawnOf,
    tableAtCombat,
    type CombatTable
} from '../testing/combat.js'
import { answerAttackOffer, reasonAnswerAttackRefused } from './answerAttack.js'

const WITH_DEFEND = ['defend', 'tax'] as const
const WITHOUT_DEFEND = ['tax', 'guild'] as const

function attacked(hand: readonly ('defend' | 'tax' | 'guild')[]): CombatTable {
    const combat = tableAtCombat([...hand])
    conquer(combat, PawnOf(combat.defenderId))
    return combat
}

describe('R-3.14.1, R-3.14-H1 AnswerAttack', () => {
    it('R-3.14.1 a flip plays Defend out of turn: +1 defence, +1 vp, a barrier (S33)', () => {
        const combat = attacked(WITH_DEFEND)
        const { table, attackerId, defenderId } = combat

        const [action] = answer(combat, true)

        const seat = table.seat(defenderId)
        expect(seat.hand).toEqual(['tax'])
        expect(seat.handCount).toBe(1)
        expect(seat.played).toEqual([{ kind: 'defend', use: 'defend-flip' }])
        expect(seat.score).toBe(1)
        expect(table.state.flow.combat?.defendFlipped).toBe(true)
        expect(action.revealsInfo).toBe(true)
        expect(action).toMatchObject({ metadata: { vp: 1 } })
        expect(table.state.machineState).toBe(MachineState.CommittingAttack)
        expect(table.state.activePlayerIds).toEqual([attackerId])
    })

    it('R-3.14.1 the flip counts in the combat: +1 defence for this combat', () => {
        const combat = attacked(WITH_DEFEND)
        answer(combat, true)
        const [action] = commit(combat)
        expect(action).toMatchObject({
            metadata: {
                defendFlipped: true,
                defence: { pawns: 2, defend: 1, total: 3 }
            }
        })
    })

    it('R-3.14-H1 "no" is legal while holding Defend, keeps the card and scores nothing', () => {
        const combat = attacked(WITH_DEFEND)
        const { table, defenderId } = combat

        const [action] = answer(combat, false)

        const seat = table.seat(defenderId)
        expect(seat.hand).toEqual([...WITH_DEFEND])
        expect(seat.played).toEqual([])
        expect(seat.score).toBe(0)
        expect(table.state.flow.combat?.defendFlipped).toBe(false)
        expect(action.revealsInfo).toBe(true)
        expect(action).toMatchObject({ metadata: { vp: 0 } })
        expect(table.state.machineState).toBe(MachineState.CommittingAttack)
    })

    it('R-3.14.1 a flip needs Defend in hand; "no" is always legal (S34)', () => {
        const combat = attacked(WITHOUT_DEFEND)
        const { table, defenderId } = combat
        expect(reasonAnswerAttackRefused(table.hydrated(), defenderId, true)).toBe(
            "Defend isn't in your hand."
        )
        expect(() => answer(combat, true)).toThrow("Defend isn't in your hand.")
        expect(reasonAnswerAttackRefused(table.hydrated(), defenderId, false)).toBeUndefined()

        answer(combat, false)
        expect(table.state.machineState).toBe(MachineState.CommittingAttack)
    })

    it('R-3.14-H1 only the seat attacked answers', () => {
        const { table, attackerId, thirdId } = attacked(WITH_DEFEND)
        for (const playerId of [attackerId, thirdId]) {
            expect(reasonAnswerAttackRefused(table.hydrated(), playerId, false)).toBe(
                'No attack on you is waiting.'
            )
        }
    })

    it('R-3.14-H1, R-5 what the table sees does not depend on holding Defend (S34)', () => {
        const holding = attacked(WITH_DEFEND)
        const without = attacked(WITHOUT_DEFEND)
        for (const combat of [holding, without]) {
            const { table, attackerId, defenderId, thirdId } = combat
            expect(table.state.machineState).toBe(MachineState.AwaitingDefence)
            expect(table.state.activePlayerIds).toEqual([defenderId])
            expect(table.offered(defenderId)).toEqual([ActionType.AnswerAttack])
            expect(table.offered(attackerId)).toEqual([])
            expect(table.offered(thirdId)).toEqual([])
            expect(table.state.flow.combat?.spaceId).toBe(Battlefield)
            expect(table.seat(defenderId).handCount).toBe(2)
        }
        const [held] = answer(holding, false)
        const [none] = answer(without, false)
        expect(held).toHaveProperty('metadata', { vp: 0 })
        expect(none).toHaveProperty('metadata', { vp: 0 })
        expect(held.revealsInfo).toBe(none.revealsInfo)
    })

    it('R-3.14.1 the offer reads the seat’s own hand; another seat gets none (S33, S34)', () => {
        const holding = attacked(WITH_DEFEND)
        expect(answerAttackOffer(holding.table.hydrated(), holding.defenderId)).toEqual({
            holdsDefend: true,
            attack: 1,
            defence: 2,
            defenceIfFlipped: 3,
            flipVp: 1,
            revealsInfo: true
        })
        expect(answerAttackOffer(holding.table.hydrated(), holding.attackerId)).toBeUndefined()

        const without = attacked(WITHOUT_DEFEND)
        expect(answerAttackOffer(without.table.hydrated(), without.defenderId)).toMatchObject({
            holdsDefend: false
        })
    })

    it('R-3.14.1 Defend helps against one combat only', () => {
        const first = attacked(WITH_DEFEND)
        answer(first, true)
        commit(first)
        expect(first.table.state.flow.combat).toBeUndefined()
        expect(first.table.seat(first.defenderId).played.at(-1)).toEqual({
            kind: 'defend',
            use: 'defend-flip'
        })
    })
})
