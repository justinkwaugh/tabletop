import type { AxialCoordinates } from '@tabletop/common'
import { HEX_RADIUS, isPoint } from './geometry.js'

const COLUMNS = 'ABCDEFGHIJK'

// Columns A–K run left to right; numbers rise up each column and stay level along one diagonal,
// so column A runs A2–A5 and column K runs K7–K10.
export function pointName(coords: AxialCoordinates): string {
    return `${COLUMNS[coords.q + HEX_RADIUS]}${HEX_RADIUS + 1 - coords.r}`
}

export function pointFromName(name: string): AxialCoordinates {
    const coords = {
        q: COLUMNS.indexOf(name[0].toUpperCase()) - HEX_RADIUS,
        r: HEX_RADIUS + 1 - Number(name.slice(1))
    }
    if (!isPoint(coords)) {
        throw Error(`No point ${name}`)
    }
    return coords
}
