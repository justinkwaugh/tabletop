import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { startingPositionFile } from '@tabletop/common/testing'
import {
    PromontoryPointGameStateValidator,
    type PromontoryPointGameState
} from '@tabletop/promontory-point'
import { SEAT_NAMES, TABLE_SLUGS, tablePosition } from '@tabletop/promontory-point/testing'

const FOLDER = new URL('../../scenarios/', import.meta.url)

interface ScenarioFile {
    game: { id: string; players: { name: string }[] }
    state: PromontoryPointGameState
    actions: unknown[]
}

const files: [string, string][] = readdirSync(FOLDER)
    .filter((name) => name.endsWith('.json'))
    .map((name) => [name, readFileSync(new URL(name, FOLDER), 'utf8')])

const scenarios: [string, ScenarioFile][] = files.map(([name, text]) => [name, JSON.parse(text)])

// Contract, "Verification scenarios": the named tables the dev harness opens.
describe('the scenarios the harness offers', () => {
    it('has one file per named table', () => {
        expect(files.map(([name]) => name).toSorted()).toEqual(
            TABLE_SLUGS.map((slug) => `${slug}.json`).toSorted()
        )
    })

    it.each(TABLE_SLUGS)(
        '%s is as scripts/build-scenarios.mjs writes it from the table recipe',
        (slug) => {
            const written = files.find(([name]) => name === `${slug}.json`)?.[1]
            expect(written).toBe(startingPositionFile(tablePosition(slug)).contents)
        }
    )

    it.each(scenarios)(
        '%s holds a legal canonical state of its own game, with invented seat names',
        (name, { game, state, actions }) => {
            expect(PromontoryPointGameStateValidator.Check(state)).toBe(true)
            expect(game.id).toBe(`scenario-${name.replace(/\.json$/, '')}`)
            expect(state.gameId).toBe(game.id)
            expect(state.actionCount).toBe(0)
            expect(actions).toEqual([])
            expect(game.players.map((player) => player.name).toSorted()).toEqual(
                [...SEAT_NAMES].toSorted()
            )
            // A hydrated state written as JSON carries its validator; these hold data only.
            expect(JSON.stringify(state)).not.toContain('_validator')
        }
    )
})
