import { assertExists } from '@tabletop/common'
import type { TileRevenue } from '../tiles/tile.js'

export function routeRevenue(revenue: TileRevenue, stages: readonly string[]): number {
    if (revenue.kind === 'fixed') return revenue.amount
    const value = [...stages]
        .reverse()
        .map((stage) => revenue.values.find((value) => value.stage === stage))
        .find((value) => value !== undefined)
    assertExists(value, 'No applicable revenue value')
    return value.amount
}
