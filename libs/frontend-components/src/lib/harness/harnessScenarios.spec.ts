import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    BaseGameInitializer,
    Color,
    GameEngine,
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
import { describe, expect, test } from 'vitest'
import { runHarnessScenario, type HarnessScenario } from './harnessScenarios.js'

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

class RecordingGameService {
    readonly games = new Map<string, Game>()
    saved: { game: Game; state: GameState; actions: GameAction[] } | undefined

    async createGame(partial: Partial<Game>): Promise<Game> {
        const engine = new GameEngine(countdownRuntime)
        const initialized = countdownRuntime.initializer.initializeGame(partial, {
            info: countdownInfo,
            runtime: countdownRuntime
        })
        const { startedGame, initialState } = engine.startGame(initialized)
        const game = { ...startedGame, state: initialState }
        this.games.set(game.id, game)
        return game
    }

    async loadGame(gameId: string) {
        return { game: this.games.get(gameId), actions: [] }
    }

    async saveGameLocally(saved: { game: Game; state: GameState; actions: GameAction[] }) {
        this.saved = saved
    }
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
        const gameService = new RecordingGameService()
        const game = await runHarnessScenario({
            scenario: scenario(1),
            definition: countdown,
            gameService,
            owner
        })

        const saved = gameService.saved
        assertExists(saved)
        expect(saved.game).toBe(game)
        expect(saved.actions).toHaveLength(2)
        expect(game.status).toBe(GameStatus.Started)
        expect(game.activePlayerIds).toEqual(saved.state.activePlayerIds)
        expect(game.lastActionAt).toEqual(saved.actions.at(-1)?.createdAt)
        expect(game.lastActionPlayerId).toBe(saved.actions.at(-1)?.playerId)
    })

    test('records the result when a scenario ends at the end of the game', async () => {
        const gameService = new RecordingGameService()
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
        const gameService = new RecordingGameService()
        await expect(
            runHarnessScenario({
                scenario: scenario(-1),
                definition: countdown,
                gameService,
                owner
            })
        ).rejects.toThrow('Scenario count-to--1 ended the game before reaching its state')
        expect(gameService.saved).toBeUndefined()
    })
})
