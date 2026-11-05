import { WallSide, boardSize, type WallSection } from '@tabletop/medina'
import { describe, expect, it } from 'vitest'
import { SHEET_LAYOUTS, type BoardView } from '$lib/art/atlas.generated.js'
import {
    UNITS_PER_CELL,
    croppedToCity,
    project,
    towerWorlds,
    worldOfWall,
    type BoardProjection
} from './boardGeometry.js'

const VIEWS: BoardView[] = ['cavalier', 'plan']

function horizontalExtent(
    projection: BoardProjection,
    world: { x: number; y: number },
    sprite: string
): { left: number; right: number } {
    const frame = SHEET_LAYOUTS[projection.view].frames[sprite]
    const { x } = project(projection, world)
    return {
        left: x + frame.bx * UNITS_PER_CELL,
        right: x + (frame.bx + frame.bw) * UNITS_PER_CELL
    }
}

describe.each([2, 4])('the rotated board for %i players', (players) => {
    describe.each(VIEWS)('in the %s view', (view) => {
        const size = boardSize(players)
        const projection: BoardProjection = { view, sideways: true, size }
        const crop = croppedToCity(projection)

        function expectInside({ left, right }: { left: number; right: number }) {
            expect(left).toBeGreaterThanOrEqual(crop.x)
            expect(right).toBeLessThanOrEqual(crop.x + crop.width)
        }

        it('leaves the same margin on both sides of the city', () => {
            const west = project(projection, { x: 0, y: size.height / 2 }).x
            const east = project(projection, { x: 0, y: -size.height / 2 }).x
            expect(west - crop.x).toBeCloseTo(crop.x + crop.width - east)
        })

        it('keeps every tower inside the board', () => {
            for (const world of towerWorlds(size)) {
                expectInside(horizontalExtent(projection, world, 'tower-0'))
            }
        })

        it('keeps the walls on either side inside the board', () => {
            const sections: WallSection[] = [
                { side: WallSide.North, position: 0 },
                { side: WallSide.South, position: size.width - 1 }
            ]
            for (const section of sections) {
                expectInside(horizontalExtent(projection, worldOfWall(section, size), 'wall-v-0'))
            }
        })
    })
})
