import { TechField, type TechDefinition } from '@tabletop/stellar-horizons-2'

export const TECH_CHART_WIDTH = 2000
const SOURCE_WIDTH = 3871
const SOURCE_HEIGHT = 3296
const SCALE = TECH_CHART_WIDTH / SOURCE_WIDTH

export const TECH_CHART_HEIGHT = Math.round(SOURCE_HEIGHT * SCALE)

const COLUMNS: readonly [number, number][] = [
    [356, 825],
    [932, 1400],
    [1508, 1978],
    [2084, 2554],
    [2660, 3130],
    [3236, 3706]
]

const ROWS: Record<TechField, readonly [number, number][]> = {
    [TechField.Biology]: [
        [323, 562],
        [627, 865],
        [929, 1167]
    ],
    [TechField.Physics]: [
        [1322, 1560],
        [1625, 1865],
        [1927, 2165]
    ],
    [TechField.Engineering]: [
        [2323, 2560],
        [2623, 2862],
        [2927, 3165]
    ]
}

export interface TechBox {
    x: number
    y: number
    width: number
    height: number
}

export function techBox(tech: TechDefinition): TechBox {
    const [left, right] = COLUMNS[tech.column - 1]
    const [top, bottom] = ROWS[tech.field][tech.row - 1]
    return {
        x: left * SCALE,
        y: top * SCALE,
        width: (right - left) * SCALE,
        height: (bottom - top) * SCALE
    }
}
