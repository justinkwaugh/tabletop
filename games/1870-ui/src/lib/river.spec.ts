import { describe, expect, it } from 'vitest'
import { RiverHexes } from '@tabletop/1870'
import { riverLegs, riverLines } from './river.js'

describe('the Mississippi', () => {
    const legs = riverLegs()

    it('runs through every river hex, source to Gulf', () => {
        expect(legs.map((leg) => leg.locationId)).toEqual(Object.keys(RiverHexes))
        for (const id of Object.keys(RiverHexes)) expect(riverLines()[id]).toBeDefined()
    })

    it('leaves each hex where it enters the next', () => {
        for (const [index, leg] of legs.slice(0, -1).entries()) {
            const next = legs[index + 1]
            const out = leg.points.at(-1)
            const into = next.points[0]
            expect(leg.center.x + (out?.x ?? 0)).toBeCloseTo(next.center.x + into.x, 1)
            expect(leg.center.y + (out?.y ?? 0)).toBeCloseTo(next.center.y + into.y, 1)
        }
    })

    it('stays clear of the middle of a hex with a stop', () => {
        for (const leg of legs) {
            if (RiverHexes[leg.locationId].stopBank === undefined) continue
            for (const point of leg.points) expect(Math.hypot(point.x, point.y)).toBeGreaterThan(24)
        }
    })

    it('widens toward the Gulf, above every other river', () => {
        const lines = riverLines()
        const widths = legs.map((leg) => lines[leg.locationId].at(-1)?.width ?? 0)
        expect(widths).toEqual([...widths].sort((a, b) => a - b))
        expect(widths.at(-1)).toBeGreaterThan(widths[0])
        const others = Object.values(lines).flatMap((line) =>
            line.filter((entry) => entry.color !== lines.A16[0].color)
        )
        expect(others.length).toBeGreaterThan(10)
        for (const other of others) expect(other.width).toBeLessThan(widths[0] / 2)
    })
})
