import { describe, expect, it } from 'vitest'
import { UnitType } from '@tabletop/napoleons-triumph'
import { onBattlefield } from '$lib/map/battlefield.js'
import { PRINTED_MARKS } from '$lib/map/boardGeometry.js'
import {
    MARK_WIDTH,
    PENALISED_UNIT_TYPE,
    SYMBOL_TAGS,
    TAG_HEIGHT,
    approachSymbolScale,
    tagCentre
} from './approachSymbols.js'

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
