import { Color } from '@tabletop/common'
import { BUS_BUSES_TABLE_SLOT_POINTS_BY_COLOR } from '$lib/definitions/busBoardGraph.js'

export type BusesTableColumnKey = keyof typeof BUS_BUSES_TABLE_SLOT_POINTS_BY_COLOR

export function busesTableColumnKeyForColor(color: Color | undefined): BusesTableColumnKey | undefined {
    switch (color) {
        case Color.Purple:
            return 'purple'
        case Color.Blue:
            return 'blue'
        case Color.Green:
            return 'green'
        case Color.Yellow:
            return 'yellow'
        case Color.Red:
            return 'red'
        default:
            return undefined
    }
}
