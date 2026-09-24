import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Value from 'typebox/value'
import { Game, GameState } from '@tabletop/common'
import type { GameLoadResult, GetGameOptions } from '@tabletop/frontend-components'
import { load } from './+page.js'

const fixture = vi.hoisted(() => {
    const constructed = vi.fn()
    class ModernSession {
        static readonly supportsDeferredHistory = true
        constructor(input: unknown) {
            constructed(input)
        }
    }
    class LegacySession {
        constructor(input: unknown) {
            constructed(input)
        }
    }
    const selection = { modern: true }
    const loadGame = vi.fn<(id: string, options?: GetGameOptions) => Promise<GameLoadResult>>()
    return {
        constructed,
        selection,
        loadGame,
        context: {
            authorizationService: { authorizeRoute: vi.fn(async () => {}) },
            gameService: { loadGame, loadGames: vi.fn(async () => {}) },
            libraryService: {
                whenReady: vi.fn(async () => {}),
                getTitle: vi.fn(() => ({
                    runtime: async () => ({
                        sessionClass: selection.modern ? ModernSession : LegacySession
                    })
                }))
            },
            chatService: {},
            notificationService: {},
            api: {}
        }
    }
})

vi.mock('$lib/stores/appContext.svelte.js', () => ({ getAppContext: () => fixture.context }))
vi.mock('@tabletop/frontend-components', () => ({
    AuthorizationCategory: { ActiveUser: 'active-user' },
    BridgedContext: class {}
}))

function openPage() {
    return load({
        params: { id: 'game-1' },
        url: new URL('https://example.test/game/game-1'),
        route: { id: '/(app)/(authed)/game/[id]' },
        data: null,
        get tracing(): never {
            throw Error('Page loader must not access server tracing')
        },
        fetch,
        setHeaders: () => {},
        depends: () => {},
        untrack: (fn) => fn(),
        parent: async () => ({})
    })
}

function game() {
    return { ...Value.Create(Game), id: 'game-1', state: Value.Create(GameState) }
}

beforeEach(() => {
    vi.clearAllMocks()
    fixture.loadGame.mockReset()
    fixture.selection.modern = true
})

describe('State-first page loading', () => {
    it('returns a modern session from State without awaiting full history', async () => {
        fixture.loadGame.mockResolvedValueOnce({
            game: game(),
            actions: [],
            historyComplete: false
        })
        await openPage()
        expect(fixture.loadGame).toHaveBeenCalledExactlyOnceWith('game-1', {
            includeActions: false
        })
        expect(fixture.constructed).toHaveBeenCalledWith(
            expect.objectContaining({ historyComplete: false, actions: [] })
        )
    })

    it('waits for complete history before constructing a legacy UI Artifact', async () => {
        fixture.selection.modern = false
        const complete = Promise.withResolvers<GameLoadResult>()
        fixture.loadGame
            .mockResolvedValueOnce({ game: game(), actions: [], historyComplete: false })
            .mockReturnValueOnce(complete.promise)
        const opening = openPage()
        await vi.waitFor(() => expect(fixture.loadGame).toHaveBeenCalledTimes(2))
        expect(fixture.constructed).not.toHaveBeenCalled()
        complete.resolve({ game: game(), actions: [] })
        await opening
        expect(fixture.loadGame).toHaveBeenNthCalledWith(2, 'game-1')
        expect(fixture.constructed).toHaveBeenCalledWith(
            expect.objectContaining({ historyComplete: undefined })
        )
    })

    it('accepts complete data from local storage or an older host without a second request', async () => {
        fixture.loadGame.mockResolvedValueOnce({ game: game(), actions: [] })
        await openPage()
        expect(fixture.loadGame).toHaveBeenCalledTimes(1)
        expect(fixture.constructed).toHaveBeenCalledWith(
            expect.objectContaining({ historyComplete: undefined })
        )
    })
})
