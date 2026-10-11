import { nanoid } from 'nanoid'
import {
    ActionSource,
    GameEngine,
    GameStorage,
    PlayerStatus,
    assert,
    assertExists,
    defaultGameConfig,
    normalizeGameConfig,
    type Game,
    type GameAction,
    type GameConfig,
    type GameInfo,
    type GameRuntime,
    type HydratedGameState,
    type Player
} from '@tabletop/common'
import type { GameService } from '$lib/services/gameService.js'
import { updatedGameRecord } from './harnessGameRecord.js'

// What to play next; the runner supplies the action's game, source and time, and an id unless the
// move carries one.
export type HarnessScenarioMove = { type: string; playerId?: string } & Record<string, unknown>

// Either reproduction seed form a title accepts: a master seed, or a legacy title's number.
export type HarnessScenarioSeed = { masterSeed: string } | { seed: number }

export type HarnessScenarioSeat = { id: string; name: string }

export type HarnessScenarioProgress = { game: Game; movesPlayed: number }

// A dev-harness shortcut to a game state worth looking at, reached by playing legal moves through
// the title's own rules, so the result has a real history. With a seed and seats, every run deals
// the same game.
export type HarnessScenario = {
    id: string
    label: string
    description: string
    playerCount: number
    config?: GameConfig
    seed?: HarnessScenarioSeed
    seats?: HarnessScenarioSeat[]
    isComplete(state: HydratedGameState, progress: HarnessScenarioProgress): boolean
    nextMove(state: HydratedGameState, progress: HarnessScenarioProgress): HarnessScenarioMove
}

const MAX_MOVES = 5000

export type HarnessScenarioOwner = { id: string; name: string }

export type HarnessScenarioTitle = {
    info: Pick<GameInfo, 'id' | 'configurator'>
    runtime(): Promise<GameRuntime>
}

export async function runHarnessScenario({
    scenario,
    definition,
    gameService,
    owner
}: {
    scenario: HarnessScenario
    definition: HarnessScenarioTitle
    gameService: Pick<GameService, 'createGame' | 'loadGame' | 'saveGameLocally'>
    owner: HarnessScenarioOwner
}): Promise<Game> {
    const seed = scenario.seed
    const created = await gameService.createGame(
        {
            id: nanoid(),
            typeId: definition.info.id,
            name: scenario.label,
            players: scenarioPlayers(scenario, owner),
            isPublic: false,
            hotseat: true,
            storage: GameStorage.Local,
            ownerId: owner.id,
            config: normalizeGameConfig({
                ...defaultGameConfig(definition.info.configurator?.options ?? []),
                ...scenario.config
            }),
            ...(seed && 'seed' in seed ? { seed: seed.seed } : {})
        },
        seed && 'masterSeed' in seed ? { masterSeed: seed.masterSeed } : undefined
    )
    const { game } = await gameService.loadGame(created.id)
    assertExists(game?.state, `Scenario ${scenario.id} could not load its new game`)

    const runtime = await definition.runtime()
    const engine = new GameEngine(runtime)
    const actions: GameAction[] = []
    const startedAt = Date.now()
    let state = game.state
    for (let movesPlayed = 0; ; movesPlayed++) {
        const hydrated = runtime.hydrator.hydrateState(state)
        const progress = { game, movesPlayed }
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
    // synthetic dates, and titles read history order from these dates, so the whole saved
    // history gets increasing ones.
    actions.forEach((action, i) => {
        action.createdAt = new Date(startedAt + i)
    })

    const played = updatedGameRecord(game, state, actions.at(-1))
    await gameService.saveGameLocally({ game: played, state, actions })
    return played
}

function scenarioPlayers(scenario: HarnessScenario, owner: HarnessScenarioOwner): Player[] {
    const seats =
        scenario.seats ??
        Array.from({ length: scenario.playerCount }, (_, seat) => ({
            id: nanoid(),
            name: seat === 0 ? owner.name : `Player ${seat + 1}`
        }))
    assert(
        seats.length === scenario.playerCount,
        `Scenario ${scenario.id} has ${seats.length} seats for ${scenario.playerCount} players`
    )
    return seats.map((seat, index) => ({
        ...seat,
        userId: index === 0 ? owner.id : undefined,
        isHuman: true,
        status: PlayerStatus.Joined
    }))
}
