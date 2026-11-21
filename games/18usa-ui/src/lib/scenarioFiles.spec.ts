import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { Compile } from 'typebox/compile'
import { EighteenUSAState } from '@tabletop/18usa'

const Folder = new URL('../scenarios/', import.meta.url)
const StateValidator = Compile(EighteenUSAState)

type ScenarioFile = {
    game: { id: string }
    state: { gameId: string; actionCount: number }
    actions: { gameId: string }[]
}

const scenarios: [string, ScenarioFile][] = readdirSync(Folder)
    .filter((name) => name.endsWith('.json'))
    .map((name) => [name, JSON.parse(readFileSync(new URL(name, Folder), 'utf8'))])

describe('the scenarios the harness offers', () => {
    it.each(scenarios)('%s holds a valid state of its own game', (name, file) => {
        expect(StateValidator.Check(file.state)).toBe(true)
        expect(file.game.id).toMatch(new RegExp(`^scenario-.*${name.replace(/\.json$/, '')}$`))
        expect(file.state.gameId).toBe(file.game.id)
        expect(file.actions.every((action) => action.gameId === file.game.id)).toBe(true)
        if (!file.actions.length) expect(file.state.actionCount).toBe(0)
    })
})
