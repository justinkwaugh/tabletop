import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { LowenherzGameStateValidator } from '@tabletop/lowenherz'

const FOLDER = new URL('../../scenarios/', import.meta.url)

const files = readdirSync(FOLDER).filter((name) => name.endsWith('.json'))

describe('the scenarios the harness offers', () => {
    it.each(files)(
        '%s is a played game with its whole history, written by scripts/build-scenarios.mjs',
        (name) => {
            const { game, state, actions } = JSON.parse(readFileSync(new URL(name, FOLDER), 'utf8'))
            expect(LowenherzGameStateValidator.Check(state)).toBe(true)
            expect(game.id).toBe(`scenario-${name.replace(/\.json$/, '')}`)
            expect(state.gameId).toBe(game.id)
            expect(actions).toHaveLength(state.actionCount)
            expect(actions.every((action: { gameId: string }) => action.gameId === game.id)).toBe(
                true
            )
        }
    )
})
