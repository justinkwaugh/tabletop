import { describe, expect, it } from 'vitest'
import { CellType, type Cell } from '@tabletop/fresh-fish'
import { CELL_SIZE, landCornerRadii, landShadowImage, SHADOW_MARGIN } from './landShape.js'

const land: Cell = { type: CellType.Empty }
const water: Cell = { type: CellType.OffBoard }

// An L of land: the top row is two squares wide, the bottom row one.
const cells: Cell[][] = [
    [land, land],
    [land, water]
]

function decodedSvg(cells: Cell[][]): string {
    const url = landShadowImage(cells)
    expect(url.startsWith('data:image/svg+xml,')).toBe(true)
    return decodeURIComponent(url.slice('data:image/svg+xml,'.length))
}

describe('landCornerRadii', () => {
    it('rounds only the corners with water on both sides', () => {
        expect(landCornerRadii(cells, [0, 0])).toEqual([12, 0, 0, 0])
        expect(landCornerRadii(cells, [1, 0])).toEqual([0, 12, 12, 0])
        expect(landCornerRadii(cells, [0, 1])).toEqual([0, 0, 12, 12])
    })

    it('leaves water square', () => {
        expect(landCornerRadii(cells, [1, 1])).toEqual([0, 0, 0, 0])
    })
})

describe('landShadowImage', () => {
    it('spans the board and its margin', () => {
        const size = 2 * CELL_SIZE + 2 * SHADOW_MARGIN
        expect(decodedSvg(cells)).toContain(`width="${size}" height="${size}"`)
    })

    it('outlines the land squares only', () => {
        const path = /<path[^>]* d="([^"]*)"/.exec(decodedSvg(cells))?.[1] ?? ''
        expect(path.match(/M/g)).toHaveLength(3)
        expect(path).not.toContain(`M${SHADOW_MARGIN + CELL_SIZE} ${SHADOW_MARGIN + CELL_SIZE}`)
    })

    it('blurs the shadow across the whole image, not just the land', () => {
        expect(decodedSvg(cells)).toContain('filterUnits="userSpaceOnUse"')
    })

    // CSS drop-shadow(0 8px 12px) takes 12px as the blur's standard deviation.
    it('blurs as the drop-shadow it replaced, with room for it to fade out', () => {
        expect(decodedSvg(cells)).toContain('stdDeviation="12"')
        expect(SHADOW_MARGIN).toBeGreaterThanOrEqual(8 + 3 * 12)
    })
})
