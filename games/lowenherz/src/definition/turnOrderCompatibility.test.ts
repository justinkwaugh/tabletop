import {
    ActionSource,
    assert,
    assertExists,
    GameEngine,
    PlayerStatus,
    type GameAction
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { Definition } from './definition.js'
import { LowenherzRuntime } from './runtime.js'
import { MachineState } from './states.js'
import { ActionType } from './actions.js'
import { ActionCardType } from './actionCards.js'
import type { DrawActionCard } from '../actions/drawActionCard.js'
import type { ChooseAction } from '../actions/chooseAction.js'
import {
    LowenherzGameStateValidator,
    type LowenherzGameState,
    type LowenherzProjectedState
} from '../model/gameState.js'

const engine = new GameEngine(LowenherzRuntime)

function startedAtStartOfTurn() {
    const game = LowenherzRuntime.initializer.initializeGame(
        {
            id: 'turn-order-compatibility',
            typeId: Definition.info.id,
            ownerId: 'owner',
            config: { playerPlacedCastles: false },
            players: ['p0', 'p1', 'p2'].map((id) => ({
                id,
                name: id,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
    const { initialState, startedGame } = engine.startGame(game, {
        masterSeed: '0123456789abcdef0123456789abcdef',
        startingPositions: { playerIds: ['p0', 'p1', 'p2'] }
    })
    expect(initialState.machineState).toBe(MachineState.StartOfTurn)

    const state = LowenherzRuntime.hydrator.hydrateState(initialState)
    const deck = state.getActionDeck()
    const standardIndex = deck.findIndex((card) => card.type === ActionCardType.Standard)
    deck.unshift(...deck.splice(standardIndex, 1))
    state.actionDeckBacks = deck.map((card) => card.back)
    return { game: startedGame, state }
}

// The second round of a game: p1 holds the first player castle.
function secondRound() {
    const { game, state } = startedAtStartOfTurn()
    state.turnManager.newFirstPlayer('p1')
    state.activePlayerIds = ['p1']
    const current = state.dehydrate()
    const stored: LowenherzProjectedState = {
        ...structuredClone(current),
        turnManager: { ...structuredClone(current.turnManager), turnOrder: ['p0', 'p1', 'p2'] }
    }
    Object.assign(stored, { turnOrder: ['p0', 'p1', 'p2'], firstPlayerId: 'p1' })
    return { game, current, stored }
}

function canonicalState(state: LowenherzProjectedState): LowenherzGameState {
    assert(LowenherzGameStateValidator.Check(state), 'Expected canonical state')
    return state
}

function draw(playerId: string): DrawActionCard {
    return {
        id: 'draw',
        gameId: 'turn-order-compatibility',
        source: ActionSource.User,
        type: ActionType.DrawActionCard,
        playerId
    }
}

function choose(id: string, playerId: string, slot: 1 | 2 | 3): ChooseAction {
    return {
        id,
        gameId: 'turn-order-compatibility',
        source: ActionSource.User,
        type: ActionType.ChooseAction,
        playerId,
        slot
    }
}

function playOpening(state: LowenherzProjectedState, game: ReturnType<typeof secondRound>['game']) {
    const processed: GameAction[] = []
    let next = state
    for (const action of [draw('p1'), choose('c1', 'p1', 1), choose('c2', 'p1', 2)]) {
        const result = engine.executeAction({ game, state: next, action })
        processed.push(...result.processedActions)
        next = result.updatedState
    }
    return { processed, state: next }
}

function withoutPatches(actions: GameAction[]) {
    return actions.map(
        ({ undoPatch: _undo, forwardPatch: _forward, createdAt: _at, ...rest }) => rest
    )
}

describe('turn order stored outside the turn manager', () => {
    it('loads with the first player castle and seating on the turn manager', () => {
        const { stored, current } = secondRound()

        const loaded = LowenherzRuntime.hydrator.hydrateState(stored)

        expect(loaded.firstPlayerId).toBe('p1')
        expect(loaded.turnOrder).toEqual(['p1', 'p2', 'p0'])
        expect(loaded.turnManager.turnOrder).toEqual(['p1', 'p2', 'p0'])
        expect(loaded.dehydrate()).toEqual(current)
    })

    it('continues identically from a stored state and its current representation', () => {
        const { game, stored, current } = secondRound()

        const fromStored = playOpening(stored, game)
        const fromCurrent = playOpening(current, game)

        expect(fromStored.state).toEqual(fromCurrent.state)
        expect(withoutPatches(fromStored.processed)).toEqual(withoutPatches(fromCurrent.processed))
        expect(fromStored.state.activePlayerIds).toEqual(['p2'])
    })

    it('undoes back to the exact stored state', () => {
        const { game, stored } = secondRound()
        const result = engine.executeAction({ game, state: stored, action: draw('p1') })
        const [action] = result.processedActions

        expect(engine.undoProcessedAction({ action, state: result.updatedState })).toEqual(stored)
    })

    it('reads the first player from a stored-format undo applied to the current representation', () => {
        const { current } = secondRound()
        const partlyUndone = structuredClone(current)
        Object.assign(partlyUndone, { firstPlayerId: 'p0' })

        const loaded = LowenherzRuntime.hydrator.hydrateState(partlyUndone)

        expect(loaded.firstPlayerId).toBe('p0')
        expect(loaded.turnManager.turnOrder).toEqual(['p0', 'p1', 'p2'])
    })

    it('projects a stored state as its current representation', () => {
        const { game, stored, current } = secondRound()
        const visibility = LowenherzRuntime.visibility
        assertExists(visibility)
        const perspective = { kind: 'player', playerId: 'p0' } as const
        const context = { config: game.config }

        expect(visibility.state.project(canonicalState(stored), perspective, context)).toEqual(
            visibility.state.project(canonicalState(current), perspective, context)
        )
    })
})
