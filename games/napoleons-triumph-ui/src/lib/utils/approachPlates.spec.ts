import { describe, expect, it } from 'vitest'
import { AUSTERLITZ, UnitType, type ApproachDefinition } from '@tabletop/napoleons-triumph'
import { APPROACH_GEOMETRY, type PrintedMark } from '$lib/map/boardGeometry.js'
import { PLATE_MARK, approachPlates, plateSamples } from './approachPlates.js'
import { printedSideOf } from './approachSymbols.js'
import { reachOfFiles } from './pieceLayout.js'

const LETTER: Record<UnitType, PrintedMark> = {
    [UnitType.Infantry]: 'I',
    [UnitType.Cavalry]: 'C',
    [UnitType.Artillery]: 'A'
}

function marksInTheRules(approach: ApproachDefinition): PrintedMark[] {
    const obstruction: PrintedMark[] = approach.obstructed ? ['O'] : []
    return [...approach.penalties.map((type) => LETTER[type]), ...obstruction].toSorted()
}

const passable = AUSTERLITZ.allApproaches.filter((approach) => !approach.impassable)
const marked = passable.filter((approach) => marksInTheRules(approach).length > 0)
const held = (approach: number) => ({ approach, playerId: 'holder' })

function plateOf(approach: number) {
    const [plate] = approachPlates([held(approach)])
    return plate
}

describe('the marks printed on an approach’s side of its bar', () => {
    it('are the marks the rules give that approach', () => {
        for (const approach of passable) {
            expect(
                printedSideOf(approach.id)?.marks.toSorted() ?? [],
                `approach ${approach.id}`
            ).toEqual(marksInTheRules(approach))
        }
    })
})

describe('the plate of a held approach', () => {
    it('is hung for every held approach that has marks, and for no other', () => {
        const plates = approachPlates(passable.map((approach) => held(approach.id)))
        expect(plates.map((plate) => plate.approach)).toEqual(marked.map((entry) => entry.id))
    })

    it('carries its marks in the printed order, one under another from the line', () => {
        for (const { id } of marked) {
            const { marks, box } = plateOf(id)
            expect(marks.map((placed) => placed.mark)).toEqual(printedSideOf(id)?.marks)
            const fromTheLine = marks.map(({ topLeft }) =>
                Math.min(Math.abs(topLeft.y), Math.abs(topLeft.y + PLATE_MARK.height))
            )
            fromTheLine.slice(1).forEach((distance, index) => {
                expect(distance - fromTheLine[index]).toBeGreaterThan(PLATE_MARK.height)
            })
            for (const { topLeft } of marks) {
                expect(topLeft.x).toBeGreaterThan(box.x)
                expect(topLeft.x + PLATE_MARK.width).toBeLessThan(box.x + box.width)
                expect(topLeft.y).toBeGreaterThan(box.y)
                expect(topLeft.y + PLATE_MARK.height).toBeLessThan(box.y + box.height)
            }
        }
    })

    it('lies in its own locale, against the bar and past the end of the pieces fronting it', () => {
        for (const { id } of marked) {
            const plate = plateOf(id)
            const bar = APPROACH_GEOMETRY[id]
            const nearestAlong = Math.min(
                Math.abs(plate.box.x),
                Math.abs(plate.box.x + plate.box.width)
            )
            expect(nearestAlong).toBeGreaterThan(reachOfFiles(bar))
            const depths = plateSamples([plate]).map(
                (point) =>
                    (point.x - bar.centre.x) * bar.inward.x +
                    (point.y - bar.centre.y) * bar.inward.y
            )
            expect(Math.min(...depths)).toBeCloseTo(0, 1)
            expect(Math.max(...depths)).toBeCloseTo(plate.box.height, 1)
        }
    })

    it('takes the other end of the bar from the plate of the army facing it', () => {
        const facing = marked.filter((approach) =>
            marked.some((other) => other.id === approach.opposite)
        )
        expect(facing.length).toBeGreaterThan(0)
        for (const approach of facing) {
            const ours = plateOf(approach.id).box
            const theirs = plateOf(approach.opposite).box
            expect(Math.sign(ours.x)).toBe(-Math.sign(theirs.x))
        }
    })
})
