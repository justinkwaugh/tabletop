import * as Type from 'typebox'
import * as Value from 'typebox/value'
import { ActionGroup } from '../game/model/actionGroup.js'
import { omitGameState, type Game } from '../game/model/game.js'
import type { GameState } from '../game/model/gameState.js'
import { scenarioJson, type ScenarioData } from '../game/model/scenario.js'

const ActionGroups = Type.Object({ series: Type.Array(ActionGroup) })

// The turn, round and phase managers record where each group of actions began; with no actions behind the position, the group in progress begins at the first.
function restarted(value: unknown): unknown {
    if (!Value.Check(ActionGroups, value)) {
        return value
    }
    const current = value.series.at(-1)
    if (!current) {
        return value
    }
    const { end: _end, ...open } = current
    return { ...value, series: [{ ...open, start: 0 }] }
}

export interface ScenarioFile {
    fileName: string
    contents: string
}

/** A position set up by hand, with no actions behind it, to be saved as the scenario `slug`. */
export interface PositionSetUp<T extends GameState> {
    slug: string
    name: string
    game: Game
    state: T
}

export function startingPositionFile<T extends GameState>(
    position: PositionSetUp<T>
): ScenarioFile {
    return {
        fileName: `${position.slug}.json`,
        contents: scenarioJson(startingPosition(position))
    }
}

export function startingPosition<T extends GameState>({
    slug,
    name,
    game,
    state
}: PositionSetUp<T>): ScenarioData & { state: T } {
    const id = `scenario-${slug}`
    const fresh = structuredClone(state)
    for (const [key, value] of Object.entries(fresh)) {
        Reflect.set(fresh, key, restarted(value))
    }
    return {
        game: {
            ...omitGameState(game),
            id,
            name,
            activePlayerIds: [...state.activePlayerIds]
        },
        state: { ...fresh, gameId: id, actionCount: 0, actionChecksum: 0 },
        actions: []
    }
}
