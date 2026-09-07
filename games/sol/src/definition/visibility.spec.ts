import {
    ActionSource,
    addToChecksum,
    assertExists,
    GameEngine,
    GameStatus,
    getPrng,
    MachineContext,
    PlayerStatus,
    Visibility,
    type Game,
    type GameAction
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { SolRuntime } from './runtime.js'
import { ActionType } from './actions.js'
import { MachineState } from './states.js'
import { SolActionSchemas } from './actionSchemas.js'
import { SolGameStateValidator, type SolGameState } from '../model/gameState.js'
import { Suit } from '../components/cards.js'
import { isDrawCards, type DrawCards } from '../actions/drawCards.js'
import { type ChooseCard } from '../actions/chooseCard.js'
import { HydratedActivate, type Activate } from '../actions/activate.js'
import { EffectColor, EffectType } from '../components/effects.js'
import { StationType } from '../components/stations.js'
import { Ring } from '../utils/solGraph.js'

const game: Game = {
    id: 'sol-visibility',
    typeId: 'sol',
    status: GameStatus.Started,
    isPublic: false,
    deleted: false,
    ownerId: 'owner',
    name: 'Sol visibility',
    players: ['p1', 'p2', 'p3'].map((id) => ({
        id,
        name: id,
        isHuman: true,
        status: PlayerStatus.Joined
    })),
    config: {},
    hotseat: false,
    winningPlayerIds: [],
    createdAt: new Date(0),
    seed: 101
}
const engine = new GameEngine(SolRuntime)
const spectator = { kind: 'spectator' } as const

function initialize(systemVersion = 3, protectedSeed = 123) {
    const state = new GameEngine({
        ...SolRuntime,
        randomnessVersion: undefined
    }).generateUninitializedState(game)
    state.id = 'sol-state'
    state.systemVersion = systemVersion
    if (systemVersion < 3) delete state.protectedPrng
    else state.protectedPrng = { seed: protectedSeed, invocations: 0 }
    return SolRuntime.initializer.initializeGameState(game, state).dehydrate()
}

function prepareDraw(suits: Suit[], version = 3) {
    const state = SolRuntime.hydrator.hydrateState(initialize(version))
    SolRuntime.stateHandlers[MachineState.StartOfTurn].enter(
        new MachineContext({ gameConfig: {}, gameState: state })
    )
    const cards = suits.map((suit) => {
        const index = state.deck.items.findIndex((card) => card.suit === suit)
        expect(index).toBeGreaterThanOrEqual(0)
        return state.deck.items.splice(index, 1)[0]
    })
    state.deck.items.push(...cards)
    state.machineState = MachineState.DrawingCards
    state.cardsToDraw = cards.length
    const action: DrawCards = {
        id: 'draw',
        gameId: game.id,
        playerId: state.activePlayerIds[0],
        source: ActionSource.User,
        type: ActionType.DrawCards,
        revealsInfo: true
    }
    return { state: state.dehydrate(), action }
}

function populate(state: SolGameState, actions: readonly GameAction[], seed = 1234) {
    return SolRuntime.exploration.createFromProjectedState({
        game,
        state,
        actions,
        perspective: spectator,
        random: getPrng(seed)
    })
}

function projectHistory(state: SolGameState, actions: readonly GameAction[]) {
    return Visibility.projectActionHistory({
        currentState: state,
        actions,
        visibility: SolRuntime.visibility,
        perspective: spectator,
        replay: { game, runtime: SolRuntime }
    })
}

describe('Sol visibility', () => {
    it('reproduces canonical setup from a master seed and conceals it in projections', () => {
        const masterSeed = '0123456789abcdef0123456789abcdef'
        const initialize = () => {
            const state = engine.generateUninitializedState(game, masterSeed)
            state.id = 'reproduction-state'
            return SolRuntime.initializer.initializeGameState(game, state).dehydrate()
        }
        const first = initialize()
        expect(initialize()).toEqual(first)
        expect(first.protectedPrng).toMatchObject({ algorithm: 'chacha20-v1' })
        expect(
            SolRuntime.visibility.state.project(first, { kind: 'spectator' })
        ).not.toHaveProperty('masterSeed')
    })

    it.each([1, 2])('preserves version %i initialization and forward play', (version) => {
        const state = initialize(version)
        expect(state.prng).toEqual({ seed: 101, invocations: 5215 })
        expect(addToChecksum(0, [JSON.stringify({ ...state, systemVersion: 1 })])).toBe(1017074196)
        expect(state.protectedPrng).toBeUndefined()
        const result = engine.executeCanonicalAction({
            game,
            ...prepareDraw([Suit.Flare], version)
        })
        expect(result.updatedState.systemVersion).toBe(version)
        expect(result.updatedState.protectedPrng).toBeUndefined()
        expect(result.updatedState.instability).toBe(12)
    })

    it('changes only hidden setup when protected entropy changes', () => {
        const first = initialize(3, 123)
        const second = initialize(3, 456)
        expect(first.deck.items).not.toEqual(second.deck.items)
        expect(first.protectedPrng?.invocations).toBeGreaterThan(0)
        expect(SolRuntime.visibility.state.project(first, spectator)).toEqual(
            SolRuntime.visibility.state.project(second, spectator)
        )
        expect(initialize(3, 123)).toEqual(first)
    })

    it.each([2, 3])(
        'does not mutate version %i state when discovering Motivate activations',
        (version) => {
            const initial = initialize(version)
            const state = SolRuntime.hydrator.hydrateState(initial)
            const player = state.players[0]
            const coords = { row: Ring.Outer, col: 0 }
            player.card = { id: 'motivate-card', suit: Suit.Refraction }
            state.effects[Suit.Refraction] = { type: EffectType.Motivate, color: EffectColor.Blue }
            state.board.addStationAt(
                { id: 'station', playerId: player.playerId, type: StationType.EnergyNode },
                coords
            )
            const before = structuredClone(state.dehydrate())
            expect(HydratedActivate.canActivateStationAt(state, player.playerId, coords)).toBe(
                false
            )
            expect(state.dehydrate()).toEqual(before)
        }
    )

    it('keeps one activation per player while activating successive stations', () => {
        let state = SolRuntime.hydrator.hydrateState(initialize(2))
        SolRuntime.stateHandlers[MachineState.StartOfTurn].enter(
            new MachineContext({ gameConfig: {}, gameState: state })
        )
        state.machineState = MachineState.Activating
        const player = state.getPlayerState(state.activePlayerIds[0])
        for (const col of [0, 1, 2]) {
            const coords = { row: Ring.Outer, col }
            state.board.addStationAt(
                { id: `station-${col}`, playerId: player.playerId, type: StationType.EnergyNode },
                coords
            )
            state.board.addSundiversToCell(player.holdSundivers.splice(0, 1), coords)
        }
        for (const col of [0, 1]) {
            const action: Activate = {
                id: `activate-${col}`,
                gameId: game.id,
                type: ActionType.Activate,
                source: ActionSource.User,
                playerId: player.playerId,
                stationId: `station-${col}`,
                coords: { row: Ring.Outer, col }
            }
            const result = engine.executeCanonicalAction({
                game,
                state: state.dehydrate(),
                action
            })
            state = SolRuntime.hydrator.hydrateState(result.updatedState)
        }
        expect(state.activations).toHaveLength(1)
        expect(state.activations?.[0].activatedIds).toEqual(['station-0', 'station-1'])
    })

    it('conceals the future deck and entropy for every ordinary perspective', () => {
        const { state } = prepareDraw([Suit.Flare])
        const card = state.deck.items[0]
        state.players[0].card = card
        state.players[0].drawnCards = [card]
        for (const perspective of [
            spectator,
            ...game.players.map((player) => ({ kind: 'player', playerId: player.id }) as const)
        ]) {
            const view = SolRuntime.visibility.state.project(state, perspective)
            expect(view.deck).toEqual({ items: [], remaining: state.deck.remaining })
            expect(view.protectedPrng).toEqual({ seed: 0, invocations: 0 })
            expect(view.players[0].card).toEqual(card)
            expect(view.players[0].drawnCards).toEqual([card])
            expect(SolRuntime.hydrator.hydrateState(view).dehydrate()).toEqual(view)
        }
        expect(state.deck.items).toHaveLength(65)
        expect(Object.keys(SolActionSchemas).sort()).toEqual(Object.values(ActionType).sort())
    })

    it('discovers draws from public data but rejects local access to the hidden deck', () => {
        const { state, action } = prepareDraw([Suit.Flare])
        const protectedGame: Game = { ...game, protectedInformation: true }
        const perspective = { kind: 'player', playerId: action.playerId } as const
        const view = SolRuntime.visibility.state.project(state, perspective)
        expect(
            engine.getValidActionTypesForPlayer(protectedGame, view, action.playerId, {
                perspective
            })
        ).toContain(ActionType.DrawCards)
        expect(() =>
            engine.executeAction({ game: protectedGame, state: view, action, perspective })
        ).toThrow(Visibility.UnavailableProjectedValueError)
        expect(view.deck.items).toEqual([])
        expect(view.deck.remaining).toBe(65)
    })

    it('delivers public draw and flare results with safe, reversible history patches', () => {
        const { state, action } = prepareDraw([Suit.Flare, Suit.Flare])
        const result = engine.executeCanonicalAction({ game, state, action })
        expect(result.processedActions.map((action) => action.type)).toEqual([
            ActionType.DrawCards,
            ActionType.SolarFlare,
            ActionType.SolarFlare
        ])
        const history = projectHistory(result.updatedState, result.processedActions)
        const draw = history.actions[0]
        expect(isDrawCards(draw) && draw.metadata?.drawnCards.map((card) => card.suit)).toEqual([
            Suit.Flare,
            Suit.Flare
        ])
        expect(draw.revealsInfo).toBe(true)
        expect(draw.forwardPatch).toBeDefined()
        expect(history.actions.every((action) => action.type !== 'tabletop.redacted-action')).toBe(
            true
        )
        const encoded = JSON.stringify(history)
        for (const card of result.updatedState.deck.items) expect(encoded).not.toContain(card.id)
        let view = history.currentState
        for (const record of history.actions.toReversed())
            view = engine.undoProcessedAction({ state: view, action: record })
        expect(view).toEqual(SolRuntime.visibility.state.project(state, spectator))
        for (const record of history.actions)
            view = engine.applyProcessedAction({ game, state: view, action: record })
        expect(view).toEqual(history.currentState)
    })

    it('keeps card choice public and executable from a player projection', () => {
        const suit = initialize().deck.items.find((card) => card.suit !== Suit.Flare)?.suit
        assertExists(suit, 'Expected a non-flare suit')
        const { state, action } = prepareDraw([suit])
        const result = engine.executeCanonicalAction({ game, state, action })
        const perspective = { kind: 'player', playerId: action.playerId } as const
        const choice: ChooseCard = {
            id: 'choose',
            gameId: game.id,
            source: ActionSource.User,
            type: ActionType.ChooseCard,
            playerId: action.playerId,
            suit
        }
        const canonical = engine.executeCanonicalAction({
            game,
            state: result.updatedState,
            action: choice
        })
        const optimistic = engine.executeAction({
            game,
            state: SolRuntime.visibility.state.project(result.updatedState, perspective),
            action: choice,
            perspective
        })
        expect(optimistic.updatedState).toEqual(
            SolRuntime.visibility.state.project(canonical.updatedState, perspective)
        )
        expect(
            SolRuntime.visibility.actions.project(canonical.processedActions[0], spectator)
        ).toMatchObject({ suit })
    })

    it('populates from the permitted history, preserving suit counts and visible cards', () => {
        const source = prepareDraw([Suit.Flare, Suit.Flare])
        const result = engine.executeCanonicalAction({ game, ...source })
        const history = projectHistory(result.updatedState, result.processedActions)
        const view = structuredClone(history.currentState)
        const sample = populate(view, history.actions)
        expect(view).toEqual(history.currentState)
        expect(sample.players).toEqual(view.players)
        expect(sample.deck.items).toHaveLength(63)
        for (const suit of Object.keys(sample.effects))
            expect(sample.deck.items.filter((card) => card.suit === suit)).toHaveLength(
                suit === Suit.Flare ? 11 : 13
            )
        expect(SolGameStateValidator.Check(sample)).toBe(true)
        expect(populate(view, history.actions)).toEqual(sample)
        expect(populate(view, history.actions, 4321).deck.items).not.toEqual(sample.deck.items)
        const otherWorld = structuredClone(result.updatedState)
        otherWorld.deck.items.reverse()
        otherWorld.protectedPrng = { seed: 987, invocations: 500 }
        expect(
            populate(SolRuntime.visibility.state.project(otherWorld, spectator), history.actions)
        ).toEqual(sample)
        const initialView = SolRuntime.visibility.state.project(source.state, spectator)
        expect(
            populate(initialView, []).deck.items.filter((card) => card.suit === Suit.Flare)
        ).toHaveLength(13)
        expect(() => populate(view, [])).toThrow('card count')
    })

    it('does not subtract the squeezed-card snapshot as a second draw', () => {
        const result = engine.executeCanonicalAction({ game, ...prepareDraw([Suit.Flare]) })
        const record = result.processedActions[0]
        if (!isDrawCards(record) || !record.metadata) throw Error('Expected draw metadata')
        record.metadata.squeezedCards = structuredClone(record.metadata.drawnCards)
        const view = SolRuntime.visibility.state.project(result.updatedState, spectator)
        expect(populate(view, [record]).deck.items).toHaveLength(64)
        expect(() => populate(view, [record, record])).toThrow('repeated card draw')
        delete record.metadata
        expect(() => populate(view, [record])).toThrow('revealed draw outcomes')
    })

    it('populates after the complete draw cascade, preserving its revealed consequences', () => {
        const result = engine.executeCanonicalAction({
            game,
            ...prepareDraw([Suit.Flare, Suit.Flare])
        })
        const history = projectHistory(result.updatedState, result.processedActions)
        const sample = populate(history.currentState, history.actions)
        expect(sample.instability).toBe(result.updatedState.instability)
        expect(sample.players).toEqual(history.currentState.players)
        expect(sample.machineState).toBe(result.updatedState.machineState)
        expect(sample.actionCount).toBe(result.updatedState.actionCount)
        expect(sample.deck.remaining).toBe(result.updatedState.deck.remaining)
    })

    it('retains host exploration and supports an exhausted hypothetical deck', () => {
        const state = initialize()
        const before = structuredClone(state)
        const host = SolRuntime.exploration.createFromCanonicalState(state)
        expect(host.deck.items.toSorted((a, b) => a.id.localeCompare(b.id))).toEqual(
            before.deck.items.toSorted((a, b) => a.id.localeCompare(b.id))
        )
        expect(state).toEqual(before)
        const result = engine.executeCanonicalAction({
            game,
            ...prepareDraw(state.deck.items.map((card) => card.suit))
        })
        const history = projectHistory(result.updatedState, result.processedActions)
        expect(populate(history.currentState, history.actions).deck).toEqual({
            items: [],
            remaining: 0
        })
    })
})
