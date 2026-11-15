import { Terrain } from '@tabletop/preussische-ostbahn'

export const TERRAIN_FILLS: Record<Terrain, string> = {
    [Terrain.Plains]: '#f7f3e7',
    [Terrain.Hills]: '#ede2c2',
    [Terrain.Mountains]: '#e0c9b2'
}

export const HEX_STROKE = '#6f6553'
export const GRID_LINE = '#b5ab95'
export const TINT_LINE = '#f8f4ea'
export const HOME_INSET = 35
export const APPROACH_HATCH_ID = 'po-approach-hatch'
export const APPROACH_HATCH = { gap: 7, width: 2, color: '#9fb9bf' }
export const CITY_FILL = '#c4c6c6'
export const BERLIN_FILL = '#a9c0c4'

export const TERRAIN_MARKS: Partial<Record<Terrain, string>> = {
    [Terrain.Hills]: '#94742f',
    [Terrain.Mountains]: '#7b4a2d'
}

export function terrainMarkPath(
    terrain: Terrain,
    x: number,
    base: number,
    scale: number = 1
): string | undefined {
    const points =
        terrain === Terrain.Hills
            ? 'M -6.5 0 C -5 -8, 5 -8, 6.5 0 Z'
            : terrain === Terrain.Mountains
              ? 'M -9 0 L -3 -8 L 1 -3 L 4 -6 L 9 0 Z'
              : undefined
    if (!points) return undefined
    let axis = 0
    return points.replace(/-?\d+(\.\d+)?/g, (value) => {
        const scaled = Number(value) * scale + (axis === 0 ? x : base)
        axis = 1 - axis
        return `${Math.round(scaled * 100) / 100}`
    })
}
