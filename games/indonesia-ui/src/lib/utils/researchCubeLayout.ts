import type { Point } from '@tabletop/common'

function createFallbackCubeLayout(cubeCount: number, cubeSpacing: number): Point[] {
    const offsets: Point[] = []
    const perRow = Math.ceil(Math.sqrt(cubeCount))
    const width = (perRow - 1) * cubeSpacing
    const xStart = -width / 2
    const yStart = -width / 2

    for (let index = 0; index < cubeCount; index += 1) {
        const row = Math.floor(index / perRow)
        const column = index % perRow
        offsets.push({
            x: xStart + column * cubeSpacing,
            y: yStart + row * cubeSpacing
        })
    }

    return offsets
}

export function researchCubeOffsets(
    cubeCount: number,
    cubeSpacing: number,
    rowSeed?: string,
    layoutSeed?: string
): readonly Point[] {
    const yBias = -cubeSpacing * 0.08
    const layoutRadiusScale = 0.92

    if (cubeCount === 1) {
        return [{ x: -cubeSpacing * 0.6, y: -cubeSpacing * 0.38 }]
    }

    if (cubeCount === 2) {
        const seed = layoutSeed ?? `pair-${cubeCount}`
        const axisDegrees = twoCubeAxisDegrees(seed, rowSeed ?? '')
        const radius = cubeSpacing * 0.9 * layoutRadiusScale
        const first = rotatePoint({ x: radius, y: 0 }, axisDegrees)
        const second = rotatePoint({ x: -radius, y: 0 }, axisDegrees)
        return [
            { x: first.x, y: first.y + yBias },
            { x: second.x, y: second.y + yBias }
        ]
    }

    if (cubeCount === 3) {
        const baseTriangle: Point[] = [
            {
                x: -cubeSpacing * 0.76 * layoutRadiusScale,
                y: cubeSpacing * 0.62 * layoutRadiusScale + yBias
            },
            {
                x: cubeSpacing * 0.76 * layoutRadiusScale,
                y: cubeSpacing * 0.62 * layoutRadiusScale + yBias
            },
            { x: 0, y: -cubeSpacing * 0.8 * layoutRadiusScale + yBias }
        ]
        if (rowSeed === 'bid') {
            return baseTriangle
        }

        const seed = layoutSeed ?? `triangle-${cubeCount}`
        const rotationDegrees = triangleLayoutRotationDegrees(seed, rowSeed ?? '')
        return baseTriangle.map((point) => rotatePoint(point, rotationDegrees))
    }

    if (cubeCount === 4) {
        const topRowY = -cubeSpacing * 0.76 * layoutRadiusScale + yBias
        const bottomRowY = cubeSpacing * 0.88 * layoutRadiusScale + yBias
        return [
            { x: -cubeSpacing * 0.76 * layoutRadiusScale, y: topRowY },
            { x: cubeSpacing * 0.76 * layoutRadiusScale, y: topRowY },
            { x: -cubeSpacing * 0.76 * layoutRadiusScale, y: bottomRowY },
            { x: cubeSpacing * 0.76 * layoutRadiusScale, y: bottomRowY }
        ]
    }

    if (cubeCount === 5) {
        const radius = cubeSpacing * 1 * layoutRadiusScale
        const downwardShift = cubeSpacing / 6
        const points: Point[] = []
        for (let index = 0; index < cubeCount; index += 1) {
            const angle = -Math.PI / 2 + (index * 2 * Math.PI) / cubeCount
            points.push({
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius + yBias + downwardShift
            })
        }

        return points
    }

    if (cubeCount % 2 === 1 && cubeCount > 5) {
        // For larger odd counts, avoid placing a cube directly on the center value.
        const ring = createFallbackCubeLayout(cubeCount - 1, cubeSpacing)
        return [{ x: 0, y: -cubeSpacing * 0.42 }, ...ring]
    }

    if (cubeCount % 2 === 0 && cubeCount > 4) {
        // Keep the center open for larger even counts as well.
        return createFallbackCubeLayout(cubeCount, cubeSpacing).map((point) => ({
            x: point.x,
            y: point.y + yBias
        }))
    }

    return createFallbackCubeLayout(cubeCount, cubeSpacing)
}

const RESEARCH_CUBE_ROTATION_MAX_DEGREES = 8
const RESEARCH_CUBE_HORIZONTAL_JITTER_RATIO = 0.05

function hashString32(value: string): number {
    let hash = 2166136261
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index)
        hash = Math.imul(hash, 16777619)
    }
    return hash >>> 0
}

function triangleLayoutRotationDegrees(seed: string, rowSeed: string): number {
    const seedHash = hashString32(`tri:${seed}`)
    const rowHash = hashString32(`tri-row:${rowSeed}`)
    const mixedHash = Math.imul(seedHash ^ rowHash, 1597334677) >>> 0
    const normalized = mixedHash / 4294967295
    return normalized * 360
}

function twoCubeAxisDegrees(seed: string, rowSeed: string): number {
    const seedHash = hashString32(`pair:${seed}`)
    const rowHash = hashString32(`pair-row:${rowSeed}`)
    const mixedHash = Math.imul(seedHash ^ rowHash, 1103515245) >>> 0
    const normalized = mixedHash / 4294967295
    const minimumAxis = 60
    const maximumAxis = 120
    return minimumAxis + normalized * (maximumAxis - minimumAxis)
}

function rotatePoint(point: Point, degrees: number): Point {
    const radians = (degrees * Math.PI) / 180
    const cosine = Math.cos(radians)
    const sine = Math.sin(radians)
    return {
        x: point.x * cosine - point.y * sine,
        y: point.x * sine + point.y * cosine
    }
}

export function researchCubeRotationDegrees(seed: string, rowSeed: string): number {
    const seedHash = hashString32(seed)
    const rowHash = hashString32(`row:${rowSeed}`)
    const mixedHash = Math.imul(seedHash ^ rowHash, 2246822519) >>> 0
    const normalized = mixedHash / 4294967295
    return (normalized * 2 - 1) * RESEARCH_CUBE_ROTATION_MAX_DEGREES
}

export function researchCubeHorizontalJitter(
    seed: string,
    rowSeed: string,
    cubeSpacing: number
): number {
    const seedHash = hashString32(`x:${seed}`)
    const rowHash = hashString32(`row-x:${rowSeed}`)
    const mixedHash = Math.imul(seedHash ^ rowHash, 3266489917) >>> 0
    const normalized = mixedHash / 4294967295
    const maxJitter = cubeSpacing * RESEARCH_CUBE_HORIZONTAL_JITTER_RATIO
    return (normalized * 2 - 1) * maxJitter
}
