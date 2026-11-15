import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { GameAction } from '@tabletop/common'
import { OstbahnGameStateValidator, type OstbahnGameState } from '@tabletop/preussische-ostbahn'

const FOLDER = join(dirname(fileURLToPath(import.meta.url)), '../../scenarios')

interface ScenarioFile {
    game: { id: string }
    state: OstbahnGameState
    actions: GameAction[]
}

const scenarios: [string, ScenarioFile][] = readdirSync(FOLDER)
    .filter((name) => name.endsWith('.json'))
    .map((name) => [name, JSON.parse(readFileSync(join(FOLDER, name), 'utf8'))])

describe('the scenarios the harness offers', () => {
    it.each(scenarios)(
        '%s is a valid saved game with every action that led to it',
        (name, { game, state, actions }) => {
            expect(OstbahnGameStateValidator.Check(state)).toBe(true)
            expect(game.id).toBe(`scenario-${name.replace(/\.json$/, '')}`)
            expect(state.gameId).toBe(game.id)
            expect(actions.every((action) => action.gameId === game.id)).toBe(true)
            expect(actions).toHaveLength(state.actionCount)
        }
    )
})
