import { describe, expect, it } from 'vitest'
import type { Point } from '@tabletop/common'
import { Side } from '@tabletop/napoleons-triumph'
import { TestGame, arrangeBattlefield, infantry } from '@tabletop/napoleons-triumph/testing'
import { APPROACH_GEOMETRY } from '$lib/map/boardGeometry.js'
import {
    ARROW_EDGE_WIDTH,
    ATTACK_ARROW_ASIDE,
    ATTACK_ARROW_PATH,
    COUNTER_ARROW_ASIDE,
    COUNTER_ARROW_PATH,
    FEINT_ARROW_FOLD_PATH,
    FEINT_ARROW_PATH,
    THREAT_ARROW,
    arrowOutlines,
    arrowSlide,
    attackMarkerAngle,
    attackMarkerSamples,
    type ArrowDrawing
} from './attackMarker.js'
import { blockOutline, faceOutline } from './blockShape.js'
import { grownOutline, outlinesOverlap, type ConvexOutline } from './convexOutline.js'
import { FACE_SYMBOL_GAP } from './faceLayout.js'
import { layoutPieces } from './pieceLayout.js'
import { insidePolygon } from './polygon.js'

const ARGUMENTS: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, Q: 4, C: 6, A: 7, Z: 0 }

/** Every point a path names: its corners, the ends of its curves and their control points. */
function pointsOf(path: string): Point[] {
    const tokens = path.match(/[A-Z]|-?[\d.]+/g) ?? []
    const points: Point[] = []
    let at = { x: 0, y: 0 }
    for (let index = 0; index < tokens.length;) {
        const command = tokens[index]
        const numbers = tokens.slice(index + 1, index + 1 + ARGUMENTS[command]).map(Number)
        index += 1 + ARGUMENTS[command]
        if (command === 'H') {
            at = { x: numbers[0], y: at.y }
        } else if (command === 'V') {
            at = { x: at.x, y: numbers[0] }
        } else if (command === 'A') {
            at = { x: numbers[5], y: numbers[6] }
        } else if (command !== 'Z') {
            for (let pair = 0; pair < numbers.length; pair += 2) {
                points.push({ x: numbers[pair], y: numbers[pair + 1] })
            }
            at = points[points.length - 1]
            continue
        }
        points.push(at)
    }
    return points
}

function drawnPoints({ feint, countered }: ArrowDrawing): Point[] {
    const aside = countered ? ATTACK_ARROW_ASIDE : 0
    const own = feint ? [FEINT_ARROW_PATH, FEINT_ARROW_FOLD_PATH] : [ATTACK_ARROW_PATH]
    const counter = countered
        ? pointsOf(COUNTER_ARROW_PATH).map(({ x, y }) => ({ x: -x, y: COUNTER_ARROW_ASIDE - y }))
        : []
    return [...own.flatMap(pointsOf).map(({ x, y }) => ({ x, y: y + aside })), ...counter]
}

function onTheBoard(points: Point[], approach: number, scale: number): Point[] {
    const bar = APPROACH_GEOMETRY[approach]
    const radians = (attackMarkerAngle(bar) * Math.PI) / 180
    const [cos, sin] = [Math.cos(radians), Math.sin(radians)]
    return points.map(({ x, y }) => ({
        x: bar.centre.x + (x * cos - y * sin) * scale,
        y: bar.centre.y + (x * sin + y * cos) * scale
    }))
}

function heldBy(outlines: readonly ConvexOutline[], point: Point): boolean {
    return outlines.some((outline) => insidePolygon(point, outline))
}

/** Points along the quarter-circle bend of a feint's shaft, of which its path names only the ends. */
function bendPoints(): Point[] {
    const [, startY, radius, endX] = (
        FEINT_ARROW_PATH.match(/V(-?[\d.]+) A([\d.]+) [\d.]+ 0 0 1 (-?[\d.]+) -?[\d.]+/) ?? []
    ).map(Number)
    return Array.from({ length: 9 }, (_, step) => ({
        x: endX + radius * Math.cos((step * Math.PI) / 16),
        y: startY + radius * Math.sin((step * Math.PI) / 16)
    }))
}

const DRAWINGS: ArrowDrawing[] = [
    THREAT_ARROW,
    { feint: true, countered: false },
    { feint: false, countered: true },
    { feint: true, countered: true }
]
const APPROACHES = Object.keys(APPROACH_GEOMETRY).map(Number).slice(0, 40)

describe('the outlines of the arrows on an approach', () => {
    it('hold every point of the arrows as they are drawn, at any size', () => {
        for (const drawing of DRAWINGS) {
            const bend = drawing.feint
                ? bendPoints().map(({ x, y }) => ({
                      x,
                      y: y + (drawing.countered ? ATTACK_ARROW_ASIDE : 0)
                  }))
                : []
            for (const approach of APPROACHES) {
                for (const scale of [1.2, 3.4]) {
                    const outlines = arrowOutlines(approach, scale, drawing)
                    for (const point of onTheBoard(
                        [...drawnPoints(drawing), ...bend],
                        approach,
                        scale
                    )) {
                        expect(heldBy(outlines, point), JSON.stringify(drawing)).toBe(true)
                    }
                }
            }
        }
    })

    it('hold the samples the flags keep clear of', () => {
        for (const approach of APPROACHES) {
            const outlines = arrowOutlines(approach, 2, THREAT_ARROW)
            const bar = APPROACH_GEOMETRY[approach]
            expect(attackMarkerSamples(bar, 2).every((point) => heldBy(outlines, point))).toBe(true)
        }
    })

    it('reach no farther on any side than the arrows and their edge', () => {
        const edgeOutside = ARROW_EDGE_WIDTH / 2
        // The outlines keep sharp the corners the edge rounds, as far out as the narrow counter-attack's tip.
        const sharpCorner = edgeOutside * 2.5
        for (const drawing of DRAWINGS) {
            const [approach] = APPROACHES
            const bar = APPROACH_GEOMETRY[approach]
            const radians = (attackMarkerAngle(bar) * Math.PI) / 180
            const forward = { x: Math.cos(radians), y: Math.sin(radians) }
            const frame = (point: Point) => {
                const offset = { x: point.x - bar.centre.x, y: point.y - bar.centre.y }
                return {
                    ahead: offset.x * forward.x + offset.y * forward.y,
                    aside: -offset.x * forward.y + offset.y * forward.x
                }
            }
            const drawn = onTheBoard(drawnPoints(drawing), approach, 1).map(frame)
            const outlined = arrowOutlines(approach, 1, drawing).flat().map(frame)
            for (const key of ['ahead', 'aside'] as const) {
                const reach = (points: typeof drawn) => [
                    Math.min(...points.map((point) => point[key])),
                    Math.max(...points.map((point) => point[key]))
                ]
                const [drawnLow, drawnHigh] = reach(drawn)
                const [outlinedLow, outlinedHigh] = reach(outlined)
                expect(drawnLow - outlinedLow).toBeGreaterThanOrEqual(edgeOutside - 1e-9)
                expect(drawnLow - outlinedLow).toBeLessThan(sharpCorner)
                expect(outlinedHigh - drawnHigh).toBeGreaterThanOrEqual(edgeOutside - 1e-9)
                expect(outlinedHigh - drawnHigh).toBeLessThan(sharpCorner)
            }
        }
    })
})

// The French threat from locale 132 into locale 131 in the reported game, with revealed infantry fronting it.
const REPORTED_APPROACH = 471

function frontedByShownInfantry() {
    const game = new TestGame()
    game.deployBoth()
    arrangeBattlefield(game, [
        { id: 'F19', side: Side.French, face: infantry(2), locale: 132, facing: 131 }
    ])
    const blocks = layoutPieces(game.hydrated, { rotation: 0 }).flatMap((sprite) => sprite.blocks)
    return {
        faces: blocks.map((block) => faceOutline(block, 2)),
        others: blocks.map(blockOutline)
    }
}

function along(approach: number): Point {
    const radians = (APPROACH_GEOMETRY[approach].angle * Math.PI) / 180
    return { x: Math.cos(radians), y: Math.sin(radians) }
}

describe('the slide of the arrows along their bar', () => {
    it('is none where no face lies under them', () => {
        const { others } = frontedByShownInfantry()
        expect(arrowSlide(REPORTED_APPROACH, 1.2, THREAT_ARROW, { faces: [], others })).toBe(0)
    })

    it('takes the arrows off the face of a unit fronting the approach', () => {
        const shown = frontedByShownInfantry()
        const withTheGap = shown.faces.map((face) => grownOutline(face, FACE_SYMBOL_GAP - 0.01))
        const covers = (outlines: ConvexOutline[]) =>
            outlines.some((piece) => withTheGap.some((face) => outlinesOverlap(piece, face)))
        expect(covers(arrowOutlines(REPORTED_APPROACH, 1.2, THREAT_ARROW))).toBe(true)
        for (const drawing of [THREAT_ARROW, { feint: true, countered: false }]) {
            for (const scale of [1.2, 1.7]) {
                const slide = arrowSlide(REPORTED_APPROACH, scale, drawing, shown)
                expect(covers(arrowOutlines(REPORTED_APPROACH, scale, drawing, slide))).toBe(false)
            }
        }
    })

    it('keeps the middle of the arrows on their bar', () => {
        const shown = frontedByShownInfantry()
        const { length } = APPROACH_GEOMETRY[REPORTED_APPROACH]
        for (const drawing of DRAWINGS) {
            for (const scale of [1.2, 3.4]) {
                const slide = arrowSlide(REPORTED_APPROACH, scale, drawing, shown)
                expect(Math.abs(slide)).toBeLessThanOrEqual(length / 2)
            }
        }
    })

    it('goes the way that covers less of what else is on the map', () => {
        const shown = frontedByShownInfantry()
        const { centre } = APPROACH_GEOMETRY[REPORTED_APPROACH]
        const way = along(REPORTED_APPROACH)
        for (const end of [-1, 1]) {
            const beyond = {
                centre: { x: centre.x + way.x * end * 60, y: centre.y + way.y * end * 60 },
                angle: 0
            }
            const others = [...shown.others, blockOutline(beyond)]
            const slide = arrowSlide(REPORTED_APPROACH, 1.2, THREAT_ARROW, { ...shown, others })
            expect(Math.sign(slide)).toBe(-end)
        }
    })

    it('goes a way that clears the faces before one that covers less', () => {
        const shown = frontedByShownInfantry()
        const { centre, angle } = APPROACH_GEOMETRY[REPORTED_APPROACH]
        const way = along(REPORTED_APPROACH)
        const at = (reach: number) => ({
            centre: { x: centre.x + way.x * reach, y: centre.y + way.y * reach },
            angle
        })
        const faces = [...shown.faces, faceOutline(at(90), 3)]
        const others = [...shown.others, blockOutline({ ...at(-70), angle: 0 })]
        const slide = arrowSlide(REPORTED_APPROACH, 1.2, THREAT_ARROW, { faces, others })
        const slid = arrowOutlines(REPORTED_APPROACH, 1.2, THREAT_ARROW, slide)
        expect(slid.some((piece) => faces.some((face) => outlinesOverlap(piece, face)))).toBe(false)
    })

    it('carries the outlines and the samples with the arrows', () => {
        const way = along(REPORTED_APPROACH)
        const bar = APPROACH_GEOMETRY[REPORTED_APPROACH]
        const centred = arrowOutlines(REPORTED_APPROACH, 1.5, THREAT_ARROW)
        const slid = arrowOutlines(REPORTED_APPROACH, 1.5, THREAT_ARROW, 30)
        slid.forEach((piece, index) =>
            piece.forEach((point, corner) => {
                expect(point.x).toBeCloseTo(centred[index][corner].x + way.x * 30)
                expect(point.y).toBeCloseTo(centred[index][corner].y + way.y * 30)
            })
        )
        expect(attackMarkerSamples(bar, 1.5, 30).every((point) => heldBy(slid, point))).toBe(true)
    })
})
