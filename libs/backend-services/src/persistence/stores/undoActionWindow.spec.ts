import { ActionSource, createAction, GameAction } from '@tabletop/common'
import { describe, expect, test } from 'vitest'
import { assertUndoActionStorageSupported, scanUndoActionPrefix } from './undoActionWindow.js'

function action({
    id,
    index,
    source = ActionSource.User,
    simultaneousGroupId
}: {
    id: string
    index: number
    source?: ActionSource
    simultaneousGroupId?: string
}): GameAction {
    return createAction(GameAction, {
        id,
        gameId: 'game',
        type: 'test',
        source,
        index,
        simultaneousGroupId
    })
}

describe('scanUndoActionPrefix', () => {
    test('extends across same-group user actions while skipping system actions', () => {
        const targetAction = action({ id: 'target', index: 203, simultaneousGroupId: 'auction' })

        expect(
            scanUndoActionPrefix({
                targetAction,
                startIndex: 203,
                precedingActions: [
                    action({ id: 'system-202', index: 202, source: ActionSource.System }),
                    action({ id: 'bid-201', index: 201, simultaneousGroupId: 'auction' }),
                    action({ id: 'system-200', index: 200, source: ActionSource.System }),
                    action({ id: 'bid-199', index: 199, simultaneousGroupId: 'auction' })
                ]
            })
        ).toEqual({ startIndex: 199, boundaryFound: false })
    })

    test('stops at the first unrelated user action', () => {
        const targetAction = action({ id: 'target', index: 203, simultaneousGroupId: 'auction' })

        expect(
            scanUndoActionPrefix({
                targetAction,
                startIndex: 203,
                precedingActions: [
                    action({ id: 'bid-202', index: 202, simultaneousGroupId: 'auction' }),
                    action({ id: 'other-201', index: 201, simultaneousGroupId: 'other' }),
                    action({ id: 'bid-200', index: 200, simultaneousGroupId: 'auction' })
                ]
            })
        ).toEqual({ startIndex: 202, boundaryFound: true })
    })
})

describe('assertUndoActionStorageSupported', () => {
    test('allows chunked action storage', () => {
        expect(() => assertUndoActionStorageSupported(200)).not.toThrow()
    })

    test.each([0, undefined])('rejects legacy action storage size %s', (actionChunkSize) => {
        expect(() => assertUndoActionStorageSupported(actionChunkSize)).toThrow(
            'Undo is not supported for games using legacy action storage'
        )
    })
})
