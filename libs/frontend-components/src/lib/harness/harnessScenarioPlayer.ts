import { nanoid } from 'nanoid'
import {
    ActionSource,
    GameEngine,
    GameStorage,
    PlayerStatus,
    assert,
    defaultGameConfig,
    normalizeGameConfig,
    type Game,
    type GameAction,
    type GameConfig,
    type GameDefinition,
    type GameState,
    type HydratedGameState
} from '@tabletop/common'
import { updatedGameRecord } from './harnessGameRecord.js'

// What to play next; the player supplies the action's game, source and time, and an id unless the
// move carries one.
export type HarnessScenarioMove = { type: string; playerId?: string } & Record<string, unknown>

// Either reproduction seed form a title accepts: a master seed, or a legacy title's number.
export type HarnessScenarioSeed = { masterSeed: string } | { seed: number }

export type HarnessScenarioProgress = { movesPlayed: number }

// A move policy that plays a new game to a state worth looking at, through the title's own rules,
// for writing into the title's scenarios folder. With a seed, every run deals the same game.
export type HarnessScenario = {
    id: string
    label: string
    description: string
    playerCount: number
    config?: GameConfig
    seed?: HarnessScenarioSeed
    isComplete(state: HydratedGameState, progress: HarnessScenarioProgress): boolean
    nextMove(state: HydratedGameState, progress: HarnessScenarioProgress): HarnessScenarioMove
}

export type PlayedHarnessScenario = { game: Game; state: GameState; actions: GameAction[] }

export type HarnessScenarioOwner = { id: string; name: string }

const MAX_MOVES = 5000
const DEVELOPER: HarnessScenarioOwner = { id: 'developer', name: 'Developer' }

// Plays a scenario's policy against a title's logic definition, without a browser, and returns the
// game as the harness would store it after those moves.
export function playHarnessScenario({
    scenario,
    title,
    owner = DEVELOPER
}: {
    scenario: HarnessScenario
    title: GameDefinition
    owner?: HarnessScenarioOwner
}): PlayedHarnessScenario {
    const { runtime, info } = title
    const engine = new GameEngine(runtime)
    const seed = scenario.seed
    const initialized = runtime.initializer.initializeGame(
        {
            id: nanoid(),
            typeId: info.id,
            name: scenario.label,
            players: Array.from({ length: scenario.playerCount }, (_, seat) => ({
                id: nanoid(),
                userId: owner.id,
                isHuman: true,
                name: seat === 0 ? owner.name : `Player ${seat + 1}`,
                status: PlayerStatus.Joined
            })),
            isPublic: false,
            hotseat: true,
            storage: GameStorage.Local,
            ownerId: owner.id,
            config: normalizeGameConfig({
                ...defaultGameConfig(info.configurator?.options ?? []),
                ...scenario.config
            }),
            ...(seed && 'seed' in seed ? { seed: seed.seed } : {})
        },
        title
    )
    const { startedGame: game, initialState } = engine.startGame(
        initialized,
        seed && 'masterSeed' in seed ? seed.masterSeed : undefined
    )

    const actions: GameAction[] = []
    const startedAt = Date.now()
    let state = initialState
    for (let movesPlayed = 0; ; movesPlayed++) {
        const hydrated = runtime.hydrator.hydrateState(state)
        const progress = { movesPlayed }
        if (scenario.isComplete(hydrated, progress)) break
        assert(!state.result, `Scenario ${scenario.id} ended the game before reaching its state`)
        assert(
            movesPlayed < MAX_MOVES,
            `Scenario ${scenario.id} did not finish within ${MAX_MOVES} moves`
        )
        const move = scenario.nextMove(hydrated, progress)
        const action: GameAction = {
            id: nanoid(),
            ...move,
            gameId: game.id,
            source: ActionSource.User,
            createdAt: new Date(startedAt + movesPlayed)
        }
        try {
            const result = engine.executeCanonicalAction({ action, state, game })
            actions.push(...result.processedActions)
            state = result.updatedState
        } catch (error) {
            const reason = error instanceof Error ? error.message : String(error)
            throw new Error(
                `Scenario ${scenario.id} move ${movesPlayed + 1} (${move.type}) was rejected: ${reason}`,
                { cause: error }
            )
        }
    }
    // Actions the engine generates take the current clock, which can run ahead of the moves'
    // synthetic dates, and titles read history order from these dates, so the whole history gets
    // increasing ones.
    actions.forEach((action, i) => {
        action.createdAt = new Date(startedAt + i)
    })

    return { game: updatedGameRecord(game, state, actions.at(-1)), state, actions }
}
