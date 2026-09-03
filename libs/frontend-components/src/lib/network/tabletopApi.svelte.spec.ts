import { ActionSource, Game, GameAction } from '@tabletop/common'
import * as Value from 'typebox/value'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { TabletopApi } from './tabletopApi.svelte.js'

describe('TabletopApi undo compatibility', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    test('preserves legacy undo actions for game UI bundles from the previous deployment', async () => {
        const game = Value.Create(Game)
        game.id = 'game-id'
        game.typeId = 'freshfish'

        const undoneAction = Value.Create(GameAction)
        undoneAction.id = 'undone-action'
        undoneAction.gameId = game.id
        undoneAction.source = ActionSource.User
        undoneAction.type = 'bid'

        const redoneAction = Value.Create(GameAction)
        redoneAction.id = 'redone-action'
        redoneAction.gameId = game.id
        redoneAction.source = ActionSource.User
        redoneAction.type = 'bid'

        vi.stubGlobal(
            'fetch',
            vi.fn(
                async () =>
                    new Response(
                        JSON.stringify({
                            status: 'ok',
                            payload: {
                                undoneActions: [undoneAction],
                                game,
                                redoneActions: [redoneAction],
                                canonicalReplay: {
                                    startIndex: 0,
                                    userActions: [redoneAction]
                                },
                                checksum: 123
                            }
                        }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' }
                        }
                    )
            )
        )

        const api = new TabletopApi()
        api.setGameVersionProvider({
            getLogicVersion: () => '3.0.0',
            getUiVersion: () => '5.0.1'
        })

        const result = await api.undoAction(game, undoneAction.id)

        expect(result.undoneActions?.map((action) => action.id)).toEqual([undoneAction.id])
        expect(result.redoneActions?.map((action) => action.id)).toEqual([redoneAction.id])
        expect(result.canonicalReplay.userActions.map((action) => action.id)).toEqual([
            redoneAction.id
        ])
    })
})
