import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import type { GameAction } from '@tabletop/common'
import {
    HydratedNapoleonsTriumphGameState,
    MachineState,
    NapoleonsTriumphGameStateValidator,
    type NapoleonsTriumphGameState
} from '@tabletop/napoleons-triumph'

const FOLDER = new URL('../../scenarios/', import.meta.url)

interface ScenarioFile {
    game: { id: string }
    state: NapoleonsTriumphGameState
    actions: GameAction[]
}

const scenarios: [string, ScenarioFile][] = readdirSync(FOLDER)
    .filter((name) => name.endsWith('.json'))
    .map((name) => [name, JSON.parse(readFileSync(new URL(name, FOLDER), 'utf8'))])

const positions = scenarios.filter(([, file]) => file.actions.length === 0)
const savedGames = scenarios.filter(([, file]) => file.actions.length > 0)

describe('the scenarios the harness offers', () => {
    it.each(scenarios)(
        '%s holds a valid state of its own game',
        (name, { game, state, actions }) => {
            expect(NapoleonsTriumphGameStateValidator.Check(state)).toBe(true)
            expect(game.id).toBe(`scenario-${name.replace(/\.json$/, '')}`)
            expect(state.gameId).toBe(game.id)
            expect(actions.every((action) => action.gameId === game.id)).toBe(true)
        }
    )

    it.each(positions)(
        '%s is a position to start from, written by scripts/build-scenarios.mjs',
        (_, { state }) => {
            expect(state.actionCount).toBe(0)
            expect(state.machineState).toBe(MachineState.Commanding)
            expect(new HydratedNapoleonsTriumphGameState(state).activePlayerIds).toHaveLength(1)
        }
    )

    it.each(savedGames)(
        '%s is a saved game with every action that led to it',
        (_, { state, actions }) => {
            expect(actions).toHaveLength(state.actionCount)
        }
    )
})
