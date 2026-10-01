import { describe, expect, it } from 'vitest'
import { ActionType } from '@tabletop/oath'
import { actionImage, actionImageKeys } from './actionImages.js'
import { MAJOR_ACTIONS, MINOR_ACTIONS } from '$lib/model/actionCatalogue.js'

/** Every major action has the symbol its player board prints, and every symbol names an action. */
describe('action symbol coverage', () => {
    it('R-5 — all six major actions resolve to a symbol', () => {
        const missing = MAJOR_ACTIONS.filter((entry) => !actionImage(entry.type)).map(
            (entry) => entry.type
        )
        expect(missing).toEqual([])
        expect(MAJOR_ACTIONS).toHaveLength(6)
    })

    it('R-6 — no minor action has a symbol, because the board prints none', () => {
        const unexpected = MINOR_ACTIONS.filter((entry) => actionImage(entry.type)).map(
            (entry) => entry.type
        )
        expect(unexpected).toEqual([])
    })

    it('no symbol is orphaned — every file names an action that exists', () => {
        const known = new Set<string>(Object.values(ActionType))
        expect(actionImageKeys().filter((key) => !known.has(key))).toEqual([])
    })
})
