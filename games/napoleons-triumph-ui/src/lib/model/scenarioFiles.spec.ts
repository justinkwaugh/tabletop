import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import {
    HydratedNapoleonsTriumphGameState,
    MachineState,
    NapoleonsTriumphGameStateValidator
} from '@tabletop/napoleons-triumph'

const FOLDER = new URL('../../scenarios/', import.meta.url)

const files = readdirSync(FOLDER).filter((name) => name.endsWith('.json'))

describe('the scenarios the harness offers', () => {
    it.each(files)(
        '%s is a position to start from, written by scripts/build-scenarios.mjs',
        (name) => {
            const { game, state, actions } = JSON.parse(readFileSync(new URL(name, FOLDER), 'utf8'))
            expect(NapoleonsTriumphGameStateValidator.Check(state)).toBe(true)
            expect(game.id).toBe(`scenario-${name.replace(/\.json$/, '')}`)
            expect(state.gameId).toBe(game.id)
            expect(actions).toEqual([])
            expect(state.actionCount).toBe(0)
            expect(state.machineState).toBe(MachineState.Commanding)
            expect(new HydratedNapoleonsTriumphGameState(state).activePlayerIds).toHaveLength(1)
        }
    )
})
