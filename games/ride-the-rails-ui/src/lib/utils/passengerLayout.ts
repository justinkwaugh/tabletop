import type { Point } from '@tabletop/common'
import { cityById, type CityId } from '@tabletop/ride-the-rails'
import { hexCells, hexCenter } from './boardGeometry.js'
import {
    PASSENGER_LIFT,
    PASSENGER_SCALE,
    START_PASSENGER_SCALE,
    passengerOffset
} from './cityMarks.js'

export type PassengerSpot = Point & { scale: number }

/**
 * Where a city's passenger stands, or stood, in board units, and its scale there: from the centre
 * of the city's own cell (R-8: Berlin's first of two).
 */
export function passengerSpot(cityId: CityId, lifted: boolean): PassengerSpot {
    const hexId = cityById(cityId).hexId
    const center = hexCells(hexId)[0]?.center ?? hexCenter(hexId)
    const offset = passengerOffset(cityId)
    return {
        x: center.x + offset.x,
        y: center.y + offset.y - (lifted ? PASSENGER_LIFT * PASSENGER_SCALE : 0),
        scale: PASSENGER_SCALE
    }
}

/** A picked journey start's passenger: grown and centred in its hex, where the route begins. */
export function startPassengerSpot(cityId: CityId): PassengerSpot {
    return { ...hexCenter(cityById(cityId).hexId), scale: START_PASSENGER_SCALE }
}
