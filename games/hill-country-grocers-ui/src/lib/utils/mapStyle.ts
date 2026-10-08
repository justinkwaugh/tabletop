import type { AxialCoordinates } from '@tabletop/common'
import { CityTier } from '@tabletop/hill-country-grocers'

export const TIER_FILL: Record<CityTier, string> = {
    [CityTier.White]: '#ffffff',
    [CityTier.Brown]: '#6b4636',
    [CityTier.Black]: '#1a1512'
}

export const MEADOW_TINTS = ['#c9c48a', '#c2c184', '#d0c890', '#bdbd7d', '#cdc48c', '#c6c788']
export const TOWN_GROUND = '#efe5c4'

// A stable pseudo-random value per hex so decoration never shifts between renders.
export function coordsSeed(coords: AxialCoordinates): number {
    const hash = Math.sin(coords.q * 12.9898 + coords.r * 78.233) * 43758.5453
    return hash - Math.floor(hash)
}

export type ContourHill = { x: number; y: number; rx: number; ry: number; seed: number }

// An irregular closed loop around a hill, so stacked rings read as surveyed contour lines.
export function contourPath(hill: ContourHill, scale: number): string {
    const steps = 36
    const points = Array.from({ length: steps }, (_, index) => {
        const angle = (index / steps) * Math.PI * 2
        const wobble =
            1 +
            0.09 * Math.sin(angle * 3 + hill.seed) +
            0.05 * Math.sin(angle * 5 + hill.seed * 2.3) +
            0.03 * Math.sin(angle * 9 + hill.seed * 4.1 + scale * 6)
        return {
            x: hill.x + Math.cos(angle) * hill.rx * scale * wobble,
            y: hill.y + Math.sin(angle) * hill.ry * scale * wobble
        }
    })
    const at = (index: number) => points[(index + steps) % steps]
    const segments = points.map((current, index) => {
        const previous = at(index - 1)
        const next = at(index + 1)
        const after = at(index + 2)
        const c1x = current.x + (next.x - previous.x) / 6
        const c1y = current.y + (next.y - previous.y) / 6
        const c2x = next.x - (after.x - current.x) / 6
        const c2y = next.y - (after.y - current.y) / 6
        return `C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${next.x.toFixed(1)} ${next.y.toFixed(1)}`
    })
    return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} ${segments.join(' ')} Z`
}
