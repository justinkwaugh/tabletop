import * as Type from 'typebox'
import * as Value from 'typebox/value'
import { Game, GameAction, GameState, type ScenarioData } from '@tabletop/common'
import { fileSlug } from '$lib/utils/fileSlug.js'

export interface Scenario {
    name: string
    load: () => Promise<ScenarioData>
}

type ScenarioFiles = Record<string, () => Promise<unknown>>

/** Each file is named for its scenario: `artillery-pair-wide.json` is "Artillery pair wide". */
export function scenariosFrom(files: ScenarioFiles): Scenario[] {
    return Object.entries(files)
        .map(([path, read]) => ({
            name: nameOf(path),
            load: async () => scenarioData(await read())
        }))
        .toSorted((a, b) => a.name.localeCompare(b.name))
}

// Workaround: in a Svelte component Vite's Svelte plugin keeps the file list stale when files are added, so the lookup lives in this plain module; inside a function, so a bundle that keeps the module keeps no lookup.
export function gameScenarios(): Scenario[] {
    return scenariosFrom(import.meta.glob('/src/scenarios/*.json', { import: 'default' }))
}

export function scenarioFromJson(json: string): ScenarioData {
    return scenarioData(JSON.parse(json))
}

export function scenarioFileName(gameName: string): string {
    return `${fileSlug(gameName)}.json`
}

function nameOf(path: string): string {
    const base = (path.split('/').at(-1) ?? path).replace(/\.json$/, '').replaceAll('-', ' ')
    return base.charAt(0).toUpperCase() + base.slice(1)
}

// Built when a file is read, not at module load, so game bundles that reach this module through the library keep none of it.
function scenarioFile() {
    return Type.Object({
        game: Type.Unknown(),
        state: Type.Unknown(),
        actions: Type.Array(Type.Unknown())
    })
}

// Files hold JSON, so the dates of the game and its actions are read back from strings.
function scenarioData(file: unknown): ScenarioData {
    Value.Assert(scenarioFile(), file)
    const game = Value.Convert(Game, file.game)
    Value.Assert(Game, game)
    const actions = file.actions.map((action) => {
        const converted = Value.Convert(GameAction, action)
        Value.Assert(GameAction, converted)
        return converted
    })
    const state = file.state
    Value.Assert(GameState, state)
    if (state.gameId !== game.id) {
        throw new Error(`The scenario's state belongs to game ${state.gameId}, not ${game.id}`)
    }
    return { game, state, actions }
}
