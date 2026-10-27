import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import type { GameAction } from '@tabletop/common'
import { PowerGridGameStateValidator, type PowerGridGameState } from '@tabletop/power-grid'

const FOLDER = new URL('../../scenarios/', import.meta.url)

interface ScenarioFile {
    game: { id: string }
    state: PowerGridGameState
    actions: GameAction[]
}

const scenarios: [string, ScenarioFile][] = readdirSync(FOLDER)
    .filter((name) => name.endsWith('.json'))
    .map((name) => [name, JSON.parse(readFileSync(new URL(name, FOLDER), 'utf8'))])

describe('the scenarios the harness offers', () => {
    it.each(scenarios)(
        '%s holds a valid state of its own game',
        (name, { game, state, actions }) => {
            expect(PowerGridGameStateValidator.Check(state)).toBe(true)
            expect(game.id).toBe(`scenario-${name.replace(/\.json$/, '')}`)
            expect(state.gameId).toBe(game.id)
            expect(actions.every((action) => action.gameId === game.id)).toBe(true)
            expect(actions).toHaveLength(state.actionCount)
        }
    )
})
