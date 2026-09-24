import { describe, expect, it } from 'vitest'
import * as Type from 'typebox'
import { ActionSource, type GameAction } from './gameAction.js'
import {
    findStandingAction,
    standingActionAtTail,
    unnamedDuplicateReason
} from './actionHistory.js'

function action(overrides: Partial<GameAction> & { id: string }): GameAction {
    return { gameId: 'g', type: 'note', source: ActionSource.User, playerId: 'p1', ...overrides }
}

const apiActions = {
    note: Type.Object({ type: Type.Literal('note'), supersedable: Type.Literal(true) }),
    turn: Type.Object({ type: Type.Literal('turn') })
}
const standing = action({ id: 'standing' })
const turn = action({ id: 'turn', type: 'turn' })
const cascade = action({ id: 'auto', source: ActionSource.System, type: 'auto' })

describe('standing actions', () => {
    it('finds the player’s latest Action of a type anywhere, and at the tail only when last', () => {
        expect(findStandingAction([standing, turn, cascade], standing)).toBe(standing)
        expect(standingActionAtTail([standing, turn, cascade], standing)).toBeUndefined()
        expect(standingActionAtTail([turn, standing], standing)).toBe(standing)
        expect(
            findStandingAction([action({ id: 'other', playerId: 'p2' })], standing)
        ).toBeUndefined()
    })
})

describe('unnamedDuplicateReason', () => {
    it('rejects an unnamed supersedable Action while one stands at the tail', () => {
        expect(
            unnamedDuplicateReason(apiActions, [standing], action({ id: 'again' }))
        ).toBeDefined()
        expect(unnamedDuplicateReason(apiActions, [turn], action({ id: 'again' }))).toBeUndefined()
        expect(
            unnamedDuplicateReason(
                apiActions,
                [standing],
                action({ id: 'again', supersedesActionId: 'standing' })
            )
        ).toBeUndefined()
        expect(
            unnamedDuplicateReason(apiActions, [turn], action({ id: 'next', type: 'turn' }))
        ).toBeUndefined()
    })
})
