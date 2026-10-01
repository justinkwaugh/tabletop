import { describe, expect, it } from 'vitest'
import { GoalKind } from '../model/goalBoard.js'
import { goalSymbolImage, goalSymbolKeys } from './goalImages.js'

/** R-2.11, R-3.2.a, R-3.3.1 — every goal is drawn with the symbol of what it asks for. */
describe('goal symbols', () => {
    it('every kind of goal has a symbol, each its own', () => {
        const images = Object.values(GoalKind).map((kind) => goalSymbolImage(kind))
        expect(new Set(images).size).toBe(Object.values(GoalKind).length)
    })

    it('no symbol is orphaned — every file names a kind of goal', () => {
        const known = new Set<string>(Object.values(GoalKind))
        expect(goalSymbolKeys().filter((key) => !known.has(key))).toEqual([])
    })
})
