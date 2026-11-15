import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    GameEngine,
    GameResult,
    PlayerStatus,
    Visibility,
    assert,
    assertExists,
    reportGameProgress,
    type Game,
    type GameAction
} from '@tabletop/common'
import {
    HydratedMedinaGameState,
    MedinaGameStateValidator,
    type MedinaProjectedState
} from '../model/gameState.js'
import { legalActions } from '../testing/legalActions.js'
import { ActionType } from './actions.js'
import { Definition } from './definition.js'
import { MedinaRuntime } from './runtime.js'
import { MachineState } from './states.js'

const engine = new GameEngine(MedinaRuntime)
const masterSeed = '0123456789abcdef0123456789abcdef'
const spectator = { kind: 'spectator' } as const
const STOCK_FIELDS = ['buildings', 'stables', 'merchants', 'walls']

function createGame(hiddenPieces: boolean, count = 3) {
    const game = MedinaRuntime.initializer.initializeGame(
        {
            id: 'medina-visibility',
            typeId: Definition.info.id,
            ownerId: 'owner',
            seed: 23,
            config: { hiddenPieces, teaTiles: true },
            players: Array.from({ length: count }, (_, index) => ({
                id: `p${index}`,
                name: `Player ${index}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
    const started: Game = { ...game, protectedInformation: true }
    return started
}

function userAction(state: MedinaProjectedState, step: number, move: Record<string, unknown>) {
    const [playerId] = state.activePlayerIds
    assertExists(playerId, 'A running game has an acting player')
    return {
        id: `v${step}`,
        gameId: state.gameId,
        source: ActionSource.User,
        playerId,
        type: ActionType.PlaceWall,
        ...move
    }
}

function playToTheEnd(hiddenPieces: boolean, onState: (state: MedinaProjectedState) => void) {
    const game = createGame(hiddenPieces)
    let { initialState: state } = engine.startGame(game, { masterSeed })
    const actions: GameAction[] = []
    onState(state)
    for (let step = 0; state.machineState !== MachineState.EndOfGame; step++) {
        expect(step).toBeLessThan(1000)
        const moves = legalActions(state)
        const result = engine.executeCanonicalAction({
            game,
            state,
            action: userAction(state, step, moves[(step * 7) % moves.length])
        })
        state = result.updatedState
        actions.push(...result.processedActions)
        onState(state)
    }
    return { game, state, actions }
}

function project(
    state: MedinaProjectedState,
    hiddenPieces: boolean,
    perspective: Visibility.Perspective
) {
    assert(MedinaGameStateValidator.Check(state), 'Expected complete state')
    return MedinaRuntime.visibility.state.project(state, perspective, {
        config: { hiddenPieces, teaTiles: true }
    })
}

describe('Medina supplies', () => {
    it('with Hidden pieces, reach only their owner until the game ends', () => {
        let checked = 0
        let teaTilesSeen = 0
        playToTheEnd(true, (state) => {
            teaTilesSeen = Math.max(teaTilesSeen, ...state.players.map((p) => p.teaTiles))
            const ended = state.machineState === MachineState.EndOfGame
            for (const perspective of [
                spectator,
                ...state.players.map(({ playerId }) => ({ kind: 'player' as const, playerId }))
            ]) {
                const view = project(state, true, perspective)
                expect(() => new HydratedMedinaGameState(view)).not.toThrow()
                for (const [index, player] of view.players.entries()) {
                    const entitled =
                        ended ||
                        (perspective.kind === 'player' && perspective.playerId === player.playerId)
                    for (const field of STOCK_FIELDS) {
                        expect(field in player).toBe(entitled)
                    }
                    expect(player.rooftops).toBe(state.players[index].rooftops)
                    expect(player.neutralRooftops).toBe(state.players[index].neutralRooftops)
                    expect(player.teaTiles).toBe(state.players[index].teaTiles)
                }
                checked += 1
            }
        })
        expect(checked).toBeGreaterThan(100)
        expect(teaTilesSeen).toBeGreaterThan(0)
    })

    it('stay hidden when a game ends without being played out', () => {
        const { initialState } = engine.startGame(createGame(true), { masterSeed })
        const called = { ...initialState, result: GameResult.Draw }
        const [first, second] = project(called, true, {
            kind: 'player',
            playerId: called.players[0].playerId
        }).players
        expect('stables' in first).toBe(true)
        expect('stables' in second).toBe(false)
    })

    it('stay open to everyone without the option', () => {
        playToTheEnd(false, (state) => {
            const view = project(state, false, spectator)
            expect(view.players).toEqual(state.players)
        })
    })

    it('let a player place their own pieces locally, and defer to the host for the next turn', () => {
        const game = createGame(true)
        let { initialState: state } = engine.startGame(game, { masterSeed })
        // The opening turns place one piece; run past them to a two-piece turn.
        for (let step = 0; state.turn?.placementsLeft !== 2; step++) {
            const moves = legalActions(state)
            state = engine.executeCanonicalAction({
                game,
                state,
                action: userAction(state, step, moves[0])
            }).updatedState
        }
        const playerId = state.activePlayerIds[0]
        const perspective = { kind: 'player', playerId } as const
        let view = project(state, true, perspective)
        expect(
            engine.getValidActionTypesForPlayer(game, view, playerId, { perspective })
        ).toContain(ActionType.PlaceWall)
        const wall = { type: ActionType.PlaceWall }
        const firstMove = legalActions(state).find((move) => move.type === wall.type)
        assertExists(firstMove, 'Expected an open wall')
        const first = engine.executeAction({
            game,
            state: view,
            action: userAction(state, 900, firstMove),
            perspective
        })
        view = first.updatedState
        state = engine.executeCanonicalAction({
            game,
            state,
            action: userAction(state, 900, firstMove)
        }).updatedState
        const secondMove = legalActions(state).find((move) => move.type === wall.type)
        assertExists(secondMove, 'Expected a second open wall')
        expect(() =>
            engine.executeAction({
                game,
                state: view,
                action: userAction(state, 901, secondMove),
                perspective
            })
        ).toThrow(Visibility.UnavailableProjectedValueError)
    })

    it('do not reach the reported progress', () => {
        const { initialState } = engine.startGame(createGame(true), { masterSeed })
        const progress = reportGameProgress(MedinaRuntime, initialState)
        expect(progress?.label).toMatch(/placed$/)
        expect(progress?.final).toBeUndefined()
        const open = reportGameProgress(
            MedinaRuntime,
            engine.startGame(createGame(false), { masterSeed }).initialState
        )
        expect(open?.label).toMatch(/left$/)
    })

    it('rule out Exploration only with Hidden pieces', () => {
        const exploration = MedinaRuntime.exploration
        const hidden = createGame(true)
        const hiddenState = engine.startGame(hidden, { masterSeed }).initialState
        expect(() => exploration.createFromCanonicalState(hiddenState)).toThrow()
        expect(() =>
            exploration.createFromProjectedState({
                game: hidden,
                state: project(hiddenState, true, spectator),
                actions: [],
                perspective: spectator,
                random: () => 0
            })
        ).toThrow()
        const open = createGame(false)
        const openState = engine.startGame(open, { masterSeed }).initialState
        expect(exploration.createFromCanonicalState(openState)).toBe(openState)
        const view = project(openState, false, spectator)
        expect(
            exploration.createFromProjectedState({
                game: open,
                state: view,
                actions: [],
                perspective: spectator,
                random: () => 0
            }).players
        ).toEqual(openState.players)
    })
})
