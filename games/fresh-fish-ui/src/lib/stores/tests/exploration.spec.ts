import { GameSessionMode, GameSession, IndexedDbGameStore } from '@tabletop/frontend-components'
import { getPrng, assertExists, createAction, ActionSource, GameStorage } from '@tabletop/common'
import { FreshFishRuntime, DrawTile } from '@tabletop/fresh-fish'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { FreshFishUiRuntime } from '../../definition/gameUiRuntime.js'
import {
    createBid,
    PLAYER_A_ID,
    PLAYER_B_ID,
    PLAYER_B_PERSPECTIVE,
    createAuctionHost
} from './simultaneousAuction.js'
import {
    createExplorationHost,
    diskAction,
    drawStall,
    explorationClient,
    project,
    settleExploration
} from './exploration.fixture.js'

beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
})
afterEach(() => vi.restoreAllMocks())

describe('hypothetical exploration', () => {
    test('rejects invalid local saves before persistence', async () => {
        const host = createExplorationHost()
        const client = explorationClient(host)
        const title = client.app.libraryService.getTitle(host.game.typeId)
        assertExists(title, 'Expected local game title')
        vi.spyOn(title, 'runtime').mockResolvedValue({
            ...FreshFishUiRuntime,
            sessionClass: GameSession,
            gameUI: {
                load: async () => {
                    throw Error('Persistence does not load UI')
                },
                mount: () => {
                    throw Error('Persistence does not mount UI')
                }
            }
        })
        const write = vi
            .spyOn(IndexedDbGameStore.prototype, 'storeGameData')
            .mockResolvedValue(undefined)
        const state = structuredClone(host.state)
        Reflect.deleteProperty(state, 'board')
        try {
            await expect(
                client.app.gameService.saveGameLocally({
                    game: { ...host.game, storage: GameStorage.Local },
                    state,
                    actions: host.actions
                })
            ).rejects.toThrow('Complete canonical state is required')
            expect(write).not.toHaveBeenCalled()
        } finally {
            client.dispose()
        }
    })

    test('rejects incomplete population before installing an exploration context', async () => {
        const host = createExplorationHost()
        const client = explorationClient(host, PLAYER_B_PERSPECTIVE, {
            ...FreshFishUiRuntime,
            exploration: {
                createFromCanonicalState: FreshFishRuntime.exploration.createFromCanonicalState,
                createFromProjectedState(input) {
                    const state = FreshFishRuntime.exploration.createFromProjectedState(input)
                    Reflect.deleteProperty(state, 'board')
                    return state
                }
            }
        })
        try {
            await expect(client.session.startExploring()).rejects.toThrow(
                'Complete canonical state is required'
            )
            expect(client.session.explorations.getCurrentExploration()).toBeUndefined()
        } finally {
            client.dispose()
        }
    })

    test('populates the same bag from the same knowledge, without reading hidden order or seeds', () => {
        const host = createExplorationHost()
        drawStall(host)
        const populate = () => {
            const history = project(host, PLAYER_B_PERSPECTIVE)
            return FreshFishRuntime.exploration.createFromProjectedState({
                game: host.game,
                state: history.currentState,
                actions: history.actions,
                perspective: PLAYER_B_PERSPECTIVE,
                random: getPrng(123)
            })
        }
        const first = populate()
        host.state.tileBag.items.reverse()
        host.state.protectedPrng = { seed: 812, invocations: 91 }
        const second = populate()
        expect(first).toEqual(second)
        expect(first.tileBag.items).toHaveLength(host.state.tileBag.remaining)
        expect(first.tileBag.items.map((tile) => JSON.stringify(tile)).sort()).toEqual(
            host.state.tileBag.items.map((tile) => JSON.stringify(tile)).sort()
        )
        expect(first.chosenTile).toEqual(host.state.chosenTile)
    })

    test('preserves known bids and supplies legal hypothetical submitted bids', () => {
        const host = createAuctionHost()
        host.apply(createBid('a', PLAYER_A_ID, 8))
        host.apply(createBid('b', PLAYER_B_ID, 3))
        const history = project(host, PLAYER_B_PERSPECTIVE)
        const state = FreshFishRuntime.exploration.createFromProjectedState({
            game: host.game,
            state: history.currentState,
            actions: history.actions,
            perspective: PLAYER_B_PERSPECTIVE,
            random: getPrng(44)
        })
        const participants = state.currentAuction?.participants
        expect(participants?.find((p) => p.playerId === PLAYER_B_ID)?.bid).toBe(3)
        const unknownBid = participants?.find((p) => p.playerId === PLAYER_A_ID)?.bid
        expect(unknownBid).toBeGreaterThanOrEqual(0)
        expect(unknownBid).toBeLessThanOrEqual(15)
        expect(participants?.filter((p) => !p.submitted).every((p) => p.bid === undefined)).toBe(
            true
        )
    })

    test('reconstructs an exhausted bag without consuming final stalls', () => {
        const host = createExplorationHost()
        const tiles = structuredClone(host.state.tileBag.items)
        const actions = tiles.map((chosenTile, index) =>
            createAction(DrawTile, {
                id: `draw-${index}`,
                gameId: host.game.id,
                source: ActionSource.User,
                revealsInfo: true,
                metadata: { chosenTile }
            })
        )
        const state = project(host, PLAYER_B_PERSPECTIVE).currentState
        state.tileBag.remaining = 0
        const result = FreshFishRuntime.exploration.createFromProjectedState({
            game: host.game,
            state,
            actions,
            perspective: PLAYER_B_PERSPECTIVE,
            random: getPrng(3)
        })
        expect(result.tileBag).toEqual({ items: [], remaining: 0 })
        expect(result.finalStalls).toEqual(state.finalStalls)
        expect(() =>
            FreshFishRuntime.exploration.createFromProjectedState({
                game: host.game,
                state,
                actions: actions.slice(1),
                perspective: PLAYER_B_PERSPECTIVE,
                random: getPrng(3)
            })
        ).toThrow('tile count')
    })

    test.each([1, 2])(
        'keeps version %i full-information games playable with a legacy initializer',
        async (version) => {
            const host = createExplorationHost()
            host.state.systemVersion = version
            delete host.state.protectedPrng
            host.apply(diskAction(host))
            const initializer = FreshFishRuntime.initializer
            const client = explorationClient(host, PLAYER_B_PERSPECTIVE, {
                ...FreshFishUiRuntime,
                visibility: undefined,
                initializer: {
                    initializeGame: initializer.initializeGame.bind(initializer),
                    initializeGameState: initializer.initializeGameState.bind(initializer)
                }
            })
            try {
                await client.session.startExploring()
                const context = client.session.explorations.getCurrentExploration()
                assertExists(context, 'Expected legacy exploration')
                expect(context.state.systemVersion).toBe(version)
                expect(context.state.protectedPrng).toBeUndefined()
                context.verifyFullChecksum()
                context.applyAction(diskAction({ game: context.game, state: context.state }))
                expect(context.state.actionCount).toBe(2)
            } finally {
                client.dispose()
            }
        }
    )

    test('loads saved Explorations without the new checkpoint fields', async () => {
        const host = createExplorationHost()
        const game = structuredClone(host.game)
        game.storage = GameStorage.Local
        game.hotseat = true
        game.parentId = host.game.id
        const state = structuredClone(host.state)
        state.explorationState = {
            actionCount: state.actionCount,
            invocations: state.prng.invocations
        }
        game.state = state
        const client = explorationClient(host)
        vi.spyOn(client.app.gameService, 'getExplorations').mockReturnValue([game])
        vi.spyOn(client.app.gameService, 'loadGame').mockResolvedValue({
            game,
            actions: host.actions
        })
        try {
            await client.session.startExploring()
            const context = client.session.explorations.getCurrentExploration()
            assertExists(context, 'Expected saved exploration')
            expect(context.state.explorationState?.checkpoint).toBeUndefined()
            context.applyAction(diskAction({ game: context.game, state: context.state }))
            expect(context.state.actionCount).toBe(1)
        } finally {
            client.dispose()
        }
    })

    test('Host View remains available without a population hook', async () => {
        const host = createExplorationHost()
        const initializer = FreshFishRuntime.initializer
        const runtime = {
            ...FreshFishUiRuntime,
            exploration: {
                createFromCanonicalState: FreshFishRuntime.exploration.createFromCanonicalState
            },
            initializer: {
                initializeGame: initializer.initializeGame.bind(initializer),
                initializeGameState: initializer.initializeGameState.bind(initializer)
            }
        }
        const client = explorationClient(host, PLAYER_B_PERSPECTIVE, runtime)
        const { session } = client
        vi.spyOn(client.app.api, 'getGame').mockImplementation(async () => ({
            game: host.gameWithState(),
            actions: host.actions
        }))
        try {
            await settleExploration(session)
            expect(session.canExplore).toBe(false)
            await session.setPrivilegedGameViewEnabled(true)
            await settleExploration(session)
            expect(session.canExplore).toBe(true)
            await session.startExploring()
            await settleExploration(session)
            expect(session.mode).toBe(GameSessionMode.Explore)
            expect(session.explorations.getCurrentExploration()?.state.tileBag.items).toHaveLength(
                host.state.tileBag.remaining
            )
        } finally {
            client.dispose()
        }
    })
})
