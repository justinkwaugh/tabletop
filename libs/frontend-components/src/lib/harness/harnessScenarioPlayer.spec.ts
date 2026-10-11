import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    BaseGameInitializer,
    Color,
    GameResult,
    GameState,
    GameStatus,
    GameStorage,
    HydratableAction,
    HydratableGameState,
    PlayerAction,
    PlayerState,
    TerminalStateHandler,
    type Game,
    type GameAction,
    type GameInfo,
    type GameRuntime,
    type MachineContext,
    type UninitializedGameState
} from '@tabletop/common'
import { describe, expect, test, vi } from 'vitest'
import { playHarnessScenario, type HarnessScenario } from './harnessScenarioPlayer.js'
import { listedScenarios, scenarioFile, scenarioGame } from './harnessScenarioFile.js'

const CountdownSchema = Type.Object({
    ...GameState.properties,
    remaining: Type.Number()
})
type CountdownState = Type.Static<typeof CountdownSchema>
const CountdownValidator = Compile(CountdownSchema)

class HydratedCountdownState
    extends HydratableGameState<typeof CountdownSchema, PlayerState>
    implements CountdownState
{
    declare remaining: number
    constructor(data: CountdownState) {
        super(data, CountdownValidator)
    }
}

const Step = Type.Object({ ...PlayerAction.properties, type: Type.Literal('step') })
type Step = Type.Static<typeof Step>
const StepValidator = Compile(Step)

class HydratedStep extends HydratableAction<typeof Step> {
    declare playerId: string
    constructor(data: Step) {
        super(data, StepValidator)
    }
    apply(state: HydratedCountdownState): void {
        state.remaining -= 1
    }
}

class CountdownInitializer extends BaseGameInitializer<CountdownState, HydratedCountdownState> {
    initializeGameState(game: Game, state: UninitializedGameState): HydratedCountdownState {
        const playerIds = game.players.map((player) => player.id)
        return new HydratedCountdownState({
            ...state,
            activePlayerIds: [playerIds[0]],
            machineState: 'counting',
            remaining: 3,
            players: playerIds.map((playerId, index) => ({
                playerId,
                color: [Color.Red, Color.Blue][index]
            })),
            turnManager: {
                series: [],
                turnOrder: playerIds,
                turnCounts: Object.fromEntries(playerIds.map((id) => [id, 0]))
            }
        })
    }
}

// Each step counts down by one, and the first player wins when it reaches zero.
const countdownRuntime: GameRuntime<CountdownState, HydratedCountdownState> = {
    initializer: new CountdownInitializer(),
    hydrator: {
        hydrateState: (state) => new HydratedCountdownState(state),
        hydrateAction: (action) => new HydratedStep(StepValidator.Parse(action))
    },
    canonicalStateValidator: CountdownValidator,
    playerColors: [Color.Red, Color.Blue],
    apiActions: { step: Step },
    stateHandlers: {
        counting: {
            enter() {},
            validActionsForPlayer: () => ['step'],
            isValidAction: (action: GameAction) => StepValidator.Check(action),
            onAction(_action: GameAction, context: MachineContext<HydratedCountdownState>) {
                const state = context.gameState
                if (state.remaining > 0) return 'counting'
                state.result = GameResult.Win
                state.winningPlayerIds = [state.players[0].playerId]
                return 'ended'
            }
        },
        ended: new TerminalStateHandler()
    }
}

const countdownInfo: GameInfo = {
    id: 'countdown',
    metadata: {
        name: 'Countdown',
        description: 'Harness scenario fixture',
        version: '1.0.0',
        designer: 'Tabletop',
        year: '2026',
        minPlayers: 2,
        maxPlayers: 2,
        defaultPlayerCount: 2,
        beta: true
    }
}

// The same game on a runtime that takes reproduction seeds.
const seededRuntime: GameRuntime<CountdownState, HydratedCountdownState> = {
    ...countdownRuntime,
    randomnessVersion: 1
}

function scenario(stopAt: number): HarnessScenario {
    return {
        id: `count-to-${stopAt}`,
        label: `Count to ${stopAt}`,
        description: 'Steps until the countdown shows the target',
        playerCount: 2,
        isComplete: (state) =>
            state instanceof HydratedCountdownState && state.remaining === stopAt,
        nextMove: (state) => ({ type: 'step', playerId: state.activePlayerIds[0] })
    }
}

const countdown = { info: countdownInfo, runtime: countdownRuntime }
const seededCountdown = { info: countdownInfo, runtime: seededRuntime }

describe('playHarnessScenario', () => {
    test('leaves the game record as a played game would', () => {
        const { game, state, actions } = playHarnessScenario({
            scenario: scenario(1),
            title: countdown
        })

        expect(actions).toHaveLength(2)
        expect(game.status).toBe(GameStatus.Started)
        expect(game.storage).toBe(GameStorage.Local)
        expect(game.activePlayerIds).toEqual(state.activePlayerIds)
        expect(game.lastActionAt).toEqual(actions.at(-1)?.createdAt)
        expect(game.lastActionPlayerId).toBe(actions.at(-1)?.playerId)
        const times = actions.map((action) => action.createdAt?.getTime() ?? 0)
        expect(times).toEqual(times.toSorted((a, b) => a - b))
    })

    test('records the result when a scenario ends at the end of the game', () => {
        const { game } = playHarnessScenario({ scenario: scenario(0), title: countdown })

        expect(game.status).toBe(GameStatus.Finished)
        expect(game.result).toBe(GameResult.Win)
        expect(game.winningPlayerIds).toEqual([game.players[0].id])
    })

    test('fails when the game ends before the scenario reaches its state', () => {
        expect(() => playHarnessScenario({ scenario: scenario(-1), title: countdown })).toThrow(
            'Scenario count-to--1 ended the game before reaching its state'
        )
    })

    test('names the move the game rejects', () => {
        const jumping: HarnessScenario = {
            ...scenario(0),
            nextMove: (state, { movesPlayed }) => ({
                type: movesPlayed === 1 ? 'jump' : 'step',
                playerId: state.activePlayerIds[0]
            })
        }
        expect(() => playHarnessScenario({ scenario: jumping, title: countdown })).toThrow(
            'Scenario count-to-0 move 2 (jump) was rejected'
        )
    })

    test('deals the same game from the same reproduction seed', () => {
        const seeded = { ...scenario(1), seed: { masterSeed: 'c0ffee'.padEnd(32, '0') } }
        const first = playHarnessScenario({ scenario: seeded, title: seededCountdown })
        const second = playHarnessScenario({ scenario: seeded, title: seededCountdown })

        expect(second.state.masterSeed).toBe(first.state.masterSeed)
        expect(second.game.seed).toBe(first.game.seed)
    })
})

function savedAndLoaded() {
    const played = playHarnessScenario({ scenario: scenario(1), title: countdown })
    const file = scenarioFile({
        label: 'One left',
        description: 'The countdown shows one',
        ...played
    })
    const [listed] = listedScenarios({
        '../../scenarios/one-left.json': JSON.parse(JSON.stringify(file))
    })
    return { played, listed }
}

describe('scenario files', () => {
    test('come back from JSON with their dates', () => {
        const { played, listed } = savedAndLoaded()

        expect(listed.id).toBe('one-left')
        expect(listed.scenario.label).toBe('One left')
        expect(listed.scenario.game.createdAt).toBeInstanceOf(Date)
        expect(listed.scenario.actions.map((action) => action.createdAt)).toEqual(
            played.actions.map((action) => action.createdAt)
        )
        expect(listed.scenario.state).toEqual(played.state)
    })

    test('leave out a file that is not a scenario', () => {
        const report = vi.spyOn(console, 'error').mockImplementation(() => {})
        expect(listedScenarios({ 'old.json': { format: 1, label: 'Old' } })).toEqual([])
        expect(report).toHaveBeenCalledOnce()
        report.mockRestore()
    })

    test('open as a new local game for the viewer, leaving the scenario unchanged', () => {
        const { listed } = savedAndLoaded()
        const before = structuredClone(listed.scenario)

        const { game, state, actions } = scenarioGame(listed.scenario, {
            id: 'viewer',
            name: 'Viewer'
        })

        expect(game.id).not.toBe(listed.scenario.game.id)
        expect(state.gameId).toBe(game.id)
        expect(actions.every((action) => action.gameId === game.id)).toBe(true)
        expect(game.ownerId).toBe('viewer')
        expect(game.players.every((player) => player.userId === 'viewer')).toBe(true)
        expect(game.hotseat).toBe(true)
        expect(listed.scenario).toEqual(before)
    })
})
