import { describe, expect, it } from 'vitest'
import { UnitType } from '@tabletop/napoleons-triumph'
import { onBattlefield } from '$lib/map/battlefield.js'
import { APPROACH_GEOMETRY, PRINTED_MARKS } from '$lib/map/boardGeometry.js'
import {
    MARK_WIDTH,
    PENALISED_UNIT_TYPE,
    SYMBOL_TAGS,
    TAG_HEIGHT,
    approachSymbolScale,
    placeSymbolTags,
    printedMarksCovered,
    printedSideOf,
    sideKey,
    tagCentre
} from './approachSymbols.js'
import {
    THREAT_ARROW,
    arrowOutlines,
    attackMarkerScale,
    type ArrowDrawing
} from './attackMarker.js'
import { overlapWhileSliding, type ConvexOutline } from './convexOutline.js'
import { cornersOf, type OrientedBox } from './orientedBox.js'

const printedOnTheField = PRINTED_MARKS.filter((side) => onBattlefield(side.centre))

describe('the tags of approach symbols', () => {
    it('are one for each printed side on the battlefield, with its marks in the printed order', () => {
        expect(SYMBOL_TAGS.map((tag) => tag.marks.map((placed) => placed.mark))).toEqual(
            printedOnTheField.map((side) => side.marks)
        )
        expect(new Set(SYMBOL_TAGS.map((tag) => tag.key)).size).toBe(SYMBOL_TAGS.length)
    })

    it('stand beside their bar, on the side their marks are printed on', () => {
        SYMBOL_TAGS.forEach((tag, index) => {
            const side = printedOnTheField[index]
            const radians = (tag.angle * Math.PI) / 180
            const alongBar = { x: Math.cos(radians), y: Math.sin(radians) }
            const towardsMarks = { x: side.centre.x - side.bar.x, y: side.centre.y - side.bar.y }
            expect(Math.hypot(tag.awayFromBar.x, tag.awayFromBar.y)).toBeCloseTo(1)
            expect(tag.awayFromBar.x * alongBar.x + tag.awayFromBar.y * alongBar.y).toBeCloseTo(0)
            expect(
                tag.awayFromBar.x * towardsMarks.x + tag.awayFromBar.y * towardsMarks.y
            ).toBeGreaterThan(0)
        })
    })

    it('are wide enough to hold their marks side by side', () => {
        for (const tag of SYMBOL_TAGS) {
            const lefts = tag.marks.map((placed) => placed.left)
            expect(Math.min(...lefts)).toBeGreaterThan(-tag.width / 2)
            expect(Math.max(...lefts) + MARK_WIDTH).toBeLessThan(tag.width / 2)
            lefts.slice(1).forEach((left, index) => {
                expect(left - lefts[index]).toBeGreaterThan(MARK_WIDTH)
            })
        }
    })

    it('move out from the bar as they are drawn larger, so they never lie across it', () => {
        const [tag] = SYMBOL_TAGS
        const small = tagCentre(tag, 1)
        const large = tagCentre(tag, 2)
        expect(Math.hypot(large.x - small.x, large.y - small.y)).toBeCloseTo(TAG_HEIGHT / 2)
        expect(
            (large.x - small.x) * tag.awayFromBar.x + (large.y - small.y) * tag.awayFromBar.y
        ).toBeGreaterThan(0)
    })

    it('grow as the board is zoomed out, between their printed size and twice it', () => {
        expect(approachSymbolScale(1)).toBe(1)
        expect(approachSymbolScale(0.4)).toBeCloseTo(1.25)
        expect(approachSymbolScale(0.1)).toBe(2)
    })
})

function overlaps(box: OrientedBox, arrows: readonly ConvexOutline[]): boolean {
    return arrows.some((arrow) => {
        const range = overlapWhileSliding(cornersOf(box), arrow, box.along)
        return range !== undefined && range[0] < 0 && range[1] > 0
    })
}

const MARKED_APPROACHES = Object.keys(APPROACH_GEOMETRY)
    .map(Number)
    .filter((approach) => printedSideOf(approach) !== undefined)
const COUNTERED: ArrowDrawing = { feint: false, countered: true }
const FEINT: ArrowDrawing = { feint: true, countered: false }

describe('the placing of the tags of approach symbols', () => {
    it('leaves every tag beside its bar while no arrow is drawn', () => {
        for (const placed of placeSymbolTags(SYMBOL_TAGS, 1.5, [])) {
            expect(placed.slid).toBe(false)
            expect(placed.centre).toEqual(tagCentre(placed, 1.5))
        }
    })

    it('slides every tag out from under the arrows of an approach, along its own line, and no farther than it must', () => {
        for (const approach of MARKED_APPROACHES) {
            const bar = APPROACH_GEOMETRY[approach]
            const nearby = SYMBOL_TAGS.filter(
                ({ besideBar }) =>
                    Math.hypot(besideBar.x - bar.centre.x, besideBar.y - bar.centre.y) < 300
            )
            for (const zoom of [1, 0.1]) {
                const scale = approachSymbolScale(zoom)
                for (const drawing of [THREAT_ARROW, COUNTERED, FEINT]) {
                    const arrows = arrowOutlines(approach, attackMarkerScale(zoom), drawing)
                    for (const placed of placeSymbolTags(nearby, scale, arrows)) {
                        const name = `${placed.key} by ${approach}`
                        expect(overlaps(placed.cover, arrows), name).toBe(false)
                        const beside = tagCentre(placed, scale)
                        const moved = {
                            x: placed.centre.x - beside.x,
                            y: placed.centre.y - beside.y
                        }
                        expect(moved.x * placed.along.y - moved.y * placed.along.x).toBeCloseTo(0)
                        if (placed.slid) {
                            const nearlyTouching = {
                                ...placed.cover,
                                halfLength: placed.cover.halfLength + 2 * scale,
                                halfWidth: placed.cover.halfWidth + 2 * scale
                            }
                            expect(overlaps(nearlyTouching, arrows), name).toBe(true)
                        }
                    }
                }
            }
        }
    })

    it('moves the tags an arrow lies on, the marks of the approach under attack among them, and none far from it', () => {
        const [approach] = MARKED_APPROACHES
        const scale = approachSymbolScale(0.4)
        const arrows = arrowOutlines(approach, attackMarkerScale(0.4), THREAT_ARROW)
        const placed = placeSymbolTags(SYMBOL_TAGS, scale, arrows)
        const side = printedSideOf(approach)
        const bar = APPROACH_GEOMETRY[approach]
        expect(placed.find((tag) => side && tag.key === sideKey(side))?.slid).toBe(true)
        placed.forEach((tag, index) => {
            const beside = tagCentre(SYMBOL_TAGS[index], scale)
            if (overlaps({ ...tag.cover, centre: beside }, arrows)) {
                expect(tag.slid).toBe(true)
            }
            if (Math.hypot(beside.x - bar.centre.x, beside.y - bar.centre.y) > 200) {
                expect(tag.slid).toBe(false)
            }
        })
    })
})

describe('the printed marks an arrow covers', () => {
    it('are those printed beside the middle of the bar under attack, and none far from it', () => {
        for (const approach of MARKED_APPROACHES) {
            const arrows = arrowOutlines(approach, attackMarkerScale(1), THREAT_ARROW)
            const bar = APPROACH_GEOMETRY[approach]
            const side = printedSideOf(approach)
            const own = SYMBOL_TAGS.find((tag) => side && tag.key === sideKey(side))
            if (
                own &&
                Math.hypot(
                    own.printed.centre.x - bar.centre.x,
                    own.printed.centre.y - bar.centre.y
                ) < 20
            ) {
                expect(printedMarksCovered(own, arrows), own.key).toBe(true)
            }
            for (const tag of SYMBOL_TAGS) {
                if (
                    Math.hypot(
                        tag.printed.centre.x - bar.centre.x,
                        tag.printed.centre.y - bar.centre.y
                    ) > 120
                ) {
                    expect(printedMarksCovered(tag, arrows), tag.key).toBe(false)
                }
            }
        }
    })

    it('are none while no arrow is drawn', () => {
        expect(SYMBOL_TAGS.some((tag) => printedMarksCovered(tag, []))).toBe(false)
    })
})

describe('the printed penalty marks', () => {
    it('name the unit type they penalise, and none for obstruction or an impassable approach', () => {
        expect(PENALISED_UNIT_TYPE).toEqual({
            I: UnitType.Infantry,
            C: UnitType.Cavalry,
            A: UnitType.Artillery
        })
        expect(PENALISED_UNIT_TYPE.O).toBeUndefined()
        expect(PENALISED_UNIT_TYPE.X).toBeUndefined()
    })
})
