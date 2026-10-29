import { describe, expect, it } from 'vitest'
import { AUSTERLITZ } from '@tabletop/napoleons-triumph'
import { approachPlates, plateOutlines } from './approachPlates.js'
import { approachSymbolScale, printedSideOf, sideKey } from './approachSymbols.js'
import { outlinesOverlap } from './convexOutline.js'
import { cornersOf } from './orientedBox.js'
import { shownSymbolTags } from './shownSymbolTags.js'

const held = (approach: number) => ({ approach, playerId: 'holder' })
const marked = AUSTERLITZ.allApproaches.filter(
    (approach) => !approach.impassable && printedSideOf(approach.id) !== undefined
)

describe('the symbol tags shown on the map', () => {
    it('leave out the sides whose marks are on a plate', () => {
        for (const approach of marked) {
            const plates = approachPlates([held(approach.id)])
            const tags = shownSymbolTags({ allShown: true, scale: 1, arrows: [], plates })
            const side = printedSideOf(approach.id)!
            expect(tags.some((tag) => tag.key === sideKey(side))).toBe(false)
        }
    })

    // A tag beside the Santon's bar to Bosenitz lay on the fixed battery's plate, so the battery's side showed no marks.
    it('keep off every plate', () => {
        for (const zoom of [1, 0.4, 0.1]) {
            const scale = approachSymbolScale(zoom)
            for (const approach of marked) {
                const plates = approachPlates([held(approach.id)])
                const [plate] = plateOutlines(plates)
                const tags = shownSymbolTags({ allShown: true, scale, arrows: [], plates })
                for (const tag of tags) {
                    expect(
                        outlinesOverlap(cornersOf(tag.cover), plate),
                        `${tag.key} on the plate of ${approach.id} at zoom ${zoom}`
                    ).toBe(false)
                }
            }
        }
    })
})
