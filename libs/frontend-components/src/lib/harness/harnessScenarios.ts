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
    type GameState,
    type HydratedGameState,
    type Player
} from '@tabletop/common'
import type { GameUiDefinition } from '$lib/definition/gameUiDefinition.js'
import type { GameService } from '$lib/services/gameService.js'

// What to play next; the runner supplies the action's identity, game, source and time.
export type HarnessScenarioMove = { type: string; playerId?: string } & Record<string, unknown>

// A dev-harness shortcut to a game state worth looking at, reached by playing legal moves through
// the title's own rules, so the result has a real history.
export type HarnessScenario = {
    id: string
    label: string
    description: string
    playerCount: number
    config?: GameConfig
    isComplete(state: HydratedGameState, game: Game): boolean
    nextMove(state: HydratedGameState, game: Game): HarnessScenarioMove
}

const MAX_MOVES = 5000

export type HarnessScenarioOwner = { id: string; name: string }

export async function runHarnessScenario({
    scenario,
    definition,
    gameService,
    owner
}: {
    scenario: HarnessScenario
    definition: GameUiDefinition<GameState, HydratedGameState>
    gameService: Pick<GameService, 'createGame' | 'loadGame' | 'saveGameLocally'>
    owner: HarnessScenarioOwner
}): Promise<Game> {
    const created = await gameService.createGame({
        id: nanoid(),
        typeId: definition.info.id,
        name: scenario.label,
        players: scenarioPlayers(scenario.playerCount, owner),
        isPublic: false,
        hotseat: true,
        storage: GameStorage.Local,
        ownerId: owner.id,
        config: normalizeGameConfig({
            ...defaultGameConfig(definition.info.configurator?.options ?? []),
            ...scenario.config
        })
    })
    const { game } = await gameService.loadGame(created.id)
    assertExists(game?.state, `Scenario ${scenario.id} could not load its new game`)

    const runtime = await definition.runtime()
    const engine = new GameEngine(runtime)
    const actions: GameAction[] = []
    const startedAt = Date.now()
    let state = game.state
    for (let move = 0; ; move++) {
        const hydrated = runtime.hydrator.hydrateState(state)
        if (scenario.isComplete(hydrated, game)) break
        assert(move < MAX_MOVES, `Scenario ${scenario.id} did not finish within ${MAX_MOVES} moves`)
        const action: GameAction = {
            ...scenario.nextMove(hydrated, game),
            id: nanoid(),
            gameId: game.id,
            source: ActionSource.User,
            createdAt: new Date(startedAt + move)
        }
        const result = engine.executeCanonicalAction({ action, state, game })
        actions.push(...result.processedActions)
        state = result.updatedState
    }
    // Actions the engine generates take the current clock, which can run ahead of the moves'
    // synthetic dates, and titles read history order from these dates, so the whole saved
    // history gets increasing ones.
    actions.forEach((action, i) => {
        action.createdAt = new Date(startedAt + i)
    })

    await gameService.saveGameLocally({ game, state, actions })
    return game
}

function scenarioPlayers(count: number, owner: HarnessScenarioOwner): Player[] {
    return Array.from({ length: count }, (_, seat) => ({
        id: nanoid(),
        userId: seat === 0 ? owner.id : undefined,
        isHuman: true,
        name: seat === 0 ? owner.name : `Player ${seat + 1}`,
        status: PlayerStatus.Joined
    }))
}
