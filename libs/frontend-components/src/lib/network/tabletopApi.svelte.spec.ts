import { ActionSource, Game, GameAction } from '@tabletop/common'
import * as Value from 'typebox/value'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { TabletopApi } from './tabletopApi.svelte.js'

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('TabletopApi undo compatibility', () => {
    test('derives the processed replay when an older host omits it', async () => {
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
        redoneAction.index = 0
        redoneAction.undoPatch = []

        const systemAction = Value.Create(GameAction)
        systemAction.id = 'system-action'
        systemAction.gameId = game.id
        systemAction.source = ActionSource.System
        systemAction.type = 'resolveBid'
        systemAction.index = 1
        systemAction.undoPatch = []

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
                                    actions: [redoneAction, systemAction],
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
        expect(result.canonicalReplay.actions.map((action) => action.id)).toEqual([
            redoneAction.id,
            systemAction.id
        ])
        expect(result.canonicalReplay.actions[1]?.undoPatch).toEqual([])
        expect(result.canonicalReplay.userActions.map((action) => action.id)).toEqual([
            redoneAction.id
        ])
        expect(result.actionReplay?.actions.map((action) => action.id)).toEqual([
            redoneAction.id,
            systemAction.id
        ])
    })

    test('uses the explicit processed replay returned by a visibility-aware host', async () => {
        const game = Value.Create(Game)
        game.id = 'game-id'
        game.typeId = 'freshfish'

        const legacyAction = Value.Create(GameAction)
        legacyAction.id = 'legacy-action'
        legacyAction.gameId = game.id
        legacyAction.source = ActionSource.User
        legacyAction.type = 'bid'
        legacyAction.index = 0

        const projectedAction = Value.Create(GameAction)
        projectedAction.id = 'projected-action'
        projectedAction.gameId = game.id
        projectedAction.source = ActionSource.System
        projectedAction.type = 'protectedAction'
        projectedAction.index = 0
        projectedAction.forwardPatch = []
        projectedAction.undoPatch = []

        vi.stubGlobal(
            'fetch',
            vi.fn(
                async () =>
                    new Response(
                        JSON.stringify({
                            status: 'ok',
                            payload: {
                                game,
                                actionReplay: {
                                    startIndex: 0,
                                    actions: [projectedAction]
                                },
                                canonicalReplay: {
                                    startIndex: 0,
                                    actions: [legacyAction],
                                    userActions: [legacyAction]
                                },
                                checksum: 456,
                                perspective: { kind: 'player', playerId: 'player-1' }
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

        const result = await api.undoAction(game, projectedAction.id)

        expect(result.actionReplay?.actions.map((action) => action.id)).toEqual([
            projectedAction.id
        ])
        expect(result.actionReplay?.actions[0]?.forwardPatch).toEqual([])
        expect(result.canonicalReplay.actions.map((action) => action.id)).toEqual([legacyAction.id])
        expect(result.perspective).toEqual({ kind: 'player', playerId: 'player-1' })
    })
})

describe('TabletopApi Game views', () => {
    test('rejects a projected response to a Host View request', async () => {
        const game = Value.Create(Game)
        vi.stubGlobal(
            'fetch',
            vi.fn(
                async () =>
                    new Response(
                        JSON.stringify({
                            status: 'ok',
                            payload: { game, actions: [], perspective: { kind: 'spectator' } }
                        }),
                        { status: 200, headers: { 'Content-Type': 'application/json' } }
                    )
            )
        )
        const api = new TabletopApi()
        await expect(api.getGame(game.id, { hostView: true })).rejects.toThrow('projected')
    })

    test('requests Host View explicitly', async () => {
        const game = Value.Create(Game)
        game.id = 'game-id'
        game.typeId = 'freshfish'
        const requestedUrls: string[] = []

        vi.stubGlobal(
            'fetch',
            vi.fn(async (input: string | URL | Request) => {
                requestedUrls.push(input instanceof Request ? input.url : String(input))
                return new Response(
                    JSON.stringify({
                        status: 'ok',
                        payload: { game, actions: [] }
                    }),
                    {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    }
                )
            })
        )

        const api = new TabletopApi()
        await api.getGame(game.id, { hostView: true })

        expect(requestedUrls).toEqual(['http://localhost:3000/api/v1/game/get/game-id?view=host'])
    })
})
