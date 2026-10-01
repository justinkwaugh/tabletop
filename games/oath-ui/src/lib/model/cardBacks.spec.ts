import { describe, expect, it } from 'vitest'
import { CardKind } from '@tabletop/oath'
import { adviserBack, handBacks } from './cardBacks.js'

/** R-9.4 — a Vision's back differs from a denizen's, and the state says which a hidden card shows. */
describe('card backs', () => {
    it('an adviser row marked as a Vision shows the Vision back, any other the denizen back', () => {
        expect(adviserBack({ vision: true })).toBe(CardKind.Vision)
        expect(adviserBack({})).toBe(CardKind.Denizen)
    })

    it('a hand shows one back per card, its Visions with the Vision back', () => {
        expect(handBacks({ handCount: 3, handVisions: 1 }).map((hand) => hand.back)).toEqual([
            CardKind.Vision,
            CardKind.Denizen,
            CardKind.Denizen
        ])
        expect(handBacks({ handCount: 2, handVisions: 0 }).map((back) => back.label)).toEqual([
            'A denizen in hand',
            'A denizen in hand'
        ])
        expect(handBacks({ handCount: 0, handVisions: 0 })).toEqual([])
    })
})
