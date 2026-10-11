import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    BaseGameInitializer,
    Color,
    GameResult,
    GameState,
    GameStatus,
    HydratableAction,
    HydratableGameState,
    PlayerAction,
    PlayerState,
    TerminalStateHandler,
    assertExists,
    type Game,
    type GameAction,
    type GameInfo,
    type GameRuntime,
    type MachineContext,
    type UninitializedGameState
} from '@tabletop/common'
import { describe, expect, test, vi } from 'vitest'
import { runHarnessScenario, type HarnessScenario } from './harnessScenarios.js'
import { MemoryScenarioGames, recordHarnessScenario } from './harnessScenarioPlayer.js'
import {
    recordGame,
    recordedScenarios,
    type HarnessScenarioRecording
} from './harnessScenarioRecording.js'

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

const countdown = { info: countdownInfo, runtime: async () => countdownRuntime }

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

const owner = { id: 'developer', name: 'Developer' }

describe('runHarnessScenario', () => {
    test('saves the game record as a played game would leave it', async () => {
        const gameService = new MemoryScenarioGames({
            info: countdownInfo,
            runtime: countdownRuntime
        })
        const game = await runHarnessScenario({
            scenario: scenario(1),
            definition: countdown,
            gameService,
            owner
        })

        const saved = gameService.played
        assertExists(saved)
        expect(saved.game).toBe(game)
        expect(saved.actions).toHaveLength(2)
        expect(game.status).toBe(GameStatus.Started)
        expect(game.activePlayerIds).toEqual(saved.state.activePlayerIds)
        expect(game.lastActionAt).toEqual(saved.actions.at(-1)?.createdAt)
        expect(game.lastActionPlayerId).toBe(saved.actions.at(-1)?.playerId)
    })

    test('records the result when a scenario ends at the end of the game', async () => {
        const gameService = new MemoryScenarioGames({
            info: countdownInfo,
            runtime: countdownRuntime
        })
        const game = await runHarnessScenario({
            scenario: scenario(0),
            definition: countdown,
            gameService,
            owner
        })

        expect(game.status).toBe(GameStatus.Finished)
        expect(game.result).toBe(GameResult.Win)
        expect(game.winningPlayerIds).toEqual([game.players[0].id])
        expect(game.finishedAt).toBeInstanceOf(Date)
    })

    test('fails when the game ends before the scenario reaches its state', async () => {
        const gameService = new MemoryScenarioGames({
            info: countdownInfo,
            runtime: countdownRuntime
        })
        await expect(
            runHarnessScenario({
                scenario: scenario(-1),
                definition: countdown,
                gameService,
                owner
            })
        ).rejects.toThrow('Scenario count-to--1 ended the game before reaching its state')
        expect(gameService.played).toBeUndefined()
    })
})

async function playAndRecord(runtime: typeof countdownRuntime) {
    const gameService = new MemoryScenarioGames({ info: countdownInfo, runtime })
    await runHarnessScenario({
        scenario: scenario(1),
        definition: { info: countdownInfo, runtime: async () => runtime },
        gameService,
        owner
    })
    const saved = gameService.played
    assertExists(saved)
    const recording = recordGame({
        id: 'one-left',
        label: 'One left',
        description: 'The countdown shows one',
        recordedWith: countdownInfo.metadata.version,
        ...saved
    })
    return { saved, recording }
}

async function replay(recording: unknown, runtime: typeof countdownRuntime) {
    const [recorded] = recordedScenarios({ 'one-left.json': recording })
    assertExists(recorded)
    const gameService = new MemoryScenarioGames({ info: countdownInfo, runtime })
    await runHarnessScenario({
        scenario: recorded,
        definition: { info: countdownInfo, runtime: async () => runtime },
        gameService,
        owner
    })
    assertExists(gameService.played)
    return gameService.played
}

describe('scenario recordings', () => {
    test.each([
        ['a legacy seed', countdownRuntime],
        ['a reproduction seed', seededRuntime]
    ])('replay a recorded game with %s to the same game', async (_seedKind, runtime) => {
        const { saved, recording } = await playAndRecord(runtime)
        expect(recording.moves).toEqual(
            saved.actions.map((action) => ({
                id: action.id,
                type: 'step',
                playerId: action.playerId
            }))
        )

        const replayed = await replay(JSON.parse(JSON.stringify(recording)), runtime)

        expect(replayed.game.seed).toBe(saved.game.seed)
        expect(replayed.state.masterSeed).toBe(saved.state.masterSeed)
        expect(replayed.game.players.map((player) => player.id)).toEqual(
            saved.game.players.map((player) => player.id)
        )
        expect(replayed.state.actionChecksum).toBe(saved.state.actionChecksum)
        expect(replayed.state.activePlayerIds).toEqual(saved.state.activePlayerIds)
    })

    test('records a reproduction seed when the game has one', async () => {
        const { recording } = await playAndRecord(seededRuntime)
        expect(recording.seed).toEqual({ masterSeed: expect.any(String) })
    })

    test('leaves out a file that is not a recording', () => {
        const report = vi.spyOn(console, 'error').mockImplementation(() => {})
        expect(recordedScenarios({ 'old.json': { format: 2 } })).toEqual([])
        expect(report).toHaveBeenCalledOnce()
        report.mockRestore()
    })

    test('names the move a recording can no longer play', async () => {
        const { recording } = await playAndRecord(countdownRuntime)
        const broken: HarnessScenarioRecording = {
            ...recording,
            moves: [recording.moves[0], { type: 'jump', playerId: recording.seats[0].id }]
        }
        await expect(replay(broken, countdownRuntime)).rejects.toThrow(
            'Scenario one-left move 2 (jump) was rejected'
        )
    })

    test('records a coded scenario without a browser', async () => {
        const recording = await recordHarnessScenario({
            scenario: scenario(1),
            title: { info: countdownInfo, runtime: seededRuntime }
        })

        expect(recording).toMatchObject({
            id: 'count-to-1',
            label: 'Count to 1',
            recordedWith: '1.0.0'
        })
        expect(recording.moves).toHaveLength(2)
        const replayed = await replay(recording, seededRuntime)
        expect(replayed.state.actionCount).toBe(2)
    })
})
