import { describe, expect, it } from 'vitest'
import * as Type from 'typebox'
import { ActionSource, type GameAction } from './gameAction.js'
import { checkDeclaredSupersede, findSupersededAction } from './actionHistory.js'

function action(overrides: Partial<GameAction> & { id: string }): GameAction {
    return { gameId: 'g', type: 'note', source: ActionSource.User, playerId: 'p1', ...overrides }
}

const apiActions = {
    note: Type.Object({ type: Type.Literal('note'), supersedable: Type.Literal(true) }),
    turn: Type.Object({ type: Type.Literal('turn') })
}
const standing = action({ id: 'standing' })
const replacement = action({ id: 'replacement', supersedesActionId: 'standing' })

describe('findSupersededAction', () => {
    it('finds the same player’s unconsumed Action of the same type at the tail', () => {
        expect(
            findSupersededAction([action({ id: 'turn', type: 'turn' }), standing], replacement)
        ).toBe(standing)
    })

    it('ignores a consumed declaration and other players’ or other types’ Actions', () => {
        const cascade = action({ id: 'auto', source: ActionSource.System, type: 'auto' })
        expect(findSupersededAction([standing, cascade], replacement)).toBeUndefined()
        expect(
            findSupersededAction([action({ id: 'other', playerId: 'p2' })], replacement)
        ).toBeUndefined()
        expect(
            findSupersededAction([action({ id: 'kind', type: 'turn' })], replacement)
        ).toBeUndefined()
    })
})

describe('checkDeclaredSupersede', () => {
    it('replaces only the declaration the Action names', () => {
        expect(checkDeclaredSupersede(apiActions, [standing], replacement)).toEqual({
            kind: 'replace',
            superseded: standing
        })
        expect(
            checkDeclaredSupersede(apiActions, [action({ id: 'turn', type: 'turn' })], replacement)
                .kind
        ).toBe('invalid')
        expect(
            checkDeclaredSupersede(apiActions, [standing], {
                ...replacement,
                supersedesActionId: 'other'
            }).kind
        ).toBe('invalid')
    })

    it('rejects an unnamed duplicate and allows an ordinary declaration', () => {
        expect(checkDeclaredSupersede(apiActions, [standing], action({ id: 'again' })).kind).toBe(
            'invalid'
        )
        expect(
            checkDeclaredSupersede(
                apiActions,
                [action({ id: 'turn', type: 'turn' })],
                action({ id: 'again' })
            )
        ).toEqual({
            kind: 'none'
        })
    })

    it('leaves non-supersedable types alone and refuses their naming a predecessor', () => {
        const turn = action({ id: 'turn', type: 'turn' })
        expect(
            checkDeclaredSupersede(apiActions, [turn], action({ id: 'next', type: 'turn' }))
        ).toEqual({
            kind: 'none'
        })
        expect(
            checkDeclaredSupersede(
                apiActions,
                [turn],
                action({ id: 'next', type: 'turn', supersedesActionId: 'turn' })
            ).kind
        ).toBe('invalid')
    })
})
