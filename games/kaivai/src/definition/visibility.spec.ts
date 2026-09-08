import {
    ActionSource,
    assert,
    assertExists,
    ExplorationHistory,
    GameEngine,
    GameStatus,
    getPrng,
    MachineContext,
    PlayerStatus,
    Prng,
    Visibility,
    type Game,
    type GameAction
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { KaivaiRuntime } from './runtime.js'
import { KaivaiActionSchemas } from './actionSchemas.js'
import { ActionType } from './actions.js'
import { MachineState } from './states.js'
import { Ruleset } from './gameConfig.js'
import { CellType } from './cells.js'
import { HutType } from './huts.js'
import { KaivaiGameStateValidator, type KaivaiProjectedState } from '../model/gameState.js'
import { type PlaceScoringBid } from '../actions/placeScoringBid.js'
import { type PlaceBid } from '../actions/placeBid.js'
import { HydratedFish, isFish, type Fish } from '../actions/fish.js'
import { isScoreIsland } from '../actions/scoreIsland.js'

const game: Game = {
    id: 'kaivai-visibility',
    typeId: 'kaivai',
    status: GameStatus.Started,
    isPublic: false,
    deleted: false,
    ownerId: 'owner',
    name: 'Kaivai visibility',
    players: ['p1', 'p2', 'p3'].map((id) => ({
        id,
        name: id,
        isHuman: true,
        status: PlayerStatus.Joined
    })),
    config: { ruleset: Ruleset.FirstEdition, lucklessFishing: false },
    hotseat: false,
    protectedInformation: true,
    winningPlayerIds: [],
    createdAt: new Date(0),
    seed: 101
}
const engine = new GameEngine(KaivaiRuntime)
const owner = { kind: 'player', playerId: 'p1' } as const
const opponent = { kind: 'player', playerId: 'p2' } as const
const spectator = { kind: 'spectator' } as const
const perspectives = [owner, opponent, spectator]

function projectState(state: KaivaiProjectedState, perspective: Visibility.Perspective) {
    assert(KaivaiGameStateValidator.Check(state), 'Expected complete canonical state')
    return KaivaiRuntime.visibility.state.project(state, perspective)
}

function initialize(systemVersion = 3) {
    const state = new GameEngine({
        ...KaivaiRuntime,
        randomnessVersion: undefined
    }).generateUninitializedState(game)
    state.id = 'kaivai-state'
    state.systemVersion = systemVersion
    if (systemVersion < 3) delete state.protectedPrng
    else state.protectedPrng = { seed: 123, invocations: 0 }
    const hydrated = KaivaiRuntime.initializer.initializeGameState(game, state)
    KaivaiRuntime.stateHandlers[MachineState.Bidding].enter(
        new MachineContext({ gameState: hydrated, gameConfig: game.config })
    )
    return hydrated.dehydrate()
}

function scoringState(systemVersion = 3) {
    const state = initialize(systemVersion)
    state.machineState = MachineState.IslandBidding
    state.hutsScored = true
    state.islandsToScore = Object.keys(state.board.islands)
    state.chosenIsland = state.islandsToScore[0]
    state.bidders = ['p1', 'p2', 'p3']
    state.activePlayerIds = [...state.bidders]
    return state
}

function bid(playerId: string, amount: number): PlaceScoringBid {
    return {
        id: `bid-${playerId}`,
        gameId: game.id,
        type: ActionType.PlaceScoringBid,
        source: ActionSource.User,
        playerId,
        amount,
        simultaneousGroupId: 'scoring-bids',
        createdAt: new Date(0)
    }
}

function projectHistory(
    state: KaivaiProjectedState,
    actions: GameAction[],
    perspective: Visibility.Perspective
) {
    return Visibility.projectActionHistory({
        currentState: state,
        actions,
        visibility: KaivaiRuntime.visibility,
        perspective,
        replay: { game, runtime: KaivaiRuntime }
    })
}

function fishingState(version = 3) {
    const state = KaivaiRuntime.hydrator.hydrateState(initialize(version))
    const player = state.getPlayerState('p1')
    const island = Object.values(state.board.islands)[0]
    const cult = island.coordList[0]
    const hutCoords = { q: cult.q + 1, r: cult.r }
    state.board.addCell({
        type: CellType.Fishing,
        coords: hutCoords,
        islandId: island.id,
        hutType: HutType.Fishing,
        owner: player.playerId
    })
    const boatCoords = { q: cult.q, r: cult.r + 1 }
    const boat = player.getBoat()
    state.board.addBoatTo(boatCoords, boat)
    player.boatLocations[boat.id] = boatCoords
    player.availableBoats = [boat.id]
    state.machineState = MachineState.Fishing
    state.activePlayerIds = [player.playerId]
    const action: Fish = {
        id: 'fish',
        gameId: game.id,
        type: ActionType.Fish,
        source: ActionSource.User,
        playerId: player.playerId,
        boatId: boat.id,
        boatCoords
    }
    return { state, action }
}

describe('Kaivai protected visibility', () => {
    it('registers every action and marks new games as protected with reproducible secret entropy', () => {
        expect(Object.keys(KaivaiActionSchemas).sort()).toEqual(Object.values(ActionType).sort())
        const masterSeed = '0123456789abcdef0123456789abcdef'
        const first = engine.startGame(game, masterSeed)
        const second = engine.startGame(game, masterSeed)
        expect(first.startedGame.protectedInformation).toBe(true)
        expect({ ...second.initialState, id: first.initialState.id }).toEqual(first.initialState)
        expect(first.initialState.protectedPrng).toMatchObject({ algorithm: 'chacha20-v1' })
        for (const perspective of perspectives) {
            const projected = projectState(first.initialState, perspective)
            expect(projected).not.toHaveProperty('masterSeed')
            expect(projected.protectedPrng).toEqual({ seed: 0, invocations: 0 })
            expect(KaivaiRuntime.hydrator.hydrateState(projected).dehydrate()).toEqual(projected)
        }
    })

    it('keeps ordinary round bids public and locally executable', () => {
        const state = initialize()
        const playerId = state.activePlayerIds[0]
        const action: PlaceBid = {
            id: 'normal-bid',
            gameId: game.id,
            source: ActionSource.User,
            type: ActionType.PlaceBid,
            playerId,
            amount: 1
        }
        const perspective = { kind: 'player', playerId } as const
        const result = engine.executeCanonicalAction({ game, state, action })
        const optimistic = engine.executeAction({
            game,
            state: projectState(state, perspective),
            action,
            perspective
        })
        expect(optimistic.updatedState).toEqual(projectState(result.updatedState, perspective))
        for (const viewer of perspectives) {
            expect(projectState(result.updatedState, viewer).bids[playerId]).toBe(1)
            expect(
                KaivaiRuntime.visibility.actions.project(result.processedActions[0], viewer)
            ).toMatchObject({ amount: 1 })
        }
    })

    it('conceals pending bids in states, action payloads, and history patches while retaining public submission status', () => {
        const before = scoringState()
        const result = engine.executeCanonicalAction({ game, state: before, action: bid('p1', 2) })
        for (const perspective of perspectives) {
            const history = projectHistory(
                result.updatedState,
                result.processedActions,
                perspective
            )
            const ownsBid = perspective.kind === 'player' && perspective.playerId === 'p1'
            expect(history.currentState.scoringBids).toEqual(
                ownsBid ? [{ playerId: 'p1', amount: 2 }] : [{ playerId: 'p1' }]
            )
            expect(history.currentState.bidders).toEqual(['p2', 'p3'])
            expect(history.currentState.activePlayerIds).toEqual(['p2', 'p3'])
            if (ownsBid) expect(history.actions[0]).toHaveProperty('amount', 2)
            else expect(history.actions[0]).not.toHaveProperty('amount')
            if (!ownsBid) expect(history.actions[0].forwardPatch).toBeDefined()
            const replayed = engine.applyProcessedAction({
                game,
                state: projectState(before, perspective),
                action: history.actions[0]
            })
            expect(replayed).toEqual(history.currentState)
            expect(
                engine.undoProcessedAction({ state: replayed, action: history.actions[0] })
            ).toEqual(projectState(before, perspective))
            expect(
                engine.getValidActionTypesForPlayer(game, history.currentState, 'p2', {
                    perspective: opponent
                })
            ).toEqual([ActionType.PlaceScoringBid])
        }
        const secondBid = bid('p2', 1)
        const canonical = engine.executeCanonicalAction({
            game,
            state: result.updatedState,
            action: secondBid
        })
        const optimistic = engine.executeAction({
            game,
            state: projectState(result.updatedState, opponent),
            action: secondBid,
            perspective: opponent
        })
        expect(optimistic.updatedState).toEqual(projectState(canonical.updatedState, opponent))
        const different = scoringState()
        const alternate = engine.executeCanonicalAction({
            game,
            state: different,
            action: bid('p1', 1)
        })
        expect(
            projectHistory(alternate.updatedState, alternate.processedActions, spectator)
        ).toEqual(projectHistory(result.updatedState, result.processedActions, spectator))
    })

    it.each([Ruleset.FirstEdition, Ruleset.SecondEdition])(
        'reveals the complete scoring result only on ScoreIsland in %s',
        (ruleset) => {
            const configuredGame = { ...game, config: { ...game.config, ruleset } }
            let state = scoringState()
            const actions: GameAction[] = []
            for (const action of [bid('p1', 2), bid('p2', 1)]) {
                const result = engine.executeCanonicalAction({
                    game: configuredGame,
                    state,
                    action
                })
                state = result.updatedState
                actions.push(...result.processedActions)
            }
            const result = engine.executeCanonicalAction({
                game: configuredGame,
                state,
                action: bid('p3', 0)
            })
            const lastSubmission = result.actionCascade.transitions[0].after
            expect(lastSubmission.machineState).toBe(MachineState.FinalScoring)
            expect(projectState(lastSubmission, spectator).scoringBids).toEqual([
                { playerId: 'p1' },
                { playerId: 'p2' },
                { playerId: 'p3' }
            ])
            const score = result.processedActions.find(isScoreIsland)
            assertExists(score)
            expect(score.revealsInfo).toBe(true)
            expect(score.metadata?.playerMajorities).toMatchObject({
                p1: { influence: 2 },
                p2: { influence: 1 },
                p3: { influence: 0 }
            })
            expect(projectState(result.updatedState, spectator).scoringBids).toEqual([])
            const history = Visibility.projectActionHistory({
                currentState: result.updatedState,
                actions: [...actions, ...result.processedActions],
                visibility: KaivaiRuntime.visibility,
                perspective: spectator,
                replay: { game: configuredGame, runtime: KaivaiRuntime }
            })
            for (const action of history.actions.filter(
                (action) => action.type === ActionType.PlaceScoringBid
            )) {
                expect(action).not.toHaveProperty('amount')
            }
            let view = history.currentState
            for (const action of history.actions.toReversed())
                view = engine.undoProcessedAction({ state: view, action })
            expect(view).toEqual(projectState(scoringState(), spectator))
            for (const action of history.actions)
                view = engine.applyProcessedAction({ game: configuredGame, state: view, action })
            expect(view).toEqual(history.currentState)
        }
    )

    it('samples unknown submitted bids from public constraints and preserves known bids', () => {
        const state = scoringState()
        state.scoringBids = [
            { playerId: 'p1', amount: 2 },
            { playerId: 'p2', amount: 0 }
        ]
        state.bidders = ['p3']
        state.activePlayerIds = ['p3']
        const otherWorld = structuredClone(state)
        otherWorld.scoringBids = [
            { playerId: 'p1', amount: 2 },
            { playerId: 'p2', amount: 3 }
        ]
        const populate = (source: KaivaiProjectedState, perspective: Visibility.Perspective) =>
            KaivaiRuntime.exploration.createFromProjectedState({
                game,
                state: projectState(source, perspective),
                actions: [],
                perspective,
                random: getPrng(1234)
            })
        const sample = populate(state, owner)
        expect(sample).toEqual(populate(otherWorld, owner))
        expect(sample.scoringBids?.[0]).toEqual({ playerId: 'p1', amount: 2 })
        expect(sample.scoringBids?.map((bid) => bid.playerId)).toEqual(['p1', 'p2'])
        expect(KaivaiGameStateValidator.Check(sample)).toBe(true)
        for (const perspective of perspectives) {
            const hypothetical = populate(state, perspective)
            for (const { playerId, amount } of hypothetical.scoringBids ?? []) {
                const player = hypothetical.players.find((player) => player.playerId === playerId)
                assertExists(player)
                expect(amount).toBeGreaterThanOrEqual(0)
                expect(amount).toBeLessThanOrEqual(player.influence)
            }
            expect(() =>
                engine.executeCanonicalAction({ game, state: hypothetical, action: bid('p3', 1) })
            ).not.toThrow()
        }
        const prepared = new ExplorationHistory(engine).prepareState(state)
        expect(prepared.protectedPrng).not.toEqual(state.protectedPrng)
        expect(prepared).not.toHaveProperty('masterSeed')
        expect(state.scoringBids).toEqual([
            { playerId: 'p1', amount: 2 },
            { playerId: 'p2', amount: 0 }
        ])
    })

    it.each([1, 2, 3])('preserves canonical delivery for unmarked version %i games', (version) => {
        const legacy = { ...game }
        delete legacy.protectedInformation
        expect(Visibility.getGameVisibility(legacy, KaivaiRuntime)).toBeUndefined()
        expect(KaivaiGameStateValidator.Check(scoringState(version))).toBe(true)
    })

    it.each([Ruleset.FirstEdition, Ruleset.SecondEdition])(
        'continues legacy scoring maps without migrating history in %s',
        (ruleset) => {
            const legacyGame = { ...game, config: { ...game.config, ruleset } }
            delete legacyGame.protectedInformation
            let state = scoringState(2)
            delete state.scoringBids
            state.bids = { p1: 2 }
            state.bidders = ['p2', 'p3']
            state.activePlayerIds = [...state.bidders]
            const before = structuredClone(state)
            const first = engine.executeCanonicalAction({
                game: legacyGame,
                state,
                action: bid('p2', 1)
            })
            expect(first.updatedState.scoringBids).toBeUndefined()
            expect(first.updatedState.bids).toEqual({ p1: 2, p2: 1 })
            expect(
                engine.undoProcessedAction({
                    state: first.updatedState,
                    action: first.processedActions[0]
                })
            ).toEqual(before)
            state = first.updatedState
            const result = engine.executeCanonicalAction({
                game: legacyGame,
                state,
                action: bid('p3', 0)
            })
            const score = result.processedActions.find(isScoreIsland)
            expect(score?.metadata?.playerMajorities).toMatchObject({
                p1: { influence: 2 },
                p2: { influence: 1 },
                p3: { influence: 0 }
            })
            expect(result.updatedState.scoringBids).toBeUndefined()
            expect(
                result.updatedState.players.find((player) => player.playerId === 'p2')?.influence
            ).toBe(ruleset === Ruleset.FirstEdition ? 3 : 2)
        }
    )

    it('accepts projected hydration while rejecting an incomplete canonical scoring bid', () => {
        const state = scoringState()
        state.scoringBids = [{ playerId: 'p1', amount: 2 }]
        const projected = projectState(state, spectator)
        expect(KaivaiRuntime.hydrator.hydrateState(projected).dehydrate()).toEqual(projected)
        expect(KaivaiGameStateValidator.Check(projected)).toBe(false)
        expect(() => engine.validateCanonicalState(projected)).toThrow(
            'Complete canonical state is required'
        )
    })

    it('delivers randomized fishing through public outcomes and safe replay patches', () => {
        const { state, action } = fishingState()
        const before = state.dehydrate()
        const result = engine.executeCanonicalAction({ game, state: before, action })
        const history = projectHistory(result.updatedState, result.processedActions, spectator)
        expect(history.actions[0].forwardPatch).toBeDefined()
        const fish = result.processedActions.find(isFish)
        assertExists(fish)
        expect(history.actions[0]).toMatchObject({ revealsInfo: true, metadata: fish.metadata })
        expect(history.currentState.protectedPrng).toEqual({ seed: 0, invocations: 0 })
        let view = projectState(before, spectator)
        for (const record of history.actions)
            view = engine.applyProcessedAction({ game, state: view, action: record })
        expect(view).toEqual(history.currentState)
        for (const record of history.actions.toReversed())
            view = engine.undoProcessedAction({ state: view, action: record })
        expect(view).toEqual(projectState(before, spectator))
    })

    it.each([Ruleset.FirstEdition, Ruleset.SecondEdition])(
        'protects fishing entropy and publishes outcomes in %s',
        (ruleset) => {
            for (const lessluckFishing of [false, true]) {
                const config = { ...game.config, ruleset, lessluckFishing }
                const { state, action } = fishingState()
                const publicBefore = structuredClone(state.prng)
                const roll = new HydratedFish(action)
                roll.apply(state, new MachineContext({ gameState: state, gameConfig: config }))
                expect(state.prng).toEqual(publicBefore)
                expect(state.protectedPrng?.invocations).toBe(1)
                expect(roll.revealsInfo).toBe(true)
                expect(
                    KaivaiRuntime.visibility.actions.project(roll.dehydrate(), spectator)
                ).toMatchObject({ metadata: roll.metadata })
                const projected = projectState(fishingState().state.dehydrate(), owner)
                expect(() =>
                    engine.executeAction({
                        game: { ...game, config },
                        state: projected,
                        action,
                        perspective: owner
                    })
                ).toThrow(Visibility.UnavailableProjectedValueError)
            }
        }
    )

    it.each([1, 2])('retains historical public dice in version %i', (version) => {
        const { state, action } = fishingState(version)
        const expectedPrng = new Prng(structuredClone(state.prng))
        const expected = expectedPrng.randInt(6) < 5
        const before = state.prng.invocations
        const roll = new HydratedFish(action)
        roll.apply(state, new MachineContext({ gameState: state, gameConfig: game.config }))
        expect(roll.metadata.dieResults).toEqual([expected])
        expect(state.prng.invocations).toBe(before + 1)
        expect(state.protectedPrng).toBeUndefined()
    })

    it('keeps luckless fishing deterministic and executable without private entropy', () => {
        const { state, action } = fishingState()
        const projected = projectState(state.dehydrate(), owner)
        const config = { ...game.config, lucklessFishing: true }
        const guarded = KaivaiRuntime.visibility.state.guardForExecution(
            KaivaiRuntime.hydrator.hydrateState(projected),
            owner
        )
        const roll = new HydratedFish(action)
        roll.apply(guarded, new MachineContext({ gameState: guarded, gameConfig: config }))
        expect(roll.metadata.numFish).toBe(1)
        expect(roll.metadata.dieResults).toEqual([])
        expect(roll.revealsInfo).not.toBe(true)
    })
})
