import { ActionSource, Game, GameAction } from '@tabletop/common'
import * as Value from 'typebox/value'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { VersionChange } from './versionChecker.js'
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

describe('publication version detection', () => {
    test.each([
        ['2.0.0', VersionChange.MajorUpgrade],
        ['0.9.0', VersionChange.Rollback],
        ['1.1.0', VersionChange.MinorUpgrade],
        ['1.0.1', VersionChange.PatchUpgrade],
        ['1.0.0', undefined],
        [undefined, undefined]
    ])('detects frontend %s on ordinary game loading', async (version, expected) => {
        const game = Value.Create(Game)
        vi.stubGlobal(
            'fetch',
            vi.fn(
                async () =>
                    new Response(JSON.stringify({ status: 'ok', payload: { game, actions: [] } }), {
                        headers: version ? { 'X-Tabletop-Version': version } : {}
                    })
            )
        )
        const api = new TabletopApi('http://localhost:3000', 'http://localhost:3000', '1.0.0')
        await api.getGame(game.id)
        expect(api.versionChange).toBe(expected)
    })

    test('preserves a required UI reload when the frontend header only reports a patch', async () => {
        const game = Value.Create(Game)
        game.typeId = 'freshfish'
        const action = Value.Create(GameAction)
        vi.stubGlobal(
            'fetch',
            vi.fn(
                async () =>
                    new Response(JSON.stringify({ status: 'ok', payload: { game, actions: [] } }), {
                        headers: {
                            'X-Tabletop-Version': '1.0.1',
                            'X-TABLETOP-GAME-UI-VERSION': '6.0.0'
                        }
                    })
            )
        )
        const api = new TabletopApi('http://localhost:3000', 'http://localhost:3000', '1.0.0')
        api.setGameVersionProvider({ getLogicVersion: () => '3.0.0', getUiVersion: () => '5.0.1' })
        await api.applyAction(game, action)
        expect(api.versionChange).toBe(VersionChange.MajorUpgrade)
        await api.getGame(game.id)
        expect(api.versionChange).toBe(VersionChange.MajorUpgrade)
    })

    test('records a rejected logic major mismatch without relying on response headers', async () => {
        const game = Value.Create(Game)
        game.typeId = 'freshfish'
        const action = Value.Create(GameAction)
        vi.stubGlobal(
            'fetch',
            vi.fn(
                async () =>
                    new Response(
                        JSON.stringify({
                            error: {
                                name: 'GameVersionMismatch',
                                message: 'Reload required',
                                metadata: { requestedVersion: '2.0.0', serverVersion: '3.0.0' }
                            }
                        }),
                        { status: 400, headers: { 'Content-Type': 'application/json' } }
                    )
            )
        )
        const api = new TabletopApi()
        api.setGameVersionProvider({ getLogicVersion: () => '2.0.0', getUiVersion: () => '5.0.1' })
        await expect(api.applyAction(game, action)).rejects.toThrow('Reload required')
        expect(api.versionChange).toBe(VersionChange.MajorUpgrade)
    })
})

describe('reproduction seed transport', () => {
    test('sends private creation options outside public game metadata', async () => {
        const game = Value.Create(Game)
        game.id = 'seeded'
        game.typeId = 'freshfish'
        const fetch = vi.fn(
            async () =>
                new Response(JSON.stringify({ status: 'ok', payload: { game } }), {
                    headers: { 'Content-Type': 'application/json' }
                })
        )
        vi.stubGlobal('fetch', fetch)
        const api = new TabletopApi()
        const masterSeed = '0123456789abcdef0123456789abcdef'
        await api.createGame(game, { masterSeed })
        expect(fetch).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                body: JSON.stringify({ game, options: { masterSeed } })
            })
        )
        expect(game).not.toHaveProperty('masterSeed')
    })
})
