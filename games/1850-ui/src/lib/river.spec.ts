import { describe, expect, it } from 'vitest'
import { assertExists, calculateHexGeometry, HexOrientation, type Point } from '@tabletop/common'
import { Map1850 } from '@tabletop/1850'
import { TileRadius } from '@tabletop/18xx-ui'
import { RiverTerrainPositions, riverLines } from './river.js'

const centers = Map1850.definition.locations.map((location) => ({
    id: location.id,
    center: calculateHexGeometry(
        { orientation: HexOrientation.Pointy, dimensions: { radius: TileRadius } },
        location.coordinates
    ).center
}))

// A cost's drawn extent around its position: the waves start left of it and the figures run on right.
const CostRow = { left: -13, right: 20, top: -6, bottom: 6 }

function isInHex(home: Point, point: Point): boolean {
    const own = Math.hypot(point.x, point.y)
    return centers.every(
        ({ center }) =>
            own <= Math.hypot(center.x - home.x - point.x, center.y - home.y - point.y) + 0.01
    )
}

describe('the rivers', () => {
    const lines = Object.entries(riverLines())

    it('stay inside the hex drawing them, so a tile next door is never drawn over', () => {
        for (const [locationId, legs] of lines) {
            const home = centers.find((entry) => entry.id === locationId)?.center
            assertExists(home, `No hex ${locationId}`)
            for (const leg of legs)
                for (const point of (leg.points ?? []).slice(1, -1))
                    expect(isInHex(home, point)).toBe(true)
        }
    })

    it('run through the hexes the map prints water on', () => {
        expect(lines.map(([locationId]) => locationId).toSorted()).toEqual(
            'B7 C8 D9 E10 E12 F13 F3 G12 G4 H13 H5 I12 I4 J11 J5 K12 K6 K8 L11 L13 L9 M12'
                .split(' ')
                .toSorted()
        )
    })

    it('leave each moved cost inside its hex and off the water', () => {
        for (const [locationId, at] of Object.entries(RiverTerrainPositions)) {
            const home = centers.find((entry) => entry.id === locationId)?.center
            assertExists(home, `No hex ${locationId}`)
            const [left, right] = [at.x + CostRow.left, at.x + CostRow.right]
            const [top, bottom] = [at.y + CostRow.top, at.y + CostRow.bottom]
            for (const x of [left, right])
                for (const y of [top, bottom])
                    expect(isInHex(home, { x, y }), `${locationId} crosses its hex edge`).toBe(true)
            const legs = lines.find(([id]) => id === locationId)?.[1] ?? []
            for (const leg of legs)
                for (const point of leg.points ?? []) {
                    const gap = Math.hypot(
                        Math.max(left - point.x, point.x - right, 0),
                        Math.max(top - point.y, point.y - bottom, 0)
                    )
                    expect(gap, `${locationId} touches its river`).toBeGreaterThan(leg.width / 2)
                }
        }
    })

    it('draw each hex’s Mississippi and Missouri as whole lines', () => {
        const stLouis = lines.find(([locationId]) => locationId === 'L13')?.[1]
        expect(stLouis).toHaveLength(2)
    })
})
