import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { AUSTERLITZ } from '@tabletop/napoleons-triumph'
import { approachPlates, plateOutlines } from './approachPlates.js'
import { approachSymbolScale, printedSideOf, sideKey } from './approachSymbols.js'
import { THREAT_ARROW, arrowOutlines, attackMarkerScale } from './attackMarker.js'
import { outlinesOverlap, type ConvexOutline } from './convexOutline.js'
import { cornersOf } from './orientedBox.js'
import { shownSymbolTags } from './shownSymbolTags.js'
import type { PlacedSymbolTag } from './approachSymbols.js'

const held = (approach: number) => ({ approach, playerId: 'holder' })
const marked = AUSTERLITZ.allApproaches.filter(
    (approach) => !approach.impassable && printedSideOf(approach.id) !== undefined
)
const ZOOMS = [1, 0.4, 0.1]

// The French fixed battery holds the Santon's approach to locale 64.
const SANTON_BATTERY = AUSTERLITZ.approachBetween(54, 64).id
const SANTON_TO_BOSENITZ = AUSTERLITZ.approachBetween(54, 42).id

function keyOf(approach: number): string {
    const side = printedSideOf(approach)
    assertExists(side, `approach ${approach} has printed marks`)
    return sideKey(side)
}

function onAny(tag: PlacedSymbolTag, outlines: readonly ConvexOutline[]): boolean {
    return outlines.some((outline) => outlinesOverlap(cornersOf(tag.cover), outline))
}

describe('the symbol tags shown on the map', () => {
    it('leave out the sides whose marks are on a plate', () => {
        for (const approach of marked) {
            const plates = approachPlates([held(approach.id)])
            const tags = shownSymbolTags({ switchedOn: true, scale: 1, arrows: [], plates })
            expect(tags.some((tag) => tag.key === keyOf(approach.id))).toBe(false)
        }
    })

    it('keep off every plate', () => {
        for (const switchedOn of [true, false]) {
            for (const zoom of ZOOMS) {
                const scale = approachSymbolScale(zoom)
                for (const approach of marked) {
                    const plates = approachPlates([held(approach.id)])
                    const outlines = plateOutlines(plates)
                    const tags = shownSymbolTags({ switchedOn, scale, arrows: [], plates })
                    for (const tag of tags) {
                        expect(
                            onAny(tag, outlines),
                            `${tag.key} on the plate of ${approach.id} at zoom ${zoom}`
                        ).toBe(false)
                    }
                }
            }
        }
    })

    it('keep off the plates and the arrows together, with every approach held', () => {
        const plates = approachPlates(marked.map((approach) => held(approach.id)))
        for (const zoom of ZOOMS) {
            const scale = approachSymbolScale(zoom)
            const arrows = arrowOutlines(SANTON_TO_BOSENITZ, attackMarkerScale(zoom), THREAT_ARROW)
            const obstacles = [...arrows, ...plateOutlines(plates)]
            for (const switchedOn of [true, false]) {
                for (const tag of shownSymbolTags({ switchedOn, scale, arrows, plates })) {
                    expect(onAny(tag, obstacles), `${tag.key} at zoom ${zoom}`).toBe(false)
                }
            }
        }
    })

    it('show the Santon’s marks towards Bosenitz clear of the fixed battery’s plate, with the switch on or off', () => {
        const plates = approachPlates([held(SANTON_BATTERY)])
        const [plate] = plateOutlines(plates)
        for (const switchedOn of [true, false]) {
            for (const zoom of ZOOMS) {
                const tags = shownSymbolTags({
                    switchedOn,
                    scale: approachSymbolScale(zoom),
                    arrows: [],
                    plates
                })
                const bosenitz = tags.find((tag) => tag.key === keyOf(SANTON_TO_BOSENITZ))
                assertExists(
                    bosenitz,
                    `the Bosenitz tag with the switch ${switchedOn ? 'on' : 'off'}`
                )
                expect(onAny(bosenitz, [plate])).toBe(false)
            }
        }
    })

    it('show, with the switch off, no tag while no plate or arrow covers a printed mark', () => {
        expect(shownSymbolTags({ switchedOn: false, scale: 1, arrows: [], plates: [] })).toEqual([])
    })
})
