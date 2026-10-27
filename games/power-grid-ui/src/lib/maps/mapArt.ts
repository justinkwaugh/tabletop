import type { Point } from '@tabletop/common'

export type MapArt = {
    width: number
    height: number
    cities: Record<string, [number, number]>
    land: string
    neighbours: string
    lakes: string
    rivers: string
    regions: Record<string, string>
    regionBorders: string
}

export function cityPoint(art: MapArt, cityId: string): Point {
    const [x, y] = art.cities[cityId]
    return { x, y }
}
