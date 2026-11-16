import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MatrxGameStateValidator, MachineState } from '@tabletop/matrx'

// Built from this file's path: the client build Vitest runs turns new URL(..., import.meta.url)
// into an asset lookup.
const FOLDER = join(dirname(fileURLToPath(import.meta.url)), '../../scenarios')

const files = readdirSync(FOLDER).filter((name) => name.endsWith('.json'))

describe('the scenarios the harness offers', () => {
    it.each(files)(
        '%s is a position to start from, written by scripts/build-scenarios.mjs',
        (name) => {
            const { game, state, actions } = JSON.parse(readFileSync(join(FOLDER, name), 'utf8'))
            expect(MatrxGameStateValidator.Check(state)).toBe(true)
            expect(game.id).toBe(`scenario-${name.replace(/\.json$/, '')}`)
            expect(state.gameId).toBe(game.id)
            expect(actions).toEqual([])
            expect(state.machineState).toBe(MachineState.TakingTurn)
            expect(state.activePlayerIds).toEqual(['player-1'])
        }
    )
})
