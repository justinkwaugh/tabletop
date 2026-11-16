import type { Point } from '@tabletop/common'
import { usaCity, type CityId } from '@tabletop/ride-the-rails'
import { hexCenter } from './boardGeometry.js'
import { PASSENGER_LIFT, PASSENGER_SCALE, passengerOffset } from './cityMarks.js'

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
