import { describe, expect, it } from 'vitest'
import { WIN_RULES } from '@tabletop/oath'
import { ENDINGS } from './endings.js'

/** The end-of-game text covers exactly the endings in the engine's own `WIN_RULES`. */
describe('end-of-game descriptions (R-3)', () => {
    it('describes every rule the engine can record as wonBy', () => {
        const missing = WIN_RULES.filter((rule) => !ENDINGS[rule])
        expect(missing).toEqual([])
    })

    it('describes nothing the engine cannot record', () => {
        const orphans = Object.keys(ENDINGS).filter(
            (key) => !WIN_RULES.some((rule) => rule === key)
        )
        expect(orphans).toEqual([])
    })
})
