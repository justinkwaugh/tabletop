import {
    GameEngine,
    type Game,
    type GameAction,
    type GameCreationOptions,
    type GameDefinition,
    type GameState
} from '@tabletop/common'
import type { GameLoadResult } from '$lib/network/tabletopApi.svelte.js'
import { recordGame, type HarnessScenarioRecording } from './harnessScenarioRecording.js'
import {
    runHarnessScenario,
    type HarnessScenario,
    type HarnessScenarioOwner
} from './harnessScenarios.js'

export type PlayedHarnessScenario = { game: Game; state: GameState; actions: GameAction[] }

// Keeps scenario games in memory, so a title's specs, or a script that records a scenario, run
// the harness's own runner without a browser.
export class MemoryScenarioGames {
    readonly games: Map<string, Game> = new Map()
    played: PlayedHarnessScenario | undefined

    constructor(private readonly title: GameDefinition) {}

    async createGame(partial: Partial<Game>, options?: GameCreationOptions): Promise<Game> {
        const engine = new GameEngine(this.title.runtime)
        const initialized = this.title.runtime.initializer.initializeGame(partial, this.title)
        const { startedGame, initialState } = engine.startGame(initialized, options?.masterSeed)
        const game = { ...startedGame, state: initialState }
        this.games.set(game.id, game)
        return game
    }

    async loadGame(gameId: string): Promise<GameLoadResult> {
        return { game: this.games.get(gameId), actions: [] }
    }

    async saveGameLocally(played: PlayedHarnessScenario) {
        this.played = played
    }
}

const DEVELOPER: HarnessScenarioOwner = { id: 'developer', name: 'Developer' }

export async function playHarnessScenario({
    scenario,
    title,
    owner = DEVELOPER
}: {
    scenario: HarnessScenario
    title: GameDefinition
    owner?: HarnessScenarioOwner
}): Promise<PlayedHarnessScenario> {
    const games = new MemoryScenarioGames(title)
    await runHarnessScenario({
        scenario,
        definition: { info: title.info, runtime: async () => title.runtime },
        gameService: games,
        owner
    })
    if (!games.played) throw new Error(`Scenario ${scenario.id} saved no game`)
    return games.played
}

// Plays a scenario and records the result, for writing into a title's recordings folder.
export async function recordHarnessScenario({
    scenario,
    title,
    owner
}: {
    scenario: HarnessScenario
    title: GameDefinition
    owner?: HarnessScenarioOwner
}): Promise<HarnessScenarioRecording> {
    const played = await playHarnessScenario({ scenario, title, owner })
    return recordGame({
        id: scenario.id,
        label: scenario.label,
        description: scenario.description,
        recordedWith: title.info.metadata.version,
        ...played
    })
}
