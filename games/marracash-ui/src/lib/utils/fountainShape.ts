import type { Point } from '@tabletop/common'

export const FountainTurn = 22.5
export const FountainRadii = { rim: 38, water: 32, trim: 42, ring: 44 }
export const EntranceRadii = { rim: 39, water: 33, trim: 43, ring: 47 }
export const FountainRippleRadii = [10, 17, 24]

export const FountainWaterFilterId = 'marracash-fountain-water'
export const FountainGlintsPatternId = 'marracash-fountain-glints'
export const FountainGlintsTileSize = 240
export const FountainRimShadeId = 'marracash-fountain-rim-shade'
export const FountainWaterShadeId = 'marracash-fountain-water-shade'
export const FountainShadowOffset = { x: 1.5, y: 2.5 }

const StarInnerRatio = Math.cos(Math.PI / 4) / Math.cos(Math.PI / 8)

function polygon(center: Point, corners: { angle: number; radius: number }[]): string {
    const points = corners.map(({ angle, radius }) => {
        const radians = (angle * Math.PI) / 180
        return `${(center.x + radius * Math.cos(radians)).toFixed(1)} ${(center.y + radius * Math.sin(radians)).toFixed(1)}`
    })
    return `M ${points.join(' L ')} Z`
}

export function octagon(center: Point, radius: number): string {
    return polygon(
        center,
        Array.from({ length: 8 }, (_, index) => ({ angle: index * 45 + FountainTurn, radius }))
    )
}

export function eightPointedStar(center: Point, radius: number): string {
    return polygon(
        center,
        Array.from({ length: 16 }, (_, index) => ({
            angle: index * 22.5 - 90,
            radius: index % 2 === 0 ? radius : radius * StarInnerRatio
        }))
    )
}
