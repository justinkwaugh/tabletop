import type { Point } from '@tabletop/common'

export const BLOCK_LENGTH = 104
export const BLOCK_THICKNESS = 20

export interface BlockFootprint {
    centre: Point
    angle: number
}

const SAMPLE_STEP = 12
const SAMPLE_ROWS = [-BLOCK_THICKNESS * 0.4, 0, BLOCK_THICKNESS * 0.4]

function axesOf(block: BlockFootprint): { along: Point; across: Point } {
    const radians = (block.angle * Math.PI) / 180
    const along = { x: Math.cos(radians), y: Math.sin(radians) }
    return { along, across: { x: -along.y, y: along.x } }
}

function at(block: BlockFootprint, reach: number, offset: number): Point {
    const { along, across } = axesOf(block)
    return {
        x: block.centre.x + along.x * reach + across.x * offset,
        y: block.centre.y + along.y * reach + across.y * offset
    }
}

export function blockCorners(block: BlockFootprint): Point[] {
    return [-1, 1].flatMap((end) =>
        [-1, 1].map((side) => at(block, (end * BLOCK_LENGTH) / 2, (side * BLOCK_THICKNESS) / 2))
    )
}

export function blockSamples(block: BlockFootprint): Point[] {
    const count = Math.ceil(BLOCK_LENGTH / SAMPLE_STEP)
    return Array.from(
        { length: count + 1 },
        (_, index) => -BLOCK_LENGTH / 2 + (BLOCK_LENGTH * index) / count
    ).flatMap((reach) => SAMPLE_ROWS.map((row) => at(block, reach, row)))
}

export function coveredBy(
    blocks: readonly BlockFootprint[],
    margin = 0
): (point: Point) => boolean {
    const halfLength = BLOCK_LENGTH / 2 + margin
    const halfThickness = BLOCK_THICKNESS / 2 + margin
    const lying = blocks.map((block) => ({ centre: block.centre, ...axesOf(block) }))
    return (point) =>
        lying.some(({ centre, along, across }) => {
            const x = point.x - centre.x
            const y = point.y - centre.y
            return (
                Math.abs(x * along.x + y * along.y) <= halfLength &&
                Math.abs(x * across.x + y * across.y) <= halfThickness
            )
        })
}

export function topmostAt<Block extends BlockFootprint>(
    blocksInDrawingOrder: readonly Block[],
    point: Point
): Block | undefined {
    return blocksInDrawingOrder.findLast((block) => coveredBy([block])(point))
}
