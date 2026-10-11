import { nanoid } from 'nanoid'
import * as Value from 'typebox/value'
import { Game, GameAction, GameCategory, GameState, GameStorage } from '@tabletop/common'
import type { HarnessScenarioOwner } from './harnessScenarioPlayer.js'

// A scenario as a title's scenarios folder holds it: a game, its state and its actions, as the
// harness stores any game, with a label and description for the menu.
export type HarnessScenarioFile = {
    format: 1
    label: string
    description: string
    game: Game
    state: GameState
    actions: GameAction[]
}

export type ListedHarnessScenario = { id: string; scenario: HarnessScenarioFile }

export function scenarioFile({
    label,
    description,
    game,
    state,
    actions
}: Omit<HarnessScenarioFile, 'format'>): HarnessScenarioFile {
    return { format: 1, label, description, game, state, actions }
}

// The scenarios a title's dev page loaded, by file name, with dates restored. A file that is not a
// scenario is reported and left out of the menu rather than stopping the harness.
export function listedScenarios(files: Record<string, unknown>): ListedHarnessScenario[] {
    return Object.entries(files)
        .flatMap(([path, content]) => {
            const scenario = parsedScenario(content)
            if (scenario) return [{ id: scenarioId(path), scenario }]
            console.error(`${path} is not a harness scenario`)
            return []
        })
        .toSorted((a, b) => a.scenario.label.localeCompare(b.scenario.label))
}

// A new local hotseat game with the scenario's state and history, owned by the viewer, so playing
// it on never changes the scenario.
export function scenarioGame(
    scenario: HarnessScenarioFile,
    owner: HarnessScenarioOwner
): { game: Game; state: GameState; actions: GameAction[] } {
    const id = nanoid()
    const game: Game = {
        ...structuredClone(scenario.game),
        id,
        name: scenario.label,
        ownerId: owner.id,
        players: scenario.game.players.map((player) => ({ ...player, userId: owner.id })),
        storage: GameStorage.Local,
        category: GameCategory.Standard,
        hotseat: true,
        isPublic: false,
        parentId: undefined,
        updatedAt: new Date()
    }
    delete game.tournament
    return {
        game,
        state: { ...structuredClone(scenario.state), gameId: id },
        actions: scenario.actions.map((action) => ({ ...structuredClone(action), gameId: id }))
    }
}

function parsedScenario(content: unknown): HarnessScenarioFile | undefined {
    if (typeof content !== 'object' || content === null) return undefined
    if (!('format' in content) || content.format !== 1) return undefined
    if (!('label' in content) || typeof content.label !== 'string') return undefined
    if (!('description' in content) || typeof content.description !== 'string') return undefined
    if (!('game' in content) || !('state' in content) || !('actions' in content)) return undefined
    if (!Array.isArray(content.actions)) return undefined

    const game = Value.Convert(Game, content.game)
    const state = content.state
    const actions = content.actions.map((action: unknown) => Value.Convert(GameAction, action))
    if (!Value.Check(Game, game) || !Value.Check(GameState, state)) return undefined
    if (!actions.every((action): action is GameAction => Value.Check(GameAction, action))) {
        return undefined
    }
    return {
        format: 1,
        label: content.label,
        description: content.description,
        game,
        state,
        actions
    }
}

function scenarioId(path: string) {
    return (path.split('/').at(-1) ?? path).replace(/\.json$/, '')
}
