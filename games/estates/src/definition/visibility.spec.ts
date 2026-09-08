import {
    ActionSource,
    GameEngine,
    GameStatus,
    PlayerStatus,
    MachineContext,
    Visibility,
    assert,
    assertExists,
    addToChecksum,
    getPrng,
    type Game,
    type GameConfig,
    type GameAction
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { EstatesRuntime } from './runtime.js'
import { EstatesActionSchemas } from './actionSchemas.js'
import { ActionType } from './actions.js'
import { MachineState } from './states.js'
import {
    EstatesGameStateValidator,
    type EstatesGameState,
    type EstatesProjectedState
} from '../model/gameState.js'
import { isDrawRoof } from '../actions/drawRoof.js'
import { isCube, isRoof } from '../components/pieces.js'
import { AuctionRecipient } from '../actions/chooseRecipient.js'
import legacy from './tests/v2-continuation.json'

const game: Game = {
    ...legacy.game,
    status: GameStatus.Started,
    createdAt: new Date(0),
    players: legacy.game.players.map((player) => ({ ...player, status: PlayerStatus.Joined })),
    protectedInformation: true
}
const engine = new GameEngine(EstatesRuntime)
const spectator = { kind: 'spectator' } as const

function project(
    state: EstatesGameState,
    perspective: Visibility.Perspective,
    config: GameConfig = game.config
) {
    return EstatesRuntime.visibility.state.project(state, perspective, { config })
}

function initialize(version = 3, hiddenMoney = true, protectedSeed = 11) {
    const raw = new GameEngine({
        ...EstatesRuntime,
        randomnessVersion: undefined
    }).generateUninitializedState(game)
    raw.id = 'legacy-estates-state'
    raw.systemVersion = version
    if (version < 3) delete raw.protectedPrng
    else raw.protectedPrng = { seed: protectedSeed, invocations: 0 }
    const state = EstatesRuntime.initializer.initializeGameState(
        { ...game, config: { hiddenMoney } },
        raw
    )
    EstatesRuntime.stateHandlers[MachineState.StartOfTurn].enter(
        new MachineContext({ gameConfig: game.config, gameState: state })
    )
    const result = state.dehydrate()
    assert(EstatesGameStateValidator.Check(result), 'Setup must be canonical')
    return result
}

function scenario(hiddenMoney = true, version = 3) {
    const scenarioGame = { ...game, config: { hiddenMoney } }
    const initial = initialize(version, hiddenMoney)
    let state: EstatesProjectedState = structuredClone(initial)
    const actions: GameAction[] = []
    function act(type: ActionType, payload: Record<string, unknown> = {}) {
        const result = engine.executeCanonicalAction({
            game: scenarioGame,
            state,
            action: {
                id: `visibility-${actions.length}`,
                gameId: game.id,
                playerId: state.activePlayerIds[0],
                source: ActionSource.User,
                type,
                ...payload
            }
        })
        state = result.updatedState
        actions.push(...result.processedActions)
        return result
    }
    function offerCube() {
        const hydrated = EstatesRuntime.hydrator.hydrateState(state)
        const coords = hydrated.placeableCubes()[0]
        act(ActionType.StartAuction, { piece: state.cubes[coords.row][coords.col] })
    }
    function passAuction() {
        while (state.machineState === MachineState.Auctioning)
            act(ActionType.PlaceBid, { amount: 0 })
    }
    function placeCube() {
        const cube = state.chosenPiece
        assert(isCube(cube), 'Expected an auctioned cube')
        const coords = EstatesRuntime.hydrator.hydrateState(state).board.validCubeLocations(cube)[0]
        act(ActionType.PlaceCube, { cube, coords })
    }
    function history(perspective: Visibility.Perspective = spectator) {
        return Visibility.projectActionHistory({
            currentState: state,
            actions,
            visibility: EstatesRuntime.visibility,
            perspective,
            replay: { game: scenarioGame, runtime: EstatesRuntime }
        })
    }
    return {
        get state() {
            return state
        },
        game: scenarioGame,
        actions,
        initial,
        act,
        offerCube,
        passAuction,
        placeCube,
        history
    }
}

function populate(
    state: EstatesProjectedState,
    actions: readonly GameAction[],
    perspective: Visibility.Perspective = spectator
) {
    return EstatesRuntime.exploration.createFromProjectedState({
        game: { ...game, config: { ...game.config, hiddenMoney: state.hiddenMoney === true } },
        state,
        actions,
        perspective,
        random: getPrng(123)
    })
}

describe('Estates visibility and legacy continuation', () => {
    it('keeps the v2 setup and saved forward action sequence unchanged', () => {
        const initial = initialize(2)
        expect(initial.prng).toEqual(legacy.setupPrng)
        expect(addToChecksum(0, [JSON.stringify(initial)])).toBe(legacy.setupChecksum)
        assert(EstatesGameStateValidator.Check(legacy.state), 'Legacy fixture must be canonical')
        let state: EstatesProjectedState = structuredClone(legacy.state)
        const unprotectedGame = { ...game, protectedInformation: undefined }
        expect(Visibility.getGameVisibility(unprotectedGame, EstatesRuntime)).toBeUndefined()
        for (const action of legacy.continuation) {
            state = engine.executeCanonicalAction({
                game: unprotectedGame,
                state: JSON.parse(JSON.stringify(state)),
                action: { ...action, source: ActionSource.User }
            }).updatedState
            expect(state.systemVersion).toBe(2)
            expect(state.protectedPrng).toBeUndefined()
            expect(EstatesGameStateValidator.Check(state)).toBe(true)
        }
        expect(state).toEqual(legacy.expectedState)
    })

    it('continues unmarked numeric v3 saves without adopting protection or reseeding', () => {
        assert(EstatesGameStateValidator.Check(legacy.state), 'Legacy fixture must be canonical')
        let state: EstatesProjectedState = {
            ...structuredClone(legacy.state),
            systemVersion: 3,
            protectedPrng: { seed: 9876, invocations: 7 }
        }
        const unprotectedGame = { ...game, protectedInformation: undefined }
        expect(Visibility.getGameVisibility(unprotectedGame, EstatesRuntime)).toBeUndefined()
        for (const action of legacy.continuation) {
            state = engine.executeCanonicalAction({
                game: unprotectedGame,
                state: JSON.parse(JSON.stringify(state)),
                action: { ...action, source: ActionSource.User }
            }).updatedState
            expect(state.protectedPrng).toEqual({ seed: 9876, invocations: 7 })
            expect(state.hiddenMoney).toBeUndefined()
        }
        expect(state.players).toEqual(legacy.expectedState.players)
        expect(state.board).toEqual(legacy.expectedState.board)
        expect(state.roofs).toEqual(legacy.expectedState.roofs)
    })

    it('continues old draw bags with consumed items still present', () => {
        const s = scenario()
        s.offerCube()
        s.passAuction()
        s.placeCube()
        const before = structuredClone(s.state.roofs.items)
        s.act(ActionType.DrawRoof, { visibleIndex: 0, revealsInfo: true })
        s.passAuction()
        assert(isRoof(s.state.chosenPiece), 'Expected a roof')
        s.act(ActionType.PlaceRoof, { roof: s.state.chosenPiece, coords: { row: 0, col: 0 } })
        s.offerCube()
        s.passAuction()
        s.placeCube()
        s.state.roofs.items = before
        const result = s.act(ActionType.DrawRoof, { visibleIndex: 1, revealsInfo: true })
        expect(result.updatedState.chosenPiece).toEqual(before[10])
        expect(result.updatedState.roofs.items).toEqual(before.slice(0, 10))
    })

    it('uses reproducible private entropy for new games without affecting public setup', () => {
        const first = initialize(3, true, 11)
        const second = initialize(3, true, 22)
        expect(first.roofs.items).not.toEqual(second.roofs.items)
        expect(project(first, spectator)).toEqual(project(second, spectator))
        expect(first.protectedPrng?.invocations).toBe(11)
        const masterSeed = '0123456789abcdef0123456789abcdef'
        const setup = () => {
            const raw = engine.generateUninitializedState(game, masterSeed)
            raw.id = 'reproduction'
            const state = EstatesRuntime.initializer.initializeGameState(game, raw).dehydrate()
            assert(EstatesGameStateValidator.Check(state), 'Setup must be canonical')
            return state
        }
        expect(setup()).toEqual(setup())
        expect(setup().protectedPrng).toMatchObject({ algorithm: 'chacha20-v1' })
        expect(project(setup(), spectator)).not.toHaveProperty('masterSeed')
        expect(engine.startGame(game, masterSeed).startedGame.protectedInformation).toBe(true)
    })

    it.each([false, true])(
        'hydrates every permitted perspective with hiddenMoney=%s',
        (hiddenMoney) => {
            const state = initialize(3, hiddenMoney)
            for (const perspective of [
                spectator,
                ...game.players.map((player) => ({ kind: 'player' as const, playerId: player.id }))
            ]) {
                const view = project(state, perspective, { hiddenMoney })
                expect(view.roofs).toEqual({ items: [], remaining: 12 })
                expect(view.protectedPrng).toEqual({ seed: 0, invocations: 0 })
                expect(view.visibleRoofs).toEqual(state.visibleRoofs)
                expect(view.cubes).toEqual(state.cubes)
                for (const player of view.players) {
                    const entitled =
                        !hiddenMoney ||
                        (perspective.kind === 'player' && perspective.playerId === player.playerId)
                    for (const field of ['money', 'stolen', 'score'])
                        expect(Object.hasOwn(player, field)).toBe(entitled)
                }
                expect(EstatesRuntime.hydrator.hydrateState(view).dehydrate()).toEqual(view)
                expect(EstatesGameStateValidator.Check(view)).toBe(!hiddenMoney)
            }
            expect(Object.keys(EstatesActionSchemas).sort()).toEqual(
                Object.values(ActionType).sort()
            )
        }
    )

    it('uses Game config independently of the legacy auction state flag', () => {
        const state = initialize()
        delete state.hiddenMoney
        expect(project(state, spectator, { hiddenMoney: true }).players[0]).not.toHaveProperty(
            'money'
        )
        state.hiddenMoney = true
        expect(project(state, spectator, { hiddenMoney: false }).players).toEqual(state.players)
        expect(project(state, spectator, {}).players).toEqual(state.players)
    })

    it('reveals final financial totals but never the undrawn roofs', () => {
        const hydrated = EstatesRuntime.hydrator.hydrateState(initialize())
        hydrated.machineState = MachineState.EndOfGame
        const state = hydrated.dehydrate()
        assert(EstatesGameStateValidator.Check(state), 'Final state must be canonical')
        const view = project(state, spectator)
        expect(view.players).toEqual(state.players)
        expect(view.roofs.items).toEqual([])
    })

    it('uses owner money for discovery and starts hidden-money auctions without opponent balances', () => {
        const state = initialize()
        const playerId = state.activePlayerIds[0]
        const perspective = { kind: 'player', playerId } as const
        const view = project(state, perspective)
        expect(
            engine.getValidActionTypesForPlayer(game, view, playerId, { perspective })
        ).toContain(ActionType.Embezzle)
        const hydrated = EstatesRuntime.hydrator.hydrateState(view)
        const guarded = EstatesRuntime.visibility.state.guardForExecution(hydrated, perspective, {
            config: game.config
        })
        expect(guarded.getPlayerState(playerId).getMoney()).toBe(12)
        const coords = hydrated.placeableCubes()[0]
        const action = {
            id: 'auction',
            gameId: game.id,
            source: ActionSource.User,
            playerId,
            type: ActionType.StartAuction,
            piece: state.cubes[coords.row][coords.col]
        }
        const opponent = state.players.find((player) => player.playerId !== playerId)
        assertExists(opponent, 'Expected an opponent')
        expect(() => guarded.getPlayerState(opponent.playerId).getMoney()).toThrow(
            Visibility.UnavailableProjectedValueError
        )
        expect(
            engine.executeAction({ game, state: view, action, perspective }).updatedState.auction
                ?.participants
        ).toHaveLength(3)
        expect(
            engine.executeCanonicalAction({ game, state, action }).updatedState.auction
                ?.participants
        ).toHaveLength(3)
    })

    it.each([0, 1])(
        'does not reveal a bidder balance of $%s through automatic passing',
        (balance) => {
            const poor = scenario()
            const funded = scenario()
            for (const s of [poor, funded]) s.offerCube()
            const firstBidder = poor.state.activePlayerIds[0]
            for (const player of poor.state.players) {
                if (player.playerId !== firstBidder) player.money = balance
            }
            for (const s of [poor, funded]) s.act(ActionType.PlaceBid, { amount: 2 })
            expect(poor.state.machineState).toBe(MachineState.Auctioning)
            assert(EstatesGameStateValidator.Check(poor.state), 'Expected canonical auction')
            assert(EstatesGameStateValidator.Check(funded.state), 'Expected canonical auction')
            expect(project(poor.state, spectator)).toEqual(project(funded.state, spectator))
            const playerId = poor.state.activePlayerIds[0]
            const perspective = { kind: 'player', playerId } as const
            const view = project(poor.state, perspective)
            expect(
                engine.getValidActionTypesForPlayer(game, view, playerId, { perspective })
            ).toContain(ActionType.PlaceBid)
            expect(() => poor.act(ActionType.PlaceBid, { amount: 3 })).toThrow(
                'exceeds player money'
            )
            for (const amount of [-1, 0.5]) {
                expect(() => poor.act(ActionType.PlaceBid, { amount })).toThrow(
                    'non-negative whole number'
                )
            }
            poor.passAuction()
            expect(poor.state.machineState).toBe(MachineState.AuctionEnded)
            expect(
                poor.actions
                    .filter((action) => action.type === ActionType.PlaceBid)
                    .every((action) => action.source === ActionSource.User)
            ).toBe(true)
            expect(() =>
                poor.act(ActionType.ChooseRecipient, { recipient: AuctionRecipient.Auctioneer })
            ).toThrow('enough money')
            const auctioneerId = poor.state.activePlayerIds[0]
            const auctioneerPerspective = { kind: 'player', playerId: auctioneerId } as const
            assert(
                EstatesGameStateValidator.Check(poor.state),
                'Expected canonical recipient choice'
            )
            const auctioneerView = project(poor.state, auctioneerPerspective)
            const payment = {
                id: 'payment',
                gameId: game.id,
                playerId: auctioneerId,
                source: ActionSource.User,
                type: ActionType.ChooseRecipient,
                recipient: AuctionRecipient.HighestBidder
            }
            expect(() =>
                engine.executeAction({
                    game,
                    state: auctioneerView,
                    perspective: auctioneerPerspective,
                    action: payment
                })
            ).toThrow(Visibility.UnavailableProjectedValueError)
            poor.act(ActionType.ChooseRecipient, { recipient: AuctionRecipient.HighestBidder })
            expect(poor.state.machineState).toBe(MachineState.PlacingPiece)
        }
    )

    it.each([false, true])(
        'preserves public and legacy automatic money decisions with configured hiddenMoney=%s',
        (hiddenMoney) => {
            const s = scenario(hiddenMoney, hiddenMoney ? 2 : 3)
            s.offerCube()
            const firstBidder = s.state.activePlayerIds[0]
            for (const player of s.state.players) {
                if (player.playerId !== firstBidder) player.money = 0
            }
            s.act(ActionType.PlaceBid, { amount: 2 })
            expect(s.state.machineState).toBe(MachineState.PlacingPiece)
            expect(s.state.recipient).toBe(firstBidder)
            expect(
                s.actions.filter(
                    (action) =>
                        action.type === ActionType.PlaceBid && action.source === ActionSource.System
                )
            ).toHaveLength(2)
            expect(
                s.actions.some(
                    (action) =>
                        action.type === ActionType.ChooseRecipient &&
                        action.source === ActionSource.System
                )
            ).toBe(true)

            const empty = scenario(hiddenMoney, hiddenMoney ? 2 : 3)
            for (const player of empty.state.players) player.money = 0
            empty.offerCube()
            expect(empty.state.machineState).toBe(MachineState.PlacingPiece)
        }
    )

    it.each(
        [false, true].flatMap((hiddenMoney) =>
            Object.values(AuctionRecipient).map((recipient) => ({ hiddenMoney, recipient }))
        )
    )(
        'projects $recipient payments with hiddenMoney=$hiddenMoney',
        ({ recipient, hiddenMoney }) => {
            const s = scenario(hiddenMoney)
            s.act(ActionType.Embezzle)
            s.offerCube()
            s.passAuction()
            s.placeCube()
            const result = s.act(ActionType.DrawRoof, { visibleIndex: 0, revealsInfo: true })
            const drawn = result.processedActions.find(isDrawRoof)
            assertExists(drawn, 'Expected a roof draw')
            expect(drawn.metadata?.chosenRoof).toEqual(s.state.chosenPiece)
            s.act(ActionType.PlaceBid, { amount: 2 })
            s.passAuction()
            s.act(ActionType.ChooseRecipient, { recipient })
            for (const perspective of [
                spectator,
                { kind: 'player' as const, playerId: s.state.activePlayerIds[0] }
            ]) {
                const history = s.history(perspective)
                expect(history.actions.find(isDrawRoof)?.metadata).toEqual(drawn.metadata)
                expect(
                    history.actions.every((action) => action.type !== 'tabletop.redacted-action')
                ).toBe(true)
                let view: EstatesProjectedState = history.currentState
                for (const action of history.actions.toReversed())
                    view = engine.undoProcessedAction({ state: view, action })
                expect(view).toEqual(project(s.initial, perspective, s.game.config))
                for (const action of history.actions)
                    view = engine.applyProcessedAction({ game: s.game, state: view, action })
                expect(JSON.parse(JSON.stringify(view))).toEqual(
                    JSON.parse(JSON.stringify(history.currentState))
                )
                if (hiddenMoney) {
                    expect(() => populate(view, history.actions, perspective)).toThrow(
                        'unavailable with Hidden Money'
                    )
                } else {
                    const sample = populate(view, history.actions, perspective)
                    expect(EstatesGameStateValidator.Check(sample)).toBe(true)
                    expect(sample.players).toEqual(s.state.players)
                    expect(sample.roofs.items.map((roof) => roof.value).sort()).toEqual(
                        s.state.roofs.items.map((roof) => roof.value).sort()
                    )
                    expect(populate(view, history.actions, perspective)).toEqual(sample)
                    const roofsWithDrawnValue = sample.roofs.items.filter(
                        (roof) => roof.value === drawn.metadata?.chosenRoof.value
                    )
                    expect(roofsWithDrawnValue).toHaveLength(1)
                }
                for (const record of history.actions) {
                    expect(
                        (record.undoPatch ?? []).some((patch) =>
                            patch.path.includes('/roofs/items/')
                        )
                    ).toBe(false)
                    expect(
                        (record.forwardPatch ?? []).some((patch) =>
                            patch.path.includes('/roofs/items/')
                        )
                    ).toBe(false)
                }
            }
        }
    )

    it.each([MachineState.StartOfTurn, MachineState.EndOfGame])(
        'rejects Hidden Money exploration in %s, even with complete balances',
        (machineState) => {
            const hydrated = EstatesRuntime.hydrator.hydrateState(initialize())
            hydrated.machineState = machineState
            const state = hydrated.dehydrate()
            assert(EstatesGameStateValidator.Check(state), 'Expected canonical state')
            expect(() => EstatesRuntime.exploration.createFromCanonicalState(state)).toThrow(
                'unavailable with Hidden Money'
            )
            for (const perspective of [
                spectator,
                { kind: 'player' as const, playerId: state.players[0].playerId }
            ]) {
                const view = project(state, perspective)
                expect(() => populate(view, [], perspective)).toThrow(
                    'unavailable with Hidden Money'
                )
            }
            const legacyState = initialize(2)
            expect(() =>
                EstatesRuntime.exploration.createFromProjectedState({
                    game,
                    state: legacyState,
                    actions: [],
                    perspective: spectator,
                    random: getPrng(123)
                })
            ).toThrow('unavailable with Hidden Money')
        }
    )

    it('samples independently of the canonical roof order', () => {
        const first = initialize(3, false, 11)
        const second = initialize(3, false, 22)
        expect(populate(project(first, spectator, { hiddenMoney: false }), [])).toEqual(
            populate(project(second, spectator, { hiddenMoney: false }), [])
        )
    })

    it('waits for penniless bidders and reveals totals through the final placement', () => {
        const s = scenario()
        const auctioneer = s.state.activePlayerIds[0]
        const opponents = s.state.players.filter((player) => player.playerId !== auctioneer)
        for (const opponent of opponents) opponent.money = 0
        s.offerCube()
        expect(s.state.machineState).toBe(MachineState.Auctioning)
        expect(s.state.auction?.participants).toHaveLength(3)
        s.passAuction()
        s.placeCube()
        s.state.roofs.items = s.state.roofs.items.slice(0, 1)
        s.state.roofs.remaining = 1
        s.state.visibleRoofs = s.state.visibleRoofs.map((_, index) => index === 0)
        s.act(ActionType.DrawRoof, { visibleIndex: 0, revealsInfo: true })
        s.passAuction()
        const roof = s.state.chosenPiece
        assert(isRoof(roof), 'Expected the last roof')
        const before = structuredClone(s.state)
        const result = s.act(ActionType.PlaceRoof, { roof, coords: { row: 0, col: 0 } })
        expect(s.state.machineState).toBe(MachineState.EndOfGame)
        assert(EstatesGameStateValidator.Check(before), 'Placement must start canonical')
        assert(EstatesGameStateValidator.Check(s.state), 'Finished state must be canonical')
        const finishedGame = { ...s.game, status: GameStatus.Finished }
        const history = Visibility.projectActionHistory({
            game: finishedGame,
            currentState: s.state,
            startIndex: before.actionCount,
            actions: result.processedActions,
            visibility: EstatesRuntime.visibility,
            perspective: spectator,
            replay: { game, runtime: EstatesRuntime }
        })
        let view: EstatesProjectedState = project(before, spectator)
        expect(view.players.every((player) => player.money === undefined)).toBe(true)
        for (const action of history.actions)
            view = engine.applyProcessedAction({ game: s.game, state: view, action })
        expect(view.players).toEqual(s.state.players)
        expect(view.winningPlayerIds.length).toBeGreaterThan(0)
        expect(view.roofs.items).toEqual([])
        for (const action of history.actions.toReversed())
            view = engine.undoProcessedAction({ state: view, action })
        expect(view.players.every((player) => player.money === undefined)).toBe(true)
    })

    it.each([2, 3])(
        'plays a complete system-v%s game through roof exhaustion or completed rows',
        (version) => {
            const s = scenario(true, version)
            for (
                let step = 0;
                step < 200 && s.state.machineState !== MachineState.EndOfGame;
                step++
            ) {
                const state = EstatesRuntime.hydrator.hydrateState(s.state)
                const playerId = state.activePlayerIds[0]
                const perspective = { kind: 'player', playerId } as const
                if (version === 3) {
                    assert(
                        EstatesGameStateValidator.Check(s.state),
                        'Authoritative state must be canonical'
                    )
                    const view = project(s.state, perspective)
                    expect(
                        engine.getValidActionTypesForPlayer(game, view, playerId, { perspective })
                    ).toEqual(engine.getValidActionTypesForPlayer(game, s.state, playerId))
                }
                switch (state.machineState) {
                    case MachineState.StartOfTurn:
                        if (state.board.validRoofLocations().length > 0) {
                            s.act(ActionType.DrawRoof, {
                                visibleIndex: state.visibleRoofs.indexOf(true),
                                revealsInfo: true
                            })
                        } else s.offerCube()
                        break
                    case MachineState.Auctioning:
                        s.act(ActionType.PlaceBid, {
                            amount:
                                state.auction?.highBid ||
                                state.getPlayerState(playerId).getMoney() === 0
                                    ? 0
                                    : 1
                        })
                        break
                    case MachineState.AuctionEnded:
                        s.act(ActionType.ChooseRecipient, {
                            recipient: AuctionRecipient.HighestBidder
                        })
                        break
                    case MachineState.PlacingPiece:
                        if (isRoof(state.chosenPiece)) {
                            s.act(ActionType.PlaceRoof, {
                                roof: state.chosenPiece,
                                coords: state.board.validRoofLocations()[0]
                            })
                        } else s.placeCube()
                        break
                }
            }
            expect(s.state.machineState).toBe(MachineState.EndOfGame)
            expect(s.state.systemVersion).toBe(version)
            expect(s.state.winningPlayerIds.length).toBeGreaterThan(0)
        },
        15_000
    )

    it('does not invent missing draw observations for public-money exploration', () => {
        const s = scenario(false)
        s.offerCube()
        s.passAuction()
        s.placeCube()
        s.act(ActionType.DrawRoof, { visibleIndex: 0, revealsInfo: true })
        const history = s.history()
        expect(() => populate(history.currentState, [])).toThrow('roof count')
        const omitted = history.actions.map((action) =>
            isDrawRoof(action) ? { ...action, metadata: undefined } : action
        )
        expect(() => populate(history.currentState, omitted)).toThrow('revealed roof draws')
        const missing = history.actions.filter((action) => action.type !== ActionType.StartAuction)
        expect(EstatesGameStateValidator.Check(populate(history.currentState, missing))).toBe(true)
    })
})
