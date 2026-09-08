import {
    ActionSource,
    GameEngine,
    GameStatus,
    MachineContext,
    PlayerStatus,
    Visibility,
    assert,
    getPrng,
    type Game,
    type GameAction
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { SantiagoRuntime } from './runtime.js'
import { SantiagoApiActions } from './apiActions.js'
import { ActionType } from './actions.js'
import { MachineState } from './states.js'
import { SantiagoGameStateValidator, type SantiagoProjectedState } from '../model/gameState.js'
import { SquareType, isFieldSquare } from '../model/board.js'
import { validCanalPlacements, validNeutralTilePlacements } from '../util/placement.js'
import { buildTileBag } from '../util/tileBag.js'
import { isPlaceBid } from '../actions/placeBid.js'
import legacy from './tests/v2-continuation.json'

const game: Game = {
    ...legacy.game,
    status: GameStatus.Started,
    players: legacy.game.players.map((player) => ({ ...player, status: PlayerStatus.Joined })),
    createdAt: new Date(0),
    protectedInformation: true
}
const engine = new GameEngine(SantiagoRuntime)
const spectator = { kind: 'spectator' } as const

function initialize(source = game, version = 3, protectedSeed = 123) {
    const raw = new GameEngine({
        ...SantiagoRuntime,
        randomnessVersion: undefined
    }).generateUninitializedState(source)
    raw.id = 'santiago-state'
    raw.systemVersion = version
    if (version < 3) delete raw.protectedPrng
    else raw.protectedPrng = { seed: protectedSeed, invocations: 0 }
    const state = SantiagoRuntime.initializer.initializeGameState(source, raw)
    SantiagoRuntime.stateHandlers[state.machineState].enter(
        new MachineContext({ gameConfig: source.config, gameState: state })
    )
    const result = state.dehydrate()
    assert(SantiagoGameStateValidator.Check(result), 'Initial state must be canonical')
    return result
}

function project(
    state: SantiagoProjectedState,
    source = game,
    perspective: Visibility.Perspective = spectator
) {
    assert(SantiagoGameStateValidator.Check(state), 'Projection requires canonical input')
    return SantiagoRuntime.visibility.state.project(state, perspective, { config: source.config })
}

function populate(state: SantiagoProjectedState, source = game, seed = 42) {
    return SantiagoRuntime.exploration.createFromProjectedState({
        game: source,
        state,
        actions: [],
        perspective: spectator,
        random: getPrng(seed)
    })
}

function nextAction(state: SantiagoProjectedState) {
    const playerId = state.activePlayerIds[0]
    const action = {
        id: `action-${state.actionCount}`,
        gameId: game.id,
        playerId,
        source: ActionSource.User
    }
    switch (state.machineState) {
        case MachineState.SpringPlacement:
            return { ...action, type: ActionType.PlaceSpring, col: 2, row: 1 }
        case MachineState.Bidding:
            return { ...action, type: ActionType.PlaceBid, amount: 0 }
        case MachineState.PlantingPhase: {
            if (state.planterIndex >= state.plantersOrder.length) {
                const placement = validNeutralTilePlacements(state.board)[0]
                assert(placement, 'Neutral tile requires a placement')
                return { ...action, type: ActionType.PlaceNeutralTile, ...placement }
            }
            for (let col = 0; col < 8; col++) {
                for (let row = 0; row < 6; row++) {
                    if (state.board.squares[col][row].type === SquareType.Empty)
                        return { ...action, type: ActionType.PlaceField, col, row, tileIndex: 0 }
                }
            }
            return { ...action, type: ActionType.Pass }
        }
        case MachineState.CanalBuilding: {
            const segment = validCanalPlacements(state.board)[0]
            assert(segment, 'Canal building requires a segment')
            if (state.canalProposalIndex < state.canalProposalOrder.length) {
                const player = SantiagoRuntime.hydrator.hydrateState(state).getPlayerState(playerId)
                return player.getMoney() > 0
                    ? { ...action, type: ActionType.ProposeCanal, segment, amount: 1 }
                    : { ...action, type: ActionType.Pass }
            }
            return {
                ...action,
                type: ActionType.OverseerDecision,
                segment: state.canalProposals[0]?.segment ?? segment,
                accepting: state.canalProposals.length > 0
            }
        }
        case MachineState.ExtraIrrigation:
            return { ...action, type: ActionType.Pass }
        default:
            throw new Error('No action after game end')
    }
}

function scenario(source = game, version = 3) {
    const initial = initialize(source, version)
    let state: SantiagoProjectedState = initial
    const actions: GameAction[] = []
    return {
        initial,
        actions,
        get state() {
            return state
        },
        act(action: GameAction = nextAction(state)) {
            const result = engine.executeCanonicalAction({ game: source, state, action })
            state = result.updatedState
            actions.push(...result.processedActions)
            return result
        }
    }
}

describe('Santiago visibility', () => {
    it('preserves pre-adoption v2 setup and saved continuation', () => {
        expect(initialize(game, 2)).toEqual(legacy.initial)
        assert(
            SantiagoGameStateValidator.Check(legacy.initial),
            'Legacy state must remain canonical'
        )
        let state: SantiagoProjectedState = structuredClone(legacy.initial)
        const source = { ...game, protectedInformation: undefined }
        expect(Visibility.getGameVisibility(source, SantiagoRuntime)).toBeUndefined()
        for (const action of legacy.actions) {
            state = engine.executeCanonicalAction({
                game: source,
                state: JSON.parse(JSON.stringify(state)),
                action: { ...action, source: ActionSource.User }
            }).updatedState
        }
        expect(state).toEqual(legacy.expected)
    })

    it('continues unmarked numeric v3 saves without reseeding or enabling protection', () => {
        const source = { ...game, protectedInformation: undefined }
        const state = {
            ...legacy.initial,
            systemVersion: 3,
            protectedPrng: { seed: 456, invocations: 9 }
        }
        assert(SantiagoGameStateValidator.Check(state), 'Legacy v3 state must remain canonical')
        expect(Visibility.getGameVisibility(source, SantiagoRuntime)).toBeUndefined()
        const result = engine.executeCanonicalAction({
            game: source,
            state,
            action: { ...legacy.actions[0], source: ActionSource.User }
        }).updatedState
        expect(result.protectedPrng).toEqual(state.protectedPrng)
        expect(result.tileBag).toEqual(state.tileBag)
        expect(result.remainingTiles).toBeUndefined()
    })

    it('separates secret tile randomness from public setup and supports master-seed reproduction', () => {
        const source = { ...game, config: { randomizeSpring: false } }
        const first = initialize(source, 3, 123)
        const second = initialize(source, 3, 789)
        expect(first.tileBag).not.toEqual(second.tileBag)
        expect(first.prng).toEqual(second.prng)
        expect(project(first, source)).toEqual(project(second, source))
        const masterSeed = '0123456789abcdef0123456789abcdef'
        const a = engine.startGame(source, masterSeed).initialState
        const b = engine.startGame(source, masterSeed).initialState
        expect(a.tileBag).toEqual(b.tileBag)
        expect(a.protectedPrng).toEqual(b.protectedPrng)
        expect(project(a, source).masterSeed).toBeUndefined()
    })

    it('delivers owner money, public counts and reveals, and hides other balances until game end', () => {
        const source = { ...game, config: { publicMoney: false } }
        const state = initialize(source)
        for (const perspective of [spectator, { kind: 'player', playerId: 'p1' } as const]) {
            const visible = project(state, source, perspective)
            expect(visible.tileBag).toEqual([])
            expect(visible.remainingTiles).toBe(state.tileBag.length)
            expect(visible.revealedTiles).toEqual(state.revealedTiles)
            expect(visible.protectedPrng).toEqual({ seed: 0, invocations: 0 })
            expect(visible.players.map((p) => p.money)).toEqual(
                state.players.map((p) =>
                    perspective.kind === 'player' && p.playerId === perspective.playerId
                        ? p.money
                        : undefined
                )
            )
            const hydrated = SantiagoRuntime.hydrator.hydrateState(visible)
            expect(hydrated.dehydrate()).toEqual(visible)
            expect(hydrated.isBagEmpty()).toBe(false)
            expect(SantiagoGameStateValidator.Check(visible)).toBe(false)
            expect(
                project({ ...state, machineState: MachineState.EndOfGame }, source, perspective)
                    .players
            ).toEqual(state.players)
        }
        expect(project(state).players).toEqual(state.players)
        expect(project(state, { ...game, config: { publicMoney: true } }).players).toEqual(
            state.players
        )
    })

    it('guards hidden reads while permitting owner bids and projected action discovery', () => {
        const source = { ...game, config: { publicMoney: false } }
        const state = initialize(source)
        const perspective = { kind: 'player', playerId: state.activePlayerIds[0] } as const
        const visible = project(state, source, perspective)
        const guarded = SantiagoRuntime.visibility.state.guardForExecution(
            SantiagoRuntime.hydrator.hydrateState(visible),
            perspective,
            { config: source.config }
        )
        expect(guarded.getPlayerState(perspective.playerId).getMoney()).toBe(10)
        expect(() => guarded.drawTile()).toThrow(Visibility.UnavailableProjectedValueError)
        expect(() => guarded.getProtectedPrng()).toThrow(Visibility.UnavailableProjectedValueError)
        const other = state.players.find((p) => p.playerId !== perspective.playerId)
        assert(other, 'Expected an opponent')
        expect(() => guarded.getPlayerState(other.playerId).getMoney()).toThrow(
            Visibility.UnavailableProjectedValueError
        )
        expect(engine.getValidActionTypesForPlayer(source, visible, perspective.playerId)).toEqual([
            ActionType.PlaceBid
        ])
        const action = { ...nextAction(state), amount: 2 }
        const result = engine.executeAction({ game: source, state: visible, action, perspective })
        expect(
            result.updatedState.players.find((p) => p.playerId === perspective.playerId)?.money
        ).toBe(8)
        expect(result.processedActions[0]).toMatchObject({ amount: 2 })
    })

    it('registers every action and strips canonical patches without sealing public bids', () => {
        expect(Object.keys(SantiagoApiActions).sort()).toEqual(Object.values(ActionType).sort())
        const s = scenario()
        const bid = { ...nextAction(s.state), amount: 3 }
        const action = s.act(bid).processedActions[0]
        const visible = SantiagoRuntime.visibility.actions.project(action, spectator)
        expect(visible.type).toBe(ActionType.PlaceBid)
        assert(isPlaceBid(visible), 'Expected public bid')
        expect(visible.amount).toBe(3)
        expect(visible.undoPatch).toBeUndefined()
    })

    it('marks manual spring placement and subsequent tile draws as information reveals', () => {
        const source = { ...game, config: { randomizeSpring: false } }
        const s = scenario(source)
        expect(s.act().processedActions[0].revealsInfo).toBe(true)
        while (s.state.round < 2) s.act()
        const endRound = s.actions.find((action) => action.type === ActionType.EndRoundEvent)
        expect(endRound?.revealsInfo).toBe(true)
        expect(s.state.revealedTiles).toHaveLength(4)
    })

    it.each([3, 4, 5])('samples legal bags from public board tiles with %s players', (count) => {
        const source = {
            ...game,
            players: Array.from({ length: count }, (_, i) => ({
                ...game.players[0],
                id: `p${i + 1}`
            }))
        }
        const s = scenario(source)
        while (s.state.round < 3) s.act()
        const visible = project(s.state, source)
        const first = populate(visible, source, 123)
        const second = populate(visible, source, 789)
        expect(first.tileBag).not.toEqual(second.tileBag)
        for (const sample of [first, second]) {
            expect(SantiagoGameStateValidator.Check(sample)).toBe(true)
            expect(sample.tileBag).toHaveLength(s.state.remainingTiles!)
            expect(project(sample, source)).toEqual(visible)
            const population = buildTileBag()
            for (const tile of [
                ...sample.tileBag,
                ...sample.revealedTiles,
                ...sample.board.squares.flat().filter(isFieldSquare)
            ]) {
                const index = population.findIndex(
                    (p) => p.crop === tile.crop && p.farmerCapacity === tile.farmerCapacity
                )
                expect(index).toBeGreaterThanOrEqual(0)
                population.splice(index, 1)
            }
            expect(population).toHaveLength(45 % Math.max(4, count))
            expect(() =>
                engine.executeCanonicalAction({
                    game: source,
                    state: sample,
                    action: nextAction(sample)
                })
            ).not.toThrow()
        }
        const incomplete = structuredClone(visible)
        incomplete.revealedTiles.pop()
        expect(() => populate(incomplete, source)).toThrow('all publicly removed tiles')
    })

    it('rejects private-money exploration and incomplete canonical execution', () => {
        const source = { ...game, config: { publicMoney: false } }
        const state = initialize(source)
        expect(() => populate(project(state, source), source)).toThrow(
            'unavailable with private money'
        )
        expect(() => SantiagoRuntime.exploration.createFromCanonicalState(state)).toThrow(
            'unavailable with private money'
        )
        expect(() =>
            engine.executeCanonicalAction({
                game: source,
                state: project(state, source),
                action: nextAction(state)
            })
        ).toThrow()
    })

    it.each([3, 4, 5])(
        'plays and replays a full protected %s-player private-money game',
        (count) => {
            const source = {
                ...game,
                config: { publicMoney: false },
                players: Array.from({ length: count }, (_, i) => ({
                    ...game.players[0],
                    id: `p${i + 1}`
                }))
            }
            const s = scenario(source)
            for (
                let step = 0;
                step < 300 && s.state.machineState !== MachineState.EndOfGame;
                step++
            ) {
                const perspective = {
                    kind: 'player',
                    playerId: s.state.activePlayerIds[0]
                } as const
                const visible = project(s.state, source, perspective)
                expect(
                    engine.getValidActionTypesForPlayer(source, visible, perspective.playerId)
                        .length
                ).toBeGreaterThan(0)
                s.act()
                expect(SantiagoGameStateValidator.Check(s.state)).toBe(true)
                expect(s.state.remainingTiles).toBe(s.state.tileBag.length)
            }
            expect(s.state.machineState).toBe(MachineState.EndOfGame)
            expect(s.state.remainingTiles).toBe(0)
            for (const perspective of [spectator, { kind: 'player', playerId: 'p1' } as const]) {
                const history = Visibility.projectActionHistory({
                    currentState: s.state,
                    actions: s.actions,
                    visibility: SantiagoRuntime.visibility,
                    perspective,
                    replay: { game: source, runtime: SantiagoRuntime }
                })
                let view = history.currentState
                expect(view.players).toEqual(s.state.players)
                for (const action of history.actions.toReversed()) {
                    view = engine.undoProcessedAction({ state: view, action })
                    expect(view.tileBag).toEqual([])
                    if (view.machineState !== MachineState.EndOfGame) {
                        for (const player of view.players) {
                            if (
                                perspective.kind === 'spectator' ||
                                player.playerId !== perspective.playerId
                            )
                                expect(player.money).toBeUndefined()
                        }
                    }
                }
                expect(view).toEqual(project(s.initial, source, perspective))
                for (const action of history.actions)
                    view = engine.applyProcessedAction({ game: source, state: view, action })
                expect(view).toEqual(history.currentState)
            }
        }
    )
})
