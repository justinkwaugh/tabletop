import type { Point } from '@tabletop/common'
import { usaCity, type CityId } from '@tabletop/ride-the-rails'
import { hexCenter } from './boardGeometry.js'
import {
    PASSENGER_LIFT,
    PASSENGER_SCALE,
    START_PASSENGER_SCALE,
    passengerOffset
} from './cityMarks.js'

export type PassengerSpot = Point & { scale: number }

/** Where a city's passenger stands, or stood, in board units, and its scale there. */
export function passengerSpot(cityId: CityId, lifted: boolean): PassengerSpot {
    const center = hexCenter(usaCity(cityId).hexId)
    const offset = passengerOffset(cityId)
    return {
        x: center.x + offset.x,
        y: center.y + offset.y - (lifted ? PASSENGER_LIFT * PASSENGER_SCALE : 0),
        scale: PASSENGER_SCALE
    }
}

/** A picked journey start's passenger: grown and centred in its hex, where the route begins. */
export function startPassengerSpot(cityId: CityId): PassengerSpot {
    return { ...hexCenter(usaCity(cityId).hexId), scale: START_PASSENGER_SCALE }
}
