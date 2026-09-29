import { describe, expect, it } from 'vitest'
import { RELIQUARY_MODIFIERS, reliquaryModifier } from './reliquary.js'
import { RELIQUARY_SIZE } from './relics.js'

describe('Imperial Reliquary modifiers (R-2.3, R-6.6.2.a)', () => {
    it('R-2.3 — one modifier per Reliquary space, and RELIQUARY_SIZE is the join', () => {
        expect(RELIQUARY_MODIFIERS).toHaveLength(RELIQUARY_SIZE)
        for (let i = 0; i < RELIQUARY_SIZE; i++) {
            expect(reliquaryModifier(i)).toBeDefined()
        }
        expect(reliquaryModifier(RELIQUARY_SIZE)).toBeUndefined()
    })

    it('R-2.3 — the four named traits, in printed order, each with its text', () => {
        expect(RELIQUARY_MODIFIERS.map((m) => m.name)).toEqual([
            'Brutal',
            'Decadent',
            'Careless',
            'Greedy'
        ])
        for (const m of RELIQUARY_MODIFIERS) {
            expect(m.id.startsWith('reliquary.')).toBe(true)
            expect(m.powerText.length).toBeGreaterThan(20)
        }
    })

    it('ids are unique — they key the effect engine once built', () => {
        const ids = RELIQUARY_MODIFIERS.map((m) => m.id)
        expect(new Set(ids).size).toBe(ids.length)
    })
})
