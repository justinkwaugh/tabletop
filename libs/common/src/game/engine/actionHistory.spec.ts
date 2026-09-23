import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from './gameAction.js'
import { findSupersededOutOfTurnAction } from './actionHistory.js'

function action(overrides: Partial<GameAction> & { id: string }): GameAction {
    return { gameId: 'g', type: 'note', source: ActionSource.User, playerId: 'p1', ...overrides }
}

const standing = action({ id: 'standing', outOfTurn: true })
const replacement = action({ id: 'replacement', outOfTurn: true })

describe('findSupersededOutOfTurnAction', () => {
    it('finds the same player’s latest out-of-turn Action of the same type at the tail', () => {
        const cascade = action({ id: 'auto', source: ActionSource.System, type: 'auto' })
        expect(findSupersededOutOfTurnAction([standing, cascade], replacement)).toBe(standing)
    })

    it('ignores ordinary Actions and other players’ or other types’ declarations', () => {
        expect(findSupersededOutOfTurnAction([action({ id: 'turn' })], replacement)).toBeUndefined()
        expect(
            findSupersededOutOfTurnAction(
                [action({ id: 'other', outOfTurn: true, playerId: 'p2' })],
                replacement
            )
        ).toBeUndefined()
        expect(
            findSupersededOutOfTurnAction(
                [action({ id: 'kind', outOfTurn: true, type: 'other' })],
                replacement
            )
        ).toBeUndefined()
        expect(
            findSupersededOutOfTurnAction([standing, action({ id: 'turn' })], replacement)
        ).toBeUndefined()
    })

    it('never supersedes for an ordinary submission', () => {
        expect(findSupersededOutOfTurnAction([standing], action({ id: 'turn' }))).toBeUndefined()
    })
})
