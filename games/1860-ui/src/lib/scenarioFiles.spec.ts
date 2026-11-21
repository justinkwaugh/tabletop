import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { Definition } from '@tabletop/1860'

const FOLDER = new URL('../scenarios/', import.meta.url)

const files = readdirSync(FOLDER).filter((name) => name.endsWith('.json'))

describe('the scenarios the harness offers', () => {
    it.each(files)(
        '%s is a valid position, written by scenarios.build.spec.ts in the logic package',
        (name) => {
            const { game, state, actions } = JSON.parse(readFileSync(new URL(name, FOLDER), 'utf8'))
            expect(Definition.runtime.canonicalStateValidator?.Check(state)).toBe(true)
            expect(game.id).toBe(`scenario-1860-${name.replace(/\.json$/, '')}`)
            expect(state.gameId).toBe(game.id)
            expect(actions.length).toBe(state.actionCount)
        }
    )
})
